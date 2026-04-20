# Access Model & Read-Only Share-Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict `index.html` bare mode via redirect to dashboard, move the product-sheet URL into Firestore (auth-required read), and engage a read-only mode when loading from a `?data=<b64>` share-link — so customers who receive a link see results but cannot recalculate.

**Architecture:** No build step. Three coordinated changes in three files: (1) a top-of-body inline redirect in `index.html` catching bare loads before any content renders, (2) a new `getProductsConfig()` helper in `firebase-init.js` that reads `config/products` Firestore doc, used by the existing `loadConfigs()` flow, (3) a `body.readonly-mode` CSS class + `engageReadOnly()` JS trigger that kicks in after `?data=<b64>` state restore.

**Tech Stack:** Plain HTML/CSS/JS, Firebase compat SDK 10.13.2, Firestore.

**Spec:** `docs/superpowers/specs/2026-04-20-access-model-and-readonly-design.md` — read before starting.

---

## File map

- **MODIFY:** `assets/js/firebase-init.js` — add `getProductsConfig()` helper.
- **MODIFY:** `index.html` — add top-of-body bare-redirect script; remove `SHEET_CSV_URL` constant and wire `loadConfigs()` through `getProductsConfig()`; add CSS classes to four existing buttons for CSS targeting; add `body.readonly-mode` CSS block; add `engageReadOnly()` function + call from the `?data=` restore path.
- **MODIFY:** `CLAUDE.md` — document the new access tier (bare-redirect, Firestore `config/products`, read-only `?data=` mode).
- **MANUAL (Kevin, Firebase Console):** create `config/products` doc with `csvUrl` field + add Firestore rule for `config/{doc}` — documented in Task 8.

## Working directory

`/home/ubuntu/battery-roi-tool`. Work directly on `gh-pages`. One commit per task. User pushes at the end (or asks agent to push).

## Notes for the implementer

- UI text is in Dutch (`nl-BE`).
- No test suite exists. Verification = `grep`/Read checks + final browser smoke.
- Bare-mode redirect must fire **before any other script runs**. Inline `<script>` immediately after `<body>` tag, not inside `DOMContentLoaded`.
- The read-only mode is purely visual (CSS disables interaction); no `disabled` HTML attribute is set on inputs because the restored values must remain serializable.
- Firestore rules are edited manually by Kevin in the Firebase Console (Task 8). No code change in this repo for rules.
- Don't push (`git push`) from code-tasks; the last task (Task 9) pushes everything at once.

---

### Task 1: Add `getProductsConfig()` helper

**Files:**
- Modify: `assets/js/firebase-init.js` (add ~7 lines, after the existing `updateProjectMetadata()` function)

- [ ] **Step 1: Add the helper**

In `assets/js/firebase-init.js`, add this function at the end of the file (after the last function, before EOF):

```js
// ─── PRODUCT-SHEET CONFIG ────────────────────────────────────────────────────
// Reads the Firestore doc that holds the product sheet CSV URL. Requires the
// user to be authenticated + whitelisted (enforced by Firestore rules).
async function getProductsConfig() {
  const snap = await getDb().collection('config').doc('products').get();
  if (!snap.exists) {
    throw new Error('Product-configuratie niet gevonden in Firestore (config/products).');
  }
  return snap.data();
}
```

- [ ] **Step 2: Verify**

```bash
grep -n 'getProductsConfig' assets/js/firebase-init.js
```

Expected: ≥2 matches (definition + comment/reference).

- [ ] **Step 3: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "firebase-init: add getProductsConfig() helper reading config/products doc"
```

---

### Task 2: Bare-mode redirect script

**Files:**
- Modify: `index.html` (insert ~8 lines right after `<body>`)

- [ ] **Step 1: Add the redirect script**

In `index.html`, find the `<body>` tag (single line near the top of the HTML body section). Insert this `<script>` immediately after it:

```html
<body>
<script>
// Access gate: bare index.html (no ?project= and no ?data=) is not a public
// entry point. Redirect to dashboard so random visitors hit the login wall.
(function () {
  var p = new URLSearchParams(window.location.search);
  if (!p.has('project') && !p.has('data')) {
    window.location.replace('dashboard.html');
  }
})();
</script>
```

Use `location.replace()` (not `location.href =`) so the redirect doesn't leave a history entry the user can "back" into.

- [ ] **Step 2: Verify**

```bash
grep -n 'window.location.replace..dashboard.html' index.html
```

Expected: 1 match.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "index: redirect bare mode to dashboard.html"
```

---

### Task 3: Remove `SHEET_CSV_URL`, route `loadConfigs()` through Firestore

**Files:**
- Modify: `index.html` (replace `SHEET_CSV_URL` constant block + `loadConfigs()` body)

- [ ] **Step 1: Remove the hardcoded URL constant**

In `index.html`, find the line `const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/...'` (around line 1199). Replace the constant definition with a comment pointer:

Find:
```js
// ─── PRODUCT SHEET CONFIG ─────────────────────────────────────────────────────
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1BYNvK5nPm--nJWuim2rssC6W-ZcGHIfKLsifa4OSgTY/export?format=csv&gid=425908603';
let _sheetConfigs = null;
```

Replace with:
```js
// ─── PRODUCT SHEET CONFIG ─────────────────────────────────────────────────────
// CSV URL lives in Firestore `config/products` doc (auth-gated read).
// Fetched via getProductsConfig() in loadConfigs().
let _sheetConfigs = null;
```

- [ ] **Step 2: Update `loadConfigs()` to fetch the URL first**

Find the existing `loadConfigs()` function (around line 1258) and replace its body. The new version:

```js
async function loadConfigs() {
  const statusEl = document.getElementById('configsStatus');
  statusEl.innerHTML = '<span class="spinner"></span> Laden...';
  try {
    const cfg = await getProductsConfig();
    if (!cfg || !cfg.csvUrl) throw new Error('config/products.csvUrl ontbreekt.');
    const resp = await fetch(cfg.csvUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    _sheetConfigs = _parseSheetConfigs(await resp.text());
    if (!_sheetConfigs.length) throw new Error('Geen configuraties gevonden in de sheet.');
    _populateConfigSelects();
    document.getElementById('configSelectorsArea').style.display = '';
    statusEl.textContent = `✅ ${_sheetConfigs.length} configuraties geladen.`;
  } catch(e) {
    statusEl.textContent = '❌ Laden mislukt: ' + (e && e.message ? e.message : e);
  }
}
```

The only real change versus the original is the insertion of `const cfg = await getProductsConfig();` + use of `cfg.csvUrl` in `fetch()`. The existing catch-all handles the new auth-failure error the same way as HTTP errors.

- [ ] **Step 3: Verify no stale references to `SHEET_CSV_URL` remain**

```bash
grep -n 'SHEET_CSV_URL' index.html
```

Expected: 0 matches.

```bash
grep -n 'getProductsConfig' index.html
```

Expected: 1 match (the call inside `loadConfigs`).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "index: load sheet URL from Firestore config/products (auth-gated)"
```

---

### Task 4: Tag four buttons with stable CSS classes

**Files:**
- Modify: `index.html` (four single-element edits)

The read-only CSS in Task 6 selects buttons by class. These classes don't exist yet — add them to the existing elements without otherwise touching their behavior.

- [ ] **Step 1: Add `btn-load-configs` to the "Configuraties laden" button**

Find (around line 646):
```html
<button class="btn btn-secondary" style="margin-top:0;" onclick="loadConfigs()">🔄 Configuraties laden</button>
```

Change to:
```html
<button class="btn btn-secondary btn-load-configs" style="margin-top:0;" onclick="loadConfigs()">🔄 Configuraties laden</button>
```

- [ ] **Step 2: Add `btn-calculate` to the Bereken button**

Find (around line 668):
```html
<button class="btn" onclick="calculate()">
    <span>⚡</span> Bereken ROI
  </button>
```

Change to:
```html
<button class="btn btn-calculate" onclick="calculate()">
    <span>⚡</span> Bereken ROI
  </button>
```

- [ ] **Step 3: Add `btn-loadsave` to the JSON-load label**

Find (around line 671-674):
```html
<label class="btn btn-secondary" style="cursor:pointer; margin-top:0; display:inline-flex; align-items:center; gap:8px;">
    <span>📂</span> Laden vanuit opgeslagen berekening
    <input type="file" id="loadSaveFileTop" accept=".json" onchange="loadFromJSONFile(event)" style="display:none">
  </label>
```

Change to:
```html
<label class="btn btn-secondary btn-loadsave" style="cursor:pointer; margin-top:0; display:inline-flex; align-items:center; gap:8px;">
    <span>📂</span> Laden vanuit opgeslagen berekening
    <input type="file" id="loadSaveFileTop" accept=".json" onchange="loadFromJSONFile(event)" style="display:none">
  </label>
```

- [ ] **Step 4: Add `btn-copyshare` to the "Kopieer deellink" button**

Find (around line 732):
```html
<button class="btn btn-secondary" onclick="copyShareLink()">🔗 Kopieer deellink</button>
```

Change to:
```html
<button class="btn btn-secondary btn-copyshare" onclick="copyShareLink()">🔗 Kopieer deellink</button>
```

- [ ] **Step 5: Verify**

```bash
grep -cE 'btn-load-configs|btn-calculate|btn-loadsave|btn-copyshare' index.html
```

Expected: 4.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "index: tag 4 existing buttons with stable classes for readonly-mode CSS"
```

---

### Task 5: Add read-only CSS

**Files:**
- Modify: `index.html` (insert CSS block inside the existing `<style>` tag)

- [ ] **Step 1: Insert the CSS block**

In `index.html`, find the existing `@media (max-width: 1020px)` media query block (around line 308-310):

```css
    @media (max-width: 1020px) {
      .scenarios-grid { grid-template-columns: 1fr; }
    }
```

Immediately after its closing `}`, insert:

```css
    /* ─── READ-ONLY MODE (for ?data=<b64> share-link viewers) ─────────────── */
    body.readonly-mode #csvUploadCard,
    body.readonly-mode .btn-calculate,
    body.readonly-mode .btn-loadsave,
    body.readonly-mode .btn-load-configs,
    body.readonly-mode .btn-copyshare,
    body.readonly-mode #shareUrlRow {
      display: none !important;
    }
    body.readonly-mode input,
    body.readonly-mode select,
    body.readonly-mode textarea {
      pointer-events: none;
      background: #f0f2f7;
      color: #6b7589;
      border-color: #d4dae5;
    }
```

- [ ] **Step 2: Verify**

```bash
grep -nE 'body\.readonly-mode' index.html
```

Expected: ≥7 matches (one per selector + the comment header).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "index: add CSS for body.readonly-mode — disabled inputs, hidden action buttons"
```

---

### Task 6: Engage read-only after `?data=` restore

**Files:**
- Modify: `index.html` (add `engageReadOnly()` function + one-line call in the `?data=` handler)

- [ ] **Step 1: Add `engageReadOnly()` function**

In `index.html`, find the auto-load block (around line 2122-2128):

```js
  // Auto-load from URL ?data= param
  const params = new URLSearchParams(window.location.search);
  const data   = params.get('data');
  if (data) {
    try { _applyLoadedState(_b64ToState(data), true); }
    catch(e) { console.error('Kon opgeslagen staat niet laden vanuit URL:', e); }
  }
});
```

Replace with:

```js
  // Auto-load from URL ?data= param
  const params = new URLSearchParams(window.location.search);
  const data   = params.get('data');
  if (data) {
    try {
      _applyLoadedState(_b64ToState(data), true);
      engageReadOnly();
    } catch(e) { console.error('Kon opgeslagen staat niet laden vanuit URL:', e); }
  }
});

// Engage read-only mode: called after a ?data=<b64> share-link has been
// successfully restored. Adds the body class that drives the CSS, and
// replaces the loaded-banner content with a clear customer-facing message.
function engageReadOnly() {
  document.body.classList.add('readonly-mode');
  const banner = document.getElementById('loadedBanner');
  if (banner) {
    banner.innerHTML = `
      <div class="alert alert-warning" style="display:flex;gap:10px;align-items:flex-start;">
        🔒
        <div>
          <strong>Gedeelde berekening — alleen-lezen.</strong><br>
          Dit is een voorstel dat je van je contactpersoon ontving.
          Heb je vragen of wil je aanpassingen? Neem contact op met je contactpersoon.
        </div>
      </div>`;
    banner.style.display = '';
  }
}
```

- [ ] **Step 2: Verify**

```bash
grep -nE 'engageReadOnly|readonly-mode' index.html
```

Expected: ≥4 matches (CSS selectors from Task 5 + function def + call + classList.add).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "index: engage read-only mode after ?data=<b64> restore"
```

---

### Task 7: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (extend the File layout + Architecture sections)

- [ ] **Step 1: Update the `index.html` bullet in "File layout"**

In `CLAUDE.md`, find the `index.html` bullet in the "File layout" section (around line 13-16) and replace it with:

```md
- **`index.html`** — the calculator. Three modes:
  - bare (no query) — **redirects to `dashboard.html` immediately** (access-gated via inline script at top of `<body>`); not a public entry point
  - `?data=<b64>` — legacy share-link, public, no login required, **loads in read-only mode** (v:1-5 supported): form inputs disabled, Bereken + share-action buttons hidden, banner "Gedeelde berekening — alleen-lezen"
  - `?project=<id>` — Firebase-backed project mode: auth-gated (Kevin/Ruben whitelist), loads project from Firestore, shows project-banner with status chip, auto-saves `lastCalcRun` on every Bereken
```

- [ ] **Step 2: Add a new Architecture sub-section documenting the access model**

In `CLAUDE.md`, find the "Architecture (the parts that span multiple sections)" heading. After the "Index.html project-mode source-of-truth" block, add (or if that block isn't present yet from an earlier merge, add at the end of Architecture):

```md
**Access model (2026-04-20)** — Drie access-tiers:
1. **Bare `index.html`** is geen publieke entry. Top-of-body inline redirect naar `dashboard.html`. Kevin/Ruben komen altijd via dashboard of project-link binnen.
2. **Product-sheet URL** leeft in Firestore `config/products.csvUrl` (niet meer hardcoded). Security rule: `allow read: if isWhitelisted()`, `allow write: if false`. `getProductsConfig()` in `firebase-init.js` haalt het op; `loadConfigs()` gebruikt dat in plaats van een constante. Zonder login → `loadConfigs` faalt → geen berekening mogelijk zelfs als je de redirect omzeilt.
3. **`?data=<b64>` share-links** zijn klant-facing en activeren `body.readonly-mode` via `engageReadOnly()` na `_applyLoadedState`. CSS hide't Bereken, "Laden vanuit opgeslagen", "Configuraties laden", "Kopieer deellink" en de share-URL row; inputs worden grijs met `pointer-events:none`. Resultaten blijven volledig leesbaar. "Download JSON" blijft beschikbaar (klant mag snapshot bewaren).
```

- [ ] **Step 3: Verify**

```bash
grep -cE 'redirects to .dashboard\.html.|readonly-mode|config/products' CLAUDE.md
```

Expected: ≥3.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md: document access model + readonly mode + Firestore products config"
```

---

### Task 8: Firebase Console setup (manual — Kevin)

This task is performed by Kevin in the Firebase Console (no code, no commit). All prior code assumes this is done; the site won't show product configurations until it is.

- [ ] **Step 1: Create the `config/products` document**

Firebase Console → **Firestore Database** → Data tab → at the root level, click **"Start collection"** → Collection ID: `config` → Next → Document ID: `products` → add a field:
- Field: `csvUrl`
- Type: string
- Value: `https://docs.google.com/spreadsheets/d/1BYNvK5nPm--nJWuim2rssC6W-ZcGHIfKLsifa4OSgTY/export?format=csv&gid=425908603`

Save.

- [ ] **Step 2: Update Firestore rules**

Firebase Console → Firestore Database → **Rules** tab → inside the existing `match /databases/{database}/documents { ... }` block, add a new match block next to the existing `match /projects/{id}` block:

```
match /config/{doc} {
  allow read: if isWhitelisted();
  allow write: if false;
}
```

The `isWhitelisted()` function is already defined in the rules from Phase 1. Click **Publish**.

- [ ] **Step 3: Smoke test**

After Task 9 pushes the code:
1. Open `https://smartpeak-be.github.io/battery-roi-tool/` in a **private/incognito window** → should redirect you to `dashboard.html` and show the login screen.
2. Log in as `kevin@bloxit.be` → open any existing project → click "🔄 Configuraties laden" → should succeed ("✅ N configuraties geladen.").
3. Log out. Open a known-working share-link (generate one first from an authed session via "🔗 Kopieer deellink"). The link should open in read-only mode: banner "Gedeelde berekening — alleen-lezen", inputs grijs, geen Bereken-knop, resultaten wel zichtbaar.

---

### Task 9: Push everything to `gh-pages`

**Files:** none (pushes existing commits)

- [ ] **Step 1: Verify working tree is clean**

```bash
cd /home/ubuntu/battery-roi-tool && git status
```

Expected: `nothing to commit, working tree clean` and branch `gh-pages` ahead of `origin/gh-pages` by 7 commits.

- [ ] **Step 2: Show the commit log to confirm**

```bash
git log --oneline origin/gh-pages..HEAD
```

Expected: 7 commits from Tasks 1-7, plus the spec commit from before this plan started.

- [ ] **Step 3: Push**

```bash
git push origin gh-pages
```

Expected: push succeeds, GitHub Pages CDN refreshes ~1 minute later.

- [ ] **Step 4: Kevin performs Task 8 (Firestore setup)**

See Task 8. Only after Task 8 is complete is the deploy fully operational — otherwise logged-in users will see "Product-configuratie niet gevonden" when they click "Configuraties laden."

---

## Spec / scope coverage check

- ✅ Bare redirect → Task 2.
- ✅ Sheet URL naar Firestore + helper + loadConfigs integratie → Tasks 1 + 3.
- ✅ Firestore rules + doc creation → Task 8 (manual).
- ✅ Read-only CSS + engagement → Tasks 5 + 6.
- ✅ Button-tagging voor CSS targeting → Task 4.
- ✅ CLAUDE.md update → Task 7.
- ✅ Push → Task 9.
- ✅ Non-goal: geen whitelist-in-Firestore, geen unlock-knop, geen retro-migration. None needed.
