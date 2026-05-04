# SmartPeak — Verbeterbacklog

Overzicht van alle verbeterpunten, te behandelen stuk voor stuk.
Status: `[ ]` open · `[~]` bezig · `[x]` klaar

---

## A. JS-extractie & tests (huidige focus)

- [ ] **A1. Calc-engine extraheren uit `index.html`**
      ~1.850 regels inline JS → `assets/js/calc-engine.js`.
      Pure functies: `calcScenario`, `processData`, `capAnalysis`,
      `computePerYearStats`, `averageStats`, schalingsfactor-logica.
- [ ] **A2. Logische tests schrijven voor calc-engine**
      Tests op basis van verwachte output (niet huidige code).
      Focus: dagberekening, jaaraggregatie, worst-case cap, terugverdientijd,
      capaciteitsanalyse, multi-year averaging, extrapolatie < 365 dagen.
- [ ] **A3. Shared helpers extraheren**
      `escapeHtml` (4 kopieën), `showToast` (2 kopieën), datumformattering
      (3 varianten), `shortName`/`shortEmail` → `assets/js/shared-helpers.js`.
- [ ] **A4. Dashboard inline JS verkleinen**
      ~716 regels → pure logica + render-helpers naar eigen bestand.
- [ ] **A5. Project-edit inline JS verkleinen**
      ~1.535 regels → pure logica naar eigen bestand.
      ~540 regels dead code (oude accordion-secties) verwijderen.

## B. Componentisering & hergebruik

- [ ] **B1. Upload-component generaliseren**
      Photo-uploader en CSV-uploader delen hetzelfde patroon:
      drop-zone, bestandsselectie, progress-balk, validatie, feedback.
      Onderzoek een gedeelde `mountUploader(container, opts)` factory
      met pluggable validatie (type/grootte) en opslag-callback.
- [ ] **B2. Spinner/loading-component**
      Loading-state wordt op meerdere plekken ad-hoc getoond
      (config laden, drawer openen, foto uploaden, CSV parsen).
      Eén `showSpinner(container)` / `hideSpinner(container)` helper
      of een CSS-only spinner-class.
- [ ] **B3. Status-chip component**
      Status-chips (badge + kleur + dropdown) worden in dashboard
      lijst, bord, en drawer apart gerenderd. Eén `renderStatusChip(status, opts)`
      met optionele dropdown-picker.
- [ ] **B4. Toast-component consolideren**
      `showToast(msg, variant)` bestaat in 2 kopieën met licht
      verschillende implementaties. Eén versie in shared-helpers.
- [ ] **B5. Form-validatie helpers**
      `showFieldError`/`clearFieldError`/`collectFromForm` patronen
      herhalen zich — kandidaat voor een gedeeld form-utils bestand.

## C. Code-kwaliteit & robuustheid

- [ ] **C1. CSV-parsing hardenen**
      Validatie van datumformaat, kolomnamen, lege rijen.
      Duidelijke foutmeldingen i.p.v. stille failures.
- [ ] **C2. Input-validatie bounds**
      Inverter-kW (0.1–100), tariefprijzen (0–2 €/kWh),
      capaciteit, etc. Vóór Firestore-writes.
- [ ] **C3. Dashboard drawer race condition**
      Guard op `projectId` voordat snapshot-listener de drawer update.
- [ ] **C4. Magic numbers → constanten**
      `365`, `100`, `2.5`, `200`, `6`, `21` → `CALC_CONSTANTS` object.
- [ ] **C5. `renderResults()` opsplitsen**
      304 regels → `renderSummaryCards`, `renderScenarioCard`,
      `renderCapacityAnalysis`, `renderEnergyChart`.

## D. Opruiming

- [ ] **D1. Dead code verwijderen**
      `style.css`, `script.js`, `background.jpg`, `logo.jpg`
      (upstream template restanten).
- [ ] **D2. Dead code in project-edit.html**
      ~540 regels ongebruikte accordion-functies.
- [ ] **D3. Analyse-bestanden opruimen**
      Tijdelijke `*_ANALYSIS.md`, `*_SUMMARY.txt` etc. uit repo root
      verwijderen (waren voor intern onderzoek).

## E. Toekomstig (nice-to-have)

- [ ] **E1. Lint-configuratie toevoegen** (ESLint basis)
- [ ] **E2. Accessibility verbeteren** (ARIA labels, keyboard-nav)
- [ ] **E3. Lazy-load Chart.js** (alleen op calc-pagina)
- [ ] **E4. Pagination in projectlijst** (bij groei > 50 projecten)

---

*Aangemaakt: 2026-05-04 — wordt bijgewerkt naarmate items afgewerkt worden.*
