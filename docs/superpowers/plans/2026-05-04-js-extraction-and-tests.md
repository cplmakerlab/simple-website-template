# JS Extraction & Test Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all pure business logic from inline `<script>` blocks into ES modules and write logic-first tests with synthetic data using Vitest.

**Architecture:** Two parallel extraction tracks — (1) calc-engine with ~20 pure functions from index.html, (2) shared helpers consolidated from 3 HTML files. All new modules use ES module syntax. HTML files migrate to `<script type="module">`. Tests use Vitest with hand-calculated expected values.

**Tech Stack:** Vitest 3.x, ES modules (native browser + Node), no bundler.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `package.json` | Project config, Vitest dep, `type: "module"` |
| `vitest.config.js` | Test runner config |
| `assets/js/calc-engine.js` | Pure calculation logic (scenarios, aggregation, capacity analysis, chart buckets, formatters, config parsing) |
| `assets/js/shared-helpers.js` | DOM utility helpers shared across pages (escapeHtml, showToast, showState, shortEmail, date formatters) |
| `assets/js/csv.js` | CSV parsing (migrated to ES module exports) |
| `tests/fixtures/synthetic-data.js` | Test datasets with known expected outcomes |
| `tests/calc-engine.test.js` | Tests for calculation logic |
| `tests/csv.test.js` | Tests for CSV parsing |
| `tests/shared-helpers.test.js` | Tests for shared helpers |
| `index.html` | Migrated to `<script type="module">`, imports from calc-engine + csv |
| `dashboard.html` | Migrated to `<script type="module">`, imports shared-helpers + csv |
| `project-edit.html` | Migrated to `<script type="module">`, imports shared-helpers + csv |
| `assets/js/photo-uploader.js` | Migrated `_esc` → import from shared-helpers |

---

### Task 1: Project Setup (package.json, Vitest, .gitignore)

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Modify: `.gitignore`

- [ ] **Step 1: Create package.json**

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

- [ ] **Step 2: Create vitest.config.js**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 3: Add node_modules to .gitignore**

Append to `.gitignore`:
```
node_modules/
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 5: Verify Vitest runs (no tests yet)**

Run: `npx vitest run`
Expected: "No test files found" or similar — confirms Vitest is configured.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.js .gitignore
git commit -m "chore: add Vitest test infrastructure"
```

---

### Task 2: Migrate csv.js to ES Module

**Files:**
- Modify: `assets/js/csv.js`

- [ ] **Step 1: Add export keywords to csv.js**

Replace the file content with ES module exports (add `export` before each function, update the header comment):

```js
// Shared CSV parsing — ES module.
// Used by calc-engine.js (parseCSV, parseDate, parsVolume)
// and directly by HTML pages (extractCsvForStorage).

export function parseCSV(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(';').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < header.length) continue;
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

export function parseDate(str) {
  // dd-mm-yyyy
  const [d, m, y] = str.split('-');
  return new Date(+y, +m - 1, +d);
}

export function parsVolume(str) {
  if (!str || str === '') return 0;
  return parseFloat(str.replace(',', '.')) || 0;
}

export function extractCsvForStorage(csvText) {
  const rows = parseCSV(csvText);

  let eanCode = '', meterNr = '', meterType = '';
  for (const row of rows) {
    if (row['EAN-code'] && !eanCode) {
      eanCode   = row['EAN-code'].replace(/^="?|"?=$/g, '').replace(/"/g, '').replace(/=/g, '');
      meterNr   = row['Meter']     || '';
      meterType = row['Metertype'] || '';
      break;
    }
  }

  const dayMap = {};
  for (const row of rows) {
    const dateStr = row['Van (datum)'];
    if (!dateStr) continue;
    const parts = dateStr.split('-');
    if (parts.length !== 3) continue;
    const key = `${parts[2]}-${parts[1]}-${parts[0]}`;
    if (!dayMap[key]) dayMap[key] = { date: parseDate(dateStr), afname: 0, injectie: 0, afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0 };
    const register = (row['Register'] || '').toLowerCase();
    const vol = parsVolume(row['Volume']);
    if (register.includes('afname'))   dayMap[key].afname   += vol;
    if (register.includes('injectie')) dayMap[key].injectie += vol;
    if (register === 'afname dag')      dayMap[key].afnamedag    += vol;
    if (register === 'afname nacht')    dayMap[key].afnamenacht  += vol;
    if (register === 'injectie dag')    dayMap[key].injectiedag  += vol;
    if (register === 'injectie nacht')  dayMap[key].injectienacht += vol;
  }

  const allDays = Object.values(dayMap).sort((a, b) => a.date - b.date);
  if (!allDays.length) throw new Error('Geen data gevonden in het CSV bestand.');

  const startDate = allDays[0].date.toISOString().slice(0, 10);
  return {
    eanCode, meterNr, meterType,
    dailyCompact: {
      startDate,
      afname:        allDays.map(d => d.afname),
      injectie:      allDays.map(d => d.injectie),
      afnamedag:     allDays.map(d => d.afnamedag),
      afnamenacht:   allDays.map(d => d.afnamenacht),
      injectiedag:   allDays.map(d => d.injectiedag),
      injectienacht: allDays.map(d => d.injectienacht),
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/js/csv.js
git commit -m "refactor(csv): migrate to ES module exports"
```

---

### Task 3: Create Synthetic Test Fixtures

**Files:**
- Create: `tests/fixtures/synthetic-data.js`

- [ ] **Step 1: Write synthetic datasets**

```js
// Synthetic test data with hand-calculable expected outcomes.
// Each dataset has a description of what it tests and why.

/**
 * Helper: generate N identical days starting from a given date.
 */
export function generateUniformDays(n, startDate, { afname, injectie, afnamedag = 0, afnamenacht = 0, injectiedag = 0, injectienacht = 0 } = {}) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    days.push({ date, afname, injectie, afnamedag, afnamenacht, injectiedag, injectienacht });
  }
  return days;
}

/**
 * Dataset 1: "Perfecte dag"
 * 365 identical days. Single tariff.
 * afname=10, injectie=8 per dag.
 *
 * With a 5 kWh battery (eff=0.90, price=€3000):
 * - threshold (optimistic) = batCap = 5 kWh
 * - Every day: injectie(8) >= threshold(5) → full charge
 * - dayCharged = batCap * eff = 5 * 0.90 = 4.5 kWh
 * - useCap=false (optimistic): dayUsable = 4.5 (no cap since 4.5 < afname 10)
 * - useCap=true (worst-case, threshold=5): dayUsable = min(4.5, 10) = 4.5
 * - qualifyingDays = 365, partialDays = 0
 * - annualCharged = 365 * 4.5 = 1642.5 kWh
 * - annualSaving = 1642.5 * 0.30 = €492.75
 * - payback = 3000 / 492.75 ≈ 6.09 years
 */
export const DATASET_PERFECT_DAY = {
  days: generateUniformDays(365, new Date(2024, 0, 1), { afname: 10, injectie: 8 }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 3,
  priceDay: 0.30,
  priceNight: NaN,
  expected: {
    optimistic: {
      qualifyingDays: 365,
      partialDays: 0,
      annualCharged: 1642.5,
      annualSaving: 492.75,
      payback: 3000 / 492.75,
    },
    worstCase: {
      // Same as optimistic here because dayCharged(4.5) < afname(10) so cap doesn't bite
      qualifyingDays: 365,
      partialDays: 0,
      annualCharged: 1642.5,
      annualSaving: 492.75,
      payback: 3000 / 492.75,
    },
  },
};

/**
 * Dataset 2: "Worst-case cap bites"
 * 365 days. afname=3, injectie=8 per dag. Single tariff €0.30.
 * Battery: 5 kWh, eff=0.90, price=€3000, batInv=3, pvInv=3.
 *
 * Optimistic (useCap=false, threshold=5):
 * - injectie(8) >= threshold(5) → full day
 * - dayCharged = 5 * 0.90 = 4.5
 * - dayUsable = 4.5 (no cap)
 * - annualCharged = 365 * 4.5 = 1642.5
 * - annualSaving = 1642.5 * 0.30 = €492.75
 *
 * Worst-case (useCap=true, threshold=5):
 * - dayCharged = 4.5, but afname=3
 * - dayUsable = min(4.5, 3) = 3
 * - annualCharged = 365 * 3 = 1095
 * - annualSaving = 1095 * 0.30 = €328.50
 * - payback = 3000 / 328.50 ≈ 9.13
 */
export const DATASET_CAP_BITES = {
  days: generateUniformDays(365, new Date(2024, 0, 1), { afname: 3, injectie: 8 }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 3,
  priceDay: 0.30,
  priceNight: NaN,
  expected: {
    optimistic: {
      qualifyingDays: 365,
      partialDays: 0,
      annualCharged: 1642.5,
      annualSaving: 492.75,
      payback: 3000 / 492.75,
    },
    worstCase: {
      qualifyingDays: 365,
      partialDays: 0,
      annualCharged: 1095,
      annualSaving: 328.50,
      payback: 3000 / 328.50,
    },
  },
};

/**
 * Dataset 3: "Partial days"
 * 365 days. afname=10, injectie=3 per dag. Single tariff €0.30.
 * Battery: 5 kWh, eff=0.90, price=€3000, batInv=3, pvInv=3.
 *
 * Optimistic (useCap=false, threshold=5):
 * - injectie(3) < threshold(5) → partial day
 * - dayCharged = (3/5) * 5 * 0.90 = 2.7
 * - dayUsable = 2.7 (no cap, 2.7 < afname 10)
 * - qualifyingDays = 0, partialDays = 365
 * - annualCharged = 365 * 2.7 = 985.5
 * - annualSaving = 985.5 * 0.30 = €295.65
 */
export const DATASET_PARTIAL = {
  days: generateUniformDays(365, new Date(2024, 0, 1), { afname: 10, injectie: 3 }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 3,
  priceDay: 0.30,
  priceNight: NaN,
  expected: {
    optimistic: {
      qualifyingDays: 0,
      partialDays: 365,
      annualCharged: 985.5,
      annualSaving: 295.65,
      payback: 3000 / 295.65,
    },
  },
};

/**
 * Dataset 4: "Under a year — extrapolation"
 * 200 days of data. afname=10, injectie=8. Single tariff €0.30.
 * Battery: 5 kWh, eff=0.90, price=€3000.
 *
 * scaleFactor = 365 / 200 = 1.825
 * isFullYear = false
 * Per-window: chargedFull = 200 * 4.5 = 900
 * annualChargedFull = 900 * 1.825 = 1642.5
 * annualSaving = 1642.5 * 0.30 = €492.75
 */
export const DATASET_UNDER_YEAR = {
  days: generateUniformDays(200, new Date(2024, 5, 1), { afname: 10, injectie: 8 }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 3,
  priceDay: 0.30,
  priceNight: NaN,
  expected: {
    isFullYear: false,
    scaleFactor: 365 / 200,
    optimistic: {
      annualCharged: 1642.5,
      annualSaving: 492.75,
    },
  },
};

/**
 * Dataset 5: "pvInverter > batteryInverter — threshold scaling"
 * 365 days. afname=10, injectie=6 per dag. Single tariff €0.30.
 * Battery: 5 kWh, batInv=3 kW, pvInv=6 kW, eff=0.90, price=€3000.
 *
 * pvInv(6) > batInv(3) → thresholdWC = batCap * (pvInv/batInv) = 5 * 2 = 10
 * thresholdOpt = batCap = 5
 *
 * Optimistic (threshold=5):
 * - injectie(6) >= 5 → full: dayCharged = 5*0.9 = 4.5, dayUsable = 4.5
 * - annualCharged = 365 * 4.5 = 1642.5
 *
 * Worst-case (threshold=10, useCap=true):
 * - injectie(6) < 10 → partial: dayCharged = (6/10)*5*0.9 = 2.7
 * - dayUsable = min(2.7, 10) = 2.7
 * - annualCharged = 365 * 2.7 = 985.5
 * - annualSaving = 985.5 * 0.30 = €295.65
 */
export const DATASET_PV_GT_BAT = {
  days: generateUniformDays(365, new Date(2024, 0, 1), { afname: 10, injectie: 6 }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 6,
  priceDay: 0.30,
  priceNight: NaN,
  expected: {
    optimistic: {
      qualifyingDays: 365,
      partialDays: 0,
      annualCharged: 1642.5,
      annualSaving: 492.75,
    },
    worstCase: {
      qualifyingDays: 0,
      partialDays: 365,
      annualCharged: 985.5,
      annualSaving: 295.65,
    },
  },
};

/**
 * Dataset 6: "Dual tariff"
 * 365 days. afnamedag=6, afnamenacht=4 (total afname=10).
 * injectiedag=5, injectienacht=3 (total injectie=8).
 * priceDay=0.35, priceNight=0.25.
 * Battery: 5 kWh, eff=0.90, price=€3000, batInv=3, pvInv=3.
 *
 * effectivePrice = (afnamedag/afname)*priceDay + (afnamenacht/afname)*priceNight
 *                = (6/10)*0.35 + (4/10)*0.25
 *                = 0.21 + 0.10 = 0.31
 *
 * Optimistic (threshold=5, useCap=false):
 * - injectie(8) >= 5 → full: dayCharged = 4.5
 * - annualCharged = 365 * 4.5 = 1642.5
 * - annualSaving = 1642.5 * 0.31 = €509.175
 */
export const DATASET_DUAL_TARIFF = {
  days: generateUniformDays(365, new Date(2024, 0, 1), {
    afname: 10, injectie: 8,
    afnamedag: 6, afnamenacht: 4,
    injectiedag: 5, injectienacht: 3,
  }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 3,
  priceDay: 0.35,
  priceNight: 0.25,
  expected: {
    effectivePrice: 0.31,
    optimistic: {
      annualCharged: 1642.5,
      annualSaving: 509.175,
      payback: 3000 / 509.175,
    },
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add tests/fixtures/synthetic-data.js
git commit -m "test: add synthetic datasets with hand-calculated expected values"
```

---

### Task 4: Create calc-engine.js — Extract Pure Functions

**Files:**
- Create: `assets/js/calc-engine.js`

- [ ] **Step 1: Create calc-engine.js with all pure functions**

Extract from `index.html` (lines 760–1706) into a single ES module. The functions are copied verbatim except:
- `processData` → renamed `processDataPure`, returns `d` instead of calling `renderResults(d)`
- `calcScenario` → moved to module scope with explicit parameters instead of closure
- Leading underscores removed from public exports (e.g., `_buildYearBuckets` → `buildYearBuckets`)

```js
// Pure calculation engine for the SmartPeak Battery ROI Calculator.
// No DOM access, no side effects — fully testable.

import { parseCSV, parseDate, parsVolume } from './csv.js';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

export const CALC_CONSTANTS = {
  DAYS_PER_YEAR: 365,
  MIN_FULL_CHARGE_DAYS: 100,
  CAP_SWEEP_STEP: 2.5,
  CAP_SWEEP_MAX: 200,
};

export const MONTH_NL_FULL = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];

const MONTH_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// ─── FORMATTERS ──────────────────────────────────────────────────────────────

export function formatDate(d) {
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmt2(n) { return n.toFixed(2); }

export function fmtEur(n) {
  return '€\u00a0' + n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function renderWithAvg(currentValue, avgValue, formatter, numYears) {
  const cur = formatter(currentValue);
  if (!numYears || numYears < 2 || avgValue == null || (typeof avgValue === 'number' && isNaN(avgValue))) return cur;
  return cur + `<span class="muted-inline">\u00b7 gem. ${numYears} j: ${formatter(avgValue)}</span>`;
}

// ─── CONFIG PARSING (Google Sheet) ───────────────────────────────────────────

export function parseCSVLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

export function parseEurAmount(str) {
  return parseFloat((str || '').replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}

export function parseSheetConfigs(csvText) {
  const lines = csvText.trim().split('\n');
  const header = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    const o = {};
    header.forEach((h, i) => { o[h] = (cols[i] || '').replace(/^"|"$/g, '').trim(); });
    return {
      type:        o['type'],
      omschrijving:o['omschrijving'],
      batCap:      parseFloat(o['nuttig opslag'].replace(',', '.')),
      batInv:      parseFloat(o['omvorm vermogen'].replace(',', '.')),
      eff:         parseFloat(o['efficientie']) / 100,
      prices: {
        '6_no':   parseEurAmount(o['prijs install 6%']),
        '6_yes':  parseEurAmount(o['prijs install en keuring 6%']),
        '21_no':  parseEurAmount(o['prijs install 21%']),
        '21_yes': parseEurAmount(o['prijs install en keuring 21%']),
      }
    };
  }).filter(c => c.type && !isNaN(c.batCap));
}

// ─── CSV → ALLDAYS TRANSFORMATION ───────────────────────────────────────────

export function csvToAllDaysAndMeta(csvText) {
  const rows = parseCSV(csvText);

  let eanCode = '', meterNr = '', meterType = '';
  for (const row of rows) {
    if (row['EAN-code'] && !eanCode) {
      eanCode   = row['EAN-code'].replace(/^="?|"?=$/g, '').replace(/"/g, '').replace(/=/g, '');
      meterNr   = row['Meter']     || '';
      meterType = row['Metertype'] || '';
      break;
    }
  }

  const dayMap = {};
  for (const row of rows) {
    const dateStr = row['Van (datum)'];
    if (!dateStr) continue;
    const parts = dateStr.split('-');
    if (parts.length !== 3) continue;
    const key = `${parts[2]}-${parts[1]}-${parts[0]}`;
    if (!dayMap[key]) dayMap[key] = { date: parseDate(dateStr), afname: 0, injectie: 0, afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0 };
    const register = (row['Register'] || '').toLowerCase();
    const vol = parsVolume(row['Volume']);
    if (register.includes('afname'))   dayMap[key].afname   += vol;
    if (register.includes('injectie')) dayMap[key].injectie += vol;
    if (register === 'afname dag')      dayMap[key].afnamedag    += vol;
    if (register === 'afname nacht')    dayMap[key].afnamenacht  += vol;
    if (register === 'injectie dag')    dayMap[key].injectiedag  += vol;
    if (register === 'injectie nacht')  dayMap[key].injectienacht += vol;
  }

  const allDays = Object.values(dayMap).sort((a, b) => a.date - b.date);
  return { allDays, eanCode, meterNr, meterType };
}

export function buildAllDaysFromDailyCompact(dc) {
  const start = new Date(dc.startDate + 'T00:00:00');
  return dc.afname.map((af, i) => {
    const date = new Date(start); date.setDate(date.getDate() + i);
    return {
      date,
      afname: af,
      injectie: dc.injectie[i],
      afnamedag: dc.afnamedag[i],
      afnamenacht: dc.afnamenacht[i],
      injectiedag: dc.injectiedag[i],
      injectienacht: dc.injectienacht[i],
    };
  });
}

// ─── CORE SCENARIO CALCULATION ───────────────────────────────────────────────

export function calcScenario(windowDays, { threshold, installPrice, batCap, eff, useCap, scaleFactor, effectivePrice, totalAfname, totalInjectie, pvInverter, batteryInverter }) {
  let qualifyingDays = 0, partialDays = 0, chargedFull = 0, chargedPartial = 0;
  for (const d of windowDays) {
    let dayCharged = 0, isFull = false;
    if (d.injectie >= threshold) {
      isFull = true;
      dayCharged = batCap * eff;
    } else if (d.injectie > 0) {
      dayCharged = (d.injectie / threshold) * batCap * eff;
    } else {
      continue;
    }
    const dayUsable = useCap ? Math.min(dayCharged, d.afname) : dayCharged;
    if (isFull) { qualifyingDays++; chargedFull    += dayUsable; }
    else        { partialDays++;    chargedPartial += dayUsable; }
  }
  const annualChargedFull    = chargedFull    * scaleFactor;
  const annualChargedPartial = chargedPartial * scaleFactor;
  const annualCharged        = (chargedFull + chargedPartial) * scaleFactor;
  const annualSaving         = annualCharged  * effectivePrice;
  const annualSavingFull     = annualChargedFull    * effectivePrice;
  const annualSavingPartial  = annualChargedPartial * effectivePrice;
  const payback              = installPrice > 0 ? installPrice / annualSaving : Infinity;
  const recoveryPctFull    = (chargedFull    / (totalAfname    || 1)) * 100 * scaleFactor;
  const recoveryPctPartial = (chargedPartial / (totalAfname    || 1)) * 100 * scaleFactor;
  const injPctFull         = (chargedFull    / eff / (totalInjectie || 1)) * 100 * scaleFactor;
  const injPctPartial      = (chargedPartial / eff / (totalInjectie || 1)) * 100 * scaleFactor;
  return {
    qualifyingDays, partialDays, chargedFull, chargedPartial,
    annualChargedFull, annualChargedPartial, annualCharged,
    annualSavingFull, annualSavingPartial, annualSaving,
    payback, recoveryPctFull, recoveryPctPartial,
    injPctFull, injPctPartial, threshold
  };
}

// ─── MULTI-YEAR STATS ────────────────────────────────────────────────────────

export function computePerYearStats(allDays, pvInv, selectedConfigs, lastDate, priceDay, priceNight) {
  if (!allDays.length) return { numYears: 0, yearsStart: null, perYear: [] };
  const firstDate = allDays[0].date;
  const spanDays  = Math.floor((lastDate - firstDate) / 86400000) + 1;
  const numYears  = Math.floor(spanDays / 365);
  if (numYears < 1) return { numYears: 0, yearsStart: null, perYear: [] };

  const dualTariff = !isNaN(priceNight) && priceNight > 0;
  const perYear = [];
  for (let k = 1; k <= numYears; k++) {
    const winEnd   = new Date(lastDate); winEnd.setDate(winEnd.getDate() - 365 * (k - 1));
    const winStart = new Date(lastDate); winStart.setDate(winStart.getDate() - 365 * k + 1);
    const days = allDays.filter(d => d.date >= winStart && d.date <= winEnd);

    const sums = days.reduce((s, d) => ({
      afname:        s.afname        + d.afname,
      injectie:      s.injectie      + d.injectie,
      afnamedag:     s.afnamedag     + d.afnamedag,
      afnamenacht:   s.afnamenacht   + d.afnamenacht,
      injectiedag:   s.injectiedag   + d.injectiedag,
      injectienacht: s.injectienacht + d.injectienacht,
    }), { afname:0, injectie:0, afnamedag:0, afnamenacht:0, injectiedag:0, injectienacht:0 });

    const effectivePrice = (dualTariff && sums.afname > 0)
      ? (sums.afnamedag / sums.afname) * priceDay + (sums.afnamenacht / sums.afname) * priceNight
      : priceDay;

    const scenarios = selectedConfigs.map(cfg => {
      const pvGtBat     = pvInv > cfg.batInv;
      const thresholdWC = pvGtBat ? cfg.batCap * (pvInv / cfg.batInv) : cfg.batCap;
      const thresholdOpt= cfg.batCap;
      function calc(threshold, useCap) {
        let qualifyingDays = 0, partialDays = 0, chargedFull = 0, chargedPartial = 0;
        for (const d of days) {
          let dayCharged = 0, isFull = false;
          if (d.injectie >= threshold) { isFull = true; dayCharged = cfg.batCap * cfg.eff; }
          else if (d.injectie > 0)     { dayCharged = (d.injectie / threshold) * cfg.batCap * cfg.eff; }
          else { continue; }
          const dayUsable = useCap ? Math.min(dayCharged, d.afname) : dayCharged;
          if (isFull) { qualifyingDays++; chargedFull    += dayUsable; }
          else        { partialDays++;    chargedPartial += dayUsable; }
        }
        const annualSavingFull    = chargedFull    * effectivePrice;
        const annualSavingPartial = chargedPartial * effectivePrice;
        const annualSaving        = annualSavingFull + annualSavingPartial;
        const payback             = cfg.price > 0 ? cfg.price / annualSaving : Infinity;
        const recoveryPctFull     = (chargedFull    / (sums.afname    || 1)) * 100;
        const recoveryPctPartial  = (chargedPartial / (sums.afname    || 1)) * 100;
        const injPctFull          = (chargedFull    / cfg.eff / (sums.injectie || 1)) * 100;
        const injPctPartial       = (chargedPartial / cfg.eff / (sums.injectie || 1)) * 100;
        return {
          qualifyingDays, partialDays, chargedFull, chargedPartial,
          annualSavingFull, annualSavingPartial, annualSaving, payback,
          recoveryPctFull, recoveryPctPartial, injPctFull, injPctPartial,
          threshold,
        };
      }
      return { scenWC: calc(thresholdWC, true), scenOpt: calc(thresholdOpt, false) };
    });

    perYear.push({ windowStart: winStart, windowEnd: winEnd, ...sums, effectivePrice, scenarios });
  }

  const yearsStart = perYear[perYear.length - 1].windowStart;
  return { numYears, yearsStart, perYear };
}

export function averageStats(perYear, selectedConfigs) {
  if (!perYear.length) return null;
  const N = perYear.length;
  const mean = key => perYear.reduce((s, y) => s + y[key], 0) / N;
  const totalAfname        = mean('afname');
  const totalInjectie      = mean('injectie');
  const totalAfnamedag     = mean('afnamedag');
  const totalAfnamenacht   = mean('afnamenacht');
  const totalInjectiedag   = mean('injectiedag');
  const totalInjectienacht = mean('injectienacht');
  const effectivePrice     = mean('effectivePrice');

  const scenarios = selectedConfigs.map((cfg, i) => {
    function avgScen(scenKey) {
      const arr = perYear.map(y => y.scenarios[i][scenKey]).filter(sc => sc !== null);
      if (!arr.length) return null;
      const m = key => arr.reduce((s, sc) => s + sc[key], 0) / arr.length;
      const avgChargedFull    = m('chargedFull');
      const avgChargedPartial = m('chargedPartial');
      const avgAnnualSavingFull    = m('annualSavingFull');
      const avgAnnualSavingPartial = m('annualSavingPartial');
      const avgAnnualSaving        = m('annualSaving');
      return {
        qualifyingDays: m('qualifyingDays'),
        partialDays:    m('partialDays'),
        chargedFull:    avgChargedFull,
        chargedPartial: avgChargedPartial,
        annualSavingFull:    avgAnnualSavingFull,
        annualSavingPartial: avgAnnualSavingPartial,
        annualSaving:        avgAnnualSaving,
        payback:             cfg.price > 0 && avgAnnualSaving > 0 ? cfg.price / avgAnnualSaving : Infinity,
        recoveryPctFull:     (avgChargedFull    / (totalAfname    || 1)) * 100,
        recoveryPctPartial:  (avgChargedPartial / (totalAfname    || 1)) * 100,
        injPctFull:          (avgChargedFull    / cfg.eff / (totalInjectie || 1)) * 100,
        injPctPartial:       (avgChargedPartial / cfg.eff / (totalInjectie || 1)) * 100,
        threshold:           arr[0].threshold,
      };
    }
    return { scenWCAvg: avgScen('scenWC'), scenOptAvg: avgScen('scenOpt') };
  });

  return {
    totalAfname, totalInjectie,
    totalAfnamedag, totalAfnamenacht, totalInjectiedag, totalInjectienacht,
    effectivePrice,
    avgAfnamePerDay:   totalAfname   / 365,
    avgInjectiePerDay: totalInjectie / 365,
    scenarios,
  };
}

// ─── PROCESS DATA (PURE) ─────────────────────────────────────────────────────

export function processDataPure(input, pvInv, selectedConfigs, priceDay, priceNight) {
  const { allDays, eanCode, meterNr, meterType } =
    (typeof input === 'string') ? csvToAllDaysAndMeta(input) : input;

  if (!allDays.length) return null;

  // Rolling year window
  const lastDate    = allDays[allDays.length - 1].date;
  const firstDate   = allDays[0].date;
  const oneYearBack = new Date(lastDate);
  oneYearBack.setFullYear(oneYearBack.getFullYear() - 1);
  const windowStart = oneYearBack < firstDate ? firstDate : oneYearBack;
  const isFullYear  = oneYearBack >= firstDate;
  const windowDays  = allDays.filter(d => d.date >= windowStart && d.date <= lastDate);

  // Totals
  const totalAfname        = windowDays.reduce((s, d) => s + d.afname,       0);
  const totalInjectie      = windowDays.reduce((s, d) => s + d.injectie,     0);
  const totalAfnamedag     = windowDays.reduce((s, d) => s + d.afnamedag,    0);
  const totalAfnamenacht   = windowDays.reduce((s, d) => s + d.afnamenacht,  0);
  const totalInjectiedag   = windowDays.reduce((s, d) => s + d.injectiedag,  0);
  const totalInjectienacht = windowDays.reduce((s, d) => s + d.injectienacht,0);
  const daysInWindow       = windowDays.length;

  // Effective price
  const dualTariff = !isNaN(priceNight) && priceNight > 0;
  const effectivePrice = (dualTariff && totalAfname > 0)
    ? (totalAfnamedag / totalAfname) * priceDay + (totalAfnamenacht / totalAfname) * priceNight
    : priceDay;

  // Per-config scenario calculation
  const scaleFactor = isFullYear ? 1 : (365 / daysInWindow);

  const configResults = selectedConfigs.map(cfg => {
    const pvGtBat      = pvInv > cfg.batInv;
    const thresholdWC  = pvGtBat ? cfg.batCap * (pvInv / cfg.batInv) : cfg.batCap;
    const thresholdOpt = cfg.batCap;
    const scenWC  = calcScenario(windowDays, { threshold: thresholdWC, installPrice: cfg.price, batCap: cfg.batCap, eff: cfg.eff, useCap: true, scaleFactor, effectivePrice, totalAfname, totalInjectie, pvInverter: pvInv, batteryInverter: cfg.batInv });
    const scenOpt = calcScenario(windowDays, { threshold: thresholdOpt, installPrice: cfg.price, batCap: cfg.batCap, eff: cfg.eff, useCap: false, scaleFactor, effectivePrice, totalAfname, totalInjectie, pvInverter: pvInv, batteryInverter: cfg.batInv });
    return { cfg, pvGtBat, thresholdWC, thresholdOpt, scenWC, scenOpt };
  });

  // Monthly map
  const monthMap = {};
  for (const d of windowDays) {
    const mk = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}`;
    if (!monthMap[mk]) monthMap[mk] = { injectie:0, afname:0, injectiedag:0, injectienacht:0, afnamedag:0, afnamenacht:0, avgInjectie: null };
    monthMap[mk].injectie      += d.injectie;
    monthMap[mk].afname        += d.afname;
    monthMap[mk].injectiedag   += d.injectie;
    monthMap[mk].injectienacht += d.injectienacht;
    monthMap[mk].afnamedag     += d.afnamedag;
    monthMap[mk].afnamenacht   += d.afnamenacht;
  }

  // Multi-year
  const py = computePerYearStats(allDays, pvInv, selectedConfigs, lastDate, priceDay, priceNight);
  const numYears   = py.numYears;
  const yearsStart = py.yearsStart;
  const avgTotals  = numYears >= 2 ? averageStats(py.perYear, selectedConfigs) : null;

  const yearDays = py.perYear.map(yr =>
    allDays.filter(d => d.date >= yr.windowStart && d.date <= yr.windowEnd)
  );

  // Per-month avg injection across years
  if (numYears >= 2) {
    for (const mk of Object.keys(monthMap)) {
      const [, mo] = mk.split('-');
      const moNum = +mo;
      let total = 0;
      for (const days of yearDays) {
        for (const day of days) {
          if ((day.date.getMonth() + 1) === moNum) total += day.injectie;
        }
      }
      monthMap[mk].avgInjectie = total / numYears;
    }
  }

  // Capacity analysis
  const capRows = [];
  let capMaxDays = null;
  const CAP_STEP = CALC_CONSTANTS.CAP_SWEEP_STEP;
  for (let cap = CAP_STEP; cap <= CALC_CONSTANTS.CAP_SWEEP_MAX; cap = Math.round((cap + CAP_STEP) * 10) / 10) {
    let qualDays = 0;
    for (const day of windowDays) { if (day.injectie >= cap) qualDays++; }
    let avgQualDays = null;
    if (numYears >= 2) {
      let totalQual = 0;
      for (const days of yearDays) {
        let yrQual = 0;
        for (const day of days) { if (day.injectie >= cap) yrQual++; }
        totalQual += yrQual;
      }
      avgQualDays = totalQual / numYears;
    }
    capRows.push({ cap, qualDays, avgQualDays });
    if (qualDays >= CALC_CONSTANTS.MIN_FULL_CHARGE_DAYS) capMaxDays = cap;
    if (capMaxDays !== null && cap >= capMaxDays + 3 * CAP_STEP) break;
  }
  const capAnalysis = { rows: capRows, maxCap: capMaxDays };

  // Attach avg scenarios
  configResults.forEach((cr, i) => {
    cr.scenWCAvg  = avgTotals ? avgTotals.scenarios[i].scenWCAvg  : null;
    cr.scenOptAvg = avgTotals ? avgTotals.scenarios[i].scenOptAvg : null;
  });

  return {
    isFullYear, windowStart, lastDate, daysInWindow,
    totalAfname, totalInjectie,
    totalAfnamedag, totalAfnamenacht, totalInjectiedag, totalInjectienacht,
    dualTariff, priceDay, priceNight, effectivePrice,
    pvInv, configResults,
    monthMap, eanCode, meterNr, meterType,
    firstDate, allDays, windowDays, capAnalysis,
    numYears, yearsStart, avgTotals,
  };
}

// ─── CHART BUCKET HELPERS ────────────────────────────────────────────────────

export function buildYearBuckets(allDays) {
  const byYear = {};
  for (const d of allDays) {
    const y = d.date.getFullYear();
    if (!byYear[y]) byYear[y] = { afname: 0, injectie: 0, afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0, dayCount: 0 };
    byYear[y].afname        += d.afname;
    byYear[y].injectie      += d.injectie;
    byYear[y].afnamedag     += d.afnamedag;
    byYear[y].afnamenacht   += d.afnamenacht;
    byYear[y].injectiedag   += d.injectiedag;
    byYear[y].injectienacht += d.injectienacht;
    byYear[y].dayCount      += 1;
  }
  function isComplete(y, count) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    return count === (isLeap ? 366 : 365);
  }
  return Object.entries(byYear)
    .filter(([y, v]) => isComplete(parseInt(y, 10), v.dayCount))
    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
    .map(([y, v]) => ({ label: y, afname: v.afname, injectie: v.injectie, afnamedag: v.afnamedag, afnamenacht: v.afnamenacht, injectiedag: v.injectiedag, injectienacht: v.injectienacht }));
}

export function buildMonthBuckets(windowDays) {
  const byMonth = {};
  for (const d of windowDays) {
    const mk = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[mk]) byMonth[mk] = { afname: 0, injectie: 0, afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0 };
    byMonth[mk].afname        += d.afname;
    byMonth[mk].injectie      += d.injectie;
    byMonth[mk].afnamedag     += d.afnamedag;
    byMonth[mk].afnamenacht   += d.afnamenacht;
    byMonth[mk].injectiedag   += d.injectiedag;
    byMonth[mk].injectienacht += d.injectienacht;
  }
  return Object.keys(byMonth).sort().map(mk => {
    const [y, m] = mk.split('-');
    return { label: `${MONTH_NL[parseInt(m, 10) - 1]} '${y.slice(2)}`, monthKey: mk, ...byMonth[mk] };
  });
}

export function buildDayBuckets(allDays, monthKey) {
  return allDays
    .filter(d => {
      const mk = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`;
      return mk === monthKey;
    })
    .map(d => ({
      label: String(d.date.getDate()),
      afname: d.afname,
      injectie: d.injectie,
      afnamedag: d.afnamedag,
      afnamenacht: d.afnamenacht,
      injectiedag: d.injectiedag,
      injectienacht: d.injectienacht,
    }));
}

export function availableMonthKeys(allDays) {
  const set = new Set();
  for (const d of allDays) {
    set.add(`${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`);
  }
  return [...set].sort();
}

export function buildYearBucketsFromMonthMap(monthMap) {
  if (!monthMap) return [];
  const byYear = {};
  for (const mk of Object.keys(monthMap)) {
    const y = mk.slice(0, 4);
    const m = monthMap[mk];
    if (!byYear[y]) byYear[y] = { afname: 0, injectie: 0, afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0, monthCount: 0 };
    byYear[y].afname        += (m.afname || 0);
    byYear[y].injectie      += (m.injectie || 0);
    byYear[y].afnamedag     += (m.afnamedag || 0);
    byYear[y].afnamenacht   += (m.afnamenacht || 0);
    byYear[y].injectiedag   += (m.injectiedag || 0);
    byYear[y].injectienacht += (m.injectienacht || 0);
    byYear[y].monthCount    += 1;
  }
  return Object.entries(byYear)
    .filter(([y, v]) => v.monthCount === 12)
    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
    .map(([y, v]) => ({ label: y, afname: v.afname, injectie: v.injectie, afnamedag: v.afnamedag, afnamenacht: v.afnamenacht, injectiedag: v.injectiedag, injectienacht: v.injectienacht }));
}

export function buildMonthBucketsFromMonthMap(monthMap) {
  if (!monthMap) return [];
  return Object.keys(monthMap).sort().map(mk => {
    const [y, m] = mk.split('-');
    const v = monthMap[mk];
    return {
      label: `${MONTH_NL[parseInt(m, 10) - 1]} '${y.slice(2)}`,
      monthKey: mk,
      afname:        v.afname        || 0,
      injectie:      v.injectie      || 0,
      afnamedag:     v.afnamedag     || 0,
      afnamenacht:   v.afnamenacht   || 0,
      injectiedag:   v.injectiedag   || 0,
      injectienacht: v.injectienacht || 0,
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/js/calc-engine.js
git commit -m "feat: extract calc-engine as ES module with pure functions"
```

---

### Task 5: Write calc-engine Tests

**Files:**
- Create: `tests/calc-engine.test.js`

- [ ] **Step 1: Write tests for calcScenario and processDataPure**

```js
import { describe, it, expect } from 'vitest';
import { calcScenario, processDataPure, computePerYearStats, averageStats } from '../assets/js/calc-engine.js';
import {
  DATASET_PERFECT_DAY, DATASET_CAP_BITES, DATASET_PARTIAL,
  DATASET_UNDER_YEAR, DATASET_PV_GT_BAT, DATASET_DUAL_TARIFF,
  generateUniformDays,
} from './fixtures/synthetic-data.js';

describe('calcScenario', () => {
  it('computes annual saving correctly for uniform full-charge days', () => {
    const ds = DATASET_PERFECT_DAY;
    const result = calcScenario(ds.days, {
      threshold: ds.config.batCap,
      installPrice: ds.config.price,
      batCap: ds.config.batCap,
      eff: ds.config.eff,
      useCap: false,
      scaleFactor: 1,
      effectivePrice: ds.priceDay,
      totalAfname: 365 * 10,
      totalInjectie: 365 * 8,
      pvInverter: ds.pvInv,
      batteryInverter: ds.config.batInv,
    });
    expect(result.qualifyingDays).toBe(365);
    expect(result.partialDays).toBe(0);
    expect(result.annualCharged).toBeCloseTo(ds.expected.optimistic.annualCharged, 1);
    expect(result.annualSaving).toBeCloseTo(ds.expected.optimistic.annualSaving, 1);
    expect(result.payback).toBeCloseTo(ds.expected.optimistic.payback, 2);
  });

  it('worst-case caps daily savings at daily consumption', () => {
    const ds = DATASET_CAP_BITES;
    const result = calcScenario(ds.days, {
      threshold: ds.config.batCap,
      installPrice: ds.config.price,
      batCap: ds.config.batCap,
      eff: ds.config.eff,
      useCap: true,
      scaleFactor: 1,
      effectivePrice: ds.priceDay,
      totalAfname: 365 * 3,
      totalInjectie: 365 * 8,
      pvInverter: ds.pvInv,
      batteryInverter: ds.config.batInv,
    });
    expect(result.annualCharged).toBeCloseTo(ds.expected.worstCase.annualCharged, 1);
    expect(result.annualSaving).toBeCloseTo(ds.expected.worstCase.annualSaving, 1);
  });

  it('handles partial days correctly', () => {
    const ds = DATASET_PARTIAL;
    const result = calcScenario(ds.days, {
      threshold: ds.config.batCap,
      installPrice: ds.config.price,
      batCap: ds.config.batCap,
      eff: ds.config.eff,
      useCap: false,
      scaleFactor: 1,
      effectivePrice: ds.priceDay,
      totalAfname: 365 * 10,
      totalInjectie: 365 * 3,
      pvInverter: ds.pvInv,
      batteryInverter: ds.config.batInv,
    });
    expect(result.qualifyingDays).toBe(0);
    expect(result.partialDays).toBe(365);
    expect(result.annualCharged).toBeCloseTo(ds.expected.optimistic.annualCharged, 1);
    expect(result.annualSaving).toBeCloseTo(ds.expected.optimistic.annualSaving, 1);
  });

  it('applies scaleFactor for extrapolation when < 365 days', () => {
    const ds = DATASET_UNDER_YEAR;
    const scaleFactor = 365 / 200;
    const result = calcScenario(ds.days, {
      threshold: ds.config.batCap,
      installPrice: ds.config.price,
      batCap: ds.config.batCap,
      eff: ds.config.eff,
      useCap: false,
      scaleFactor,
      effectivePrice: ds.priceDay,
      totalAfname: 200 * 10,
      totalInjectie: 200 * 8,
      pvInverter: ds.pvInv,
      batteryInverter: ds.config.batInv,
    });
    expect(result.annualCharged).toBeCloseTo(ds.expected.optimistic.annualCharged, 1);
    expect(result.annualSaving).toBeCloseTo(ds.expected.optimistic.annualSaving, 1);
  });

  it('scales threshold when pvInverter > batteryInverter', () => {
    const ds = DATASET_PV_GT_BAT;
    // Worst-case: threshold = 5 * (6/3) = 10
    const result = calcScenario(ds.days, {
      threshold: 10,
      installPrice: ds.config.price,
      batCap: ds.config.batCap,
      eff: ds.config.eff,
      useCap: true,
      scaleFactor: 1,
      effectivePrice: ds.priceDay,
      totalAfname: 365 * 10,
      totalInjectie: 365 * 6,
      pvInverter: ds.pvInv,
      batteryInverter: ds.config.batInv,
    });
    expect(result.qualifyingDays).toBe(ds.expected.worstCase.qualifyingDays);
    expect(result.partialDays).toBe(ds.expected.worstCase.partialDays);
    expect(result.annualCharged).toBeCloseTo(ds.expected.worstCase.annualCharged, 1);
  });

  it('computes effective price for dual tariff', () => {
    const ds = DATASET_DUAL_TARIFF;
    const totalAfname = 365 * 10;
    const totalAfnamedag = 365 * 6;
    const totalAfnamenacht = 365 * 4;
    const effectivePrice = (totalAfnamedag / totalAfname) * ds.priceDay + (totalAfnamenacht / totalAfname) * ds.priceNight;
    expect(effectivePrice).toBeCloseTo(ds.expected.effectivePrice, 4);

    const result = calcScenario(ds.days, {
      threshold: ds.config.batCap,
      installPrice: ds.config.price,
      batCap: ds.config.batCap,
      eff: ds.config.eff,
      useCap: false,
      scaleFactor: 1,
      effectivePrice,
      totalAfname,
      totalInjectie: 365 * 8,
      pvInverter: ds.pvInv,
      batteryInverter: ds.config.batInv,
    });
    expect(result.annualSaving).toBeCloseTo(ds.expected.optimistic.annualSaving, 1);
  });

  it('efficiency loss: annualSaving = annualCharged * effectivePrice', () => {
    const ds = DATASET_PERFECT_DAY;
    const result = calcScenario(ds.days, {
      threshold: ds.config.batCap,
      installPrice: ds.config.price,
      batCap: ds.config.batCap,
      eff: ds.config.eff,
      useCap: false,
      scaleFactor: 1,
      effectivePrice: ds.priceDay,
      totalAfname: 365 * 10,
      totalInjectie: 365 * 8,
      pvInverter: ds.pvInv,
      batteryInverter: ds.config.batInv,
    });
    expect(result.annualSaving).toBeCloseTo(result.annualCharged * ds.priceDay, 4);
  });
});

describe('processDataPure', () => {
  it('returns null for empty input', () => {
    const result = processDataPure({ allDays: [], eanCode: '', meterNr: '', meterType: '' }, 3, [{ type: 'X', batCap: 5, batInv: 3, eff: 0.9, price: 3000 }], 0.30, NaN);
    expect(result).toBeNull();
  });

  it('returns correct CalcResult shape', () => {
    const ds = DATASET_PERFECT_DAY;
    const input = { allDays: ds.days, eanCode: 'EAN123', meterNr: 'M1', meterType: 'DMM' };
    const result = processDataPure(input, ds.pvInv, [ds.config], ds.priceDay, ds.priceNight);
    expect(result).toHaveProperty('isFullYear', true);
    expect(result).toHaveProperty('daysInWindow', 365);
    expect(result).toHaveProperty('totalAfname');
    expect(result).toHaveProperty('configResults');
    expect(result).toHaveProperty('capAnalysis');
    expect(result.configResults).toHaveLength(1);
    expect(result.configResults[0]).toHaveProperty('scenWC');
    expect(result.configResults[0]).toHaveProperty('scenOpt');
  });

  it('marks isFullYear=false and computes scaleFactor for < 365 days', () => {
    const ds = DATASET_UNDER_YEAR;
    const input = { allDays: ds.days, eanCode: '', meterNr: '', meterType: '' };
    const result = processDataPure(input, ds.pvInv, [ds.config], ds.priceDay, ds.priceNight);
    expect(result.isFullYear).toBe(false);
    expect(result.daysInWindow).toBe(200);
  });

  it('totalAfname equals sum of windowDays afname', () => {
    const ds = DATASET_PERFECT_DAY;
    const input = { allDays: ds.days, eanCode: '', meterNr: '', meterType: '' };
    const result = processDataPure(input, ds.pvInv, [ds.config], ds.priceDay, ds.priceNight);
    const expectedTotal = ds.days.reduce((s, d) => s + d.afname, 0);
    expect(result.totalAfname).toBeCloseTo(expectedTotal, 4);
  });
});

describe('computePerYearStats', () => {
  it('returns numYears=0 for less than 365 days', () => {
    const days = generateUniformDays(200, new Date(2024, 0, 1), { afname: 10, injectie: 8 });
    const result = computePerYearStats(days, 3, [{ type: 'X', batCap: 5, batInv: 3, eff: 0.9, price: 3000 }], days[199].date, 0.30, NaN);
    expect(result.numYears).toBe(0);
    expect(result.perYear).toEqual([]);
  });

  it('splits 730 days into 2 year-blocks', () => {
    const days = generateUniformDays(730, new Date(2023, 0, 1), { afname: 10, injectie: 8 });
    const cfg = [{ type: 'X', batCap: 5, batInv: 3, eff: 0.9, price: 3000 }];
    const result = computePerYearStats(days, 3, cfg, days[729].date, 0.30, NaN);
    expect(result.numYears).toBe(2);
    expect(result.perYear).toHaveLength(2);
  });
});

describe('averageStats', () => {
  it('returns null for empty perYear', () => {
    expect(averageStats([], [])).toBeNull();
  });

  it('averages totalAfname over N years', () => {
    const perYear = [
      { afname: 3000, injectie: 2000, afnamedag: 1800, afnamenacht: 1200, injectiedag: 1200, injectienacht: 800, effectivePrice: 0.30, scenarios: [{ scenWC: { qualifyingDays: 300, partialDays: 65, chargedFull: 1200, chargedPartial: 100, annualSavingFull: 360, annualSavingPartial: 30, annualSaving: 390, payback: 7.7, recoveryPctFull: 40, recoveryPctPartial: 3.3, injPctFull: 66, injPctPartial: 5.5, threshold: 5 }, scenOpt: { qualifyingDays: 300, partialDays: 65, chargedFull: 1400, chargedPartial: 120, annualSavingFull: 420, annualSavingPartial: 36, annualSaving: 456, payback: 6.6, recoveryPctFull: 47, recoveryPctPartial: 4, injPctFull: 78, injPctPartial: 6.7, threshold: 5 } }] },
      { afname: 3600, injectie: 2400, afnamedag: 2160, afnamenacht: 1440, injectiedag: 1440, injectienacht: 960, effectivePrice: 0.30, scenarios: [{ scenWC: { qualifyingDays: 320, partialDays: 45, chargedFull: 1400, chargedPartial: 80, annualSavingFull: 420, annualSavingPartial: 24, annualSaving: 444, payback: 6.8, recoveryPctFull: 39, recoveryPctPartial: 2.2, injPctFull: 65, injPctPartial: 3.7, threshold: 5 }, scenOpt: { qualifyingDays: 320, partialDays: 45, chargedFull: 1600, chargedPartial: 100, annualSavingFull: 480, annualSavingPartial: 30, annualSaving: 510, payback: 5.9, recoveryPctFull: 44, recoveryPctPartial: 2.8, injPctFull: 74, injPctPartial: 4.6, threshold: 5 } }] },
    ];
    const cfg = [{ type: 'X', batCap: 5, batInv: 3, eff: 0.9, price: 3000 }];
    const result = averageStats(perYear, cfg);
    expect(result.totalAfname).toBeCloseTo((3000 + 3600) / 2, 1);
    expect(result.totalInjectie).toBeCloseTo((2000 + 2400) / 2, 1);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/calc-engine.test.js`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/calc-engine.test.js
git commit -m "test: add logic-first tests for calc-engine"
```

---

### Task 6: Write csv.js Tests

**Files:**
- Create: `tests/csv.test.js`

- [ ] **Step 1: Write CSV tests**

```js
import { describe, it, expect } from 'vitest';
import { parseCSV, parseDate, parsVolume, extractCsvForStorage } from '../assets/js/csv.js';

describe('parseCSV', () => {
  it('splits semicolon-separated rows into objects keyed by header', () => {
    const csv = 'Kolom A;Kolom B;Kolom C\nwaarde1;waarde2;waarde3\n';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ 'Kolom A': 'waarde1', 'Kolom B': 'waarde2', 'Kolom C': 'waarde3' });
  });

  it('skips rows with fewer columns than header', () => {
    const csv = 'A;B;C;D;E;F;G;H;I\nval1;val2\nval1;val2;val3;val4;val5;val6;val7;val8;val9\n';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
  });

  it('trims whitespace from headers and values', () => {
    const csv = ' A ; B \n val1 ; val2 \n';
    // 2 cols < 9 → skipped with current implementation (cols.length < header.length)
    // Actually the code checks cols.length < 9 hardcoded. Let's test with 9+ cols.
    const csv9 = 'A;B;C;D;E;F;G;H;I\n 1 ; 2 ; 3 ; 4 ; 5 ; 6 ; 7 ; 8 ; 9 \n';
    const rows = parseCSV(csv9);
    expect(rows[0]['A']).toBe('1');
    expect(rows[0]['I']).toBe('9');
  });

  it('handles empty input gracefully', () => {
    const rows = parseCSV('Header\n');
    expect(rows).toEqual([]);
  });
});

describe('parseDate', () => {
  it('parses dd-mm-yyyy to correct Date', () => {
    const d = parseDate('15-03-2025');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(2); // March = 2
    expect(d.getDate()).toBe(15);
  });

  it('parses first day of year', () => {
    const d = parseDate('01-01-2024');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});

describe('parsVolume', () => {
  it('parses Belgian decimal format (comma as decimal separator)', () => {
    expect(parsVolume('1,234')).toBeCloseTo(1.234, 3);
  });

  it('returns 0 for empty string', () => {
    expect(parsVolume('')).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(parsVolume(null)).toBe(0);
    expect(parsVolume(undefined)).toBe(0);
  });

  it('parses zero correctly', () => {
    expect(parsVolume('0,000')).toBe(0);
  });
});

describe('extractCsvForStorage', () => {
  const sampleCSV = [
    'EAN-code;Meter;Metertype;Van (datum);Tot (datum);Register;Volume;Eenheid;Validatiestatus',
    '="541999999999";M001;DMM;01-01-2024;02-01-2024;Afname dag;5,500;kWh;Gevalideerd',
    '="541999999999";M001;DMM;01-01-2024;02-01-2024;Afname nacht;3,200;kWh;Gevalideerd',
    '="541999999999";M001;DMM;01-01-2024;02-01-2024;Injectie dag;4,100;kWh;Gevalideerd',
    '="541999999999";M001;DMM;01-01-2024;02-01-2024;Injectie nacht;1,000;kWh;Gevalideerd',
    '="541999999999";M001;DMM;02-01-2024;03-01-2024;Afname dag;6,000;kWh;Gevalideerd',
    '="541999999999";M001;DMM;02-01-2024;03-01-2024;Afname nacht;4,000;kWh;Gevalideerd',
    '="541999999999";M001;DMM;02-01-2024;03-01-2024;Injectie dag;3,500;kWh;Gevalideerd',
    '="541999999999";M001;DMM;02-01-2024;03-01-2024;Injectie nacht;0,500;kWh;Gevalideerd',
  ].join('\n');

  it('extracts EAN code, meter number, meter type', () => {
    const result = extractCsvForStorage(sampleCSV);
    expect(result.eanCode).toBe('541999999999');
    expect(result.meterNr).toBe('M001');
    expect(result.meterType).toBe('DMM');
  });

  it('returns correct dailyCompact shape', () => {
    const result = extractCsvForStorage(sampleCSV);
    expect(result.dailyCompact.startDate).toBe('2024-01-01');
    expect(result.dailyCompact.afname).toHaveLength(2);
    expect(result.dailyCompact.injectie).toHaveLength(2);
  });

  it('aggregates afname and injectie correctly per day', () => {
    const result = extractCsvForStorage(sampleCSV);
    // Day 1: afname = 5.5 + 3.2 = 8.7, injectie = 4.1 + 1.0 = 5.1
    expect(result.dailyCompact.afname[0]).toBeCloseTo(8.7, 2);
    expect(result.dailyCompact.injectie[0]).toBeCloseTo(5.1, 2);
    // Day 2: afname = 6.0 + 4.0 = 10.0, injectie = 3.5 + 0.5 = 4.0
    expect(result.dailyCompact.afname[1]).toBeCloseTo(10.0, 2);
    expect(result.dailyCompact.injectie[1]).toBeCloseTo(4.0, 2);
  });

  it('splits dag/nacht registers correctly', () => {
    const result = extractCsvForStorage(sampleCSV);
    expect(result.dailyCompact.afnamedag[0]).toBeCloseTo(5.5, 2);
    expect(result.dailyCompact.afnamenacht[0]).toBeCloseTo(3.2, 2);
    expect(result.dailyCompact.injectiedag[0]).toBeCloseTo(4.1, 2);
    expect(result.dailyCompact.injectienacht[0]).toBeCloseTo(1.0, 2);
  });

  it('throws on empty CSV', () => {
    expect(() => extractCsvForStorage('Header\n')).toThrow('Geen data gevonden');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/csv.test.js`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/csv.test.js
git commit -m "test: add logic-first tests for csv parsing"
```

---

### Task 7: Create shared-helpers.js

**Files:**
- Create: `assets/js/shared-helpers.js`

- [ ] **Step 1: Create shared-helpers.js**

```js
// Shared UI helpers — ES module.
// Used by dashboard.html, project-edit.html, index.html.

// ─── HTML/Security ───────────────────────────────────────────────────────────

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ─── String utils ────────────────────────────────────────────────────────────

export function shortEmail(e) { return e ? String(e).split('@')[0] : '—'; }

// ─── UI Feedback ─────────────────────────────────────────────────────────────

/**
 * Show a Bootstrap 5 toast. Requires a #toastContainer element in the DOM.
 * Variants: 'primary' | 'success' | 'danger' | 'warning'
 */
export function showToast(message, variant = 'primary') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const id = 't_' + Date.now();
  const html = `
    <div id="${id}" class="toast text-bg-${variant} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Sluiten"></button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
  const el = document.getElementById(id);
  const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 4000 });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  t.show();
}

// ─── Auth UI ─────────────────────────────────────────────────────────────────

export function showState(which) {
  ['stateLoggedOut', 'stateNotWhitelisted', 'stateAuthorized'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hide', id !== which);
  });
}

// ─── Date Formatting (Firestore Timestamps) ─────────────────────────────────

export function fmtDate(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '—';
  return ts.toDate().toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTs(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '—';
  return ts.toDate().toLocaleString('nl-BE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export function fmtRelTime(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '—';
  const date = ts.toDate();
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60)     return 'net nu';
  if (diffSec < 3600)   return Math.floor(diffSec / 60) + ' min geleden';
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) return 'vandaag ' + date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'gisteren ' + date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' }) +
         ' ' + date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/js/shared-helpers.js
git commit -m "feat: create shared-helpers ES module (escapeHtml, toast, date utils)"
```

---

### Task 8: Write shared-helpers Tests

**Files:**
- Create: `tests/shared-helpers.test.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it, expect } from 'vitest';
import { escapeHtml, shortEmail } from '../assets/js/shared-helpers.js';

describe('escapeHtml', () => {
  it('escapes & < > " \'', () => {
    expect(escapeHtml('a & b < c > d " e \' f')).toBe('a &amp; b &lt; c &gt; d &quot; e &#39; f');
  });

  it('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converts number to string without escaping', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('Hello world')).toBe('Hello world');
  });
});

describe('shortEmail', () => {
  it('extracts prefix before @', () => {
    expect(shortEmail('kevin@example.com')).toBe('kevin');
  });

  it('returns em-dash for null', () => {
    expect(shortEmail(null)).toBe('—');
  });

  it('returns em-dash for empty string', () => {
    expect(shortEmail('')).toBe('—');
  });

  it('handles email without @', () => {
    expect(shortEmail('noemail')).toBe('noemail');
  });
});

// Note: fmtDate, formatTs, fmtRelTime, showToast, showState depend on DOM/bootstrap
// and are tested via integration tests (out of scope for this phase).
// We test the pure logic portions only.
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/shared-helpers.test.js`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/shared-helpers.test.js
git commit -m "test: add tests for shared-helpers (escapeHtml, shortEmail)"
```

---

### Task 9: Migrate index.html to Use ES Modules

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Change `<script>` to `<script type="module">` and add imports**

At the top of the inline script (line 756), change `<script>` to `<script type="module">` and add import statements. Remove all functions that have been moved to `calc-engine.js`.

The opening of the script becomes:

```html
<script type="module">
import { parseCSV, parseDate, parsVolume } from './assets/js/csv.js';
import { extractCsvForStorage } from './assets/js/csv.js';
import {
  CALC_CONSTANTS, MONTH_NL_FULL,
  formatDate, fmt2, fmtEur, renderWithAvg,
  parseCSVLine, parseEurAmount, parseSheetConfigs,
  csvToAllDaysAndMeta, buildAllDaysFromDailyCompact,
  calcScenario, processDataPure, computePerYearStats, averageStats,
  buildYearBuckets, buildMonthBuckets, buildDayBuckets,
  availableMonthKeys, buildYearBucketsFromMonthMap, buildMonthBucketsFromMonthMap,
} from './assets/js/calc-engine.js';
import { escapeHtml } from './assets/js/shared-helpers.js';
```

Then remove:
- Lines 760–774 (formatDate, fmt2, fmtEur, renderWithAvg)
- Lines 780–889 (all chart bucket helpers: `_buildYearBuckets` through `_buildMonthBucketsFromMonthMap`)
- Line 896 (MONTH_NL_FULL constant)
- Lines 1208–1244 (`_parseCSVLine`, `_parseEurAmount`, `_parseSheetConfigs`)
- Lines 1379–1498 (`computePerYearStats`, `averageStats`)
- Lines 1502–1553 (`_csvToAllDaysAndMeta`, `_buildAllDaysFromDailyCompact`)
- Lines 1557–1717 (`processData` body — replaced with thin wrapper)
- Lines 2347–2350 (`escapeHtmlLite`)

Replace `processData` with:
```js
function processData(input, pvInv, selectedConfigs, priceDay, priceNight) {
  const d = processDataPure(input, pvInv, selectedConfigs, priceDay, priceNight);
  if (!d) { alert('Geen data gevonden in het CSV bestand.'); return; }
  renderResults(d);
}
```

Replace all references to `_buildYearBuckets` → `buildYearBuckets`, etc. (drop leading underscore).
Replace `escapeHtmlLite` → `escapeHtml`.
Replace `_csvToAllDaysAndMeta` → `csvToAllDaysAndMeta`.
Replace `_buildAllDaysFromDailyCompact` → `buildAllDaysFromDailyCompact`.
Replace `_parseSheetConfigs` → `parseSheetConfigs`.
Replace `_parseCSVLine` → `parseCSVLine`.
Replace `_parseEurAmount` → `parseEurAmount`.

- [ ] **Step 2: Verify page loads locally**

Run: `python3 -m http.server 8000` and open `http://localhost:8000/index.html?data=...` or manually test with a CSV upload.

- [ ] **Step 3: Run all tests to confirm nothing broke**

Run: `npx vitest run`
Expected: All tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "refactor(index): migrate to ES modules, import calc-engine + shared-helpers"
```

---

### Task 10: Migrate dashboard.html and project-edit.html

**Files:**
- Modify: `dashboard.html`
- Modify: `project-edit.html`
- Modify: `assets/js/photo-uploader.js`

- [ ] **Step 1: Migrate dashboard.html**

Change `<script>` to `<script type="module">`. Add imports:
```js
import { escapeHtml, showToast, showState, shortEmail, fmtDate, fmtRelTime } from './assets/js/shared-helpers.js';
import { extractCsvForStorage } from './assets/js/csv.js';
```

Remove local definitions of: `escapeHtml`, `showToast`, `showState`, `shortName` (rename calls to `shortEmail`), `fmtDate`, `fmtRelTime`.

- [ ] **Step 2: Migrate project-edit.html**

Change `<script>` to `<script type="module">`. Add imports:
```js
import { escapeHtml, showToast, showState, shortEmail, formatTs } from './assets/js/shared-helpers.js';
import { extractCsvForStorage } from './assets/js/csv.js';
```

Remove local definitions of: `escapeHtml`, `showToast`, `showState`, `shortEmail`, `formatTs`.

- [ ] **Step 3: Migrate photo-uploader.js to import escapeHtml**

At the top of `assets/js/photo-uploader.js`, add:
```js
import { escapeHtml } from './shared-helpers.js';
```

Remove the `_esc` fallback function and replace all calls to `_esc(...)` with `escapeHtml(...)`.

- [ ] **Step 4: Verify all pages load locally**

Test each page in browser:
- `http://localhost:8000/dashboard.html`
- `http://localhost:8000/project-edit.html?new=1`
- `http://localhost:8000/index.html`

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard.html project-edit.html assets/js/photo-uploader.js
git commit -m "refactor(backoffice): migrate dashboard + project-edit to ES modules"
```

---

### Task 11: Final Verification & Push

**Files:** None new.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (calc-engine: ~15, csv: ~10, shared-helpers: ~8).

- [ ] **Step 2: Push branch to remote**

```bash
git push -u origin refactor/js-extraction
```

- [ ] **Step 3: Create PR for deploy preview**

```bash
gh pr create --title "refactor: extract JS into ES modules + add Vitest test suite" --body "$(cat <<'EOF'
## Summary
- Extracted ~800 lines of pure calculation logic into `assets/js/calc-engine.js`
- Consolidated duplicated helpers (escapeHtml, showToast, etc.) into `assets/js/shared-helpers.js`
- Migrated `assets/js/csv.js` to ES module exports
- All HTML pages now use `<script type="module">` with imports
- Added Vitest test infrastructure with ~67 logic-first tests using synthetic data
- Tests validate expected output based on hand-calculations, not current code behavior

## Test plan
- [ ] `npx vitest run` passes all tests
- [ ] Calculator flow works: upload CSV → select config → Bereken → results display
- [ ] Share-link generation and restoration works
- [ ] Dashboard loads and displays projects
- [ ] Project-edit form saves correctly
- [ ] Netlify deploy preview loads without console errors

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Verify Netlify deploy preview works**

Check the PR for the Netlify deploy preview URL. Open it and verify:
- Calculator page loads
- No console errors related to module imports
- Basic flow works (if you have test data)
