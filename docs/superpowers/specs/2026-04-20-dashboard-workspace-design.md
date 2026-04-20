# Dashboard Workspace — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Context:** Follow-up na project-metadata + UI polish. Kevin gebruikt het dashboard als werkoverzicht ("Jira-backlog gevoel") en wil per project een side-drawer met alle relevante info + opmerkingen-thread tussen hem en Ruben.

## Goal

Het dashboard transformeren van een loutere project-lijst naar een **werkoverzicht**. Eén klik op de projectnaam opent een rechter-drawer met alles wat je in een oogopslag moet zien: klantgegevens, status, configs-samenvatting, vrije-tekst notities, en een opmerkingen-thread waarin Kevin en Ruben kunnen heen-en-weer praten over het dossier. De thread krijgt een visuele ongelezen-indicator op de rij zodat je direct ziet waar iets op je wacht.

Parallel worden drie nieuwe velden-groepen op het project-document toegevoegd die vandaag nog ontbreken (klantgegevens, situatie-beschrijving, notitie) — beide bewerkbaar via `project-edit.html`.

## Non-goals

- **Threading / replies op comments** — flat list, nieuwste onderaan. Jira-style backlog comments, geen forum.
- **Edit/delete van bestaande comments** — append-only. Correcties via nieuwe comment. Kevin/Ruben zijn twee mensen, scope rechtvaardigt geen edit-UI.
- **Rich-text / bijlagen** — platte tekst (met line-breaks). YAGNI.
- **Realtime `onSnapshot` subscriptions** — op handmatige reload / open-drawer fetches we opnieuw. Twee users, low-volume. Scheelt Firebase quotas.
- **Push-notificaties** (email, desktop) — visuele badge in dashboard volstaat.
- **Mentions (@ruben)** — geen.
- **Customer-facing comments** — thread is niet zichtbaar op `index.html` (noch `?project=`, noch share-links). Alleen dashboard.

## Scope samenvatting

| Onderdeel | Wijziging |
|---|---|
| Firestore schema | +`customer` sectie (adres, tel, email), +`situation` string, +`notes` string, +`lastCommentAt` timestamp, +`readStates` map. Nieuwe sub-collectie `projects/{id}/comments`. |
| Firestore rules | `projects/{id}/comments/{cid}` read+create+delete = `isWhitelisted()`. Update op parent-doc (voor `lastCommentAt` en `readStates`) al toegestaan door bestaande rule. |
| `firebase-init.js` | Helpers `listComments`, `addComment` (ook bumpt `lastCommentAt`), `markCommentsRead`. `newEmptyProjectMetadata()` uitgebreid met `customer`. |
| `project-edit.html` | Nieuwe sectie "Klantgegevens" (adres/tel/email) na Basisgegevens. Nieuwe sectie "Situatie & notities" (twee textareas). |
| `dashboard.html` | Klik op projectnaam → opent rechter-drawer. Drawer: header + klantcontact + status + situatie/notities excerpt + configs-samenvatting + opmerkingen-thread + composer + actie-knoppen. Rood pulserend bolletje naast naam bij ongelezen opmerkingen. 💾 knop wordt 🧮. 📂 knop verwijderen (drawer-acties nemen die rol). |
| `CLAUDE.md` | Doc update. |
| `index.html` | **Geen wijziging** — opmerkingen zijn intern, niet voor klanten. |

## 1. Schema uitbreidingen

Toegevoegd aan het project-document (allemaal additief, nullable):

```text
customer: {
  address: null | string,   // multi-line toegelaten
  phone:   null | string,
  email:   null | string,
}
situation:     null | string   // vrije tekst, multi-line — "wat staat er, wat is de context"
notes:         null | string   // korte scratch-notes per dossier
lastCommentAt: null | Timestamp // server-stamped bij elke nieuwe comment
readStates: {                   // wie-laats-gelezen-wanneer per gebruiker
  'kevin@bloxit.be':  Timestamp,
  'ledsrepair@gmail.com': Timestamp,
}
```

Nieuwe sub-collectie **`projects/{id}/comments/{autoId}`**:

```text
{
  author:    string (email),
  text:      string (≤ 4000 chars),
  createdAt: Timestamp
}
```

Pre-2026-04-20 projecten zonder deze velden/sub-collectie gedragen zich als volledig-leeg via `mergeProjectMetadata` (al bestaande pattern). Sub-collectie die niet bestaat → lijst is leeg.

## 2. Firestore rules

Kevin past deze regels aan in de Firebase Console, binnen het bestaande `match /databases/{database}/documents` block:

```
match /projects/{projectId}/comments/{commentId} {
  allow read:   if isWhitelisted();
  allow create: if isWhitelisted();
  allow update: if false;
  allow delete: if isWhitelisted();
}
```

De bestaande regel op `/projects/{id}` dekt al writes op `lastCommentAt` en `readStates.<email>`, geen extra rule nodig.

## 3. firebase-init.js helpers

Toegevoegd:

```js
// Comments sub-collectie — flat list per project.
async function listComments(projectId) {
  const snap = await projectDoc(projectId).collection('comments').orderBy('createdAt', 'asc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Append comment. Updates parent project's lastCommentAt atomically.
async function addComment(projectId, text) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  const trimmed = (text || '').trim();
  if (!trimmed) throw new Error('Lege opmerking.');
  if (trimmed.length > 4000) throw new Error('Opmerking te lang (max 4000 tekens).');
  const now = firebase.firestore.FieldValue.serverTimestamp();
  // Firestore batched write: add the comment + bump parent's lastCommentAt + updatedAt.
  const batch = getDb().batch();
  const commentRef = projectDoc(projectId).collection('comments').doc();
  batch.set(commentRef, { author: email, text: trimmed, createdAt: now });
  batch.update(projectDoc(projectId), { lastCommentAt: now, updatedAt: now });
  await batch.commit();
  return commentRef.id;
}

// Mark all comments up to now as read for the current user.
async function markCommentsRead(projectId) {
  const email = currentUserEmail();
  if (!email) return;
  await projectDoc(projectId).update({
    [`readStates.${email}`]: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// Compute whether the current user has unread comments on a project.
// Returns true if lastCommentAt > readStates[email] (or readStates[email] is undefined and lastCommentAt exists).
function hasUnreadComments(project, email) {
  if (!project || !project.lastCommentAt) return false;
  if (!email) return false;
  const rs = (project.readStates || {})[email];
  if (!rs) return true;
  // Firestore Timestamp has .toMillis().
  const lca = project.lastCommentAt.toMillis ? project.lastCommentAt.toMillis() : 0;
  const rsm = rs.toMillis ? rs.toMillis() : 0;
  return lca > rsm;
}
```

`newEmptyProjectMetadata()` krijgt een extra sectie:

```js
customer: {
  address: null,
  phone:   null,
  email:   null,
},
situation: null,
notes:     null,
```

`mergeProjectMetadata()` merget `customer` net zoals de andere secties. `situation` en `notes` zijn strings → geen merge nodig, ze worden gewoon overgezet.

## 4. project-edit.html — twee nieuwe secties

Tussen "Basisgegevens" (sectie 1) en "Leverancier & tarieven" (sectie 2) schuiven we **twee nieuwe secties** in, zodat de volgorde klant-gericht wordt: eerst wie het is, dan waar hij woont, dan waar hij aan koopt.

**Nieuwe sectie "Klantcontact"** (collapsible card, default open voor new project):

- `customer.address` — multi-line textarea, optional. Label: *"Adres"*.
- `customer.phone` — tel-input, optional. Label: *"Telefoon"*. `inputmode="tel"`.
- `customer.email` — email-input, optional. Label: *"E-mail"*. `inputmode="email"`.

Gewoon één-op-één input-to-project binding via `_project.customer.*` (patroon van bestaande secties).

**Nieuwe sectie "Situatie & notities"** (collapsible card):

- `situation` — textarea `rows="4"`, maxlength 4000. Label: *"Situatie"*. Help: *"Vrije beschrijving van de context, apparaten, klantwensen — alles wat handig is voor een collega om te lezen vóór een bezoek."*
- `notes` — textarea `rows="3"`, maxlength 2000. Label: *"Notities"*. Help: *"Korte interne notities voor jezelf."*

Volgorde van secties wordt dus: Basisgegevens → Klantcontact → Situatie & notities → Leverancier & tarieven → Woning → Elektrisch → Zekeringkast → Omvormers → Voorkeuren → CSV.

## 5. dashboard.html — drawer

### Layout

Een vaste rechter-drawer met breedte **420px** op ≥ 900px, **100% viewport-width** onder 900px. Default dicht (CSS transform offscreen); bij openen slide-in. Achter de drawer een semi-transparante overlay (klik buiten drawer = sluit). ESC sluit ook. Drawer heeft interne scroll (overflow-y:auto) zodat het hele projectdossier verticaal scrollbaar is.

Structuur van de drawer content (van boven naar onder):

1. **Header** — sticky top: project-naam (h2), status-chip (klikbaar met dezelfde popover als in de rij), × sluitknop.
2. **Contact-blok** — klantnaam, adres (regels afbreken op `\n`), telefoon (als `tel:` link), email (als `mailto:` link). Verborgen subsectie als alle drie leeg.
3. **Acties-strip** — twee knoppen zij-aan-zij: *"🧮 Open berekening"* (→ `index.html?project=<id>#results` als `lastCalcRun`, anders zonder hash) en *"✏ Bewerk project"* (→ `project-edit.html?project=<id>`).
4. **Configs samenvatting** (alleen als `lastCalcRun`): list van geselecteerde configs uit `lastCalcRun.inputs.selectedConfigTypes`, per item naam. Geen prijs/payback — te druk.
5. **Situatie** (als niet-leeg): readonly tekst-blok. Whitespace preserved (`white-space: pre-wrap`).
6. **Notities** (als niet-leeg): readonly tekst-blok, kleiner.
7. **Opmerkingen-thread** — header *"💬 Opmerkingen"* + totaal-aantal, daaronder:
   - Lijst van comments (oudste bovenaan), elke item = auteur-korte-naam (email tot @) + relatieve tijd (`"3 min geleden"`, `"gisteren 14:32"`, `"12 mrt"`) + tekst. Subtiele kaartjes met zachte achtergrond.
   - Onderaan composer: textarea `rows="3"` + knop *"Plaats opmerking"*. Enter-zonder-shift = niet versturen (voorkomt per ongeluk verzenden — composer is bewust klikker-driven).
   - Bij klik *Plaats opmerking*: `addComment` → op succes append naar lijst + clear composer. Toast "Opmerking geplaatst".

### Open-flow

Klik op `<a class="projectNameLink">` in de rij → `openDrawer(projectId)`:
1. Fetch `getProject(id)` → fallback-merge + render header/contact/acties/configs/situatie/notities.
2. Fetch `listComments(id)` → render thread.
3. `markCommentsRead(id)` (async, niet blocking) → bump readStates.
4. Slide drawer in. Ook: visueel bolletje op de rij wissen (re-render list after a short debounce of say 500ms to avoid immediate jitter).

### Sluit-flow

Klik × / klik overlay / ESC → slide out. Geen state-cleanup nodig (DOM opnieuw gepopuleerd bij volgende open).

### Badge

Rood bolletje (6px diameter, CSS pulse keyframe) naast de projectnaam in de rij als `hasUnreadComments(project, currentUserEmail()) === true`. Tooltip *"Nieuwe opmerking(en)"*.

Animatie:
```css
@keyframes dot-pulse { 0%,100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.4); opacity: 0.5; } }
.unread-dot { animation: dot-pulse 1.6s ease-in-out infinite; }
```

### Rij-actie veranderingen

- `📂` knop **verwijderen** — projectnaam-click opent drawer, 🧮 gaat naar berekening, ✏ naar edit. Redundant.
- `💾` **icoon → 🧮**, tooltip wordt *"Open berekening"*. Logica ongewijzigd (alleen getoond als `lastCalcRun`, navigeert naar `?project=<id>#results`).
- Projectnaam was een link (`<a href="index.html?project=...">`). Wordt een `<a class="projectNameLink" href="#" data-id="...">` die `preventDefault` doet en `openDrawer(id)` roept. Of `<button>` met span-styling — link is accessibility-vriendelijker met `href="#"` + onClick preventDefault. **Keuze**: `<button class="projectNameLink">` — semantisch een actie, geen nav.

## 6. Edge cases

- **Drawer open, user wijzigt project in andere tab** (bv. status) → volgende keer drawer geopend wordt, verse fetch. Geen realtime-sync, maar voor 2-users acceptabel.
- **Comments worden toegevoegd tijdens drawer-view** → verschijnen niet live (geen onSnapshot). User kan drawer sluiten + heropenen. Acceptabel voor onze volume.
- **`markCommentsRead` faalt** (network blip) → silent warn; user ziet z'n eigen badge nog staan tot volgende refresh. Niet kritisch.
- **Comment te lang** → `addComment` throws "te lang (max 4000)"; composer toont inline error, behoudt tekst zodat user kan editen.
- **Twee users typen tegelijk een comment** → beide komen erin, timestamps ordenen. No-op.
- **Project zonder `lastCommentAt` én zonder `readStates[email]`** → `hasUnreadComments` returns false. Geen badge (geen comments = niks te missen).
- **User scrolled in thread, nieuwe comment geplaatst** → bij eigen post: scroll-to-bottom na render. Bij vreemde post (sync via drawer-heropening): geen auto-scroll. Kevin ziet dan gewoon de scroll-positie behouden.

## 7. Bestandsstructuur impact

| File | Delta LOC (schatting) |
|---|---|
| `assets/js/firebase-init.js` | +60 |
| `project-edit.html` | +100 (2 secties + wiring) |
| `dashboard.html` | +300 (drawer HTML + CSS + JS) |
| `CLAUDE.md` | +6 |

Geen nieuwe files. `dashboard.html` groeit merkbaar; blijft echter goed gestructureerd per-functie. Als het boven ~1200 regels gaat kan later extractie naar `assets/js/dashboard-drawer.js` overwogen worden — nu nog niet nodig.

## 8. Implementatie-volgorde (input voor plan-skill)

1. `firebase-init.js` — helpers + schema uitbreidingen + Firestore rules-tekst in plan-footnote.
2. `project-edit.html` — Klantcontact sectie.
3. `project-edit.html` — Situatie & notities sectie.
4. `dashboard.html` — rij-icoon wissel (💾→🧮, 📂 weg) + projectnaam als button.
5. `dashboard.html` — drawer HTML/CSS skeleton + open/close flow + overlay + ESC.
6. `dashboard.html` — drawer content: header, contact, acties, configs, situatie, notities.
7. `dashboard.html` — opmerkingen-thread + composer + listComments/addComment integratie + markCommentsRead.
8. `dashboard.html` — unread bolletje + pulse animatie + integratie met hasUnreadComments.
9. `CLAUDE.md` update.
10. Firebase Console: rule toevoegen (Kevin manueel).
11. Push.
