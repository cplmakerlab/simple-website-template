# Project Metadata Uitbreiding — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Predecessor:** `2026-04-18-firebase-projects-design.md` (Phase 1 — Firebase Projects)

## Goal

Heel veel velden die vandaag op `index.html` per berekening ingevuld worden verhuizen naar **project-niveau** zodat Kevin & Ruben ze éénmaal bij project-aanmaak (of later bij edit) invullen en bij elke berekening automatisch opgeladen zien. Daarnaast voegt deze fase nieuwe **installatie-context velden** toe die vandaag nog helemaal niet bestaan (aansluiting, zekeringkast, wifi-bereik, bekabeling, …) — relevant voor de technische voorbereiding van een installatie, niet voor de ROI-berekening zelf.

Het model van het nieuw-project aanmaken stopt met de simpele 4-veld modal op `dashboard.html`. Ervoor in de plaats komt een aparte, mobile-first **project-edit pagina** (`project-edit.html`) voor zowel creatie als bewerking. De modal-benadering schaalt niet naar het aantal velden dat we hier opslaan.

## Non-goals

- **Audit-log** van wie welk veld wanneer aanpaste — enkel `updatedAt` per project blijft, zoals Phase 1.
- **Multi-inverter invloed op rekenmodel buiten de som van vermogens** — alle andere per-omvormer gegevens (merk, type, aantal panelen, ligging) zijn metadata voor de verkoper/technieker; de calculator gebruikt enkel de som van `powerKw`. Een toekomstige fase zou per-inverter efficiëntie of per-kring gedrag kunnen modelleren.
- **Validatie dwingen op Save** — een project mag altijd half ingevuld opgeslagen worden. Berekening eist wel alle calc-relevante velden.
- **Synchronisatie bij prijslijst-wijziging** — BTW/keuring voorkeur wordt per project opgeslagen; wijzigt de productsheet, dan blijven projectwaarden als-is.
- **UI voor het kiezen van welke berekening als "definitieve" offerte telt** (nog steeds alleen `lastCalcRun`). Phase 3.

## Scope samenvatting

| Gebied | Verandering |
|---|---|
| Firestore schema | +6 top-level secties op het project-doc (`site`, `electrical`, `cabinet`, `solar`, `supplier`, `calcDefaults`). Alle bestaande velden blijven. |
| `dashboard.html` | Modal voor nieuw-project **vervangen** door redirect naar `project-edit.html?new=1`. Rij-actie "📂 Open" blijft, nieuwe "✏ Bewerken" actie toegevoegd. |
| `project-edit.html` | **Nieuwe pagina**. Auth-gated (zelfde whitelist als dashboard). Bevat alle projectvelden in secties, mobile-first, save-altijd-mogelijk. |
| `index.html` (project-mode) | Velden die op projectniveau ingevuld zijn worden **verborgen** uit de form en getoond in een nieuwe **dichtgeklapte "Projectgegevens" kaart** bovenaan met "✏ Aanpassen" knop (redirect). Niet-ingevulde velden blijven inline zichtbaar; als user ze invult → bij Bereken save back naar project. |
| `index.html` (bare / `?data=`) | **Onveranderd**. Project-summary-kaart verschijnt alleen in `?project=<id>` mode. |
| `firebase-init.js` | Nieuwe helpers: `updateProjectMetadata(id, patch)`, constanten voor connection-types, enums voor ja/nee velden. |

## Data model

Uitbreiding van het Firestore `projects` document (additief — alle nieuwe velden default `null` of lege array). Alles wat hier staat is top-level op het project-doc, tenzij anders aangegeven.

```text
// — Bestaand (Phase 1, ongewijzigd) —
projectName:   string
customerName:  string
status:        string (enum PROJECT_STATUSES)
createdBy:     string (email)
createdAt:     Timestamp
updatedAt:     Timestamp
deletedAt:     null | Timestamp
csvUpload:     null | { uploadedAt, uploadedBy, eanCode, meterNr, meterType, dailyCompact }
lastCalcRun:   null | { calculatedAt, calculatedBy, inputs, results }

// — Nieuw: woning / algemene site —
site: {
  houseAgeOver10Years: null | boolean,  // drives BTW when set (true → 6%, false → 21%)
}

// — Nieuw: elektrische aansluiting —
electrical: {
  connectionType: null | "1x230" | "3x230" | "3x400+N",
  fuseRatingA:    null | number,        // ampère
}

// — Nieuw: zekeringkast & nabijheid —
cabinet: {
  freeUnits:              null | number,     // aantal vrije modules
  hasRemAutomaat:         null | boolean,
  wiringDiameterMm2:      null | number,     // optioneel, numeriek mm²
  hasOutletNearFluvius:   null | boolean,
  hasWifiNearFluvius:     null | boolean,
  batteryPlacementRoom:   null | boolean,    // plaats in buurt zekeringkast
  hasWifiNearCabinet:     null | boolean,
}

// — Nieuw: zonnepanelen & omvormer(s), lijst kan 1..N items bevatten —
solar: {
  inverters: [
    {
      id:            string (client-side uuid, voor de UI lijst),
      powerKw:       number,        // REQUIRED per item
      brand:         null | string, // optioneel
      model:         null | string, // optioneel
      panelCount:    null | number, // optioneel
      panelPowerWp:  null | number, // optioneel, per paneel
      circuitCount:  null | number, // optioneel, aantal kringen aan deze omvormer
      orientation:   null | string, // optioneel, vrij tekstveld (bv. "zuid, 2× oost")
    },
    // … meerdere mogelijk
  ]
  // Afgeleid (niet opgeslagen): totalPowerKw = sum(inverters[].powerKw)
}

// — Nieuw: energieleverancier & tarieven —
supplier: {
  name:            null | string, // optioneel
  isSingleTariff:  boolean,       // default false; true → priceNight genegeerd
  priceDay:        null | number, // €/kWh
  priceNight:      null | number, // €/kWh; null of isSingleTariff=true → onbestaand
}

// — Nieuw: voorkeuren voor berekening (overschrijfbaar op index) —
calcDefaults: {
  btw:     null | 6 | 21,    // null toegelaten; als site.houseAgeOver10Years != null → auto-afgeleid, veld niet invulbaar
  keuring: null | "no" | "yes",
}
```

**BTW-afleidingsregel** (single source of truth):

```text
if site.houseAgeOver10Years === true  → effectiveBtw = 6
if site.houseAgeOver10Years === false → effectiveBtw = 21
if site.houseAgeOver10Years === null  → effectiveBtw = calcDefaults.btw || null
```

Zodra `houseAgeOver10Years` een boolean is wordt `calcDefaults.btw` ongebruikt (blijft opgeslagen — we overschrijven het niet — maar de UI toont alleen de afgeleide waarde). Op `index.html` verdwijnt de BTW-dropdown zodra `houseAgeOver10Years` gezet is; anders blijft hij maar bevat zijn default uit `calcDefaults.btw`.

**Keuring voorkeur** (`calcDefaults.keuring`) verdwijnt **niet** van `index.html`. De dropdown wordt er gevuld met de project-default maar blijft aanpasbaar — pas bij Bereken wordt de eventueel gewijzigde waarde teruggeschreven.

**Migratie / backward compat:** bestaande projecten (pre-2026-04-20) hebben deze secties niet. Elke reader behandelt ontbrekende sectie als volledig leeg (alles `null`, `inverters = []`, `isSingleTariff = false`). Geen migratie-script nodig; velden worden bij eerste save door `project-edit.html` toegevoegd.

## UI — `project-edit.html`

### Entry / routing

- `project-edit.html?new=1` → lege form, knop "Opslaan en naar dashboard" maakt project aan, redirect → `dashboard.html`.
- `project-edit.html?project=<id>` → laadt bestaand project, knop "Opslaan" schrijft patch, redirect → `dashboard.html` (default) of "Opslaan en bereken" → `index.html?project=<id>`.
- Auth-guard identiek aan dashboard: niet-ingelogd → sign-in scherm; niet-whitelisted → geen-toegang scherm.
- `?new=1` én `?project=<id>` tegelijk → `new=1` wint (nieuw project, id genegeerd).
- Onbekende of soft-deleted project-id → foutkaart "Project niet gevonden" + link naar dashboard.

### Layout (mobile-first)

Eén verticale stroom van "secties" (elk = `.card`) onder een compacte topbar. Op desktop (≥ 768px) verticaal gestapeld in één kolom met max-width 760px; geen multi-column layout — verkoper vult lineair door. Elke sectie-titel heeft een `<details>` disclosure zodat na eerste save de al-ingevulde secties dichtgeklapt kunnen zijn (default open bij `?new=1`, default dicht bij `?project=<id>` behalve secties die nog velden missen).

**Secties** (in deze volgorde):

1. **Basisgegevens** — `projectName` *, `customerName` *, `status` (alle verplicht behalve status die default `nieuw_contact` is). Identiek aan vandaag.
2. **Leverancier & tarieven** — `supplier.name`, `supplier.isSingleTariff` (checkbox: *"Enkelvoudig tarief"*), `supplier.priceDay`, `supplier.priceNight` (alleen zichtbaar als `isSingleTariff` uit staat).
3. **Woning** — `site.houseAgeOver10Years` (radio / tri-state: *"10 jaar of ouder"* / *"Jonger dan 10 jaar"* / *"Onbekend"*). Uitleg onder het veld: *"10 jaar of ouder → BTW 6%. Jonger → BTW 21%."* Onder de radio: een **readonly** "Effectief BTW-tarief" display (auto-afgeleid), of — bij "Onbekend" — een extra dropdown `calcDefaults.btw` met lege default.
4. **Elektrische aansluiting** — `electrical.connectionType` (select 1x230 / 3x230 / 3x400+N / leeg), `electrical.fuseRatingA` (number, A).
5. **Zekeringkast** — `cabinet.freeUnits` (number), `cabinet.hasRemAutomaat` (tri-state radio ja/nee/onbekend), `cabinet.wiringDiameterMm2` (number, optioneel), `cabinet.batteryPlacementRoom` (tri-state), `cabinet.hasOutletNearFluvius` (tri-state), `cabinet.hasWifiNearFluvius` (tri-state), `cabinet.hasWifiNearCabinet` (tri-state).
6. **Zonnepanelen & omvormer(s)** — dynamische lijst van inverter-kaartjes. Bovenaan een "+ Omvormer toevoegen" knop. Elk kaartje toont `powerKw` *, `brand`, `model`, `panelCount`, `panelPowerWp`, `circuitCount`, `orientation` (textarea). Rechtsbovenaan elk kaartje een "🗑 Verwijderen" knop (niet zichtbaar als er maar 1 is en dat is de eerste). Onderaan de sectie: afgeleide **"Totaal omvormervermogen: X.X kW"** readonly label (live gerekend).
7. **Voorkeuren berekening** — `calcDefaults.keuring` (select *Zonder keuring* / *Met keuring* / *Geen voorkeur*). BTW staat niet hier want die zit in sectie 3.
8. **Verbruikshistoriek** — CSV upload. Als er al één is, toon samenvattingsregel (eanCode + uploadedAt) + "📁 Vervangen" knop (zelfde gedrag als de huidige banner op `index.html` — `setProjectCsv`). Als er nog geen is, een file-picker.

### Actie-balk (sticky bottom op mobile, footer op desktop)

Drie knoppen:

- **Annuleren** → `dashboard.html` zonder save.
- **Opslaan** → save, blijf op pagina (toast "Opgeslagen").
- **Opslaan & Bereken** → save, redirect naar `index.html?project=<id>` (bij `?new=1` eerst aanmaken dan redirecten met het nieuwe id).

Voor nieuw-project: `Annuleren` / `Aanmaken` / `Aanmaken & Bereken`. Alleen `projectName` en `customerName` zijn hard required voor aanmaken; al de rest mag leeg.

### Validatie

- **Save-tijd:** enkel `projectName`, `customerName` verplicht. Voor elke omvormer in de lijst is `powerKw` verplicht (als een kaartje aangemaakt is maar `powerKw` leeg → inline error, save geblokkeerd tot ingevuld of kaartje verwijderd). Alle andere velden: vrije invoer of leeg.
- **Calc-tijd** (uitgevoerd op `index.html`): valideert of alle voor de berekening **noodzakelijke** velden aanwezig zijn; zo niet, toont de bestaande foutmeldingen op index + valt terug op inline invoer.

Noodzakelijk voor berekening (onveranderd van vandaag):
- `totalPowerKw` (som van inverters) > 0 — anders vervangt index nog steeds zijn lokaal `pvInverter` veld.
- `supplier.priceDay` > 0.
- Effectief BTW bepaald (6 of 21).
- `calcDefaults.keuring` bepaald (of gekozen op index).
- ≥1 productconfiguratie (blijft op index).

## UI — `index.html` project-mode aanpassingen

Bare mode (`index.html` zonder query) en `?data=<b64>` mode blijven **exact** zoals ze zijn. Alles hieronder geldt enkel wanneer `?project=<id>` gebruikt is.

### Nieuwe kaart: "Projectgegevens" (dichtgeklapt default)

Ingevoegd onder de `projectBanner`, boven de CSV upload kaart. HTML-structuur:

```text
<details class="card project-values" [open]>
  <summary>
    <h2>📋 Projectgegevens</h2>
    <button class="btn btn-secondary" id="pvEditBtn">✏ Aanpassen</button>
  </summary>
  <div class="pv-grid">
    <!-- Elke rij: label — waarde, grijs gestileerd -->
  </div>
</details>
```

**Default `open` attribuut:** afwezig (dus dichtgeklapt). Als echter ≥1 verplicht calc-veld nog ontbreekt vanuit project, dan wordt de kaart open geopend met een waarschuwing bovenaan ("Enkele velden ontbreken — vul ze hieronder in bij Bereken of via ✏ Aanpassen").

**Inhoud van `pv-grid`**: alleen secties die minstens één ingevuld veld bevatten worden gerenderd. Een lege sectie wordt overgeslagen zodat de kaart compact blijft. Layout = twee kolommen op desktop, één op mobile (bestaande `@media (max-width: 600px)` breakpoint).

De **✏ Aanpassen** knop doet `window.location.href = 'project-edit.html?project=' + id` — geen modal, geen inline edit.

### Verbergen van form-velden in project-mode

Voor **elk** form-veld op index dat vanuit het project komt wordt de bijhorende `.form-group` wrapper op `display:none` gezet **alleen als de projectwaarde niet null is**. Als projectwaarde `null`, blijft het veld zichtbaar en bewerkbaar op index (fallback-invoer).

Mapping:

| Index veld | Project bron | Verbergen als |
|---|---|---|
| `#pvInverter` | `sum(solar.inverters[].powerKw)` | ≥1 inverter met `powerKw > 0` |
| `#elecPrice` | `supplier.priceDay` | niet null |
| `#elecPriceNight` | `supplier.priceNight` (en `isSingleTariff === false`) | niet null; indien `isSingleTariff` true wordt veld ook verborgen maar met een klein notitie-regeltje in summary |
| `#btwSelect` | effectiveBtw (zie afleiding) | niet null — dus altijd als `houseAgeOver10Years` boolean is, of als `calcDefaults.btw` gezet |
| `#keuringSelect` | `calcDefaults.keuring` | **nooit**. Zichtbaar en bewerkbaar, maar default-value komt uit project. Zie volgende sectie voor sync-back. |

De reden voor verbergen: dubbele bron-of-truth vermijden. Wil de verkoper snel een andere waarde? Klik ✏ Aanpassen.

### Sync-back bij Bereken

Bij klik op `⚡ Bereken ROI` (bestaande `calculate()` flow):

1. Bepaal voor elk "fallback-zichtbaar" veld of de gebruiker een nieuwe waarde ingevoerd heeft.
2. Als ja, en de projectwaarde is momenteel null → schrijf de nieuwe waarde mee in het Firestore project patch (samen met de bestaande `lastCalcRun` update, één transactie).
3. Uitzondering: `#keuringSelect` is altijd zichtbaar. Als zijn waarde verschilt van `calcDefaults.keuring` → schrijf terug (overschrijft). Dit maakt dat een éénmalige correctie op index automatisch persist.
4. PV-vermogen sync-back: als de user in fallback modus een waarde in `#pvInverter` typt en er bestaan nog **0 inverters** op project → maak automatisch één `solar.inverters[0]` entry met `powerKw = <ingevoerde waarde>` (rest velden null). Bestaan er al omvormers maar som is 0 (dataverlies / oude data), dan overschrijven we `inverters[0].powerKw`.

Alle sync-back gebeurt stil (geen popup), wel één toast *"Projectgegevens aangevuld uit invoer"* als ≥1 veld teruggeschreven werd, zodat de verkoper beseft dat volgende keer het veld verborgen is.

## Dashboard wijzigingen

- **Nieuw-project modal verwijderd.** `#newProjectBackdrop` block eruit. Knop `#btnNewProject` doet nu `window.location.href = 'project-edit.html?new=1'`.
- **Rij-actie uitgebreid:** naast `📂 Open` (blijft `index.html?project=<id>`) komt `✏` knop → `project-edit.html?project=<id>`.
- **Status-chip, soft-delete / restore, toon-verwijderde** blijven ongewijzigd.
- Omdat de modal weg is mogen bijhorende CSS en wiring (`#newProjectBackdrop`, `#newProjectForm`, handlers) verwijderd worden — code opruimen hoort bij het werk (YAGNI).

## Firebase helpers (`assets/js/firebase-init.js`)

Toevoegen:

- `CONNECTION_TYPES` constante array `['1x230', '3x230', '3x400+N']` (gebruikt door project-edit.html voor dropdown).
- `newEmptyProjectMetadata()` pure helper die een volledig default-structuur object teruggeeft voor `site`, `electrical`, `cabinet`, `solar`, `supplier`, `calcDefaults`. Gebruikt door project-edit.html bij `?new=1` en door readers voor veilige merge.
- `updateProjectMetadata(id, patch)` — schrijft een willekeurig deelobject van de metadata secties naar Firestore met `{merge: true}` via `set()` (update is niet bruikbaar voor nested objecten zonder dot-notatie; set-merge is de schoonste). `updatedAt` wordt mee geschreven.
- `createProject()` signature uitbreiden: extra optionele `metadata` parameter die indien meegegeven de 6 nieuwe secties mee in het nieuwe doc zet. Als `metadata` weggelaten → de 6 secties worden weggelaten uit het doc (pre-2026-04-20 gedrag; readers vallen terug op defaults).
- `effectiveBtwFor(project)` pure helper die de afleidingsregel uitvoert.
- `totalInverterPowerKw(project)` pure helper die de som berekent.

De bestaande `createProject()` caller in dashboard verdwijnt (modal weg); de nieuwe caller staat op `project-edit.html`. De signature-uitbreiding is dus niet zozeer backward-compat maar een clean API voor de nieuwe pagina.

## Bestandsstructuur

```text
+ project-edit.html           (nieuw — volledige form voor aanmaken/bewerken)
  index.html                  (gewijzigd — project-summary kaart + conditioneel verbergen)
  dashboard.html              (gewijzigd — modal weg, bewerk-knop bij)
  assets/js/firebase-init.js  (gewijzigd — nieuwe helpers + createProject signature)
  assets/js/csv.js            (ongewijzigd)
  docs/superpowers/specs/2026-04-20-project-metadata-design.md  (dit document)
```

Er komt **geen** nieuw JS bestand zoals `project-form.js`. De form-logica leeft in `<script>` van `project-edit.html` — consistent met hoe `dashboard.html` en `index.html` het doen (inline script, CDN compat SDK, geen build-step). Mocht de form > ~500 regels worden, extraheren naar `assets/js/project-edit.js`.

## Edge cases

- **Gedeeltelijke inverter-entry** op project-edit: kaartje met merk maar geen `powerKw` → save geblokkeerd. Error inline in het kaartje, focus op `powerKw` input.
- **Leeg inverters-array + user type iets in `#pvInverter` op index**: zoals beschreven in sync-back, wordt dit automatisch één nieuwe inverter entry met enkel `powerKw` gezet. De verkoper kan later via project-edit merk/type aanvullen.
- **`supplier.isSingleTariff = true` + iemand heeft een oude `priceNight` waarde staan**: de waarde blijft staan in Firestore maar wordt niet gebruikt door index (nacht-veld is verborgen). Als de checkbox later weer uitgevinkt wordt komt de oude waarde als default terug — geen dataverlies.
- **BTW auto vs handmatig conflict**: project-edit mag niet tegelijk `houseAgeOver10Years` een boolean EN `calcDefaults.btw` een andere waarde laten zijn zonder visuele consistentie. Oplossing: als de radio op "10+ jaar" of "< 10 jaar" staat wordt het `calcDefaults.btw` select disabled getoond met de afgeleide waarde erin. Bij "Onbekend" enabled.
- **Twee gebruikers (Kevin + Ruben) bewerken tegelijk hetzelfde project**: zelfde last-write-wins als Phase 1. Geen lock. Voor nu aanvaardbaar (2 users).
- **Project zonder CSV, project-edit wordt opgeroepen**: alles werkt, CSV-sectie toont file-picker zoals vandaag. Save zonder CSV mag.
- **Bare `index.html` (geen `?project`)**: totaal ongewijzigd. Geen project-summary kaart, alle velden zichtbaar. Leuk neveneffect: de bestaande pvInverter / btw / keuring / tarief velden blijven werken voor demo/openbare modus.

## Ruwe implementatie-volgorde (ter info — voor plan-skill)

1. `firebase-init.js` helpers + `createProject()` signature + constanten.
2. `project-edit.html` skeleton + auth guard + secties 1 (basisgegevens) + save flow.
3. Sectie 2–7 (leverancier, woning, elektrisch, zekeringkast, omvormers-lijst, voorkeuren).
4. Sectie 8 (CSV re-use uit dashboard).
5. Dashboard modal verwijderen + redirect knop + rij ✏ actie.
6. `index.html` project-summary kaart rendering.
7. `index.html` conditioneel verbergen van form-velden.
8. `index.html` sync-back in `calculate()` flow.
9. CLAUDE.md bijwerken met nieuwe architectuur-secties.

Elk punt is ongeveer één commit.
