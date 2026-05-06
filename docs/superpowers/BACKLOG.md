# SmartPeak — Verbeterbacklog

Overzicht van alle verbeterpunten, te behandelen stuk voor stuk.
Status: `[ ]` open · `[~]` bezig · `[x]` klaar

---

## A. JS-extractie & tests (huidige focus)

- [x] **A1. Calc-engine extraheren uit `index.html`**
      ~1.850 regels inline JS → `assets/js/calc-engine.js`.
      Pure functies: `calcScenario`, `processData`, `capAnalysis`,
      `computePerYearStats`, `averageStats`, schalingsfactor-logica.
- [x] **A2. Logische tests schrijven voor calc-engine**
      47 Vitest tests (calc-engine: 22, csv: 15, shared-helpers: 10).
      13 E2E Playwright tests (project-crud, calculator, dashboard-ui).
- [x] **A3. Shared helpers extraheren**
      `escapeHtml`, `showToast`, datumformattering, `shortEmail`
      → `assets/js/shared-helpers.js`. Geïmporteerd door alle 3 HTML-bestanden.
- [ ] **A4. Dashboard inline JS verkleinen**
      ~664 regels → pagina-specifieke orchestratie, acceptabel voor nu.
- [x] **A5. Project-edit inline JS verkleinen**
      ~504 regels dead accordion-code verwijderd.
      File van 1.592 → 1.088 regels.

## B. Componentisering & hergebruik

- [x] **B1. Upload-component generaliseren**
      `mountPhotoUploader(containerEl, opts)` factory in
      `assets/js/photo-uploader.js`. Gebruikt in dashboard drawer + project-edit.
- [x] **B2. Spinner/loading-component**
      Globale overlay spinner in `shared-helpers.js`:
      `showSpinner(opts)`, `updateSpinner(opts)`, `hideSpinner()`, `withSpinner(fn)`.
      CSS in `smartpeak.css` + inline in `index.html`.
      Geïntegreerd in alle 5 bestanden (dashboard, project-edit, index,
      photo-uploader, offertes-ui). Foto-uploads tonen voortgangsbalk
      met "X van Y geüpload".
- [x] **B3. Status-chip component**
      `statusChipHTML(statusKey, projectId)` en `wireStatusChipClicks(el, onChange)`
      geëxtraheerd naar `assets/js/status-chip.js`. Gebruikt door dashboard
      lijst, bord, en drawer via één gedeeld bestand.
- [x] **B4. Toast-component consolideren**
      Backoffice: `showToast` in `shared-helpers.js` (Bootstrap 5 toast).
      Calculator: eigen lichtgewicht `showToast` (geen Bootstrap, eigen #toast).
- [ ] **B5. Form-validatie helpers**
      `showFieldError`/`clearFieldError`/`collectFromForm` patronen
      herhalen zich — kandidaat voor een gedeeld form-utils bestand.

## C. Code-kwaliteit & robuustheid

- [x] **C1. CSV-parsing hardenen**
      `validateCsvHeaders()` controleert verplichte Fluvius kolommen
      (Van (datum), Register, Volume). `parseDate()` retourneert `null`
      i.p.v. NaN Date bij ongeldige input. `extractCsvForStorage()` en
      `csvToAllDaysAndMeta()` skippen rijen met ongeldige datums en
      geven duidelijke Nederlandse foutmeldingen. 17 nieuwe unit tests.
- [ ] **C2. Input-validatie bounds**
      Inverter-kW (0.1–100), tariefprijzen (0–2 €/kWh),
      capaciteit, etc. Vóór Firestore-writes.
- [x] **C3. Dashboard drawer race condition**
      Stale-guard patroon in `openDrawer()`, `_refreshCurrentDrawer()`,
      en null-guard in `refreshDrawerAfterChange()`. Na elke `await`
      wordt `_drawerProjectId` vergeleken met het captured ID; bij
      mismatch wordt de stale response weggegooid.
- [x] **C4. Magic numbers → constanten**
      `100`, `2.5`, `200` → `CALC_CONSTANTS` in `calc-engine.js`.
- [ ] **C5. `renderResults()` opsplitsen**
      304 regels → `renderSummaryCards`, `renderScenarioCard`,
      `renderCapacityAnalysis`, `renderEnergyChart`.

## D. Opruiming

- [x] **D1. Dead code verwijderen**
      `style.css`, `script.js`, `background.jpg`, `logo.jpg` verwijderd.
- [x] **D2. Dead code in project-edit.html**
      ~504 regels ongebruikte accordion-functies verwijderd (zie A5).
- [x] **D3. Analyse-bestanden opruimen**
      Geen analyse-bestanden in repo root aangetroffen.

## E. Toekomstig (nice-to-have)

- [ ] **E1. Lint-configuratie toevoegen** (ESLint basis)
- [ ] **E2. Accessibility verbeteren** (ARIA labels, keyboard-nav)
- [ ] **E3. Lazy-load Chart.js** (alleen op calc-pagina)
- [ ] **E4. Pagination in projectlijst** (bij groei > 50 projecten)

---

*Aangemaakt: 2026-05-04 — wordt bijgewerkt naarmate items afgewerkt worden.*
