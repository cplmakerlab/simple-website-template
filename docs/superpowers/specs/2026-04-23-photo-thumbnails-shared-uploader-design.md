# Shared photo uploader + client-side thumbnails

**Date:** 2026-04-23
**Status:** design approved, implementation pending

## Problem

1. **Performance** — de drawer en project-edit Blok D tonen foto-grids met de
   full-resolution versies van elke foto. Bij 10+ foto's van enkele MB wordt dit
   zwaar (data + render). We hebben een aparte thumbnail-versie nodig voor de
   grid; de lightbox blijft de full-versie laden.
2. **UI-divergentie** — de drawer heeft enkel een `fa-upload` knop (geen
   camera-capture); project-edit Blok D heeft wél `capture="environment"`. De
   upload-flow, drop-zone en grid-render zijn in beide surfaces los
   geïmplementeerd. We willen één gedeeld component zodat drawer en Blok D
   automatisch synchroon blijven.
3. **Geen visuele scheiding serial vs. situatie** — `uploadProjectSerialPhoto`
   koppelt een foto aan een specifieke serial-entry in `project.serialNumbers[]`,
   maar die foto verschijnt enkel als `fa-eye` knopje op de serial-rij — niet in
   de hoofdgrid. Zonder OCR-koppeling voegt de aparte per-serial flow vandaag
   weinig UX-waarde toe.
4. **Upload-indicator ontbreekt voor camera-capture** — de drag-drop flow heeft
   een progress-balk, maar foto's genomen via `<input capture>` verdwijnen
   zonder visuele bevestiging tot ze in de grid verschijnen.

## Scope

In-scope:
- Eén gedeeld vanilla-JS component `assets/js/photo-uploader.js`.
- Client-side thumbnail-generatie via Canvas (max 400 px longest side,
  JPEG q=0.82).
- Firestore photo-doc uitbreiding: `thumbStoragePath`, `width`, `height`, `tag`.
- Na-upload tag-modal (per foto + "alles → X" bulk-knoppen).
- Progress-indicator consistent voor camera, file-picker en drop-zone.
- Lazy backfill van thumbs voor bestaande foto's (on-demand bij grid render).
- Unified grid in drawer + Blok D (foto's door elkaar, kleine tag-indicator).
- Retiren van de per-serial-entry camera-knop in Blok D; serial-rijen worden
  plain tekstvelden.

Out-of-scope:
- OCR-pipeline op serial-foto's (latere iteratie).
- Filter-toggle situatie/serieel in de grid (later als gebruikers dit missen).
- One-off migratie-script voor bestaande foto's (we gebruiken lazy backfill).
- Wijzigingen aan de calculator (`index.html`) — daar zijn geen foto's.
- Share-link flow (`?s=`, `?data=`) — toont nog steeds geen foto's.
- EXIF-handling voorbij de browser-native auto-rotatie (moderne browsers doen
  dit zelf sinds 2020).

## Architectuur

### Nieuw bestand: `assets/js/photo-uploader.js`

Vanilla JS module, geen framework. Publieke API:

```js
mountPhotoUploader(containerEl, {
  projectId,               // string of null (new-project mode: disabled state)
  onChange,                // async () => void — na upload / tag / delete
  allowCamera:     true,   // mobile capture-knop
  allowFileUpload: true,   // file-picker
  allowDropZone:   true,   // desktop drag-drop
  readOnly:        false,
});
```

Het component rendert intern in de container:
- Knoppenrij: `fa-camera` (capture, `<input type="file" accept="image/*"
  capture="environment">`) · `fa-upload` (gallery, `<input type="file"
  accept="image/*" multiple>`). De camera-input werkt op mobile
  devices met cameratoegang; desktops tonen bij klik dezelfde file-picker
  als de gallery-knop — geen kostbare mobile-detectie nodig, we renderen
  beide knoppen overal en laten het OS beslissen wat `capture` betekent.
- Drop-zone (optioneel, desktop — alleen getoond bij `window.matchMedia('(min-width: 768px)')`)
- Progress-balk (Bootstrap `.progress`)
- Foto-grid met lightbox
- Tag-modal (Bootstrap `.modal.fade`, één modal-instance per component)

Alles scoped aan de container — geen globale state. Meerdere instanties op
dezelfde page zijn toegelaten (bv. drawer + Blok D beide open in principe, al
gebeurt dat niet in de huidige UX).

### Inzet

- **`dashboard.html`** — de huidige inline `photo-grid` + upload-knop in het
  `#drawer` block vervangen door een `mountPhotoUploader(drawerPhotoEl, ...)`
  call. Trigger bij openen van een project-drawer.
- **`project-edit.html`** — de huidige `peDropZone`/`pePhotoCamera`/`pePhotoGallery`
  block in Blok D vervangen door `mountPhotoUploader(blokDPhotoEl, ...)`.

### Serial-photo flow retiren

In Blok D rendert `_renderSerialRow()` nu een `fa-camera` en `fa-eye` per
serial-entry. Beide knoppen verdwijnen; de serial-rij wordt `text input +
delete`. De helpers `uploadProjectSerialPhoto`, `getSerialPhotoUrl` en het
gebruik van `photoStoragePath` in de rij blijven in `firebase-init.js`
(dode-code-opruim kan later); geen callers meer vanuit UI.

`photoStoragePath` op bestaande `serialNumbers[]` entries blijft staan als
legacy data (no-op). Latere OCR-iteratie kan deze data terugvragen of opruimen.

## Data model

Firestore `projects/{id}/photos/{photoId}` krijgt drie nieuwe velden:

```
storagePath:       string         // ongewijzigd — full-versie
thumbStoragePath:  string | null  // NIEUW — thumb-versie, null op oude docs
width:             number | null  // NIEUW — full-dimensies
height:            number | null  // NIEUW — full-dimensies
tag:               'situatie' | 'serial'   // NIEUW — default 'situatie'
```

Bestaande velden (`name`, `contentType`, `sizeBytes`, `uploadedAt`, `uploadedBy`)
blijven ongewijzigd.

Defensief lezen: `photoDoc.thumbStoragePath ?? null`, `photoDoc.tag ?? 'situatie'`.

### Storage paths

- Full: `projects/{projectId}/{ts}_{safeName}` — ongewijzigd, behoudt de
  originele extensie (kan dus `.jpg`, `.png`, `.heic`, …).
- Thumb: `projects/{projectId}/{ts}_{safeNameStripped}_thumb.jpg` — de
  originele extensie wordt gestript, thumb is altijd JPEG. Voorbeeld:
  full `123_photo.png` → thumb `123_photo_thumb.jpg`.

De bestaande rule `/projects/{projectId}/{allPaths=**}` dekt beide.

### Thumbnail-generatie

Helper `makeThumbnail(source) → { blob, width, height }` — accepteert zowel
een `File` (nieuwe upload) als een `HTMLImageElement` (backfill):
1. Voor `File`: `URL.createObjectURL(file)` → `<img>` laden → `await img.decode()`.
   Voor `HTMLImageElement`: wordt direct gebruikt (al geladen).
2. Compute thumb-dimensies: `const scale = 400 / Math.max(naturalWidth,
   naturalHeight); if (scale >= 1) scale = 1;` — thumb is nooit groter dan
   het origineel. Canvas-dimensies: `round(naturalWidth * scale)` ×
   `round(naturalHeight * scale)`.
3. `canvas.toBlob(callback, 'image/jpeg', 0.82)`
4. Retourneert de thumb-blob + de **full-image dimensies** (`naturalWidth`/
   `naturalHeight`, voor Firestore-write — niet de thumb-dimensies).
5. EXIF-rotatie: de browser doet dit automatisch bij `<img>` sinds 2020 —
   geen extra library.

## Upload-flow

Nieuw in `firebase-init.js`: `uploadProjectPhotoWithThumb(projectId, file, { tag })`:
1. `makeThumbnail(file)` → thumb-blob + dimensies
2. Parallel storage-upload (Promise.all):
   - full → `{ts}_{safeName}.jpg` met original `contentType`
   - thumb → `{ts}_{safeName}_thumb.jpg` met `'image/jpeg'`
3. Firestore `add()` met alle velden (inclusief `tag`, `width`, `height`,
   `thumbStoragePath`).
4. `updatedAt` op project bumpen.
5. Error-pad: als stap 2 of 3 faalt, best-effort cleanup van reeds-geüploade
   blobs (catch + warn); error bubbelt naar het component.

De oude `uploadProjectPhoto` blijft ongewijzigd bestaan tijdens de transitie;
het component gebruikt uitsluitend de nieuwe helper. Eerst verwijderen in een
latere commit nadat er geen callers meer zijn.

### Component-UX

1. User drukt `fa-camera`, `fa-upload` of sleept files op de drop-zone.
2. Progress-balk verschijnt onmiddellijk: "Uploaden 0/N — `<filename>`",
   teller bij per bestand. Werkt nu consistent voor alle drie de triggers —
   camera-capture had voorheen geen indicator.
3. Voor elk geselecteerd bestand (sequentieel, één tegelijk — vermijdt
   Canvas-contention en stabiliseert de progress-UX):
   - `makeThumbnail(file)` (± 100-500 ms, blocking op main thread — acceptabel
     bij ≤ 20 foto's)
   - `uploadProjectPhotoWithThumb(projectId, file, { tag: 'situatie' })`
     (default tag `situatie` zodat een refresh vóór het afsluiten van de
     tag-modal nooit data kwijtspeelt)
   - Progress-balk: elke voltooide file bumpt de teller.
4. Na de laatste upload: **tag-modal opent automatisch** met de N zojuist
   geüploade foto's:
   - Rijen: thumbnail (uit de lokale blob, geen round-trip) + 2 radio's
     (`Situatie` / `Serieel`)
   - Bulk-knoppen bovenaan: `Alles → Situatie` · `Alles → Serieel`
   - `Opslaan` → Firestore `WriteBatch` (één atomaire commit over alle
     photo-docs), enkel voor foto's waar user `tag !== 'situatie'` koos
   - `Annuleren` / Escape / kruisje → sluiten (foto's blijven met default
     `tag: 'situatie'`)
5. Na modal-close: `onChange()` → host re-rendert grid (bv. drawer
   refresh-cycle die andere project-data mee-leest).

## Display-flow

### Grid

Voor elke foto-doc:
- `thumbStoragePath` aanwezig → `getDownloadURL` → `<img>` in grid-cel
- Ontbreekt → **lazy backfill** (zie volgende paragraaf) + tijdelijk de
  full-versie tonen via `storagePath` (status quo)

Sortering: `uploadedAt desc` (ongewijzigd). Unified — situatie en serial
door elkaar.

Kleine tag-indicator rechts-onderop elke grid-cel:
- `fa-camera` grijs voor `situatie`
- `fa-barcode` grijs voor `serial`

### Lightbox

Laadt altijd de full-versie via `storagePath`. Als `width`/`height` bekend zijn,
reserveert de lightbox-container ruimte vóór image-load (voorkomt
layout-jump). Prev/next/delete gedrag ongewijzigd.

### Lazy backfill

Helper `backfillThumbnail(projectId, photoDoc)`:
1. Fetch de full-versie via de bestaande download-URL in een `<img>` element
   (geen CORS-issue — Firebase Storage download-URLs zijn via token publiek
   leesbaar).
2. `makeThumbnail()` op dat `<img>` element (dezelfde Canvas-helper,
   gedupliceerde signature voor `HTMLImageElement` input).
3. Upload thumb-blob naar `{originalStoragePath met _thumb.jpg suffix}`.
4. Firestore `update()` op het photo-doc: `thumbStoragePath` + `width`
   + `height`.
5. Component swapt de grid-cel van full-URL naar thumb-URL.

**Trigger:** wanneer de grid een foto zonder `thumbStoragePath` rendert.

**Throttling:** één backfill tegelijk per component-instance (interne queue).
Voorkomt dat een drawer met 12 oude foto's alle resources tegelijk opeist.

**Fail-soft:** mislukt de backfill (netwerk, storage-permissie, …) →
grid-cel blijft de full-URL tonen; geen user-facing error, enkel
`console.warn`.

## Firestore rules

De huidige `projects/{id}/photos` rules moeten toelaten:
- `update` door whitelisted users (nodig voor `tag`-patch en backfill van
  `thumbStoragePath`/`width`/`height`).

Check + evt. toevoegen bij rule-deploy.

## Backwards compatibility

- Foto's zonder `thumbStoragePath` → lazy backfill (zie boven).
- Foto's zonder `tag` → default 'situatie' in alle readers.
- Foto's zonder `width`/`height` → lightbox toont zonder vooraf gereserveerde
  ruimte (huidige gedrag).
- Geen schema-bump nodig; alle nieuwe velden zijn optioneel.
- Share-link v:5 payload → onveranderd; foto's worden niet in share-links
  opgenomen.

## Testing (manueel — repo heeft geen test suite)

1. **Mobile camera single-upload**: drawer op mobiel, `fa-camera`, 1 foto
   maken → progress-balk → modal met 1 rij → kies `Serieel` → Opslaan →
   grid toont thumb + barcode-indicator.
2. **Desktop bulk-upload**: Blok D, `fa-upload`, 5 foto's → progress
   toont `5/5` → modal met 5 rijen → `Alles → Situatie` → Opslaan → alle 5
   als situatie.
3. **Drag-drop**: Blok D, 3 foto's op drop-zone → zelfde flow.
4. **Backfill**: project met foto's van vóór deze iteratie openen → netwerk-tab
   toont `_thumb.jpg` PUT requests; Firestore-doc krijgt `thumbStoragePath`
   ingevuld; bij tweede bezoek worden alleen thumbs geladen.
5. **Drawer + Blok D parity**: dezelfde foto's in dezelfde volgorde in beide.
6. **Modal cancel**: 2 foto's uploaden, modal kruisje → grid toont beide als
   situatie.
7. **Calculator onveranderd**: `?project=<id>` en share-links (`?s=`/`?data=`)
   → geen foto-UI, geen regressies.
8. **Oude-project compat**: project met `serialNumbers[]` entries die nog
   `photoStoragePath` hebben → geen UI-breaking errors, Blok D rendert de
   rijen als plain tekstvelden.

## Rollout

Eén bundeled commit op `gh-pages` (geen feature-flag, zelfde approach als
recente features). Deploy via push; GitHub Pages refresh ~1 min. Eerste
handmatige verificatie op een testproject vóór aankondiging aan Ruben.

## CLAUDE.md update

Na merge: de "Foto's & serienummers" paragraaf in CLAUDE.md updaten om te
documenteren:
- Shared `photo-uploader.js` component en waar het gemount wordt
- Nieuwe data-model velden (`thumbStoragePath`, `tag`, `width`/`height`)
- Retired per-serial camera-knop
- Lazy backfill-gedrag
