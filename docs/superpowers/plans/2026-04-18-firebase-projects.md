# Firebase Projects (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a login-gated `dashboard.html` with project CRUD + a `?project=<id>` mode for `index.html` that loads/saves projects to Firestore, so Kevin and Ruben can share a multi-customer pipeline backed by Firebase.

**Architecture:** No build step. Firebase compat SDK loaded via CDN. New shared helpers in `assets/js/firebase-init.js` (auth + Firestore CRUD) and `assets/js/csv.js` (CSV parsing extracted from `index.html`). `dashboard.html` is a new login-gated landing. `index.html` gets a third mode (`?project=<id>`) alongside its existing bare and `?data=<b64>` modes — the existing modes stay untouched.

**Tech Stack:** Plain HTML/CSS/JS, Firebase JS SDK 10.13.2 (compat build), Firestore for data, Firebase Auth with Google sign-in.

**Spec:** `docs/superpowers/specs/2026-04-18-firebase-projects-design.md` — read before starting.

---

## File map

- **NEW:** `dashboard.html` — landing page with 3 auth states, project list, new-project form, soft delete + restore.
- **NEW:** `assets/js/firebase-init.js` — Firebase SDK init, auth helpers, Firestore CRUD for projects, status enum, status-chip color helper.
- **NEW:** `assets/js/csv.js` — `parseCSV`, `parseDate`, `parsVolume` (extracted) + `extractCsvForStorage(csvText)` (new — builds the `dailyCompact` + meta object the dashboard stores at project creation).
- **MODIFY:** `index.html` — add `?project=<id>` mode (auth check, Firestore load, project-banner with status chip, CSV-required state, auto-save). Bare and `?data=<b64>` modes untouched. Remove inline `parseCSV/parseDate/parsVolume` (loaded from `csv.js` instead).
- **MODIFY:** `CLAUDE.md` — describe new Firebase architecture + dashboard + project-mode + shared js layout.

## Working directory

`/home/ubuntu/battery-roi-tool`. Work directly on `gh-pages` (same as the rest of this repo's history). One commit per task; user pushes when ready.

## Notes for the implementer

- UI text is in Dutch (`nl-BE`).
- No tests in the repo. Verification = `grep` for structural checks + manual browser smoke (user's responsibility for full flows).
- The CSV format and `processData` semantics (rolling 365-day window, dailyCompact v:5 shape) are documented in `CLAUDE.md` and the existing `index.html`. Don't reinvent — re-use.
- All Firebase identifiers (config, OAuth client ID) are public-by-design (security rules enforce access). It's safe to commit them.
- Where the plan says `RUBEN_EMAIL_PLACEHOLDER` or `FIREBASE_CONFIG_PLACEHOLDER`, those are intentional sentinels Kevin replaces in Task 1. Do not invent values.
- Don't push (`git push`); only commit. Kevin pushes manually when he's ready.

---

### Task 1: Firebase Console setup (manual — Kevin)

This task is performed by Kevin in the Firebase Console (no code, no commit). All later tasks assume this is done.

- [ ] **Step 1: Create Firebase project**

Go to https://console.firebase.google.com → "Add project" → name `smartpeak-roi` (or any name). Skip Google Analytics.

- [ ] **Step 2: Enable Firestore**

Build → Firestore Database → "Create database" → location `eur3` (Europa) → start in **production mode** (rules will be replaced in Step 5).

- [ ] **Step 3: Enable Auth → Google provider**

Build → Authentication → "Get started" → Sign-in method tab → Google → Enable → save. (No extra config needed; Firebase auto-uses the default OAuth credentials for the project.)

- [ ] **Step 4: Add web app + copy config**

Project Settings (gear icon) → "Your apps" → web (`</>` icon) → app nickname `smartpeak-web` → "Register app" → copy the `firebaseConfig` JS object that's shown. It looks like:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "smartpeak-roi.firebaseapp.com",
  projectId: "smartpeak-roi",
  storageBucket: "smartpeak-roi.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

Save this somewhere; Task 3 needs it.

- [ ] **Step 5: Set Firestore rules**

Firestore Database → Rules tab → replace contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isWhitelisted() {
      return request.auth != null && request.auth.token.email in [
        'kevin@bloxit.be',
        'RUBEN_EMAIL_HERE'
      ];
    }
    match /projects/{projectId} {
      allow read, write: if isWhitelisted();
    }
  }
}
```

Replace `RUBEN_EMAIL_HERE` with Ruben's actual email. Click "Publish".

- [ ] **Step 6: Add authorized domains**

Authentication → Settings → Authorized domains → "Add domain" → `smartpeak-be.github.io` (the GitHub Pages domain for this repo). `localhost` is already authorized by default for local testing.

- [ ] **Step 7: Hand off to implementer**

Once Steps 1-6 are complete, paste the `firebaseConfig` from Step 4 + Ruben's email into the chat (or directly into `assets/js/firebase-init.js` after Task 3 creates it). Tasks 2-11 can proceed.

---

### Task 2: Extract CSV helpers into `assets/js/csv.js`

**Files:**
- Create: `/home/ubuntu/battery-roi-tool/assets/js/csv.js`
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — add `<script src>` for csv.js, remove the now-duplicate inline `parseCSV`/`parseDate`/`parsVolume` definitions.

After this task: `index.html` works exactly as before (functionally identical), but the three CSV helpers + a new `extractCsvForStorage` function live in `assets/js/csv.js` and are loaded via `<script src>`.

- [ ] **Step 1: Create `assets/js/csv.js` with the exact content below**

Run first to confirm the directory exists or needs creating:
```bash
ls -la /home/ubuntu/battery-roi-tool/assets/js 2>/dev/null || mkdir -p /home/ubuntu/battery-roi-tool/assets/js
```

Then use Write to create `/home/ubuntu/battery-roi-tool/assets/js/csv.js` with this EXACT content:

```js
// Shared CSV parsing for index.html (calculator) and dashboard.html (project create flow).
// Loaded via <script src> — exposes parseCSV/parseDate/parsVolume/extractCsvForStorage as globals.

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(';').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < 9) continue;
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function parseDate(str) {
  // dd-mm-yyyy
  const [d, m, y] = str.split('-');
  return new Date(+y, +m - 1, +d);
}

function parsVolume(str) {
  if (!str || str === '') return 0;
  return parseFloat(str.replace(',', '.')) || 0;
}

// Build the dailyCompact + meta object that the dashboard's "new project" flow stores in
// Firestore (and that index.html's project-mode reads back). Same per-day shape as v:5
// share-link saves, so the existing restore-path in index.html can decode it.
//
// Returns: { eanCode, meterNr, meterType, dailyCompact: { startDate, afname[], injectie[],
//            afnamedag[], afnamenacht[], injectiedag[], injectienacht[] } }
// Throws Error('Geen data gevonden in het CSV bestand.') if the CSV has no usable rows.
function extractCsvForStorage(csvText) {
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

- [ ] **Step 2: Add `<script src>` for csv.js in `index.html`**

Use Edit. Find the closing `</head>` line in `/home/ubuntu/battery-roi-tool/index.html` (currently line ~509, just after the Chart.js script tag added by an earlier feature). The target anchor is:
```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7"></script>
</head>
```

Replace with:
```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7"></script>
  <script src="assets/js/csv.js"></script>
</head>
```

- [ ] **Step 3: Remove the inline CSV helpers from `index.html`**

Use Edit. The target anchor is the exact string:
```js
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(';').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < 9) continue;
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function parseDate(str) {
  // dd-mm-yyyy
  const [d, m, y] = str.split('-');
  return new Date(+y, +m - 1, +d);
}

function parsVolume(str) {
  if (!str || str === '') return 0;
  return parseFloat(str.replace(',', '.')) || 0;
}

```

Replace with (just the empty line to keep spacing — nothing else):
```js
// CSV helpers (parseCSV, parseDate, parsVolume) zijn verhuisd naar assets/js/csv.js.

```

- [ ] **Step 4: Verify**

Run:
```bash
ls -la /home/ubuntu/battery-roi-tool/assets/js/csv.js
grep -c '^function parseCSV\|^function parseDate\|^function parsVolume' /home/ubuntu/battery-roi-tool/assets/js/csv.js
grep -c '^function parseCSV\|^function parseDate\|^function parsVolume' /home/ubuntu/battery-roi-tool/index.html
grep -c 'extractCsvForStorage' /home/ubuntu/battery-roi-tool/assets/js/csv.js
grep -c '<script src="assets/js/csv.js">' /home/ubuntu/battery-roi-tool/index.html
```

Expected:
- 1st: file exists.
- 2nd: `3` (the three helpers in csv.js).
- 3rd: `0` (no longer in index.html).
- 4th: `≥ 1` (extractCsvForStorage defined).
- 5th: `1` (script tag present).

- [ ] **Step 5: HTTP smoke + manual sanity**

```bash
cd /home/ubuntu/battery-roi-tool && python3 -m http.server 8000 >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
curl -sI http://localhost:8000/ | head -1
curl -sI http://localhost:8000/assets/js/csv.js | head -1
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```

Expected: both `HTTP/1.0 200 OK`. (Full browser smoke — uploading a CSV to the calculator and verifying it still works — is the user's responsibility before pushing.)

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add assets/js/csv.js index.html
git commit -m "Extract CSV helpers to assets/js/csv.js + add extractCsvForStorage()"
```

---

### Task 3: Create `assets/js/firebase-init.js`

**Files:**
- Create: `/home/ubuntu/battery-roi-tool/assets/js/firebase-init.js`

After this task: a single shared module loaded by both `dashboard.html` and (later) `index.html` that initializes Firebase, exposes auth helpers, Firestore project CRUD, and the status enum + colors. **The file contains a `FIREBASE_CONFIG_PLACEHOLDER` sentinel that Kevin must replace with his actual config from Task 1 Step 4 before any Firebase functionality works.**

- [ ] **Step 1: Create `firebase-init.js` with the exact content below**

Use Write to create `/home/ubuntu/battery-roi-tool/assets/js/firebase-init.js` with this EXACT content:

```js
// Firebase initialization + shared helpers for dashboard.html and index.html (project mode).
// Loaded via <script src> — exposes the Firebase namespace + helpers as globals.
//
// IMPORTANT: Replace FIREBASE_CONFIG_PLACEHOLDER below with the actual config object from
// Firebase Console → Project Settings → Your apps → web app. The config is public by design
// (security rules enforce access — see Firestore rules in the spec).

const FIREBASE_CONFIG = FIREBASE_CONFIG_PLACEHOLDER;

// Whitelist of emails allowed to access projects. Must match the Firestore security rules
// in Firebase Console exactly. Replace RUBEN_EMAIL_PLACEHOLDER with Ruben's actual email.
const WHITELISTED_EMAILS = [
  'kevin@bloxit.be',
  'RUBEN_EMAIL_PLACEHOLDER',
];

// ─── STATUS ENUM ─────────────────────────────────────────────────────────────
// 16 status values, free transitions allowed. Order = logical lifecycle order for the
// dropdown UI. Color hex values follow the spec's color column.
const PROJECT_STATUSES = [
  { key: 'nieuw_contact',         label: 'Nieuw contact',                 color: '#9aa3b2' }, // grijs
  { key: 'wachten_op_data',       label: 'Wachten op data',               color: '#9aa3b2' }, // grijs
  { key: 'klaar_voor_bezoek',     label: 'Klaar voor bezoek',             color: '#7eb6e8' }, // lichtblauw
  { key: 'bezoek_gepland',        label: 'Bezoek gepland',                color: '#2c7be5' }, // blauw
  { key: 'bezoek_gedaan',         label: 'Bezoek gedaan / link verstuurd',color: '#2c7be5' }, // blauw
  { key: 'offerte_uit',           label: 'Offerte verzonden',             color: '#f6a623' }, // geel
  { key: 'wacht_op_beslissing',   label: 'Wacht op beslissing',           color: '#f6a623' }, // geel
  { key: 'akkoord',               label: 'Akkoord (go)',                  color: '#00b478' }, // groen
  { key: 'installatie_gepland',   label: 'Installatie gepland',           color: '#00b478' }, // groen
  { key: 'in_uitvoering',         label: 'In uitvoering',                 color: '#00b478' }, // groen
  { key: 'keuring_aangevraagd',   label: 'Keuring aangevraagd',           color: '#00b478' }, // groen
  { key: 'keuring_gepland',       label: 'Keuring gepland',               color: '#00b478' }, // groen
  { key: 'keuring_gedaan',        label: 'Keuring gedaan',                color: '#00b478' }, // groen
  { key: 'facturatie',            label: 'Facturatie',                    color: '#00b478' }, // groen
  { key: 'afgesloten',            label: 'Afgesloten',                    color: '#0a6e4a' }, // donkergroen
  { key: 'niet_akkoord',          label: 'Niet akkoord',                  color: '#e54545' }, // rood
];

const DEFAULT_STATUS = 'nieuw_contact';

function getStatusMeta(key) {
  return PROJECT_STATUSES.find(s => s.key === key) || { key, label: key, color: '#9aa3b2' };
}

// ─── INIT ────────────────────────────────────────────────────────────────────
let _firebaseApp = null;
let _firebaseDb  = null;
let _firebaseAuth = null;

function initFirebase() {
  if (_firebaseApp) return _firebaseApp;
  if (typeof firebase === 'undefined') {
    throw new Error('Firebase SDK niet geladen. Controleer of de <script src="https://www.gstatic.com/firebasejs/...firebase-app-compat.js"> tags aanwezig zijn.');
  }
  _firebaseApp  = firebase.initializeApp(FIREBASE_CONFIG);
  _firebaseDb   = firebase.firestore();
  _firebaseAuth = firebase.auth();
  return _firebaseApp;
}

function getDb()   { initFirebase(); return _firebaseDb; }
function getAuth() { initFirebase(); return _firebaseAuth; }

// ─── AUTH ────────────────────────────────────────────────────────────────────
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return getAuth().signInWithPopup(provider);
}

function signOut() {
  return getAuth().signOut();
}

function onAuthStateChanged(cb) {
  return getAuth().onAuthStateChanged(cb);
}

function isWhitelisted(user) {
  if (!user || !user.email) return false;
  return WHITELISTED_EMAILS.includes(user.email);
}

function currentUserEmail() {
  const u = getAuth().currentUser;
  return u && u.email ? u.email : null;
}

// ─── FIRESTORE: PROJECTS COLLECTION ──────────────────────────────────────────
// Document shape — see spec §Data model:
//   { projectName, customerName, status, createdBy, createdAt, updatedAt, deletedAt,
//     csvUpload: null | {...}, lastCalcRun: null | {...} }

function projectsCol() { return getDb().collection('projects'); }
function projectDoc(id) { return projectsCol().doc(id); }

// Create a project. csvData is the optional output of extractCsvForStorage(); pass null
// if no CSV was uploaded at creation. Returns the new document reference.
async function createProject({ projectName, customerName, status, csvData }) {
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
  return projectsCol().add(doc);
}

// Fetch all non-deleted projects, ordered by updatedAt desc.
async function listActiveProjects() {
  const snap = await projectsCol().where('deletedAt', '==', null).orderBy('updatedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Fetch all deleted projects, ordered by deletedAt desc.
async function listDeletedProjects() {
  const snap = await projectsCol().where('deletedAt', '!=', null).orderBy('deletedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getProject(id) {
  const snap = await projectDoc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function updateProjectStatus(id, status) {
  await projectDoc(id).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function softDeleteProject(id) {
  await projectDoc(id).update({
    deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function restoreProject(id) {
  await projectDoc(id).update({
    deletedAt: null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Replace the project's CSV (used both at first upload AND when replacing an existing CSV).
async function setProjectCsv(id, csvData) {
  const email = currentUserEmail();
  await projectDoc(id).update({
    csvUpload: {
      uploadedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      uploadedBy:  email,
      eanCode:     csvData.eanCode,
      meterNr:     csvData.meterNr,
      meterType:   csvData.meterType,
      dailyCompact: csvData.dailyCompact,
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Save the latest calculation result. `results` is the full r-object from _serializeState
// minus dailyCompact (which lives in csvUpload). Caller is responsible for stripping it.
async function saveLastCalcRun(id, { inputs, results }) {
  const email = currentUserEmail();
  await projectDoc(id).update({
    lastCalcRun: {
      calculatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      calculatedBy:  email,
      inputs,
      results,
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}
```

- [ ] **Step 2: Verify**

Run:
```bash
ls -la /home/ubuntu/battery-roi-tool/assets/js/firebase-init.js
grep -cE "^function (initFirebase|signInWithGoogle|signOut|onAuthStateChanged|isWhitelisted|createProject|listActiveProjects|listDeletedProjects|getProject|updateProjectStatus|softDeleteProject|restoreProject|setProjectCsv|saveLastCalcRun|getStatusMeta|currentUserEmail|getDb|getAuth)" /home/ubuntu/battery-roi-tool/assets/js/firebase-init.js
grep -c "FIREBASE_CONFIG_PLACEHOLDER\|RUBEN_EMAIL_PLACEHOLDER" /home/ubuntu/battery-roi-tool/assets/js/firebase-init.js
grep -c "PROJECT_STATUSES" /home/ubuntu/battery-roi-tool/assets/js/firebase-init.js
```

Expected:
- 1st: file exists.
- 2nd: 17 (one declaration per helper — including async ones declared with `async function`).
  - **Note:** `async function name(...)` matches `^function name` because `async ` precedes `function`. Adjust the regex if the count is off; the actual helpers required are: initFirebase, getDb, getAuth, signInWithGoogle, signOut, onAuthStateChanged, isWhitelisted, currentUserEmail, getStatusMeta, createProject, listActiveProjects, listDeletedProjects, getProject, updateProjectStatus, softDeleteProject, restoreProject, setProjectCsv, saveLastCalcRun (18 functions).
  - Also try without the `^`: `grep -cE "^(async )?function (initFirebase|signInWithGoogle|signOut|...)"` — should be `≥ 18`.
- 3rd: `2` (both placeholders present, awaiting Kevin's substitution).
- 4th: `≥ 1` (status enum present).

- [ ] **Step 3: Commit (placeholders intentionally still present)**

```bash
cd /home/ubuntu/battery-roi-tool
git add assets/js/firebase-init.js
git commit -m "Add Firebase init + auth + Firestore CRUD helpers (config placeholders)"
```

After this commit, Kevin replaces the two `*_PLACEHOLDER` sentinels in `firebase-init.js` with real values (or does it as a separate commit before deploy). The implementer continues with Task 4 regardless — placeholders don't block the structural work.

---

### Task 4: Create `dashboard.html` skeleton with auth-state UI

**Files:**
- Create: `/home/ubuntu/battery-roi-tool/dashboard.html`

After this task: `dashboard.html` exists. Visiting it shows one of three states based on Firebase Auth: (a) "Log in met Google" button, (b) "Geen toegang voor dit account" + uitlog-knop, or (c) the (empty for now) project-list scaffold with header/uitlog/`+ Nieuw project` button. The state machine works; project list rendering + new-project form come in later tasks.

- [ ] **Step 1: Create `dashboard.html` with the exact content below**

Use Write to create `/home/ubuntu/battery-roi-tool/dashboard.html` with this EXACT content:

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SmartPeak — Projecten</title>
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js"></script>
  <script src="assets/js/csv.js"></script>
  <script src="assets/js/firebase-init.js"></script>
  <style>
    :root {
      --primary: #2c7be5;
      --primary-dark: #1a5fba;
      --success: #00b478;
      --warning: #f6a623;
      --danger: #e54545;
      --bg: #f0f4fb;
      --card: #ffffff;
      --border: #dce3f0;
      --text: #1e2a3a;
      --muted: #6b7a99;
      --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 24px 16px;
    }
    h1 { font-size: 1.7rem; font-weight: 700; color: var(--primary-dark); margin-bottom: 4px; }
    h2 { font-size: 1.2rem; font-weight: 600; color: var(--primary-dark); margin-bottom: 12px; }
    .subtitle { color: var(--muted); font-size: 0.95rem; margin-bottom: 16px; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(44, 123, 229, 0.06);
    }
    .center-card {
      max-width: 480px;
      margin: 80px auto;
      text-align: center;
    }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      border-radius: 8px;
      border: 0;
      background: var(--primary);
      color: #fff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
    }
    .btn:hover { background: var(--primary-dark); }
    .btn-secondary { background: transparent; color: var(--primary); border: 1px solid var(--primary); }
    .btn-secondary:hover { background: #eef4ff; }
    .btn-danger { background: var(--danger); }
    .btn-danger:hover { background: #b02a2a; }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .topbar .right { display: flex; align-items: center; gap: 12px; color: var(--muted); }

    .toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }

    .alert {
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.92rem;
      margin-bottom: 16px;
    }
    .alert-warning { background: #fff8ec; border: 1px solid #f6a623; color: #7a5000; }
    .alert-info    { background: #eef4ff; border: 1px solid #2c7be5; color: #1a3a6e; }
    .alert-error   { background: #fde8e8; border: 1px solid #e54545; color: #7a1010; }

    .hide { display: none !important; }

    /* placeholders — Task 5 fills these in */
    #projectList { color: var(--muted); font-style: italic; }
  </style>
</head>
<body>

<!-- State 1: not logged in -->
<div class="card center-card" id="stateLoggedOut">
  <h1>⚡ SmartPeak — Projecten</h1>
  <p class="subtitle">Alleen voor Bloxit medewerkers.</p>
  <button type="button" class="btn" id="btnSignIn">Log in met Google</button>
  <p id="signInError" class="alert alert-error hide" style="margin-top:16px;"></p>
</div>

<!-- State 2: logged in but not whitelisted -->
<div class="card center-card hide" id="stateNotWhitelisted">
  <h1>⚠️ Geen toegang</h1>
  <p class="subtitle">Je bent ingelogd als <strong id="notWhitelistedEmail">…</strong> maar dit account heeft geen toegang tot SmartPeak Projecten.</p>
  <button type="button" class="btn btn-secondary" id="btnSignOutNW">Uitlog</button>
</div>

<!-- State 3: logged in + whitelisted -->
<div class="hide" id="stateAuthorized">
  <div class="topbar">
    <h1>⚡ SmartPeak — Projecten</h1>
    <div class="right">
      <span>Hallo, <strong id="userDisplayName">…</strong></span>
      <button type="button" class="btn btn-secondary" id="btnSignOut">Uitlog</button>
    </div>
  </div>

  <div class="card">
    <div class="toolbar">
      <button type="button" class="btn" id="btnNewProject">+ Nieuw project</button>
      <label style="display:flex;align-items:center;gap:6px;color:var(--muted);font-size:0.9rem;">
        <input type="checkbox" id="toggleShowDeleted" /> Toon verwijderde projecten
      </label>
    </div>
    <div id="projectList">Project-lijst komt in Task 5.</div>
  </div>
</div>

<script>
// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
function showState(which) {
  ['stateLoggedOut', 'stateNotWhitelisted', 'stateAuthorized'].forEach(id => {
    document.getElementById(id).classList.toggle('hide', id !== which);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Wire sign-in button
  document.getElementById('btnSignIn').addEventListener('click', async () => {
    const errEl = document.getElementById('signInError');
    errEl.classList.add('hide');
    try {
      await signInWithGoogle();
      // onAuthStateChanged will pick up the new user and switch state.
    } catch (e) {
      errEl.textContent = 'Aanmelden mislukt: ' + (e && e.message ? e.message : e);
      errEl.classList.remove('hide');
    }
  });
  document.getElementById('btnSignOut').addEventListener('click', () => signOut());
  document.getElementById('btnSignOutNW').addEventListener('click', () => signOut());

  // Listen for auth state changes
  onAuthStateChanged(user => {
    if (!user) {
      showState('stateLoggedOut');
      return;
    }
    if (!isWhitelisted(user)) {
      document.getElementById('notWhitelistedEmail').textContent = user.email || '(onbekend)';
      showState('stateNotWhitelisted');
      return;
    }
    document.getElementById('userDisplayName').textContent = user.displayName || user.email;
    showState('stateAuthorized');
    // Task 5 will hook in: fetch and render the project list here.
  });
});
</script>

</body>
</html>
```

- [ ] **Step 2: Verify**

Run:
```bash
ls -la /home/ubuntu/battery-roi-tool/dashboard.html
grep -c 'firebase-app-compat\|firebase-auth-compat\|firebase-firestore-compat' /home/ubuntu/battery-roi-tool/dashboard.html
grep -c 'id="stateLoggedOut"\|id="stateNotWhitelisted"\|id="stateAuthorized"' /home/ubuntu/battery-roi-tool/dashboard.html
grep -c 'btnSignIn\|btnSignOut\|btnNewProject\|toggleShowDeleted\|projectList' /home/ubuntu/battery-roi-tool/dashboard.html
```

Expected:
- 1st: file exists.
- 2nd: `3` (all three Firebase compat scripts).
- 3rd: `3` (three auth states).
- 4th: `≥ 5` (UI elements wired).

- [ ] **Step 3: HTTP smoke**

```bash
cd /home/ubuntu/battery-roi-tool && python3 -m http.server 8000 >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
curl -sI http://localhost:8000/dashboard.html | head -1
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```

Expected: `HTTP/1.0 200 OK`. Note: `dashboard.html` will throw a Firebase init error in the browser console until Kevin replaces `FIREBASE_CONFIG_PLACEHOLDER` in `firebase-init.js` — that's expected at this stage.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add dashboard.html
git commit -m "Add dashboard.html skeleton with auth-state UI (login / not-whitelisted / authorized)"
```

---

### Task 5: Dashboard project-list rendering with status chips

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/dashboard.html` — add CSS for the project table + status chips, replace the placeholder `#projectList` with a live render that fetches from Firestore.

After this task: when an authorized user lands on `dashboard.html`, the page fetches non-deleted projects (sorted by `updatedAt` desc) and renders them as a table with project name, customer name, status chip, last-updated date, created-by, and 📂/🗑️ action icons. The 🗑️ icon doesn't yet do anything — Task 7 wires it.

- [ ] **Step 1: Add table + status-chip CSS**

Use Edit. The target anchor is the exact string:
```css
    /* placeholders — Task 5 fills these in */
    #projectList { color: var(--muted); font-style: italic; }
```

Replace with:
```css
    table.project-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
    }
    table.project-table th,
    table.project-table td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: middle;
    }
    table.project-table thead th {
      background: var(--bg);
      color: var(--muted);
      font-weight: 600;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    table.project-table tr:last-child td { border-bottom: none; }
    table.project-table tr.deleted-row { opacity: 0.5; }

    .status-chip {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .status-chip.readonly { cursor: default; }

    .row-actions {
      display: flex;
      gap: 6px;
    }
    .row-actions button {
      background: transparent;
      border: 0;
      cursor: pointer;
      font-size: 1.05rem;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .row-actions button:hover { background: var(--bg); }

    #projectList .empty-state {
      color: var(--muted);
      font-style: italic;
      padding: 24px 8px;
    }
```

- [ ] **Step 2: Add the project-list rendering JS**

Use Edit. The target anchor is the exact string (inside the existing `<script>` block):
```js
    document.getElementById('userDisplayName').textContent = user.displayName || user.email;
    showState('stateAuthorized');
    // Task 5 will hook in: fetch and render the project list here.
  });
});
```

Replace with:
```js
    document.getElementById('userDisplayName').textContent = user.displayName || user.email;
    showState('stateAuthorized');
    refreshProjectList();
  });

  document.getElementById('toggleShowDeleted').addEventListener('change', refreshProjectList);
});

// ─── PROJECT LIST ───────────────────────────────────────────────────────────
function fmtDate(ts) {
  // ts = Firestore Timestamp
  if (!ts || typeof ts.toDate !== 'function') return '—';
  return ts.toDate().toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function shortName(email) {
  if (!email) return '—';
  return email.split('@')[0];
}

function statusChipHTML(statusKey) {
  const meta = getStatusMeta(statusKey);
  return `<span class="status-chip readonly" data-status="${meta.key}" style="background:${meta.color};">${meta.label}</span>`;
}

function rowHTML(p, isDeleted) {
  const updated = fmtDate(p.updatedAt);
  const by      = shortName(p.createdBy);
  const action  = isDeleted
    ? `<button type="button" class="restoreBtn"  data-id="${p.id}" title="Herstellen">↶</button>`
    : `<button type="button" class="deleteBtn"   data-id="${p.id}" title="Verwijderen">🗑️</button>`;
  return `
    <tr class="${isDeleted ? 'deleted-row' : ''}">
      <td><a href="index.html?project=${p.id}" style="color:var(--primary);text-decoration:none;font-weight:600;">${escapeHtml(p.projectName || '')}</a></td>
      <td>${escapeHtml(p.customerName || '')}</td>
      <td>${statusChipHTML(p.status)}</td>
      <td>${updated}</td>
      <td>${by}</td>
      <td class="row-actions">
        <button type="button" class="openBtn" data-id="${p.id}" title="Open">📂</button>
        ${action}
      </td>
    </tr>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

async function refreshProjectList() {
  const el = document.getElementById('projectList');
  el.innerHTML = '<p class="empty-state">⏳ Laden…</p>';
  const showDeleted = document.getElementById('toggleShowDeleted').checked;
  try {
    const active  = await listActiveProjects();
    const deleted = showDeleted ? await listDeletedProjects() : [];
    const total = active.length + deleted.length;
    if (total === 0) {
      el.innerHTML = '<p class="empty-state">Nog geen projecten. Klik op <strong>+ Nieuw project</strong> om te beginnen.</p>';
      return;
    }
    const rows = [
      ...active.map(p => rowHTML(p, false)),
      ...deleted.map(p => rowHTML(p, true)),
    ].join('');
    el.innerHTML = `
      <table class="project-table">
        <thead><tr>
          <th>Project</th><th>Klant</th><th>Status</th><th>Bijgewerkt</th><th>Door</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    // Wire open buttons
    el.querySelectorAll('.openBtn').forEach(btn => {
      btn.addEventListener('click', () => { window.location.href = `index.html?project=${btn.dataset.id}`; });
    });
    // delete/restore wired in Task 7
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">Kon projecten niet laden: ${escapeHtml(e && e.message ? e.message : String(e))}</div>`;
  }
}
```

- [ ] **Step 3: Verify**

Run:
```bash
grep -c 'class="project-table"\|status-chip\|row-actions' /home/ubuntu/battery-roi-tool/dashboard.html
grep -c 'function refreshProjectList\|function statusChipHTML\|function rowHTML\|function escapeHtml\|function shortName\|function fmtDate' /home/ubuntu/battery-roi-tool/dashboard.html
grep -c 'listActiveProjects\|listDeletedProjects' /home/ubuntu/battery-roi-tool/dashboard.html
```

Expected:
- 1st: `≥ 3`.
- 2nd: `6` (all helpers defined).
- 3rd: `≥ 2` (both list functions called).

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add dashboard.html
git commit -m "Dashboard: render project list with status chips, sorted by updatedAt desc"
```

---

### Task 6: Dashboard new-project form

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/dashboard.html` — add a modal form (projectName, customerName, status dropdown, optional CSV upload), wire the `+ Nieuw project` button to open it, and the submit handler to call `createProject()` then redirect.

After this task: clicking `+ Nieuw project` opens a modal form. Filling in projectname + customername + (optional) CSV → submit → new Firestore document is created and the user is redirected to `index.html?project=<new-id>`.

- [ ] **Step 1: Add modal CSS**

Use Edit. The target anchor is the exact string:
```css
    #projectList .empty-state {
      color: var(--muted);
      font-style: italic;
      padding: 24px 8px;
    }
```

Replace with:
```css
    #projectList .empty-state {
      color: var(--muted);
      font-style: italic;
      padding: 24px 8px;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 16px;
    }
    .modal-backdrop.open { display: flex; }
    .modal {
      background: var(--card);
      border-radius: var(--radius);
      padding: 24px;
      max-width: 520px;
      width: 100%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
    .modal h2 { margin-bottom: 16px; }
    .form-row { margin-bottom: 14px; }
    .form-row label { display: block; font-weight: 600; margin-bottom: 6px; color: var(--text); font-size: 0.9rem; }
    .form-row input[type="text"],
    .form-row select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font: inherit;
      background: #fff;
    }
    .form-row .help { color: var(--muted); font-size: 0.82rem; margin-top: 4px; }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
```

- [ ] **Step 2: Add modal HTML inside the body**

Use Edit. The target anchor is the exact string:
```html
<script>
// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
function showState(which) {
```

Replace with:
```html
<div class="modal-backdrop" id="newProjectBackdrop">
  <div class="modal">
    <h2>+ Nieuw project</h2>
    <form id="newProjectForm">
      <div class="form-row">
        <label for="npName">Projectnaam <span style="color:var(--danger)">*</span></label>
        <input type="text" id="npName" required maxlength="120" />
      </div>
      <div class="form-row">
        <label for="npCustomer">Klantnaam <span style="color:var(--danger)">*</span></label>
        <input type="text" id="npCustomer" required maxlength="120" />
      </div>
      <div class="form-row">
        <label for="npStatus">Status</label>
        <select id="npStatus"></select>
      </div>
      <div class="form-row">
        <label for="npCsv">CSV (Fluvius export)</label>
        <input type="file" id="npCsv" accept=".csv" />
        <div class="help">Optioneel — kan ook later toegevoegd worden binnen het project.</div>
      </div>
      <div id="npError" class="alert alert-error hide"></div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="npCancelBtn">Annuleren</button>
        <button type="submit" class="btn" id="npSubmitBtn">Aanmaken</button>
      </div>
    </form>
  </div>
</div>

<script>
// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
function showState(which) {
```

- [ ] **Step 3: Wire up the form**

Use Edit. The target anchor is the exact string (existing wire-up area):
```js
  document.getElementById('btnSignOut').addEventListener('click', () => signOut());
  document.getElementById('btnSignOutNW').addEventListener('click', () => signOut());
```

Replace with:
```js
  document.getElementById('btnSignOut').addEventListener('click', () => signOut());
  document.getElementById('btnSignOutNW').addEventListener('click', () => signOut());

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

- [ ] **Step 4: Verify**

Run:
```bash
grep -c 'id="newProjectBackdrop"\|id="newProjectForm"\|id="npName"\|id="npCustomer"\|id="npStatus"\|id="npCsv"' /home/ubuntu/battery-roi-tool/dashboard.html
grep -c 'extractCsvForStorage\|createProject' /home/ubuntu/battery-roi-tool/dashboard.html
grep -c 'PROJECT_STATUSES' /home/ubuntu/battery-roi-tool/dashboard.html
```

Expected:
- 1st: `6`.
- 2nd: `≥ 2`.
- 3rd: `≥ 1`.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add dashboard.html
git commit -m "Dashboard: new-project modal with optional CSV upload + create + redirect"
```

---

### Task 7: Status chip dropdown + soft delete + restore

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/dashboard.html` — make the status chips clickable (open a small dropdown), wire the 🗑️ delete + ↶ restore buttons.

After this task: clicking a status chip in the project list opens a small inline dropdown that lets the user pick another status; selection updates Firestore + re-renders the row. Clicking 🗑️ shows a confirm prompt and soft-deletes; clicking ↶ on a deleted row restores it.

- [ ] **Step 1: Add CSS for the chip dropdown**

Use Edit. The target anchor is the exact string:
```css
    .status-chip.readonly { cursor: default; }
```

Replace with:
```css
    .status-chip.readonly { cursor: default; }
    .status-chip.editable:hover { filter: brightness(1.08); }
    .status-popover {
      position: absolute;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      padding: 4px 0;
      z-index: 50;
      min-width: 220px;
      max-height: 360px;
      overflow-y: auto;
    }
    .status-popover .status-option {
      padding: 6px 12px;
      cursor: pointer;
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-popover .status-option:hover { background: var(--bg); }
    .status-popover .status-dot {
      width: 10px; height: 10px; border-radius: 50%;
    }
```

- [ ] **Step 2: Make chips editable + add popover logic**

Use Edit. The target anchor is the exact string:
```js
function statusChipHTML(statusKey) {
  const meta = getStatusMeta(statusKey);
  return `<span class="status-chip readonly" data-status="${meta.key}" style="background:${meta.color};">${meta.label}</span>`;
}
```

Replace with:
```js
function statusChipHTML(statusKey, projectId) {
  const meta = getStatusMeta(statusKey);
  return `<span class="status-chip editable" data-status="${meta.key}" data-project-id="${projectId}" style="background:${meta.color};">${meta.label}</span>`;
}

let _openPopover = null;
function closeStatusPopover() {
  if (_openPopover) { _openPopover.remove(); _openPopover = null; }
}

function openStatusPopover(chip) {
  closeStatusPopover();
  const projectId = chip.dataset.projectId;
  const currentKey = chip.dataset.status;
  const pop = document.createElement('div');
  pop.className = 'status-popover';
  pop.innerHTML = PROJECT_STATUSES.map(s => `
    <div class="status-option" data-status="${s.key}">
      <span class="status-dot" style="background:${s.color}"></span>
      <span>${s.label}</span>
      ${s.key === currentKey ? '<span style="margin-left:auto;color:var(--muted);">✓</span>' : ''}
    </div>
  `).join('');
  document.body.appendChild(pop);
  const rect = chip.getBoundingClientRect();
  pop.style.left = `${rect.left + window.scrollX}px`;
  pop.style.top  = `${rect.bottom + window.scrollY + 4}px`;
  _openPopover = pop;

  pop.querySelectorAll('.status-option').forEach(opt => {
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newStatus = opt.dataset.status;
      closeStatusPopover();
      if (newStatus === currentKey) return;
      try {
        await updateProjectStatus(projectId, newStatus);
        await refreshProjectList();
      } catch (err) {
        alert('Kon status niet wijzigen: ' + (err && err.message ? err.message : err));
      }
    });
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', closeStatusPopover, { once: true });
  }, 0);
}
```

- [ ] **Step 3: Update `rowHTML` to pass project ID + wire chip + delete/restore handlers**

Use Edit. The target anchor is the exact string:
```js
function rowHTML(p, isDeleted) {
  const updated = fmtDate(p.updatedAt);
  const by      = shortName(p.createdBy);
  const action  = isDeleted
    ? `<button type="button" class="restoreBtn"  data-id="${p.id}" title="Herstellen">↶</button>`
    : `<button type="button" class="deleteBtn"   data-id="${p.id}" title="Verwijderen">🗑️</button>`;
  return `
    <tr class="${isDeleted ? 'deleted-row' : ''}">
      <td><a href="index.html?project=${p.id}" style="color:var(--primary);text-decoration:none;font-weight:600;">${escapeHtml(p.projectName || '')}</a></td>
      <td>${escapeHtml(p.customerName || '')}</td>
      <td>${statusChipHTML(p.status)}</td>
      <td>${updated}</td>
      <td>${by}</td>
      <td class="row-actions">
        <button type="button" class="openBtn" data-id="${p.id}" title="Open">📂</button>
        ${action}
      </td>
    </tr>`;
}
```

Replace with:
```js
function rowHTML(p, isDeleted) {
  const updated = fmtDate(p.updatedAt);
  const by      = shortName(p.createdBy);
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
}
```

(only the `statusChipHTML(p.status, p.id)` call signature changed — pass project ID).

- [ ] **Step 4: Wire chip + delete + restore handlers in `refreshProjectList`**

Use Edit. The target anchor is the exact string:
```js
    // Wire open buttons
    el.querySelectorAll('.openBtn').forEach(btn => {
      btn.addEventListener('click', () => { window.location.href = `index.html?project=${btn.dataset.id}`; });
    });
    // delete/restore wired in Task 7
```

Replace with:
```js
    // Wire open buttons
    el.querySelectorAll('.openBtn').forEach(btn => {
      btn.addEventListener('click', () => { window.location.href = `index.html?project=${btn.dataset.id}`; });
    });
    // Wire status-chip popovers
    el.querySelectorAll('.status-chip.editable').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        openStatusPopover(chip);
      });
    });
    // Wire delete buttons
    el.querySelectorAll('.deleteBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Project verwijderen? Het wordt soft-deleted en blijft herstelbaar via "Toon verwijderde projecten".')) return;
        try {
          await softDeleteProject(btn.dataset.id);
          await refreshProjectList();
        } catch (err) {
          alert('Kon niet verwijderen: ' + (err && err.message ? err.message : err));
        }
      });
    });
    // Wire restore buttons
    el.querySelectorAll('.restoreBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await restoreProject(btn.dataset.id);
          await refreshProjectList();
        } catch (err) {
          alert('Kon niet herstellen: ' + (err && err.message ? err.message : err));
        }
      });
    });
```

- [ ] **Step 5: Verify**

Run:
```bash
grep -c 'function openStatusPopover\|function closeStatusPopover' /home/ubuntu/battery-roi-tool/dashboard.html
grep -c 'softDeleteProject\|restoreProject\|updateProjectStatus' /home/ubuntu/battery-roi-tool/dashboard.html
grep -c '.status-chip.editable\|.deleteBtn\|.restoreBtn' /home/ubuntu/battery-roi-tool/dashboard.html
```

Expected:
- 1st: `2`.
- 2nd: `≥ 3`.
- 3rd: `≥ 3`.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add dashboard.html
git commit -m "Dashboard: clickable status chips + soft delete + restore"
```

---

### Task 8: `index.html` `?project=<id>` mode entry — auth + load + banner

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — add Firebase script tags, add a project-banner element above the form, add JS to detect `?project=`, do auth check, load project from Firestore, render banner with status chip dropdown.

After this task: navigating to `index.html?project=<valid-id>` (after Kevin replaced the placeholders + signed in) loads the project document, shows a banner with project name + customer + clickable status chip + "← Terug naar dashboard" link. CSV+calc data is also loaded into the existing `_saved` state and rendered (reusing the share-link restore path). Auto-save comes in Task 10.

- [ ] **Step 1: Add Firebase compat scripts + firebase-init.js to `index.html`**

Use Edit. The target anchor is the exact string:
```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7"></script>
  <script src="assets/js/csv.js"></script>
</head>
```

Replace with:
```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7"></script>
  <script src="assets/js/csv.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js"></script>
  <script src="assets/js/firebase-init.js"></script>
</head>
```

- [ ] **Step 2: Add project-banner CSS**

Find the `</style>` line near the top of `index.html` (line ~509+ depending on prior tasks). Use Edit. The target anchor is the exact string:
```css
  </style>
```

Replace with:
```css
    /* ─── Project banner (only shown in ?project=<id> mode) ─────────────── */
    .project-banner {
      background: linear-gradient(135deg, #eef4ff 0%, #dbeafe 100%);
      border: 1px solid var(--primary);
      border-radius: var(--radius);
      padding: 14px 20px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .project-banner .pb-name { font-weight: 700; color: var(--primary-dark); font-size: 1.05rem; }
    .project-banner .pb-customer { color: var(--text); }
    .project-banner .pb-back {
      margin-left: auto;
      font-size: 0.9rem;
      color: var(--primary);
      text-decoration: none;
    }
    .project-banner .pb-back:hover { text-decoration: underline; }
    .status-chip {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .status-popover {
      position: absolute;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      padding: 4px 0;
      z-index: 50;
      min-width: 220px;
      max-height: 360px;
      overflow-y: auto;
    }
    .status-popover .status-option {
      padding: 6px 12px;
      cursor: pointer;
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-popover .status-option:hover { background: var(--bg); }
    .status-popover .status-dot { width: 10px; height: 10px; border-radius: 50%; }
  </style>
```

- [ ] **Step 3: Add project-banner element to body**

Find the line `<h1>` near the top of `<body>` in `index.html`. Use Edit. The target anchor (verify with grep first):
```bash
grep -n '<h1>⚡' /home/ubuntu/battery-roi-tool/index.html | head -3
```

Use Edit with the exact `<h1>` line that's at the top of `<body>` (NOT the one in the bottom-of-page disclaimers, etc.). Anchor:
```html
<body>
```

Replace with:
```html
<body>

<div id="projectBanner" class="project-banner" style="display:none;">
  <span class="pb-name" id="pbName">…</span>
  <span class="pb-customer">👤 <span id="pbCustomer">…</span></span>
  <span id="pbStatusChip"></span>
  <a class="pb-back" href="dashboard.html">← Terug naar dashboard</a>
</div>
```

- [ ] **Step 4: Add the project-mode JS at the END of the existing `<script>` block**

The existing `<script>` block ends with `</script>` near `</body>`. Use Edit. The target anchor (run grep first to find the exact line):
```bash
grep -n '</script>' /home/ubuntu/battery-roi-tool/index.html | tail -1
```

That gives the line number of the script-block close. Read 5 lines before it to find a unique anchor. The end of the script typically looks like the closing `}` of an event handler or the main IIFE; use the LAST `}` before `</script>` as part of your anchor.

Replace `</script>\n\n</body>` (or whatever the exact closing pattern is) with the same lines preceded by:
```js
// ─── PROJECT MODE (?project=<id>) ────────────────────────────────────────────
let _projectId   = null;
let _projectDoc  = null;

(function bootstrapProjectMode() {
  const params = new URLSearchParams(window.location.search);
  const pid = params.get('project');
  if (!pid) return; // Not project mode — bare or ?data=<b64>, leave everything as-is.
  _projectId = pid;
  // Wait for Firebase + auth before doing anything.
  onAuthStateChanged(async (user) => {
    if (!user || !isWhitelisted(user)) {
      // Redirect to dashboard. Keep the project ID in the URL so dashboard can return to it
      // after sign-in (Phase 2 could implement that; for Phase 1 we just send them to dashboard).
      window.location.href = `dashboard.html`;
      return;
    }
    try {
      await loadProjectIntoUI(pid);
    } catch (e) {
      console.error('Project load error:', e);
      alert('Kon project niet laden: ' + (e && e.message ? e.message : e));
      window.location.href = 'dashboard.html';
    }
  });
})();

async function loadProjectIntoUI(id) {
  const proj = await getProject(id);
  if (!proj || proj.deletedAt) {
    alert('Project niet gevonden of verwijderd.');
    window.location.href = 'dashboard.html';
    return;
  }
  _projectDoc = proj;

  // Render banner
  document.getElementById('pbName').textContent     = proj.projectName || '(zonder naam)';
  document.getElementById('pbCustomer').textContent = proj.customerName || '—';
  renderProjectStatusChip();
  document.getElementById('projectBanner').style.display = '';

  // If we have CSV + calc data, reuse the v:5 share-link restore path.
  if (proj.csvUpload && proj.lastCalcRun) {
    const restored = buildSavedFromProject(proj);
    _applyLoadedState(restored, /*showBanner*/ false);
  } else if (proj.csvUpload && !proj.lastCalcRun) {
    // CSV present but never calculated — TODO Task 9 will handle the "ready to calc" UI here.
    // For now: leave the form untouched; user clicks Bereken to compute.
  } else {
    // No CSV at all — TODO Task 9 will show the "upload CSV first" state here.
  }
}

function renderProjectStatusChip() {
  const meta = getStatusMeta(_projectDoc.status);
  const el = document.getElementById('pbStatusChip');
  el.innerHTML = `<span class="status-chip" id="pbChip" data-status="${meta.key}" style="background:${meta.color};">${meta.label}</span>`;
  document.getElementById('pbChip').addEventListener('click', (e) => {
    e.stopPropagation();
    openProjectStatusPopover();
  });
}

let _openPbPopover = null;
function closeProjectStatusPopover() {
  if (_openPbPopover) { _openPbPopover.remove(); _openPbPopover = null; }
}
function openProjectStatusPopover() {
  closeProjectStatusPopover();
  const chip = document.getElementById('pbChip');
  const pop = document.createElement('div');
  pop.className = 'status-popover';
  pop.innerHTML = PROJECT_STATUSES.map(s => `
    <div class="status-option" data-status="${s.key}">
      <span class="status-dot" style="background:${s.color}"></span>
      <span>${s.label}</span>
      ${s.key === _projectDoc.status ? '<span style="margin-left:auto;color:var(--muted);">✓</span>' : ''}
    </div>
  `).join('');
  document.body.appendChild(pop);
  const rect = chip.getBoundingClientRect();
  pop.style.left = `${rect.left + window.scrollX}px`;
  pop.style.top  = `${rect.bottom + window.scrollY + 4}px`;
  _openPbPopover = pop;
  pop.querySelectorAll('.status-option').forEach(opt => {
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newStatus = opt.dataset.status;
      closeProjectStatusPopover();
      if (newStatus === _projectDoc.status) return;
      try {
        await updateProjectStatus(_projectId, newStatus);
        _projectDoc.status = newStatus;
        renderProjectStatusChip();
      } catch (err) {
        alert('Kon status niet wijzigen: ' + (err && err.message ? err.message : err));
      }
    });
  });
  setTimeout(() => { document.addEventListener('click', closeProjectStatusPopover, { once: true }); }, 0);
}

// Build a v:5-shaped state object from a project document so we can feed it through
// the existing _applyLoadedState restore-path (which already understands dailyCompact).
function buildSavedFromProject(proj) {
  const r = (proj.lastCalcRun && proj.lastCalcRun.results) ? { ...proj.lastCalcRun.results } : {};
  // Splice csvUpload.dailyCompact into the r object so _restoreState can hydrate r.allDays.
  r.dailyCompact = proj.csvUpload ? proj.csvUpload.dailyCompact : null;
  // Re-attach meter metadata if present in csvUpload (results may also carry it; csv wins).
  if (proj.csvUpload) {
    r.eanCode   = proj.csvUpload.eanCode   || r.eanCode;
    r.meterNr   = proj.csvUpload.meterNr   || r.meterNr;
    r.meterType = proj.csvUpload.meterType || r.meterType;
  }
  return {
    v: 5,
    form: (proj.lastCalcRun && proj.lastCalcRun.inputs) ? {
      pvInv: proj.lastCalcRun.inputs.pvInv,
      priceDay: proj.lastCalcRun.inputs.priceDay,
      priceNight: proj.lastCalcRun.inputs.priceNight,
      selectedConfigTypes: proj.lastCalcRun.inputs.selectedConfigTypes,
    } : {},
    r,
  };
}
```

- [ ] **Step 5: Verify**

Run:
```bash
grep -c 'firebase-app-compat\|firebase-auth-compat\|firebase-firestore-compat' /home/ubuntu/battery-roi-tool/index.html
grep -c 'function loadProjectIntoUI\|function buildSavedFromProject\|function renderProjectStatusChip\|function openProjectStatusPopover' /home/ubuntu/battery-roi-tool/index.html
grep -c 'id="projectBanner"\|id="pbName"\|id="pbCustomer"\|id="pbStatusChip"' /home/ubuntu/battery-roi-tool/index.html
grep -c 'bootstrapProjectMode' /home/ubuntu/battery-roi-tool/index.html
```

Expected:
- 1st: `3`.
- 2nd: `4`.
- 3rd: `4`.
- 4th: `1`.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "index.html: add ?project=<id> mode entry with auth check, project load, banner + status chip"
```

---

### Task 9: `index.html` project-mode CSV-handling (missing-CSV state + upload-within-project)

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — add a "missing CSV" notice + upload button when project has no CSV, and a "replace CSV" button when project has CSV, both writing to Firestore via `setProjectCsv`.

After this task: opening a project without CSV shows a prominent upload prompt; uploading writes the CSV to Firestore + reloads. Opening a project WITH CSV shows a smaller "Andere CSV uploaden" button next to the project banner that confirm-replaces.

- [ ] **Step 1: Add the project-CSV controls inside the banner**

Use Edit. The target anchor is the exact string:
```html
<div id="projectBanner" class="project-banner" style="display:none;">
  <span class="pb-name" id="pbName">…</span>
  <span class="pb-customer">👤 <span id="pbCustomer">…</span></span>
  <span id="pbStatusChip"></span>
  <a class="pb-back" href="dashboard.html">← Terug naar dashboard</a>
</div>
```

Replace with:
```html
<div id="projectBanner" class="project-banner" style="display:none;">
  <span class="pb-name" id="pbName">…</span>
  <span class="pb-customer">👤 <span id="pbCustomer">…</span></span>
  <span id="pbStatusChip"></span>
  <button type="button" class="btn btn-secondary" id="pbCsvBtn" style="font-size:0.85rem;padding:4px 10px;">📁 CSV</button>
  <input type="file" id="pbCsvFile" accept=".csv" style="display:none;" />
  <a class="pb-back" href="dashboard.html">← Terug naar dashboard</a>
</div>

<div id="projectMissingCsv" class="card alert alert-warning" style="display:none;">
  📁 <div>Dit project heeft nog geen CSV. <button type="button" class="btn" id="missingCsvBtn">CSV uploaden</button></div>
</div>
```

- [ ] **Step 2: Add `.btn` / `.btn-secondary` classes to index.html if not already present**

Run:
```bash
grep -c '\.btn\s*{' /home/ubuntu/battery-roi-tool/index.html
```

If result is `≥ 1`, skip — these classes already exist. If `0`, use Edit to add the following before `  </style>`:

```css
    .btn {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 8px;
      border: 0;
      background: var(--primary);
      color: #fff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
    }
    .btn:hover { background: var(--primary-dark); }
    .btn-secondary { background: transparent; color: var(--primary); border: 1px solid var(--primary); }
    .btn-secondary:hover { background: #eef4ff; }
```

- [ ] **Step 3: Wire CSV upload handlers**

Use Edit. The target anchor is the exact string:
```js
  } else if (proj.csvUpload && !proj.lastCalcRun) {
    // CSV present but never calculated — TODO Task 9 will handle the "ready to calc" UI here.
    // For now: leave the form untouched; user clicks Bereken to compute.
  } else {
    // No CSV at all — TODO Task 9 will show the "upload CSV first" state here.
  }
}
```

Replace with:
```js
  } else if (proj.csvUpload && !proj.lastCalcRun) {
    // CSV present but never calculated — load the form values (if any) but don't auto-render results.
    // User clicks Bereken when ready.
  } else {
    // No CSV at all — show the upload prompt.
    document.getElementById('projectMissingCsv').style.display = '';
  }
  wireProjectCsvUpload();
}

function wireProjectCsvUpload() {
  const fileInput = document.getElementById('pbCsvFile');
  const headerBtn = document.getElementById('pbCsvBtn');
  const missingBtn = document.getElementById('missingCsvBtn');

  function triggerFilePicker(replace) {
    fileInput.dataset.replace = replace ? '1' : '0';
    fileInput.value = '';
    fileInput.click();
  }

  headerBtn.addEventListener('click', () => triggerFilePicker(/*replace*/ true));
  if (missingBtn) missingBtn.addEventListener('click', () => triggerFilePicker(/*replace*/ false));

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isReplace = fileInput.dataset.replace === '1' && _projectDoc.csvUpload;
    if (isReplace && !confirm('Vorige CSV en berekening blijven bewaard tot je opnieuw rekent. Doorgaan?')) return;
    try {
      const text = await file.text();
      const csvData = extractCsvForStorage(text);
      await setProjectCsv(_projectId, csvData);
      // Refetch project + re-render
      _projectDoc = await getProject(_projectId);
      document.getElementById('projectMissingCsv').style.display = 'none';
      // Hydrate the saved state with the new CSV but keep the (possibly stale) lastCalcRun.
      if (_projectDoc.lastCalcRun) {
        const restored = buildSavedFromProject(_projectDoc);
        _applyLoadedState(restored, /*showBanner*/ false);
      } else {
        // No prior calc — reset UI to fresh form state.
        // Future: pre-populate eanCode etc. For Phase 1 we simply tell the user to recompute.
        alert('CSV opgeslagen. Vul de form in en klik op Bereken om te rekenen.');
      }
    } catch (err) {
      alert('CSV upload mislukt: ' + (err && err.message ? err.message : err));
    }
  });
}
```

- [ ] **Step 4: Verify**

Run:
```bash
grep -c 'id="pbCsvBtn"\|id="pbCsvFile"\|id="projectMissingCsv"\|id="missingCsvBtn"' /home/ubuntu/battery-roi-tool/index.html
grep -c 'function wireProjectCsvUpload\|setProjectCsv\|extractCsvForStorage' /home/ubuntu/battery-roi-tool/index.html
```

Expected:
- 1st: `4`.
- 2nd: `≥ 3`.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "index.html project-mode: missing-CSV state + upload/replace CSV via Firestore"
```

---

### Task 10: `index.html` project-mode auto-save lastCalcRun

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — at the END of `renderResults`, when in project-mode, write `lastCalcRun` to Firestore. Show a toast on save success / save failure.

After this task: clicking "Bereken ROI" in project-mode (after first or subsequent calculations) writes the inputs + results to Firestore and shows a transient toast confirming save (or error).

- [ ] **Step 1: Find the end of `renderResults`**

Run:
```bash
grep -nE "^function renderResults\(d\)" /home/ubuntu/battery-roi-tool/index.html
```

Note the line number. The function body ends at the matching closing `}` (likely with a comment like `// ── Render the energy chart ───────...` followed by the chart call). The last meaningful line currently looks like:

```js
  // ── Render the energy chart ───────────────────────────────────────────────
  renderEnergyChart(d);
}
```

We need to inject a project-save call right before that closing `}`.

- [ ] **Step 2: Inject auto-save at end of `renderResults`**

Use Edit. The target anchor is the exact string:
```js
  // ── Render the energy chart ───────────────────────────────────────────────
  renderEnergyChart(d);
}
```

Replace with:
```js
  // ── Render the energy chart ───────────────────────────────────────────────
  renderEnergyChart(d);

  // ── Auto-save to Firestore if we're in project-mode ───────────────────────
  if (_projectId && _projectDoc) {
    saveProjectCalcRun(d).catch(err => {
      console.error('Auto-save failed:', err);
      showToast('⚠️ Niet opgeslagen — controleer netwerk');
    });
  }
}

async function saveProjectCalcRun(d) {
  // Build the inputs object from the form (avoid pulling them off d directly — d is the full
  // computed object, inputs are a smaller subset that drives the calc).
  const pvInverter = parseFloat(document.getElementById('pvInverter').value) || 0;
  const priceDay   = parseFloat(document.getElementById('elecPrice').value)  || 0;
  const priceNightRaw = document.getElementById('elecPriceNight').value;
  const priceNight = (priceNightRaw && priceNightRaw.trim() !== '') ? parseFloat(priceNightRaw) : null;
  const selectedConfigTypes = (d.configResults || []).map(cr => cr.cfg && cr.cfg.type).filter(Boolean);

  // Build results: same as _serializeState's `r` block, but strip dailyCompact since it lives
  // separately in csvUpload (otherwise we'd duplicate the per-day arrays in Firestore).
  const r = _serializeState();
  if (!r) throw new Error('Geen berekening om op te slaan.');
  const results = { ...r.r };
  delete results.dailyCompact;

  await saveLastCalcRun(_projectId, {
    inputs: { pvInv: pvInverter, priceDay, priceNight, selectedConfigTypes },
    results,
  });
  showToast('💾 Opgeslagen in project');
}
```

- [ ] **Step 3: Verify**

Run:
```bash
grep -c 'saveProjectCalcRun\|saveLastCalcRun' /home/ubuntu/battery-roi-tool/index.html
grep -nE 'if \(_projectId && _projectDoc\)' /home/ubuntu/battery-roi-tool/index.html
```

Expected:
- 1st: `≥ 2`.
- 2nd: 1 line (the auto-save trigger).

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "index.html project-mode: auto-save lastCalcRun on every Bereken"
```

---

### Task 11: CLAUDE.md update + final structural verification

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/CLAUDE.md` — describe the new architecture (dashboard.html, project-mode, shared js layout, Firebase compat builds).

After this task: project docs reflect the new Firebase-backed multi-user flow.

- [ ] **Step 1: Update CLAUDE.md "What this repo actually is" + "File layout" + "Architecture" sections**

Use Edit. The target anchor is the exact string:
```
- **`index.html`** (~1560 lines) — the entire app: embedded CSS in `<style>`, the form/results markup, and all JS in a single `<script>` block at the bottom. Edit this file for any feature work.
```

Replace with:
```
- **`index.html`** — the calculator. Three modes:
  - bare (no query) — public, no login, calculator works as it always did
  - `?data=<b64>` — legacy share-link, public, no login (v:1-5 supported)
  - `?project=<id>` — Firebase-backed project mode: auth-gated (Kevin/Ruben whitelist), loads project from Firestore, shows project-banner with status chip, auto-saves `lastCalcRun` on every Bereken
- **`dashboard.html`** — login-gated landing for Kevin & Ruben. Lists all (non-deleted) projects sorted by `updatedAt` desc, status chips per row (clickable to change), `+ Nieuw project` form with optional CSV at creation, soft delete + restore.
- **`assets/js/csv.js`** — CSV parsing helpers (`parseCSV`, `parseDate`, `parsVolume`, `extractCsvForStorage`) used by both `index.html` and `dashboard.html`.
- **`assets/js/firebase-init.js`** — Firebase init (compat SDK 10.13.2 via CDN, no build step), auth helpers (Google sign-in + email whitelist), Firestore CRUD (`projects` collection), `PROJECT_STATUSES` enum + `getStatusMeta()`. Contains `FIREBASE_CONFIG_PLACEHOLDER` and `RUBEN_EMAIL_PLACEHOLDER` sentinels — must be replaced with real values before deploy. Config object is public-by-design (security rules enforce access).
```

- [ ] **Step 2: Update CLAUDE.md "Save / share state" paragraph**

Use Edit. The target anchor is the exact string:
```
**Save / share state** — `_serializeState` produces a versioned (`v: 5`) JSON of inputs + computed results
```

Replace with (extending the existing paragraph rather than replacing it):
```
**Save / share state** — same v:5 mechanism powers BOTH the legacy `?data=<b64>` share-links AND the Firestore project-mode storage. In project-mode, `csvUpload.dailyCompact` lives at the top level of the project doc (not inside `results`) to avoid duplicating per-day arrays. The restore-path in `index.html` (`buildSavedFromProject`) reassembles a v:5-shaped object from the project document so the existing `_applyLoadedState` flow can hydrate the UI unchanged. `_serializeState` produces a versioned (`v: 5`) JSON of inputs + computed results
```

- [ ] **Step 3: Final structural verification**

Run:
```bash
ls /home/ubuntu/battery-roi-tool/dashboard.html /home/ubuntu/battery-roi-tool/assets/js/csv.js /home/ubuntu/battery-roi-tool/assets/js/firebase-init.js
grep -c 'firebase-app-compat\|firebase-firestore-compat' /home/ubuntu/battery-roi-tool/dashboard.html
grep -c 'firebase-app-compat\|firebase-firestore-compat' /home/ubuntu/battery-roi-tool/index.html
grep -c 'FIREBASE_CONFIG_PLACEHOLDER\|RUBEN_EMAIL_PLACEHOLDER' /home/ubuntu/battery-roi-tool/assets/js/firebase-init.js
grep -cE '^function (createProject|listActiveProjects|listDeletedProjects|getProject|updateProjectStatus|softDeleteProject|restoreProject|setProjectCsv|saveLastCalcRun)' /home/ubuntu/battery-roi-tool/assets/js/firebase-init.js
grep -c 'dashboard.html' /home/ubuntu/battery-roi-tool/CLAUDE.md
```

Expected:
- 1st: all three files exist.
- 2nd: ≥ 2 (compat scripts in dashboard.html).
- 3rd: ≥ 2 (compat scripts in index.html).
- 4th: 2 (placeholders still present until Kevin replaces — by design).
- 5th: 9 (all CRUD helpers defined).
- 6th: ≥ 1 (CLAUDE.md mentions dashboard).

- [ ] **Step 4: HTTP sanity check**

```bash
cd /home/ubuntu/battery-roi-tool && python3 -m http.server 8000 >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
curl -sI http://localhost:8000/dashboard.html | head -1
curl -sI http://localhost:8000/index.html | head -1
curl -sI http://localhost:8000/assets/js/firebase-init.js | head -1
curl -sI http://localhost:8000/assets/js/csv.js | head -1
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```

All four expected: `HTTP/1.0 200 OK`.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add CLAUDE.md
git commit -m "Update CLAUDE.md: dashboard + project-mode + Firebase architecture"
```

- [ ] **Step 6: Self-review**

```bash
cd /home/ubuntu/battery-roi-tool
git log --oneline -15
git status
```

Confirm:
- 10 new commits on top, one per implementation task (Task 1 was Kevin's manual setup, no commit).
- `git status` shows a clean working tree (plus untracked plan files).
- `firebase-init.js` still contains the two `*_PLACEHOLDER` sentinels — that's correct; Kevin replaces them in a separate commit before deploy.

## Report format

- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- List of commit SHAs (10 commits — Tasks 2-11).
- Output of all greps from Task 11 Step 3.
- HTTP statuses from Task 11 Step 4.
- Confirmation that `FIREBASE_CONFIG_PLACEHOLDER` and `RUBEN_EMAIL_PLACEHOLDER` are intentionally still present (Kevin's responsibility).
- Anything unexpected.

---

## Self-review (controller, before handing off)

**Spec coverage:**
- Spec § Storage choice → mentioned across plan as Firebase compat builds (Tasks 3, 4, 8).
- Spec § File structure → Task 2 (csv.js), Task 3 (firebase-init.js), Task 4 (dashboard.html), Task 8-10 (index.html project-mode), Task 11 (CLAUDE.md).
- Spec § Auth → Task 3 (helpers), Task 4 (UI states), Task 8 (project-mode auth gate + redirect).
- Spec § Data model → Task 3 (`createProject`, `setProjectCsv`, `saveLastCalcRun` mirror the spec's doc shape).
- Spec § Status enum (16 values) → Task 3 (`PROJECT_STATUSES` const), Task 6 (dropdown in form), Task 7 (chip popover), Task 8 (banner chip popover).
- Spec § Security rules → Task 1 (Kevin pastes them in Firebase Console).
- Spec § UI dashboard 3 states → Task 4.
- Spec § Project list with chips + soft delete + restore → Tasks 5 + 7.
- Spec § New-project form (optional CSV) → Task 6.
- Spec § Project-mode banner + auth + load → Task 8.
- Spec § CSV upload within project → Task 9.
- Spec § Auto-save lastCalcRun → Task 10.
- Spec § Code-deling → Tasks 2 + 3.
- Spec § Firebase Console setup checklist → Task 1.
- Spec § Edge cases → covered across Tasks 8 (missing/deleted project → redirect), 9 (missing CSV state, replace CSV confirm), 10 (auto-save failure toast). Concurrent edits + token expiry are documented in spec but not specially handled in Phase 1 (last-write-wins is acceptable).
- Spec § Verification → Task 11 + per-task grep verifications.

**Placeholder scan:** every step has actual code or actual commands. The `FIREBASE_CONFIG_PLACEHOLDER` and `RUBEN_EMAIL_PLACEHOLDER` sentinels in `firebase-init.js` are INTENTIONAL — Kevin substitutes them in Task 1 (handoff). They are explicitly flagged in the file header comment, in Task 3 Step 1, in Task 4 Step 3, and in Task 11 Step 3 verification.

**Type/name consistency:**
- Project doc shape: every helper that writes to Firestore (`createProject`, `setProjectCsv`, `saveLastCalcRun`, `softDeleteProject`, `restoreProject`, `updateProjectStatus`) uses the same field names as `getProject` returns and as `buildSavedFromProject` reads (`projectName`, `customerName`, `status`, `createdBy`, `createdAt`, `updatedAt`, `deletedAt`, `csvUpload`, `lastCalcRun`).
- `csvUpload.dailyCompact` shape matches `extractCsvForStorage`'s output (`startDate`, `afname`, `injectie`, `afnamedag`, `afnamenacht`, `injectiedag`, `injectienacht`).
- `lastCalcRun.results` is built by stripping `dailyCompact` from `_serializeState`'s `r` (Task 10) and re-attached by `buildSavedFromProject` (Task 8) before passing through `_applyLoadedState` — symmetric round-trip.
- `PROJECT_STATUSES` enum + `DEFAULT_STATUS` defined once in `firebase-init.js`, used by all consumers (form dropdown in Task 6, chip popovers in Tasks 7 & 8). `getStatusMeta(key)` is the single accessor for label + color.
- DOM IDs: `pbName`, `pbCustomer`, `pbStatusChip`, `pbCsvBtn`, `pbCsvFile`, `projectMissingCsv`, `missingCsvBtn`, `pbChip` — defined in HTML (Tasks 8 + 9) and referenced in JS consistently.
- `_projectId` and `_projectDoc` are module-globals introduced in Task 8 and consumed in Tasks 9 + 10. Reset implicitly by page load (no need for explicit reset since project-mode is per-page-navigation).
