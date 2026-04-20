# Workspace v2 — Chat-icoon, Foto's, Ground-Fault Warning — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Context:** Iteratie 2 op het dashboard-workspace model. Drie concrete verbeteringen die goed samen gaan.

## Goals

1. **Chat-icoon vervangt het rode bolletje**. Alleen knipperen wanneer de *tegenpartij* een opmerking heeft geplaatst die jij nog niet gezien hebt — niet na je eigen posts.
2. **Foto's per project**. Kevin/Ruben kunnen foto's uploaden bij een project (bv. foto van de zekeringkast) en die terug bekijken. Uploaden én bekijken enkel in de drawer ("project view"), niet op de calculator en niet in share-links.
3. **Ground-fault waarschuwing bij Zendure configs**. Zendure installaties hebben een gedocumenteerd risico op een ground fault als het spanningsverschil fase↔aarde > 30 V is. Voorkomen = meten vóór installatie. Nieuwe project-vink "meting gedaan + onder 30 V" + een waarschuwings-icoontje (❗) in dashboard-rij wanneer geselecteerde configs non-Marstek zijn én de vink niet gezet is.

## Non-goals

- **Realtime photo-sync** tussen drawers van twee gebruikers — opnieuw openen van de drawer ververst.
- **Photo-editing** (crop, draw) — view + delete is voldoende.
- **Meerdere waarschuwingstypes** — enkel ground-fault nu. Voor andere configs of checks komt een veralgemening pas als er concrete nood is.
- **Bulk photo-upload met voortgangsbalk** — gewoon sequentieel uploaden. Per foto één toast.
- **Photo-compressie / thumbnails in het browsertje zelf** — Firebase Storage serveert de originele byte stream. Voor een verkoper met ~5 foto's per project is dit prima. Later eventueel her-encoden.

## Scope samenvatting

| Onderdeel | Wijziging |
|---|---|
| Firestore | +`cabinet.lineGroundChecked: null \| boolean` op project-doc. Nieuwe sub-collectie `projects/{id}/photos/{autoId}` met `{ storagePath, name, contentType, sizeBytes, uploadedAt, uploadedBy }`. |
| Firebase **Storage** (nieuw!) | Nieuw bucket (al aanwezig — zelfde project) + rule `projects/{id}/{path}` read/write = whitelisted. Initieel: Storage moet in Firebase Console *enabled* worden — eenmalige Kevin-actie. |
| Firestore rules | `projects/{id}/photos/{pid}` read/create/delete = isWhitelisted, update = false. |
| `firebase-init.js` | `addComment` bumpt ook `readStates[author]` (eigen post = gelezen). Nieuwe helpers: `listProjectPhotos`, `uploadProjectPhoto`, `deleteProjectPhoto`. Nieuwe helper `isMarstekOnly(types)`. `hasUnreadOtherComments(project, email, lastCommentBy)` — maar dit wordt afgehandeld door de readStates-bump dus hetzelfde `hasUnreadComments` signature blijft. |
| `dashboard.html` | Unread-dot wordt `💬` chat-icoon met pulse-animatie. Nieuw `❗` warning-icoon per rij met tooltip. Drawer krijgt sectie "📷 Foto's" met grid + upload + lightbox. |
| `project-edit.html` | Zekeringkast sectie krijgt checkbox "Meting fase-aarde uitgevoerd en onder 30 V". |
| `index.html` | **Geen** wijziging. |
| `CLAUDE.md` | Doc update. |

## 1. Chat-icoon i.p.v. pulserend bolletje

**Gedrag**:
- Toon `💬` naast projectnaam **alleen** als `hasUnreadComments(project, currentUserEmail())` true is.
- Pulse-animatie op dat icoon (zelfde keyframe die we gebruikten, nu op een emoji/tekst-span).
- Geen icoon voor projecten zonder comments of met alles-gelezen comments. Scheelt visuele ruis.

**Fix voor "eigen posts tellen niet als unread"**: `addComment` schrijft in dezelfde batch ook `readStates.<poster_email> = serverTimestamp()`. Gevolg: direct na je eigen post heb je `lastCommentAt === readStates[jezelf]` → `hasUnreadComments` returns false voor jezelf. De andere gebruiker heeft zijn `readStates[email]` stale, dus bij hem knippert het icoon. Precies wat Kevin wil.

`hasUnreadComments` zelf hoeft niet te wijzigen — de addComment-bump zorgt voor de correcte semantiek.

**Rendering**: span met `unread-chat` class (was `unread-dot`). CSS:
```css
.unread-chat {
  display: inline-block;
  margin-right: 6px;
  font-size: 0.95rem;
  animation: chat-pulse 1.6s ease-in-out infinite;
}
@keyframes chat-pulse {
  0%, 100% { transform: scale(1);    opacity: 1;   }
  50%      { transform: scale(1.15); opacity: 0.6; }
}
```
De `unread-dot` styles worden verwijderd.

## 2. Foto's per project

### Data model

**Firebase Storage** (nieuw in dit project):
- Bucket: same als Firebase project's default
- Padstructuur: `projects/<projectId>/<timestamp>_<safeFilename>`
- Voorbeeld: `projects/abc123/1713630000000_fusebox.jpg`

**Firestore sub-collectie** `projects/{projectId}/photos/{autoId}`:
```text
{
  storagePath: string,     // "projects/abc123/1713630000000_fusebox.jpg"
  name:        string,     // originele filename voor display
  contentType: string,     // "image/jpeg"
  sizeBytes:   number,
  uploadedAt:  Timestamp,
  uploadedBy:  string (email),
}
```
Reden om een Firestore doc bij te houden: ordered `get()` via `orderBy('uploadedAt', 'desc')` + metadata in één roundtrip zonder Storage "list" call (die traag is en geen metadata levert).

### Firestore rules

Toevoegen binnen `match /projects/{projectId} { ... }`:
```
match /photos/{photoId} {
  allow read:   if isWhitelisted();
  allow create: if isWhitelisted();
  allow update: if false;
  allow delete: if isWhitelisted();
}
```

### Storage rules

Nieuw bestand `storage.rules` (zelfde whitelist-pattern, maar Storage rules kennen geen custom functies die Firestore lezen — dus hardcoden):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /projects/{projectId}/{allPaths=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email in ['kevin@bloxit.be', 'ledsrepair@gmail.com'];
    }
  }
}
```

(De email-lijst blijft gesynchroniseerd met `WHITELISTED_EMAILS` in `firebase-init.js`. Bij whitelist-wijziging moet die op 3 plaatsen: Firestore rules, Storage rules, JS constante.)

### SDK

Toevoegen aan `dashboard.html` en `project-edit.html` (Kevin's enige uploaders — maar photos worden alleen bekeken in de drawer, dus upload-UI zit in drawer; toch laden we de SDK op beide files voor toekomst-consistency):
```html
<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-storage-compat.js"></script>
```

### firebase-init.js helpers

```js
function getStorage() { initFirebase(); return firebase.storage(); }

async function uploadProjectPhoto(projectId, file) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  if (!file || !file.type.startsWith('image/')) throw new Error('Alleen afbeeldingen.');
  const MAX_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_BYTES) throw new Error('Te groot (max 15 MB).');
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80);
  const storagePath = `projects/${projectId}/${Date.now()}_${safeName}`;
  const ref = getStorage().ref(storagePath);
  await ref.put(file, { contentType: file.type });
  await projectDoc(projectId).collection('photos').add({
    storagePath,
    name:        file.name,
    contentType: file.type,
    sizeBytes:   file.size,
    uploadedAt:  firebase.firestore.FieldValue.serverTimestamp(),
    uploadedBy:  email,
  });
  await projectDoc(projectId).update({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
}

async function listProjectPhotos(projectId) {
  const snap = await projectDoc(projectId).collection('photos').orderBy('uploadedAt', 'desc').get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Enrich with download URLs (parallel).
  await Promise.all(docs.map(async d => {
    try { d.downloadUrl = await getStorage().ref(d.storagePath).getDownloadURL(); }
    catch (e) { d.downloadUrl = null; d.fetchError = e && e.message ? e.message : String(e); }
  }));
  return docs;
}

async function deleteProjectPhoto(projectId, photoId, storagePath) {
  await projectDoc(projectId).collection('photos').doc(photoId).delete();
  try { await getStorage().ref(storagePath).delete(); }
  catch (e) { console.warn('Storage file verwijderen mislukt', e); }  // de Firestore doc is weg — orphan bytes in Storage, niet kritisch
}
```

### Drawer UI

Nieuwe sectie **"📷 Foto's"** onder "Notities", boven de opmerkingen-thread. Inhoud:

- Raster van thumbnails (≈ 3 kolommen, 90px vierkant) met `object-fit: cover`.
- Klik op thumbnail → full-screen lightbox (zelfde lightbox-patroon als `producten.html`) met pijlen naar vorige/volgende + sluitknop. Kleine "🗑 verwijderen" knop rechtsboven in lightbox met bevestig-dialog.
- Onderaan: `<input type="file" accept="image/*" multiple>` + knop "📤 Upload".
- Lege state: "Nog geen foto's geüpload."
- Upload-voortgang: disable de knop, toon toast per foto "📷 Foto geüpload" bij succes.

Rendering volgt hetzelfde patroon als `renderComments` — na upload/delete opnieuw `listProjectPhotos` + render.

## 3. Ground-fault warning

### Nieuwe project-veld

In `cabinet` sectie:
```
cabinet.lineGroundChecked: null | true
```
(bewust niet `false` — drie-staten is overkill; het is een eenzijdige vink: "ja, gemeten + < 30 V". Niet-gevinkt = onbekend of niet gedaan.)

Migratie: pre-bestaande projects hebben `cabinet.lineGroundChecked` undefined → behandeld als niet-gevinkt. Geen breaking change.

### UI in project-edit.html

In de Zekeringkast sectie, onder de bestaande tri-state rijen, een nieuwe **checkbox**:
```
☐ Meting fase ↔ aarde uitgevoerd en onder 30 V (verplicht bij Zendure-installaties
   om ground fault te voorkomen)
```
Checkbox state ↔ `_project.cabinet.lineGroundChecked` (true indien checked, null indien unchecked).

### Waarschuwings-predicate

```js
function isMarstekConfig(type) { return typeof type === 'string' && type.startsWith('MARVE'); }
function needsGroundFaultCheck(project) {
  const lcr = project && project.lastCalcRun;
  if (!lcr) return false;
  const types = (lcr.inputs && lcr.inputs.selectedConfigTypes) || [];
  if (types.length === 0) return false;
  const anyNonMarstek = types.some(t => !isMarstekConfig(t));
  if (!anyNonMarstek) return false;
  const m = mergeProjectMetadata(project);
  return m.cabinet.lineGroundChecked !== true;
}
```

Semantiek:
- Geen berekening gedaan → geen waarschuwing.
- Alle configs Marstek → geen waarschuwing.
- Vink staat → geen waarschuwing.
- Anders → waarschuwing.

### UI in dashboard-lijst

Per rij, naast het chat-icoon en vóór de projectnaam: `<span class="row-warning">❗</span>` met tooltip (native `title=` attribuut):
*"Controleer fase↔aarde spanning: bij Zendure-installaties moet dit < 30 V zijn. Zet de vink in het project wanneer dit gemeten is."*

Conditie: `needsGroundFaultCheck(project)` true.

### UI in drawer

Bovenaan drawer (onder header, boven contact), een prominent `alert-warning`:
*"⚠️ Controleer fase↔aarde meting voor Zendure. Nog niet aangevinkt — doe dit vóór installatie om een ground fault te voorkomen."*

Zodra Kevin de vink zet in project-edit → warning verdwijnt bij volgende drawer-open.

## 4. Rules & setup checklist (Kevin eenmalig)

### A. Enable Firebase Storage

Firebase Console → Build → Storage → "Get started" → **Start in production mode** → Location: zelfde als Firestore (eur3) → Done.

### B. Set Storage rules

Storage → Rules → vervang met:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /projects/{projectId}/{allPaths=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email in ['kevin@bloxit.be', 'ledsrepair@gmail.com'];
    }
  }
}
```
Publish.

### C. Update Firestore rules (uitbreiding)

Binnen het bestaande `match /projects/{projectId}` blok, toevoegen naast `/comments`:
```
match /photos/{photoId} {
  allow read:   if isWhitelisted();
  allow create: if isWhitelisted();
  allow update: if false;
  allow delete: if isWhitelisted();
}
```
Publish.

### D. CORS voor Storage (optioneel)

Standaard accepteert Firebase Storage CORS vanuit dezelfde origin. Als GitHub Pages URL's CORS problemen geven bij `getDownloadURL`, run eenmalig `gsutil cors set`. Plan-footnote houdt dit als optionele fallback; standaardgeval zou moeten werken.

## 5. Edge cases

- **Storage niet enabled** → `getStorage()` throws of `ref.put` faalt. Foutmelding in upload-toast. User leest, Kevin activeert Storage (setup stap A).
- **Foto's te groot / verkeerd type** → inline error, geen upload.
- **Download URL 403** (rules niet gepubliceerd) → afbeelding broken image; drawer toont lege tegel met filename als tooltip. Onhandig maar niet-fataal.
- **Project verwijderd terwijl user foto's uploadt** → upload slaagt (Storage path accepteert), Firestore doc-add faalt want soft-delete is niet hard. Minor orphan. Accept.
- **Gelijktijdige comment-posts door Kevin + Ruben** → last-write-wins op `lastCommentAt`. Beide comments komen er normaal in (sub-collectie). Chat-icoon knippert voor beiden bij de andere (want ieder's readState is stale). Klopt.
- **`lineGroundChecked` vinken tijdens drawer openstaat** → drawer ververst niet automatisch. User moet drawer heropenen. Acceptabel.
- **Niet-ingelogde user opent drawer (onmogelijk — hele dashboard is auth-gated)** → n/a.

## 6. Bestandsstructuur impact

| File | Delta LOC (schatting) |
|---|---|
| `assets/js/firebase-init.js` | +70 |
| `project-edit.html` | +20 (ground-check checkbox) |
| `dashboard.html` | +200 (photo grid + lightbox + upload + warning icon + chat swap) |
| `CLAUDE.md` | +5 |

Geen nieuwe JS bestand nodig (dashboard groeit verder maar blijft werkbaar).

## 7. Implementatie-volgorde

1. `firebase-init.js` — eigen-post-read-fix in `addComment`, `isMarstekConfig`, `needsGroundFaultCheck`, Photo-helpers + Storage init.
2. Firebase Storage SDK script-tag in `dashboard.html` en `project-edit.html`.
3. `project-edit.html` — ground-check checkbox in Zekeringkast sectie.
4. `dashboard.html` — unread-dot → chat-icoon (CSS rename + rowHTML class/content wissel).
5. `dashboard.html` — warning `❗` icoon in rij + tooltip.
6. `dashboard.html` — warning banner bovenaan drawer.
7. `dashboard.html` — foto sectie in drawer (grid + upload + lightbox + delete).
8. `CLAUDE.md` update.
9. Kevin: Firebase Console → enable Storage + publish rules (Firestore + Storage).
10. Push.
