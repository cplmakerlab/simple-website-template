# Project-edit UX vereenvoudiging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduceer `project-edit.html` van 11 accordion-secties naar 4 samenhangende blokken met essentials-first layout, responsive grid, sticky action bar en verbeterde foto-/serienummer-flow.

**Architecture:** Statische vanilla HTML/CSS/JS pages met Bootstrap 5.3.3 en Firebase compat SDK 10.13.2 via CDN. Geen build step, geen tests. Verificatie is manueel via `python3 -m http.server 8080` en browser-interactie. Committen naar `gh-pages` deploy't naar productie — test altijd lokaal vóór commit.

**Tech Stack:** Bootstrap 5.3.3, Font Awesome 6.5.2, Firebase compat SDK 10.13.2 (Auth + Firestore + Storage), vanilla JavaScript.

**Design Spec:** `docs/superpowers/specs/2026-04-22-project-edit-ux-vereenvoudiging-design.md`

---

## Task 1: `getProjectLabel()` helper + swap call-sites

**Doel:** Klantnaam wordt fallback voor projectnaam overal waar het project als label wordt getoond. Onafhankelijk van de layout-rework — kan apart geshipt worden.

**Files:**
- Modify: `assets/js/firebase-init.js` (nieuwe helper na `getStatusMeta`)
- Modify: `dashboard.html:279, 293, 448, 827`
- Modify: `index.html:2434`
- Modify: `project-edit.html:194`

- [ ] **Step 1.1: Voeg `getProjectLabel` toe aan `firebase-init.js`**

Plaats direct na `getStatusMeta` (rond regel 161):

```js
// Label helper: projectName heeft voorrang, anders customerName, anders placeholder.
// Gebruikt op dashboard (lijst/bord/drawer), index.html project-banner, en project-edit page title.
function getProjectLabel(project) {
  const pn = (project && project.projectName || '').trim();
  if (pn) return pn;
  const cn = (project && project.customerName || '').trim();
  if (cn) return cn;
  return '(zonder naam)';
}
```

- [ ] **Step 1.2: Pas `dashboard.html` aan op 4 call-sites**

In `dashboard.html:279` (permdel data-name attribute):
```html
data-name="${escapeHtml(getProjectLabel(p))}"
```
(was: `data-name="${escapeHtml(p.projectName || '')}"`)

In `dashboard.html:293` (lijst-rij knop):
```html
<button type="button" class="btn btn-link p-0 text-decoration-none fw-semibold projectNameBtn" data-id="${p.id}">${escapeHtml(getProjectLabel(p))}</button>
```

In `dashboard.html:448` (kanban-card title):
```html
<div class="kanban-card-title" data-id="${p.id}">${chat}${warn}${warnOfferte}${escapeHtml(getProjectLabel(p))}</div>
```

In `dashboard.html:827` (drawer header):
```html
<h5 class="offcanvas-title mb-0" id="drawerHeaderTitle">${escapeHtml(getProjectLabel(project))}</h5>
```

- [ ] **Step 1.3: Pas `index.html:2434` aan**

```js
document.getElementById('pbName').textContent = getProjectLabel(proj);
```
(was: `document.getElementById('pbName').textContent = proj.projectName || '(zonder naam)';`)

- [ ] **Step 1.4: Pas `project-edit.html:194` aan**

```js
document.getElementById('pageTitle').innerHTML = '<i class="fa-solid fa-pen-to-square text-primary" aria-hidden="true"></i> ' + escapeHtml(getProjectLabel(proj));
```

- [ ] **Step 1.5: Browser-verificatie**

Start lokaal: `python3 -m http.server 8080` (vanaf repo root).

Scenario A — bestaand project met beide namen:
1. Open `http://localhost:8080/dashboard.html`, log in.
2. Expect: bestaande projecten tonen hun `projectName` ongewijzigd.

Scenario B — bestaand project met enkel klantnaam:
1. Open een willekeurig project in Firebase Console, verwijder tijdelijk het `projectName` veld (of zet naar lege string).
2. Herlaad dashboard. Expect: die rij toont nu de `customerName` in plaats van leeg.
3. Zet `projectName` terug.

- [ ] **Step 1.6: Commit**

```bash
git add assets/js/firebase-init.js dashboard.html index.html project-edit.html
git commit -m "feat(label): add getProjectLabel() helper, fallback to customerName"
```

---

## Task 2: Maak `projectName` optioneel in validatie

**Doel:** Verwijder de hard-required check op `projectName`; behoud `customerName` als enige verplichte tekst-input.

**Files:**
- Modify: `project-edit.html:1067-1071` (collectFromForm validation)
- Modify: `project-edit.html:273` (label tekst)

- [ ] **Step 2.1: Inspecteer huidige validatie**

Lees `project-edit.html:1060-1080` om de exacte context van de validatie-regel te zien. Verwacht iets als:
```js
const projectName  = (_project.projectName  || '').trim();
const customerName = ...
const errors = {};
if (!projectName)  errors.fProjectName  = { msg: 'Projectnaam is verplicht.' };
if (!customerName) errors.fCustomerName = { msg: 'Klantnaam is verplicht.' };
```

- [ ] **Step 2.2: Verwijder de `projectName`-required check**

Verwijder in `project-edit.html:1071` de regel:
```js
if (!projectName)  errors.fProjectName  = { msg: 'Projectnaam is verplicht.' };
```

Niets anders raken; `projectName` blijft in de returned payload staan (mag lege string zijn).

- [ ] **Step 2.3: Pas label in de UI aan**

Op `project-edit.html:273`, vervang de `<input type="text" id="fProjectName"...>` regel en zijn voorafgaande label. Zoek het blok:
```html
<label for="fProjectName" class="form-label">Projectnaam <span class="text-danger">*</span></label>
<input type="text" id="fProjectName" class="form-control" maxlength="120" value="${escapeHtml(p.projectName)}" />
```

Vervang door:
```html
<label for="fProjectName" class="form-label">Projectnaam <span class="text-muted small fw-normal">(optioneel)</span></label>
<input type="text" id="fProjectName" class="form-control" maxlength="120" placeholder="Leeg = klantnaam wordt gebruikt" value="${escapeHtml(p.projectName)}" />
```

- [ ] **Step 2.4: Browser-verificatie**

1. `http://localhost:8080/project-edit.html?new=1`
2. Vul enkel "Klantnaam" in (bijv. "Test-klant-A").
3. Klik "Opslaan".
4. Expect: geen rode foutmelding onder Projectnaam; opslag slaagt; redirect naar dashboard; project verschijnt in de lijst met label "Test-klant-A".

- [ ] **Step 2.5: Commit**

```bash
git add project-edit.html
git commit -m "feat(project-edit): make projectName optional, customerName is primary"
```

---

## Task 3: Serial-numbers datamodel + Firebase-helpers

**Doel:** Extend het project-document met `serialNumbers: Array<{id, value, photoStoragePath?, uploadedAt?, uploadedBy?}>` en expose CRUD + photo-upload helpers.

**Files:**
- Modify: `assets/js/firebase-init.js` (extend `newEmptyProjectMetadata`, `mergeProjectMetadata`; add helpers)

- [ ] **Step 3.1: Extend `newEmptyProjectMetadata()`**

In `assets/js/firebase-init.js:78-118`, voeg **binnen het `return {...}` object** toe, net voor de sluitende `}`:
```js
    serialNumbers: [],
```

Geplaatst na `calcDefaults: {...},` zodat het een top-level section van de metadata is.

- [ ] **Step 3.2: Extend `mergeProjectMetadata()`**

In `assets/js/firebase-init.js:122-140`, voeg een defaulting-regel toe net vóór `return merged;`:
```js
  merged.serialNumbers = Array.isArray(project.serialNumbers) ? project.serialNumbers : [];
```

- [ ] **Step 3.3: Voeg CRUD-helpers toe**

Plaats onder de `deleteProjectOfferte` functie (rond regel 620, einde van offerte-blok) de volgende helpers:

```js
// ─── SERIAL NUMBERS (batterij/omvormer tracking) ─────────────────────────────
//
// project.serialNumbers is a top-level array of entries:
//   { id, value, photoStoragePath, photoDownloadUrl (runtime only), uploadedAt, uploadedBy }
// photoStoragePath/uploadedAt/uploadedBy are null if no photo attached.

function _genSerialId() {
  return 'sn_' + Math.random().toString(36).slice(2, 10);
}

async function addProjectSerial(projectId, value) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  const entry = {
    id:               _genSerialId(),
    value:            (value || '').trim(),
    photoStoragePath: null,
    uploadedAt:       null,
    uploadedBy:       null,
  };
  await projectDoc(projectId).update({
    serialNumbers: firebase.firestore.FieldValue.arrayUnion(entry),
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  });
  return entry;
}

async function updateProjectSerial(projectId, serialId, patch) {
  // arrayUnion/arrayRemove can't mutate in place, so read-modify-write.
  const snap = await projectDoc(projectId).get();
  const list = Array.isArray(snap.data().serialNumbers) ? snap.data().serialNumbers : [];
  const updated = list.map(e => e.id === serialId ? { ...e, ...patch } : e);
  await projectDoc(projectId).update({
    serialNumbers: updated,
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function deleteProjectSerial(projectId, serialId) {
  const snap = await projectDoc(projectId).get();
  const list = Array.isArray(snap.data().serialNumbers) ? snap.data().serialNumbers : [];
  const entry = list.find(e => e.id === serialId);
  const updated = list.filter(e => e.id !== serialId);
  await projectDoc(projectId).update({
    serialNumbers: updated,
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  });
  if (entry && entry.photoStoragePath) {
    try { await getStorage().ref(entry.photoStoragePath).delete(); }
    catch (e) { console.warn('Serial photo verwijderen mislukt', e); }
  }
}

async function uploadProjectSerialPhoto(projectId, serialId, file) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  if (!file || !file.type.startsWith('image/')) throw new Error('Alleen afbeeldingen.');
  const MAX_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_BYTES) throw new Error('Te groot (max 15 MB).');

  const ts = Date.now();
  const storagePath = `projects/${projectId}/serials/${serialId}_${ts}.jpg`;

  // Read existing entry to replace its photo (delete old blob after success).
  const snap = await projectDoc(projectId).get();
  const list = Array.isArray(snap.data().serialNumbers) ? snap.data().serialNumbers : [];
  const oldEntry = list.find(e => e.id === serialId);

  await getStorage().ref(storagePath).put(file, { contentType: file.type });

  const patch = {
    photoStoragePath: storagePath,
    uploadedAt:       new Date(),
    uploadedBy:       email,
  };
  const updated = list.map(e => e.id === serialId ? { ...e, ...patch } : e);
  await projectDoc(projectId).update({
    serialNumbers: updated,
    updatedAt:     firebase.firestore.FieldValue.serverTimestamp(),
  });

  if (oldEntry && oldEntry.photoStoragePath && oldEntry.photoStoragePath !== storagePath) {
    try { await getStorage().ref(oldEntry.photoStoragePath).delete(); }
    catch (e) { console.warn('Oude serial photo verwijderen mislukt', e); }
  }
}

async function getSerialPhotoUrl(storagePath) {
  if (!storagePath) return null;
  try { return await getStorage().ref(storagePath).getDownloadURL(); }
  catch (e) { console.warn('Serial photo URL ophalen mislukt', e); return null; }
}
```

- [ ] **Step 3.4: Browser-verificatie (manueel via devtools-console)**

1. Log in op `http://localhost:8080/dashboard.html`.
2. Open een bestaand project (noteer zijn doc-id uit de URL of Firebase Console).
3. Open devtools-console en run:
   ```js
   await addProjectSerial('<PROJECT_ID>', 'TEST-123');
   ```
4. Expect: geen errors. Controleer in Firebase Console dat het project-doc nu een `serialNumbers: [{id:"sn_xxx", value:"TEST-123", ...}]` array heeft.
5. Verwijder de test-entry:
   ```js
   const snap = await firebase.firestore().collection('projects').doc('<PROJECT_ID>').get();
   const entry = snap.data().serialNumbers[0];
   await deleteProjectSerial('<PROJECT_ID>', entry.id);
   ```
6. Expect: array weer leeg.

- [ ] **Step 3.5: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "feat(firebase): add serialNumbers datamodel + CRUD helpers"
```

---

## Task 4: CSS — sticky action bar, card collapse, camera-upload styles

**Doel:** Herbruikbare CSS-building blocks in `smartpeak.css` voor de nieuwe layout-patronen.

**Files:**
- Modify: `assets/css/smartpeak.css`

- [ ] **Step 4.1: Voeg sticky-action-bar styles toe**

Append aan `assets/css/smartpeak.css`:
```css
/* ─── Sticky action bar (project-edit footer) ──────────────────────────────── */
.sticky-action-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-top: 1px solid var(--bs-border-color);
  padding: 0.75rem 1rem;
  margin: 0 -1rem;  /* negative margin so bar extends beyond container padding */
  z-index: 1020;
  box-shadow: 0 -4px 12px rgba(0,0,0,0.04);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
@media (max-width: 575.98px) {
  .sticky-action-bar { padding: 0.5rem 0.75rem; }
  .sticky-action-bar .btn { flex: 1 1 auto; min-width: 0; }
}
```

- [ ] **Step 4.2: Voeg card-collapse styles toe**

Append:
```css
/* ─── Collapsible cards (blok B en C in project-edit) ─────────────────────── */
.collapsible-card > .card-header {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bs-body-bg);
}
.collapsible-card > .card-header .chev {
  transition: transform 0.2s ease;
}
.collapsible-card > .card-header[aria-expanded="false"] .chev {
  transform: rotate(-90deg);
}
```

- [ ] **Step 4.3: Voeg upload-zone helper toe**

Append:
```css
/* ─── Camera + file picker buttons (mobile) ──────────────────────────────── */
.upload-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.upload-buttons .btn {
  flex: 1 1 calc(50% - 0.25rem);
  min-width: 0;
}
@media (min-width: 768px) {
  /* on desktop camera button is de facto a file picker too — still show both */
  .upload-buttons .btn { flex: 0 0 auto; }
}
```

- [ ] **Step 4.4: Voeg serial-row styles toe**

Append:
```css
/* ─── Serial number list rows ────────────────────────────────────────────── */
.serial-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}
.serial-row > input[type="text"] { flex: 1 1 auto; min-width: 0; }
.serial-row > .serial-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}
.serial-row .serial-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
```

- [ ] **Step 4.5: Browser-verificatie**

1. Open `http://localhost:8080/project-edit.html?new=1`.
2. Expect: pagina laadt zonder errors. De nieuwe CSS is passive (wordt nog niet gebruikt), dus layout is nog onveranderd. Geen visuele regressie.

- [ ] **Step 4.6: Commit**

```bash
git add assets/css/smartpeak.css
git commit -m "feat(css): add sticky-action-bar, collapsible-card, upload-buttons, serial-row styles"
```

---

## Task 5: Shell-restructure — 11 accordion-secties → 4 card-skeleton

**Doel:** Vervang de accordion-container door een responsive grid met 4 lege card-skeletons (Blok A/B/C/D). Alle huidige `section*()` functies blijven intact en renderen tijdelijk **niet meer** (we wiren ze niet; pagina lijkt grotendeels leeg). Dit zet de nieuwe structuur neer zonder bestaande logica te breken.

**Files:**
- Modify: `project-edit.html` (regio rond regel 255-265 waar de accordion start, en regel 1010-1060 waar CSV en CTA-bar staan)

- [ ] **Step 5.1: Lees de huidige shell-structuur**

Lees `project-edit.html:55-70` (accordion-wrapper open) en `project-edit.html:195-230` (`renderSections` functie die alle `section*()` concateneert en `wireSection*()` roept) en `project-edit.html:1000-1060` (CTA-balk onderaan).

- [ ] **Step 5.2: Vervang accordion-wrapper door card-grid**

Op `project-edit.html:59` staat:
```html
<div class="accordion" id="projectEditAccordion">
```

Vervang deze opening door een responsive Bootstrap grid:
```html
<div class="row g-3" id="peCardGrid">
  <div class="col-12" id="blokA-slot"></div>
  <div class="col-12 col-lg-6" id="blokB-slot"></div>
  <div class="col-12 col-lg-6" id="blokC-slot"></div>
  <div class="col-12" id="blokD-slot"></div>
</div>
```

De sluit-`</div>` van de accordion blijft ongewijzigd (sluit nu het card-grid).

- [ ] **Step 5.3: Disable de oude render-pipeline**

Op `project-edit.html:201-227` staat de functie `renderSections()` die alle 11 `section*()` concateneert en 11 `wireSection*()` calls uitvoert.

Vervang de volledige body van `renderSections()` door:
```js
// Phase 1: skeleton only. Blok-specific render functions land in Tasks 6-10.
document.getElementById('blokA-slot').innerHTML = '<div class="card"><div class="card-body">Blok A — Voor de berekening <em class="text-muted">(wordt opgebouwd in Task 6)</em></div></div>';
document.getElementById('blokB-slot').innerHTML = '<div class="card"><div class="card-body">Blok B — Klant &amp; situatie <em class="text-muted">(Task 7)</em></div></div>';
document.getElementById('blokC-slot').innerHTML = '<div class="card"><div class="card-body">Blok C — Technische opmeting <em class="text-muted">(Task 8)</em></div></div>';
document.getElementById('blokD-slot').innerHTML = '<div class="card"><div class="card-body">Blok D — Foto\'s &amp; serienummers <em class="text-muted">(Task 9)</em></div></div>';
```

Verwijder ook de `wireSection*()` calls die bij elke sectie horen — in deze tussenfase worden de formvelden niet gerenderd, dus hun event-handlers zouden op `null`-elementen crashen.

**Laat de `section*()` en `wireSection*()` functie-definities zelf staan**; ze worden in Tasks 6-10 hergebruikt / geherstructureerd.

- [ ] **Step 5.4: Browser-verificatie**

1. Open `http://localhost:8080/project-edit.html?new=1`.
2. Expect: 4 lege card-placeholders zichtbaar. Op ≥ lg breedte staan Blok B en C naast elkaar, Blok A en D full-width. Op < lg alles gestapeld.
3. Geen console-errors (de wireSection-calls moeten verwijderd zijn, dus geen `null`-crashes).
4. Klik "Annuleren" → redirect naar dashboard werkt nog.

- [ ] **Step 5.5: Commit**

```bash
git add project-edit.html
git commit -m "refactor(project-edit): replace 11-section accordion with 4-block card grid skeleton"
```

---

## Task 6: Blok A — "Voor de berekening"

**Doel:** Compacte card met klantnaam, projectnaam (optioneel), woning-leeftijd → BTW, leverancier + prijzen, totaal omvormer-kW (smart), CSV upload, en een disclosure `▸ Extra opties` voor BTW-override/keuring.

**Files:**
- Modify: `project-edit.html` (vervang Task 5 skeleton voor blokA-slot + nieuwe render-functie + wire-functie)

- [ ] **Step 6.1: Schrijf `sectionBlokA()` render-functie**

Voeg toe vlak onder de bestaande `sectionBasis` / `sectionCustomer` functies in `project-edit.html`:

```js
function sectionBlokA() {
  const p = _project;
  const site = p.site || { houseAgeOver10Years: null };
  const sup  = p.supplier || { isSingleTariff: false, priceDay: null, priceNight: null };
  const calcD = p.calcDefaults || { btw: null, keuring: 'yes' };
  const invs = (p.solar && p.solar.inverters) || [];
  const totalKw = invs.reduce((s, i) => s + (Number(i.powerKw) || 0), 0);

  const ageRadio = (v, label) => {
    const match = (v === null ? site.houseAgeOver10Years === null : site.houseAgeOver10Years === v);
    const strV = v === null ? 'unknown' : String(v);
    const id = 'fAge_' + strV;
    return `<div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="fHouseAge" value="${strV}" id="${id}" ${match ? 'checked' : ''}/>
      <label class="form-check-label" for="${id}">${label}</label>
    </div>`;
  };

  // Smart inverter-kW rendering:
  //   0 inverters → single editable input (creates entry #1 on first edit)
  //   1 inverter  → single editable input (two-way bound to entry[0].powerKw)
  //   2+ inverters → readonly sum + deeplink to Blok C
  let inverterFieldHtml;
  if (invs.length >= 2) {
    inverterFieldHtml = `
      <label class="form-label">Totaal omvormer-vermogen</label>
      <div class="input-group">
        <input type="text" class="form-control" value="${totalKw} kW — som van ${invs.length} omvormers" readonly />
        <button type="button" class="btn btn-outline-secondary" id="fInverterDeeplink">Beheer per omvormer →</button>
      </div>
    `;
  } else {
    const val = invs.length === 1 && invs[0].powerKw != null ? invs[0].powerKw : '';
    inverterFieldHtml = `
      <label for="fTotalKw" class="form-label">Omvormer-vermogen (kW) <span class="text-danger">*</span></label>
      <input type="number" id="fTotalKw" class="form-control" min="0" step="0.1" value="${val}" placeholder="bv. 5.0" />
      <div class="form-text">Eén omvormer? Vul hier in. Meer? Voeg details toe in "Technische opmeting".</div>
    `;
  }

  // Price-night is only shown when dual-tariff is selected.
  const priceNightHtml = sup.isSingleTariff === false ? `
    <div class="col-12 col-md-4">
      <label for="fPriceNight" class="form-label">Prijs nacht (€/kWh)</label>
      <input type="number" id="fPriceNight" class="form-control" min="0" step="0.001" value="${sup.priceNight != null ? sup.priceNight : ''}" />
    </div>
  ` : '';

  return `
    <div class="card border-primary">
      <div class="card-header bg-primary-subtle">
        <h5 class="mb-0"><i class="fa-solid fa-bolt text-primary me-2"></i>Voor de berekening</h5>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label for="fCustomerName" class="form-label">Klantnaam <span class="text-danger">*</span></label>
            <input type="text" id="fCustomerName" class="form-control" maxlength="120" value="${escapeHtml(p.customerName || '')}" required />
          </div>
          <div class="col-12 col-md-6">
            <label for="fProjectName" class="form-label">Projectnaam <span class="text-muted small fw-normal">(optioneel)</span></label>
            <input type="text" id="fProjectName" class="form-control" maxlength="120" placeholder="Leeg = klantnaam wordt gebruikt" value="${escapeHtml(p.projectName || '')}" />
          </div>

          <div class="col-12">
            <label class="form-label">Leeftijd woning (bepaalt BTW)</label>
            <div>
              ${ageRadio(true,  '≥ 10 jaar (6%)')}
              ${ageRadio(false, '< 10 jaar (21%)')}
              ${ageRadio(null,  'Onbekend')}
            </div>
          </div>

          <div class="col-12 col-md-4">
            <label class="form-label">Tarief-type</label>
            <div>
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="fTariffMode" value="single" id="fTariffSingle" ${sup.isSingleTariff === true ? 'checked' : ''}/>
                <label class="form-check-label" for="fTariffSingle">Enkel tarief</label>
              </div>
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="fTariffMode" value="dual" id="fTariffDual" ${sup.isSingleTariff !== true ? 'checked' : ''}/>
                <label class="form-check-label" for="fTariffDual">Dag/nacht</label>
              </div>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <label for="fPriceDay" class="form-label">Prijs ${sup.isSingleTariff === true ? '' : 'dag '}(€/kWh)</label>
            <input type="number" id="fPriceDay" class="form-control" min="0" step="0.001" value="${sup.priceDay != null ? sup.priceDay : ''}" />
          </div>
          ${priceNightHtml}

          <div class="col-12">
            ${inverterFieldHtml}
          </div>

          <div class="col-12">
            <label class="form-label">CSV Fluvius</label>
            <input type="file" id="fCsv" class="form-control" accept=".csv" />
            <div class="form-text" id="fCsvStatus">${_csvStatusLine()}</div>
          </div>

          <div class="col-12">
            <details class="mt-2">
              <summary class="text-muted small">▸ Extra opties (BTW handmatig, keuring, leverancier-naam)</summary>
              <div class="row g-3 mt-1">
                <div class="col-12 col-md-4">
                  <label for="fBtwManual" class="form-label">BTW handmatig</label>
                  <select id="fBtwManual" class="form-select" ${site.houseAgeOver10Years !== null ? 'disabled' : ''}>
                    <option value="">— Nog niet bepaald —</option>
                    <option value="6"  ${calcD.btw === 6  ? 'selected' : ''}>6%</option>
                    <option value="21" ${calcD.btw === 21 ? 'selected' : ''}>21%</option>
                  </select>
                </div>
                <div class="col-12 col-md-4">
                  <label for="fKeuring" class="form-label">Keuring</label>
                  <select id="fKeuring" class="form-select">
                    <option value="yes" ${calcD.keuring === 'yes' ? 'selected' : ''}>Ja</option>
                    <option value="no"  ${calcD.keuring === 'no'  ? 'selected' : ''}>Nee</option>
                  </select>
                </div>
                <div class="col-12 col-md-4">
                  <label for="fSupplierName" class="form-label">Leverancier-naam</label>
                  <input type="text" id="fSupplierName" class="form-control" maxlength="80" value="${escapeHtml(sup.name || '')}" />
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Helper: render current CSV status line for Blok A.
function _csvStatusLine() {
  if (!_project.csvUpload && !_csvPending) return 'Nog geen CSV geüpload.';
  if (_csvPending) return `Klaar om op te slaan: ${escapeHtml(_csvPending.name || 'CSV')}`;
  const u = _project.csvUpload;
  return `Vorige upload: ${escapeHtml(u.meterNr || u.eanCode || 'onbekend')}`;
}
```

- [ ] **Step 6.2: Schrijf `wireBlokA()` — event handlers**

Voeg onder `sectionBlokA` toe:
```js
function wireBlokA() {
  // Identity fields
  document.getElementById('fCustomerName').addEventListener('input', e => {
    _project.customerName = e.target.value;
  });
  document.getElementById('fProjectName').addEventListener('input', e => {
    _project.projectName = e.target.value;
  });

  // Woning-leeftijd radios
  document.querySelectorAll('input[name="fHouseAge"]').forEach(r => {
    r.addEventListener('change', e => {
      const v = e.target.value;
      _project.site = _project.site || {};
      _project.site.houseAgeOver10Years =
        v === 'true'  ? true  :
        v === 'false' ? false :
                        null;
      if (_project.site.houseAgeOver10Years !== null) {
        _project.calcDefaults = _project.calcDefaults || {};
        _project.calcDefaults.btw = null;
      }
      rerenderBlokA();
      updateSaveCalcEnabled();
    });
  });

  // Tarief-type radios + prijzen
  document.querySelectorAll('input[name="fTariffMode"]').forEach(r => {
    r.addEventListener('change', e => {
      _project.supplier = _project.supplier || {};
      _project.supplier.isSingleTariff = (e.target.value === 'single');
      rerenderBlokA();
      updateSaveCalcEnabled();
    });
  });
  document.getElementById('fPriceDay').addEventListener('input', e => {
    _project.supplier = _project.supplier || {};
    _project.supplier.priceDay = e.target.value === '' ? null : parseFloat(e.target.value);
    updateSaveCalcEnabled();
  });
  const pn = document.getElementById('fPriceNight');
  if (pn) pn.addEventListener('input', e => {
    _project.supplier = _project.supplier || {};
    _project.supplier.priceNight = e.target.value === '' ? null : parseFloat(e.target.value);
    updateSaveCalcEnabled();
  });

  // Inverter smart field
  const totalKwInput = document.getElementById('fTotalKw');
  if (totalKwInput) {
    totalKwInput.addEventListener('input', e => {
      _project.solar = _project.solar || { inverters: [] };
      const invs = _project.solar.inverters;
      const v = e.target.value === '' ? null : parseFloat(e.target.value);
      if (invs.length === 0) {
        invs.push({ id: genInverterId(), powerKw: v, brand: '', model: '', panelCount: null, circuitCount: null, orientation: '' });
      } else {
        invs[0].powerKw = v;
      }
      updateSaveCalcEnabled();
    });
  }
  const dlBtn = document.getElementById('fInverterDeeplink');
  if (dlBtn) dlBtn.addEventListener('click', () => {
    document.getElementById('blokC-slot').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // CSV upload
  document.getElementById('fCsv').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const csvText = await file.text();
      const parsed  = parseCSV(csvText);
      _csvPending   = extractCsvForStorage(parsed, file.name);
      document.getElementById('fCsvStatus').textContent = _csvStatusLine();
      updateSaveCalcEnabled();
    } catch (err) {
      document.getElementById('fCsvStatus').textContent = 'CSV-fout: ' + err.message;
    }
  });

  // Extra opties
  const btwSel = document.getElementById('fBtwManual');
  if (btwSel) btwSel.addEventListener('change', e => {
    _project.calcDefaults = _project.calcDefaults || {};
    _project.calcDefaults.btw = e.target.value === '' ? null : Number(e.target.value);
    updateSaveCalcEnabled();
  });
  const keur = document.getElementById('fKeuring');
  if (keur) keur.addEventListener('change', e => {
    _project.calcDefaults = _project.calcDefaults || {};
    _project.calcDefaults.keuring = e.target.value;
  });
  const supN = document.getElementById('fSupplierName');
  if (supN) supN.addEventListener('input', e => {
    _project.supplier = _project.supplier || {};
    _project.supplier.name = e.target.value;
  });
}

function rerenderBlokA() {
  document.getElementById('blokA-slot').innerHTML = sectionBlokA();
  wireBlokA();
}
```

- [ ] **Step 6.3: Voeg `_csvPending` top-level state toe**

Zoek waar `_project` als top-level let/var gedeclareerd staat (rond regel 170-180). Voeg eronder toe:
```js
let _csvPending = null; // { meterNr, eanCode, meterType, dailyCompact, name } — set wanneer user een nieuwe CSV kiest; verzilverd bij saveProject.
```

- [ ] **Step 6.4: Update `renderForm()` om Blok A te renderen**

Vervang in de code van Task 5.3 de placeholder voor blokA-slot door:
```js
document.getElementById('blokA-slot').innerHTML = sectionBlokA();
wireBlokA();
```

- [ ] **Step 6.5: Voeg stub `updateSaveCalcEnabled()` toe**

Aan het einde van het `<script>`-blok, vlak vóór de `init()`-call:
```js
// Stub — vervangen door echte implementatie in Task 10.
function updateSaveCalcEnabled() { /* no-op until Task 10 */ }
```

- [ ] **Step 6.6: Update save-flow om `_csvPending` te verzilveren**

Zoek in `project-edit.html` de save-functie (rond regel 1100-1140, `saveProject` of `saveAndCalc`). Vóór `updateProject({...})` of `createProject({...})` gecalld wordt, voeg de CSV-merge in:
```js
if (_csvPending) {
  payload.csvData = _csvPending;  // extractCsvForStorage already shaped
}
```

En bij `createProject` / `updateProject`: zorg dat `csvData` / `csvUpload` gezet wordt als `_csvPending` niet null is. (Exacte invoeging: zie bestaande `payload.csvUpload = ...` of `createProject({..., csvData: _csvPending ? _csvPending : null, ...})`.)

- [ ] **Step 6.7: Browser-verificatie**

1. `http://localhost:8080/project-edit.html?new=1`.
2. Expect: Blok A-card vol zichtbaar met alle velden. Enkel klantnaam markeerd required.
3. Vul klantnaam "Test-A" + projectnaam blanco + woning "≥ 10 jaar" + prijs dag "0.35" + tarief "Enkel tarief" + omvormer "5" + upload een Fluvius CSV → Expect: "Klaar om op te slaan: ..." onder CSV-field; geen errors.
4. Klik "Dag/nacht" → Expect: prijs-nacht field verschijnt.
5. Klik disclosure ▸ Extra opties → Expect: BTW, keuring, leverancier-naam verschijnen. BTW is disabled want woning-leeftijd is gekozen.
6. Kies woning "Onbekend" → Expect: BTW select wordt enabled.
7. Klik Opslaan. Expect: project wordt aangemaakt; redirect naar dashboard; project zichtbaar als "Test-A".

- [ ] **Step 6.8: Commit**

```bash
git add project-edit.html
git commit -m "feat(project-edit): implement Blok A — essentials card"
```

---

## Task 7: Blok B — "Klant & situatie"

**Doel:** Eén card met status, adres, telefoon, e-mail, situatie-notitie.

**Files:**
- Modify: `project-edit.html`

- [ ] **Step 7.1: Schrijf `sectionBlokB()` en `wireBlokB()`**

Voeg toe na `wireBlokA`:
```js
function sectionBlokB() {
  const c = _project.customer || {};
  const status = _project.status || DEFAULT_STATUS;
  const statusOptions = PROJECT_STATUSES.map(s =>
    `<option value="${s.key}" ${s.key === status ? 'selected' : ''}>${s.label}</option>`
  ).join('');
  return `
    <div class="card collapsible-card">
      <div class="card-header" data-bs-toggle="collapse" data-bs-target="#blokB-body" aria-expanded="true" aria-controls="blokB-body">
        <h5 class="mb-0"><i class="fa-solid fa-user text-primary me-2"></i>Klant &amp; situatie</h5>
        <i class="fa-solid fa-chevron-down chev" aria-hidden="true"></i>
      </div>
      <div id="blokB-body" class="collapse show">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <label for="fStatus" class="form-label">Status</label>
              <select id="fStatus" class="form-select">${statusOptions}</select>
            </div>
            <div class="col-12">
              <label for="fAddress" class="form-label">Adres</label>
              <input type="text" id="fAddress" class="form-control" maxlength="200" placeholder="Straat + nr, postcode gemeente" value="${escapeHtml(c.address || '')}" />
            </div>
            <div class="col-12 col-md-6">
              <label for="fPhone" class="form-label">Telefoon</label>
              <input type="tel" id="fPhone" class="form-control" maxlength="40" value="${escapeHtml(c.phone || '')}" />
            </div>
            <div class="col-12 col-md-6">
              <label for="fEmail" class="form-label">E-mail</label>
              <input type="email" id="fEmail" class="form-control" maxlength="120" value="${escapeHtml(c.email || '')}" />
            </div>
            <div class="col-12">
              <label for="fSituation" class="form-label">Situatie</label>
              <textarea id="fSituation" class="form-control" rows="2" maxlength="500">${escapeHtml(_project.situation || '')}</textarea>
            </div>
            <div class="col-12">
              <label for="fNotes" class="form-label">Notities</label>
              <textarea id="fNotes" class="form-control" rows="3" maxlength="2000">${escapeHtml(_project.notes || '')}</textarea>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function wireBlokB() {
  document.getElementById('fStatus').addEventListener('change', e => {
    _project.status = e.target.value;
  });
  document.getElementById('fAddress').addEventListener('input', e => {
    _project.customer = _project.customer || {};
    _project.customer.address = e.target.value;
  });
  document.getElementById('fPhone').addEventListener('input', e => {
    _project.customer = _project.customer || {};
    _project.customer.phone = e.target.value;
  });
  document.getElementById('fEmail').addEventListener('input', e => {
    _project.customer = _project.customer || {};
    _project.customer.email = e.target.value;
  });
  document.getElementById('fSituation').addEventListener('input', e => {
    _project.situation = e.target.value;
  });
  document.getElementById('fNotes').addEventListener('input', e => {
    _project.notes = e.target.value;
  });

  // Collapse-toggle: restore persisted state + wire persistence on click.
  const header = document.querySelector('#blokB-slot .card-header');
  const body   = document.getElementById('blokB-body');
  const persisted = _getCardCollapsed('B');
  if (persisted === true) {
    body.classList.remove('show');
    header.setAttribute('aria-expanded', 'false');
  }
  header.addEventListener('click', () => {
    setTimeout(() => {
      _setCardCollapsed('B', !body.classList.contains('show'));
    }, 0);
  });
}
```

- [ ] **Step 7.2: Voeg collapse-persistence helpers toe**

Eénmalig, onder `wireBlokB`:
```js
const _CARD_COLLAPSE_KEY = 'smartpeak.editCardCollapsed';
function _getCardCollapsed(blok) {
  try { return (JSON.parse(localStorage.getItem(_CARD_COLLAPSE_KEY)) || {})[blok] === true; }
  catch { return false; }
}
function _setCardCollapsed(blok, collapsed) {
  try {
    const current = JSON.parse(localStorage.getItem(_CARD_COLLAPSE_KEY)) || {};
    current[blok] = collapsed;
    localStorage.setItem(_CARD_COLLAPSE_KEY, JSON.stringify(current));
  } catch {}
}
```

- [ ] **Step 7.3: Update `renderForm()` om Blok B te renderen**

Vervang de placeholder voor `blokB-slot`:
```js
document.getElementById('blokB-slot').innerHTML = sectionBlokB();
wireBlokB();
```

- [ ] **Step 7.4: Browser-verificatie**

1. Reload `project-edit.html?new=1`.
2. Expect: Blok B-card verschijnt naast Blok C op ≥ lg (of eronder op < lg).
3. Vul alle velden in; klik op Blok B-header → Expect: body klapt in; chevron roteert. Reload → Expect: ingeklapt blijft ingeklapt.
4. Klap uit, sla project op → Expect: alle velden verschijnen na opnieuw openen.

- [ ] **Step 7.5: Commit**

```bash
git add project-edit.html
git commit -m "feat(project-edit): implement Blok B — customer & situation card"
```

---

## Task 8: Blok C — "Technische opmeting"

**Doel:** Een card met aansluiting + zekeringkast + dynamische omvormer-detail-lijst.

**Files:**
- Modify: `project-edit.html`

- [ ] **Step 8.1: Schrijf `sectionBlokC()` en `wireBlokC()`**

Voeg toe na `wireBlokB`. Hergebruik de `triStateHtml` en `parseTriState` helpers die al bestaan (regel ~552-572) — NIET dupliceren.

```js
function sectionBlokC() {
  const el = _project.electrical || {};
  const c  = _project.cabinet    || {};
  const invs = (_project.solar && _project.solar.inverters) || [];

  const connTypes = ['', ...CONNECTION_TYPES].map(t =>
    `<option value="${t}" ${t === (el.connectionType || '') ? 'selected' : ''}>${t === '' ? '— Niet bepaald —' : t}</option>`
  ).join('');

  const triRow = (label, key, value) => `
    <div class="col-12 col-md-6">
      <label class="form-label">${label}</label>
      ${triStateHtml('fCab_' + key, value)}
    </div>
  `;

  const inverterCards = invs.map((inv, idx) => `
    <div class="card mb-2" data-inv-id="${inv.id}">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h6 class="mb-0">Omvormer ${idx + 1}</h6>
          <button type="button" class="btn-close" aria-label="Verwijder" data-remove-inv="${inv.id}"></button>
        </div>
        <div class="row g-2">
          <div class="col-12 col-md-4">
            <label class="form-label">Vermogen (kW) <span class="text-danger">*</span></label>
            <input type="number" data-inv-field="powerKw" data-inv-id="${inv.id}" class="form-control" min="0" step="0.1" value="${inv.powerKw != null ? inv.powerKw : ''}" required />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Merk</label>
            <input type="text" data-inv-field="brand" data-inv-id="${inv.id}" class="form-control" maxlength="60" value="${escapeHtml(inv.brand || '')}" />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Model</label>
            <input type="text" data-inv-field="model" data-inv-id="${inv.id}" class="form-control" maxlength="60" value="${escapeHtml(inv.model || '')}" />
          </div>
          <div class="col-6 col-md-4">
            <label class="form-label">Panelen</label>
            <input type="number" data-inv-field="panelCount" data-inv-id="${inv.id}" class="form-control" min="0" step="1" value="${inv.panelCount != null ? inv.panelCount : ''}" />
          </div>
          <div class="col-6 col-md-4">
            <label class="form-label">Kringen</label>
            <input type="number" data-inv-field="circuitCount" data-inv-id="${inv.id}" class="form-control" min="0" step="1" value="${inv.circuitCount != null ? inv.circuitCount : ''}" />
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label">Ligging</label>
            <input type="text" data-inv-field="orientation" data-inv-id="${inv.id}" class="form-control" maxlength="40" value="${escapeHtml(inv.orientation || '')}" />
          </div>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div class="card collapsible-card">
      <div class="card-header" data-bs-toggle="collapse" data-bs-target="#blokC-body" aria-expanded="true" aria-controls="blokC-body">
        <h5 class="mb-0"><i class="fa-solid fa-screwdriver-wrench text-primary me-2"></i>Technische opmeting</h5>
        <i class="fa-solid fa-chevron-down chev" aria-hidden="true"></i>
      </div>
      <div id="blokC-body" class="collapse show">
        <div class="card-body">
          <h6 class="text-muted mb-2">Aansluiting</h6>
          <div class="row g-3 mb-3">
            <div class="col-12 col-md-6">
              <label for="fConnectionType" class="form-label">Type aansluiting</label>
              <select id="fConnectionType" class="form-select">${connTypes}</select>
            </div>
            <div class="col-12 col-md-6">
              <label for="fFuseRating" class="form-label">Zekeringsterkte Fluvius-zijde (A)</label>
              <input type="number" id="fFuseRating" class="form-control" min="0" step="1" value="${el.fuseRatingA != null ? el.fuseRatingA : ''}" />
            </div>
          </div>

          <h6 class="text-muted mb-2">Zekeringkast</h6>
          <div class="row g-3 mb-3">
            <div class="col-12 col-md-6">
              <label for="fFreeUnits" class="form-label">Vrije modules</label>
              <input type="number" id="fFreeUnits" class="form-control" min="0" step="1" value="${c.freeUnits != null ? c.freeUnits : ''}" />
            </div>
            <div class="col-12 col-md-6">
              <label for="fWiringDiameter" class="form-label">Diameter bekabeling (mm²)</label>
              <input type="number" id="fWiringDiameter" class="form-control" min="0" step="0.5" value="${c.wiringDiameterMm2 != null ? c.wiringDiameterMm2 : ''}" />
            </div>
            ${triRow('Rem-automaat aanwezig?',          'hasRemAutomaat',        c.hasRemAutomaat)}
            ${triRow('Stopcontact bij Fluvius?',        'hasOutletNearFluvius',  c.hasOutletNearFluvius)}
            ${triRow('Wifi bij Fluvius?',               'hasWifiNearFluvius',    c.hasWifiNearFluvius)}
            ${triRow('Plaats voor batterijen?',         'batteryPlacementRoom',  c.batteryPlacementRoom)}
            ${triRow('Wifi bij zekeringkast?',          'hasWifiNearCabinet',    c.hasWifiNearCabinet)}
            <div class="col-12">
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="fLineGroundChecked" ${c.lineGroundChecked === true ? 'checked' : ''} />
                <label class="form-check-label" for="fLineGroundChecked">
                  Meting fase ↔ aarde uitgevoerd én onder 30 V
                  <span class="d-block form-text">Verplicht bij Zendure-installaties.</span>
                </label>
              </div>
            </div>
          </div>

          <h6 class="text-muted mb-2">Omvormer(s)</h6>
          <div id="peInverterList">${inverterCards}</div>
          <button type="button" class="btn btn-outline-secondary btn-sm" id="fAddInverter"><i class="fa-solid fa-plus me-1"></i>Omvormer toevoegen</button>
        </div>
      </div>
    </div>
  `;
}

function wireBlokC() {
  // Aansluiting
  document.getElementById('fConnectionType').addEventListener('change', e => {
    _project.electrical = _project.electrical || {};
    _project.electrical.connectionType = e.target.value || null;
  });
  document.getElementById('fFuseRating').addEventListener('input', e => {
    _project.electrical = _project.electrical || {};
    const v = parseFloat(e.target.value);
    _project.electrical.fuseRatingA = isNaN(v) ? null : v;
  });

  // Zekeringkast
  document.getElementById('fFreeUnits').addEventListener('input', e => {
    _project.cabinet = _project.cabinet || {};
    const v = parseFloat(e.target.value);
    _project.cabinet.freeUnits = isNaN(v) ? null : v;
  });
  document.getElementById('fWiringDiameter').addEventListener('input', e => {
    _project.cabinet = _project.cabinet || {};
    const v = parseFloat(e.target.value);
    _project.cabinet.wiringDiameterMm2 = isNaN(v) ? null : v;
  });
  ['hasRemAutomaat','hasOutletNearFluvius','hasWifiNearFluvius','batteryPlacementRoom','hasWifiNearCabinet'].forEach(key => {
    document.querySelectorAll(`input[name="fCab_${key}"]`).forEach(r => {
      r.addEventListener('change', e => {
        _project.cabinet = _project.cabinet || {};
        _project.cabinet[key] = parseTriState(e.target.value);
      });
    });
  });
  document.getElementById('fLineGroundChecked').addEventListener('change', e => {
    _project.cabinet = _project.cabinet || {};
    _project.cabinet.lineGroundChecked = e.target.checked ? true : null;
  });

  // Omvormer-lijst — per-entry input handlers
  document.querySelectorAll('[data-inv-field]').forEach(inp => {
    inp.addEventListener('input', e => {
      const invId = e.target.getAttribute('data-inv-id');
      const field = e.target.getAttribute('data-inv-field');
      const inv = _project.solar.inverters.find(i => i.id === invId);
      if (!inv) return;
      if (field === 'powerKw' || field === 'panelCount' || field === 'circuitCount') {
        const v = parseFloat(e.target.value);
        inv[field] = isNaN(v) ? null : v;
      } else {
        inv[field] = e.target.value;
      }
      if (field === 'powerKw') {
        rerenderBlokA();
        updateSaveCalcEnabled();
      }
    });
  });

  // Remove-inverter buttons
  document.querySelectorAll('[data-remove-inv]').forEach(btn => {
    btn.addEventListener('click', e => {
      const invId = e.target.getAttribute('data-remove-inv');
      _project.solar.inverters = _project.solar.inverters.filter(i => i.id !== invId);
      rerenderBlokC();
      rerenderBlokA();
      updateSaveCalcEnabled();
    });
  });

  // Add-inverter
  document.getElementById('fAddInverter').addEventListener('click', () => {
    _project.solar = _project.solar || { inverters: [] };
    _project.solar.inverters.push({
      id: genInverterId(), powerKw: null, brand: '', model: '',
      panelCount: null, circuitCount: null, orientation: '',
    });
    rerenderBlokC();
    rerenderBlokA();
  });

  // Collapse state
  const header = document.querySelector('#blokC-slot .card-header');
  const body   = document.getElementById('blokC-body');
  if (_getCardCollapsed('C') === true) {
    body.classList.remove('show');
    header.setAttribute('aria-expanded', 'false');
  }
  header.addEventListener('click', () => {
    setTimeout(() => {
      _setCardCollapsed('C', !body.classList.contains('show'));
    }, 0);
  });
}

function rerenderBlokC() {
  document.getElementById('blokC-slot').innerHTML = sectionBlokC();
  wireBlokC();
}
```

- [ ] **Step 8.2: Update `renderForm()` voor Blok C**

Vervang de `blokC-slot` placeholder-regel:
```js
document.getElementById('blokC-slot').innerHTML = sectionBlokC();
wireBlokC();
```

- [ ] **Step 8.3: Browser-verificatie**

1. Reload `project-edit.html?new=1`.
2. Klik "Omvormer toevoegen" twee keer → Expect: Blok C toont 2 omvormer-cards.
3. Scroll naar Blok A → Expect: "Totaal: 0 kW — som van 2 omvormers" readonly + deeplink-knop.
4. Vul kW in beide cards (bijv. 3 en 2) → Expect: Blok A toont "Totaal: 5 kW".
5. Klik deeplink in Blok A → Expect: scrolt naar Blok C.
6. Verwijder één omvormer via × → Expect: Blok A toont weer editable single input met waarde 3.
7. Verwijder de laatste → Expect: Blok A toont lege single input.

- [ ] **Step 8.4: Commit**

```bash
git add project-edit.html
git commit -m "feat(project-edit): implement Blok C — technical site survey card"
```

---

## Task 9: Blok D — "Foto's & serienummers"

**Doel:** Bestaande foto-grid behouden, camera-capture op mobile toevoegen, en serienummer-lijst met dynamische trailing-row en optionele foto per entry.

**Files:**
- Modify: `project-edit.html`

- [ ] **Step 9.1: Schrijf `sectionBlokD()` en `wireBlokD()`**

Voeg toe na `wireBlokC`. Aangezien de huidige foto-flow al werkt, hergebruik de bestaande functies voor photo-list/upload/delete indien ze als sectie-specifieke helpers bestaan. Zo niet: inline ze hier.

```js
function sectionBlokD() {
  // Photos: render zoals huidig (photo-grid met lightbox), plus nieuwe capture/picker buttons.
  // Serials: render list with trailing-empty row.
  const serials = _project.serialNumbers || [];
  const serialRowsHtml = serials.map(s => _renderSerialRow(s)).join('')
                      + _renderSerialRow({ id: '_new', value: '', photoStoragePath: null }); // trailing empty

  return `
    <div class="card">
      <div class="card-header">
        <h5 class="mb-0"><i class="fa-solid fa-images text-primary me-2"></i>Foto's &amp; serienummers</h5>
      </div>
      <div class="card-body">
        <h6 class="text-muted mb-2">Algemene foto's (plaatsbezoek)</h6>
        <div class="upload-buttons mb-2">
          <label class="btn btn-outline-primary mb-0" for="pePhotoCamera">
            <i class="fa-solid fa-camera me-1"></i> Foto maken
          </label>
          <input type="file" id="pePhotoCamera" accept="image/*" capture="environment" class="d-none" />
          <label class="btn btn-outline-secondary mb-0" for="pePhotoGallery">
            <i class="fa-solid fa-folder-open me-1"></i> Uit galerij kiezen
          </label>
          <input type="file" id="pePhotoGallery" accept="image/*" multiple class="d-none" />
        </div>
        <div class="photo-grid mb-3" id="pePhotoGrid"><p class="sp-empty-state">⏳ Laden…</p></div>
        <!-- Drop-zone: alleen op ≥ md (desktop/tablet landscape) — mobiel gebruikt bovenstaande buttons. -->
        <div class="sp-drop-zone d-none d-md-block mb-4" id="peDropZone">
          <input type="file" id="pePhotoInput" accept="image/*" multiple />
          <div id="peDropPrompt">
            <i class="fa-solid fa-cloud-arrow-up me-1"></i>
            <strong>Sleep foto's hierheen</strong> <span class="text-muted">of klik om te selecteren</span>
            <div class="text-muted small mt-1">Meerdere tegelijk OK (max 15 MB per foto).</div>
          </div>
          <div class="d-none" id="peDropProgress">
            <div class="progress mt-1" style="height:6px;">
              <div class="progress-bar" role="progressbar" style="width:0%"></div>
            </div>
            <div class="text-muted small mt-1">Uploaden <span id="peUploadCount">0/0</span>…</div>
          </div>
        </div>
        <div id="pePhotoErr" class="alert alert-danger mt-2 d-none"></div>

        <h6 class="text-muted mb-2">Serienummers batterijen / omvormers</h6>
        <div id="peSerialList">${serialRowsHtml}</div>
      </div>
    </div>
  `;
}

function _renderSerialRow(s) {
  const hasPhoto = s.photoStoragePath != null;
  const isNew = s.id === '_new';
  return `
    <div class="serial-row" data-serial-id="${s.id}">
      <input type="text" class="form-control" placeholder="Serienummer…" value="${escapeHtml(s.value || '')}" data-serial-field="value" />
      <div class="serial-actions">
        ${hasPhoto ? `<button type="button" class="btn btn-sm btn-outline-secondary" title="Foto bekijken" data-serial-view="${s.id}"><i class="fa-solid fa-eye"></i></button>` : ''}
        ${isNew ? '' : `<label class="btn btn-sm btn-outline-primary mb-0" title="Foto nemen/kiezen"><input type="file" accept="image/*" capture="environment" class="d-none" data-serial-photo="${s.id}" /><i class="fa-solid fa-camera"></i></label>`}
        ${isNew ? '' : `<button type="button" class="btn btn-sm btn-outline-danger" title="Verwijderen" data-serial-delete="${s.id}"><i class="fa-solid fa-xmark"></i></button>`}
      </div>
    </div>
  `;
}

function wireBlokD() {
  // Photo camera + gallery inputs (general photos) — hergebruik de bestaande
  // `listProjectPhotos`, `renderPhotoGrid`, `uploadProjectPhoto`, `_photos` globals.
  const cam = document.getElementById('pePhotoCamera');
  const gal = document.getElementById('pePhotoGallery');
  const onPhotoFiles = async (files) => {
    if (!PROJECT_ID) { showToast('Sla het project eerst op.', 'warning'); return; }
    for (const file of files) {
      try {
        await uploadProjectPhoto(PROJECT_ID, file);
      } catch (err) {
        showToast('Foto upload mislukt: ' + err.message, 'danger');
      }
    }
    _photos = await listProjectPhotos(PROJECT_ID);
    renderPhotoGrid();
  };
  cam.addEventListener('change', e => { if (e.target.files.length) onPhotoFiles([...e.target.files]); cam.value = ''; });
  gal.addEventListener('change', e => { if (e.target.files.length) onPhotoFiles([...e.target.files]); gal.value = ''; });

  // Initial photos render + drop-zone wiring — hergebruik de bestaande
  // `wireSectionPhotos()` logica (regel 839-...). Die functie wired `#peDropZone`
  // en `#pePhotoInput` op + doet de eerste `listProjectPhotos` render. Omdat
  // we dezelfde element-IDs behouden, werkt hij as-is:
  wireSectionPhotos();

  // Serials — value typing
  document.querySelectorAll('[data-serial-field="value"]').forEach(inp => {
    inp.addEventListener('input', async e => {
      const row = e.target.closest('.serial-row');
      const id  = row.getAttribute('data-serial-id');
      const val = e.target.value;
      if (id === '_new' && val.trim().length > 0) {
        // Promote trailing empty to a real entry + add new trailing.
        if (!PROJECT_ID) {
          // In new-project mode: stash locally on _project for save-time persistence.
          _project.serialNumbers = _project.serialNumbers || [];
          const entry = { id: _genSerialId(), value: val, photoStoragePath: null, uploadedAt: null, uploadedBy: null };
          _project.serialNumbers.push(entry);
          rerenderBlokD();
          // Focus nieuwe laatste input die onderaan staat
          setTimeout(() => {
            const rows = document.querySelectorAll('#peSerialList .serial-row');
            // de laatste is de nieuwe trailing; focus zijn input
            const last = rows[rows.length - 2]; // één vóór trailing
            if (last) last.querySelector('input').focus();
          }, 0);
        } else {
          const entry = await addProjectSerial(PROJECT_ID, val);
          _project.serialNumbers = _project.serialNumbers || [];
          _project.serialNumbers.push(entry);
          rerenderBlokD();
        }
      } else if (id !== '_new') {
        // Existing entry: save on blur, not on every keystroke, to avoid firestore spam.
        if (!_serialSaveTimer) _serialSaveTimer = {};
        clearTimeout(_serialSaveTimer[id]);
        _serialSaveTimer[id] = setTimeout(async () => {
          const entry = (_project.serialNumbers || []).find(x => x.id === id);
          if (entry) entry.value = val;
          if (PROJECT_ID) {
            try { await updateProjectSerial(PROJECT_ID, id, { value: val }); }
            catch (err) { showToast('Opslaan mislukt: ' + err.message, 'danger'); }
          }
        }, 600);
      }
    });
  });

  // Serial photo upload
  document.querySelectorAll('[data-serial-photo]').forEach(inp => {
    inp.addEventListener('change', async e => {
      const id = e.target.getAttribute('data-serial-photo');
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!PROJECT_ID) {
        showToast('Sla het project eerst op voor je serial-foto\'s toevoegt.', 'warning');
        return;
      }
      try {
        await uploadProjectSerialPhoto(PROJECT_ID, id, file);
        // Refresh in-memory list
        const snap = await projectDoc(PROJECT_ID).get();
        _project.serialNumbers = snap.data().serialNumbers || [];
        rerenderBlokD();
      } catch (err) {
        showToast('Foto upload mislukt: ' + err.message, 'danger');
      }
    });
  });

  // Serial delete
  document.querySelectorAll('[data-serial-delete]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = e.currentTarget.getAttribute('data-serial-delete');
      if (!confirm('Dit serienummer verwijderen?')) return;
      if (PROJECT_ID) {
        try { await deleteProjectSerial(PROJECT_ID, id); }
        catch (err) { showToast('Verwijderen mislukt: ' + err.message, 'danger'); return; }
      }
      _project.serialNumbers = (_project.serialNumbers || []).filter(x => x.id !== id);
      rerenderBlokD();
    });
  });

  // Serial photo view
  document.querySelectorAll('[data-serial-view]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const id = e.currentTarget.getAttribute('data-serial-view');
      const entry = (_project.serialNumbers || []).find(x => x.id === id);
      if (!entry || !entry.photoStoragePath) return;
      const url = await getSerialPhotoUrl(entry.photoStoragePath);
      if (url) window.open(url, '_blank');
    });
  });
}

function rerenderBlokD() {
  document.getElementById('blokD-slot').innerHTML = sectionBlokD();
  wireBlokD();
}

let _serialSaveTimer = null;
```

- [ ] **Step 9.2: Verifieer dat `renderPhotoGrid` op `#pePhotoGrid` werkt**

De bestaande `renderPhotoGrid()` op `project-edit.html:918` schrijft naar `document.getElementById('pePhotoGrid')`. De Blok D-template hierboven gebruikt dezelfde ID — dus geen wijziging nodig. Verifieer alleen dat het grid nog gevuld wordt na de restructure.

- [ ] **Step 9.3: Update `renderForm()` voor Blok D**

Vervang de `blokD-slot` placeholder:
```js
document.getElementById('blokD-slot').innerHTML = sectionBlokD();
wireBlokD();
```

- [ ] **Step 9.4: Zorg dat Blok D pas actief wordt als er een `PROJECT_ID` is**

Serial-photos en general-photos vereisen een bestaand project-doc in Firestore (anders bestaat `projects/{id}` niet om onder te uploaden). In new-project-mode:
- Blok D rendert wel, maar upload-buttons tonen een toast "Sla project eerst op".
- Serials mogen lokaal getypt worden (stash in `_project.serialNumbers`) en worden bij `createProject` mee-geüpload.

Update `createProject` call-site in de save-flow om `metadata.serialNumbers` mee te sturen:
```js
// In de create-path (nieuw project):
const createdRef = await createProject({
  projectName:  payload.projectName,
  customerName: payload.customerName,
  status:       payload.status,
  csvData:      _csvPending || null,
  metadata:     payload.metadata,  // bevat nu ook serialNumbers via mergeProjectMetadata
});
```

Zorg dat `collectFromForm` → `payload.metadata` ook `serialNumbers: _project.serialNumbers || []` bevat.

- [ ] **Step 9.5: Update `createProject` in `firebase-init.js` om `serialNumbers` te accepteren**

In `firebase-init.js:219-250` (`createProject`), voeg binnen het `if (metadata) {...}` blok toe:
```js
    if (Array.isArray(metadata.serialNumbers)) doc.serialNumbers = metadata.serialNumbers;
```

- [ ] **Step 9.6: Browser-verificatie**

Scenario 1 — bestaand project:
1. Open een bestaand project via dashboard.
2. Scroll naar Blok D.
3. Expect: photo-grid werkt zoals voorheen; camera en galerij knoppen zichtbaar.
4. Klik "Foto maken" op desktop → Expect: file-picker opent (capture wordt genegeerd op desktop).
5. Op mobiel (via tunnel/ngrok/DevTools device-emulation): klik "Foto maken" → Expect: camera opent.
6. In serienummer-sectie: typ "SN-001" in de lege trailing input → Expect: er verschijnt een nieuwe lege onderaan; de entry wordt opgeslagen.
7. Klik camera-icoon op de SN-001 rij, kies een foto → Expect: oogje verschijnt; klik oogje → opent in nieuw tab.
8. Klik × → confirm → Expect: rij verdwijnt; Firestore `serialNumbers` heeft nu N-1 entries.

Scenario 2 — nieuw project:
1. `project-edit.html?new=1`.
2. Vul klantnaam + omvormer-kW + CSV in. Voeg 2 serienummers toe (zonder foto's — project bestaat nog niet).
3. Klik Opslaan.
4. Expect: project wordt aangemaakt mét beide serienummers al aanwezig.
5. Heropen het project, voeg foto toe aan SN-001 → Expect: upload slaagt nu.

- [ ] **Step 9.7: Commit**

```bash
git add project-edit.html assets/js/firebase-init.js
git commit -m "feat(project-edit): implement Blok D — photos with camera capture + serial numbers list"
```

---

## Task 10: Sticky action bar + "Opslaan & Bereken" enabled-logica

**Doel:** Footer-bar die altijd in beeld blijft bij scrollen. "Opslaan & Bereken" is disabled tot alle 5 calc-vereisten vervuld zijn; tooltip lijst wat mist.

**Files:**
- Modify: `project-edit.html`

- [ ] **Step 10.1: Lokaliseer en vervang de huidige CTA-balk**

Zoek de huidige action-bar met Annuleren / Opslaan / Opslaan & Bereken (vermoedelijk rond regel 1050-1070). Vervang dat hele blok door:
```html
<div class="sticky-action-bar">
  <button type="button" id="btnCancel" class="btn btn-outline-secondary">Annuleren</button>
  <button type="button" id="btnSave"   class="btn btn-primary">Opslaan</button>
  <button type="button" id="btnSaveCalc" class="btn btn-success" disabled title="Vul eerst de benodigde velden in">
    <i class="fa-solid fa-calculator me-1"></i> Opslaan &amp; Bereken
  </button>
</div>
```

- [ ] **Step 10.2: Vervang `updateSaveCalcEnabled()` stub door echte implementatie**

Zoek de `function updateSaveCalcEnabled() { /* no-op ... */ }` stub uit Task 6 en vervang:
```js
function updateSaveCalcEnabled() {
  const missing = _missingCalcFields();
  const btn = document.getElementById('btnSaveCalc');
  if (!btn) return;
  btn.disabled = missing.length > 0;
  btn.title = missing.length === 0
    ? 'Alles aanwezig — klaar om te berekenen'
    : 'Nog ontbreekt: ' + missing.join(', ');
}

function _missingCalcFields() {
  const miss = [];
  if (!((_project.customerName || '').trim())) miss.push('klantnaam');
  const totalKw = ((_project.solar && _project.solar.inverters) || [])
    .reduce((s, i) => s + (Number(i.powerKw) || 0), 0);
  if (totalKw <= 0) miss.push('omvormer-vermogen');
  const site = _project.site || {};
  const cd   = _project.calcDefaults || {};
  if (site.houseAgeOver10Years == null && cd.btw == null) miss.push('BTW-tarief');
  const sup = _project.supplier || {};
  if (!(sup.priceDay > 0)) miss.push('prijs dag');
  if (sup.isSingleTariff === false && !(sup.priceNight > 0)) miss.push('prijs nacht');
  const hasCsv = _csvPending || (_project.csvUpload && _project.csvUpload.dailyCompact);
  if (!hasCsv) miss.push('CSV');
  return miss;
}
```

- [ ] **Step 10.3: Triggers voor `updateSaveCalcEnabled`**

Al gewired in Tasks 6 en 8 (kleine calls naar `updateSaveCalcEnabled()` na elke input). Voeg één initiële call toe op het einde van `renderForm()`:
```js
updateSaveCalcEnabled();
```

- [ ] **Step 10.4: Re-wire de drie buttons**

Zoek de oude event-listeners op `btnCancel`, `btnSave`, `btnSaveCalc` (de `addEventListener`-calls elders in het script). Laat die ongewijzigd — de button-id's zijn hetzelfde gebleven.

- [ ] **Step 10.5: Browser-verificatie**

1. `project-edit.html?new=1`.
2. Expect: sticky bar onderaan viewport zichtbaar bij scroll. "Opslaan & Bereken" disabled met tooltip "Nog ontbreekt: klantnaam, omvormer-vermogen, BTW-tarief, prijs dag, CSV".
3. Vul klantnaam → hover → Expect: "klantnaam" verdwijnt uit tooltip.
4. Vul alles behalve CSV → tooltip: "Nog ontbreekt: CSV".
5. Upload CSV → Expect: knop wordt enabled; tooltip: "Alles aanwezig — klaar om te berekenen".
6. Klik "Opslaan & Bereken" → Expect: project wordt opgeslagen en redirect naar `index.html?project=<id>#results`.
7. Scroll naar beneden in een lang project → Expect: sticky bar blijft in beeld.

- [ ] **Step 10.6: Commit**

```bash
git add project-edit.html
git commit -m "feat(project-edit): sticky action bar with enabled-when-calc-ready guard"
```

---

## Task 11: CLAUDE.md bijwerken

**Doel:** Documenteer de nieuwe 4-blokken-structuur, `getProjectLabel`, `serialNumbers`, en de sticky-bar-logica.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 11.1: Vervang de project-edit sectie**

Zoek in `CLAUDE.md` de alinea die begint met `**project-edit.html** —` en vervang door:
```markdown
- **`project-edit.html`** — nieuw-project creatie + bestaande-project metadata
  bewerken. Auth-gated. **4 blokken** (was 11 accordion-secties, herzien
  2026-04-22):
  - **Blok A · "Voor de berekening"** — altijd open bovenaan: klantnaam (required),
    projectnaam (optioneel), woning-leeftijd-radio (bepaalt BTW), tarief-type +
    prijs dag/nacht, totaal omvormer-kW (smart: single input als 0-1 omvormers,
    readonly sum + deeplink naar Blok C als 2+), CSV upload, en een
    disclosure `▸ Extra opties` voor BTW-override/keuring/leverancier-naam.
  - **Blok B · "Klant & situatie"** — status, adres, telefoon, e-mail,
    situatie-notitie, vrij notitieveld. Collapsible (voorkeur in
    `localStorage.smartpeak.editCardCollapsed`).
  - **Blok C · "Technische opmeting"** — aansluitingstype + zekering A,
    zekeringkast (modules/rem-automaat/wifi/stopcontact/batterij-plaats/fase-aarde),
    dynamische omvormer-detail-lijst (merk/model/panelen/kringen/ligging).
    Collapsible.
  - **Blok D · "Foto's & serienummers"** — algemene plaatsbezoek-foto's
    (met `capture="environment"` voor camera op mobile + aparte galerij-knop)
    en een dynamische serienummer-lijst: trailing-empty-input-patroon zoals
    config-picker; per gevulde entry optioneel een foto (`📷` knop).
  - **Sticky action bar** onderaan: "Opslaan & Bereken" is **disabled** tot alle
    5 calc-vereisten vervuld zijn (klantnaam, omvormer-kW > 0, BTW bepaalbaar,
    prijs dag > 0 (+ nacht als dual-tariff), CSV aanwezig); tooltip lijst wat
    mist. "Opslaan" alleen is altijd actief (partial saves blijven toegelaten).
  - Responsive grid: op `≥ lg` staan Blok B en C naast elkaar (2 col); op `< lg`
    alles gestapeld.
```

- [ ] **Step 11.2: Voeg paragraaf over projectnaam-fallback en serienummers toe**

Voeg onder de bestaande "Project-niveau metadata" paragraaf:
```markdown
**Project-label fallback (2026-04-22)** — `getProjectLabel(project)` in
`firebase-init.js` geeft `projectName || customerName || '(zonder naam)'`.
Alle UI-plekken (dashboard lijst/bord/drawer, project-edit page title,
index.html project-banner) gebruiken deze helper. `customerName` is nu het
enige harde-required tekstveld bij project-creatie; `projectName` is optioneel
en fungeert als override-label wanneer meerdere projecten voor dezelfde klant
bestaan.

**Serienummers (2026-04-22)** — `project.serialNumbers: Array<{id, value,
photoStoragePath?, uploadedAt?, uploadedBy?}>` top-level op het project-doc.
Helpers: `addProjectSerial`, `updateProjectSerial`, `deleteProjectSerial`,
`uploadProjectSerialPhoto`, `getSerialPhotoUrl`. Blobs in Storage onder
`projects/{id}/serials/{serialId}_{ts}.jpg` (gedekt door bestaande
`/projects/{id}/{allPaths=**}` rule). Barcode/OCR is out-of-scope; follow-up
spec na deze iteratie.
```

- [ ] **Step 11.3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document 4-block project-edit + getProjectLabel + serialNumbers"
```

---

## Task 12: End-to-end smoke test

**Doel:** Golden-path verification van de complete nieuwe flow.

- [ ] **Step 12.1: Start lokaal**

```bash
cd /home/ubuntu/battery-roi-tool
python3 -m http.server 8080
```

Open `http://localhost:8080/dashboard.html`, log in.

- [ ] **Step 12.2: Nieuw-project pad**

1. Klik "+ Nieuw project".
2. Vul enkel klantnaam "Smoke-test klant" in, klik Opslaan.
3. Expect: dashboard toont rij "Smoke-test klant".

- [ ] **Step 12.3: Bewerk-pad met enabled-logica**

1. Open het project via pen-icoon.
2. Expect: 4 blokken zichtbaar. Sticky bar onderaan. "Opslaan & Bereken" disabled.
3. Vul alle calc-vereisten: woning ≥ 10j, dag/nacht @ 0.35/0.20, omvormer 5 kW, upload Fluvius CSV.
4. Expect: "Opslaan & Bereken" wordt enabled.
5. Voeg 3 serienummers toe: "SN-001", "SN-002", "SN-003".
6. Expect: 3 rijen + 1 trailing lege row. Klik × op SN-002. Expect: 2 rijen + trailing.
7. Voeg foto toe aan SN-001. Expect: oogje verschijnt; klik oogje → opent foto in nieuw tab.
8. Vul adres/tel/email in Blok B, aansluiting + zekeringkast + 2e omvormer in Blok C.
9. Expect: Blok A toont nu "Totaal 8 kW — som van 2 omvormers" readonly.

- [ ] **Step 12.4: Save & Calculate**

1. Klik "Opslaan & Bereken".
2. Expect: redirect naar `index.html?project=<id>#results`.
3. Expect: page title toont "Smoke-test klant" (fallback want projectnaam leeg).
4. Resultaten worden gegenereerd uit CSV + 8 kW totaal omvormer.

- [ ] **Step 12.5: Dashboard-consistency**

1. Terug naar dashboard.
2. Expect: project toont "Smoke-test klant" als label in lijst, bord en drawer.
3. Open drawer, bevestig dat alle contactgegevens kloppen.

- [ ] **Step 12.6: Mobile camera (indien mogelijk)**

1. Open dev-tools device emulation (iPhone/Android).
2. Hard refresh.
3. Ga naar Blok D, klik "Foto maken".
4. Expect: browser vraagt om camera-toegang. (Emulation zal vaak een placeholder-camera tonen; op echt device opent de camera.)

- [ ] **Step 12.7: Cleanup-commit (optioneel)**

Als er tijdens de smoke-test kleine polish-items naar boven kwamen (typo, padding), fix + commit. Anders:

```bash
echo "Smoke test OK — geen extra commits"
```

---

## Uitvoeringsvolgorde en afhankelijkheden

- **Task 1, 2, 3** zijn onafhankelijk; kunnen in elke volgorde (1 is het simpelst om mee te starten).
- **Task 4** (CSS) is passive — moet vóór Task 5 gecommit zijn anders crashen selectors.
- **Task 5** legt de shell neer — **pre-requisite voor 6-10**.
- **Tasks 6, 7, 8, 9** zijn strikt onafhankelijk zolang Task 5 gecommit is; kunnen parallel of in elke volgorde worden gedaan.
- **Task 10** heeft handlers nodig uit Tasks 6 en 8 (`updateSaveCalcEnabled` wordt door beide aangeroepen — de stub uit Task 6.5 zorgt voor graceful no-op tot Task 10 de echte implementatie landt).
- **Task 11** (CLAUDE.md) pas ná Tasks 1-10.
- **Task 12** is de eindtest, altijd laatst.

## Rollback-plan

Elke task commit is atomic en reverteerbaar via `git revert <sha>`. Als een
block-migratie (Task 6-9) een onverwacht probleem oplevert, revert die ene
commit; de `section*()`-functies van de oude accordion zijn tot Task 10 nog
intact in het bestand en kunnen als fallback hergebruikt worden.

## Post-iteratie — follow-up spec

Na deze implementatie een aparte spec schrijven voor:
- **Barcode/OCR op serienummer-foto's** — `BarcodeDetector` API client-side,
  met fallback via een Cloud Function. Het datamodel is al ready
  (`photoStoragePath` + `value` in dezelfde entry).
