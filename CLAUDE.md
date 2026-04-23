# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo actually is

A single-page **battery ROI calculator** for the Belgian solar/battery market ("SmartPeak — Batterij ROI Calculator"). UI and copy are in Dutch (`nl-BE`). The README is **leftover from the upstream `cplmakerlab/simple-website-template`** and does NOT describe this app — ignore it for context about the calculator.

The default branch is `gh-pages`; the site is published directly from it via GitHub Pages at `smartpeak-be/battery-roi-tool`. There is no build step, no package manager, no tests, no lint config.

## File layout — what's live vs. dead

- **`index.html`** — the calculator. Four modes:
  - bare (no query) — **redirects to `dashboard.html` immediately** (access-gated via inline script at top of `<body>`); not a public entry point
  - `?s=<id>` — **current** customer share-link, public, no login required. Loads the v:5 payload from Firestore `shares/<id>` and engages read-only mode. Created via `copyShareLink()` which writes the snapshot to Firestore.
  - `?data=<b64>` — **legacy** share-link, still works for any links already sent to customers (base64 in URL, no Firestore read). Same read-only UI treatment as `?s=`.
  - `?project=<id>` — Firebase-backed project mode: auth-gated (Kevin/Ruben whitelist), loads project from Firestore, shows project-banner with status chip, auto-saves `lastCalcRun` on every Bereken. `#results` hash triggers auto-scroll to results.
- **`dashboard.html`** — login-gated workspace voor Kevin & Ruben. Toolbar: zoekveld (filter op projectName+customerName), "Toon afgesloten" checkbox (default uit — verbergt `afgesloten`+`niet_akkoord`), "Toon verwijderde" checkbox, en view-toggle **Lijst / Bord**. Project-lijst (status chips, sort op `updatedAt` desc, `+ Nieuw project` → `project-edit.html?new=1`). Klik op projectnaam opent een **rechter-drawer** met klantcontact (tel:/mailto: links), per-config offerte-status rijen (zie offerte-paragraaf hieronder), situatie/notitie excerpt, **foto-grid** (upload + lightbox met prev/next/delete), opmerkingen-thread (flat, append-only via `projects/{id}/comments` sub-collectie), en actie-knoppen `fa-calculator` Open berekening / `fa-pen-to-square` Bewerk project. Rij-knoppen: `fa-calculator` (als `lastCalcRun`) → `index.html?project=<id>#results`, `fa-pen-to-square` → `project-edit.html?project=<id>`, `fa-trash` → soft delete / `fa-rotate-left` → restore / `fa-circle-xmark` (alleen op soft-deleted rijen) → `hardDeleteProject` (cascade: photos + comments + doc). `fa-comment-dots` pulserend chat-icoon naast projectnaam wanneer de andere gebruiker ongelezen opmerkingen heeft (niet na je eigen posts — `addComment` bumpt poster's eigen `readStates[email]`). `fa-triangle-exclamation` rood warning-icoon per rij + banner in drawer wanneer `lastCalcRun` non-Marstek configs bevat én `cabinet.lineGroundChecked !== true` (verplichte fase↔aarde meting voor Zendure).

**Kanban-bord view (2026-04-20)** — Alternatieve dashboard-view via "🗂 Bord" toggle; keuze in localStorage `smartpeak.dashboardView`. 5 kolommen gemapd op `PROJECT_PHASES` (Nieuw / Bezoek / Offerte / Uitvoering / Afgesloten) die de 16 statussen groeperen via `phaseForStatus()`. Native HTML5 drag-drop: kaart slepen naar kolom → `updateProjectStatus(id, phase.statuses[0])` (eerste status van die fase). Fijnregeling binnen de fase via de status-chip-klik op de kaart (zelfde popover als in lijst-view). Soft-deleted projecten komen niet in het bord; filter "Toon verwijderde" is lijst-only.

**Offerte PDF upload per config (2026-04-21, vereenvoudigd 2026-04-23)** — Gedeelde UI in `assets/js/offertes-ui.js`: `renderOffertesCards(project)` + `renderOffertesSection(project)` (section-wrapped variant voor de drawer), `wireOffertesClicks(containerEl, getProjectFn, onChange)` voor delegated click-handling, en `openOfferteModal/closeOfferteModal/ensureOfferteModal` voor het upload-modal. Gebruikt door `dashboard.html` (drawer) én `project-edit.html` (eigen blok onderaan). Upload-modal drag-drop, max 10 MB, PDF-only. Opslag: `project.offertes: { [configType]: { storagePath, filename, sizeBytes, contentType, uploadedAt, uploadedBy } }` top-level op het project-doc, blobs in Storage onder `projects/{id}/offertes/{configType}_{ts}.pdf` (dekt door bestaande `/projects/{id}/{allPaths=**}` Storage rule).

Per-config actions:
- **Geen PDF**: `fa-upload` = open modal · `fa-trash` = **config verwijderen** (cascade: uit `selectedConfigTypes` én `offertes[type]` + Storage blob).
- **Met PDF**: `fa-download` · `fa-pen-to-square` vervang · `fa-file-circle-xmark` = alleen PDF wissen (config blijft) · `fa-trash` = **config verwijderen incl. PDF** (cascade).

Delete-lifecycle (herzien 2026-04-23): één actie, overal cascade.
- Drawer / project-edit `fa-trash` → `deleteProjectConfig(id, type)` → Firestore + Storage in één call.
- Calc-view: wanneer de gebruiker een type uit de picker haalt en Bereken drukt, detecteert `_confirmConfigCascade` of de verwijderde types een PDF hebben en toont een confirm-dialog. Op OK → `saveLastCalcRun` schrijft de nieuwe `selectedConfigTypes` én ruimt automatisch alle `offertes[t]` + Storage blobs op voor types die niet meer in de set zitten. Op Cancel → Bereken wordt afgebroken, geen save.
- Read-only share-links hebben geen delete-UI.

Re-upload overschrijft de vorige blob atomair (nieuwe blob upload → Firestore swap → oude blob delete). `fa-triangle-exclamation` oranje warning-banner in drawer (en in project-edit) + parallel icoon in dashboard-rij/board-kaart wanneer `needsOfferteWarning(project)` true is (predicate: "enige selected type zonder PDF"). Helpers in `firebase-init.js`: `uploadProjectOfferte`, `deleteProjectOfferte` (PDF-only delete), `deleteProjectConfig` (cascade delete), `needsOfferteWarning`. `mergeProjectMetadata` defaultet `offertes: {}`. Het veld `dismissedConfigs` op oude project-docs is legacy en wordt genegeerd — geen migratie nodig. Calculator (`index.html`) blijft pure berekening + project-mode save; share-links (`?s=`/`?data=`) tonen automatisch geen offertes want `_serializeState` kent de velden niet.

**Font Awesome 6 (2026-04-21)** — Alle UI-iconen in `dashboard.html`, `project-edit.html`, `index.html` gebruiken FA 6.5.2 Free via cdnjs (`<i class="fa-solid fa-...">`). Kleurhelpers (global in alle 3 files): `.icon-ok` groen `#16a34a`, `.icon-warn` oranje `#f59e0b`, `.icon-danger` rood `#dc2626`. Emoji's blijven alleen nog in toast-messages, `statusEl.textContent`-strings en badge-labels (copy, niet UI-icoon). Warning driehoek `fa-triangle-exclamation` wordt gedeeld tussen ground-fault (rood) en offerte-missing (oranje) — verschil enkel kleur + tooltip.
- **`project-edit.html`** — nieuw-project creatie + bestaande-project metadata
  bewerken. Auth-gated. **4 blokken** (was 11 accordion-secties, herzien
  2026-04-22):
  - **Blok A · "Voor de berekening"** — altijd open bovenaan: klantnaam (required),
    projectnaam (optioneel), woning-leeftijd-radio (bepaalt BTW), tarief-type +
    prijs dag/nacht, totaal omvormer-kW (smart: single input als 0-1 omvormers,
    readonly sum + deeplink naar Blok C als 2+), CSV upload, en een
    disclosure `Extra opties` voor BTW-override/keuring/leverancier-naam.
  - **Blok B · "Klant & situatie"** — status, adres, telefoon, e-mail,
    situatie-notitie, vrij notitieveld. Collapsible (voorkeur in
    `localStorage.smartpeak.editCardCollapsed`).
  - **Blok C · "Technische opmeting"** — aansluitingstype + zekering A,
    zekeringkast (modules/rem-automaat/wifi/stopcontact/batterij-plaats/fase-aarde),
    dynamische omvormer-detail-lijst (merk/model/panelen/kringen/ligging).
    Collapsible. Wijzigingen aan omvormer-`powerKw` triggeren `rerenderBlokA()`
    zodat het "Totaal kW"-veld in Blok A live meegaat.
  - **Blok D · "Foto's & serienummers"** — één gedeelde foto-uploader
    component (`assets/js/photo-uploader.js`) voor plaatsbezoek- én
    serienummer-foto's, gevolgd door een dynamische serienummer-lijst met
    enkel tekstvelden + delete (per-serial camera-knop is gepensioneerd —
    alle foto's gaan in de gedeelde pool). Zie ook `dashboard.html`
    drawer die hetzelfde component mount.
  - **Sticky action bar** onderaan (Bootstrap `fixed-bottom navbar`): "Opslaan &
    Bereken" is **disabled** tot alle 5 calc-vereisten vervuld zijn (klantnaam,
    omvormer-kW > 0, BTW bepaalbaar, prijs dag > 0 (+ nacht als dual-tariff),
    CSV aanwezig); `title`-tooltip lijst wat mist. "Opslaan" alleen is altijd
    actief (partial saves blijven toegelaten).
  - Responsive grid: op `≥ lg` staan Blok B en C naast elkaar (2 col); op `< lg`
    alles gestapeld.
- **`assets/js/csv.js`** — CSV parsing helpers (`parseCSV`, `parseDate`, `parsVolume`, `extractCsvForStorage`) used by `index.html`, `dashboard.html` en `project-edit.html`.
- **`assets/js/firebase-init.js`** — Firebase init (compat SDK 10.13.2 via CDN, no build step), auth helpers (Google sign-in + email whitelist), Firestore CRUD (`projects` collection), `PROJECT_STATUSES` enum + `getStatusMeta()`. Contains `FIREBASE_CONFIG_PLACEHOLDER` and `RUBEN_EMAIL_PLACEHOLDER` sentinels — must be replaced with real values before deploy. Config object is public-by-design (security rules enforce access).
- **`background.jpg`, `logo.jpg`** — assets referenced by the dead template, not by the calculator. Safe to leave alone.
- **`style.css`, `script.js`** — **dead code from the upstream template** (jQuery hash-based menu navigation). The calculator does not load them. Don't add app logic here; either edit `index.html` directly or extract into a new file and `<link>`/`<script src>` it from `index.html`.
- **`docs/superpowers/specs/`, `docs/superpowers/plans/`** — design specs and implementation plans for past feature work, kept for traceability. Read the spec when touching a feature it covers; the plan documents the exact edits already made.

## Styling stack (2026-04-22 migration)

The three backoffice pages (`dashboard.html`, `project-edit.html`, `producten.html`)
use **Bootstrap 5.3.3** as the primary layout/component system, loaded via
cdnjs CDN (no build step). All SmartPeak brand overrides and app-specific
components live in **`assets/css/smartpeak.css`** — this is the single CSS
source of truth for the backoffice.

- Bootstrap CSS loads first, then `smartpeak.css` (which contains
  `--bs-primary: #2c7be5`, `--bs-border-radius: 12px`, and other brand tokens).
- Inline `<style>` blocks in the three HTML files contain only page-specific
  one-offs; anything shared lives in `smartpeak.css`.
- `bootstrap.bundle.min.js` (at the end of each `<body>`, before the inline
  script) provides Offcanvas, Modal, Dropdown, Toast, Accordion, Carousel,
  Collapse. Instantiate via `bootstrap.X.getOrCreateInstance(el)` or rely on
  `data-bs-toggle` attributes.
- `index.html` (calculator) is OUT of scope for this migration and keeps its
  own embedded styling.
- Font Awesome 6.5.2 remains the icon library (FA was migrated separately on
  2026-04-21); we do NOT use Bootstrap Icons.

**Component conventions:**
- Project-drawer → `.offcanvas.offcanvas-end` with ID `#drawer`
- Offerte-modal → `.modal.fade` with ID `#offerteModal`
- Status chip → `.badge.status-chip` (inline-style color from `getStatusMeta()`)
  inside a `.dropdown` for pick-to-change
- Toast feedback → `.toast-container` with `showToast(msg, variant)` helper
  (variants: `success` / `danger` / `warning` / `primary`)
- Kanban board, lightbox, photo-grid, drop-zone → app-specific CSS in
  `smartpeak.css` (no Bootstrap equivalents)
- Accordion sections in `project-edit.html` → no `data-bs-parent` (multiple
  sections open simultaneously for long-form UX)
- Form validation → `.is-invalid` + `.invalid-feedback` via `showFieldError(id, msg)`
  / `clearFieldError(id)` helpers; `collectFromForm()` throws errors with a
  `.fieldErrors` map so the save flow can highlight per-field + `scrollIntoView`
  the first invalid field
- Photo upload progress → Bootstrap `.progress` + `.progress-bar` (width %)

**Responsive breakpoints (hard-coded gates):**
- `< md` (< 768px): hamburger navbar, minimal table columns, full-width offcanvas
- `md – lg` (768–991px): tablets portrait, view-toggle still hidden
- `≥ lg` (≥ 992px): kanban-toggle visible (JS force-downgrades to list view
  under this threshold via `currentView()` + `resize` listener), 420px offcanvas

**SRI hashes for Bootstrap 5.3.3 (cdnjs):**
- CSS: `sha512-jnSuA4Ss2PkkikSOLtYs8BlYIeeIK1h99ty4YfvRPAlzr377vr3CXDb7sb7eEEBYjDtcYj+AjBH3FLv5uSJuXg==`
- JS:  `sha512-7Pi/otdlbbCR+LnW+F7PwFcSDJOuUJB3OxtEHbg4vSMvzvJjde4Po1v4BR9Gdc9aXNUNFVUY+SK51wWT8WF0Gg==`

## Shared photo-uploader component (2026-04-23)

`assets/js/photo-uploader.js` bevat één `mountPhotoUploader(containerEl, opts)`
factory die het volledige foto-systeem rendert: camera + gallery + drop-zone,
progress-balk, foto-grid met tag-indicator, lightbox, en after-upload
tag-modal. Gebruikt in `dashboard.html` drawer (`#drawerPhotoUploader`) en
`project-edit.html` Blok D (`#peBlokDPhotoUploader`). Meerdere instanties op
dezelfde page zijn safe — alle state is scoped aan de container.

**Twee image-versies per foto** — client-side canvas genereert bij upload een
thumbnail van max 400 px langste zijde (JPEG q=0.82). Full-versie gaat naar
`projects/{id}/{ts}_{name}`, thumb naar `projects/{id}/{ts}_{name}_thumb.jpg`.
Firestore photo-doc krijgt `thumbStoragePath`, `width`, `height`, `tag`
('situatie' | 'serial'). Grid-views laden thumbs, lightbox laadt full.

**Tag-modal** opent automatisch na elke upload (bulk of 1); default is
`situatie`, met `Alles → Situatie` / `Alles → Serieel` bulk-knoppen. Save via
Firestore `WriteBatch`. Cancel behoudt de defaults, geen dataverlies.

**Lazy backfill** — photos zonder `thumbStoragePath` (pre-2026-04-23) genereren
bij het eerste render een thumb via `backfillThumbnail()` en patchen het
Firestore doc. Throttled op één tegelijk per component-instance; fail-soft
(console.warn, grid blijft full-URL tonen).

**Retired** — `uploadProjectSerialPhoto` / `getSerialPhotoUrl` en de
`photoStoragePath` op `serialNumbers[]` entries zijn legacy-data. De UI-knoppen
`fa-camera` / `fa-eye` per serial-rij zijn verwijderd; serial-rijen hebben nu
enkel een tekstveld + delete. De oude `uploadProjectPhoto` is ook verwijderd.

## How to work on it

- **Run locally:** open `index.html` directly in a browser, or `python3 -m http.server` from the repo root and visit `http://localhost:8000`. A local server is needed if you want the URL `?data=...` share-link flow to behave like production.
- **Deploy:** push to `gh-pages`. GitHub Pages serves the file as-is; allow ~1 min for the CDN to refresh. The `gh` CLI is configured for the `Blox-It` GitHub account; `git push origin gh-pages` works directly without further auth setup.
- **No tests exist.** Verify changes by loading the page, uploading a real Fluvius CSV, and walking the full flow (load configs → calculate → check results, share link, JSON save/load).

## Architecture (the parts that span multiple sections)

**Data pipeline** (all inside `index.html`):
1. `parseCSV` — Fluvius export is **semicolon-separated**, dates are `dd-mm-yyyy`, decimals use `,` (handled by `parsVolume`).
2. `processData` aggregates per-day from rows keyed by `EAN-code` / `Register` (`afname`/`injectie`, optional `dag`/`nacht` split for dual-tariff users). Each per-day record has `afname`, `injectie`, `afnamedag`, `afnamenacht`, `injectiedag`, `injectienacht` (in kWh).
3. A **rolling 365-day window** ending on the last CSV date is the canonical period. If less than a year of data, results are **extrapolated** via `scaleFactor = 365 / daysInWindow` and `isFullYear = false` triggers warning UI.
4. **Multi-year averaging:** when ≥ 2 complete 365-day blocks of data exist, `computePerYearStats` slices `allDays` into N year-blocks counting backward from `lastDate` and `averageStats` produces an avg-across-N-years counterpart for every numeric field. The renderer shows a `· gem. N j: …` companion (via the `renderWithAvg` helper) and a `▼` marker on progress bars at the avg position. All gated on `numYears >= 2`; the < 2-year UI is byte-identical to the single-year case.
5. **Per-config scenarios — always two cards.** For every config the renderer emits both Worst Case (`scenWC`) and Optimistisch (`scenOpt`):
   - **Worst Case** uses the `useCap=true` path in `calcScenario` / inner `calc`: each day's stored energy is capped at that day's `d.afname` (`Math.min(dayCharged, d.afname)`) so battery savings can never exceed actual grid consumption that day. When `pvInverter > batteryInverter`, the daily-injection threshold is also scaled up by `pvInv / batInv` (battery can't fully charge in a single day at low irradiance).
   - **Optimistisch** uses `useCap=false` and the unscaled threshold — the ideal-world ceiling.
   - The truth lies between the two; the salesperson presents the spread.
6. Capacity analysis (`capAnalysis`) sweeps 2.5→200 kWh in 2.5 kWh steps and reports the largest capacity that still has ≥100 fully-charged days/year — used as the "max sensible capacity" recommendation. The MAX flag is always driven by Year 1 (afgelopen jaar), not the multi-year average.

**Product config source** — `loadConfigs()` fetches a Google Sheet as CSV from a hard-coded URL (`SHEET_CSV_URL` around line 769, gid `425908603`). Each row defines a product (`type`, capacity, inverter kW, efficiency, and four price columns keyed by `BTW%_keuring`: `6_no`, `6_yes`, `21_no`, `21_yes`). If the sheet schema changes (column names or price keys), `_parseSheetConfigs` and `_getPriceKey` must be updated together.

**Project-niveau metadata (2026-04-20 uitbreiding)** — Het Firestore `projects` document heeft 6 extra top-level secties bovenop Phase 1: `site` (leeftijd woning → BTW afleiding), `electrical` (aansluitingstype, zekering A), `cabinet` (vrije modules, rem-automaat, wifi/stopcontact bereik, plaats voor batterijen), `solar.inverters[]` (per-omvormer: powerKw vereist + optionele merk/model/panelen/kringen/ligging), `supplier` (naam, isSingleTariff, priceDay/priceNight), `calcDefaults` (btw, keuring voorkeur). Pure helpers in `assets/js/firebase-init.js`: `newEmptyProjectMetadata()`, `mergeProjectMetadata(project)` (defaults voor oude projects), `effectiveBtwFor(project)` (houseAgeOver10Years → 6/21, anders calcDefaults.btw), `totalInverterPowerKw(project)` (som). Readers merge altijd via `mergeProjectMetadata` — pre-2026-04-20 projects behave als volledig-leeg.

**Project-label fallback (2026-04-22)** — `getProjectLabel(project)` in
`firebase-init.js` geeft `projectName || customerName || '(zonder naam)'`.
Alle UI-plekken (dashboard lijst/bord/drawer, project-edit page title,
index.html project-banner) gebruiken deze helper. `customerName` is nu het
enige harde-required tekstveld bij project-creatie; `projectName` is optioneel
en fungeert als override-label wanneer meerdere projecten voor dezelfde klant
bestaan.

**Serienummers (2026-04-22)** — `project.serialNumbers: Array<{id, value,
photoStoragePath?, uploadedAt?, uploadedBy?}>` top-level op het project-doc.
Helpers in `firebase-init.js`: `addProjectSerial`, `updateProjectSerial`,
`deleteProjectSerial`, `uploadProjectSerialPhoto`, `getSerialPhotoUrl`,
`_genSerialId`. Blobs in Storage onder
`projects/{id}/serials/{serialId}_{ts}.jpg` (gedekt door bestaande
`/projects/{id}/{allPaths=**}` rule). Barcode/OCR is out-of-scope; follow-up
spec na deze iteratie.

**Index.html project-mode source-of-truth** — Wanneer `?project=<id>` gebruikt is toont de pagina een dichtgeklapte "Projectgegevens" kaart (`#projectValuesCard`) met `✏ Aanpassen` knop die naar `project-edit.html?project=<id>` redirect. Formuliervelden waarvoor het project een waarde heeft worden verborgen via `applyProjectToCalcForm` (source-of-truth = project); velden zonder projectwaarde blijven zichtbaar als fallback. Keuring is een uitzondering: altijd zichtbaar, default-value komt uit project, wijzigt men de waarde dan wordt ze bij Bereken teruggeschreven. Bij Bereken roept `saveProjectCalcRun` eerst `buildProjectSyncPatch()` aan om alle fallback-ingevulde waarden naar het project doc te persisten (via `updateProjectMetadata`) vóór `saveLastCalcRun` aangeroepen wordt. Bij ontbrekende vereiste velden opent de summary-kaart automatisch met een waarschuwing.

**Access model (2026-04-20)** — Drie access-tiers:
1. **Bare `index.html`** is geen publieke entry. Top-of-body inline redirect naar `dashboard.html`. Kevin/Ruben komen altijd via dashboard of project-link binnen.
2. **Product-sheet URL** leeft in Firestore `config/products.csvUrl` (niet meer hardcoded). Security rule: `allow read: if isWhitelisted()`, `allow write: if false`. `getProductsConfig()` in `firebase-init.js` haalt het op; `loadConfigs()` gebruikt dat in plaats van een constante. Zonder login → `loadConfigs` faalt → geen berekening mogelijk zelfs als je de redirect omzeilt.
3. **Share-links** zijn klant-facing en activeren `body.readonly-mode` via `engageReadOnly()` na `_applyLoadedState`. CSS hide't Bereken, "Configuraties laden", "Kopieer deellink" en de share-URL row; inputs worden grijs met `pointer-events:none`. Resultaten blijven volledig leesbaar. Twee varianten:
   - `?s=<id>` — huidige variant: `createShare(payload, projectId)` schrijft het volledige v:5 snapshot (inputs + results + dailyCompact) naar Firestore `shares/<autoId>`. `getShare(id)` haalt het terug. Security rules: read = `true` (publiek), create/delete = `isWhitelisted()`, update = `false`. URL blijft kort ongeacht dataset-grootte.
   - `?data=<b64>` — legacy variant: base64 payload in URL. Nog ondersteund voor links die al in omloop zijn; wordt niet meer gegenereerd.

**Save / share state** — same v:5 mechanism powers BOTH the legacy `?data=<b64>` share-links AND the Firestore project-mode storage. In project-mode, `csvUpload.dailyCompact` lives at the top level of the project doc (not inside `results`) to avoid duplicating per-day arrays. The restore-path in `index.html` (`buildSavedFromProject`) reassembles a v:5-shaped object from the project document so the existing `_applyLoadedState` flow can hydrate the UI unchanged. `_serializeState` produces a versioned (`v: 5`) JSON of inputs + computed results (NOT the raw CSV). v:5 adds a `dailyCompact` field (6 parallel arrays — `afname`, `injectie`, `afnamedag`, `afnamenacht`, `injectiedag`, `injectienacht` — plus a `startDate`) so per-day data is preserved across share-links — needed by the energy chart's Dag-view. `copyShareLink` base64-encodes it into `?data=...`; `downloadSave` writes it as a JSON file. `_applyLoadedState` accepts `v: 1, 2, 3, 4, 5` and degrades older versions gracefully (e.g. v:1-4 saves have no per-day data → the energy chart's Dag-view is disabled with a tooltip and Jaar/Maand are derived from `monthMap`). **When you change the shape of `_saved`/`renderResults` input**, bump the version and handle the old version in `_applyLoadedState`, or shared links and downloaded JSONs from before will silently break.

**Rendering** — `renderResults` is the single render entry point used by both fresh calculations and restored saved state; keep it pure with respect to `d` so both paths produce identical UI. The scenario card (`makeScenCard`) shows four headline rows + a closed-by-default `<details class="scen-details">` disclosure containing the 7 breakdown rows + two recovery progress bars at the bottom (each with a `▼` avg marker when `numYears >= 2`).

**Config-picker dynamics (2026-04-20 polish)** — Product-configuratie dropdowns leven binnen `#configPickerList` en worden volledig door JS gegenereerd. `renderConfigPickers(selectedTypes)` toont altijd `N+1` `<select class="config-select">` elementen waar N = aantal gekozen types; de trailing picker is altijd leeg zodat de user er één kan toevoegen. `readSelectedConfigs()` leest de huidige selectie in DOM-volgorde. Already-picked types worden `disabled` gezet in de andere pickers via `_buildConfigOptionsHtml`. De save-payload (`selectedConfigTypes: string[]` in v:5) is lengte-agnostisch — geen schema-bump nodig. `_populateConfigSelects` blijft als shim bestaan omdat `_applyLoadedState` die nog aanroept tijdens restore. Dashboard's `fa-calculator` rij-knop (alleen getoond als `p.lastCalcRun`) navigeert naar `index.html?project=<id>#results` — bij aankomst scrollt de index automatisch naar de eerste zichtbare `.card` in `#results`.
