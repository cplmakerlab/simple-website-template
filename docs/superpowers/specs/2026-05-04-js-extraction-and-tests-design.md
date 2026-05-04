# JS-extractie & Test Suite — Design Spec

**Datum:** 2026-05-04
**Status:** Ontwerp goedgekeurd, klaar voor implementatieplan

---

## Doel

1. Extraheer alle pure business-logica uit inline `<script>`-blokken naar ES modules
2. Consolideer gedupliceerde helpers naar een gedeeld bestand
3. Schrijf logische tests met synthetische data (verwachte output, niet code-validatie)
4. Gebruik Vitest als test-framework

---

## Bestandsstructuur na extractie

```
battery-roi-tool/
├── assets/js/
│   ├── calc-engine.js          ← NIEUW: pure berekeningslogica (~800 regels)
│   ├── shared-helpers.js       ← NIEUW: escapeHtml, showToast, datums, etc.
│   ├── csv.js                  ← BESTAAND → migreren naar ES module exports
│   ├── firebase-init.js        ← BESTAAND: blijft classic <script> (Firebase compat)
│   ├── photo-uploader.js       ← BESTAAND: _esc fallback → import escapeHtml
│   └── offertes-ui.js          ← BESTAAND: ongewijzigd in deze fase
├── tests/
│   ├── calc-engine.test.js     ← Tests berekeningslogica
│   ├── shared-helpers.test.js  ← Tests helpers
│   ├── csv.test.js             ← Tests CSV-parsing
│   └── fixtures/
│       └── synthetic-data.js   ← Synthetische testdata
├── vitest.config.js
├── package.json                ← Vitest dependency + type:module + test script
├── index.html                  ← <script type="module"> + import calc-engine
├── dashboard.html              ← <script type="module"> + import shared-helpers
└── project-edit.html           ← <script type="module"> + import shared-helpers
```

---

## Module 1: `assets/js/calc-engine.js`

### Exports

```js
// === Constanten ===
export const CALC_CONSTANTS = {
  DAYS_PER_YEAR: 365,
  MIN_FULL_CHARGE_DAYS: 100,
  CAP_SWEEP_STEP: 2.5,
  CAP_SWEEP_MAX: 200,
  BTW_REDUCED: 6,
  BTW_STANDARD: 21,
};

export const MONTH_NL_FULL = ['Januari', ..., 'December'];

// === CSV → dagdata transformatie ===
export function csvToAllDaysAndMeta(csvText)
// Retourneert: { allDays: Array<DayRecord>, eanCode, meterNr, meterType }

export function buildAllDaysFromDailyCompact(dailyCompact)
// Retourneert: Array<DayRecord>

// === Kernberekening ===
export function calcScenario(windowDays, opts)
// opts: { threshold, installPrice, batCap, eff, useCap, scaleFactor,
//         effectivePrice, totalAfname, totalInjectie, pvInverter, batteryInverter }
// Retourneert: ScenarioResult

export function processDataPure(input, pvInv, selectedConfigs, priceDay, priceNight)
// input: string (CSV) | { allDays, eanCode, meterNr, meterType }
// Retourneert: CalcResult (het volledige `d` object dat renderResults verwacht)

export function computePerYearStats(allDays, pvInv, selectedConfigs, lastDate, priceDay, priceNight)
// Retourneert: { numYears, yearsStart, perYear: [...] }

export function averageStats(perYear, selectedConfigs)
// Retourneert: { totalAfname, totalInjectie, ..., scenarios: [...] } | null

export function capAnalysis(windowDays, pvInv, scaleFactor, effectivePrice)
// Retourneert: Array<{ capacity, fullDays, annualSaving, payback, isMax }>

// === Config-parsing (Google Sheet) ===
export function parseSheetConfigs(csvText)
// Retourneert: Array<ConfigProduct>

export function parseEurAmount(str)
// Retourneert: number

export function parseCSVLine(line)
// Retourneert: Array<string>

// === Chart-bucket helpers ===
export function buildYearBuckets(allDays)
export function buildMonthBuckets(windowDays)
export function buildDayBuckets(allDays, monthKey)
export function availableMonthKeys(allDays)
export function buildYearBucketsFromMonthMap(monthMap)
export function buildMonthBucketsFromMonthMap(monthMap)

// === Formatters ===
export function fmt2(n)        // "3.14"
export function fmtEur(n)      // "€ 3,14"
export function formatDate(d)  // "01-01-2024"
export function renderWithAvg(currentValue, avgValue, formatter, numYears)
```

### Datatypes (documentatie)

```ts
// Niet TypeScript — enkel ter documentatie van shapes

type DayRecord = {
  date: Date;
  afname: number;       // kWh totaal
  injectie: number;     // kWh totaal
  afnamedag: number;    // kWh dag-register
  afnamenacht: number;  // kWh nacht-register
  injectiedag: number;
  injectienacht: number;
};

type ConfigProduct = {
  type: string;           // bv. "Zendure SolarFlow 2400 AC+"
  omschrijving: string;
  batCap: number;         // kWh
  batInv: number;         // kW (batterij-inverter)
  eff: number;            // 0-1 (efficiency)
  prices: {
    '6_no': number;
    '6_yes': number;
    '21_no': number;
    '21_yes': number;
  };
};

type ScenarioResult = {
  qualifyingDays: number;
  partialDays: number;
  chargedFull: number;        // kWh totaal fully charged
  chargedPartial: number;     // kWh totaal partially charged
  annualChargedFull: number;  // geëxtrapoleerd naar jaar
  annualChargedPartial: number;
  annualCharged: number;      // sum
  annualSavingFull: number;   // € besparing (full days)
  annualSavingPartial: number;
  annualSaving: number;       // sum
  payback: number;            // jaren terugverdientijd
  recoveryPct: number;        // 0-100%
  injPct: number;             // % injectie benut
  threshold: number;          // kWh drempel voor full-charge dag
};

type CalcResult = {
  allDays: DayRecord[];
  windowDays: DayRecord[];
  windowStart: Date;
  windowEnd: Date;
  lastDate: Date;
  daysInWindow: number;
  isFullYear: boolean;
  scaleFactor: number;
  totalAfname: number;
  totalInjectie: number;
  effectivePrice: number;
  scenarios: Array<{ config: ConfigProduct; scenWC: ScenarioResult; scenOpt: ScenarioResult }>;
  capAnalysis: Array<{ capacity, fullDays, annualSaving, payback, isMax }>;
  numYears: number;
  avgStats: object | null;
  // + metadata: eanCode, meterNr, meterType
};
```

### Belangrijkste refactoring: processData → processDataPure

**Huidig** (index.html ~regel 1557):
```js
function processData(input, pvInv, selectedConfigs, priceDay, priceNight) {
  // ... 150 regels berekening ...
  renderResults(d);  // ← side-effect: DOM rendering
}
```

**Nieuw** (calc-engine.js):
```js
export function processDataPure(input, pvInv, selectedConfigs, priceDay, priceNight) {
  // ... zelfde berekening ...
  return d;  // ← puur: retourneert data
}
```

**Nieuw** (index.html, na import):
```js
import { processDataPure } from './assets/js/calc-engine.js';

function processData(input, pvInv, selectedConfigs, priceDay, priceNight) {
  const d = processDataPure(input, pvInv, selectedConfigs, priceDay, priceNight);
  renderResults(d);
}
```

### Refactoring: calcScenario uit closure halen

**Huidig**: `calcScenario` is genest in `processData` en leest closure-variabelen
(`windowDays`, `scaleFactor`, `effectivePrice`, `totalAfname`, `totalInjectie`).

**Nieuw**: alle closure-variabelen worden expliciete parameters:
```js
export function calcScenario(windowDays, {
  threshold, installPrice, batCap, eff, useCap,
  scaleFactor, effectivePrice, totalAfname, totalInjectie,
  pvInverter, batteryInverter
}) { ... }
```

---

## Module 2: `assets/js/shared-helpers.js`

### Exports

```js
// === HTML/Security ===
export function escapeHtml(s)
// Null-safe, returns escaped string

// === UI Feedback ===
export function showToast(message, variant = 'primary')
// Bootstrap 5 toast met auto-cleanup. Vereist #toastContainer in DOM.

// === Auth UI ===
export function showState(which)
// Toggelt stateLoggedOut/stateNotWhitelisted/stateAuthorized visibility.
// Vereist die 3 elementen in DOM.

// === String utils ===
export function shortEmail(e)
// "kevin@example.com" → "kevin"

// === Datum formatting (Firestore Timestamps) ===
export function fmtDate(ts)
// Firestore Timestamp → "01 mrt 2026"

export function formatTs(ts)
// Firestore Timestamp → "01 mrt 2026, 14:30"

export function fmtRelTime(ts)
// Firestore Timestamp → "5 min geleden" / "vandaag 14:30" / "gisteren 09:15" / "12 mrt 14:30"
```

### Impact op bestaande bestanden

| Bestand | Verwijderd | Toegevoegd |
|---------|-----------|-----------|
| dashboard.html | ~45 regels (6 functies) | `import { escapeHtml, showToast, showState, shortEmail, fmtDate, fmtRelTime } from './assets/js/shared-helpers.js'` |
| project-edit.html | ~35 regels (5 functies) | `import { escapeHtml, showToast, showState, shortEmail, formatTs } from './assets/js/shared-helpers.js'` |
| index.html | ~4 regels (`escapeHtmlLite`) | `import { escapeHtml } from './assets/js/shared-helpers.js'` |
| photo-uploader.js | `_esc` fallback (~7 regels) | `import { escapeHtml } from './shared-helpers.js'` |

---

## Module 3: `assets/js/csv.js` → ES module

### Migratie

**Huidig** (globals via `<script src>`):
```js
function parseCSV(text) { ... }
function parseDate(str) { ... }
function parsVolume(str) { ... }
function extractCsvForStorage(csvText) { ... }
```

**Nieuw** (ES module):
```js
export function parseCSV(text) { ... }
export function parseDate(str) { ... }
export function parsVolume(str) { ... }
export function extractCsvForStorage(csvText) { ... }
```

`calc-engine.js` importeert `parseCSV`, `parseDate`, `parsVolume` uit `./csv.js`.
HTML-bestanden die `extractCsvForStorage` nodig hebben importeren het direct:
```js
// in dashboard.html en project-edit.html <script type="module">:
import { extractCsvForStorage } from './assets/js/csv.js';
// in index.html <script type="module"> (via calc-engine, maar ook direct voor upload):
import { extractCsvForStorage } from './assets/js/csv.js';
```
`parseCSV`, `parseDate`, `parsVolume` worden NIET meer direct door HTML geïmporteerd — die lopen via `calc-engine.js`.

---

## Test-strategie

### Filosofie

Tests redeneren over **verwachte output gegeven bekende input** — niet over wat de code momenteel doet. We bouwen synthetische datasets met waarden die met de hand te verifiëren zijn.

### Synthetische testdata (`tests/fixtures/synthetic-data.js`)

#### Dataset 1: "Perfecte dag" — eenvoudigst mogelijke case
```js
// 365 identieke dagen: 10 kWh afname, 8 kWh injectie, enkeltarief
// Verwachte uitkomst:
// - Met 5 kWh batterij (eff 0.90): elke dag 5*0.9 = 4.5 kWh bespaard
// - Jaarlijkse besparing: 365 * 4.5 * prijs
// - Terugverdientijd: installPrice / jaarlijkseBesparing
```

#### Dataset 2: "Seizoenspatroon" — zomer vs winter
```js
// 182 dagen zomer: 8 kWh afname, 15 kWh injectie
// 183 dagen winter: 15 kWh afname, 2 kWh injectie
// Test: worst-case cap beperkt opslag tot dagelijkse afname
```

#### Dataset 3: "Klein systeem, groot verbruik"
```js
// Elke dag 30 kWh afname, 20 kWh injectie
// Batterij 2.5 kWh: nooit meer dan 2.5 kWh opslaan per dag
// Test: qualifyingDays (threshold) vs partialDays correctheid
```

#### Dataset 4: "Onder een jaar" — extrapolatie
```js
// 200 dagen data (< 365)
// Test: scaleFactor = 365/200 = 1.825
// Jaarlijkse besparing = dagelijkse * scaleFactor
// isFullYear = false
```

#### Dataset 5: "Multi-year" — gemiddelde over meerdere jaren
```js
// 730 dagen (exact 2 jaar)
// Jaar 1: hogere injectie, Jaar 2: lagere injectie
// Test: averageStats middelt correct, numYears = 2
```

#### Dataset 6: "Dubbeltarief" — dag/nacht split
```js
// Dagen met afnamedag=6, afnamenacht=4, injectiedag=7, injectienacht=1
// Test: effectivePrice berekening met gewogen dag/nacht-prijzen
```

### Test-cases per module

#### `calc-engine.test.js`

```
describe('calcScenario')
  ✓ berekent jaarlijkse besparing correct bij constante dagelijkse waarden
  ✓ worst-case (useCap=true) capt opslag op dagelijkse afname
  ✓ optimistisch (useCap=false) gebruikt volledige batterijcapaciteit
  ✓ pvInverter > batteryInverter schaalt threshold op
  ✓ terugverdientijd = installPrice / annualSaving
  ✓ recoveryPct = (annualSaving / installPrice) * 100
  ✓ partialDays + qualifyingDays ≤ totaal dagen
  ✓ annualCharged = annualChargedFull + annualChargedPartial
  ✓ efficiency verlies wordt correct toegepast (charged * eff = saving)

describe('processDataPure')
  ✓ retourneert correct CalcResult object (shape check)
  ✓ rolling 365-day window pakt laatste jaar
  ✓ extrapolatie bij < 365 dagen met correcte scaleFactor
  ✓ isFullYear = false wanneer daysInWindow < 365
  ✓ meerdere configs produceren elk een scenWC + scenOpt paar
  ✓ totalAfname = som van alle windowDays.afname

describe('computePerYearStats')
  ✓ splitst 730 dagen in exact 2 jaar-blokken
  ✓ elk jaar-blok heeft eigen scenarios berekend
  ✓ numYears = 1 bij exact 365 dagen
  ✓ numYears = 0 bij < 365 dagen

describe('averageStats')
  ✓ middelt totalAfname over N jaren
  ✓ middelt scenario-besparingen over N jaren
  ✓ retourneert null bij lege input

describe('capAnalysis')
  ✓ swept van 2.5 tot 200 kWh in stappen van 2.5
  ✓ markeert isMax bij laatste capaciteit met ≥100 full-charge dagen
  ✓ hogere capaciteit → minder full-charge dagen (monotoon dalend)
  ✓ jaarlijkse besparing stijgt met capaciteit (tot plateau)
```

#### `csv.test.js`

```
describe('parseCSV')
  ✓ splitst semicolon-separated Fluvius CSV correct
  ✓ eerste rij wordt kolomnamen (keys in objecten)
  ✓ lege regels worden overgeslagen
  ✓ regels met te weinig kolommen worden overgeslagen

describe('parseDate')
  ✓ "15-03-2025" → Date(2025, 2, 15)
  ✓ ongeldige string → Invalid Date

describe('parsVolume')
  ✓ "1.234,56" → 1234.56
  ✓ "0,001" → 0.001
  ✓ lege string → NaN (of 0, te bepalen)

describe('extractCsvForStorage')
  ✓ retourneert correcte dailyCompact shape
  ✓ aggregeert meerdere register-rijen per dag
  ✓ onderscheidt afname/injectie en dag/nacht registers
```

#### `shared-helpers.test.js`

```
describe('escapeHtml')
  ✓ escapet & < > " '
  ✓ null → ""
  ✓ undefined → ""
  ✓ getal → string representatie, onge-escaped

describe('shortEmail')
  ✓ "kevin@example.com" → "kevin"
  ✓ null → "—"
  ✓ "" → "—"

describe('fmtDate')
  ✓ Firestore Timestamp → "01 mrt 2026" formaat
  ✓ null → "—"
  ✓ object zonder toDate → "—"

describe('fmtRelTime')
  ✓ < 60 seconden → "net nu"
  ✓ 5 minuten geleden → "5 min geleden"
  ✓ vandaag → "vandaag HH:MM"
  ✓ gisteren → "gisteren HH:MM"
  ✓ ouder → "DD MMM HH:MM"
```

---

## Projectconfiguratie

### `package.json`

```json
{
  "name": "battery-roi-tool",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.1.0"
  }
}
```

### `vitest.config.js`

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
  },
});
```

### `.gitignore` toevoeging

```
node_modules/
```

---

## Migratiestrategie voor HTML-bestanden

### Script-tag migratie

Alle drie de HTML-bestanden migreren hun inline `<script>` naar `<script type="module">`. Dit is backward-compatible met alle moderne browsers (ES modules worden ondersteund sinds 2018 in alle major browsers).

**Volgorde van aanpassingen per bestand:**

1. Voeg `type="module"` toe aan de inline `<script>`-tag
2. Voeg `import` statements toe bovenaan het script
3. Verwijder de functie-definities die nu geïmporteerd worden
4. Vervang eventuele functienamen (`escapeHtmlLite` → `escapeHtml`)

### firebase-init.js blijft een classic script

Firebase compat SDK (`firebase/compat/app`, etc.) laadt via CDN als globale
objecten. `firebase-init.js` gebruikt `firebase.initializeApp()` etc. als
globals. Dit migreren naar ES modules vereist een bundler of overstap naar de
modulaire Firebase SDK — dat is een apart project (out of scope).

**Implicatie:** functies uit `firebase-init.js` (zoals `getProductsConfig`,
`saveLastCalcRun`, etc.) blijven beschikbaar als globals. De nieuwe ES modules
ontvangen deze als parameters waar nodig, of de HTML-code orchestreert: eerst
Firebase-globals laden, dan de modules gebruiken.

**Laadvolgorde in HTML:**
```html
<!-- Firebase SDK (classic) -->
<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js"></script>
<script src="assets/js/firebase-init.js"></script>

<!-- ES modules (na Firebase globals) -->
<script type="module">
  import { processDataPure, calcScenario } from './assets/js/calc-engine.js';
  import { escapeHtml } from './assets/js/shared-helpers.js';
  // ... pagina-logica die zowel imports als Firebase-globals gebruikt
</script>
```

---

## Scope-afbakening

### In scope
- Extractie calc-engine, shared-helpers, csv.js → ES modules
- Vitest setup + synthetische testdata
- Logische tests voor alle pure functies
- HTML-bestanden migreren naar `<script type="module">`
- Verwijder duplicaten uit HTML-bestanden

### Buiten scope (latere iteratie)
- firebase-init.js migreren naar ES module
- photo-uploader.js / offertes-ui.js refactoring
- DOM/integration tests
- Linting setup
- TypeScript migratie
- renderResults() opsplitsen (dat is een aparte refactor na deze extractie)
- Dead code cleanup (template-bestanden)

---

## Risico's en mitigatie

| Risico | Impact | Mitigatie |
|--------|--------|-----------|
| ES modules breken in oude browsers | Laag (alle moderne browsers ondersteunen het) | Geen IE11 support nodig voor intern tool |
| `<script type="module">` is altijd `defer` | Medium (volgorde t.o.v. Firebase globals) | Firebase SDK laadt via classic script vóór de module |
| Functies die subtiel DOM/globals lezen | Medium | Zoek-en-verifieer per functie bij extractie |
| Tests valideren huidige bugs als correct | Hoog | Tests schrijven vanuit verwacht gedrag, niet code. Handmatige berekening van expected values |
| csv.js migratie breekt bestaande <script src> | Medium | In dezelfde commit alle consumers migreren |

---

## Samenvatting deliverables

1. `assets/js/calc-engine.js` — ~800 regels pure berekeningslogica
2. `assets/js/shared-helpers.js` — ~80 regels geconsolideerde helpers
3. `assets/js/csv.js` — bestaand, gemigreerd naar ES module exports
4. `tests/calc-engine.test.js` — ~40 test-cases
5. `tests/csv.test.js` — ~12 test-cases
6. `tests/shared-helpers.test.js` — ~15 test-cases
7. `tests/fixtures/synthetic-data.js` — 6 datasets
8. `package.json` + `vitest.config.js` — projectconfiguratie
9. Aangepaste HTML-bestanden — imports, verwijderde duplicaten
