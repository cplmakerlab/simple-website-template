# Backoffice Bootstrap-migratie — design

**Datum:** 2026-04-22
**Scope:** `dashboard.html`, `project-edit.html`, `producten.html`
**Buiten scope:** `index.html` (calculator) — blijft ongewijzigd tot eigen ronde

## Doel

De drie backoffice-pagina's overzetten naar Bootstrap 5.3 als primair layout- en
component-systeem. Mobile-first, volledig responsive. De SmartPeak-huisstijl
(`#2c7be5` primair blauw, radius `12px`, Segoe UI font) blijft zichtbaar
bovenop Bootstrap; de functionaliteit blijft 1-op-1 behouden.

## Non-goals

- Geen wijzigingen aan `index.html`, aan de Firestore-schema's of aan de JS-logica
  rond berekeningen, auth, of Firestore-CRUD.
- Geen build-step, geen bundler, geen npm-package. Bootstrap wordt via CDN
  geladen net zoals Firebase en FontAwesome nu.
- Geen bump van Font Awesome → Bootstrap Icons. FA 6.5.2 blijft staan.
- Geen wijziging aan security rules, share-link-mechanisme, of offerte-flow.

## Architectuur & stack

### Inclusion-pattern (per HTML-file)

In `<head>`, direct na de bestaande Font-Awesome link, vóór de inline `<style>`:

```html
<link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/css/bootstrap.min.css"
      rel="stylesheet" integrity="sha512-…" crossorigin="anonymous" referrerpolicy="no-referrer">
<link href="assets/css/smartpeak.css" rel="stylesheet">
```

Aan het einde van `<body>`, vóór de bestaande inline `<script>`:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js"
        integrity="sha512-…" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
```

`bootstrap.bundle.min.js` bevat Popper (nodig voor Dropdown, Tooltip, Popover).

### Nieuw bestand: `assets/css/smartpeak.css`

Enige CSS-file die het project schrijft. Drie verantwoordelijkheden:

**(a) Custom-property overrides** — Bootstrap 5.3 is volledig CSS-variables gedreven:

```css
:root {
  --bs-primary: #2c7be5;
  --bs-primary-rgb: 44, 123, 229;
  --bs-link-color: #1e5fb8;
  --bs-link-hover-color: #1a3a6e;
  --bs-border-radius: 12px;
  --bs-border-radius-sm: 8px;
  --bs-border-radius-lg: 16px;
  --bs-body-bg: #f0f4fb;
  --bs-body-color: #1e2a3a;
  --bs-border-color: #dce3f0;
  --bs-font-sans-serif: 'Segoe UI', system-ui, -apple-system, sans-serif;
  /* semantic brand tokens gebruikt door custom components */
  --sp-muted: #6b7a99;
  --sp-success: #00b478;
  --sp-warning: #f6a623;
  --sp-danger: #e54545;
}
```

**(b) Fixes voor SCSS-afgeleide component-tokens die niet via `--bs-primary` uitlopen:**

```css
.btn-primary {
  --bs-btn-hover-bg: #1a5fba;
  --bs-btn-hover-border-color: #1a5fba;
  --bs-btn-active-bg: #164d97;
  --bs-btn-active-border-color: #164d97;
}
```

**(c) App-specifieke componenten die Bootstrap niet heeft** — kanban-kolommen
en -kaarten, kanban drag-ghosts, lightbox-controls, photo-grid, chat-pulse-animatie,
icon-kleurhelpers (`.icon-ok`, `.icon-warn`, `.icon-danger`), readonly-mode
overrides. Geschat ~150–200 regels totaal.

De `<style>`-blocks in de drie HTML-files worden volledig leeggetrokken; alleen
page-specifieke one-offs (als die nodig zijn) blijven inline.

## Layout: `dashboard.html`

### Globale structuur

```
<body class="bg-body">
  <nav.navbar.navbar-expand-lg.bg-white.border-bottom.sticky-top>
    <div.container-fluid>
      <a.navbar-brand> SmartPeak · Projecten
      <button.navbar-toggler data-bs-toggle=collapse>
      <div.collapse.navbar-collapse>
        <ul.navbar-nav.ms-auto>
          <li.nav-item> "Hallo, Kevin"
          <li.nav-item> [Uitloggen] (btn-outline-secondary)

  <main.container-fluid.py-3>
    <!-- state: logged-out -->
    <div.card.mx-auto.mt-5 style="max-width:480px">…</div>

    <!-- state: not-whitelisted -->
    <div.card.mx-auto.mt-5>…</div>

    <!-- state: authorized -->
    <div class="card mb-3">
      <div class="card-body">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-auto">
            <button class="btn btn-primary"><i class="fa-solid fa-plus"></i> Nieuw project</button>
          </div>
          <div class="col-12 col-md">
            <div class="input-group">
              <span class="input-group-text"><i class="fa-solid fa-magnifying-glass"></i></span>
              <input id="projectSearch" type="search" class="form-control" placeholder="Zoek projectnaam of klant…">
            </div>
          </div>
          <div class="col-6 col-md-auto">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="toggleShowFinished">
              <label class="form-check-label" for="toggleShowFinished">Toon afgesloten</label>
            </div>
          </div>
          <div class="col-6 col-md-auto">
            <div class="form-check form-switch">…toggleShowDeleted…</div>
          </div>
          <div class="col-12 col-lg-auto d-none d-lg-block">
            <div class="btn-group" role="group" id="viewToggle">
              <button type="button" class="btn btn-outline-primary active" data-view="list">
                <i class="fa-solid fa-list"></i> Lijst
              </button>
              <button type="button" class="btn btn-outline-primary" data-view="board">
                <i class="fa-solid fa-columns"></i> Bord
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body p-0 p-md-3" id="projectList">
        <!-- tabel OF kanban-bord -->
      </div>
    </div>
  </main>

  <!-- Offcanvas drawer -->
  <div class="offcanvas offcanvas-end" tabindex="-1" id="drawer">
    <div class="offcanvas-header border-bottom" id="drawerHeader"></div>
    <div class="offcanvas-body" id="drawerBody"></div>
  </div>

  <!-- (breedte via smartpeak.css: default 420px op ≥ md, 100vw op < md) -->

  <!-- Modal offerte upload -->
  <div class="modal fade" id="offerteModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="offerteModalTitle">Offerte uploaden</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" id="offerteModalBody"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Annuleren</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast-container voor feedback -->
  <div class="toast-container position-fixed bottom-0 end-0 p-3" id="toastContainer"></div>
</body>
```

### Lijst-tabel

`.table.table-hover.align-middle` binnen `.table-responsive` (voor horizontale
scroll op zeer smalle schermen als fallback). Kolom-zichtbaarheid per breakpoint:

| Kolom | xs (<576) | sm (≥576) | md (≥768) | lg (≥992) |
|---|:-:|:-:|:-:|:-:|
| Projectnaam (+ chat/warn/offerte-warn icons) | ✅ | ✅ | ✅ | ✅ |
| Klant | ✅ | ✅ | ✅ | ✅ |
| Status-chip | ✅ | ✅ | ✅ | ✅ |
| Laatst gewijzigd | — | ✅ | ✅ | ✅ |
| Laatste berekening | — | — | ✅ | ✅ |
| Acties (calc/edit/trash) | ✅ | ✅ | ✅ | ✅ |

Geïmplementeerd met `<th class="d-none d-sm-table-cell">` en
`<td class="d-none d-md-table-cell">` enz.

### Kanban-bord (alleen ≥ lg)

Blijft custom drag-drop, maar HTML-styling via Bootstrap:

- Container: `.row.row-cols-5.g-2.flex-nowrap.overflow-x-auto` (fallback:
  horizontale scroll als viewport < 1000px ondanks `lg`-gate).
- Kolom: `.card.bg-body-secondary` met `.card-header` (titel + badge-count) en
  `.card-body` die kaarten bevat.
- Kaart: `.card.shadow-sm.mb-2` met klikbare titel (`.card-title`), klant
  (`.text-muted.small`) en een footer met status-dropdown.

**View-gating (hard):** `window.innerWidth < 992` forceert `listView` en negeert
`localStorage.smartpeak.dashboardView === 'board'`. `resize`-listener schakelt
automatisch terug bij shrinken; bij vergroten blijft de laatst gekozen view.

### Status-chip-dropdown (per rij/kaart)

Chip HTML:

```html
<button type="button" class="badge rounded-pill border-0"
        style="background:#00b478;color:#fff;cursor:pointer"
        data-bs-toggle="dropdown" aria-expanded="false">
  Nieuw <i class="fa-solid fa-caret-down ms-1"></i>
</button>
<ul class="dropdown-menu">
  <li><button class="dropdown-item" data-status="nieuw">
    <span class="status-dot" style="background:#00b478"></span> Nieuw
  </button></li>
  ...
</ul>
```

Bootstrap regelt open/close, keyboard-nav en outside-click. De huidige
`openStatusPopover`/`closeStatusPopover` functies vervallen; één helper
`handleStatusPick(projectId, statusKey)` blijft.

### Offcanvas-drawer (projectdetail)

- Bootstrap `Offcanvas`-instance per rij: `bootstrap.Offcanvas.getOrCreateInstance(el).show()`.
- Sections binnen `.offcanvas-body`: contact, configs/offertes, situatie, notities,
  foto's, opmerkingen, acties — allemaal `.border-bottom.pb-3.mb-3`.
- Foto-grid: bestaande `.photo-grid` CSS in `smartpeak.css`.
- Opmerkingen-composer: `.input-group` met `<textarea class="form-control">` +
  `<button class="btn btn-primary">`.
- Actieknoppen: `.d-grid.gap-2` stack op mobile, `.d-md-flex.gap-2` op desktop.

### Toasts (vervangt `statusEl.textContent`)

Helper `showToast(message, {variant})`: genereert `.toast.text-bg-{variant}` in
`#toastContainer`, auto-hide na 4s. `variant` = `success`|`danger`|`warning`|`primary`.

## Layout: `project-edit.html`

### Globale structuur

```
<body class="bg-body pb-5">
  <nav.navbar.navbar-expand-lg.bg-white.border-bottom.sticky-top>
    <!-- zelfde patroon als dashboard -->
  </nav>

  <main class="container-fluid py-3">
    <div class="accordion" id="projectEditAccordion">
      <!-- × 11 accordion-items -->
    </div>
  </main>

  <!-- Sticky action-bar -->
  <nav class="navbar fixed-bottom bg-white border-top shadow-sm">
    <div class="container-fluid justify-content-end gap-2 flex-wrap">
      <button class="btn btn-outline-secondary flex-grow-1 flex-md-grow-0" id="btnCancel">Annuleren</button>
      <button class="btn btn-primary flex-grow-1 flex-md-grow-0" id="btnSave">Opslaan</button>
      <button class="btn btn-success flex-grow-1 flex-md-grow-0" id="btnSaveAndCalc">Opslaan &amp; Bereken</button>
    </div>
  </nav>
</body>
```

### Accordion-sectie template

```html
<div class="accordion-item">
  <h2 class="accordion-header">
    <button class="accordion-button" type="button" data-bs-toggle="collapse"
            data-bs-target="#secBasis" aria-expanded="true" aria-controls="secBasis">
      <i class="fa-solid fa-id-card me-2"></i> Basisgegevens
    </button>
  </h2>
  <div id="secBasis" class="accordion-collapse collapse show">
    <div class="accordion-body">
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <label for="projectName" class="form-label">Projectnaam <span class="text-danger">*</span></label>
          <input id="projectName" type="text" class="form-control" required>
          <div class="form-text">Kort, herkenbaar label.</div>
        </div>
        …
      </div>
    </div>
  </div>
</div>
```

**Let op:** geen `data-bs-parent` op de `.accordion-collapse` — dat houdt het
gedrag open (meerdere secties tegelijk uitgeklapt), wat bij een lang
formulier gebruiksvriendelijker is dan single-open. Alle 11 secties starten
met `.collapse.show`.

### De 11 secties blijven:

1. Basisgegevens
2. Klantcontact
3. Situatie & notities
4. Leverancier & tarieven
5. Woning
6. Elektrische aansluiting
7. Zekeringkast
8. Omvormers (dynamische lijst)
9. Voorkeuren berekening
10. Foto's
11. CSV upload

### Omvormer-lijst (dynamisch)

Per item `.card.mb-2`:

```html
<div class="card mb-2">
  <div class="card-body">
    <div class="d-flex justify-content-between align-items-start mb-2">
      <h6 class="mb-0">Omvormer #1</h6>
      <button type="button" class="btn-close" aria-label="Verwijder"
              data-inverter-remove="0"></button>
    </div>
    <div class="row g-2">
      <div class="col-12 col-md-4">
        <label class="form-label">Vermogen (kW) <span class="text-danger">*</span></label>
        <input type="number" step="0.1" class="form-control" …>
      </div>
      …
    </div>
  </div>
</div>
```

"+ Omvormer toevoegen" = `.btn.btn-outline-primary` onder de laatste kaart.

### Foto-upload sectie

Drag-drop zone blijft eigen component, maar gestyled met Bootstrap:
`.border.border-2.border-dashed.rounded.p-4.text-center`. `.drag-over`-state krijgt
`.bg-primary-subtle.border-primary`. Progress = Bootstrap `.progress` + `.progress-bar`.

## Layout: `producten.html`

### Globale structuur

```
<body class="bg-body">
  <nav.navbar …>

  <main class="container py-4">
    <!-- Per product: één card -->
    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-12 col-lg-5">
            <!-- Photo carousel -->
            <div id="prod-123-carousel" class="carousel slide" data-bs-ride="false">
              <div class="carousel-indicators">…</div>
              <div class="carousel-inner">…</div>
              <button class="carousel-control-prev" …>
              <button class="carousel-control-next" …>
            </div>
          </div>
          <div class="col-12 col-lg-7">
            <h3 class="card-title">[type]</h3>
            <p class="text-muted">[omschrijving]</p>
            <dl class="row mb-0 small">
              <dt class="col-5">Capaciteit</dt><dd class="col-7">…</dd>
              …
            </dl>
          </div>
        </div>
      </div>
    </div>
  </main>

  <!-- Lightbox: blijft custom -->
</body>
```

Photo-carousel = Bootstrap Carousel (indicators, prev/next controls, geen
auto-cycle). Klik op actieve slide opent lightbox met alle foto's van die
product (zoals nu). Config-banners worden `.alert.alert-warning` /
`.alert.alert-info`.

## Component-mapping (referentie)

| Huidige custom class | Bootstrap-vervanging |
|---|---|
| `.topbar` | `.navbar.navbar-expand-lg.sticky-top.bg-white.border-bottom` |
| `.card` | `.card` + `.card-body` (padding via card-body ipv card) |
| `.btn` (primary) | `.btn.btn-primary` |
| `.btn-secondary` | `.btn.btn-outline-secondary` |
| `.btn-danger` | `.btn.btn-danger` |
| `.alert-warning` | `.alert.alert-warning` |
| `.alert-info` | `.alert.alert-info` |
| `.alert-error` | `.alert.alert-danger` |
| `.drawer` + overlay | `.offcanvas.offcanvas-end` |
| `.modal-overlay` + dialog | `.modal.fade` + `.modal-dialog` |
| `.status-popover` | `.dropdown-menu` |
| `.toolbar` | `.row.g-2.align-items-center` binnen `.card-body` |
| `.status-chip` | `.badge.rounded-pill` (kleur via inline-style, `cursor:pointer` via smartpeak.css) |
| `.filter-chk` | `.form-check.form-switch` |
| `<details class="card">` | `.accordion-item` + `.accordion-header` + `.accordion-collapse` |
| `.project-table` | `.table.table-hover.align-middle` binnen `.table-responsive` |
| `statusEl.textContent` melding | `.toast` in `.toast-container` |
| `.tabs` / `.tab-button` | `.nav.nav-tabs` + `.nav-link` |
| `.empty-state` | `.text-muted.fst-italic.py-4.text-center` |
| `.view-toggle` | `.btn-group` met `.btn.btn-outline-primary` |
| Loader tekst "⏳ Laden…" | `.spinner-border.spinner-border-sm` + tekst |

**Wat NIET wordt vervangen** (blijft custom, gestyled via `smartpeak.css`):

- Kanban-bord (kolommen, kaarten, drag-ghost)
- Lightbox (photo zoom met prev/next/delete/counter)
- Status-chip kleuren (runtime uit `getStatusMeta()`, blijft inline-style)
- Chat-pulse-animatie
- Photo-grid (aspect-ratio tiles)
- Ground-fault / offerte-missing warning-icons (kleur-utilities)

## Responsive breakpoints (vastgelegd)

| Range | Gedrag |
|---|---|
| **< md** (< 768px) | Portrait/landscape telefoons. Navbar hamburger. Tabel: naam/klant/status/acties. Action-bar knoppen full-width. Accordion 1 kolom. View-toggle verborgen → list forceren. Offcanvas full-width (via `smartpeak.css` media query, `--bs-offcanvas-width: 100vw` onder `md`). |
| **md – lg** (768–991px) | Tablet portrait. Extra tabel-kolom "Laatst gewijzigd". Action-bar knoppen horizontaal. Accordion 2 kolommen (`col-md-6`). View-toggle nog verborgen. |
| **≥ lg** (≥ 992px) | Tablet landscape / laptop / desktop. Kanban-toggle zichtbaar. Tabel alle kolommen. Accordion tot 3 kolommen (`col-lg-4`). Navbar expanded. Offcanvas 420px breed. |
| **≥ xl** (≥ 1200px) | Meer whitespace via `container-fluid` + eventueel `max-width` op main. Geen aparte layout-shift. |

## Migratie-aanpak

**Aanpak 1: per file big-bang.** Elke file in één keer volledig omgezet, één
commit per file. Volgorde:

1. **`smartpeak.css` aanmaken** — custom-property overrides + skeleton. Eén commit.
2. **`dashboard.html`** — meest complex, zet de patronen voor navbar/toolbar/card/
   offcanvas/modal/toast/dropdown. Eén commit.
3. **`project-edit.html`** — profiteert van vastgelegde navbar + accordion
   patroon. Eén commit.
4. **`producten.html`** — klein, sluit af met carousel-introduction. Eén commit.

Na stap 4 is `smartpeak.css` stabiel en zijn de drie `<style>`-blocks leeg
(behalve eventuele page-specifieke one-offs).

## Risico's & mitigaties

1. **Bootstrap JS init timing** — `bootstrap.bundle.min.js` staat aan einde
   `<body>`, maar vóór alle bestaande inline `<script>` blokken. Elke component
   die JS nodig heeft (Offcanvas, Modal, Dropdown, Toast, Accordion) wordt of via
   `data-bs-toggle` attribuut geïnitialiseerd (lazy), of expliciet via
   `bootstrap.X.getOrCreateInstance(el)` bij gebruik. Geen eager init op alle
   elementen tegelijk.

2. **Status-chip kleur-override** — Bootstrap's `.badge` gebruikt
   `.text-bg-{color}` utilities. We forceren de runtime-kleur via inline `style`
   zodat alle 16 statussen hun eigen palet houden (zoals nu).

3. **Offcanvas + `<input type=file>` focus-conflict** — Bootstrap Offcanvas
   trapt focus binnen het paneel. Testen of native file-picker klik (foto-upload,
   offerte-upload) correct werkt in Chrome desktop + iOS Safari. Fallback:
   `data-bs-backdrop="false"` of handmatig focus-management.

4. **Kanban-drag binnen BS-cards** — native HTML5 drag-drop werkt orthogonaal
   op Bootstrap styling. Bestaande `dragstart`/`dragover`/`drop` listeners
   blijven. Alleen de *classes* veranderen.

5. **View-toggle onder 992px** — JS moet `listView` forceren zelfs als
   localStorage `'board'` zegt. `resize`-listener re-rendert bij cross-over
   992px om ghost-state te vermijden.

6. **Readonly-mode (index.html share-links)** — blijft werken: we raken
   `index.html` niet aan, en de CSS-overrides daarin zitten in de eigen
   `<style>`-block.

7. **Geen tests** — verificatie per file na commit:
   - **dashboard:** login flow, lijst renderen, filter switches, search, drawer
     open + alle secties, status-dropdown change, offerte-modal upload + delete,
     toast feedback, kanban-toggle zichtbaarheid op ≥992px, drag-drop tussen
     kolommen, offcanvas op mobile full-width.
   - **project-edit:** nieuw project flow, bestaand project laden, alle 11
     accordion-secties togglen, omvormer toevoegen/verwijderen, foto-upload
     drag-drop, CSV-upload, save + save-and-calc round-trip, sticky action-bar
     op mobile.
   - **producten:** product-cards renderen, photo-carousel prev/next, klik op
     actieve foto opent lightbox, alle specs-velden correct.

## Niet-functionele eisen

- **Performance:** geen meetbare regressie. Bootstrap CSS ≈ 28 KB gzipped +
  Bootstrap JS bundle ≈ 22 KB gzipped. Eén extra HTTP-roundtrip (CDN).
- **Accessibility:** Bootstrap-componenten hebben standaard ARIA-attributen
  (`aria-expanded`, `aria-controls`, `role="dialog"`, focus-trap, ESC-dismiss).
  We voegen geen eigen ARIA toe waar BS het al regelt.
- **Browser-support:** Bootstrap 5.3 ondersteunt de laatste 2 versies van alle
  major browsers. Geen IE11. Consistent met huidige stack.
- **Backwards-compat van URL's:** geen verandering aan `?project=<id>`,
  `?s=<id>`, `?data=<b64>`, `#results` hash-scroll.

## Verificatie na implementatie

Eind-van-implementatie manuele verificatie-checklist komt in het bijhorende
implementatieplan. Deze spec legt enkel de doelstructuur vast; het plan zal per
file de exacte stappen, diffs en verificatiepunten uitwerken.
