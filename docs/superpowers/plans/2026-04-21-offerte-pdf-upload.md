# Offerte PDF Upload + Font Awesome Migratie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg een per-config offerte-PDF upload-flow toe aan de dashboard-drawer, met soft-dismiss/hard-delete-met-PDF semantiek en een warning in offerte-fase. Rol gelijktijdig Font Awesome 6 uit over de hele app zodat bestaande emoji-iconen en de nieuwe offerte-iconen één consistente stijl hebben.

**Architecture:** Nieuwe `offertes` map + `dismissedConfigs` array op het `projects/{id}` Firestore-doc; PDFs in Firebase Storage onder `projects/{id}/offertes/{type}_{ts}.pdf`. Eerste modal in de codebase (generieke basis herbruikbaar). FA 6 Free via cdnjs, enkel `solid`-stijl. Calculator (`index.html`) blijft pure berekening; alle offerte-UI leeft in de drawer.

**Tech Stack:** Firebase v10 compat SDK (Firestore + Storage), vanilla HTML/CSS/JS (geen build step), Font Awesome 6.5.2 Free.

**Spec:** `docs/superpowers/specs/2026-04-21-offerte-pdf-upload-design.md`

**Note on testing:** De repo heeft geen automated tests. "Run test" stappen vervangen we door manuele verificatiestappen (browser-reload, DevTools, Firebase console). Frequente commits per task.

---

## File Structure Overview

| Bestand | Responsibility |
|---|---|
| `assets/js/firebase-init.js` | Offerte-helpers + predicate + `mergeProjectMetadata` defaults |
| `dashboard.html` | FA CDN + icoon-migratie + modal infrastructure + offerte-modal + drawer-rij upgrade + warning-banner + warning-row-icoon |
| `project-edit.html` | FA CDN + icoon-migratie (geen offerte-UI) |
| `index.html` | FA CDN + icoon-migratie (geen offerte-UI) |
| `storage.rules` (Firebase console) | Nieuwe match voor `projects/{id}/offertes/**` |
| `CLAUDE.md` | Documentatie-update na feature complete |

---

## Task 1: Font Awesome CDN + icon-color CSS (alle 3 pages)

**Files:**
- Modify: `dashboard.html` (head + style)
- Modify: `project-edit.html` (head + style)
- Modify: `index.html` (head + style)

- [ ] **Step 1: Add FA CDN link to `dashboard.html` `<head>`**

Plaats direct na de bestaande `<meta>` / vóór de `<title>`:

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A==" crossorigin="anonymous" referrerpolicy="no-referrer" />
```

Verify integrity-hash corresponds to 6.5.2 `all.min.css` — cdnjs shows current SRI on the page. If the hash is different, copy the current one from cdnjs.com/libraries/font-awesome/6.5.2.

- [ ] **Step 2: Add same FA CDN link to `project-edit.html` `<head>`**

Identical line as Step 1.

- [ ] **Step 3: Add same FA CDN link to `index.html` `<head>`**

Identical line as Step 1.

- [ ] **Step 4: Add icon-color CSS helpers to `dashboard.html` `<style>`**

Append near other utility classes (look for existing `.row-warning` or alert colors — add above them):

```css
.icon-ok    { color: #16a34a; }
.icon-warn  { color: #f59e0b; }
.icon-danger{ color: #dc2626; }
```

- [ ] **Step 5: Repeat icon-color CSS in `project-edit.html` `<style>`**

Identical three rules.

- [ ] **Step 6: Repeat icon-color CSS in `index.html` `<style>`**

Identical three rules.

- [ ] **Step 7: Manual verify**

Open elk van de 3 pages, check network tab: `all.min.css` laadt 200. In DevTools console run `getComputedStyle(document.body).getPropertyValue('font-family')` — niet relevant, maar check dat er geen CSP-errors zijn. Tijdelijk toevoegen `<i class="fa-solid fa-check"></i>` in een sectie om te bevestigen dat de iconen renderen; daarna weghalen.

- [ ] **Step 8: Commit**

```bash
git add dashboard.html project-edit.html index.html
git commit -m "assets: load Font Awesome 6.5.2 + icon-color helpers"
```

---

## Task 2: Emoji → Font Awesome migratie in `dashboard.html`

**Files:**
- Modify: `dashboard.html` (alle regels uit onderstaande tabel)

**Scope rule:** UI-iconen (knoppen, indicators, section-headers) → FA. Tekst in toasts / textContent-strings blijft emoji (spec: "Emoji's in copy blijven emoji"). Tabel hieronder lijst ENKEL UI-iconen.

| Lijn | Huidig | Vervangen door | Opmerking |
|---|---|---|---|
| 446 | `<h1>⚡ SmartPeak — Projecten</h1>` | `<h1><i class="fa-solid fa-bolt" aria-hidden="true"></i> SmartPeak — Projecten</h1>` | brand |
| 454 | `<h1>⚠️ Geen toegang</h1>` | `<h1><i class="fa-solid fa-triangle-exclamation icon-danger" aria-hidden="true"></i> Geen toegang</h1>` | |
| 462 | `<h1>⚡ SmartPeak — Projecten</h1>` | `<h1><i class="fa-solid fa-bolt" aria-hidden="true"></i> SmartPeak — Projecten</h1>` | duplicaat van 446 |
| 481 | `>📋 Lijst<` | `><i class="fa-solid fa-list" aria-hidden="true"></i> Lijst<` | |
| 482 | `>🗂 Bord<` | `><i class="fa-solid fa-table-columns" aria-hidden="true"></i> Bord<` | |
| 595 | `<span style="margin-left:auto;color:var(--muted);">✓</span>` | `<span style="margin-left:auto;color:var(--muted);"><i class="fa-solid fa-check" aria-hidden="true"></i></span>` | |
| 630 | `title="Bewerken">✏️</button>` | `title="Bewerken"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i></button>` | |
| 632 | `title="Open berekening">🧮</button>` | `title="Open berekening"><i class="fa-solid fa-calculator" aria-hidden="true"></i></button>` | |
| 635 | `title="Herstellen">↶</button>` | `title="Herstellen"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>` | |
| 636 | `title="Definitief verwijderen">❌</button>` | `title="Definitief verwijderen"><i class="fa-solid fa-circle-xmark icon-danger" aria-hidden="true"></i></button>` | |
| 637 | `title="Verwijderen">🗑️</button>` | `title="Verwijderen"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>` | |
| 640 | `...'Opmerkingen aanwezig'}">💬</span>` | `...'Opmerkingen aanwezig'}"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i></span>` | |
| 643 | `...Zet de vink in het project zodra gemeten.">❗</span>` | `...Zet de vink in het project zodra gemeten."><i class="fa-solid fa-triangle-exclamation icon-danger" aria-hidden="true"></i></span>` | |
| 758 | `...'Opmerkingen aanwezig'}">💬</span>` | idem als 640 | board view |
| 761 | `title="Controleer fase↔aarde meting bij Zendure (&lt; 30 V).">❗</span>` | `...><i class="fa-solid fa-triangle-exclamation icon-danger" aria-hidden="true"></i></span>` | |
| 954 | `<div class="alert alert-warning" style="margin-bottom:14px;">⚠️ <div>` | `<div class="alert alert-warning" style="margin-bottom:14px;"><i class="fa-solid fa-triangle-exclamation icon-warn" aria-hidden="true"></i> <div>` | |
| 955 | `vink aan in ✏ Bewerk project` | `vink aan in <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Bewerk project` | text ref to button |
| 976 | `>🧮 Open berekening</a>` | `><i class="fa-solid fa-calculator" aria-hidden="true"></i> Open berekening</a>` | |
| 977 | `>✏ Bewerk project</a>` | `><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Bewerk project</a>` | |
| 978 | `>🗑 Verwijderen</button>` | `><i class="fa-solid fa-trash" aria-hidden="true"></i> Verwijderen</button>` | |
| 1006 | `<h3>📷 Foto's <span` | `<h3><i class="fa-solid fa-images" aria-hidden="true"></i> Foto's <span` | |
| 1019 | `<h3>💬 Opmerkingen <span` | `<h3><i class="fa-solid fa-comments" aria-hidden="true"></i> Opmerkingen <span` | |
| 1152 | `title="Verwijder foto">🗑</button>` | `title="Verwijder foto"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>` | |

**LET OP — regelnummers verschuiven tijdens edits.** Gebruik unieke string-context bij elke Edit-call (bv. het volledige element) ipv enkel het regelnummer, zodat Edit niet verkeerd matcht.

- [ ] **Step 1: Pas de 24 regels aan zoals in de tabel hierboven**

Doe ze één voor één met de Edit tool — elk `old_string` moet uniek zijn binnen het bestand (voeg context toe wanneer nodig, bv. voor de twee 💬-chat-indicators).

- [ ] **Step 2: Manueel verificeren**

1. Reload `dashboard.html` in ingelogde sessie.
2. Project-lijst: check dat elke rij de FA-iconen toont (pen-to-square, calculator, trash) in plaats van emoji's; ground-fault rij toont rood driehoek-icoon.
3. Toolbar: Lijst-knop toont list-icoon, Bord-knop toont table-columns-icoon.
4. Open een project-drawer: action-knoppen tonen FA-iconen; als project ground-fault issue heeft, alert banner bovenaan toont rood driehoek.
5. Open Foto-lightbox: delete-knop toont trash-icoon.
6. Status-popover: actieve status toont check-icoon.
7. Geen resterende emoji's in UI (toast-messages mogen emoji's tonen, dat is copy).

- [ ] **Step 3: Commit**

```bash
git add dashboard.html
git commit -m "dashboard: migrate emoji UI icons to Font Awesome"
```

---

## Task 3: Emoji → Font Awesome migratie in `project-edit.html`

**Files:**
- Modify: `project-edit.html`

**Speciaal: de dynamic `#pageTitle`** — JS overschrijft `document.getElementById('pageTitle').textContent = '⚡ Nieuw project'` (L291) en idem `'✏ ' + naam` (L300). Na migratie moet JS innerHTML zetten (niet textContent) zodat de FA `<i>` rendert; het naam-gedeelte wordt apart geëscaped.

| Lijn | Huidig | Vervangen door |
|---|---|---|
| 184 | `<h1>⚡ SmartPeak — Project bewerken</h1>` | `<h1><i class="fa-solid fa-bolt" aria-hidden="true"></i> SmartPeak — Project bewerken</h1>` |
| 192 | `<h1>⚠️ Geen toegang</h1>` | `<h1><i class="fa-solid fa-triangle-exclamation icon-danger" aria-hidden="true"></i> Geen toegang</h1>` |
| 200 | `<h1 id="pageTitle">⚡ Nieuw project</h1>` | `<h1 id="pageTitle"><i class="fa-solid fa-bolt" aria-hidden="true"></i> Nieuw project</h1>` |
| 291 | `document.getElementById('pageTitle').textContent = '⚡ Nieuw project';` | `document.getElementById('pageTitle').innerHTML = '<i class="fa-solid fa-bolt" aria-hidden="true"></i> Nieuw project';` |
| 300 | `document.getElementById('pageTitle').textContent = '✏ ' + (proj.projectName || 'Project');` | `document.getElementById('pageTitle').innerHTML = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> ' + escapeHtml(proj.projectName || 'Project');` |
| 341 | `<summary>📝 Basisgegevens</summary>` | `<summary><i class="fa-solid fa-id-card" aria-hidden="true"></i> Basisgegevens</summary>` |
| 406 | `<summary>📝 Situatie &amp; notities</summary>` | `<summary><i class="fa-solid fa-note-sticky" aria-hidden="true"></i> Situatie &amp; notities</summary>` |
| 437 | `<summary>💡 Leverancier &amp; tarieven</summary>` | `<summary><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> Leverancier &amp; tarieven</summary>` |
| 496 | `<summary>🏠 Woning</summary>` | `<summary><i class="fa-solid fa-house" aria-hidden="true"></i> Woning</summary>` |
| 553 | `<summary>🔌 Elektrische aansluiting</summary>` | `<summary><i class="fa-solid fa-plug" aria-hidden="true"></i> Elektrische aansluiting</summary>` |
| 612 | `<summary>🗄 Zekeringkast</summary>` | `<summary><i class="fa-solid fa-server" aria-hidden="true"></i> Zekeringkast</summary>` |
| 671 | `>🗑 Verwijderen</button>` | `><i class="fa-solid fa-trash" aria-hidden="true"></i> Verwijderen</button>` |
| 709 | `<summary>☀ Zonnepanelen &amp; omvormer(s)</summary>` | `<summary><i class="fa-solid fa-solar-panel" aria-hidden="true"></i> Zonnepanelen &amp; omvormer(s)</summary>` |
| 766 | `<summary>🧮 Voorkeuren berekening</summary>` | `<summary><i class="fa-solid fa-calculator" aria-hidden="true"></i> Voorkeuren berekening</summary>` |
| 793 | `<summary>📷 Foto's</summary>` | `<summary><i class="fa-solid fa-images" aria-hidden="true"></i> Foto's</summary>` |
| 802 | `<summary>📷 Foto's <span` | `<summary><i class="fa-solid fa-images" aria-hidden="true"></i> Foto's <span` |
| 808 | `📂 <strong>Sleep foto's hier</strong>` | `<i class="fa-solid fa-folder-open" aria-hidden="true"></i> <strong>Sleep foto's hier</strong>` |
| 926 | `title="Verwijder foto">🗑</button>` | `title="Verwijder foto"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>` |
| 978 | `<p class="help">📁 <strong>${escapeHtml(cu.eanCode` | `<p class="help"><i class="fa-solid fa-file-lines" aria-hidden="true"></i> <strong>${escapeHtml(cu.eanCode` |
| 981 | `<p class="help">📁 Nieuwe CSV klaar` | `<p class="help"><i class="fa-solid fa-file-lines" aria-hidden="true"></i> Nieuwe CSV klaar` |
| 985 | `<summary>📊 Verbruikshistoriek (CSV)</summary>` | `<summary><i class="fa-solid fa-chart-line" aria-hidden="true"></i> Verbruikshistoriek (CSV)</summary>` |

- [ ] **Step 1: Pas de 21 regels aan zoals in de tabel**

Idem als Task 2: gebruik unieke context strings bij de Edit-calls.

- [ ] **Step 2: Manueel verificeren**

1. `project-edit.html?new=1` → titel toont bolt-icoon + "Nieuw project".
2. Elk section-summary element toont eigen FA-icoon.
3. Open bestaand project via `?project=<id>` → titel toont pen-to-square + projectnaam.
4. Omvormer-lijst: verwijder-knop toont trash-icoon.
5. Foto's drag-drop zone toont folder-open icoon; upload werkt nog; lightbox delete-knop = trash-icoon.
6. CSV-sectie: help-regel toont file-lines-icoon; summary = chart-line.

- [ ] **Step 3: Commit**

```bash
git add project-edit.html
git commit -m "project-edit: migrate emoji UI icons to Font Awesome"
```

---

## Task 4: Emoji → Font Awesome migratie in `index.html`

**Files:**
- Modify: `index.html`

**Scope:** alleen UI in markup (`<h2>`, alerts, badges in `innerHTML = \`...\`` template strings). Laat staan: `statusEl.textContent = '✅ ...'` (copy), `showToast('💾 …')` (copy), `badge-orange` label `'⚠️ Worst Case'` (copy inside badge), en comment op L2440.

| Lijn | Huidig | Vervangen door |
|---|---|---|
| 615 | `<h2 style="margin:0;"><span class="icon">📋</span> Projectgegevens</h2>` | `<h2 style="margin:0;"><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i> Projectgegevens</h2>` |
| 616 | `>✏ Aanpassen</button>` | `><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Aanpassen</button>` |
| 627 | `<h2><span class="icon">📂</span> Verbruikshistoriek uploaden</h2>` | `<h2><i class="fa-solid fa-folder-open" aria-hidden="true"></i> Verbruikshistoriek uploaden</h2>` |
| 734 | `<h2><span class="icon">💾</span> Bewaar / Deel resultaten</h2>` | `<h2><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Bewaar / Deel resultaten</h2>` |
| 981 | `<h2><span class="icon">📊</span> Afname &amp; Injectie over tijd</h2><div class="alert alert-warning">⚠️` | `<h2><i class="fa-solid fa-chart-line" aria-hidden="true"></i> Afname &amp; Injectie over tijd</h2><div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation icon-warn" aria-hidden="true"></i>` |
| 1722 | `<div class="alert alert-warning">⚠️ <div>` | `<div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation icon-warn" aria-hidden="true"></i> <div>` |
| 1730 | `<div class="alert alert-info">ℹ️ <div>` | `<div class="alert alert-info"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> <div>` |
| 1735 | `let scenAlert = \`<div class="alert alert-info">ℹ️ <div>` | `let scenAlert = \`<div class="alert alert-info"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> <div>` |
| 1741 | `scenAlert += \`<div class="alert alert-warning">⚠️ <div>` | `scenAlert += \`<div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation icon-warn" aria-hidden="true"></i> <div>` |
| 2117 | `<div class="alert alert-warning">⚠️ <div>` | idem als 1722 |
| 2123 | `<div class="alert alert-info" style="margin-bottom:12px;">ℹ️ <div>` | idem info-icoon patroon |
| 2126 | `ℹ️ <div>Analyse bij` | `<i class="fa-solid fa-circle-info" aria-hidden="true"></i> <div>Analyse bij` |
| 2150 | `<div class="alert alert-success" style="margin-top:14px;">✅ <div>` | `<div class="alert alert-success" style="margin-top:14px;"><i class="fa-solid fa-circle-check icon-ok" aria-hidden="true"></i> <div>` |
| 2180 | `<div class="alert alert-error">❌ Deellink niet geldig` | `<div class="alert alert-error"><i class="fa-solid fa-circle-xmark icon-danger" aria-hidden="true"></i> Deellink niet geldig` |
| 2406 | `'Nog in te vullen vóór Bereken: ' + missing.join(', ') + '. Vul in hieronder of via ✏ Aanpassen.'` | **laten staan** (textContent copy; emoji OK) |
| 2521 | `<span style="margin-left:auto;color:var(--muted);">✓</span>` | `<span style="margin-left:auto;color:var(--muted);"><i class="fa-solid fa-check" aria-hidden="true"></i></span>` |

- [ ] **Step 1: Pas de 15 regels aan zoals in de tabel**

Meerdere `alert alert-warning">⚠️ <div>` matches zijn identiek; gebruik `replace_all: true` op die ene pattern wanneer alle voorkomens dezelfde vervanging krijgen. Voor `alert alert-info">ℹ️ <div>` idem. Overige met unieke context.

- [ ] **Step 2: Manueel verificeren**

1. Open `index.html?project=<id>` → "Projectgegevens" kaart toont clipboard-list icoon + pen-to-square op de Aanpassen knop.
2. "Verbruikshistoriek uploaden" h2 → folder-open.
3. "Bewaar / Deel resultaten" h2 → floppy-disk.
4. Upload een CSV, klik Bereken → resultaat-alerts tonen FA-iconen (info = circle-info, warning = triangle-exclamation, success = circle-check).
5. "Afname & Injectie over tijd" h2 → chart-line.
6. Status-popover: actieve status toont check.
7. Open een ongeldige `?s=<id>` share-URL → error-alert toont circle-xmark rood.
8. Toast-messages blijven emoji (geen regressie).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "index: migrate emoji UI icons to Font Awesome"
```

---

## Task 5: Firestore helpers + predicate + `mergeProjectMetadata` defaults

**Files:**
- Modify: `assets/js/firebase-init.js`

- [ ] **Step 1: Extend `mergeProjectMetadata` met offerte-defaults**

Zoek de bestaande `mergeProjectMetadata` functie in `firebase-init.js`. Voeg aan het einde, vóór `return project`:

```js
  project.offertes         = project.offertes         || {};
  project.dismissedConfigs = Array.isArray(project.dismissedConfigs)
                               ? project.dismissedConfigs : [];
```

- [ ] **Step 2: Voeg `uploadProjectOfferte` helper toe**

Naast `uploadProjectPhoto` plaatsen. Neem Storage + Firestore imports uit de bestaande scope.

```js
async function uploadProjectOfferte(projectId, configType, file) {
  if (!file) throw new Error('Geen bestand opgegeven');
  if (file.type !== 'application/pdf') throw new Error('Enkel PDF-bestanden worden aanvaard');
  if (file.size > 10 * 1024 * 1024) throw new Error('PDF is groter dan 10 MB');

  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Niet ingelogd');

  const ts = Date.now();
  const safeType = String(configType).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `projects/${projectId}/offertes/${safeType}_${ts}.pdf`;

  // Haal eventueel bestaande blob op om te deleten na succesvolle upload
  const projRef = firebase.firestore().collection('projects').doc(projectId);
  const projSnap = await projRef.get();
  const existing = (projSnap.data() || {}).offertes || {};
  const oldEntry = existing[configType];

  // Upload nieuwe blob
  const ref = firebase.storage().ref(storagePath);
  const snapshot = await ref.put(file, { contentType: 'application/pdf' });

  const metadata = {
    storagePath,
    filename:   file.name,
    sizeBytes:  file.size,
    contentType:'application/pdf',
    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    uploadedBy: user.email || null
  };

  // Firestore swap
  await projRef.update({
    [`offertes.${configType}`]: metadata,
    dismissedConfigs: firebase.firestore.FieldValue.arrayRemove(configType),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Oude blob verwijderen (na succesvolle Firestore-swap zodat een crash midden-in niet de nieuwe PDF weggooit)
  if (oldEntry && oldEntry.storagePath && oldEntry.storagePath !== storagePath) {
    try {
      await firebase.storage().ref(oldEntry.storagePath).delete();
    } catch (err) {
      console.warn('Vorige offerte blob niet gevonden of delete-fout:', err);
    }
  }

  return metadata;
}
```

**Note:** `dismissedConfigs: arrayRemove(configType)` impliciet restore — als user een dismissed config toch uploadt, verschijnt hij meteen actief.

- [ ] **Step 3: Voeg `deleteProjectOfferte` helper toe**

```js
async function deleteProjectOfferte(projectId, configType) {
  const projRef = firebase.firestore().collection('projects').doc(projectId);
  const projSnap = await projRef.get();
  const existing = (projSnap.data() || {}).offertes || {};
  const entry = existing[configType];
  if (!entry) return;

  try {
    if (entry.storagePath) await firebase.storage().ref(entry.storagePath).delete();
  } catch (err) {
    console.warn('Storage delete faalde (blob mogelijk al weg):', err);
  }

  await projRef.update({
    [`offertes.${configType}`]: firebase.firestore.FieldValue.delete(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}
```

- [ ] **Step 4: Voeg `hardDeleteProjectConfig` helper toe (cascade voor dismiss-met-PDF)**

```js
async function hardDeleteProjectConfig(projectId, configType) {
  // 1. Blob + map-entry weg (reuse deleteProjectOfferte)
  await deleteProjectOfferte(projectId, configType);

  // 2. Type uit lastCalcRun.inputs.selectedConfigTypes halen
  const projRef = firebase.firestore().collection('projects').doc(projectId);
  const snap = await projRef.get();
  const data = snap.data() || {};
  const types = (data.lastCalcRun && data.lastCalcRun.inputs && Array.isArray(data.lastCalcRun.inputs.selectedConfigTypes))
    ? data.lastCalcRun.inputs.selectedConfigTypes.filter(t => t !== configType)
    : [];

  // 3. Ook uit dismissedConfigs (defensief — mocht hij per ongeluk in beide staan)
  await projRef.update({
    'lastCalcRun.inputs.selectedConfigTypes': types,
    dismissedConfigs: firebase.firestore.FieldValue.arrayRemove(configType),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}
```

- [ ] **Step 5: Voeg `dismissProjectConfig` + `restoreProjectConfig` helpers toe**

```js
async function dismissProjectConfig(projectId, configType) {
  const projRef = firebase.firestore().collection('projects').doc(projectId);
  await projRef.update({
    dismissedConfigs: firebase.firestore.FieldValue.arrayUnion(configType),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function restoreProjectConfig(projectId, configType) {
  const projRef = firebase.firestore().collection('projects').doc(projectId);
  await projRef.update({
    dismissedConfigs: firebase.firestore.FieldValue.arrayRemove(configType),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}
```

- [ ] **Step 6: Voeg `needsOfferteWarning` predicate toe**

Naast `needsGroundFaultCheck`:

```js
function needsOfferteWarning(project) {
  if (!project) return false;
  if (typeof phaseForStatus !== 'function') return false;
  if (phaseForStatus(project.status) !== 'offerte') return false;

  const types = (project.lastCalcRun && project.lastCalcRun.inputs && Array.isArray(project.lastCalcRun.inputs.selectedConfigTypes))
    ? project.lastCalcRun.inputs.selectedConfigTypes
    : [];
  const offertes = project.offertes || {};
  const dismissed = new Set(Array.isArray(project.dismissedConfigs) ? project.dismissedConfigs : []);
  return types.some(t => !dismissed.has(t) && !offertes[t]);
}
```

- [ ] **Step 7: Exports bijwerken**

Indien `firebase-init.js` via `window.<naam>` exports of een global namespace werkt (bekijk het bestaande patroon rond `uploadProjectPhoto`), voeg dezelfde exports voor de 6 nieuwe functies + `needsOfferteWarning` toe.

- [ ] **Step 8: Manueel verificeren (console-based)**

1. Open `dashboard.html` met een bestaand project in DevTools console:
   ```js
   const pid = '<echt project id uit de lijst>';
   // Defaults
   firebase.firestore().collection('projects').doc(pid).get().then(s => console.log(mergeProjectMetadata(s.data())));
   // Verwacht: `offertes: {}` en `dismissedConfigs: []` op oudere projects.
   ```
2. Test dismiss + restore:
   ```js
   await dismissProjectConfig(pid, 'DUMMYTYPE');
   // Check Firestore console: dismissedConfigs bevat "DUMMYTYPE".
   await restoreProjectConfig(pid, 'DUMMYTYPE');
   // Check: weg.
   ```
3. `needsOfferteWarning`:
   ```js
   const data = (await firebase.firestore().collection('projects').doc(pid).get()).data();
   console.log(needsOfferteWarning(mergeProjectMetadata(data)));
   ```

- [ ] **Step 9: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "firebase-init: offerte helpers + needsOfferteWarning predicate + defaults"
```

---

## Task 6: Storage rule voor offertes pad

**Files:**
- Modify: Firebase Storage rules (in Firebase console OR `storage.rules` als er een file-gebaseerde deploy is — check `firebase.json`)

- [ ] **Step 1: Check of rules in-repo leven**

```bash
ls /home/ubuntu/battery-roi-tool/storage.rules 2>/dev/null
cat /home/ubuntu/battery-roi-tool/firebase.json 2>/dev/null
```

Als er geen `storage.rules` file is → de rules leven enkel in Firebase console; patch daar manueel.

- [ ] **Step 2: Voeg de offerte-rule toe**

Binnen de bestaande `service firebase.storage { match /b/{bucket}/o { ... } }` block, naast de photos-rule:

```
match /projects/{projectId}/offertes/{allPaths=**} {
  allow read, write: if isWhitelisted();
}
```

Waar `isWhitelisted()` de bestaande helper is die in dezelfde file/rules al gebruikt wordt voor de photos-rule. Zoek de photos-rule en mirror de auth check letterlijk.

- [ ] **Step 3: Publish**

Indien file-gebaseerd: `firebase deploy --only storage`. Indien console: klik Publish.

- [ ] **Step 4: Manueel verificeren**

1. In DevTools, ingelogd: `firebase.storage().ref('projects/<pid>/offertes/test.pdf').getDownloadURL()` voor een pad dat nog niet bestaat → moet `object-not-found` error geven (NIET `permission-denied`).
2. Uitloggen, opnieuw proberen → `permission-denied`.

- [ ] **Step 5: Commit (alleen als rules in-repo leven)**

```bash
git add storage.rules
git commit -m "storage: allow whitelisted read/write on projects/*/offertes/**"
```

Anders skip; console-only changes worden niet gecommit.

---

## Task 7: Generic modal infrastructure in `dashboard.html`

**Files:**
- Modify: `dashboard.html` (CSS + markup + JS helpers)

- [ ] **Step 1: Voeg modal CSS toe (in `<style>` van `dashboard.html`)**

Plaats na de drawer-CSS:

```css
/* generic modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.45);
  display: none; align-items: center; justify-content: center;
  z-index: 200;
  padding: 20px;
}
.modal-overlay.open { display: flex; }
.modal-dialog {
  background: #fff; border-radius: 10px;
  max-width: 520px; width: 100%;
  max-height: 90vh; overflow: auto;
  box-shadow: 0 10px 40px rgba(0,0,0,.25);
  padding: 0;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--border, #e5e7eb);
}
.modal-header h3 { margin: 0; font-size: 1.05rem; }
.modal-close-btn {
  background: transparent; border: 0; font-size: 1.2rem;
  cursor: pointer; color: var(--muted, #6b7280);
}
.modal-body { padding: 16px; }
.modal-footer {
  padding: 12px 16px; border-top: 1px solid var(--border, #e5e7eb);
  display: flex; justify-content: flex-end; gap: 8px;
}
```

- [ ] **Step 2: Voeg modal-markup container toe (einde van `<body>`, vóór de sluitende `</body>`)**

```html
<div class="modal-overlay" id="offerteModal" role="dialog" aria-modal="true" aria-hidden="true">
  <div class="modal-dialog" role="document">
    <div class="modal-header">
      <h3 id="offerteModalTitle">Offerte uploaden</h3>
      <button type="button" class="modal-close-btn" id="offerteModalClose" title="Sluiten">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
    <div class="modal-body" id="offerteModalBody">
      <!-- dynamisch ingevuld in Task 8 -->
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" id="offerteModalCancel">Annuleren</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Voeg generieke open/close helpers toe (in het bestaande `<script>` blok)**

```js
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  document.addEventListener('keydown', _modalEscHandler);
}
function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  document.removeEventListener('keydown', _modalEscHandler);
}
function _modalEscHandler(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
}
// click-outside
document.getElementById('offerteModal').addEventListener('click', (e) => {
  if (e.target.id === 'offerteModal') closeModal('offerteModal');
});
document.getElementById('offerteModalClose').addEventListener('click', () => closeModal('offerteModal'));
document.getElementById('offerteModalCancel').addEventListener('click', () => closeModal('offerteModal'));
```

- [ ] **Step 4: Manueel verificeren**

1. Reload dashboard. In DevTools console: `openModal('offerteModal')` → overlay verschijnt, body leeg.
2. Klik buiten dialog → sluit.
3. Heropen, klik X → sluit.
4. Heropen, druk Escape → sluit.

- [ ] **Step 5: Commit**

```bash
git add dashboard.html
git commit -m "dashboard: generic modal infrastructure + offerte-modal container"
```

---

## Task 8: Offerte-modal content + drag-drop + upload-integration

**Files:**
- Modify: `dashboard.html` (JS)

De modal container bestaat al na Task 7. Hier vullen we de body dynamisch + drag-drop handler.

- [ ] **Step 1: Voeg een `openOfferteModal(project, configType)` functie toe**

```js
async function openOfferteModal(project, configType) {
  const body = document.getElementById('offerteModalBody');
  const cfg  = _findConfigByType(project, configType);     // helper in Step 2
  const existing = (project.offertes || {})[configType];

  body.innerHTML = `
    <div class="offerte-cfg-header">
      <div class="offerte-cfg-type">${escapeHtml(cfg.type)} · ${escapeHtml(cfg.omschrijving || '')}</div>
      <div class="offerte-cfg-meta" style="color:var(--muted);font-size:.9rem;">
        ${cfg.capaciteit ? escapeHtml(cfg.capaciteit) + ' kWh · ' : ''}${cfg.inverterKw ? escapeHtml(cfg.inverterKw) + ' kW omvormer · ' : ''}€ ${_formatEuros(cfg.priceEur)}
      </div>
    </div>

    ${existing ? `
      <div class="offerte-existing" style="margin:12px 0;padding:10px;background:#f8fafc;border-radius:6px;">
        <div><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> <strong>${escapeHtml(existing.filename)}</strong></div>
        <div style="color:var(--muted);font-size:.85rem;">
          Geüpload door ${escapeHtml(existing.uploadedBy || 'onbekend')}
          ${existing.uploadedAt && existing.uploadedAt.toDate ? ' op ' + _formatDate(existing.uploadedAt.toDate()) : ''}
        </div>
      </div>
    ` : ''}

    <div class="drop-zone" id="offerteDropZone">
      <input type="file" accept="application/pdf" id="offerteFileInput" hidden />
      <div class="drop-zone-text">
        ${existing ? 'Sleep nieuwe PDF om te vervangen' : 'Sleep offerte PDF hier'} <br/>
        <span style="color:var(--muted);font-size:.9rem;">of klik om te kiezen</span>
      </div>
    </div>
    <div id="offerteUploadError" style="color:var(--danger,#dc2626);margin-top:8px;display:none;"></div>
    <div id="offerteUploadProgress" style="margin-top:8px;display:none;">Uploaden… <span>0%</span></div>
  `;

  _bindOfferteDropZone(project.id, configType);
  openModal('offerteModal');
}
```

- [ ] **Step 2: Voeg helpers `_findConfigByType` + `_formatEuros` + `_formatDate`**

`_findConfigByType(project, configType)` moet de volledige config-data ophalen uit `lastCalcRun.results.configResults` (daar leeft al `cfg` met type, omschrijving, capaciteit, inverterKw). Valideer met een diag in de console bij eerste gebruik of het veld "capaciteit" effectief zo heet; anders aanpassen aan de echte namen.

```js
function _findConfigByType(project, configType) {
  const results = project.lastCalcRun && project.lastCalcRun.results;
  const cfgResults = results && Array.isArray(results.configResults) ? results.configResults : [];
  const match = cfgResults.find(cr => cr.cfg && cr.cfg.type === configType);
  const cfg = match ? match.cfg : { type: configType, omschrijving: '', capaciteit: null, inverterKw: null };
  // Bepaal prijs op basis van project's BTW/keuring voorkeur
  const priceKey = _getProjectPriceKey(project);
  return {
    type:         cfg.type,
    omschrijving: cfg.omschrijving || '',
    capaciteit:   cfg.capaciteit   || null,
    inverterKw:   cfg.inverterKw   || null,
    priceEur:     cfg[priceKey]    || 0
  };
}

function _getProjectPriceKey(project) {
  // mirror van index.html's _getPriceKey
  const btw     = (typeof effectiveBtwFor === 'function') ? effectiveBtwFor(project) : 21;
  const keuring = (project.calcDefaults && project.calcDefaults.inspectieGekozen === true) ? 'yes' : 'no';
  return `${btw}_${keuring}`;
}

function _formatEuros(v) {
  return Number(v || 0).toLocaleString('nl-BE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function _formatDate(d) {
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
}
```

**Verify tijdens implementatie**: de exacte veldnamen op `cfg` (`capaciteit`? `kWh`? `inverterKw`? `inverter`?). Open een bestaande project met configs, `console.log(mergeProjectMetadata(data).lastCalcRun.results.configResults)` → bekijk het eerste `cfg` object. Pas de veldnamen hierboven aan als nodig.

- [ ] **Step 3: Voeg `_bindOfferteDropZone` handler**

```js
function _bindOfferteDropZone(projectId, configType) {
  const zone  = document.getElementById('offerteDropZone');
  const input = document.getElementById('offerteFileInput');
  const err   = document.getElementById('offerteUploadError');
  const prog  = document.getElementById('offerteUploadProgress');

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) _handleOfferteFile(input.files[0], projectId, configType);
  });

  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drop-zone-hover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drop-zone-hover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault(); zone.classList.remove('drop-zone-hover');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) _handleOfferteFile(f, projectId, configType);
  });

  async function _handleOfferteFile(file, projectId, configType) {
    err.style.display = 'none'; err.textContent = '';
    try {
      if (file.type !== 'application/pdf') throw new Error('Enkel PDF-bestanden');
      if (file.size > 10 * 1024 * 1024)    throw new Error('PDF is groter dan 10 MB');
      prog.style.display = 'block'; prog.querySelector('span').textContent = '…';
      await uploadProjectOfferte(projectId, configType, file);
      closeModal('offerteModal');
      await _refreshCurrentDrawer();    // hersluit & herrender drawer (helper in Task 9)
    } catch (e) {
      err.textContent = e.message || String(e);
      err.style.display = 'block';
      prog.style.display = 'none';
    }
  }
}
```

- [ ] **Step 4: Voeg drop-zone styling toe (in `<style>`)**

```css
.drop-zone {
  border: 2px dashed #cbd5e1; border-radius: 8px;
  padding: 22px; text-align: center;
  cursor: pointer; background: #f8fafc;
}
.drop-zone-hover { background: #eff6ff; border-color: #3b82f6; }
.drop-zone-text { color: #475569; }
```

- [ ] **Step 5: Manueel verificeren**

1. Tijdelijk voeg in DevTools console `openOfferteModal(<project>, '<configType>')` toe met een echte project-object en configType (bv. eerste uit `selectedConfigTypes`).
2. Modal toont header met type + omschrijving + prijs.
3. Klik drop-zone → file picker opent.
4. Sleep een PDF erop → uploadt, modal sluit; check Firestore: `offertes[configType]` bestaat.
5. Heropen → bestaande filename zichtbaar; sleep vervanger; oude blob verdwenen uit Storage.
6. Sleep `.jpg` → inline error "Enkel PDF-bestanden".
7. Sleep >10 MB PDF → inline error.
8. Na upload: drawer opnieuw opengeklapt ververst nog niet (Task 9).

- [ ] **Step 6: Commit**

```bash
git add dashboard.html
git commit -m "dashboard: offerte upload modal with drag-drop + size/type validation"
```

---

## Task 9: Drawer Configs-sectie rij-upgrade + handlers

**Files:**
- Modify: `dashboard.html` (drawer render + CSS + handlers)

- [ ] **Step 1: Vervang de huidige Configs-sectie renderlogica**

Zoek in `dashboard.html` de "Configs summary list" (ongeveer lines 983-992). De huidige simpele ul/li wordt vervangen door een nieuwe `renderDrawerOffertes(project)` functie die HTML als string teruggeeft, op te nemen in het bestaande `sections.push(...)` patroon.

```js
function renderDrawerOffertes(project) {
  const types     = (project.lastCalcRun && project.lastCalcRun.inputs && Array.isArray(project.lastCalcRun.inputs.selectedConfigTypes))
                    ? project.lastCalcRun.inputs.selectedConfigTypes : [];
  const offertes  = project.offertes || {};
  const dismissed = new Set(project.dismissedConfigs || []);
  if (types.length === 0) return '';

  const active   = types.filter(t => !dismissed.has(t));
  const inactive = types.filter(t =>  dismissed.has(t));

  const activeRows = active.map(t => {
    const cfg = _findConfigByType(project, t);
    const pdf = offertes[t];
    const iconState = pdf
      ? '<i class="fa-solid fa-circle-check icon-ok" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-triangle-exclamation icon-warn" aria-hidden="true"></i>';
    const fileRow = pdf
      ? `<div class="offerte-row-pdf"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> ${escapeHtml(pdf.filename)}</div>`
      : `<div class="offerte-row-pdf" style="color:var(--muted);">Offerte nog niet toegevoegd</div>`;
    const actions = pdf
      ? `<button class="btn-icon offerte-download-btn" data-type="${escapeHtml(t)}" title="Download"><i class="fa-solid fa-download" aria-hidden="true"></i></button>
         <button class="btn-icon offerte-replace-btn"  data-type="${escapeHtml(t)}" title="Vervangen"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i></button>
         <button class="btn-icon offerte-trash-btn"    data-type="${escapeHtml(t)}" data-has-pdf="1" title="Verwijderen"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>`
      : `<button class="btn-icon offerte-upload-btn"   data-type="${escapeHtml(t)}" title="Upload"><i class="fa-solid fa-upload" aria-hidden="true"></i></button>
         <button class="btn-icon offerte-trash-btn"    data-type="${escapeHtml(t)}" data-has-pdf="0" title="Niet geoffreerd"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>`;

    return `
      <div class="offerte-row ${pdf ? 'has-pdf' : 'missing-pdf'}">
        <div class="offerte-row-head">
          ${iconState}
          <span class="offerte-row-title">${escapeHtml(cfg.type)} · ${escapeHtml(cfg.omschrijving)}</span>
        </div>
        <div class="offerte-row-meta">
          € ${_formatEuros(cfg.priceEur)}${cfg.capaciteit ? ' · ' + escapeHtml(cfg.capaciteit) + ' kWh' : ''}${cfg.inverterKw ? ' · ' + escapeHtml(cfg.inverterKw) + ' kW' : ''}
        </div>
        ${fileRow}
        <div class="offerte-row-actions">${actions}</div>
      </div>
    `;
  }).join('');

  const inactiveRows = inactive.length ? `
    <div class="offerte-divider">── Niet geoffreerd ──</div>
    ${inactive.map(t => {
      const cfg = _findConfigByType(project, t);
      return `
        <div class="offerte-row dismissed">
          <span class="offerte-row-title">${escapeHtml(cfg.type)} · ${escapeHtml(cfg.omschrijving)}</span>
          <button class="btn-icon offerte-restore-btn" data-type="${escapeHtml(t)}" title="Terugzetten">
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
          </button>
        </div>
      `;
    }).join('')}
  ` : '';

  return `
    <section class="drawer-section drawer-configs">
      <h3>Configs</h3>
      ${activeRows}
      ${inactiveRows}
    </section>
  `;
}
```

- [ ] **Step 2: Haak de nieuwe sectie in in de bestaande drawer-render**

Zoek `sections.push(...)` waar de oude Configs-samenvatting wordt gepusht (lines ~983-992). Vervang door:

```js
sections.push(renderDrawerOffertes(project));
```

- [ ] **Step 3: Voeg CSS voor offerte-rijen toe**

```css
.offerte-row { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
.offerte-row:last-child { border-bottom: 0; }
.offerte-row-head { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.offerte-row-title { flex: 1; }
.offerte-row-meta { color: var(--muted, #6b7280); font-size: .85rem; margin: 2px 0 6px 26px; }
.offerte-row-pdf { font-size: .9rem; margin: 0 0 6px 26px; }
.offerte-row-actions { margin-left: 26px; display: flex; gap: 6px; }
.offerte-row.dismissed { display: flex; align-items: center; gap: 8px; opacity: .5; text-decoration: line-through; padding: 6px 0; }
.offerte-row.dismissed .offerte-row-title { flex: 1; }
.offerte-divider { color: var(--muted); font-size: .8rem; margin: 12px 0 6px 0; text-align: center; }
.btn-icon {
  background: transparent; border: 0; cursor: pointer; padding: 4px 6px;
  color: var(--text, #111); font-size: .95rem;
}
.btn-icon:hover .fa-trash, .btn-icon:hover .fa-circle-xmark { color: #dc2626; }
```

- [ ] **Step 4: Voeg click-delegation toe voor alle offerte-knoppen**

In het drawer-binding blok (zoek waar `drawerDeleteBtn` gebonden is), voeg toe:

```js
document.getElementById('drawer').addEventListener('click', async (e) => {
  const btn = e.target.closest('button.btn-icon');
  if (!btn) return;
  const type = btn.getAttribute('data-type');
  const project = _currentDrawerProject; // reeds in scope; anders: haal projectId uit dataset op de drawer-root
  if (!project || !type) return;

  if (btn.classList.contains('offerte-upload-btn') || btn.classList.contains('offerte-replace-btn')) {
    openOfferteModal(project, type);
  }
  else if (btn.classList.contains('offerte-download-btn')) {
    const pdf = (project.offertes || {})[type];
    if (!pdf || !pdf.storagePath) return;
    const url = await firebase.storage().ref(pdf.storagePath).getDownloadURL();
    window.open(url, '_blank');
  }
  else if (btn.classList.contains('offerte-trash-btn')) {
    const hasPdf = btn.getAttribute('data-has-pdf') === '1';
    if (hasPdf) {
      if (!confirm('Je verwijdert ook de bijgevoegde offerte PDF. Zeker?')) return;
      await hardDeleteProjectConfig(project.id, type);
    } else {
      await dismissProjectConfig(project.id, type);
    }
    await _refreshCurrentDrawer();
  }
  else if (btn.classList.contains('offerte-restore-btn')) {
    await restoreProjectConfig(project.id, type);
    await _refreshCurrentDrawer();
  }
});
```

- [ ] **Step 5: Zorg dat `_currentDrawerProject` + `_refreshCurrentDrawer` bestaan**

Zoek de huidige drawer-open functie (iets als `openDrawer(projectId)`). Sla het project-object op in een module-level variabele `_currentDrawerProject` bij open, en schrijf:

```js
async function _refreshCurrentDrawer() {
  if (!_currentDrawerProject) return;
  // Re-fetch verse projectdata na een Firestore-write:
  const snap = await firebase.firestore().collection('projects').doc(_currentDrawerProject.id).get();
  if (!snap.exists) return;
  const fresh = mergeProjectMetadata(Object.assign({ id: snap.id }, snap.data()));
  _currentDrawerProject = fresh;
  // Render opnieuw — reuse van bestaande renderDrawer(project) functie.
  renderDrawer(fresh);
  // En ook de rij in de dashboard-lijst bijwerken (voor het warning-icoon in Task 11):
  await refreshDashboardList(); // of de naam die in de codebase wordt gebruikt om de rij-lijst te her-renderen
}
```

De exacte functienamen (`renderDrawer`, `refreshDashboardList`) hangen af van de huidige code — gebruik wat al bestaat. Als `refreshDashboardList` nog niet bestaat als losse functie maar de lijst wordt bij elke snapshot-listener opnieuw gerenderd, dan is een extra Firestore-get overbodig — het bestaande listener-pad ververst zichzelf.

- [ ] **Step 6: Manueel verificeren**

1. Open drawer van project met 2 configs.
2. Zie beide configs met oranje triangle (nog geen PDF).
3. Klik upload-knop rechts van config 1 → modal opent voor die config.
4. Upload PDF → modal sluit, drawer ververst met groene check + filename + download/pen/trash.
5. Klik download → nieuw tabblad met PDF.
6. Klik pen → modal opent met "vervang" tekst, upload vervanger, oude weg.
7. Klik trash op config met PDF → confirm, annuleer → niks.
8. Klik trash opnieuw, bevestig → config verdwijnt uit drawer (uit selectedConfigTypes).
9. Klik trash op config 2 (zonder PDF) → direct gedimd onder scheidingslijn.
10. Klik rotate-left op dismissed config → terug actief oranje.

- [ ] **Step 7: Commit**

```bash
git add dashboard.html
git commit -m "dashboard: per-config offerte state + dismiss/restore/hard-delete handlers"
```

---

## Task 10: Offerte-warning banner + dashboard-rij warning icoon

**Files:**
- Modify: `dashboard.html` (drawer render + row render)

- [ ] **Step 1: Voeg offerte-warning banner toe in drawer render**

Vlak na de ground-fault banner (zoek de bestaande `needsGroundFaultCheck(project)` push), voeg:

```js
if (needsOfferteWarning(project)) {
  const missing = (project.lastCalcRun.inputs.selectedConfigTypes || [])
    .filter(t => !(project.dismissedConfigs || []).includes(t) && !(project.offertes || {})[t]);
  sections.push(`
    <div class="alert alert-warning" style="margin-bottom:14px;">
      <i class="fa-solid fa-triangle-exclamation icon-warn" aria-hidden="true"></i>
      <div>
        <strong>Offertes ontbreken.</strong>
        Dit project staat in offerte-fase maar ${missing.length} config(s) hebben nog geen offerte PDF.
      </div>
    </div>
  `);
}
```

- [ ] **Step 2: Voeg row-warning icoon toe in de dashboard-lijst render**

Zoek de plaats waar `row-warning` voor ground-fault wordt gerenderd (lines ~643 en ~761 in de lijst- en board-view). Voeg parallel een tweede conditie toe:

```js
${needsOfferteWarning(p) ? `
  <span class="row-warning row-warning-offerte" title="Offertes ontbreken — klant zit in offerte-fase maar er zijn configs zonder PDF.">
    <i class="fa-solid fa-triangle-exclamation icon-warn" aria-hidden="true"></i>
  </span>
` : ''}
```

Let op: de ground-fault gebruikt `icon-danger` (rood); offerte gebruikt `icon-warn` (oranje). Beide mogen naast elkaar tonen.

- [ ] **Step 3: Manueel verificeren**

1. Project met status `bezoek_gepland`, geen offertes → geen banner, geen row-warning.
2. Verzet status naar `offerte_uit` → row toont oranje triangle; drawer toont oranje banner bovenaan ("2 config(s) hebben nog geen offerte PDF").
3. Upload offerte voor één van de configs → banner telt nu 1.
4. Upload voor alle → banner verdwijnt, row-warning weg.
5. Status terug naar `bezoek_gepland` met open offertes → banner en row-warning verdwenen.
6. Status naar `wacht_op_beslissing` (ook offerte-phase) met open offerte → banner terug.

- [ ] **Step 4: Commit**

```bash
git add dashboard.html
git commit -m "dashboard: offerte-missing warning banner + row icon"
```

---

## Task 11: Volledige manual test-pass + CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Volledige doorloop van het test-plan uit de spec**

Doe alle 16 stappen uit "Manual test-plan" (spec §Manual test-plan). Noteer failures en fix ze vóór je commit. Enkele highlights:

- Re-calc met minder configs → offerte blijft in DB maar verdwijnt uit drawer.
- Share-link `?s=<id>` in incognito → check DOM + Storage-network-tab, geen offerte info zichtbaar, geen 403/404 in console.
- Permissions sanity: probeer uitgelogd rechtstreeks `projects/<id>/offertes/xxx.pdf` op Storage te openen → 403.

- [ ] **Step 2: Update CLAUDE.md met korte beschrijving van de feature**

Voeg onder de bestaande `dashboard.html` beschrijving een paragraaf toe:

```markdown
**Offerte PDF upload per config (2026-04-21)** — Per config in de drawer een ⬆ of ✏ knop om een offerte-PDF te uploaden via een modal (drag-drop, max 10 MB, PDF-only). Opslag: `offertes: { [configType]: { storagePath, filename, … } }` op het project-doc, blobs in Storage onder `projects/{id}/offertes/{type}_{ts}.pdf`. Dismissen van een config zonder PDF = soft via `dismissedConfigs[]`; dismissen van een config mét PDF triggert een confirm → hard-delete (PDF + config uit `selectedConfigTypes`). Warning-banner in drawer + oranje `fa-triangle-exclamation` op de project-rij wanneer status in offerte-fase zit én er een niet-dismissed config zonder PDF is. Helpers in `firebase-init.js`: `uploadProjectOfferte`, `deleteProjectOfferte`, `hardDeleteProjectConfig`, `dismissProjectConfig`, `restoreProjectConfig`, `needsOfferteWarning`.

**Font Awesome 6 (2026-04-21)** — Alle UI-iconen in `dashboard.html`, `project-edit.html`, `index.html` gebruiken FA 6.5.2 Free via cdnjs (`<i class="fa-solid fa-...">`). Kleurklassen: `.icon-ok` (groen), `.icon-warn` (oranje), `.icon-danger` (rood). Emoji's blijven enkel nog in toast-messages en textContent-copy — alle knoppen, badges en section-headers zijn FA.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md: document offerte upload feature + Font Awesome migration"
```

- [ ] **Step 4: Push**

```bash
git push origin gh-pages
```

Wacht ~1 min voor CDN refresh en test live op `https://smartpeak-be.github.io/battery-roi-tool/dashboard.html`.

---

## Self-Review Notes

**Spec coverage check:**
- Data model (Task 5) ✓
- Dismiss/delete semantics (Task 5 helpers + Task 9 handlers) ✓
- Modal (Task 7 infra + Task 8 content) ✓
- Drawer rij-state (Task 9) ✓
- Warning banner + row icon (Task 10) ✓
- FA migratie (Tasks 1-4) ✓
- Storage rule (Task 6) ✓
- Price display in modal (Task 8 `_findConfigByType`) ✓
- Re-calc edge case (covered passively: `saveProjectCalcRun` raakt alleen `lastCalcRun`, dus geen code-change nodig — gevalideerd in Task 11 test 13-14) ✓
- Share-link clean (passief — offertes niet in `_serializeState`; gevalideerd in Task 11 test 11) ✓

**Type consistency check:**
- Helper names match between Task 5 (definition) and Task 9 (usage): ✓
- `configType` as key everywhere: ✓
- `offertes[configType]` shape consistent: ✓
- `_findConfigByType` / `_formatEuros` / `_formatDate` defined in Task 8 Step 2, used in Task 9 Step 1: ✓

**Open implementation detail:**
- Exact property names op `cfg` (`capaciteit` vs `kWh` vs `capKwh`, `inverterKw` vs `inverterPowerKw`) zijn in de plan aangegeven met een inline-verify stap in Task 8 Step 2. Als namen anders zijn → `_findConfigByType` body aanpassen; geen cascade-impact op andere tasks.
