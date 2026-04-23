# Photo thumbnails + shared uploader — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a single shared photo-uploader component (used in the dashboard drawer and project-edit Blok D) that stores each photo as a full-resolution blob + a client-generated 400 px thumbnail, with an after-upload tag modal (situatie/serial) and lazy backfill of thumbs for existing photos.

**Architecture:** New vanilla-JS module `assets/js/photo-uploader.js` exposes `mountPhotoUploader(containerEl, opts)`. Thumbnails are generated client-side via Canvas (longest-side 400 px, JPEG q=0.82) and uploaded in parallel with the full blob. Firestore photo-docs get three new optional fields (`thumbStoragePath`, `width`/`height`, `tag`). Existing photos without thumbs lazily backfill on first render. Per-serial-entry camera is retired; all photos go into one unified pool tagged `situatie` (default) or `serial`.

**Tech Stack:** Vanilla JS, Bootstrap 5.3.3 (modal/progress), Firebase compat SDK 10.13.2 (Firestore + Storage), Font Awesome 6.5.2. No build step, no test framework (verification is manual per task).

**Spec:** [2026-04-23-photo-thumbnails-shared-uploader-design.md](../specs/2026-04-23-photo-thumbnails-shared-uploader-design.md)

---

## File structure

**Created:**
- `assets/js/photo-uploader.js` — the shared component (~500 lines)

**Modified:**
- `assets/js/firebase-init.js` — add `makeThumbnail`, `uploadProjectPhotoWithThumb`, `backfillThumbnail`; extend `listProjectPhotos` to resolve thumb URLs
- `assets/css/smartpeak.css` — add tag-indicator styling, tag-modal specifics
- `dashboard.html` — drawer: replace inline photo block with `mountPhotoUploader`; add `photo-uploader.js` script tag
- `project-edit.html` — Blok D: replace inline photo block with `mountPhotoUploader`; retire per-serial camera/eye buttons in `_renderSerialRow`; add `photo-uploader.js` script tag
- `CLAUDE.md` — update the Foto's & serienummers paragraph

**Not touched:**
- `index.html` (calculator has no photos)
- Firestore/Storage security rules (existing `projects/{id}/{allPaths=**}` rule covers thumbs; photo-doc `update` permission is already enabled for whitelisted users — verified in step 3.4 of Task 3)

---

## Testing philosophy

No test framework exists in this repo. Each task ends with a **manual verification** step: exact browser URL, exact clicks, exact expected result. Commits happen after verification passes. If a task's verification fails, do not proceed.

Run the site locally with `python3 -m http.server 8000` from the repo root, then open `http://localhost:8000/dashboard.html` (login required via Firebase email whitelist).

---

## Worktree & branching

Work is done on a feature branch in a git worktree, not directly on `gh-pages`. This keeps the deploy branch clean until the full feature is verified.

- [ ] **Step 0.1: Create worktree and branch**

```bash
cd /home/ubuntu/battery-roi-tool
git worktree add .worktrees/photo-thumbnails -b feat/photo-thumbnails gh-pages
cd .worktrees/photo-thumbnails
```

All subsequent steps run inside `.worktrees/photo-thumbnails/`.

---

## Task 1: Add `makeThumbnail` helper

Pure Canvas-based helper that accepts either a `Blob`/`File` (new upload) or an `HTMLImageElement` (backfill path) and returns `{ blob, width, height }` where `width`/`height` are the **natural** dimensions of the source image (for Firestore storage), not the thumb canvas dimensions.

**Files:**
- Modify: `assets/js/firebase-init.js` (add function, register on `window`)

- [ ] **Step 1.1: Add the helper**

Append this block after the `// ─── PHOTOS (Firebase Storage + Firestore metadata) ──` section header and before `function getStorage()`:

```js
// ─── Client-side thumbnail generation ──
// Accepts a File/Blob (new upload) or HTMLImageElement (backfill).
// Returns { blob: Blob, width: number, height: number } where width/height
// are the NATURAL dimensions of the source image.
async function makeThumbnail(source) {
  const MAX_SIDE = 400;
  const QUALITY  = 0.82;

  let img, cleanup = () => {};
  if (source instanceof HTMLImageElement) {
    img = source;
    if (!img.complete || img.naturalWidth === 0) {
      try { await img.decode(); } catch {}
    }
  } else if (source instanceof Blob) {
    img = new Image();
    const url = URL.createObjectURL(source);
    cleanup = () => URL.revokeObjectURL(url);
    img.src = url;
    try { await img.decode(); }
    catch (e) { cleanup(); throw new Error('Kan afbeelding niet decoderen: ' + (e && e.message ? e.message : e)); }
  } else {
    throw new Error('makeThumbnail: source moet File/Blob of HTMLImageElement zijn');
  }

  const naturalWidth  = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  if (!naturalWidth || !naturalHeight) {
    cleanup();
    throw new Error('Afbeelding heeft geen geldige afmetingen');
  }

  const longest = Math.max(naturalWidth, naturalHeight);
  const scale   = longest > MAX_SIDE ? MAX_SIDE / longest : 1;
  const canvas  = document.createElement('canvas');
  canvas.width  = Math.max(1, Math.round(naturalWidth  * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', QUALITY));
  cleanup();
  if (!blob) throw new Error('Thumbnail-aanmaak mislukt (canvas.toBlob)');
  return { blob, width: naturalWidth, height: naturalHeight };
}
```

Also ensure the function is reachable from `photo-uploader.js` — since this repo uses script-tag globals (no module system), functions defined at file scope in `firebase-init.js` are already global. No extra export needed.

- [ ] **Step 1.2: Manual verification in browser console**

Open `http://localhost:8000/dashboard.html` after login. In DevTools console:

```js
// pick any JPEG >500 px; or generate a synthetic one:
const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
c.getContext('2d').fillRect(0, 0, 1600, 900);
c.toBlob(async (fullBlob) => {
  const t = await makeThumbnail(fullBlob);
  console.log('thumb size (bytes):', t.blob.size, '— full:', t.width, 'x', t.height);
  // Expected: thumb.size roughly 5-20 KB, width: 1600, height: 900
  const img = new Image();
  img.src = URL.createObjectURL(t.blob);
  await img.decode();
  console.log('thumb canvas dims:', img.naturalWidth, 'x', img.naturalHeight);
  // Expected: 400 x 225  (longest side = 400, aspect preserved)
});
```

Expected: thumb dims `400 x 225`, reported width/height equal source `1600 x 900`.

- [ ] **Step 1.3: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "feat(photos): add makeThumbnail Canvas helper

Longest-side 400 px, JPEG q=0.82, accepts File/Blob or HTMLImageElement.
Returns { blob, width, height } with width/height = source natural dims."
```

---

## Task 2: Add `uploadProjectPhotoWithThumb` helper

Uploads full + thumb in parallel to Storage, then writes a single Firestore doc with all new metadata fields. Default `tag = 'situatie'`. Best-effort cleanup on failure.

**Files:**
- Modify: `assets/js/firebase-init.js`

- [ ] **Step 2.1: Add the helper below `uploadProjectPhoto`**

```js
// Uploads a full image + a generated thumbnail in parallel, then writes
// a single Firestore photo-doc.  Defaults tag='situatie' (user may change
// later via the tag-modal).
async function uploadProjectPhotoWithThumb(projectId, file, opts = {}) {
  const email = currentUserEmail();
  if (!email) throw new Error('Niet ingelogd');
  if (!file || !file.type.startsWith('image/')) throw new Error('Alleen afbeeldingen.');
  const MAX_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_BYTES) throw new Error('Te groot (max 15 MB).');
  const tag = opts.tag === 'serial' ? 'serial' : 'situatie';

  const safeName     = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80);
  const safeStripped = safeName.replace(/\.[^.]+$/, '') || 'photo';
  const ts           = Date.now();
  const fullPath     = `projects/${projectId}/${ts}_${safeName}`;
  const thumbPath    = `projects/${projectId}/${ts}_${safeStripped}_thumb.jpg`;

  // Step A — generate thumb
  let thumb;
  try { thumb = await makeThumbnail(file); }
  catch (e) { throw new Error('Thumbnail genereren mislukt: ' + (e && e.message ? e.message : e)); }

  // Step B — parallel storage upload
  const storage = getStorage();
  try {
    await Promise.all([
      storage.ref(fullPath).put(file,       { contentType: file.type }),
      storage.ref(thumbPath).put(thumb.blob, { contentType: 'image/jpeg' }),
    ]);
  } catch (e) {
    // best-effort cleanup of whichever blob(s) landed
    try { await storage.ref(fullPath).delete();  } catch {}
    try { await storage.ref(thumbPath).delete(); } catch {}
    throw new Error('Storage upload mislukt: ' + (e && e.message ? e.message : e));
  }

  // Step C — Firestore metadata
  try {
    const ref = await projectDoc(projectId).collection('photos').add({
      storagePath:      fullPath,
      thumbStoragePath: thumbPath,
      name:             file.name,
      contentType:      file.type,
      sizeBytes:        file.size,
      width:            thumb.width,
      height:           thumb.height,
      tag,
      uploadedAt:       firebase.firestore.FieldValue.serverTimestamp(),
      uploadedBy:       email,
    });
    await projectDoc(projectId).update({
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  } catch (e) {
    try { await storage.ref(fullPath).delete();  } catch {}
    try { await storage.ref(thumbPath).delete(); } catch {}
    throw new Error('Firestore metadata schrijven mislukt: ' + (e && e.message ? e.message : e));
  }
}
```

- [ ] **Step 2.2: Extend `listProjectPhotos` to resolve thumb URLs**

Find the current implementation (around line 519). Replace the `await Promise.all(...)` block with:

```js
async function listProjectPhotos(projectId) {
  const snap = await projectDoc(projectId).collection('photos').orderBy('uploadedAt', 'desc').get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  await Promise.all(docs.map(async d => {
    // Full-size URL (always needed for lightbox)
    try { d.downloadUrl = await getStorage().ref(d.storagePath).getDownloadURL(); }
    catch (e) { d.downloadUrl = null; d.fetchError = e && e.message ? e.message : String(e); }
    // Thumb URL (may be absent on legacy docs)
    if (d.thumbStoragePath) {
      try { d.thumbUrl = await getStorage().ref(d.thumbStoragePath).getDownloadURL(); }
      catch (e) { d.thumbUrl = null; /* will fall back to downloadUrl in the UI */ }
    } else {
      d.thumbUrl = null;
    }
    // Defaults for legacy docs
    if (!d.tag) d.tag = 'situatie';
  }));
  return docs;
}
```

- [ ] **Step 2.3: Manual verification**

Open `http://localhost:8000/dashboard.html`, sign in, and in DevTools console on a page with a known `PROJECT_ID` (grab one from `window._cache` or via `getProjects()`):

```js
const file = ...; // use a file-picker or construct a canvas-blob:
const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
c.getContext('2d').fillStyle = '#2c7be5'; c.getContext('2d').fillRect(0, 0, 1200, 800);
const syntheticFile = await new Promise(res => c.toBlob(b => {
  const f = new File([b], 'test.png', { type: 'image/png' });
  res(f);
}, 'image/png'));

const docId = await uploadProjectPhotoWithThumb('<paste a project id>', syntheticFile, { tag: 'serial' });
console.log('wrote photo doc', docId);

const photos = await listProjectPhotos('<same project id>');
const latest = photos.find(p => p.id === docId);
console.log('thumbStoragePath:', latest.thumbStoragePath, '\nthumbUrl:', latest.thumbUrl, '\ntag:', latest.tag, '\nwidth x height:', latest.width, 'x', latest.height);
```

Expected:
- `thumbStoragePath` ends with `_thumb.jpg`
- `thumbUrl` is a usable `https://firebasestorage...` URL
- `tag` === `'serial'`
- width × height === `1200 x 800`

Then in Firebase console: `Storage > projects/<id>/` should show both `<ts>_test.png` and `<ts>_test_thumb.jpg`. Firestore `projects/<id>/photos/<docId>` should show all new fields.

**Cleanup:** delete the test photo via the existing `deleteProjectPhoto(id, docId, latest.storagePath)`. Note: only the full blob gets deleted by that helper — leaves `_thumb.jpg` orphan. That's fixed in Task 3.5.

- [ ] **Step 2.4: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "feat(photos): add uploadProjectPhotoWithThumb + thumb URL resolution

Parallel upload of full + 400px thumb; Firestore doc now stores
thumbStoragePath, width, height, tag ('situatie'|'serial'). Best-effort
cleanup on partial failure. listProjectPhotos resolves both URLs and
defaults tag to 'situatie' on legacy docs."
```

---

## Task 3: Add `backfillThumbnail` + update `deleteProjectPhoto`

Lazy backfill path for photos uploaded before this iteration. Also extends `deleteProjectPhoto` to remove the thumb blob.

**Files:**
- Modify: `assets/js/firebase-init.js`

- [ ] **Step 3.1: Add `backfillThumbnail` after `uploadProjectPhotoWithThumb`**

```js
// Lazily generates + uploads a thumbnail for a legacy photo that only has
// a full-resolution blob.  Returns the new thumbStoragePath or null on no-op.
// Throws on fatal errors so callers can decide how to surface them.
async function backfillThumbnail(projectId, photoDoc) {
  if (!photoDoc || !photoDoc.id || !photoDoc.storagePath) return null;
  if (photoDoc.thumbStoragePath) return null; // already done

  const storage = getStorage();
  const fullUrl = photoDoc.downloadUrl
    || await storage.ref(photoDoc.storagePath).getDownloadURL();

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = fullUrl;
  try { await img.decode(); }
  catch (e) { throw new Error('Backfill: image decode mislukt: ' + (e && e.message ? e.message : e)); }

  const { blob, width, height } = await makeThumbnail(img);

  // Derive thumb path from full path.
  // Full looks like: projects/<pid>/<ts>_<safeName>
  // Thumb target:    projects/<pid>/<ts>_<safeStripped>_thumb.jpg
  let thumbPath;
  const m = /^(.*\/)([^/]+)$/.exec(photoDoc.storagePath);
  if (m) {
    const dir  = m[1];
    const base = m[2];
    const stripped = base.replace(/\.[^.]+$/, '') || 'photo';
    thumbPath = `${dir}${stripped}_thumb.jpg`;
  } else {
    thumbPath = photoDoc.storagePath.replace(/\.[^.]+$/, '') + '_thumb.jpg';
  }

  await storage.ref(thumbPath).put(blob, { contentType: 'image/jpeg' });
  await projectDoc(projectId).collection('photos').doc(photoDoc.id).update({
    thumbStoragePath: thumbPath,
    width,
    height,
  });

  return thumbPath;
}
```

- [ ] **Step 3.2: Replace `deleteProjectPhoto` to also remove thumb blob**

Find the existing 4-line function near line 529 and replace with:

```js
async function deleteProjectPhoto(projectId, photoId, storagePath, thumbStoragePath) {
  await projectDoc(projectId).collection('photos').doc(photoId).delete();
  try { await getStorage().ref(storagePath).delete(); }
  catch (e) { console.warn('Storage full-blob verwijderen mislukt', e); }
  if (thumbStoragePath) {
    try { await getStorage().ref(thumbStoragePath).delete(); }
    catch (e) { console.warn('Storage thumb-blob verwijderen mislukt', e); }
  }
}
```

Note: the third-argument signature is unchanged; the fourth is a new optional param. Existing callers (dashboard.html `openLightbox` / project-edit.html `renderPhotoGrid`) will be updated in later tasks when we replace them with the shared component.

- [ ] **Step 3.3: Verify Firestore rules permit photo-doc `update`**

```bash
grep -n "match /projects" /home/ubuntu/battery-roi-tool/.firestore.rules 2>/dev/null || \
  echo "(No .firestore.rules checked in; rules live in the Firebase console.)"
```

If rules ARE in-repo and the photos sub-collection has only `create`/`delete` but no `update`, flag this to the user — the backfill step will fail without `update` permission. If rules live in the console only, ask the user to verify and add `allow update: if isWhitelisted();` under `match /projects/{pid}/photos/{pid2}` before deploy.

- [ ] **Step 3.4: Manual verification**

In DevTools console on dashboard.html after sign-in:

```js
// Pick a pre-2026-04-23 photo (no thumbStoragePath)
const photos = await listProjectPhotos('<some project id with old photos>');
const legacy = photos.find(p => !p.thumbStoragePath);
console.log('legacy photo:', legacy);
const newPath = await backfillThumbnail('<same project id>', legacy);
console.log('backfilled to:', newPath);

// Re-fetch
const fresh = await listProjectPhotos('<same project id>');
const updated = fresh.find(p => p.id === legacy.id);
console.log('now has thumb:', updated.thumbStoragePath, '→', updated.thumbUrl);
```

Expected: second `console.log` shows a populated `thumbStoragePath`; `thumbUrl` loads in a new browser tab.

If no legacy photos exist (fresh project), skip this check and verify via Task 7's grid-level integration.

- [ ] **Step 3.5: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "feat(photos): add backfillThumbnail + delete thumb alongside full

backfillThumbnail reads a legacy full-size blob, generates a thumb, and
patches the Firestore photo-doc with thumbStoragePath + width/height.
deleteProjectPhoto now takes optional thumbStoragePath param (old callers
still work — they just leave an orphan thumb, which is harmless until we
replace them in later tasks)."
```

---

## Task 4: Scaffold `photo-uploader.js` — skeleton, no upload logic yet

New module exposing `mountPhotoUploader(containerEl, opts)` returning `{ refresh, destroy }`. This task lays the file structure and renders an inert version (no upload, no modal) so we can wire it into both pages and see it before implementing upload in Task 5.

**Files:**
- Create: `assets/js/photo-uploader.js`

- [ ] **Step 4.1: Create the file**

```js
/* global firebase, uploadProjectPhotoWithThumb, listProjectPhotos,
          deleteProjectPhoto, backfillThumbnail, escapeHtml, showToast */

// assets/js/photo-uploader.js
// Shared photo-uploader component — used in dashboard.html drawer and
// project-edit.html Blok D.  Mounted per-container; multiple instances on
// the same page are safe.

(function (global) {
  'use strict';

  function _esc(s) {
    return (typeof escapeHtml === 'function')
      ? escapeHtml(s == null ? '' : String(s))
      : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
          '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
  }

  function _toast(msg, variant) {
    if (typeof showToast === 'function') return showToast(msg, variant || 'danger');
    console.warn('[photo-uploader]', msg);
  }

  function _renderSkeleton(opts) {
    const canCam  = !!opts.allowCamera;
    const canFile = !!opts.allowFileUpload;
    const canDrop = !!opts.allowDropZone;
    return `
      <div class="pu-root" data-pu-root>
        ${opts.readOnly ? '' : `
          <div class="pu-buttons mb-2 d-flex flex-wrap gap-2">
            ${canCam  ? `
              <label class="btn btn-outline-primary mb-0" data-pu-camera-label>
                <i class="fa-solid fa-camera me-1"></i> Foto maken
                <input type="file" accept="image/*" capture="environment" class="d-none" data-pu-camera />
              </label>` : ''}
            ${canFile ? `
              <label class="btn btn-outline-secondary mb-0" data-pu-gallery-label>
                <i class="fa-solid fa-folder-open me-1"></i> Uit galerij kiezen
                <input type="file" accept="image/*" multiple class="d-none" data-pu-gallery />
              </label>` : ''}
          </div>
        `}
        <div class="photo-grid" data-pu-grid><p class="sp-empty-state">&#x23F3; Laden&hellip;</p></div>
        ${(!opts.readOnly && canDrop) ? `
          <div class="sp-drop-zone d-none d-md-block mt-2" data-pu-drop hidden>
            <div class="pu-drop-prompt">
              <i class="fa-solid fa-cloud-arrow-up me-1"></i>
              <strong>Sleep foto's hierheen</strong>
              <span class="text-muted">of gebruik de knoppen.</span>
              <div class="text-muted small mt-1">Max 15 MB per foto.</div>
            </div>
          </div>` : ''}
        <div class="pu-progress d-none mt-2" data-pu-progress>
          <div class="progress" style="height:6px;">
            <div class="progress-bar" role="progressbar" style="width:0%;"></div>
          </div>
          <div class="text-muted small mt-1">Uploaden <span data-pu-count>0/0</span>&hellip;</div>
        </div>
        <div class="text-danger small mt-1 d-none" data-pu-err></div>
      </div>
    `;
  }

  function mountPhotoUploader(containerEl, opts) {
    const options = Object.assign({
      projectId:      null,
      onChange:       null,
      allowCamera:    true,
      allowFileUpload:true,
      allowDropZone:  true,
      readOnly:       false,
    }, opts || {});

    containerEl.innerHTML = _renderSkeleton(options);

    // State
    const state = {
      photos:         [],          // [{id, storagePath, thumbStoragePath, thumbUrl, downloadUrl, tag, ...}]
      lightboxIdx:    0,
      backfillBusy:   false,
      backfillQueue:  [],          // photoIds still to backfill
    };

    // Render stubs (filled out in later tasks)
    async function refresh() {
      if (!options.projectId) {
        const grid = containerEl.querySelector('[data-pu-grid]');
        grid.innerHTML = '<p class="sp-empty-state">Sla het project eerst op om foto\'s te kunnen toevoegen.</p>';
        return;
      }
      try { state.photos = await listProjectPhotos(options.projectId); }
      catch (e) { _toast('Foto\'s laden mislukt: ' + (e && e.message ? e.message : e), 'danger'); return; }
      _renderGrid();
    }

    function _renderGrid() {
      const grid = containerEl.querySelector('[data-pu-grid]');
      if (!grid) return;
      if (state.photos.length === 0) {
        grid.innerHTML = '<p class="sp-empty-state">Nog geen foto\'s geüpload.</p>';
        return;
      }
      grid.innerHTML = state.photos.map((p, i) => {
        const src = p.thumbUrl || p.downloadUrl;
        if (!src) {
          return `<div class="photo-tile broken" title="${_esc(p.fetchError || 'Kon foto niet laden')}">${_esc(p.name || 'onbekend')}</div>`;
        }
        const tagIcon = p.tag === 'serial' ? 'fa-barcode' : 'fa-camera';
        return `<div class="photo-tile" data-pu-tile data-idx="${i}">
          <img src="${_esc(src)}" alt="${_esc(p.name || '')}" />
          <span class="pu-tag-indicator" title="${p.tag === 'serial' ? 'Serieel' : 'Situatie'}"><i class="fa-solid ${tagIcon}"></i></span>
        </div>`;
      }).join('');
    }

    function destroy() {
      containerEl.innerHTML = '';
    }

    // Initial render (no blocking).
    refresh();

    return { refresh, destroy };
  }

  global.mountPhotoUploader = mountPhotoUploader;
})(window);
```

- [ ] **Step 4.2: Add script tags**

In `dashboard.html`, right after `<script src="assets/js/offertes-ui.js"></script>` (line 16):

```html
<script src="assets/js/photo-uploader.js"></script>
```

Same edit in `project-edit.html` after line 19.

- [ ] **Step 4.3: Manual verification (smoke test)**

Open `http://localhost:8000/dashboard.html` after sign-in. In DevTools console:

```js
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;top:0;right:0;width:300px;background:white;z-index:9999;padding:10px;border:1px solid black;';
document.body.appendChild(probe);
const handle = mountPhotoUploader(probe, { projectId: '<paste a project id>' });
```

Expected: probe div shows "Foto maken" + "Uit galerij kiezen" buttons, then the photo grid fills with thumbs (or "Nog geen foto's geüpload." if empty). Tag-indicator (camera icon) visible bottom-right of each tile. Clicking a tile does nothing yet — that's Task 7.

Clean up: `probe.remove()`.

- [ ] **Step 4.4: Commit**

```bash
git add assets/js/photo-uploader.js dashboard.html project-edit.html
git commit -m "feat(photos): scaffold photo-uploader.js component

mountPhotoUploader(containerEl, opts) renders buttons + photo grid with
tag indicators. Upload + modal + lightbox added in follow-up commits."
```

---

## Task 5: Wire upload flow (camera, gallery, drop-zone, progress)

Extend `photo-uploader.js` to handle file selection from all three input methods, upload sequentially with progress, and queue the uploaded-photo IDs for the tag modal (Task 6).

**Files:**
- Modify: `assets/js/photo-uploader.js`

- [ ] **Step 5.1: Replace the `refresh` + `_renderGrid` region with full implementation**

Inside the `mountPhotoUploader` function, add the following helper functions before `destroy` (right after `_renderGrid`):

```js
    function _setErr(msg) {
      const el = containerEl.querySelector('[data-pu-err]');
      if (!el) return;
      if (msg) { el.textContent = msg; el.classList.remove('d-none'); }
      else      { el.textContent = '';  el.classList.add('d-none');    }
    }

    function _setProgress(done, total, filename) {
      const wrap = containerEl.querySelector('[data-pu-progress]');
      if (!wrap) return;
      if (total <= 0) { wrap.classList.add('d-none'); return; }
      wrap.classList.remove('d-none');
      const pct  = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
      const bar  = wrap.querySelector('.progress-bar');
      const lbl  = wrap.querySelector('[data-pu-count]');
      if (bar) bar.style.width = pct + '%';
      if (lbl) lbl.textContent = `${done}/${total}` + (filename ? ` — ${filename}` : '');
    }

    async function _handleFiles(fileList) {
      if (!options.projectId) {
        _toast('Sla het project eerst op.', 'warning');
        return;
      }
      const files = Array.from(fileList || []).filter(f => f && f.type.startsWith('image/'));
      if (files.length === 0) return;
      _setErr('');

      const uploadedIds = [];
      const localThumbs = [];   // [{ id, blobUrl }] for the tag modal preview
      _setProgress(0, files.length, files[0].name);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        _setProgress(i, files.length, file.name);
        try {
          // Generate thumb once for the preview blob; pass to upload as well.
          // uploadProjectPhotoWithThumb re-generates internally, which costs a
          // second pass — acceptable for simplicity and guarantees the stored
          // thumb matches MAX_SIDE/QUALITY even if we later tweak them.
          const docId = await uploadProjectPhotoWithThumb(options.projectId, file, { tag: 'situatie' });
          uploadedIds.push(docId);
          const previewThumb = await makeThumbnail(file);
          localThumbs.push({ id: docId, blobUrl: URL.createObjectURL(previewThumb.blob), name: file.name });
        } catch (e) {
          _toast('Foto upload mislukt: ' + (e && e.message ? e.message : e), 'danger');
          _setErr('Foto upload mislukt: ' + (e && e.message ? e.message : e));
          break;
        }
      }
      _setProgress(files.length, files.length);
      // Hide progress after a short dwell so the user sees the "N/N" state.
      setTimeout(() => _setProgress(0, 0), 800);

      // Re-render the grid from Firestore so the new uploads appear.
      await refresh();

      if (uploadedIds.length > 0) {
        _openTagModal(uploadedIds, localThumbs);
      }

      if (typeof options.onChange === 'function') {
        try { await options.onChange(); } catch {}
      }
    }

    // Placeholder for Task 6.
    function _openTagModal(ids, localThumbs) {
      // Free blob URLs even if the modal isn't wired yet.
      setTimeout(() => localThumbs.forEach(t => URL.revokeObjectURL(t.blobUrl)), 100);
    }
```

- [ ] **Step 5.2: Wire input event handlers inside `mountPhotoUploader`**

Right before `// Initial render (no blocking).`:

```js
    // Camera input
    const camInput = containerEl.querySelector('[data-pu-camera]');
    if (camInput) {
      camInput.addEventListener('change', async e => {
        if (e.target.files && e.target.files.length) await _handleFiles(e.target.files);
        camInput.value = '';
      });
    }

    // Gallery input
    const galInput = containerEl.querySelector('[data-pu-gallery]');
    if (galInput) {
      galInput.addEventListener('change', async e => {
        if (e.target.files && e.target.files.length) await _handleFiles(e.target.files);
        galInput.value = '';
      });
    }

    // Drop-zone (desktop only; hidden under md via Bootstrap `d-md-block`).
    const drop = containerEl.querySelector('[data-pu-drop]');
    if (drop) {
      drop.removeAttribute('hidden');
      drop.addEventListener('dragover', e => {
        e.preventDefault(); drop.classList.add('drag-over');
      });
      drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
      drop.addEventListener('drop', async e => {
        e.preventDefault(); drop.classList.remove('drag-over');
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) await _handleFiles(files);
      });
      // Clicking the drop-zone also opens the gallery picker
      drop.addEventListener('click', () => {
        if (galInput) galInput.click();
      });
    }
```

- [ ] **Step 5.3: Manual verification**

Re-mount on dashboard.html as in Step 4.3. Now:

1. Click "Foto maken" / "Uit galerij kiezen" — pick 2 images. Expected: progress bar shows `0/2`, `1/2`, `2/2`; after a moment grid re-renders with both new photos at the top (sorted by `uploadedAt desc`).
2. Drag 2 files onto the drop-zone (desktop only). Expected: same behavior.
3. Force a failure: temporarily disable network in DevTools, retry upload. Expected: error toast appears; progress hides.

- [ ] **Step 5.4: Commit**

```bash
git add assets/js/photo-uploader.js
git commit -m "feat(photo-uploader): wire camera/gallery/drop-zone upload with progress

Sequential upload per file; progress bar shows N/N with filename;
default tag='situatie' at upload; new photos appear in grid after
refresh; onChange callback invoked."
```

---

## Task 6: Tag modal (after-upload popup)

Bootstrap modal with one row per just-uploaded photo (thumbnail + radio `Situatie`/`Serieel`). Bulk buttons `Alles → Situatie` / `Alles → Serieel`. Save via Firestore `WriteBatch`.

**Files:**
- Modify: `assets/js/photo-uploader.js`

- [ ] **Step 6.1: Inject the modal into the DOM once, globally**

At the top of `photo-uploader.js`, below the IIFE opening, add a lazy-singleton helper:

```js
  function _ensureModalEl() {
    let el = document.getElementById('pu-tag-modal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'pu-tag-modal';
    el.className = 'modal fade';
    el.setAttribute('tabindex', '-1');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="fa-solid fa-tags me-2"></i>Foto's taggen</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluit"></button>
          </div>
          <div class="modal-body">
            <div class="d-flex gap-2 mb-3">
              <button type="button" class="btn btn-sm btn-outline-primary" data-pu-bulk="situatie">
                <i class="fa-solid fa-camera me-1"></i> Alles → Situatie
              </button>
              <button type="button" class="btn btn-sm btn-outline-primary" data-pu-bulk="serial">
                <i class="fa-solid fa-barcode me-1"></i> Alles → Serieel
              </button>
            </div>
            <div data-pu-modal-list></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuleren</button>
            <button type="button" class="btn btn-primary" data-pu-modal-save>Opslaan</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);
    return el;
  }
```

- [ ] **Step 6.2: Replace the `_openTagModal` stub with real logic**

Inside `mountPhotoUploader`:

```js
    function _openTagModal(uploadedIds, localThumbs) {
      if (!uploadedIds || uploadedIds.length === 0) return;
      const el = _ensureModalEl();
      const list = el.querySelector('[data-pu-modal-list]');
      const thumbByIdMap = new Map(localThumbs.map(t => [t.id, t]));

      // Render rows — one per uploaded photo
      list.innerHTML = uploadedIds.map(id => {
        const t = thumbByIdMap.get(id) || { blobUrl: '', name: '' };
        return `
          <div class="d-flex align-items-center gap-3 mb-2 pb-2 border-bottom" data-pu-modal-row data-photo-id="${_esc(id)}">
            <img src="${_esc(t.blobUrl)}" alt="${_esc(t.name)}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;" />
            <div class="flex-grow-1">
              <div class="small text-muted text-truncate" style="max-width:200px;">${_esc(t.name)}</div>
              <div class="btn-group btn-group-sm mt-1" role="group">
                <input type="radio" class="btn-check" name="tag-${_esc(id)}" id="tag-${_esc(id)}-s" value="situatie" checked />
                <label class="btn btn-outline-primary" for="tag-${_esc(id)}-s"><i class="fa-solid fa-camera me-1"></i>Situatie</label>
                <input type="radio" class="btn-check" name="tag-${_esc(id)}" id="tag-${_esc(id)}-r" value="serial" />
                <label class="btn btn-outline-primary" for="tag-${_esc(id)}-r"><i class="fa-solid fa-barcode me-1"></i>Serieel</label>
              </div>
            </div>
          </div>`;
      }).join('');

      // Bulk handlers
      el.querySelectorAll('[data-pu-bulk]').forEach(btn => {
        btn.onclick = () => {
          const target = btn.getAttribute('data-pu-bulk');
          list.querySelectorAll('[data-pu-modal-row]').forEach(row => {
            const id = row.getAttribute('data-photo-id');
            const radio = row.querySelector(`input[name="tag-${id}"][value="${target}"]`);
            if (radio) radio.checked = true;
          });
        };
      });

      // Save handler — Firestore WriteBatch, only patch non-default tags
      const saveBtn = el.querySelector('[data-pu-modal-save]');
      saveBtn.onclick = async () => {
        saveBtn.disabled = true;
        const btnOrig = saveBtn.textContent;
        saveBtn.textContent = 'Opslaan…';
        try {
          const db = firebase.firestore();
          const batch = db.batch();
          let patches = 0;
          uploadedIds.forEach(id => {
            const checked = list.querySelector(`input[name="tag-${id}"]:checked`);
            const tag = checked && checked.value === 'serial' ? 'serial' : 'situatie';
            if (tag !== 'situatie') {
              const ref = db.collection('projects').doc(options.projectId).collection('photos').doc(id);
              batch.update(ref, { tag });
              patches++;
            }
          });
          if (patches > 0) await batch.commit();
          bootstrap.Modal.getOrCreateInstance(el).hide();
          await refresh();
          if (typeof options.onChange === 'function') { try { await options.onChange(); } catch {} }
        } catch (e) {
          _toast('Tags opslaan mislukt: ' + (e && e.message ? e.message : e), 'danger');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = btnOrig;
        }
      };

      // Cleanup blob URLs when modal closes (either via save or dismiss)
      const onHidden = () => {
        localThumbs.forEach(t => { try { URL.revokeObjectURL(t.blobUrl); } catch {} });
        el.removeEventListener('hidden.bs.modal', onHidden);
      };
      el.addEventListener('hidden.bs.modal', onHidden);

      bootstrap.Modal.getOrCreateInstance(el).show();
    }
```

- [ ] **Step 6.3: Manual verification**

On dashboard.html, re-mount the probe as in Step 4.3. Upload 3 photos. Expected:
- Modal appears with 3 rows, each showing the local thumbnail preview
- Click `Alles → Serieel` → all radios flip to Serieel
- Click one row back to Situatie
- `Opslaan` → modal closes, grid re-renders, barcode-icons visible on the 2 serial photos, camera-icon on the 1 situatie photo
- Open Firestore console, inspect photo docs: `tag` field matches

Also verify the cancel path: upload 1 photo, click the `×` close button → photo remains in grid with default `situatie` tag (no data loss).

- [ ] **Step 6.4: Commit**

```bash
git add assets/js/photo-uploader.js
git commit -m "feat(photo-uploader): after-upload tag modal

Bootstrap modal shows thumbnail + Situatie/Serieel toggle per photo,
plus Alles→Situatie / Alles→Serieel bulk buttons. Save uses
Firestore WriteBatch. Cancel keeps the default 'situatie' tag."
```

---

## Task 7: Lightbox + lazy backfill integration

Wire the grid tiles to open a lightbox (full blob). Kick off backfill for photos rendered without `thumbStoragePath`, one at a time.

**Files:**
- Modify: `assets/js/photo-uploader.js`

- [ ] **Step 7.1: Add lightbox helpers + backfill queue inside `mountPhotoUploader`**

Place this block right after `_renderGrid`:

```js
    function _openLightbox(startIdx) {
      state.lightboxIdx = startIdx;
      let lb = document.getElementById('pu-lightbox');
      if (!lb) {
        lb = document.createElement('div');
        lb.id = 'pu-lightbox';
        lb.className = 'sp-lightbox';
        lb.innerHTML = `
          <button type="button" class="sp-lightbox-btn close" title="Sluit">×</button>
          <button type="button" class="sp-lightbox-btn prev" title="Vorige">‹</button>
          <button type="button" class="sp-lightbox-btn next" title="Volgende">›</button>
          <button type="button" class="sp-lightbox-btn del" title="Verwijder foto"><i class="fa-solid fa-trash"></i></button>
          <img data-pu-lightbox-img alt="" />
        `;
        document.body.appendChild(lb);
        lb.querySelector('.close').addEventListener('click', _closeLightbox);
        lb.querySelector('.prev').addEventListener('click',  e => { e.stopPropagation(); _navLightbox(-1); });
        lb.querySelector('.next').addEventListener('click',  e => { e.stopPropagation(); _navLightbox(+1); });
        lb.querySelector('.del').addEventListener('click',   async e => {
          e.stopPropagation();
          const photo = state.photos[state.lightboxIdx];
          if (!photo) return;
          if (!confirm('Deze foto verwijderen?')) return;
          try {
            await deleteProjectPhoto(options.projectId, photo.id, photo.storagePath, photo.thumbStoragePath || null);
            await refresh();
            if (state.photos.length === 0) _closeLightbox();
            else {
              state.lightboxIdx = Math.min(state.lightboxIdx, state.photos.length - 1);
              _refreshLightboxImg();
            }
            if (typeof options.onChange === 'function') { try { await options.onChange(); } catch {} }
          } catch (err) {
            _toast('Verwijderen mislukt: ' + (err && err.message ? err.message : err), 'danger');
          }
        });
        lb.addEventListener('click', e => { if (e.target === lb) _closeLightbox(); });
        document.addEventListener('keydown', e => {
          if (!lb.classList.contains('open')) return;
          if      (e.key === 'Escape')     _closeLightbox();
          else if (e.key === 'ArrowLeft')  _navLightbox(-1);
          else if (e.key === 'ArrowRight') _navLightbox(+1);
        });
      }
      _refreshLightboxImg();
      lb.classList.add('open');
    }
    function _refreshLightboxImg() {
      const img = document.querySelector('#pu-lightbox [data-pu-lightbox-img]');
      const p   = state.photos[state.lightboxIdx];
      if (img && p && p.downloadUrl) img.src = p.downloadUrl;
    }
    function _navLightbox(delta) {
      if (!state.photos.length) return;
      state.lightboxIdx = (state.lightboxIdx + delta + state.photos.length) % state.photos.length;
      _refreshLightboxImg();
    }
    function _closeLightbox() {
      const lb = document.getElementById('pu-lightbox');
      if (lb) lb.classList.remove('open');
    }

    // Lazy backfill — one at a time, fail-soft.
    async function _drainBackfillQueue() {
      if (state.backfillBusy) return;
      state.backfillBusy = true;
      try {
        while (state.backfillQueue.length > 0) {
          const photoId = state.backfillQueue.shift();
          const photo = state.photos.find(p => p.id === photoId);
          if (!photo || photo.thumbStoragePath) continue;
          try {
            await backfillThumbnail(options.projectId, photo);
            // re-load URLs for this photo only
            const updated = await listProjectPhotos(options.projectId);
            state.photos = updated;
            _renderGrid();
          } catch (e) {
            console.warn('[photo-uploader] backfill failed for', photoId, e);
          }
        }
      } finally {
        state.backfillBusy = false;
      }
    }
```

- [ ] **Step 7.2: Extend `_renderGrid` to wire tile clicks + enqueue backfills**

Replace the existing `_renderGrid` with:

```js
    function _renderGrid() {
      const grid = containerEl.querySelector('[data-pu-grid]');
      if (!grid) return;
      if (state.photos.length === 0) {
        grid.innerHTML = '<p class="sp-empty-state">Nog geen foto\'s geüpload.</p>';
        return;
      }
      grid.innerHTML = state.photos.map((p, i) => {
        const src = p.thumbUrl || p.downloadUrl;
        if (!src) {
          return `<div class="photo-tile broken" title="${_esc(p.fetchError || 'Kon foto niet laden')}">${_esc(p.name || 'onbekend')}</div>`;
        }
        const tagIcon = p.tag === 'serial' ? 'fa-barcode' : 'fa-camera';
        return `<div class="photo-tile" data-pu-tile data-idx="${i}">
          <img src="${_esc(src)}" alt="${_esc(p.name || '')}" />
          <span class="pu-tag-indicator" title="${p.tag === 'serial' ? 'Serieel' : 'Situatie'}"><i class="fa-solid ${tagIcon}"></i></span>
        </div>`;
      }).join('');
      grid.querySelectorAll('[data-pu-tile]').forEach(tile => {
        tile.addEventListener('click', () => _openLightbox(parseInt(tile.dataset.idx, 10)));
      });
      // Queue backfills for any photo rendering from the full-size URL.
      state.photos.forEach(p => {
        if (!p.thumbStoragePath && p.downloadUrl && !state.backfillQueue.includes(p.id)) {
          state.backfillQueue.push(p.id);
        }
      });
      _drainBackfillQueue();
    }
```

- [ ] **Step 7.3: Manual verification**

On dashboard.html after sign-in:
1. Open a project with existing photos (pre-2026-04-23) — grid should show them via full-URL initially. Watch the network tab: thumb PUT requests appear as backfill runs; after ~1-2 s the grid swaps to thumb URLs.
2. Click any tile — lightbox opens with the full-size image, prev/next/escape all work.
3. Click the lightbox trash button — confirm → photo (and its thumb, if any) is removed from Storage + Firestore; grid re-renders.
4. Upload a new photo via the component — lightbox for that photo loads the full-size.

Open Firebase Storage and verify that backfilled thumbs land at `projects/<id>/<ts>_<name>_thumb.jpg`.

- [ ] **Step 7.4: Commit**

```bash
git add assets/js/photo-uploader.js
git commit -m "feat(photo-uploader): lightbox + lazy thumbnail backfill

Clicking a tile opens full-size lightbox with prev/next/delete/Escape.
Photos without thumbStoragePath are queued for backfill (one at a time,
fail-soft); after successful backfill the grid re-renders with the
newly-generated thumb URL."
```

---

## Task 8: CSS polish — tag indicator + drop-zone reset

Adds a small `.pu-tag-indicator` badge style; reuses existing `.photo-grid`, `.photo-tile`, `.sp-drop-zone`, `.sp-lightbox` from `smartpeak.css`.

**Files:**
- Modify: `assets/css/smartpeak.css`

- [ ] **Step 8.1: Append tag-indicator CSS**

Add to the end of `smartpeak.css`:

```css
/* ─── Photo-uploader component ─────────────────────────────────────── */
.photo-tile { position: relative; }
.pu-tag-indicator {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border-radius: 50%;
  font-size: 11px;
  pointer-events: none;
}
.pu-progress .progress-bar { transition: width 0.15s ease; }
```

- [ ] **Step 8.2: Manual verification**

Reload dashboard.html. Expected: tag-indicator is a circular pill, bottom-right of each tile, 22 px wide, semi-transparent black bg with a white icon.

- [ ] **Step 8.3: Commit**

```bash
git add assets/css/smartpeak.css
git commit -m "style(photos): tag-indicator badge for photo tiles"
```

---

## Task 9: Replace inline drawer photo block in `dashboard.html`

Swap the current inline `drawerPhotoGrid` / upload-button / `renderPhotos` / `openLightbox` / `_drawerPhotos` system for a `mountPhotoUploader` call scoped to the drawer's photo section.

**Files:**
- Modify: `dashboard.html`

- [ ] **Step 9.1: Replace the photos-section DOM in `renderDrawer`**

Find the photos-section `sections.push(...)` block (around line 698-708) and replace the whole template literal with:

```js
  sections.push(`
    <section class="border-bottom pb-3 mb-3" id="drawerPhotosSection">
      <h6 class="mb-2 text-uppercase text-muted"><i class="fa-solid fa-images" aria-hidden="true"></i> Foto's <span id="drawerPhotosCount" class="text-muted fw-normal"></span></h6>
      <div id="drawerPhotoUploader"></div>
    </section>
  `);
```

- [ ] **Step 9.2: Replace the upload button wire-up**

Find the `document.getElementById('drawerPhotoUploadBtn').addEventListener(...)` block (around line 743-763) and delete it entirely. Also delete the legacy `renderPhotos`, `openLightbox`, `refreshLightboxImage`, `navLightbox`, `closeLightbox` functions (below line 812 through the end of the old block) and the `_drawerPhotos` / `_lightboxIdx` module-level variables — all of this moves into the shared component.

- [ ] **Step 9.3: Replace `renderPhotos` calls with component mount/refresh**

Find `openDrawer(projectId)` (around line 549). In the `Promise.all([...])`  block at ~line 572-582, after the `renderComments(project, comments)` call, replace the line `renderPhotos(project, photos);` with:

```js
      _drawerPhotoUploader = mountPhotoUploader(document.getElementById('drawerPhotoUploader'), {
        projectId: project.id,
        onChange: refreshDrawerAfterChange,
      });
      const countEl = document.getElementById('drawerPhotosCount');
      if (countEl) countEl.textContent = photos.length > 0 ? `(${photos.length})` : '';
```

Also **remove** the `listProjectPhotos(project.id)` call inside the `Promise.all` — the component fetches photos itself. Simplify to:

```js
    Promise.all([
      listComments(project.id),
    ]).then(([comments]) => {
      renderComments(project, comments);
      _drawerPhotoUploader = mountPhotoUploader(document.getElementById('drawerPhotoUploader'), {
        projectId: project.id,
        onChange: refreshDrawerAfterChange,
      });
    });
```

- [ ] **Step 9.4: Add the `_drawerPhotoUploader` state variable and `refreshDrawerAfterChange` helper**

At the top of the script block in dashboard.html (near `let _cache = ...`), add:

```js
let _drawerPhotoUploader = null;
```

And a helper near the other drawer helpers:

```js
async function refreshDrawerAfterChange() {
  // Bump the photo count header when the uploader emits onChange.
  const countEl = document.getElementById('drawerPhotosCount');
  if (!countEl || !_drawerPhotoUploader) return;
  try {
    const photos = await listProjectPhotos(_drawerProjectId);
    countEl.textContent = photos.length > 0 ? `(${photos.length})` : '';
  } catch {}
}
```

- [ ] **Step 9.5: Update the `closeDrawer` path to destroy the component**

Find `closeDrawer` and add:

```js
  if (_drawerPhotoUploader) {
    try { _drawerPhotoUploader.destroy(); } catch {}
    _drawerPhotoUploader = null;
  }
```

- [ ] **Step 9.6: Remove the legacy "Re-populate the async sections" photos refresh**

Around line 535-545, the `refreshDrawerForProject` logic re-loads photos via `renderPhotos`. Simplify: now the component owns refresh. Replace the `renderPhotos(fresh, photos);` line with:

```js
    if (_drawerPhotoUploader) await _drawerPhotoUploader.refresh();
```

And remove the photos fetch from the `Promise.all`.

- [ ] **Step 9.7: Manual verification**

1. Open `http://localhost:8000/dashboard.html`, click any project row → drawer opens.
2. Expected: photos section shows "Foto maken" + "Uit galerij kiezen" buttons (now present on mobile!), grid of existing photos with tag-indicators.
3. Upload a photo via `Uit galerij kiezen` → progress → tag modal → choose Serieel → Opslaan → barcode icon appears on the new tile.
4. Click a tile → lightbox opens, prev/next works.
5. Close drawer + re-open another project → uploader rebuilds cleanly, no stale photos from the first project.
6. Refresh drawer (e.g. by uploading an offerte PDF which triggers drawer refresh) → photos list updates.

- [ ] **Step 9.8: Commit**

```bash
git add dashboard.html
git commit -m "refactor(dashboard): drawer photos use shared mountPhotoUploader

Removes inline renderPhotos/openLightbox/upload-button; drawer now
has camera + gallery + drop-zone + tag-modal via the shared component.
Photo-count header synchronized via onChange callback."
```

---

## Task 10: Replace inline Blok D photo block in `project-edit.html` + retire serial photos

Swap the project-edit Blok D inline photo system for a `mountPhotoUploader` call. Remove the per-serial `fa-camera` / `fa-eye` buttons in `_renderSerialRow`; keep the text input + delete button.

**Files:**
- Modify: `project-edit.html`

- [ ] **Step 10.1: Replace the Blok D photo block markup**

Find the block starting at "Algemene foto's (plaatsbezoek)" header (around line 840) down through the `<div id="pePhotoErr">` line. Replace the whole photo-block with:

```html
        <h6 class="text-muted mb-2">Foto's (plaatsbezoek &amp; serienummers)</h6>
        <div id="peBlokDPhotoUploader"></div>
        <hr class="my-3" />
```

Keep the serial-numbers heading + `peSerialList` as-is.

- [ ] **Step 10.2: Rewrite `_renderSerialRow` — drop camera/eye**

Find `_renderSerialRow` (around line 876) and replace with:

```js
function _renderSerialRow(s) {
  const isNew = s.id === '_new';
  return `
    <div class="serial-row" data-serial-id="${s.id}">
      <input type="text" class="form-control" placeholder="Serienummer&hellip;" value="${escapeHtml(s.value || '')}" data-serial-field="value" />
      <div class="serial-actions">
        ${isNew ? '' : `<button type="button" class="btn btn-sm btn-outline-danger" title="Verwijderen" data-serial-delete="${s.id}"><i class="fa-solid fa-xmark"></i></button>`}
      </div>
    </div>
  `;
}
```

- [ ] **Step 10.3: Rewrite `wireBlokD` to mount the component**

Find `wireBlokD` (around line 892) and replace the photo-related section (everything before the "Serials — value typing" comment) with:

```js
function wireBlokD() {
  // Photo uploader (shared component)
  const uploaderHost = document.getElementById('peBlokDPhotoUploader');
  if (uploaderHost) {
    mountPhotoUploader(uploaderHost, {
      projectId: PROJECT_ID || null,
      onChange: null,
    });
  }

  // (... existing serial-wire code below stays unchanged ...)
```

Delete:
- The `onPhotoFiles` block
- The `cam.addEventListener` / `gal.addEventListener` lines
- The `wireSectionPhotos()` call

Also search for any remaining references to `_photos`, `renderPhotoGrid`, `wireSectionPhotos`, and the per-serial photo handlers (`data-serial-photo`, `data-serial-view`) — remove them. The `[data-serial-photo]` / `[data-serial-view]` click/change handlers are now dead.

- [ ] **Step 10.4: Delete dead helpers**

Search for and delete the following function definitions in `project-edit.html`:
- `function renderPhotoGrid()` (was used only by the old block)
- `function wireSectionPhotos()` 
- The `let _photos = [];` line
- Any `[data-serial-photo]` event listener registration
- Any `[data-serial-view]` event listener registration

Use grep to find them first:

```bash
grep -n "_photos\|renderPhotoGrid\|wireSectionPhotos\|data-serial-photo\|data-serial-view" project-edit.html
```

Review each hit; all should be deletable (the shared component replaces the photo parts; the serial-photo UI is retired).

- [ ] **Step 10.5: Manual verification**

1. Open `http://localhost:8000/project-edit.html?project=<id>`.
2. Blok D renders: photo-uploader (buttons + grid + drop-zone + indicator), then horizontal rule, then serial-numbers list.
3. Upload a photo — progress + modal + grid updates, lightbox works, all identical to the dashboard drawer.
4. Serial rows have only text input + delete button (no camera, no eye). Add a serial, delete a serial — works.
5. Open a legacy project with `photoStoragePath` on serial entries → serial rows render as plain text (the legacy field is silently ignored), photo grid renders ONLY the general photos from the `photos` subcollection (serial photos do NOT appear there — they were a separate per-serial blob, which remains as orphaned data, not surfaced anywhere).
6. Check that `new-project` mode (no `?project=`) still works: uploader shows "Sla het project eerst op..." empty state; after saving, page re-renders and upload becomes active (this happens automatically because the page reloads after `createProject`).

- [ ] **Step 10.6: Commit**

```bash
git add project-edit.html
git commit -m "refactor(project-edit): Blok D photos use shared uploader, retire serial camera

Blok D photo block replaced with mountPhotoUploader. Serial rows are now
plain text inputs + delete button (per-serial fa-camera / fa-eye removed).
Legacy photoStoragePath on serial entries is no-op."
```

---

## Task 11: Retire the old `uploadProjectPhoto` helper

After Tasks 9 + 10 there are no more callers. Remove the dead code to keep the file clean.

**Files:**
- Modify: `assets/js/firebase-init.js`

- [ ] **Step 11.1: Confirm no callers**

```bash
grep -rn "uploadProjectPhoto\b" /home/ubuntu/battery-roi-tool --include="*.html" --include="*.js" | grep -v uploadProjectPhotoWithThumb | grep -v firebase-init.js
```

Expected: zero matches. If any match remains, stop and fix those call-sites before proceeding.

- [ ] **Step 11.2: Delete the old helper**

In `firebase-init.js`, find `async function uploadProjectPhoto(projectId, file)` (the original ~32-line function from around line 486) and delete it along with its blank-line separator. Do NOT delete `uploadProjectPhotoWithThumb` — they are different functions.

- [ ] **Step 11.3: Manual verification**

Reload `dashboard.html` + `project-edit.html`; walk the full upload flow in both. Expected: no `ReferenceError: uploadProjectPhoto is not defined` in DevTools console.

- [ ] **Step 11.4: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "chore(photos): remove dead uploadProjectPhoto helper

Superseded by uploadProjectPhotoWithThumb (via shared photo-uploader
component)."
```

---

## Task 12: Update `CLAUDE.md`

Reflect the new structure so future sessions don't reinvent it.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 12.1: Update the relevant paragraph**

Find the sentence starting with "**Blok D · "Foto's & serienummers"**" (around line 72 of CLAUDE.md) and replace the whole blok-D bullet with:

```md
  - **Blok D · "Foto's & serienummers"** — één gedeelde foto-uploader
    component (`assets/js/photo-uploader.js`) voor plaatsbezoek- én
    serienummer-foto's, gevolgd door een dynamische serienummer-lijst met
    enkel tekstvelden + delete (per-serial camera-knop is gepensioneerd —
    alle foto's gaan in de gedeelde pool). Zie ook `dashboard.html`
    drawer die hetzelfde component mount.
```

- [ ] **Step 12.2: Add a new "Shared photo-uploader component" paragraph**

After the Bootstrap 5.3.3 migration section (before "## How to work on it"), add:

```md
## Shared photo-uploader component (2026-04-23)

`assets/js/photo-uploader.js` bevat één `mountPhotoUploader(containerEl, opts)`
factory die het volledige foto-systeem rendert: camera + gallery + drop-zone,
progress-balk, foto-grid met tag-indicator, lightbox, en after-upload
tag-modal. Gebruikt in `dashboard.html` drawer (`#drawerPhotoUploader`) en
`project-edit.html` Blok D (`#peBlokDPhotoUploader`). Meerdere instanties op
dezelfde page zijn safe — alle state is scoped aan de container.

**Twee image-versies per foto** — client-side canvas genereert bij upload een
thumbnail van max 400 px langste zijde (JPEG q=0.82). Full-versie gaat naar
`projects/{id}/{ts}_{name}`, thumb naar `projects/{id}/{ts}_{name}_thumb.jpg`.
Firestore photo-doc krijgt `thumbStoragePath`, `width`, `height`, `tag`
('situatie' | 'serial'). Grid-views laden thumbs, lightbox laadt full.

**Tag-modal** opent automatisch na elke upload (bulk of 1); default is
`situatie`, met `Alles → Situatie` / `Alles → Serieel` bulk-knoppen. Save via
Firestore `WriteBatch`. Cancel behoudt de defaults, geen dataverlies.

**Lazy backfill** — photos zonder `thumbStoragePath` (pre-2026-04-23) genereren
bij het eerste render een thumb via `backfillThumbnail()` en patchen het
Firestore doc. Throttled op één tegelijk per component-instance; fail-soft
(console.warn, grid blijft full-URL tonen).

**Retired** — `uploadProjectSerialPhoto` / `getSerialPhotoUrl` en de
`photoStoragePath` op `serialNumbers[]` entries zijn legacy-data. De UI-knoppen
`fa-camera` / `fa-eye` per serial-rij zijn verwijderd; serial-rijen hebben nu
enkel een tekstveld + delete. De oude `uploadProjectPhoto` is ook verwijderd.
```

- [ ] **Step 12.3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document shared photo-uploader + retired serial camera"
```

---

## Task 13: Full integration test + merge to `gh-pages`

**Files:** none modified; verification + git operation only.

- [ ] **Step 13.1: End-to-end checklist**

Run `python3 -m http.server 8000` from `.worktrees/photo-thumbnails/`. Open `http://localhost:8000/dashboard.html` signed in as Kevin or Ruben.

- **Dashboard drawer path:**
  - [ ] Open a project with ≥ 3 legacy photos. Grid appears via full-URLs initially; within a few seconds thumbs swap in. Firestore docs get `thumbStoragePath` populated.
  - [ ] Upload 3 new photos via gallery button. Progress bar ticks `0/3 → 3/3`. Modal opens. Apply `Alles → Serieel`, change one back to Situatie, Save. Icons update on tiles.
  - [ ] Lightbox: click tile, navigate prev/next/Escape, delete one photo, verify Storage AND Firestore are cleaned up.

- **Project-edit Blok D path:**
  - [ ] Open the same project at `project-edit.html?project=<id>`. Blok D shows the same photos + tag indicators.
  - [ ] Upload 1 photo via camera button on a mobile emulator (Chrome DevTools). Modal opens. Save as Situatie.
  - [ ] Add a serial number, delete it — plain input, no camera button.
  - [ ] Refresh the page; serials + photos both persist.

- **Calculator path:**
  - [ ] `index.html?project=<id>` — page loads, no photos UI visible (unchanged).
  - [ ] Share link `?s=<existing share id>` — read-only, no photos UI (unchanged).

- **Offerte upload path (regression check):**
  - [ ] In the drawer, upload an offerte PDF for a config. Drawer refreshes (via `refreshDrawerAfterChange`), photo count stays correct, photo grid unaffected.

- [ ] **Step 13.2: Merge to `gh-pages`**

```bash
cd /home/ubuntu/battery-roi-tool
git checkout gh-pages
git pull origin gh-pages
git merge --ff-only feat/photo-thumbnails
git push origin gh-pages
```

If the fast-forward fails because `gh-pages` advanced: `git rebase gh-pages` inside the worktree first, then merge.

- [ ] **Step 13.3: Cleanup worktree**

```bash
git worktree remove .worktrees/photo-thumbnails
git branch -d feat/photo-thumbnails
```

- [ ] **Step 13.4: Post-deploy smoke test**

Wait ~1 min for the GitHub Pages CDN. Open `https://smartpeak-be.github.io/battery-roi-tool/dashboard.html` (or the configured domain) and run the same end-to-end checklist on a real device (ideally one phone + one laptop). Report any regressions.

---

## Self-review notes

**Spec coverage** — every spec section (architecture / data model / upload / display / backfill / retire / testing) is implemented by at least one task. Mapping:
- Architecture + component API → Task 4
- Data model + `uploadProjectPhotoWithThumb` → Task 2
- Upload flow + progress → Task 5
- Tag modal → Task 6
- Grid + lightbox + lazy backfill → Task 7
- Serial-retire → Task 10
- Styling → Task 8
- Dashboard integration → Task 9
- Project-edit integration → Task 10
- Backwards compat → Task 3 (`backfillThumbnail`) + Task 7 (integration)
- CLAUDE.md update → Task 12

**Placeholder scan** — grep for `TBD|TODO|...later|similar to` in this plan → none present. Every code block is complete.

**Type/name consistency** — `mountPhotoUploader` signature `(containerEl, opts)` used consistently; the returned `{ refresh, destroy }` handle is referenced in Tasks 4, 9 (`_drawerPhotoUploader.destroy()`), and 10. Field names on the Firestore photo doc (`thumbStoragePath`, `width`, `height`, `tag`) are used consistently across Tasks 2, 3, 7.

**Open item:** the Firestore `update` rule on `projects/{id}/photos/{photoId}` (for tag + backfill writes) must be confirmed in Task 3.3. If it's missing, add `allow update: if isWhitelisted();` to the rules before deploy.
