# Backoffice Bootstrap 5.3 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `dashboard.html`, `project-edit.html`, and `producten.html` to use Bootstrap 5.3 as the primary layout/component system, mobile-first responsive, while preserving the SmartPeak brand (primary `#2c7be5`, radius 12px, Segoe UI) via a single `assets/css/smartpeak.css` overlay.

**Architecture:** Bootstrap loaded via cdnjs CDN (no build step). Custom-property overrides in `smartpeak.css` re-theme Bootstrap to SmartPeak. App-specific components without a Bootstrap equivalent (kanban, lightbox, photo-grid, chat-pulse, status-chip colors) keep custom CSS, all consolidated in `smartpeak.css`. Each HTML file is migrated in a single atomic commit to avoid broken intermediate states; the previous custom `<style>` block is drained almost completely.

**Tech Stack:** Bootstrap 5.3.3 (CSS + JS bundle with Popper) via cdnjs, Font Awesome 6.5.2 (unchanged), Firebase 10.13.2 compat (unchanged), plain HTML/CSS/JS (no build step).

**Spec:** `docs/superpowers/specs/2026-04-22-backoffice-bootstrap-design.md`

---

## Context for the engineer

**This project has NO automated test suite.** Verification after every file change is manual browser testing. Each task ends with a verification step describing exactly what to click and what to expect. If something doesn't match, fix it before committing — never commit "works except X".

**Running locally:** from repo root, `python3 -m http.server` → `http://localhost:8000/dashboard.html` (requires Firebase access — user email must be whitelisted).

**Git workflow:** each task = one commit. The default branch is `gh-pages`; GitHub Pages serves directly. Do NOT push mid-task — commit locally, let the user push when they approve.

**SRI hashes for Bootstrap 5.3.3:** use these values from cdnjs (verified on 2026-04-22):
- CSS: `sha512-jnSuA4Ss2PkkikSOLtYs8BlYIeeIK1h99ty4YfvRPAlzr377vr3CXDb7sb7eEEBYjDtcYj+AjBH3FLv5uSJuSg==`
- JS:  `sha512-1/RvZTcCDEUjY/CypiMz+iqqtaoQfAITmNSJY17Myp4Ms5mdxPS5UV7iOfdZoxcGhzFbOm6sntTKJppjvuhg4g==`

If either hash is rejected by the browser ("integrity mismatch"), fetch the current values from `https://cdnjs.com/libraries/bootstrap/5.3.3` (SRI button next to each URL) and update this plan inline before committing.

---

## File Structure

**New file:**
- `assets/css/smartpeak.css` — Bootstrap CSS-custom-property overrides + app-specific CSS (kanban, lightbox, photo-grid, chat-pulse, readonly-mode, status-chip cursor, etc.). Owned by all three HTML files.

**Modified files:**
- `dashboard.html` — inline `<style>` block drained from ~485 lines to ~0 (anything still page-specific stays inline as comment). HTML restructured to use Bootstrap navbar/card/table/offcanvas/modal/toast/dropdown. JS updated for Bootstrap component APIs.
- `project-edit.html` — inline `<style>` drained similarly. `<details class="card">` × 11 → Bootstrap accordion. Sticky action-bar → `navbar.fixed-bottom`.
- `producten.html` — smallest rewrite. Photo-carousel → Bootstrap Carousel component. Lightbox kept (no BS equivalent).
- `CLAUDE.md` — document the new styling layer so future agents know `smartpeak.css` is the single CSS source of truth.

**Untouched:**
- `index.html` (calculator) — out of scope.
- `assets/js/*.js`, security rules, Firebase config — unchanged.
- `README.md`, `style.css`, `script.js` — dead upstream template code, leave alone.

---

## Task 1: Create `smartpeak.css` skeleton

**Files:**
- Create: `assets/css/smartpeak.css`

This file is the single CSS source of truth. We ship it with the Bootstrap-overrides and a placeholder comment for app-specific styles. App-specific styles get filled in as each HTML file is migrated (Tasks 2–4).

- [ ] **Step 1: Create `assets/css/smartpeak.css` with the complete initial content**

Write this file:

```css
/*
 * smartpeak.css — SmartPeak brand layer on top of Bootstrap 5.3
 *
 * Loaded AFTER bootstrap.min.css in every backoffice HTML file
 * (dashboard.html, project-edit.html, producten.html).
 *
 * Sections:
 *   1. Bootstrap custom-property overrides (brand palette, radius, fonts)
 *   2. Component-level overrides that Bootstrap's SCSS derivatives don't
 *      expose via CSS variables (mainly .btn-primary hover/active states)
 *   3. App-specific components (kanban, lightbox, photo-grid, chat-pulse,
 *      status chip cursor, readonly-mode helpers, icon color utilities)
 */

/* ── 1. Brand tokens via Bootstrap custom properties ─────────────────── */

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
  --bs-font-sans-serif: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;

  /* semantic brand tokens used by app-specific CSS below */
  --sp-muted: #6b7a99;
  --sp-success: #00b478;
  --sp-warning: #f6a623;
  --sp-danger: #e54545;
}

/* ── 2. Button states Bootstrap doesn't expose via CSS vars ──────────── */

.btn-primary {
  --bs-btn-hover-bg: #1a5fba;
  --bs-btn-hover-border-color: #1a5fba;
  --bs-btn-active-bg: #164d97;
  --bs-btn-active-border-color: #164d97;
}

/* ── 3. App-specific components ──────────────────────────────────────── */

/* Icon color helpers (already used in FA 6 iconen) */
.icon-ok     { color: #16a34a; }
.icon-warn   { color: #f59e0b; }
.icon-danger { color: #dc2626; }

/* Status chip — Bootstrap .badge with pointer cursor + custom runtime color */
.badge.status-chip {
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.badge.status-chip.readonly { cursor: default; }
.badge.status-chip:focus-visible { outline: 2px solid var(--bs-primary); outline-offset: 2px; }

/* Offcanvas drawer: default 420px on ≥ md, full-width on < md */
@media (min-width: 768px) {
  #drawer { --bs-offcanvas-width: 420px; }
}
@media (max-width: 767.98px) {
  #drawer { --bs-offcanvas-width: 100vw; }
}

/* ── Kanban board ────────────────────────────────────────────────────── */

.kanban-board {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.kanban-col {
  flex: 1 1 0;
  min-width: 220px;
  max-width: 320px;
  background: #eef2f8;
  border-radius: var(--bs-border-radius);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.kanban-col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--bs-body-color);
  padding: 2px 4px 6px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}
.kanban-col-header .phase-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: -1px;
}
.kanban-col-header .count {
  background: rgba(0,0,0,0.08);
  color: var(--bs-body-color);
  font-size: 0.78rem;
  padding: 1px 8px;
  border-radius: 10px;
}
.kanban-col-body { display: flex; flex-direction: column; gap: 6px; min-height: 20px; }
.kanban-col.drop-target { background: #dce8fa; }
.kanban-card {
  background: #fff;
  border: 1px solid var(--bs-border-color);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: grab;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.kanban-card:hover { box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
.kanban-card.dragging { opacity: 0.5; cursor: grabbing; }
.kanban-card-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--bs-link-color);
  cursor: pointer;
  margin-bottom: 2px;
}
.kanban-card-customer { font-size: 0.8rem; color: var(--sp-muted); margin-bottom: 4px; }
.kanban-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

/* ── Chat indicator pulse ────────────────────────────────────────────── */

.chat-indicator {
  display: inline-block;
  margin-right: 6px;
  font-size: 0.95rem;
  opacity: 0.55;
}
.chat-indicator.unread {
  opacity: 1;
  animation: sp-chat-pulse 1.6s ease-in-out infinite;
}
@keyframes sp-chat-pulse {
  0%, 100% { transform: scale(1);    opacity: 1;   }
  50%      { transform: scale(1.15); opacity: 0.6; }
}

/* ── Row-warning (ground-fault / offerte-missing triangles) ──────────── */

.row-warning {
  display: inline-block;
  margin-right: 6px;
  font-size: 0.95rem;
  cursor: help;
}

/* ── Photo grid (drawer + project-edit) ──────────────────────────────── */

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 6px;
  margin-bottom: 10px;
}
.photo-tile {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 6px;
  background: var(--bs-body-bg);
  cursor: zoom-in;
  position: relative;
}
.photo-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.photo-tile.broken {
  display: flex; align-items: center; justify-content: center;
  color: var(--sp-muted); font-size: 0.72rem; text-align: center;
  padding: 4px; cursor: help;
}

/* ── Lightbox (shared pattern across producten.html + dashboard drawer) */

.sp-lightbox {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.92);
  display: none;
  align-items: center; justify-content: center;
  z-index: 1080; /* above BS offcanvas (1045) + modal (1055) */
  padding: 24px;
}
.sp-lightbox.open { display: flex; }
.sp-lightbox img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; }
.sp-lightbox-btn {
  position: absolute;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  width: 44px; height: 44px; border-radius: 50%;
  font-size: 1.4rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.sp-lightbox-btn:hover { background: rgba(255, 255, 255, 0.25); }
.sp-lightbox .close { top: 14px; right: 14px; }
.sp-lightbox .prev  { left: 14px;  top: 50%; transform: translateY(-50%); }
.sp-lightbox .next  { right: 14px; top: 50%; transform: translateY(-50%); }
.sp-lightbox .del   { bottom: 14px; right: 14px; background: rgba(229,69,69,0.85); }
.sp-lightbox .del:hover { background: rgba(229,69,69,1); }
.sp-lightbox .counter {
  position: absolute; bottom: 14px; left: 14px;
  color: rgba(255,255,255,0.75);
  font-size: 0.85rem;
  background: rgba(0,0,0,0.3);
  padding: 4px 10px;
  border-radius: 12px;
}

/* ── Drag-drop zone (foto-upload + offerte-upload) ───────────────────── */

.sp-drop-zone {
  border: 2px dashed #c4cadb;
  border-radius: 10px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  background: #f7f9fd;
  font-size: 0.9rem;
  user-select: none;
}
.sp-drop-zone:hover { background: #eef4ff; border-color: var(--bs-primary); }
.sp-drop-zone.drag-over { background: #dcebff; border-color: var(--bs-primary); border-style: solid; }
.sp-drop-zone.uploading { cursor: progress; }
.sp-drop-zone input[type=file] { display: none; }

/* ── Readonly mode (share-link viewers) ──────────────────────────────── */
/* Only referenced by index.html but lives here so all backoffice files   */
/* can safely share snippets that become embedded in share-links later.   */

body.readonly-mode .btn-primary,
body.readonly-mode .btn-outline-primary,
body.readonly-mode #btnNewProject,
body.readonly-mode .no-readonly { display: none !important; }
body.readonly-mode input, body.readonly-mode textarea, body.readonly-mode select {
  pointer-events: none;
  background: #f4f7fc !important;
}

/* ── Misc ────────────────────────────────────────────────────────────── */

.sp-empty-state {
  color: var(--sp-muted);
  font-style: italic;
  padding: 24px 8px;
  text-align: center;
}

/* Utility: hidden via JS state toggles (used by all three HTML files) */
.hide { display: none !important; }
```

- [ ] **Step 2: Verify the file was written correctly**

Run: `wc -l assets/css/smartpeak.css`
Expected: ~220 lines

Run: `head -5 assets/css/smartpeak.css`
Expected: starts with `/*` block comment

- [ ] **Step 3: Commit**

```bash
git add assets/css/smartpeak.css
git commit -m "$(cat <<'EOF'
assets: add smartpeak.css brand layer for Bootstrap 5.3

Single CSS file overlaying Bootstrap with SmartPeak brand palette
(#2c7be5, 12px radius, Segoe UI) via CSS custom-property overrides,
plus app-specific components (kanban, lightbox, photo-grid, chat-pulse,
drop-zone, readonly-mode). Loaded by dashboard/project-edit/producten
in the next tasks.
EOF
)"
```

---

## Task 2: Migrate `dashboard.html`

**Files:**
- Modify: `dashboard.html` (entire `<head>` `<style>` block + entire `<body>` structure, ~900 lines of HTML/CSS touched)

This is the longest task. The approach: we replace entire sections atomically. JS logic (event handlers, Firebase calls, Firestore listeners) stays intact — only the DOM the JS queries/renders is rewritten.

**Before starting:** read the full current file once (`cat dashboard.html | less`) so you understand where each of the six `render*`/`open*`/`close*` helpers touches the DOM.

### 2.1 — Add Bootstrap CDN to `<head>`

- [ ] **Step 1: Replace the `<head>` additions**

Find the Font Awesome `<link>` at line 6. Insert Bootstrap CSS and `smartpeak.css` links immediately AFTER it, BEFORE the `<title>`:

```html
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/css/bootstrap.min.css" integrity="sha512-jnSuA4Ss2PkkikSOLtYs8BlYIeeIK1h99ty4YfvRPAlzr377vr3CXDb7sb7eEEBYjDtcYj+AjBH3FLv5uSJuSg==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="assets/css/smartpeak.css" />
  <title>SmartPeak — Projecten</title>
```

### 2.2 — Drain the inline `<style>` block

- [ ] **Step 2: Replace the entire `<style>…</style>` block with a minimal remnant**

Currently the `<style>` block runs from line ~14 to line ~501. Replace the entire content (between `<style>` and `</style>` tags) with just:

```css
    /*
     * Page-specific overrides live here. Global app styles are in
     * assets/css/smartpeak.css (loaded above). Keep this block empty
     * unless a rule is truly only relevant for dashboard.html.
     */
```

**What moved where:**
- Bootstrap custom properties → already in `smartpeak.css`
- `.kanban-*`, `.photo-grid`, `.photo-tile`, `.chat-indicator`, `.row-warning`, `.icon-*` → already in `smartpeak.css`
- `.drawer` / `.drawer-overlay` / `.drawer-header` / `.drawer-body` / `.drawer-section` / etc → **deleted** (replaced by Bootstrap Offcanvas)
- `.modal-overlay` / `.modal-dialog` / `.modal-header` / `.modal-body` / `.modal-footer` / `.modal-close-btn` / `.drop-zone` → **deleted** (replaced by Bootstrap Modal + `.sp-drop-zone` from `smartpeak.css`)
- `.lightbox-dash*` → **deleted** (replaced by `.sp-lightbox` from `smartpeak.css`)
- `.status-chip`, `.status-popover`, `.status-option` → **deleted** (replaced by Bootstrap `.badge` + `.dropdown-menu`)
- `.projectNameBtn`, `.empty-state`, `.row-actions`, `.toolbar`, `.filter-chk`, `.view-toggle`, `.topbar`, `.alert-*`, `.btn*`, `.card`, `.hide` → **deleted** (replaced by Bootstrap utilities)
- `.offerte-*` classes used inside the modal → keep inline for now (rendered by `renderOfferteModalBody`); these can stay as the modal uses its own little layout. Move them into the new `<style>` remnant:

Actually, for simplicity **do** move the offerte-modal sub-styles into the remnant `<style>` block since they're page-specific:

```css
    /* Offerte-modal body styles (rendered by renderOfferteModalBody) */
    .offerte-cfg-header { margin-bottom: 10px; }
    .offerte-existing { padding: 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 12px; font-size: 0.9rem; }
    .offerte-row { padding: 10px 0; border-bottom: 1px solid var(--bs-border-color); }
    .offerte-row.dismissed { opacity: 0.55; }
    .offerte-row:last-child { border-bottom: 0; }
    .offerte-row-head { display: flex; align-items: center; gap: 8px; }
    .offerte-row-title { font-weight: 600; font-size: 0.92rem; }
    .offerte-row-meta, .offerte-row-pdf { font-size: 0.85rem; color: var(--sp-muted); margin-top: 4px; }
    .offerte-row-actions { display: flex; gap: 6px; margin-top: 6px; }
    .offerte-divider { text-align: center; color: var(--sp-muted); font-size: 0.82rem; margin: 16px 0 8px; }
```

### 2.3 — Replace the three state containers (auth-gate + main)

- [ ] **Step 3: Replace the "State 1" (not logged in) card**

Find `<div class="card center-card" id="stateLoggedOut">` and replace with:

```html
<div class="card mx-auto mt-5 hide" id="stateLoggedOut" style="max-width:480px">
  <div class="card-body text-center p-4">
    <h1 class="h4 mb-2"><i class="fa-solid fa-bolt text-primary"></i> SmartPeak — Projecten</h1>
    <p class="text-muted mb-3">Alleen voor Bloxit medewerkers.</p>
    <button type="button" class="btn btn-primary" id="btnSignIn">Log in met Google</button>
    <p id="signInError" class="alert alert-danger mt-3 hide"></p>
  </div>
</div>
```

Note: `.hide` class is already defined in `smartpeak.css` (Task 1), so no extra rule is needed — the class just works.

- [ ] **Step 4: Replace the "State 2" (not whitelisted) card**

```html
<div class="card mx-auto mt-5 hide" id="stateNotWhitelisted" style="max-width:480px">
  <div class="card-body text-center p-4">
    <h1 class="h4 mb-2"><i class="fa-solid fa-triangle-exclamation icon-danger"></i> Geen toegang</h1>
    <p class="text-muted mb-3">Je bent ingelogd als <strong id="notWhitelistedEmail">…</strong> maar dit account heeft geen toegang tot SmartPeak Projecten.</p>
    <button type="button" class="btn btn-outline-secondary" id="btnSignOutNW">Uitloggen</button>
  </div>
</div>
```

- [ ] **Step 5: Replace the "State 3" (authorized) wrapper — navbar + toolbar card + list card**

Replace the entire `<div class="hide" id="stateAuthorized">…</div>` block (currently ~30 lines) with:

```html
<div class="hide" id="stateAuthorized">
  <nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top">
    <div class="container-fluid">
      <span class="navbar-brand mb-0 h1"><i class="fa-solid fa-bolt text-primary"></i> SmartPeak — Projecten</span>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarContent" aria-controls="navbarContent" aria-expanded="false" aria-label="Menu">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarContent">
        <ul class="navbar-nav ms-auto align-items-lg-center gap-2">
          <li class="nav-item">Hallo, <strong id="userDisplayName">…</strong></li>
          <li class="nav-item">
            <button type="button" class="btn btn-outline-secondary btn-sm" id="btnSignOut">Uitloggen</button>
          </li>
        </ul>
      </div>
    </div>
  </nav>

  <main class="container-fluid py-3">

    <!-- Toolbar -->
    <div class="card mb-3">
      <div class="card-body">
        <div class="row g-2 align-items-center">
          <div class="col-12 col-md-auto">
            <button type="button" class="btn btn-primary w-100 w-md-auto" id="btnNewProject">
              <i class="fa-solid fa-plus me-1"></i> Nieuw project
            </button>
          </div>
          <div class="col-12 col-md">
            <div class="input-group">
              <span class="input-group-text"><i class="fa-solid fa-magnifying-glass"></i></span>
              <input type="search" id="projectSearch" class="form-control" placeholder="Zoek projectnaam of klant…" />
            </div>
          </div>
          <div class="col-6 col-md-auto">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="toggleShowFinished">
              <label class="form-check-label" for="toggleShowFinished">Toon afgesloten</label>
            </div>
          </div>
          <div class="col-6 col-md-auto">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="toggleShowDeleted">
              <label class="form-check-label" for="toggleShowDeleted">Toon verwijderde</label>
            </div>
          </div>
          <div class="col-12 col-lg-auto d-none d-lg-block">
            <div class="btn-group" role="group" id="viewToggle" aria-label="View toggle">
              <button type="button" class="btn btn-outline-primary active" data-view="list">
                <i class="fa-solid fa-list"></i> Lijst
              </button>
              <button type="button" class="btn btn-outline-primary" data-view="board">
                <i class="fa-solid fa-table-columns"></i> Bord
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Project list / kanban -->
    <div class="card">
      <div class="card-body p-0 p-md-3" id="projectList">
        <p class="sp-empty-state">⏳ Laden…</p>
      </div>
    </div>
  </main>
</div>
```

### 2.4 — Replace the drawer with Bootstrap Offcanvas

- [ ] **Step 6: Replace drawer markup**

Find `<div class="drawer-overlay" id="drawerOverlay"></div>` and the `<aside class="drawer" ...>…</aside>` below it. Replace both with:

```html
<div class="offcanvas offcanvas-end" tabindex="-1" id="drawer" aria-labelledby="drawerHeaderTitle">
  <div class="offcanvas-header border-bottom" id="drawerHeader"></div>
  <div class="offcanvas-body" id="drawerBody"></div>
</div>
```

Bootstrap automatically handles the backdrop, ESC-close, and focus-trap, so the `drawerOverlay` element is gone and the JS code that manipulated it must be removed (next step).

### 2.5 — Replace the offerte modal

- [ ] **Step 7: Replace offerte modal markup**

Find `<div class="modal-overlay" id="offerteModal" ...>…</div>` (currently ~15 lines including header/body/footer) and replace with:

```html
<div class="modal fade" id="offerteModal" tabindex="-1" aria-labelledby="offerteModalTitle" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="offerteModalTitle">Offerte uploaden</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluiten"></button>
      </div>
      <div class="modal-body" id="offerteModalBody"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" id="offerteModalCancel" data-bs-dismiss="modal">Annuleren</button>
      </div>
    </div>
  </div>
</div>
```

### 2.6 — Add toast container

- [ ] **Step 8: Add a toast container right before `</body>`**

```html
<div class="toast-container position-fixed bottom-0 end-0 p-3" id="toastContainer" style="z-index:1090"></div>
```

### 2.7 — Add Bootstrap JS bundle

- [ ] **Step 9: Add Bootstrap JS bundle at the end of `<body>`, BEFORE the existing inline `<script>` block**

Find the line `<script>` that opens the big inline JS block (around line 580-ish in the current file, search for the first `<script>` tag that contains `// ── STATE ──` or similar). Insert ABOVE it:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js" integrity="sha512-1/RvZTcCDEUjY/CypiMz+iqqtaoQfAITmNSJY17Myp4Ms5mdxPS5UV7iOfdZoxcGhzFbOm6sntTKJppjvuhg4g==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
```

### 2.8 — Update JS: drawer open/close via Offcanvas

- [ ] **Step 10: Find and replace the drawer open/close functions**

Search for `openDrawer(` and `closeDrawer(` in the inline script. The current implementation toggles classes on `#drawer` and `#drawerOverlay`.

**Delete** the `#drawerOverlay` references (element no longer exists). Replace:

```js
function openDrawer() {
  document.getElementById('drawerOverlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'false');
}
function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'true');
}
```

with:

```js
function openDrawer() {
  const el = document.getElementById('drawer');
  bootstrap.Offcanvas.getOrCreateInstance(el).show();
}
function closeDrawer() {
  const el = document.getElementById('drawer');
  bootstrap.Offcanvas.getOrCreateInstance(el).hide();
}
```

Delete any click-handler on `drawerOverlay` (e.g. `drawerOverlay.addEventListener('click', closeDrawer)`) and any keydown-handler that listens for Escape on the drawer — Bootstrap handles both.

The close button inside the drawer-header needs `data-bs-dismiss="offcanvas"`. Search where `drawer-close-btn` HTML is generated (in `renderDrawerHeader` or similar). Change:

```js
`<button type="button" class="drawer-close-btn" aria-label="Sluit">×</button>`
```

to:

```js
`<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Sluit"></button>`
```

### 2.9 — Update JS: modal open/close

- [ ] **Step 11: Find `openOfferteModal(` and `closeOfferteModal(`**

Replace the current class-toggle implementations with Bootstrap Modal API:

```js
function openOfferteModal(configType) {
  // …existing: populate #offerteModalBody via renderOfferteModalBody(configType)…
  const el = document.getElementById('offerteModal');
  bootstrap.Modal.getOrCreateInstance(el).show();
}
function closeOfferteModal() {
  const el = document.getElementById('offerteModal');
  bootstrap.Modal.getOrCreateInstance(el).hide();
}
```

Delete any manual click-on-backdrop-closes handler. Delete the `offerteModalClose` inner X button's custom handler (the `btn-close` with `data-bs-dismiss="modal"` is self-wiring). The `offerteModalCancel` button likewise uses `data-bs-dismiss="modal"` now.

### 2.10 — Update JS: status-chip popover → dropdown

- [ ] **Step 12: Rewrite `statusChipHTML(status, projectId)` to emit Bootstrap dropdown markup**

Current function emits a `<span class="status-chip">` which gets a click-handler attached later. New version:

```js
function statusChipHTML(statusKey, projectId) {
  const meta = getStatusMeta(statusKey);
  const readonly = projectId == null;
  if (readonly) {
    return `<span class="badge status-chip readonly" style="background:${meta.color};color:#fff;">${escapeHtml(meta.label)}</span>`;
  }
  const dropdownId = `stDd_${projectId}`;
  const options = PROJECT_STATUSES.map(s => `
    <li><button type="button" class="dropdown-item d-flex align-items-center gap-2"
                data-status="${s.key}" data-project-id="${projectId}">
      <span class="d-inline-block rounded-circle" style="width:10px;height:10px;background:${s.color};"></span>
      ${escapeHtml(s.label)}
    </button></li>
  `).join('');
  return `
    <div class="dropdown d-inline-block">
      <button type="button" class="badge status-chip border-0" style="background:${meta.color};color:#fff;"
              id="${dropdownId}" data-bs-toggle="dropdown" aria-expanded="false">
        ${escapeHtml(meta.label)} <i class="fa-solid fa-caret-down ms-1"></i>
      </button>
      <ul class="dropdown-menu" aria-labelledby="${dropdownId}">${options}</ul>
    </div>
  `;
}
```

- [ ] **Step 13: Delete the old popover plumbing**

Search for and delete these functions entirely: `openStatusPopover`, `closeStatusPopover`, and any `window.addEventListener('click', closeStatusPopover)` / `keydown` / `resize` handlers that reference status popovers.

Replace the single `document.addEventListener('click', ...)` that used to call `openStatusPopover` with a delegated handler on `dropdown-item[data-status]`:

```js
document.addEventListener('click', (ev) => {
  const opt = ev.target.closest('.dropdown-menu .dropdown-item[data-status][data-project-id]');
  if (!opt) return;
  const statusKey = opt.getAttribute('data-status');
  const projectId = opt.getAttribute('data-project-id');
  handleStatusPick(projectId, statusKey);  // existing function that updates Firestore
});
```

### 2.11 — Update JS: project-table → Bootstrap table

- [ ] **Step 14: Find `renderList(projects)` (the function that emits the table markup)**

Replace the opening `<table class="project-table">` with:

```js
`<div class="table-responsive">
   <table class="table table-hover align-middle mb-0">
     <thead>
       <tr>
         <th>Project</th>
         <th class="d-none d-sm-table-cell">Klant</th>
         <th>Status</th>
         <th class="d-none d-sm-table-cell">Gewijzigd</th>
         <th class="d-none d-md-table-cell">Laatste calc</th>
         <th class="text-end">Acties</th>
       </tr>
     </thead>
     <tbody>`
```

Update the per-row template (`rowHTML(p)`) similarly — wrap row cells with the same responsive classes:

```js
function rowHTML(p) {
  const chat = chatIndicatorHTML(p);
  const warnGround = groundWarningHTML(p);
  const warnOff = offerteWarningHTML(p);
  return `
    <tr class="${p.deleted ? 'text-muted opacity-50' : ''}" data-id="${p.id}">
      <td>
        ${chat}${warnGround}${warnOff}
        <button type="button" class="btn btn-link p-0 text-decoration-none fw-semibold projectNameBtn" data-id="${p.id}">
          ${escapeHtml(p.projectName || '')}
        </button>
      </td>
      <td class="d-none d-sm-table-cell">${escapeHtml(p.customerName || '')}</td>
      <td>${statusChipHTML(p.status, p.id)}</td>
      <td class="d-none d-sm-table-cell text-muted small">${fmtDate(p.updatedAt)}</td>
      <td class="d-none d-md-table-cell text-muted small">${p.lastCalcRun ? fmtDate(p.lastCalcRun.runAt) : '—'}</td>
      <td class="text-end row-actions">
        ${p.lastCalcRun ? `<a class="btn btn-sm btn-outline-secondary" href="index.html?project=${p.id}#results" title="Open berekening"><i class="fa-solid fa-calculator"></i></a>` : ''}
        <a class="btn btn-sm btn-outline-secondary" href="project-edit.html?project=${p.id}" title="Bewerk"><i class="fa-solid fa-pen-to-square"></i></a>
        ${p.deleted
          ? `<button type="button" class="btn btn-sm btn-outline-secondary" data-action="restore" data-id="${p.id}" title="Herstel"><i class="fa-solid fa-rotate-left"></i></button>
             <button type="button" class="btn btn-sm btn-outline-danger" data-action="hardDelete" data-id="${p.id}" title="Definitief verwijderen"><i class="fa-solid fa-circle-xmark"></i></button>`
          : `<button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${p.id}" title="Verwijderen"><i class="fa-solid fa-trash"></i></button>`
        }
      </td>
    </tr>
  `;
}
```

The existing helpers `chatIndicatorHTML`, `groundWarningHTML`, `offerteWarningHTML`, `fmtDate`, `escapeHtml`, `handleRowAction` stay — only markup changes.

### 2.12 — Update JS: kanban view

- [ ] **Step 15: Kanban markup already uses `.kanban-*` classes from smartpeak.css**

The current `renderBoard(projects)` emits `.kanban-board > .kanban-col > .kanban-col-body > .kanban-card`. These classes are already defined in `smartpeak.css` (Task 1). **No markup changes required for the board itself.**

However, the status-chip inside kanban cards must use the new dropdown-based `statusChipHTML`. Verify `kanbanCardHTML(p)` calls `statusChipHTML(p.status, p.id)` — if so, the chip inherits the dropdown automatically. If it uses a different code path, update it to call the same helper.

### 2.13 — Update JS: view-toggle gating

- [ ] **Step 16: Force list view under 992px (hard gate)**

Find the function that reads/writes `localStorage.smartpeak.dashboardView`. Add a viewport-width guard:

```js
function currentView() {
  if (window.innerWidth < 992) return 'list';
  return localStorage.getItem('smartpeak.dashboardView') || 'list';
}
```

Add a resize listener near the bottom of the init code (only once):

```js
window.addEventListener('resize', () => {
  // Debounce: re-render only when crossing the 992 boundary
  const nowDesktop = window.innerWidth >= 992;
  if (nowDesktop !== _wasDesktop) {
    _wasDesktop = nowDesktop;
    renderProjects();  // existing render entry point
  }
});
let _wasDesktop = window.innerWidth >= 992;
```

Also hide the `#viewToggle` under 992px via the `d-none d-lg-block` classes already applied in Step 5 — no extra JS needed for visibility, only for render-forcing.

### 2.14 — Update JS: toast feedback helper

- [ ] **Step 17: Add a `showToast` helper and replace `statusEl.textContent = …` calls**

Currently the dashboard shows transient feedback via `statusEl.textContent` (find all call-sites). Add this helper near the top of the inline script:

```js
function showToast(message, variant = 'primary') {
  const container = document.getElementById('toastContainer');
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
```

Replace each `statusEl.textContent = 'Project verwijderd'` etc. with:

```js
showToast('Project verwijderd', 'success');
showToast('Kon project niet laden', 'danger');
showToast('Status bijgewerkt', 'primary');
```

Grep for `statusEl` across the file — every usage becomes a `showToast`. If `statusEl` has no other role (just a transient message), delete it and its DOM element.

### 2.15 — Update JS: photo grid, comments, offerte-rows inside drawer

- [ ] **Step 18: Update drawer-section markup inside JS templates**

Wherever the drawer-body HTML is built (`renderDrawerBody`, `renderDrawerConfigs`, `renderDrawerPhotos`, `renderDrawerComments`, etc.), replace custom section wrappers with Bootstrap utilities.

Old: `<div class="drawer-section">…</div>`
New: `<section class="border-bottom pb-3 mb-3">…</section>`

Old: `<h3>Titel</h3>`
New: `<h6 class="mb-2 text-uppercase text-muted">Titel</h6>`

Photo grid keeps `.photo-grid` / `.photo-tile` classes (defined in smartpeak.css).

Comments composer:

```html
<div class="input-group mt-2">
  <textarea id="drawerCommentInput" class="form-control" rows="2" placeholder="Opmerking toevoegen…"></textarea>
  <button type="button" class="btn btn-primary" id="drawerCommentSubmit">Versturen</button>
</div>
```

Drawer action buttons:

```html
<div class="d-grid d-md-flex gap-2">
  <a class="btn btn-primary flex-md-grow-1" href="${calcHref}"><i class="fa-solid fa-calculator me-1"></i> Open berekening</a>
  <a class="btn btn-outline-primary flex-md-grow-1" href="${editHref}"><i class="fa-solid fa-pen-to-square me-1"></i> Bewerk project</a>
  <button type="button" class="btn btn-outline-danger flex-md-grow-1" id="drawerDeleteBtn"><i class="fa-solid fa-trash me-1"></i> Verwijderen</button>
</div>
```

### 2.16 — Manual verification

- [ ] **Step 19: Start local server**

```bash
python3 -m http.server
```
Open `http://localhost:8000/dashboard.html` in Chrome desktop + mobile-emulator.

- [ ] **Step 20: Full manual regression checklist**

**Desktop (≥1200px):**
- [ ] Page loads without console errors (check DevTools console)
- [ ] Google sign-in → whitelist check → project list appears
- [ ] Search filter works (typing narrows list)
- [ ] "Toon afgesloten" + "Toon verwijderde" switches filter correctly
- [ ] View-toggle is visible; clicking "Bord" switches to kanban view
- [ ] Click a project name → offcanvas drawer slides in from right
- [ ] Drawer shows contact / configs / notes / photos / comments sections
- [ ] Photo grid: upload 1 photo → appears in grid → click → lightbox opens with prev/next/close/delete
- [ ] Comments: post a comment → appears in thread
- [ ] Offerte-row "upload" → modal opens centered → drag/drop PDF → uploads → modal closes → row shows check
- [ ] "Verwijderen" in drawer → project soft-deleted → toast "Project verwijderd"
- [ ] Status-chip click → dropdown opens with all 16 statuses → picking one updates Firestore + UI re-renders
- [ ] Kanban drag-drop: drag card between columns → Firestore updates
- [ ] ESC closes drawer + modal
- [ ] Click backdrop closes drawer + modal

**Tablet portrait (~768px, Chrome DevTools "iPad"):**
- [ ] Navbar collapses to hamburger; clicking toggles
- [ ] View-toggle is HIDDEN; list is forced
- [ ] Tabel shows: project, klant, status, gewijzigd, acties (no "laatste calc")
- [ ] Drawer opens at 420px width (not full-screen)

**Mobile portrait (~375px, "iPhone SE"):**
- [ ] Navbar hamburger works
- [ ] Toolbar rows stack: button + search on top, switches side-by-side below
- [ ] Tabel shows only: project, status, acties (klant + gewijzigd + laatste calc hidden)
- [ ] Drawer opens full-width
- [ ] Offerte-modal opens centered, fits screen, scroll works if body overflows
- [ ] Status-dropdown doesn't overflow viewport

**Cross-cutting:**
- [ ] Brand color stays `#2c7be5` everywhere (inspect a `.btn-primary` → background matches)
- [ ] Radius is 12px on cards (measure with DevTools)
- [ ] Font is "Segoe UI" (DevTools Computed → font-family)
- [ ] No flash-of-unstyled-content (Bootstrap loads fast enough)
- [ ] All FA icons still render (no broken squares)

If anything fails, fix it before moving on.

- [ ] **Step 21: Commit**

```bash
git add dashboard.html assets/css/smartpeak.css
git commit -m "$(cat <<'EOF'
dashboard: migrate to Bootstrap 5.3 (navbar + offcanvas + modal + dropdown)

- Replace custom topbar/toolbar/drawer/modal/popover with Bootstrap components
- Project-table uses .table.table-hover with responsive column visibility
- Status-chips now Bootstrap dropdowns (16 statuses, same runtime colors)
- Kanban-toggle hidden under 992px (hard gate in JS + CSS)
- Toast-container replaces statusEl textContent flashes
- Inline <style> block drained: ~485 lines → ~10 lines (offerte-modal sub-styles only)
- All brand tokens, kanban/lightbox/photo-grid styles in assets/css/smartpeak.css
EOF
)"
```

---

## Task 3: Migrate `project-edit.html`

**Files:**
- Modify: `project-edit.html` (entire `<head>` `<style>` block + all 11 `<details>` sections + action-bar + inline JS references)

This task reuses all the patterns established in Task 2 (navbar, CDN, action-bar). The new piece is the accordion rewrite for the 11 form sections.

### 3.1 — Head and style drain

- [ ] **Step 1: Add Bootstrap CSS + smartpeak.css to `<head>`**

Same 3-line insertion as Task 2 Step 1, immediately after the Font Awesome `<link>` at line 6.

- [ ] **Step 2: Drain the `<style>` block (line ~18 to ~183)**

Replace with:

```css
    /* Page-specific rules only. Globals live in assets/css/smartpeak.css. */
```

All of these rules move to / are deprecated in favor of Bootstrap:
- `body { margin, padding, font-family, background, color }` → default Bootstrap + smartpeak.css
- `.topbar` → `.navbar.navbar-expand-lg.sticky-top`
- `#formSections` 2-col grid → replaced by accordion (each section full width)
- `.pe-drop-zone` → already `.sp-drop-zone` in smartpeak.css
- `.pe-spinner` → use Bootstrap `.spinner-border.spinner-border-sm`
- `.photo-grid`, `.photo-tile` → already in smartpeak.css
- `.lightbox` (this file has its own copy) → replaced by `.sp-lightbox` from smartpeak.css
- `.card` → Bootstrap `.card.card-body`
- `.btn`, `.btn-secondary` → Bootstrap `.btn.btn-primary` / `.btn.btn-outline-secondary`
- `.alert-error` → `.alert.alert-danger`
- `.icon-*` → already in smartpeak.css
- `.hide` → already in smartpeak.css
- `.help`, `.action-bar`, `.action-bar-inner`, `.err` → deleted (Bootstrap utilities replace them)

### 3.2 — Replace the three state containers

- [ ] **Step 3: Replace State 1 (not logged in), State 2 (not whitelisted), and State 3 wrapper**

Same pattern as dashboard. The navbar title becomes dynamic via `#pageTitle`:

```html
<div class="card mx-auto mt-5 hide" id="stateLoggedOut" style="max-width:480px">
  <div class="card-body text-center p-4">
    <h1 class="h4 mb-2"><i class="fa-solid fa-bolt text-primary"></i> SmartPeak — Project bewerken</h1>
    <p class="text-muted mb-3">Alleen voor Bloxit medewerkers.</p>
    <button type="button" class="btn btn-primary" id="btnSignIn">Log in met Google</button>
    <p id="signInError" class="alert alert-danger mt-3 hide"></p>
  </div>
</div>

<div class="card mx-auto mt-5 hide" id="stateNotWhitelisted" style="max-width:480px">
  <div class="card-body text-center p-4">
    <h1 class="h4 mb-2"><i class="fa-solid fa-triangle-exclamation icon-danger"></i> Geen toegang</h1>
    <p class="text-muted mb-3">Je bent ingelogd als <strong id="notWhitelistedEmail">…</strong> maar dit account heeft geen toegang tot SmartPeak Projecten.</p>
    <button type="button" class="btn btn-outline-secondary" id="btnSignOutNW">Uitloggen</button>
  </div>
</div>

<div class="hide" id="stateAuthorized">
  <nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top">
    <div class="container-fluid">
      <span class="navbar-brand mb-0 h1" id="pageTitle"><i class="fa-solid fa-bolt text-primary"></i> Nieuw project</span>
      <div class="ms-auto">
        <a href="dashboard.html" class="btn btn-sm btn-outline-secondary">
          <i class="fa-solid fa-arrow-left me-1"></i> Dashboard
        </a>
      </div>
    </div>
  </nav>

  <main class="container-fluid py-3 pb-5">
    <div class="accordion" id="projectEditAccordion">
      <!-- 11 accordion items inserted here (Step 4) -->
    </div>
    <div id="globalError" class="alert alert-danger mt-3 hide"></div>
  </main>

  <nav class="navbar fixed-bottom bg-white border-top shadow-sm">
    <div class="container-fluid justify-content-end gap-2 flex-wrap">
      <button type="button" class="btn btn-outline-secondary flex-grow-1 flex-md-grow-0" id="btnCancel">Annuleren</button>
      <button type="button" class="btn btn-primary flex-grow-1 flex-md-grow-0" id="btnSave">Opslaan</button>
      <button type="button" class="btn btn-success flex-grow-1 flex-md-grow-0" id="btnSaveAndCalc">
        <i class="fa-solid fa-calculator me-1"></i> Opslaan &amp; Bereken
      </button>
    </div>
  </nav>
</div>
```

### 3.3 — Replace each `<details class="card">` with an `.accordion-item`

The 11 sections (from Grep: `secBasis`, `secCustomer`, `secSituation`, `secSupplier`, `secWoning`, `secElectrical`, `secCabinet`, `secSolar`, `secCalc`, `secPhotos`, `secCsv`) each currently look like:

```html
<details class="card" id="secBasis" open>
  <summary>…</summary>
  <div class="grid-2"><div class="field">…</div>…</div>
</details>
```

Each is rewritten to:

```html
<div class="accordion-item">
  <h2 class="accordion-header">
    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#secBasis" aria-expanded="true" aria-controls="secBasis">
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
        <!-- … per-field <div class="col-12 col-md-6"> or col-lg-4 … -->
      </div>
    </div>
  </div>
</div>
```

Note: NO `data-bs-parent` attribute — all sections can be open simultaneously (better for a long form).

- [ ] **Step 4: Rewrite section `secBasis` (Basisgegevens)**

Find the current `<details class="card span-2" id="secBasis" open>…</details>` block. Replace with the accordion-item template above. Keep the inner field content identical; only wrap each field with `<div class="col-12 col-md-6">` and the old container with `<div class="row g-3">`.

Field label markup: `<label class="form-label">…</label>` + `<input class="form-control">` + `<div class="form-text">help</div>`.

For required fields: add `<span class="text-danger">*</span>` in the label.

For validation errors: use `<div class="invalid-feedback">…</div>` under the input, and toggle `.is-invalid` on the input element from JS (update `showFieldError(fieldId, msg)` in the script block to do so).

Icon prefix for this section: `fa-id-card`.

- [ ] **Step 5: Rewrite section `secCustomer` (Klantcontact)**

Same pattern. Icon: `fa-user`. Fields: customer name (required), phone, email, address (textarea spanning `col-12`).

- [ ] **Step 6: Rewrite section `secSituation` (Situatie & notities)**

Icon: `fa-clipboard`. Two textareas, each `col-12`.

- [ ] **Step 7: Rewrite section `secSupplier` (Leverancier & tarieven)**

Icon: `fa-plug-circle-bolt`. Fields: name, isSingleTariff (form-switch), priceDay, priceNight. Use `col-12 col-md-6` per field.

- [ ] **Step 8: Rewrite section `secWoning` (Woning)**

Icon: `fa-house`. Age-over-10-years (form-switch, influences BTW). Building type (select). Use `col-12 col-md-6`.

- [ ] **Step 9: Rewrite section `secElectrical` (Elektrische aansluiting)**

Icon: `fa-bolt`. Connection type (select), main fuse (number+A), three-phase switch. Use `col-12 col-md-4` (fits 3 across on md+).

- [ ] **Step 10: Rewrite section `secCabinet` (Zekeringkast)**

Icon: `fa-box`. 5–6 fields (free modules, rem-automaat, wifi reach, socket reach, space-for-batteries, lineGroundChecked).

- [ ] **Step 11: Rewrite section `secSolar` (Omvormers)**

Icon: `fa-solar-panel`. Dynamic list. Replace the outer `<details>` with an accordion-item whose body contains:

```html
<div class="accordion-body">
  <div id="invertersList"></div>
  <button type="button" class="btn btn-outline-primary mt-2" id="btnAddInverter">
    <i class="fa-solid fa-plus me-1"></i> Omvormer toevoegen
  </button>
</div>
```

Update `renderInvertersList()` in the JS to emit per-inverter:

```html
<div class="card mb-2" data-inverter-idx="${idx}">
  <div class="card-body">
    <div class="d-flex justify-content-between align-items-start mb-2">
      <h6 class="mb-0">Omvormer #${idx + 1}</h6>
      <button type="button" class="btn-close" aria-label="Verwijder" data-inverter-remove="${idx}"></button>
    </div>
    <div class="row g-2">
      <div class="col-12 col-md-4">
        <label class="form-label">Vermogen (kW) <span class="text-danger">*</span></label>
        <input type="number" step="0.1" class="form-control inv-power" value="${inv.powerKw || ''}" required>
      </div>
      <div class="col-12 col-md-4">
        <label class="form-label">Merk</label>
        <input type="text" class="form-control inv-brand" value="${escapeHtml(inv.brand || '')}">
      </div>
      <div class="col-12 col-md-4">
        <label class="form-label">Model</label>
        <input type="text" class="form-control inv-model" value="${escapeHtml(inv.model || '')}">
      </div>
      <div class="col-12 col-md-4">
        <label class="form-label"># Panelen</label>
        <input type="number" class="form-control inv-panels" value="${inv.panels || ''}">
      </div>
      <div class="col-12 col-md-4">
        <label class="form-label"># Kringen</label>
        <input type="number" class="form-control inv-circuits" value="${inv.circuits || ''}">
      </div>
      <div class="col-12 col-md-4">
        <label class="form-label">Ligging</label>
        <input type="text" class="form-control inv-orient" value="${escapeHtml(inv.orientation || '')}">
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 12: Rewrite section `secCalc` (Voorkeuren berekening)**

Icon: `fa-calculator`. Fields: BTW override (select 6/21), keuring preference (select yes/no). Use `col-12 col-md-6`.

- [ ] **Step 13: Rewrite section `secPhotos` (Foto's)**

Note: the current file has TWO `secPhotos` entries (lines 797 and 806), which looks like leftover code. Check which one is functional (the `span-2` one at 806 is the active one based on the content). Delete the non-functional one and rewrite the active one as:

```html
<div class="accordion-item">
  <h2 class="accordion-header">
    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#secPhotos">
      <i class="fa-solid fa-images me-2"></i> Foto's <span id="photosCount" class="ms-2 text-muted small"></span>
    </button>
  </h2>
  <div id="secPhotos" class="accordion-collapse collapse show">
    <div class="accordion-body">
      <div class="photo-grid" id="photoGrid">
        <p class="sp-empty-state">⏳ Laden…</p>
      </div>
      <div class="sp-drop-zone" id="photoDropZone">
        <input type="file" id="photoFileInput" accept="image/*" multiple>
        <div>
          <i class="fa-solid fa-cloud-arrow-up me-1"></i>
          Sleep foto's hierheen of klik om te uploaden
        </div>
        <div class="text-muted small mt-1">Max 10 MB per foto · JPG/PNG/WebP</div>
      </div>
      <div class="progress mt-2 d-none" id="photoProgress" style="height:6px;">
        <div class="progress-bar" role="progressbar" style="width:0%"></div>
      </div>
      <div id="photoUploadError" class="text-danger small mt-2 d-none"></div>
    </div>
  </div>
</div>
```

Update JS: where `.pe-drop-zone.drag-over` was toggled, now toggle `.sp-drop-zone.drag-over` (same class name base, new prefix). Progress bar is now Bootstrap `.progress > .progress-bar` — set `.progress-bar.style.width = pct + '%'`.

- [ ] **Step 14: Rewrite section `secCsv` (CSV upload)**

Icon: `fa-file-csv`. Single `<input type=file>` + upload button + preview. Use simple `<div class="row g-2">` layout.

### 3.4 — Sticky action-bar: JS button wiring

- [ ] **Step 15: Verify action-bar IDs match**

The inline script references `btnCancel`, `btnSave`, `btnSaveAndCalc`. These IDs are preserved in Step 3 → nothing to change in JS.

### 3.5 — Lightbox consolidation

- [ ] **Step 16: Replace the project-edit-specific `<div class="lightbox">` with the `.sp-lightbox` pattern**

Find the lightbox `<div>` (search for `id="lightbox"` or `.lightbox-close`). Replace with:

```html
<div class="sp-lightbox" id="photoLightbox" role="dialog" aria-modal="true" aria-label="Foto vergroten">
  <button type="button" class="sp-lightbox-btn close" id="lightboxClose" aria-label="Sluiten">×</button>
  <button type="button" class="sp-lightbox-btn prev"  id="lightboxPrev"  aria-label="Vorige foto">◀</button>
  <img id="lightboxImg" src="" alt="" />
  <button type="button" class="sp-lightbox-btn next"  id="lightboxNext"  aria-label="Volgende foto">▶</button>
  <button type="button" class="sp-lightbox-btn del"   id="lightboxDel"   aria-label="Verwijder foto">🗑</button>
  <div class="counter" id="lightboxCounter">1 / 1</div>
</div>
```

In JS, toggle `.open` on `#photoLightbox` instead of the old `.lightbox` class.

### 3.6 — Bootstrap JS bundle

- [ ] **Step 17: Add the Bootstrap bundle script above the inline `<script>`**

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js" integrity="sha512-1/RvZTcCDEUjY/CypiMz+iqqtaoQfAITmNSJY17Myp4Ms5mdxPS5UV7iOfdZoxcGhzFbOm6sntTKJppjvuhg4g==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
```

### 3.7 — Manual verification

- [ ] **Step 18: Test new-project flow**

```bash
python3 -m http.server
```
Navigate to `http://localhost:8000/project-edit.html?new=1`.

- [ ] Page loads, navbar + accordion + fixed-bottom action-bar all visible
- [ ] All 11 accordion sections render
- [ ] Each section clickable to collapse/expand; multiple can be open simultaneously
- [ ] Click "Opslaan" without required fields → validation error highlights `.is-invalid` inputs, shows `.invalid-feedback` + scrolls to first error
- [ ] Fill projectName + customerName → "Opslaan" succeeds → toast appears → redirect to dashboard
- [ ] "Opslaan & Bereken" → redirects to `index.html?project=<id>#results`
- [ ] "Annuleren" → returns to dashboard

- [ ] **Step 19: Test existing-project edit**

- [ ] Open `?project=<existing-id>` → all fields populated from Firestore
- [ ] Change a field → Opslaan → toast → dashboard shows updated value
- [ ] Add an inverter → `fa-plus` expands list → fill powerKw → Opslaan saves it
- [ ] Remove an inverter with the `btn-close` X → list shrinks
- [ ] Photos: upload via drag-drop AND via click → drop-zone shows `.drag-over` on drag → progress bar moves → photo appears in grid
- [ ] Click photo → lightbox opens → prev/next/delete/close work
- [ ] CSV upload: upload Fluvius file → validation messages readable → upload succeeds

- [ ] **Step 20: Responsive check**

- [ ] Tablet portrait (~768px): each accordion body shows 2-col grid (`col-md-6`)
- [ ] Mobile (~375px): single column; action-bar buttons fill width (flex-grow-1)
- [ ] Sticky action-bar stays visible when scrolling long form
- [ ] Navbar collapses to hamburger on <992px

- [ ] **Step 21: Commit**

```bash
git add project-edit.html
git commit -m "$(cat <<'EOF'
project-edit: migrate to Bootstrap 5.3 (accordion + navbar + action-bar)

- 11 <details class="card"> sections replaced by Bootstrap accordion-items
  (no data-bs-parent — multiple open simultaneously for long-form UX)
- Sticky action-bar uses .navbar.fixed-bottom with flex-grow-1 on mobile
- Form fields use .row.g-3 + .col-md-6 / col-md-4 grids with .form-control,
  .form-label, .form-text, .invalid-feedback + .is-invalid for validation
- Inverter-list items use .card with .btn-close for removal
- Photo upload uses .sp-drop-zone + Bootstrap .progress
- Lightbox unified to .sp-lightbox pattern (shared with producten.html)
- Inline <style> drained from ~165 lines to ~1 line (comment only)
EOF
)"
```

---

## Task 4: Migrate `producten.html`

**Files:**
- Modify: `producten.html` (head, body layout, product-card rendering, lightbox consolidation)

Smallest of the three. The main restructuring is switching the photo-carousel from a custom horizontal-scroll implementation to a Bootstrap Carousel.

### 4.1 — Head

- [ ] **Step 1: Add Bootstrap CSS + smartpeak.css**

Same 3-line insertion after the Font Awesome `<link>`.

- [ ] **Step 2: Drain the `<style>` block**

Replace with:

```css
    /* Page-specific rules only. Globals live in assets/css/smartpeak.css. */
    /* Carousel slide image constraint */
    .carousel-inner .carousel-item img { max-height: 380px; object-fit: contain; width: 100%; background: #f7f9fd; }
```

All of `.card`, `.photo-section`, `.photo-carousel`, `.photo-item`, `.lightbox*`, `.back-link`, `.config-banner`, `.em-dash`, `body`, etc. are removed. One rule stays: the carousel-image height cap (page-specific product-photo convention).

### 4.2 — Body structure

- [ ] **Step 3: Replace the head section above `<main>`**

Current:
```html
<h1>⚡ SmartPeak — Productspecs</h1>
<p class="subtitle">Technische informatie voor uw geselecteerde configuratie.</p>
<a href="index.html" class="back-link">← Terug naar calculator</a>
<main id="content"></main>
```

Replace with:

```html
<nav class="navbar navbar-expand-lg bg-white border-bottom sticky-top">
  <div class="container-fluid">
    <span class="navbar-brand mb-0 h1"><i class="fa-solid fa-bolt text-primary"></i> SmartPeak — Productspecs</span>
    <div class="ms-auto">
      <a href="index.html" class="btn btn-sm btn-outline-secondary">
        <i class="fa-solid fa-arrow-left me-1"></i> Calculator
      </a>
    </div>
  </div>
</nav>

<main class="container py-4" id="content"></main>
```

- [ ] **Step 4: Replace the lightbox**

Find the existing `<div class="lightbox" id="lightbox">…</div>` block and replace with the shared `.sp-lightbox` pattern:

```html
<div class="sp-lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="Foto vergroten">
  <button type="button" class="sp-lightbox-btn close" id="lightboxClose" aria-label="Sluiten">×</button>
  <button type="button" class="sp-lightbox-btn prev"  id="lightboxPrev"  aria-label="Vorige foto">◀</button>
  <img id="lightboxImg" src="" alt="" />
  <button type="button" class="sp-lightbox-btn next"  id="lightboxNext"  aria-label="Volgende foto">▶</button>
  <div class="counter" id="lightboxCounter">1 / 1</div>
</div>
```

In the inline JS, the `openLightbox`/`closeLightbox` functions currently toggle `.lightbox.open`. Since the new element still has `id="lightbox"` and we toggle `.open`, and smartpeak.css defines `.sp-lightbox.open`, we need to either:
- Rename the ID references to `#sp-lightbox` and toggle `.sp-lightbox.open`, OR
- Add a trivial compat rule `#lightbox.open { display: flex; }` — NO, that's ugly

Best: change the JS references. Find `document.getElementById('lightbox')` and related. Change the class toggled from `'open'` to work on `.sp-lightbox` (the element already has that class). Since both `.lightbox.open` and `.sp-lightbox.open` both use `display: flex`, the logic is the same — only the *class applied to the element* changed from `.lightbox` to `.sp-lightbox`. Nothing needs to change in JS; it toggles `.open` on the element regardless.

### 4.3 — Photo carousel → Bootstrap Carousel

- [ ] **Step 5: Rewrite `renderCarousel(images)` in the inline JS**

Find the function around line ~327. Current implementation creates a horizontal-scroll div. Replace entirely with:

```js
let _carouselIdCounter = 0;
function renderCarousel(images) {
  const id = 'prodCarousel' + (++_carouselIdCounter);
  if (!images || images.length === 0) {
    return `
      <section class="card mb-4">
        <div class="card-body">
          <h2 class="h5 mb-3"><i class="fa-solid fa-camera me-2"></i> Foto's</h2>
          <p class="text-muted fst-italic">Foto's volgen.</p>
        </div>
      </section>
    `;
  }
  const indicators = images.map((_, i) => `
    <button type="button" data-bs-target="#${id}" data-bs-slide-to="${i}"
            ${i === 0 ? 'class="active" aria-current="true"' : ''}
            aria-label="Foto ${i + 1}"></button>
  `).join('');
  const slides = images.map((src, i) => `
    <div class="carousel-item ${i === 0 ? 'active' : ''}">
      <img src="${src}" alt="Productfoto ${i + 1}" data-photo-idx="${i}" class="d-block mx-auto" />
    </div>
  `).join('');
  return `
    <section class="card mb-4">
      <div class="card-body">
        <h2 class="h5 mb-3"><i class="fa-solid fa-camera me-2"></i> Foto's</h2>
        <p class="text-muted small">Gebruik de pijltjes of klik op een foto om te vergroten.</p>
        <div id="${id}" class="carousel slide" data-bs-ride="false" data-bs-interval="false">
          <div class="carousel-indicators">${indicators}</div>
          <div class="carousel-inner">${slides}</div>
          <button class="carousel-control-prev" type="button" data-bs-target="#${id}" data-bs-slide="prev">
            <span class="carousel-control-prev-icon" aria-hidden="true"></span>
            <span class="visually-hidden">Vorige</span>
          </button>
          <button class="carousel-control-next" type="button" data-bs-target="#${id}" data-bs-slide="next">
            <span class="carousel-control-next-icon" aria-hidden="true"></span>
            <span class="visually-hidden">Volgende</span>
          </button>
        </div>
      </div>
    </section>
  `;
}
```

The lightbox click-handler already listens for `img[data-photo-idx]` inside `#content` — unchanged.

**Important:** the current carousel supports horizontal drag-swipe. Bootstrap Carousel has built-in swipe support (`data-bs-touch="true"` is the default). No extra code needed for touch gestures.

### 4.4 — Product config-banners

- [ ] **Step 6: Update banner markup**

Find `<div class="card config-banner">` usages (2 occurrences). Replace each with:

```html
<div class="alert alert-warning d-flex align-items-center" role="alert">
  <i class="fa-solid fa-triangle-exclamation me-2"></i>
  <div>Configuratie-details zijn afkomstig uit de productopgave van de fabrikant…</div>
</div>
```

(Adjust the inner message to match the current text.)

### 4.5 — Specs renderer

- [ ] **Step 7: Update `renderSpecs(item)` or equivalent spec-block to use Bootstrap `<dl class="row">`**

Find where specs are rendered. Replace the current custom-styled list with:

```html
<section class="card mb-4">
  <div class="card-body">
    <h2 class="h5 mb-3"><i class="fa-solid fa-list-check me-2"></i> Specificaties</h2>
    <dl class="row mb-0 small">
      <dt class="col-sm-5 col-md-4">Capaciteit (nominaal)</dt>
      <dd class="col-sm-7 col-md-8">${fmtKwh(spec.capacity)} kWh</dd>
      <!-- etc per key -->
    </dl>
  </div>
</section>
```

### 4.6 — Bootstrap JS bundle

- [ ] **Step 8: Add the Bootstrap bundle `<script>` above the inline `<script>`**

Same line as before:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js" integrity="sha512-1/RvZTcCDEUjY/CypiMz+iqqtaoQfAITmNSJY17Myp4Ms5mdxPS5UV7iOfdZoxcGhzFbOm6sntTKJppjvuhg4g==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
```

### 4.7 — Manual verification

- [ ] **Step 9: Test in browser**

```bash
python3 -m http.server
```
Navigate to `http://localhost:8000/producten.html?cfg=marstek_4` (or whichever config param the page accepts).

- [ ] Navbar with back-link shows
- [ ] Product card renders with correct brand + description
- [ ] Photo carousel: indicators at bottom, prev/next arrows on sides
- [ ] Click prev/next → slide changes with fade/slide animation
- [ ] Click indicator → jump to that slide
- [ ] Click active slide image → lightbox opens with that photo → prev/next/close work → closes cleanly
- [ ] Specs `<dl>` renders in 2-column layout on ≥sm, single column on xs
- [ ] Config-banners render as `.alert.alert-warning` with icon

- [ ] **Step 10: Responsive check**

- [ ] Mobile (375px): carousel fills width, indicators visible, swipe gesture works
- [ ] Tablet (768px): carousel + specs show side-by-side? If you want side-by-side, wrap the whole product block in `<div class="row g-3"><div class="col-lg-5">…carousel…</div><div class="col-lg-7">…specs…</div></div>`. **Default: single column** because specs are long.

- [ ] **Step 11: Commit**

```bash
git add producten.html
git commit -m "$(cat <<'EOF'
producten: migrate to Bootstrap 5.3 (navbar + carousel + alert banners)

- Replace custom photo-carousel with Bootstrap Carousel (indicators + controls)
- Navbar pattern unified with dashboard + project-edit
- Config-banners use .alert.alert-warning
- Specs use <dl class="row"> for responsive 2-col layout
- Lightbox consolidated to .sp-lightbox (from smartpeak.css)
- Inline <style> drained from ~240 lines to ~2 lines (carousel img cap only)
EOF
)"
```

---

## Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Document the new styling stack so future agents know that `smartpeak.css` is the single source of truth for UI styling across the backoffice.

- [ ] **Step 1: Read the current CLAUDE.md to find the right place to insert**

Open `CLAUDE.md`. Find the section near the top where file layout is described (around "`style.css`, `script.js` — dead code"). Add a new paragraph right below the file-layout section.

- [ ] **Step 2: Edit CLAUDE.md to add the new section**

Add the following, positioned after the `File layout` section but before `How to work on it`:

```markdown
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
- Kanban board, lightbox, photo-grid, drop-zone → app-specific CSS in
  `smartpeak.css` (no Bootstrap equivalents)
- Accordion sections in `project-edit.html` → no `data-bs-parent` (multiple
  sections open simultaneously for long-form UX)

**Responsive breakpoints (hard-coded gates):**
- `< md` (< 768px): hamburger navbar, minimal table columns, full-width offcanvas
- `md – lg` (768–991px): tablets portrait, view-toggle still hidden
- `≥ lg` (≥ 992px): kanban-toggle visible (JS force-downgrades to list view
  under this threshold), 420px offcanvas

**SRI hashes for Bootstrap 5.3.3 (cdnjs):**
- CSS: `sha512-jnSuA4Ss2PkkikSOLtYs8BlYIeeIK1h99ty4YfvRPAlzr377vr3CXDb7sb7eEEBYjDtcYj+AjBH3FLv5uSJuSg==`
- JS:  `sha512-1/RvZTcCDEUjY/CypiMz+iqqtaoQfAITmNSJY17Myp4Ms5mdxPS5UV7iOfdZoxcGhzFbOm6sntTKJppjvuhg4g==`
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
CLAUDE.md: document Bootstrap 5.3 styling stack + smartpeak.css

Records the 2026-04-22 backoffice migration: Bootstrap CDN + single
smartpeak.css source of truth, component conventions (offcanvas, modal,
dropdown, toast), responsive breakpoint gates, and pinned SRI hashes.
EOF
)"
```

---

## Final verification

- [ ] **Step 1: Cross-page smoke test**

```bash
python3 -m http.server
```

With local server running:
- [ ] Open `http://localhost:8000/dashboard.html` → log in → see project list
- [ ] Click a project → drawer opens with photos + comments
- [ ] Click "Bewerk" in drawer → `project-edit.html` loads → all accordion sections render
- [ ] Navigate back to dashboard, click "+ Nieuw project" → new-project edit page loads
- [ ] Fill required fields → Opslaan → redirect back to dashboard → new project shows in list
- [ ] Navigate to `producten.html?type=marstek_4` (or existing config) → page renders with carousel + specs
- [ ] No console errors across all pages

- [ ] **Step 1b: URL back-compat smoke test**

- [ ] `dashboard.html` (no query) loads dashboard (auth-gated)
- [ ] `project-edit.html?new=1` loads empty edit form
- [ ] `project-edit.html?project=<existing-id>` loads pre-filled form
- [ ] `index.html?project=<id>#results` still auto-scrolls to results (unchanged — index.html not touched)
- [ ] `index.html?s=<share-id>` still renders read-only share view (unchanged)
- [ ] `producten.html` with expected query params still shows the right product

- [ ] **Step 2: Cross-browser sanity check**

Open `dashboard.html` in:
- [ ] Chrome desktop
- [ ] Safari desktop (if macOS available)
- [ ] Chrome mobile emulator at 375×667 (iPhone SE)
- [ ] Chrome mobile emulator at 1024×768 (iPad)

- [ ] **Step 3: Confirm `<style>` blocks are empty or near-empty**

Run:
```bash
grep -c "^\s*<style>$\|^\s*</style>$" dashboard.html project-edit.html producten.html
```
Expected: 2 matches per file (open + close tag).

For each file, read the block between `<style>` and `</style>` — it should be either:
- Just a comment, OR
- A handful of genuinely page-specific rules

If a file has >30 lines of inline CSS, something got missed. Move it to `smartpeak.css`.

- [ ] **Step 4: Summary commit (optional — if any cleanup was needed)**

If Step 3 revealed stragglers, create one last commit:

```bash
git add dashboard.html project-edit.html producten.html assets/css/smartpeak.css
git commit -m "style: final cleanup of inline CSS blocks in backoffice pages"
```

---

## Risks & rollback

**Rollback plan:** each task is a single commit. To revert any file:

```bash
git revert <commit-hash>
```

`smartpeak.css` can stay even if one of the HTML migrations is reverted — the file will be referenced by fewer HTML files but still works for the others.

**Known risks (also in spec):**

1. **Bootstrap JS init ordering** — if the inline script at the end of `<body>` runs before `bootstrap.bundle.min.js` is evaluated, calls to `bootstrap.X.getOrCreateInstance` throw "bootstrap is not defined". Mitigation: the `<script src>` tag comes FIRST in document order, so it executes before the inline `<script>` regardless of network timing (both are parser-blocking scripts).

2. **Offcanvas + `<input type=file>` focus conflict** — verify foto/offerte uploads still open the OS file-picker from inside offcanvas. If not, add `data-bs-focus="false"` on the offcanvas or move the picker outside.

3. **Kanban drag-drop** — native HTML5 drag API works independent of Bootstrap. The `.kanban-card.dragging` visual state is in smartpeak.css. Test drag between columns after migration.

4. **Share-link (`index.html`) readonly** — out of scope but the `.readonly-mode` CSS lives in smartpeak.css for future use; `index.html` still has its own inline readonly rules and is not touched.

5. **Missing Firebase whitelist** — if the executing engineer isn't whitelisted, they cannot load the dashboard. Ask the user to add the engineer's email to the whitelist in `firebase-init.js` BEFORE starting, OR use a Firebase emulator (out of scope for this plan — document as "known limitation" if it comes up).
