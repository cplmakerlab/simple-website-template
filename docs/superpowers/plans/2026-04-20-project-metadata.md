# Project Metadata Uitbreiding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoist many per-calculation inputs from `index.html` up to project level via a new `project-edit.html` page, extend the Firestore project schema with site/electrical/cabinet/solar/supplier/calcDefaults sections, and make `index.html` project-mode show a collapsible "Projectgegevens" summary while hiding form fields the project already provides.

**Architecture:** No build step. Firebase compat SDK via CDN, identical to Phase 1. New standalone `project-edit.html` handles create-and-edit (auth-guarded). `dashboard.html` loses its inline new-project modal; the button redirects to `project-edit.html?new=1`. `index.html` bare and `?data=<b64>` modes stay untouched — all changes are conditional on `?project=<id>`. All new Firestore fields are additive — readers that encounter a pre-existing project without them fall back to defaults via a pure helper.

**Tech Stack:** Plain HTML/CSS/JS, Firebase JS SDK 10.13.2 (compat build), Firestore, Firebase Auth.

**Spec:** `docs/superpowers/specs/2026-04-20-project-metadata-design.md` — read before starting.

---

## File map

- **NEW:** `project-edit.html` — full-page form for creating/editing a project. Auth-gated (same whitelist as dashboard). 8 sections, mobile-first single column, sticky action bar.
- **MODIFY:** `assets/js/firebase-init.js` — add `CONNECTION_TYPES` constant, `newEmptyProjectMetadata()`, `updateProjectMetadata()`, `effectiveBtwFor()`, `totalInverterPowerKw()`; extend `createProject()` to accept optional `metadata`.
- **MODIFY:** `dashboard.html` — remove the new-project modal (`#newProjectBackdrop` + `#newProjectForm` + handlers + related CSS). Change `#btnNewProject` to redirect to `project-edit.html?new=1`. Add a new "✏" action button per row linking to `project-edit.html?project=<id>`.
- **MODIFY:** `index.html` — insert a new "Projectgegevens" `<details>` card in project-mode only (between banner and CSV upload card). Hide form fields for which project provides a value. Add sync-back logic in the Bereken flow.
- **MODIFY:** `CLAUDE.md` — document the new architecture (project-edit page + expanded schema + sync-back rules).

## Working directory

`/home/ubuntu/battery-roi-tool`. Work directly on `gh-pages`. One commit per task. Do not push — Kevin pushes manually when ready.

## Notes for the implementer

- UI text is in Dutch (`nl-BE`).
- No test suite exists. Verification = `grep` / Read checks for structural correctness plus a manual browser smoke pass (Kevin's responsibility at the end).
- All new Firestore fields are additive + nullable — existing pre-2026-04-20 projects must keep working without migration. Readers merge via `newEmptyProjectMetadata()`.
- Phase 1 conventions (compat SDK, public-by-design config, soft-delete, last-write-wins) stay unchanged.
- The spec is the single source of truth. If you find yourself inventing behavior not in the spec, stop and ask.
- Don't push (`git push`); only commit.

---

### Task 1: Extend `firebase-init.js` with metadata helpers

**Files:**
- Modify: `assets/js/firebase-init.js` (add ~60 lines; modify `createProject()` signature at `106-129`)

This adds the schema building blocks and pure helpers. No UI yet, no caller changes yet.

- [ ] **Step 1: Add `CONNECTION_TYPES` constant**

In `assets/js/firebase-init.js`, immediately after the `DEFAULT_STATUS` line (`const DEFAULT_STATUS = 'nieuw_contact';`), insert:

```js
// ─── CONNECTION TYPES ────────────────────────────────────────────────────────
const CONNECTION_TYPES = ['1x230', '3x230', '3x400+N'];
```

- [ ] **Step 2: Add `newEmptyProjectMetadata()` pure helper**

Still in `firebase-init.js`, immediately after the `CONNECTION_TYPES` line, add:

```js
// ─── PROJECT METADATA HELPERS ────────────────────────────────────────────────
// Default-empty structure for the 6 metadata sections added in the 2026-04-20
// expansion. Readers merge a project's stored sections over this so pre-2026-04-20
// projects (without these fields) behave identically to empty-new ones.
function newEmptyProjectMetadata() {
  return {
    site: {
      houseAgeOver10Years: null,
    },
    electrical: {
      connectionType: null,
      fuseRatingA:    null,
    },
    cabinet: {
      freeUnits:              null,
      hasRemAutomaat:         null,
      wiringDiameterMm2:      null,
      hasOutletNearFluvius:   null,
      hasWifiNearFluvius:     null,
      batteryPlacementRoom:   null,
      hasWifiNearCabinet:     null,
    },
    solar: {
      inverters: [],
    },
    supplier: {
      name:           null,
      isSingleTariff: false,
      priceDay:       null,
      priceNight:     null,
    },
    calcDefaults: {
      btw:     null,
      keuring: null,
    },
  };
}

// Merge a project doc's metadata sections over the default-empty shape. Returns
// a complete metadata object regardless of which sections the doc contains.
function mergeProjectMetadata(project) {
  const empty = newEmptyProjectMetadata();
  if (!project) return empty;
  return {
    site:         { ...empty.site,         ...(project.site || {}) },
    electrical:   { ...empty.electrical,   ...(project.electrical || {}) },
    cabinet:      { ...empty.cabinet,      ...(project.cabinet || {}) },
    solar:        { ...empty.solar,        ...(project.solar || {}) },
    supplier:     { ...empty.supplier,     ...(project.supplier || {}) },
    calcDefaults: { ...empty.calcDefaults, ...(project.calcDefaults || {}) },
  };
}

// BTW afleidingsregel (single source of truth).
//   houseAgeOver10Years === true  → 6
//   houseAgeOver10Years === false → 21
//   houseAgeOver10Years === null  → calcDefaults.btw (may be null)
function effectiveBtwFor(project) {
  const m = mergeProjectMetadata(project);
  if (m.site.houseAgeOver10Years === true)  return 6;
  if (m.site.houseAgeOver10Years === false) return 21;
  return m.calcDefaults.btw;
}

// Sum of powerKw over all solar.inverters entries. Returns 0 if no inverters.
function totalInverterPowerKw(project) {
  const m = mergeProjectMetadata(project);
  return m.solar.inverters.reduce((sum, inv) => sum + (Number(inv.powerKw) || 0), 0);
}
```

- [ ] **Step 3: Add `updateProjectMetadata()` helper**

After the existing `updateProjectStatus()` function (around line 148), insert:

```js
// Patch a subset of the metadata sections on a project doc. `patch` is an object
// with top-level keys among { site, electrical, cabinet, solar, supplier, calcDefaults };
// each value is a partial object for that section. Written with {merge:true} so other
// keys on the same section are preserved. updatedAt is always refreshed.
async function updateProjectMetadata(id, patch) {
  const data = { ...patch, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  await projectDoc(id).set(data, { merge: true });
}
```

- [ ] **Step 4: Extend `createProject()` to accept optional `metadata`**

Replace the current `createProject` (starts around line 106) with:

```js
// Create a project. csvData is the optional output of extractCsvForStorage(); pass null
// if no CSV was uploaded at creation. `metadata` is an optional object with any subset
// of { site, electrical, cabinet, solar, supplier, calcDefaults } — if omitted, the
// document is created without those sections (pre-2026-04-20 shape; readers fall back
// via mergeProjectMetadata). Returns the new document reference.
async function createProject({ projectName, customerName, status, csvData, metadata }) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const doc = {
    projectName,
    customerName,
    status:     status || DEFAULT_STATUS,
    createdBy:  email,
    createdAt:  now,
    updatedAt:  now,
    deletedAt:  null,
    csvUpload:  csvData ? {
      uploadedAt:  now,
      uploadedBy:  email,
      eanCode:     csvData.eanCode,
      meterNr:     csvData.meterNr,
      meterType:   csvData.meterType,
      dailyCompact: csvData.dailyCompact,
    } : null,
    lastCalcRun: null,
  };
  if (metadata) {
    if (metadata.site)         doc.site         = metadata.site;
    if (metadata.electrical)   doc.electrical   = metadata.electrical;
    if (metadata.cabinet)      doc.cabinet      = metadata.cabinet;
    if (metadata.solar)        doc.solar        = metadata.solar;
    if (metadata.supplier)     doc.supplier     = metadata.supplier;
    if (metadata.calcDefaults) doc.calcDefaults = metadata.calcDefaults;
  }
  return projectsCol().add(doc);
}
```

- [ ] **Step 5: Verify no consumer broke**

Run:

```bash
grep -nE 'createProject\s*\(' dashboard.html index.html project-edit.html 2>/dev/null
```

Expected: only the existing call in `dashboard.html` appears (no `metadata` key). The new optional param is non-breaking.

Also grep to confirm the new identifiers:

```bash
grep -nE 'newEmptyProjectMetadata|mergeProjectMetadata|effectiveBtwFor|totalInverterPowerKw|updateProjectMetadata|CONNECTION_TYPES' assets/js/firebase-init.js
```

Expected: ≥6 matches (one per identifier, in the new code).

- [ ] **Step 6: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "firebase-init: add project metadata helpers + createProject metadata param"
```

---

### Task 2: `project-edit.html` — skeleton, auth guard, topbar

**Files:**
- Create: `project-edit.html`

Bootstraps the new page. Renders the three auth states (identical to `dashboard.html`), a topbar, an empty `<main id="form">` container, and a sticky action bar. Sections come in later tasks.

- [ ] **Step 1: Create the file**

Create `project-edit.html` with exactly this content:

```html
<!DOCTYPE html>
<html lang="nl-BE">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SmartPeak — Project bewerken</title>

  <!-- Firebase compat SDK (same versions as dashboard.html) -->
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js"></script>

  <script src="assets/js/csv.js"></script>
  <script src="assets/js/firebase-init.js"></script>

  <style>
    :root {
      --primary:#2c7be5; --primary-dark:#1e5fb8;
      --bg:#f4f7fc; --card:#fff; --text:#1c2939;
      --muted:#6b7589; --danger:#e54545; --success:#00b478;
    }
    * { box-sizing: border-box; }
    body {
      margin:0; padding:0 16px 120px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg); color: var(--text);
    }
    .topbar {
      position: sticky; top:0; background: var(--bg); padding:12px 0;
      display:flex; gap:12px; align-items:center; justify-content:space-between;
      border-bottom: 1px solid #e4e9f2; z-index:10;
    }
    .topbar h1 { font-size:1.1rem; margin:0; }
    .topbar .right { display:flex; gap:8px; align-items:center; font-size:0.9rem; color:var(--muted); }
    main { max-width: 760px; margin: 0 auto; padding-top: 12px; }
    .card {
      background: var(--card); border-radius: 10px; padding: 16px;
      margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .card > summary { list-style: none; cursor: pointer;
      display:flex; align-items:center; justify-content:space-between;
      font-weight: 600; font-size: 1.05rem; }
    .card > summary::-webkit-details-marker { display:none; }
    .card > summary::after { content: "▼"; font-size:0.7rem; color: var(--muted); transition: transform 0.15s; }
    .card[open] > summary::after { transform: rotate(180deg); }
    .section-body { padding-top: 14px; }
    .form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .form-row label { font-size: 0.85rem; font-weight: 600; color: #4a5568; }
    .form-row input, .form-row select, .form-row textarea {
      border: 1.5px solid #d4dae5; border-radius: 8px; padding: 10px 12px;
      font-size: 0.95rem; background: #f7f9fd; transition: border-color 0.15s;
    }
    .form-row input:focus, .form-row select:focus, .form-row textarea:focus {
      outline: none; border-color: var(--primary); background: #fff;
    }
    .form-row .help, .help { color: var(--muted); font-size: 0.82rem; margin-top: 4px; }
    .form-row .error { color: var(--danger); font-size: 0.85rem; margin-top: 4px; }
    .required::after { content: " *"; color: var(--danger); }
    .tri-state { display:flex; gap:8px; flex-wrap:wrap; }
    .tri-state label { display:flex; align-items:center; gap:6px; font-weight:400; cursor:pointer; }
    .action-bar {
      position: fixed; bottom:0; left:0; right:0; background:#fff;
      padding: 12px 16px; border-top: 1px solid #e4e9f2; z-index:20;
      display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;
    }
    .btn {
      display:inline-flex; align-items:center; gap:6px;
      padding:10px 16px; border-radius:8px; border:none;
      background: var(--primary); color:#fff; font-weight:600; cursor:pointer;
      font-size: 0.95rem; text-decoration:none;
    }
    .btn:hover { background: var(--primary-dark); }
    .btn:disabled { opacity:0.6; cursor:not-allowed; }
    .btn-secondary { background:#e4e9f2; color: var(--text); }
    .btn-secondary:hover { background:#d4dae5; }
    .btn-danger { background: var(--danger); }
    .alert { padding:10px 12px; border-radius:8px; font-size:0.9rem; margin-top:10px; }
    .alert-error { background:#fde8e8; color:#a00; }
    .alert-warning { background:#fff4dc; color:#8a6000; }
    .alert-success { background:#def5ea; color:#0a6e4a; }
    .hide { display:none !important; }
    .center-card { max-width: 480px; margin: 60px auto; text-align: center; }
    .toast {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      background: var(--success); color:#fff; padding:10px 18px; border-radius:8px;
      font-size:0.9rem; z-index: 30; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    @media (min-width: 768px) {
      body { padding: 0 24px 100px; }
      .topbar h1 { font-size: 1.3rem; }
    }
  </style>
</head>
<body>

<!-- State 1: not logged in -->
<div class="card center-card" id="stateLoggedOut">
  <h1>⚡ SmartPeak — Project bewerken</h1>
  <p class="help">Alleen voor Bloxit medewerkers.</p>
  <button type="button" class="btn" id="btnSignIn">Log in met Google</button>
  <p id="signInError" class="alert alert-error hide" style="margin-top:16px;"></p>
</div>

<!-- State 2: logged in but not whitelisted -->
<div class="card center-card hide" id="stateNotWhitelisted">
  <h1>⚠️ Geen toegang</h1>
  <p class="help">Je bent ingelogd als <strong id="notWhitelistedEmail">…</strong> maar dit account heeft geen toegang tot SmartPeak Projecten.</p>
  <button type="button" class="btn btn-secondary" id="btnSignOutNW">Uitlog</button>
</div>

<!-- State 3: logged in + whitelisted -->
<div class="hide" id="stateAuthorized">
  <div class="topbar">
    <h1 id="pageTitle">⚡ Nieuw project</h1>
    <div class="right">
      <a href="dashboard.html" class="btn btn-secondary">← Dashboard</a>
    </div>
  </div>

  <main id="form">
    <!-- Sections injected by renderSections() in later tasks -->
    <div id="formSections"></div>
    <div id="globalError" class="alert alert-error hide"></div>
  </main>

  <div class="action-bar">
    <button type="button" class="btn btn-secondary" id="btnCancel">Annuleren</button>
    <button type="button" class="btn" id="btnSave">Opslaan</button>
    <button type="button" class="btn" id="btnSaveAndCalc">Opslaan &amp; Bereken</button>
  </div>
</div>

<script>
// ─── STATE ───────────────────────────────────────────────────────────────────
const URL_PARAMS = new URLSearchParams(window.location.search);
const IS_NEW     = URL_PARAMS.has('new');
const PROJECT_ID = IS_NEW ? null : URL_PARAMS.get('project');

// Current working project state (metadata + basisgegevens). Populated on load.
let _project = null;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function showState(which) {
  ['stateLoggedOut', 'stateNotWhitelisted', 'stateAuthorized'].forEach(id => {
    document.getElementById(id).classList.toggle('hide', id !== which);
  });
}

function showError(msg) {
  const el = document.getElementById('globalError');
  el.textContent = msg;
  el.classList.remove('hide');
}
function clearError() { document.getElementById('globalError').classList.add('hide'); }

function showToast(msg, kind) {
  const t = document.createElement('div');
  t.className = 'toast';
  if (kind === 'error') t.style.background = 'var(--danger)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnSignIn').addEventListener('click', async () => {
    const errEl = document.getElementById('signInError');
    errEl.classList.add('hide');
    try { await signInWithGoogle(); }
    catch (e) {
      errEl.textContent = 'Aanmelden mislukt: ' + (e && e.message ? e.message : e);
      errEl.classList.remove('hide');
    }
  });
  document.getElementById('btnSignOutNW').addEventListener('click', () => signOut());
  document.getElementById('btnCancel').addEventListener('click', () => { window.location.href = 'dashboard.html'; });

  onAuthStateChanged(async user => {
    if (!user) { showState('stateLoggedOut'); return; }
    if (!isWhitelisted(user)) {
      document.getElementById('notWhitelistedEmail').textContent = user.email || '(onbekend)';
      showState('stateNotWhitelisted');
      return;
    }
    showState('stateAuthorized');
    try { await bootstrap(); }
    catch (e) { showError('Laden mislukt: ' + (e && e.message ? e.message : e)); }
  });
});

async function bootstrap() {
  if (IS_NEW) {
    _project = {
      projectName: '',
      customerName: '',
      status: DEFAULT_STATUS,
      ...newEmptyProjectMetadata(),
      csvUpload: null,
    };
    document.getElementById('pageTitle').textContent = '⚡ Nieuw project';
  } else {
    if (!PROJECT_ID) { showError('Geen project-id opgegeven.'); return; }
    const proj = await getProject(PROJECT_ID);
    if (!proj || proj.deletedAt) { showError('Project niet gevonden of verwijderd.'); return; }
    _project = {
      ...proj,
      ...mergeProjectMetadata(proj),
    };
    document.getElementById('pageTitle').textContent = '✏ ' + (proj.projectName || 'Project');
  }
  renderSections();
  wireActions();
}

// Placeholder — later tasks fill renderSections() and wireActions().
function renderSections() {
  document.getElementById('formSections').innerHTML =
    '<div class="card"><div class="section-body">Form wordt in latere taken ingevuld.</div></div>';
}

function wireActions() {
  document.getElementById('btnSave').addEventListener('click', () => showError('Opslaan komt in latere taak.'));
  document.getElementById('btnSaveAndCalc').addEventListener('click', () => showError('Opslaan & Bereken komt in latere taak.'));
}
</script>

</body>
</html>
```

- [ ] **Step 2: Verify file exists and contains expected identifiers**

```bash
grep -cE 'stateLoggedOut|stateNotWhitelisted|stateAuthorized|bootstrap|renderSections|wireActions|_project' project-edit.html
```

Expected: ≥7.

- [ ] **Step 3: Commit**

```bash
git add project-edit.html
git commit -m "project-edit: add auth-gated page skeleton with topbar + action bar"
```

---

### Task 3: Section 1 (Basisgegevens) + save flow

**Files:**
- Modify: `project-edit.html` (replace `renderSections()` and `wireActions()`, add `collectFromForm()` + `save()`)

Now the form actually does something: projectName, customerName, status. Save creates on `?new=1`, patches on `?project=<id>`.

- [ ] **Step 1: Replace `renderSections()` placeholder**

In `project-edit.html`, replace the placeholder `renderSections()` function with:

```js
function renderSections() {
  const host = document.getElementById('formSections');
  host.innerHTML = sectionBasisgegevens();
  wireSectionBasisgegevens();
}

function sectionBasisgegevens() {
  const p = _project;
  const statusOpts = PROJECT_STATUSES.map(s =>
    `<option value="${s.key}" ${s.key === (p.status || DEFAULT_STATUS) ? 'selected' : ''}>${escapeHtml(s.label)}</option>`
  ).join('');
  return `
    <details class="card" id="secBasis" open>
      <summary>📝 Basisgegevens</summary>
      <div class="section-body">
        <div class="form-row">
          <label class="required" for="fProjectName">Projectnaam</label>
          <input type="text" id="fProjectName" maxlength="120" value="${escapeHtml(p.projectName)}" />
        </div>
        <div class="form-row">
          <label class="required" for="fCustomerName">Klantnaam</label>
          <input type="text" id="fCustomerName" maxlength="120" value="${escapeHtml(p.customerName)}" />
        </div>
        <div class="form-row">
          <label for="fStatus">Status</label>
          <select id="fStatus">${statusOpts}</select>
        </div>
      </div>
    </details>
  `;
}

function wireSectionBasisgegevens() {
  // Live-update _project on blur so other sections reading _project stay in sync.
  document.getElementById('fProjectName').addEventListener('input', e => { _project.projectName = e.target.value; });
  document.getElementById('fCustomerName').addEventListener('input', e => { _project.customerName = e.target.value; });
  document.getElementById('fStatus').addEventListener('change', e => { _project.status = e.target.value; });
}
```

- [ ] **Step 2: Replace `wireActions()` with real save handlers**

Replace the placeholder `wireActions()` function with:

```js
function wireActions() {
  document.getElementById('btnSave').addEventListener('click', () => save({ andCalc: false }));
  document.getElementById('btnSaveAndCalc').addEventListener('click', () => save({ andCalc: true }));
}

// Gather the save payload from _project. Extracted so later sections all just
// mutate _project on input and the save flow reads the full object uniformly.
function collectFromForm() {
  // Basisgegevens
  const projectName  = (_project.projectName  || '').trim();
  const customerName = (_project.customerName || '').trim();
  if (!projectName)  throw new Error('Projectnaam is verplicht.');
  if (!customerName) throw new Error('Klantnaam is verplicht.');

  // Inverter-verplichting (ingevuld in Task 7): elk inverter-kaartje moet powerKw > 0 hebben.
  for (let i = 0; i < _project.solar.inverters.length; i++) {
    const inv = _project.solar.inverters[i];
    if (!(Number(inv.powerKw) > 0)) {
      throw new Error(`Omvormer ${i + 1}: vermogen (kW) is verplicht als de omvormer in de lijst staat.`);
    }
  }

  const metadata = {
    site:         _project.site,
    electrical:   _project.electrical,
    cabinet:      _project.cabinet,
    solar:        _project.solar,
    supplier:     _project.supplier,
    calcDefaults: _project.calcDefaults,
  };
  return { projectName, customerName, status: _project.status || DEFAULT_STATUS, metadata };
}

async function save({ andCalc }) {
  clearError();
  const btnSave = document.getElementById('btnSave');
  const btnSC   = document.getElementById('btnSaveAndCalc');
  btnSave.disabled = true; btnSC.disabled = true;
  const prevLabel = btnSave.textContent;
  btnSave.textContent = 'Bezig…';
  try {
    const payload = collectFromForm();
    let targetId;
    if (IS_NEW) {
      const ref = await createProject({
        projectName:  payload.projectName,
        customerName: payload.customerName,
        status:       payload.status,
        csvData:      null,              // CSV sectie komt in Task 8
        metadata:     payload.metadata,
      });
      targetId = ref.id;
    } else {
      await updateProjectMetadata(PROJECT_ID, {
        projectName:  payload.projectName,
        customerName: payload.customerName,
        status:       payload.status,
        ...payload.metadata,
      });
      targetId = PROJECT_ID;
    }
    if (andCalc) {
      window.location.href = `index.html?project=${targetId}`;
    } else {
      window.location.href = 'dashboard.html';
    }
  } catch (e) {
    showError(e && e.message ? e.message : String(e));
    btnSave.disabled = false; btnSC.disabled = false;
    btnSave.textContent = prevLabel;
  }
}
```

- [ ] **Step 3: Verify structural correctness**

```bash
grep -nE 'sectionBasisgegevens|wireSectionBasisgegevens|collectFromForm|async function save' project-edit.html
```

Expected: ≥4 matches.

- [ ] **Step 4: Commit**

```bash
git add project-edit.html
git commit -m "project-edit: section 1 (basisgegevens) + save flow for new+edit"
```

---

### Task 4: Section 2 (Leverancier & tarieven)

**Files:**
- Modify: `project-edit.html` (extend `renderSections()`, add `sectionSupplier()` + wiring)

- [ ] **Step 1: Add `sectionSupplier()` + wiring**

In `project-edit.html`, add these functions **after** `wireSectionBasisgegevens`:

```js
function sectionSupplier() {
  const s = _project.supplier;
  const single = s.isSingleTariff === true;
  return `
    <details class="card" id="secSupplier" open>
      <summary>💡 Leverancier &amp; tarieven</summary>
      <div class="section-body">
        <div class="form-row">
          <label for="fSupplierName">Naam leverancier <span class="help" style="font-weight:400;text-transform:none;">(optioneel)</span></label>
          <input type="text" id="fSupplierName" maxlength="120" value="${escapeHtml(s.name)}" />
        </div>
        <div class="form-row">
          <label style="display:flex;align-items:center;gap:8px;font-weight:400;cursor:pointer;">
            <input type="checkbox" id="fSingleTariff" ${single ? 'checked' : ''} />
            Enkelvoudig tarief (geen dag/nacht onderscheid)
          </label>
        </div>
        <div class="form-row">
          <label for="fPriceDay">${single ? 'Tarief (€ / kWh)' : 'Dagtarief (€ / kWh)'}</label>
          <input type="number" id="fPriceDay" min="0" step="0.001" value="${s.priceDay != null ? s.priceDay : ''}" />
        </div>
        <div class="form-row" id="rowPriceNight" ${single ? 'style="display:none;"' : ''}>
          <label for="fPriceNight">Nachttarief (€ / kWh)</label>
          <input type="number" id="fPriceNight" min="0" step="0.001" value="${s.priceNight != null ? s.priceNight : ''}" />
          <div class="help">ma–vr 22:00–07:00, hele weekend.</div>
        </div>
      </div>
    </details>
  `;
}

function wireSectionSupplier() {
  document.getElementById('fSupplierName').addEventListener('input', e => {
    _project.supplier.name = e.target.value.trim() || null;
  });
  document.getElementById('fSingleTariff').addEventListener('change', e => {
    _project.supplier.isSingleTariff = e.target.checked;
    if (e.target.checked) {
      _project.supplier.priceNight = null;
    }
    // Re-render section to update label + hide nightrow
    rerenderSection('secSupplier', sectionSupplier, wireSectionSupplier);
  });
  document.getElementById('fPriceDay').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    _project.supplier.priceDay = isNaN(v) ? null : v;
  });
  const pn = document.getElementById('fPriceNight');
  if (pn) pn.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    _project.supplier.priceNight = isNaN(v) ? null : v;
  });
}

// Helper — replaces one <details> element in place without losing scroll/state of others.
function rerenderSection(id, renderFn, wireFn) {
  const existing = document.getElementById(id);
  const wasOpen = existing ? existing.hasAttribute('open') : true;
  const wrap = document.createElement('div');
  wrap.innerHTML = renderFn();
  const fresh = wrap.firstElementChild;
  if (!wasOpen) fresh.removeAttribute('open');
  existing.replaceWith(fresh);
  wireFn();
}
```

- [ ] **Step 2: Extend `renderSections()` to include section 2**

Replace `renderSections()` with:

```js
function renderSections() {
  const host = document.getElementById('formSections');
  host.innerHTML = [
    sectionBasisgegevens(),
    sectionSupplier(),
  ].join('');
  wireSectionBasisgegevens();
  wireSectionSupplier();
}
```

- [ ] **Step 3: Verify**

```bash
grep -nE 'sectionSupplier|wireSectionSupplier|rerenderSection|fSingleTariff' project-edit.html
```

Expected: ≥4.

- [ ] **Step 4: Commit**

```bash
git add project-edit.html
git commit -m "project-edit: section 2 (leverancier + tarieven) with single-tariff toggle"
```

---

### Task 5: Section 3 (Woning) + BTW afleiding UI

**Files:**
- Modify: `project-edit.html`

- [ ] **Step 1: Add `sectionWoning()` + wiring**

Add after `wireSectionSupplier`:

```js
function sectionWoning() {
  const ageVal = _project.site.houseAgeOver10Years;   // null | true | false
  const btwManual = _project.calcDefaults.btw;         // null | 6 | 21
  const effective = effectiveBtwFor(_project);         // null | 6 | 21
  const ageDisabled = ageVal !== null;
  const radioId = (v, label) => {
    const checked = (ageVal === v);
    return `<label><input type="radio" name="fHouseAge" value="${v === null ? 'unknown' : v}" ${checked ? 'checked' : ''} /> ${label}</label>`;
  };
  return `
    <details class="card" id="secWoning" open>
      <summary>🏠 Woning</summary>
      <div class="section-body">
        <div class="form-row">
          <label>Leeftijd woning</label>
          <div class="tri-state">
            ${radioId(true,  '10 jaar of ouder')}
            ${radioId(false, 'Jonger dan 10 jaar')}
            ${radioId(null,  'Onbekend')}
          </div>
          <div class="help">10 jaar of ouder → BTW 6%. Jonger → BTW 21%.</div>
        </div>
        <div class="form-row">
          <label for="fBtwManual">Effectief BTW-tarief</label>
          <select id="fBtwManual" ${ageDisabled ? 'disabled' : ''}>
            <option value="">— Nog niet bepaald —</option>
            <option value="6"  ${effective === 6  ? 'selected' : ''}>6%</option>
            <option value="21" ${effective === 21 ? 'selected' : ''}>21%</option>
          </select>
          <div class="help">${ageDisabled
            ? 'Afgeleid uit de leeftijd van de woning. Kies "Onbekend" om zelf te kiezen.'
            : 'Vul in als de leeftijd onbekend is.'}
          </div>
        </div>
      </div>
    </details>
  `;
}

function wireSectionWoning() {
  document.querySelectorAll('input[name="fHouseAge"]').forEach(r => {
    r.addEventListener('change', e => {
      const v = e.target.value;
      _project.site.houseAgeOver10Years =
        v === 'true'  ? true  :
        v === 'false' ? false :
                        null;
      // When auto-derived, we clear the manual btw so readers always see the derived value.
      if (_project.site.houseAgeOver10Years !== null) {
        _project.calcDefaults.btw = null;
      }
      rerenderSection('secWoning', sectionWoning, wireSectionWoning);
    });
  });
  const sel = document.getElementById('fBtwManual');
  sel.addEventListener('change', e => {
    const v = e.target.value;
    _project.calcDefaults.btw = v === '' ? null : Number(v);
  });
}
```

- [ ] **Step 2: Update `renderSections()` to include section 3**

```js
function renderSections() {
  const host = document.getElementById('formSections');
  host.innerHTML = [
    sectionBasisgegevens(),
    sectionSupplier(),
    sectionWoning(),
  ].join('');
  wireSectionBasisgegevens();
  wireSectionSupplier();
  wireSectionWoning();
}
```

- [ ] **Step 3: Verify**

```bash
grep -nE 'sectionWoning|wireSectionWoning|fHouseAge|fBtwManual' project-edit.html
```

Expected: ≥4.

- [ ] **Step 4: Commit**

```bash
git add project-edit.html
git commit -m "project-edit: section 3 (woning) + BTW auto-derivation UI"
```

---

### Task 6: Sections 4 + 5 (Elektrische aansluiting, Zekeringkast)

**Files:**
- Modify: `project-edit.html`

Combined because both are straightforward tri-state/number fields.

- [ ] **Step 1: Add section 4 (Elektrisch)**

Add after `wireSectionWoning`:

```js
function sectionElectrical() {
  const e = _project.electrical;
  const opts = ['', ...CONNECTION_TYPES].map(t =>
    `<option value="${t}" ${t === (e.connectionType || '') ? 'selected' : ''}>${t === '' ? '— Niet bepaald —' : t}</option>`
  ).join('');
  return `
    <details class="card" id="secElectrical" open>
      <summary>🔌 Elektrische aansluiting</summary>
      <div class="section-body">
        <div class="form-row">
          <label for="fConnectionType">Type aansluiting</label>
          <select id="fConnectionType">${opts}</select>
        </div>
        <div class="form-row">
          <label for="fFuseRating">Zekeringsterkte Fluvius-zijde (A)</label>
          <input type="number" id="fFuseRating" min="0" step="1" value="${e.fuseRatingA != null ? e.fuseRatingA : ''}" />
        </div>
      </div>
    </details>
  `;
}

function wireSectionElectrical() {
  document.getElementById('fConnectionType').addEventListener('change', e => {
    _project.electrical.connectionType = e.target.value || null;
  });
  document.getElementById('fFuseRating').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    _project.electrical.fuseRatingA = isNaN(v) ? null : v;
  });
}
```

- [ ] **Step 2: Add section 5 (Zekeringkast) with tri-state helper**

Add after `wireSectionElectrical`:

```js
// Tri-state radio helper: returns HTML for three labels (Ja/Nee/Onbekend).
// `name` is unique in the DOM; `value` is the current stored state (null|true|false).
function triStateHtml(name, value) {
  const mk = (v, label) => {
    const match = (v === null ? value === null : value === v);
    const strV = v === null ? 'unknown' : String(v);
    return `<label><input type="radio" name="${name}" value="${strV}" ${match ? 'checked' : ''} /> ${label}</label>`;
  };
  return `
    <div class="tri-state">
      ${mk(true,  'Ja')}
      ${mk(false, 'Nee')}
      ${mk(null,  'Onbekend')}
    </div>
  `;
}

function parseTriState(strVal) {
  if (strVal === 'true')  return true;
  if (strVal === 'false') return false;
  return null;
}

function sectionCabinet() {
  const c = _project.cabinet;
  const row = (label, fieldKey, help) => `
    <div class="form-row">
      <label>${label}</label>
      ${triStateHtml('fCab_' + fieldKey, c[fieldKey])}
      ${help ? `<div class="help">${help}</div>` : ''}
    </div>
  `;
  return `
    <details class="card" id="secCabinet" open>
      <summary>🗄 Zekeringkast</summary>
      <div class="section-body">
        <div class="form-row">
          <label for="fFreeUnits">Vrije modules in de kast</label>
          <input type="number" id="fFreeUnits" min="0" step="1" value="${c.freeUnits != null ? c.freeUnits : ''}" />
          <div class="help">Aantal DIN-rail units dat nog vrij is voor extra zekeringen.</div>
        </div>
        ${row('Rem-automaat aanwezig?', 'hasRemAutomaat', '')}
        <div class="form-row">
          <label for="fWiringDiameter">Diameter bekabeling in kast (mm²) <span class="help" style="font-weight:400;text-transform:none;">(optioneel)</span></label>
          <input type="number" id="fWiringDiameter" min="0" step="0.5" value="${c.wiringDiameterMm2 != null ? c.wiringDiameterMm2 : ''}" />
        </div>
        ${row('Stopcontact in de omgeving van de Fluvius-aansluiting?', 'hasOutletNearFluvius', '')}
        ${row('Wifi-bereik bij Fluvius-aansluiting?', 'hasWifiNearFluvius', '')}
        ${row('Plaats om batterijen te plaatsen bij zekeringkast?', 'batteryPlacementRoom', '')}
        ${row('Wifi-bereik bij zekeringkast?', 'hasWifiNearCabinet', '')}
      </div>
    </details>
  `;
}

function wireSectionCabinet() {
  document.getElementById('fFreeUnits').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    _project.cabinet.freeUnits = isNaN(v) ? null : v;
  });
  document.getElementById('fWiringDiameter').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    _project.cabinet.wiringDiameterMm2 = isNaN(v) ? null : v;
  });
  ['hasRemAutomaat','hasOutletNearFluvius','hasWifiNearFluvius','batteryPlacementRoom','hasWifiNearCabinet'].forEach(key => {
    document.querySelectorAll(`input[name="fCab_${key}"]`).forEach(r => {
      r.addEventListener('change', e => { _project.cabinet[key] = parseTriState(e.target.value); });
    });
  });
}
```

- [ ] **Step 3: Update `renderSections()`**

```js
function renderSections() {
  const host = document.getElementById('formSections');
  host.innerHTML = [
    sectionBasisgegevens(),
    sectionSupplier(),
    sectionWoning(),
    sectionElectrical(),
    sectionCabinet(),
  ].join('');
  wireSectionBasisgegevens();
  wireSectionSupplier();
  wireSectionWoning();
  wireSectionElectrical();
  wireSectionCabinet();
}
```

- [ ] **Step 4: Verify**

```bash
grep -nE 'sectionElectrical|sectionCabinet|triStateHtml|parseTriState' project-edit.html
```

Expected: ≥4.

- [ ] **Step 5: Commit**

```bash
git add project-edit.html
git commit -m "project-edit: sections 4-5 (elektrisch + zekeringkast) with tri-state helper"
```

---

### Task 7: Section 6 (Zonnepanelen & omvormer-lijst)

**Files:**
- Modify: `project-edit.html`

Dynamic list with add/remove and live total. The section-re-render pattern from Task 4 is reused for add/remove, which also re-computes the total.

- [ ] **Step 1: Add section 6 code**

Add after `wireSectionCabinet`:

```js
function genInverterId() {
  return 'inv_' + Math.random().toString(36).slice(2, 10);
}

function sectionSolar() {
  const invs = _project.solar.inverters;
  const total = totalInverterPowerKw(_project);
  const cardHtml = (inv, idx) => `
    <div class="card" data-inv-id="${inv.id}" style="background:#f4f7fc;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <strong>Omvormer ${idx + 1}</strong>
        <button type="button" class="btn btn-danger" data-remove="${inv.id}" style="padding:4px 10px;font-size:0.85rem;">🗑 Verwijderen</button>
      </div>
      <div class="form-row">
        <label class="required">Vermogen omvormer (kW)</label>
        <input type="number" data-inv-field="powerKw" data-inv-id="${inv.id}" min="0" step="0.1" value="${inv.powerKw != null ? inv.powerKw : ''}" />
      </div>
      <div class="form-row">
        <label>Merk <span class="help" style="font-weight:400;text-transform:none;">(optioneel)</span></label>
        <input type="text" data-inv-field="brand" data-inv-id="${inv.id}" maxlength="60" value="${escapeHtml(inv.brand)}" />
      </div>
      <div class="form-row">
        <label>Model <span class="help" style="font-weight:400;text-transform:none;">(optioneel)</span></label>
        <input type="text" data-inv-field="model" data-inv-id="${inv.id}" maxlength="60" value="${escapeHtml(inv.model)}" />
      </div>
      <div class="form-row">
        <label>Aantal zonnepanelen <span class="help" style="font-weight:400;text-transform:none;">(optioneel)</span></label>
        <input type="number" data-inv-field="panelCount" data-inv-id="${inv.id}" min="0" step="1" value="${inv.panelCount != null ? inv.panelCount : ''}" />
      </div>
      <div class="form-row">
        <label>Vermogen per paneel (Wp) <span class="help" style="font-weight:400;text-transform:none;">(optioneel)</span></label>
        <input type="number" data-inv-field="panelPowerWp" data-inv-id="${inv.id}" min="0" step="1" value="${inv.panelPowerWp != null ? inv.panelPowerWp : ''}" />
      </div>
      <div class="form-row">
        <label>Aantal kringen aan deze omvormer <span class="help" style="font-weight:400;text-transform:none;">(optioneel)</span></label>
        <input type="number" data-inv-field="circuitCount" data-inv-id="${inv.id}" min="0" step="1" value="${inv.circuitCount != null ? inv.circuitCount : ''}" />
      </div>
      <div class="form-row">
        <label>Ligging van de panelen <span class="help" style="font-weight:400;text-transform:none;">(vrij veld, optioneel)</span></label>
        <textarea data-inv-field="orientation" data-inv-id="${inv.id}" rows="2" maxlength="300">${escapeHtml(inv.orientation)}</textarea>
        <div class="help">Bv. "zuid 30°, 2 panelen oost, 1 paneel west".</div>
      </div>
    </div>
  `;
  const emptyMsg = invs.length === 0
    ? '<p class="help" style="margin:8px 0;">Nog geen omvormer toegevoegd.</p>'
    : '';
  return `
    <details class="card" id="secSolar" open>
      <summary>☀ Zonnepanelen &amp; omvormer(s)</summary>
      <div class="section-body">
        ${emptyMsg}
        <div id="invList">${invs.map(cardHtml).join('')}</div>
        <button type="button" class="btn btn-secondary" id="btnAddInv">+ Omvormer toevoegen</button>
        <p style="margin-top:16px;font-weight:600;">Totaal omvormervermogen: ${total.toFixed(1)} kW</p>
      </div>
    </details>
  `;
}

function wireSectionSolar() {
  document.getElementById('btnAddInv').addEventListener('click', () => {
    _project.solar.inverters.push({
      id: genInverterId(),
      powerKw: null, brand: null, model: null,
      panelCount: null, panelPowerWp: null, circuitCount: null, orientation: null,
    });
    rerenderSection('secSolar', sectionSolar, wireSectionSolar);
  });
  document.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.remove;
      _project.solar.inverters = _project.solar.inverters.filter(i => i.id !== id);
      rerenderSection('secSolar', sectionSolar, wireSectionSolar);
    });
  });
  document.querySelectorAll('[data-inv-field]').forEach(el => {
    el.addEventListener('input', e => {
      const id = e.target.dataset.invId;
      const field = e.target.dataset.invField;
      const inv = _project.solar.inverters.find(i => i.id === id);
      if (!inv) return;
      const raw = e.target.value;
      if (['powerKw','panelCount','panelPowerWp','circuitCount'].includes(field)) {
        const n = parseFloat(raw);
        inv[field] = isNaN(n) ? null : n;
      } else {
        inv[field] = raw.trim() === '' ? null : raw;
      }
      // For powerKw we need to update the total display live without a full section rerender.
      if (field === 'powerKw') {
        const totalEl = document.querySelector('#secSolar p[style*="font-weight:600"]');
        if (totalEl) totalEl.textContent = `Totaal omvormervermogen: ${totalInverterPowerKw(_project).toFixed(1)} kW`;
      }
    });
  });
}
```

- [ ] **Step 2: Update `renderSections()`**

```js
function renderSections() {
  const host = document.getElementById('formSections');
  host.innerHTML = [
    sectionBasisgegevens(),
    sectionSupplier(),
    sectionWoning(),
    sectionElectrical(),
    sectionCabinet(),
    sectionSolar(),
  ].join('');
  wireSectionBasisgegevens();
  wireSectionSupplier();
  wireSectionWoning();
  wireSectionElectrical();
  wireSectionCabinet();
  wireSectionSolar();
}
```

- [ ] **Step 3: Verify**

```bash
grep -nE 'sectionSolar|wireSectionSolar|btnAddInv|data-inv-field' project-edit.html
```

Expected: ≥4.

- [ ] **Step 4: Commit**

```bash
git add project-edit.html
git commit -m "project-edit: section 6 (omvormer-lijst) with add/remove + live total"
```

---

### Task 8: Section 7 (Voorkeuren berekening) + Section 8 (CSV upload)

**Files:**
- Modify: `project-edit.html`

- [ ] **Step 1: Add section 7 (calcDefaults.keuring)**

Add after `wireSectionSolar`:

```js
function sectionCalcDefaults() {
  const k = _project.calcDefaults.keuring;
  const opts = [
    { v: '',    label: '— Geen voorkeur —' },
    { v: 'no',  label: 'Zonder keuring' },
    { v: 'yes', label: 'Met keuring' },
  ].map(o => `<option value="${o.v}" ${o.v === (k || '') ? 'selected' : ''}>${o.label}</option>`).join('');
  return `
    <details class="card" id="secCalc" open>
      <summary>🧮 Voorkeuren berekening</summary>
      <div class="section-body">
        <div class="form-row">
          <label for="fKeuring">Voorkeur keuring</label>
          <select id="fKeuring">${opts}</select>
          <div class="help">Op de berekenpagina blijft deze keuze nog aanpasbaar. Wijzigt men daar de waarde, dan wordt die hier opgeslagen.</div>
        </div>
      </div>
    </details>
  `;
}

function wireSectionCalcDefaults() {
  document.getElementById('fKeuring').addEventListener('change', e => {
    _project.calcDefaults.keuring = e.target.value === '' ? null : e.target.value;
  });
}
```

- [ ] **Step 2: Add section 8 (CSV)**

Add after `wireSectionCalcDefaults`:

```js
// Pending CSV state — only used when IS_NEW (no project-id yet to attach to).
// On edit, uploads go straight to Firestore via setProjectCsv.
let _pendingCsv = null;

function sectionCsv() {
  const cu = _project.csvUpload;
  const hasCsv = !!cu;
  const lastInfo = hasCsv
    ? `<p class="help">📁 <strong>${escapeHtml(cu.eanCode || 'onbekend')}</strong> — geüpload op ${formatTs(cu.uploadedAt)} door ${escapeHtml(shortEmail(cu.uploadedBy))}</p>`
    : '';
  const pendingInfo = _pendingCsv
    ? `<p class="help">📁 Nieuwe CSV klaar voor opslaan (${escapeHtml(_pendingCsv.eanCode || 'onbekend')}). Wordt samen met dit project bewaard.</p>`
    : '';
  return `
    <details class="card" id="secCsv" open>
      <summary>📊 Verbruikshistoriek (CSV)</summary>
      <div class="section-body">
        ${lastInfo}
        ${pendingInfo}
        <div class="form-row">
          <label for="fCsv">${hasCsv ? 'CSV vervangen' : 'CSV uploaden'}</label>
          <input type="file" id="fCsv" accept=".csv" />
          <div class="help">Optioneel bij aanmaken. Kan ook later via deze pagina toegevoegd/vervangen worden.</div>
        </div>
        <div id="csvErr" class="alert alert-error hide"></div>
      </div>
    </details>
  `;
}

function shortEmail(e) { return e ? String(e).split('@')[0] : '—'; }
function formatTs(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '—';
  return ts.toDate().toLocaleString('nl-BE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function wireSectionCsv() {
  document.getElementById('fCsv').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const errEl = document.getElementById('csvErr');
    errEl.classList.add('hide');
    try {
      const text = await file.text();
      const csvData = extractCsvForStorage(text);  // throws on invalid
      if (IS_NEW) {
        _pendingCsv = csvData;
      } else {
        await setProjectCsv(PROJECT_ID, csvData);
        const proj = await getProject(PROJECT_ID);
        _project.csvUpload = proj.csvUpload;
        showToast('CSV opgeslagen');
      }
      rerenderSection('secCsv', sectionCsv, wireSectionCsv);
    } catch (err) {
      errEl.textContent = err && err.message ? err.message : String(err);
      errEl.classList.remove('hide');
    }
  });
}
```

- [ ] **Step 3: Wire `_pendingCsv` into `save()` for new projects**

In the existing `save()` function, find the `IS_NEW` branch and update the `createProject` call to include `csvData: _pendingCsv`. Replace:

```js
    if (IS_NEW) {
      const ref = await createProject({
        projectName:  payload.projectName,
        customerName: payload.customerName,
        status:       payload.status,
        csvData:      null,              // CSV sectie komt in Task 8
        metadata:     payload.metadata,
      });
      targetId = ref.id;
    } else {
```

with:

```js
    if (IS_NEW) {
      const ref = await createProject({
        projectName:  payload.projectName,
        customerName: payload.customerName,
        status:       payload.status,
        csvData:      _pendingCsv,
        metadata:     payload.metadata,
      });
      targetId = ref.id;
    } else {
```

- [ ] **Step 4: Update `renderSections()` to include sections 7 + 8**

```js
function renderSections() {
  const host = document.getElementById('formSections');
  host.innerHTML = [
    sectionBasisgegevens(),
    sectionSupplier(),
    sectionWoning(),
    sectionElectrical(),
    sectionCabinet(),
    sectionSolar(),
    sectionCalcDefaults(),
    sectionCsv(),
  ].join('');
  wireSectionBasisgegevens();
  wireSectionSupplier();
  wireSectionWoning();
  wireSectionElectrical();
  wireSectionCabinet();
  wireSectionSolar();
  wireSectionCalcDefaults();
  wireSectionCsv();
}
```

- [ ] **Step 5: Verify**

```bash
grep -nE 'sectionCalcDefaults|sectionCsv|_pendingCsv|fKeuring' project-edit.html
```

Expected: ≥4.

- [ ] **Step 6: Commit**

```bash
git add project-edit.html
git commit -m "project-edit: sections 7-8 (voorkeuren + CSV) + pending-CSV for new projects"
```

---

### Task 9: Dashboard — remove modal, redirect new-project, add edit button

**Files:**
- Modify: `dashboard.html`

- [ ] **Step 1: Remove the new-project modal HTML**

In `dashboard.html`, delete the entire `<div class="modal-backdrop" id="newProjectBackdrop">…</div>` block (roughly lines 244–272 in the current file — the whole outer modal container including the inner `<form id="newProjectForm">`). Leave the `#btnNewProject` button itself intact; only its handler changes.

- [ ] **Step 2: Replace the new-project wiring with a redirect**

Find this block in `dashboard.html`:

```js
  // ── New-project modal wiring ─────────────────────────────────────────────
  const backdrop = document.getElementById('newProjectBackdrop');
  const form     = document.getElementById('newProjectForm');
  const errEl    = document.getElementById('npError');
  const submit   = document.getElementById('npSubmitBtn');

  // Populate status dropdown from PROJECT_STATUSES enum
  const statusSelect = document.getElementById('npStatus');
  statusSelect.innerHTML = PROJECT_STATUSES.map(s =>
    `<option value="${s.key}" ${s.key === DEFAULT_STATUS ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  function openNewProjectModal() {
    form.reset();
    statusSelect.value = DEFAULT_STATUS;
    errEl.classList.add('hide');
    backdrop.classList.add('open');
    document.getElementById('npName').focus();
  }
  function closeNewProjectModal() {
    backdrop.classList.remove('open');
  }

  document.getElementById('btnNewProject').addEventListener('click', openNewProjectModal);
  document.getElementById('npCancelBtn').addEventListener('click', closeNewProjectModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeNewProjectModal(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.add('hide');
    submit.disabled = true;
    submit.textContent = 'Bezig…';
    try {
      const projectName  = document.getElementById('npName').value.trim();
      const customerName = document.getElementById('npCustomer').value.trim();
      const status       = statusSelect.value;
      const file         = document.getElementById('npCsv').files[0] || null;

      if (!projectName || !customerName) {
        throw new Error('Projectnaam en klantnaam zijn verplicht.');
      }

      let csvData = null;
      if (file) {
        const text = await file.text();
        csvData = extractCsvForStorage(text); // throws if CSV invalid
      }

      const ref = await createProject({ projectName, customerName, status, csvData });
      window.location.href = `index.html?project=${ref.id}`;
    } catch (err) {
      errEl.textContent = err && err.message ? err.message : String(err);
      errEl.classList.remove('hide');
      submit.disabled = false;
      submit.textContent = 'Aanmaken';
    }
  });
```

…and replace the **entire block** above with:

```js
  // New-project button → redirect to project-edit page.
  document.getElementById('btnNewProject').addEventListener('click', () => {
    window.location.href = 'project-edit.html?new=1';
  });
```

- [ ] **Step 3: Add an edit button to each project row**

Find `rowHTML(p, isDeleted)` and replace the `row-actions` cell with an edit button in front of the existing open button (edit only shown for non-deleted rows):

Replace this:

```js
  const action  = isDeleted
    ? `<button type="button" class="restoreBtn"  data-id="${p.id}" title="Herstellen">↶</button>`
    : `<button type="button" class="deleteBtn"   data-id="${p.id}" title="Verwijderen">🗑️</button>`;
  return `
    <tr class="${isDeleted ? 'deleted-row' : ''}">
      <td><a href="index.html?project=${p.id}" style="color:var(--primary);text-decoration:none;font-weight:600;">${escapeHtml(p.projectName || '')}</a></td>
      <td>${escapeHtml(p.customerName || '')}</td>
      <td>${statusChipHTML(p.status, p.id)}</td>
      <td>${updated}</td>
      <td>${by}</td>
      <td class="row-actions">
        <button type="button" class="openBtn" data-id="${p.id}" title="Open">📂</button>
        ${action}
      </td>
    </tr>`;
```

with:

```js
  const editBtn = isDeleted
    ? ''
    : `<button type="button" class="editBtn" data-id="${p.id}" title="Bewerken">✏️</button>`;
  const action  = isDeleted
    ? `<button type="button" class="restoreBtn"  data-id="${p.id}" title="Herstellen">↶</button>`
    : `<button type="button" class="deleteBtn"   data-id="${p.id}" title="Verwijderen">🗑️</button>`;
  return `
    <tr class="${isDeleted ? 'deleted-row' : ''}">
      <td><a href="index.html?project=${p.id}" style="color:var(--primary);text-decoration:none;font-weight:600;">${escapeHtml(p.projectName || '')}</a></td>
      <td>${escapeHtml(p.customerName || '')}</td>
      <td>${statusChipHTML(p.status, p.id)}</td>
      <td>${updated}</td>
      <td>${by}</td>
      <td class="row-actions">
        <button type="button" class="openBtn" data-id="${p.id}" title="Open">📂</button>
        ${editBtn}
        ${action}
      </td>
    </tr>`;
```

- [ ] **Step 4: Wire the edit button**

In `refreshProjectList()`, after the existing `el.querySelectorAll('.openBtn')` block, add:

```js
    // Wire edit buttons
    el.querySelectorAll('.editBtn').forEach(btn => {
      btn.addEventListener('click', () => { window.location.href = `project-edit.html?project=${btn.dataset.id}`; });
    });
```

- [ ] **Step 5: Verify**

```bash
grep -nE 'newProjectBackdrop|newProjectForm|npCancelBtn|openNewProjectModal' dashboard.html
```

Expected: **0 matches** (all removed).

```bash
grep -nE 'editBtn|project-edit\.html' dashboard.html
```

Expected: ≥3 matches.

- [ ] **Step 6: Commit**

```bash
git add dashboard.html
git commit -m "dashboard: replace new-project modal with project-edit redirect + add row edit button"
```

---

### Task 10: Index.html — "Projectgegevens" summary card rendering

**Files:**
- Modify: `index.html`

Adds the collapsed summary card in project-mode only. Hides nothing yet (that comes in Task 11). Renders a read-only summary + edit button.

- [ ] **Step 1: Add the summary-card HTML host**

In `index.html`, find the existing project banner block (around lines 570–582). Insert a new `<details>` host **immediately after** `</div>` of `projectMissingCsv`:

Current context:

```html
<div id="projectMissingCsv" class="card alert alert-warning" style="display:none;">
  📁 <div>Dit project heeft nog geen CSV. <button type="button" class="btn" id="missingCsvBtn">CSV uploaden</button></div>
</div>
```

Replace with:

```html
<div id="projectMissingCsv" class="card alert alert-warning" style="display:none;">
  📁 <div>Dit project heeft nog geen CSV. <button type="button" class="btn" id="missingCsvBtn">CSV uploaden</button></div>
</div>

<details id="projectValuesCard" class="card" style="display:none;">
  <summary style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;list-style:none;">
    <h2 style="margin:0;"><span class="icon">📋</span> Projectgegevens</h2>
    <button type="button" class="btn btn-secondary" id="pvEditBtn" style="font-size:0.85rem;padding:4px 10px;">✏ Aanpassen</button>
  </summary>
  <div id="pvIncompleteWarn" class="alert alert-warning" style="display:none;margin-top:10px;"></div>
  <div class="pv-grid" id="pvGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px 16px;margin-top:12px;font-size:0.9rem;"></div>
</details>
```

- [ ] **Step 2: Add CSS for single-column layout on mobile**

In `index.html`, find the existing `@media (max-width: 600px)` block (around line 304) and add a rule:

```css
    .pv-grid { grid-template-columns: 1fr !important; }
```

So the block becomes (context-preserving):

```css
    @media (max-width: 600px) {
      h1 { font-size: 1.3rem; }
      .scenarios-grid { grid-template-columns: 1fr; }
      .pv-grid { grid-template-columns: 1fr !important; }
    }
```

- [ ] **Step 3: Add the render function**

In `index.html`, inside the existing `<script>` block, somewhere near the `loadProjectIntoUI` function (search for it — around line 2078), add these two helpers:

```js
// ─── Project values summary card (projectValuesCard) ─────────────────────────
function renderProjectValuesCard(project) {
  const m = mergeProjectMetadata(project);
  const rows = [];
  function add(label, value) {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return;
    rows.push(`<div style="color:var(--muted);">${label}</div><div>${value}</div>`);
  }

  // Leverancier
  if (m.supplier.name) add('Leverancier', escapeHtmlLite(m.supplier.name));
  if (m.supplier.isSingleTariff) {
    if (m.supplier.priceDay != null) add('Tarief (enkelvoudig)', m.supplier.priceDay.toFixed(3) + ' €/kWh');
  } else {
    if (m.supplier.priceDay   != null) add('Dagtarief',   m.supplier.priceDay.toFixed(3)   + ' €/kWh');
    if (m.supplier.priceNight != null) add('Nachttarief', m.supplier.priceNight.toFixed(3) + ' €/kWh');
  }

  // Woning / BTW
  const ageLbl = m.site.houseAgeOver10Years === true  ? '10 jaar of ouder'
             : m.site.houseAgeOver10Years === false ? 'Jonger dan 10 jaar'
             : null;
  if (ageLbl) add('Leeftijd woning', ageLbl);
  const effBtw = effectiveBtwFor(project);
  if (effBtw != null) add('BTW', effBtw + '%');
  if (m.calcDefaults.keuring) add('Keuring (voorkeur)', m.calcDefaults.keuring === 'yes' ? 'Met keuring' : 'Zonder keuring');

  // Elektrisch
  if (m.electrical.connectionType) add('Aansluiting', m.electrical.connectionType);
  if (m.electrical.fuseRatingA != null) add('Fluvius-zekering', m.electrical.fuseRatingA + ' A');

  // Zekeringkast
  if (m.cabinet.freeUnits != null) add('Vrije modules in kast', m.cabinet.freeUnits);
  if (m.cabinet.wiringDiameterMm2 != null) add('Bekabeling-diameter', m.cabinet.wiringDiameterMm2 + ' mm²');
  const tri = v => v === true ? 'Ja' : v === false ? 'Nee' : null;
  const triPairs = [
    ['Rem-automaat',                   m.cabinet.hasRemAutomaat],
    ['Stopcontact bij Fluvius',        m.cabinet.hasOutletNearFluvius],
    ['Wifi bij Fluvius',               m.cabinet.hasWifiNearFluvius],
    ['Plaats voor batterijen',         m.cabinet.batteryPlacementRoom],
    ['Wifi bij zekeringkast',          m.cabinet.hasWifiNearCabinet],
  ];
  triPairs.forEach(([label, v]) => { const s = tri(v); if (s) add(label, s); });

  // Omvormers
  if (m.solar.inverters.length > 0) {
    const total = totalInverterPowerKw(project);
    add('Omvormervermogen totaal', total.toFixed(1) + ' kW');
    add('Aantal omvormers', m.solar.inverters.length);
    // Summary of panels (sum of panelCount)
    const totalPanels = m.solar.inverters.reduce((s, inv) => s + (Number(inv.panelCount) || 0), 0);
    if (totalPanels > 0) add('Aantal zonnepanelen', totalPanels);
  }

  const grid = document.getElementById('pvGrid');
  const card = document.getElementById('projectValuesCard');
  if (rows.length === 0) {
    card.style.display = 'none';
    return;
  }
  grid.innerHTML = rows.join('');
  card.style.display = '';
  // Collapsed by default; opened only when there are missing-but-required fields (Task 11 will
  // set the warning + open attribute). For now, keep closed.
  card.removeAttribute('open');

  // Wire the edit button (idempotent: remove existing listener by replacing node).
  const btn = document.getElementById('pvEditBtn');
  const fresh = btn.cloneNode(true);
  btn.replaceWith(fresh);
  fresh.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = 'project-edit.html?project=' + encodeURIComponent(project.id);
  });
}

function escapeHtmlLite(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
```

- [ ] **Step 4: Call `renderProjectValuesCard()` from `loadProjectIntoUI()`**

In `index.html`, find `loadProjectIntoUI` (around line 2078). After the project banner is rendered (look for where `pbName`, `pbCustomer`, `pbStatusChip` are set), add a call to the new function. Insert the call right after the existing banner population, just before the CSV handling. Example patch — locate this chunk in the current file:

```js
  document.getElementById('pbName').textContent     = project.projectName || '(zonder naam)';
  document.getElementById('pbCustomer').textContent = project.customerName || '(geen klant)';
  renderProjectStatusChip(project);
  document.getElementById('projectBanner').style.display = '';
```

…and add the new call right below it:

```js
  document.getElementById('pbName').textContent     = project.projectName || '(zonder naam)';
  document.getElementById('pbCustomer').textContent = project.customerName || '(geen klant)';
  renderProjectStatusChip(project);
  document.getElementById('projectBanner').style.display = '';
  renderProjectValuesCard(project);
```

If the exact surrounding code differs, search the file for `renderProjectStatusChip` — the call is inserted immediately after that line.

- [ ] **Step 5: Verify**

```bash
grep -nE 'renderProjectValuesCard|projectValuesCard|pvEditBtn' index.html
```

Expected: ≥3.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "index: render collapsed Projectgegevens summary card in project-mode"
```

---

### Task 11: Index.html — conditional hiding of form fields filled by project

**Files:**
- Modify: `index.html`

The "source of truth" pattern: wherever the project provides a value, the corresponding calculator field is hidden and the project value is used instead. Fields whose project value is missing stay visible as fallback.

- [ ] **Step 1: Add the apply function**

In `index.html`, directly after `renderProjectValuesCard()` (from Task 10), add:

```js
// Apply project metadata to the calculator form:
//  • Sets field values from project.
//  • Hides fields whose project value is non-null (source-of-truth = project).
//  • Opens the Projectgegevens card with a warning if required calc fields are missing.
// Keuring is ALWAYS visible (user may override per calculation); default only pre-filled.
function applyProjectToCalcForm(project) {
  const m = mergeProjectMetadata(project);
  const hide = (inputId) => {
    const el = document.getElementById(inputId);
    if (el) {
      const group = el.closest('.form-group');
      if (group) group.style.display = 'none';
    }
  };
  const show = (inputId) => {
    const el = document.getElementById(inputId);
    if (el) {
      const group = el.closest('.form-group');
      if (group) group.style.display = '';
    }
  };
  const setVal = (inputId, v) => {
    const el = document.getElementById(inputId);
    if (el && v != null) el.value = v;
  };

  // PV inverter — sum of inverters
  const totalKw = totalInverterPowerKw(project);
  if (totalKw > 0) {
    setVal('pvInverter', totalKw);
    hide('pvInverter');
  } else {
    show('pvInverter');
  }

  // Prijs dag
  if (m.supplier.priceDay != null) {
    setVal('elecPrice', m.supplier.priceDay);
    hide('elecPrice');
  } else {
    show('elecPrice');
  }

  // Prijs nacht — ook verbergen als isSingleTariff true (niet relevant)
  if (m.supplier.isSingleTariff === true) {
    const el = document.getElementById('elecPriceNight');
    if (el) el.value = '';
    hide('elecPriceNight');
  } else if (m.supplier.priceNight != null) {
    setVal('elecPriceNight', m.supplier.priceNight);
    hide('elecPriceNight');
  } else {
    show('elecPriceNight');
  }

  // BTW
  const effBtw = effectiveBtwFor(project);
  if (effBtw != null) {
    setVal('btwSelect', String(effBtw));
    hide('btwSelect');
  } else {
    show('btwSelect');
  }

  // Keuring — NEVER hide; pre-fill with project default if present.
  show('keuringSelect');
  if (m.calcDefaults.keuring) {
    setVal('keuringSelect', m.calcDefaults.keuring);
  }

  // Required-field warning inside the summary card.
  const missing = [];
  if (!(totalKw > 0))                 missing.push('Omvormervermogen (kW)');
  if (m.supplier.priceDay == null)    missing.push('Dagtarief');
  if (effBtw == null)                 missing.push('BTW');
  const warnEl = document.getElementById('pvIncompleteWarn');
  const card   = document.getElementById('projectValuesCard');
  if (missing.length > 0 && warnEl && card) {
    warnEl.textContent = 'Nog in te vullen vóór Bereken: ' + missing.join(', ') + '. Vul in hieronder of via ✏ Aanpassen.';
    warnEl.style.display = '';
    card.setAttribute('open', '');
  } else if (warnEl) {
    warnEl.style.display = 'none';
  }
}
```

- [ ] **Step 2: Call `applyProjectToCalcForm()` from `loadProjectIntoUI()`**

In `loadProjectIntoUI()`, right after the `renderProjectValuesCard(project);` call (added in Task 10), add:

```js
  applyProjectToCalcForm(project);
```

- [ ] **Step 3: Verify**

```bash
grep -nE 'applyProjectToCalcForm|pvIncompleteWarn' index.html
```

Expected: ≥3.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "index: hide form fields provided by project, pre-fill keuring, warn on missing"
```

---

### Task 12: Index.html — sync-back of user-entered fallbacks on Bereken

**Files:**
- Modify: `index.html`

When the user types a value in a fallback-visible field and then clicks Bereken, persist that value back to the project so next time the field is hidden.

- [ ] **Step 1: Add `syncBackToProject()`**

Still in `index.html`, after `applyProjectToCalcForm()`, add:

```js
// Compare the user-entered form values against the current project. For each field the
// project is missing, copy the form value back to the project patch. Special case for
// pvInverter: creates/updates an inverter entry since solar.inverters is the source.
// Returns the patch (object), or null if nothing to write. Caller handles the Firestore call.
function buildProjectSyncPatch(project) {
  const m = mergeProjectMetadata(project);
  const patch = {};
  const supplierPatch = {};
  const calcPatch = {};
  const solarPatch = null;

  // pvInverter: write to solar.inverters[0].powerKw if the project has none.
  if (totalInverterPowerKw(project) === 0) {
    const v = parseFloat(document.getElementById('pvInverter').value);
    if (!isNaN(v) && v > 0) {
      const existing = m.solar.inverters.slice();
      if (existing.length === 0) {
        existing.push({ id: 'inv_' + Math.random().toString(36).slice(2, 10),
                        powerKw: v, brand: null, model: null,
                        panelCount: null, panelPowerWp: null, circuitCount: null, orientation: null });
      } else {
        existing[0] = { ...existing[0], powerKw: v };
      }
      patch.solar = { inverters: existing };
    }
  }

  // Dagtarief
  if (m.supplier.priceDay == null) {
    const v = parseFloat(document.getElementById('elecPrice').value);
    if (!isNaN(v) && v > 0) supplierPatch.priceDay = v;
  }
  // Nachttarief — only meaningful if not single-tariff
  if (m.supplier.isSingleTariff !== true && m.supplier.priceNight == null) {
    const v = parseFloat(document.getElementById('elecPriceNight').value);
    if (!isNaN(v) && v > 0) supplierPatch.priceNight = v;
  }
  if (Object.keys(supplierPatch).length > 0) {
    patch.supplier = { ...m.supplier, ...supplierPatch };
  }

  // BTW — only if no age-based derivation and no manual default.
  if (effectiveBtwFor(project) == null) {
    const v = document.getElementById('btwSelect').value;
    const n = Number(v);
    if (n === 6 || n === 21) calcPatch.btw = n;
  }

  // Keuring — always: if user value differs from stored calcDefaults, write it.
  const kSel = document.getElementById('keuringSelect').value;
  const kStored = m.calcDefaults.keuring || null;
  if (kSel && kSel !== kStored) calcPatch.keuring = kSel;

  if (Object.keys(calcPatch).length > 0) {
    patch.calcDefaults = { ...m.calcDefaults, ...calcPatch };
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
```

- [ ] **Step 2: Hook sync-back into the existing Bereken (project-mode auto-save) flow**

`index.html` already auto-saves `lastCalcRun` on every Bereken in project-mode (Phase 1 commit `cac01d8`). Locate that code — search for `saveLastCalcRun`. Around that call, wrap so the sync patch is written first (sequentially, before `saveLastCalcRun`). Find the existing auto-save block (roughly shaped like):

```js
      // project-mode: save lastCalcRun automatically
      if (typeof PROJECT_ID !== 'undefined' && PROJECT_ID && typeof saveLastCalcRun === 'function') {
        try {
          await saveLastCalcRun(PROJECT_ID, { inputs: _serializeInputs(), results: ... });
        } catch (e) { console.warn('saveLastCalcRun failed', e); }
      }
```

Replace whatever the current auto-save block is with (keeping the existing inputs+results payload — only the pre-step is new):

```js
      // project-mode: sync any fallback-entered fields back to the project, then save lastCalcRun.
      if (typeof PROJECT_ID !== 'undefined' && PROJECT_ID) {
        try {
          const proj = await getProject(PROJECT_ID);
          const patch = buildProjectSyncPatch(proj);
          if (patch) {
            await updateProjectMetadata(PROJECT_ID, patch);
            showToastLite('Projectgegevens aangevuld uit invoer');
          }
        } catch (e) {
          console.warn('project sync-back failed', e);
        }
        try {
          /* original saveLastCalcRun call — keep as-is */
        } catch (e) { console.warn('saveLastCalcRun failed', e); }
      }
```

The literal `/* original saveLastCalcRun call — keep as-is */` placeholder means: the existing `saveLastCalcRun(PROJECT_ID, { inputs, results })` statement stays exactly as it is in the current file; only wrap-around code is new. If the current file has any different structure, the implementer integrates both pieces.

- [ ] **Step 3: Add the `showToastLite` helper if missing**

Also in `index.html`, add near the other small helpers (right above `buildProjectSyncPatch` is fine):

```js
function showToastLite(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#00b478;color:#fff;padding:10px 18px;border-radius:8px;font-size:0.9rem;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
```

- [ ] **Step 4: Verify**

```bash
grep -nE 'buildProjectSyncPatch|showToastLite|updateProjectMetadata' index.html
```

Expected: ≥3.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "index: sync fallback-entered values back to project on Bereken"
```

---

### Task 13: Update `CLAUDE.md` with the new architecture

**Files:**
- Modify: `CLAUDE.md`

Document so the next `claude`-session knows where things live.

- [ ] **Step 1: Add a new section**

In `CLAUDE.md`, under the "File layout — what's live vs. dead" bullet list, add a new bullet for `project-edit.html` right after the `dashboard.html` bullet:

```md
- **`project-edit.html`** — new-project creation + existing-project metadata bewerken. Auth-gated (Kevin/Ruben whitelist). 8 secties: basisgegevens, leverancier & tarieven, woning (+ BTW afleiding), elektrische aansluiting, zekeringkast, omvormer-lijst (dynamisch), voorkeuren berekening, CSV upload. Alle velden partieel opslagen toegelaten; enkel `projectName`+`customerName` en per-inverter `powerKw` zijn hard required. Action bar: Annuleren / Opslaan / Opslaan & Bereken.
```

- [ ] **Step 2: Add project-mode schema section**

Under the "Architecture (the parts that span multiple sections)" heading, add a new sub-section before or after "Save / share state":

```md
**Project-niveau metadata (2026-04-20 uitbreiding)** — Het Firestore `projects` document heeft 6 extra top-level secties bovenop Phase 1: `site` (leeftijd woning → BTW afleiding), `electrical` (aansluitingstype, zekering A), `cabinet` (vrije modules, rem-automaat, wifi/stopcontact bereik, plaats voor batterijen), `solar.inverters[]` (per-omvormer: powerKw vereist + optionele merk/model/panelen/kringen/ligging), `supplier` (naam, isSingleTariff, priceDay/priceNight), `calcDefaults` (btw, keuring voorkeur). Pure helpers in `assets/js/firebase-init.js`: `newEmptyProjectMetadata()`, `mergeProjectMetadata(project)` (defaults voor oude projects), `effectiveBtwFor(project)` (houseAgeOver10Years → 6/21, anders calcDefaults.btw), `totalInverterPowerKw(project)` (som). Readers merge altijd via `mergeProjectMetadata` — pre-2026-04-20 projects behave als volledig-leeg.

**Index.html project-mode source-of-truth** — Wanneer `?project=<id>` gebruikt is toont de pagina een dichtgeklapte "Projectgegevens" kaart (`#projectValuesCard`) met `✏ Aanpassen` knop die naar `project-edit.html?project=<id>` redirect. Formuliervelden waarvoor het project een waarde heeft worden verborgen (source-of-truth = project); velden zonder projectwaarde blijven zichtbaar als fallback. Keuring is een uitzondering: altijd zichtbaar, default-value komt uit project, wijzigt men de waarde dan wordt ze bij Bereken teruggeschreven. Bij Bereken roept `calculate()` `buildProjectSyncPatch()` aan om alle fallback-ingevulde waarden naar het project doc te persisten (via `updateProjectMetadata`) vóór `saveLastCalcRun` aangeroepen wordt. Bij ontbrekende vereiste velden opent de summary-kaart automatisch met een waarschuwing.
```

- [ ] **Step 3: Verify the doc mentions new files**

```bash
grep -nE 'project-edit\.html|newEmptyProjectMetadata|effectiveBtwFor|totalInverterPowerKw' CLAUDE.md
```

Expected: ≥4.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md: document project-edit page + expanded schema + sync-back"
```

---

## Final manual smoke test (Kevin)

After Task 13, open the site locally (`python3 -m http.server`, then `http://localhost:8000/dashboard.html`):

1. Log in → click "+ Nieuw project" → redirects to `project-edit.html?new=1`.
2. Vul alleen `projectName`+`customerName` in, klik "Opslaan" → redirect naar dashboard, nieuw project in lijst.
3. Klik "✏" naast de rij → `project-edit.html?project=<id>` opent met de waarden ingevuld.
4. Vul leverancier "Engie", dagtarief 0.28, zet "10 jaar of ouder", voeg 1 omvormer toe met 5 kW. Klik "Opslaan & Bereken" → `index.html?project=<id>` opent met `pvInverter`/`elecPrice`/`btwSelect` verborgen, summary-kaart toont de waarden.
5. Upload een CSV via de project banner (📁 knop), klik Bereken → bereking werkt, resultaten verschijnen.
6. Open project-edit opnieuw via ✏ → velden ongewijzigd.
7. Open `index.html` zonder query → alle velden zichtbaar zoals vroeger.
8. Open `index.html?data=<old-share-link>` → legacy share-link flow werkt nog.

Als alle stappen slagen: `git push origin gh-pages`.

## Scope / spec coverage check

- ✅ Schema: alle 6 secties (site/electrical/cabinet/solar/supplier/calcDefaults) — Task 1.
- ✅ BTW afleidingsregel — Task 1 (`effectiveBtwFor`) + Task 5 (UI).
- ✅ Multi-inverter dynamic list — Task 7.
- ✅ Totale kW = som — Task 1 (`totalInverterPowerKw`) + Task 7 (display) + Task 11 (hiding).
- ✅ Keuring altijd zichtbaar + sync-back — Task 11 + Task 12.
- ✅ Separate mobile-first page — Task 2 + CSS in Task 2.
- ✅ Dashboard modal verwijderd + redirect — Task 9.
- ✅ Edit knop in rij — Task 9.
- ✅ Dichtgeklapte summary + edit knop op index — Task 10.
- ✅ Hiding van form-velden — Task 11.
- ✅ Sync-back bij Bereken — Task 12.
- ✅ CSV upload in project-edit — Task 8.
- ✅ Bare + `?data=<b64>` modes ongewijzigd — alle index-wijzigingen zijn gated op project-mode-only code paths.
- ✅ Backward compat pre-2026-04-20 projects — Task 1 (`mergeProjectMetadata`).
- ✅ CLAUDE.md update — Task 13.
