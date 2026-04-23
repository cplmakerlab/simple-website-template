/* global firebase, bootstrap, makeThumbnail, uploadProjectPhotoWithThumb, listProjectPhotos,
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
      photos:         [],
      lightboxIdx:    0,
      backfillBusy:   false,
      backfillQueue:  [],
      uploadBusy:     false,
    };

    async function refresh() {
      if (!options.projectId) {
        const grid = containerEl.querySelector('[data-pu-grid]');
        if (!grid) return;
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
        const isSerial = p.tag === 'serial';
        const tagIcon  = isSerial ? 'fa-barcode' : 'fa-camera';
        const tagLabel = isSerial ? 'Serieel'    : 'Situatie';
        return `<div class="photo-tile" data-pu-tile data-idx="${i}">
          <img src="${_esc(src)}" alt="${_esc(p.name || '')}" />
          <span class="pu-tag-indicator" title="${_esc(tagLabel)}"><i class="fa-solid ${_esc(tagIcon)}"></i></span>
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
      if (state.uploadBusy) {
        _toast('Even wachten — vorige upload nog bezig.', 'warning');
        return;
      }
      state.uploadBusy = true;
      try {
        if (!options.projectId) {
          _toast('Sla het project eerst op.', 'warning');
          return;
        }
        const files = Array.from(fileList || []).filter(f => f && f.type.startsWith('image/'));
        if (files.length === 0) return;
        _setErr('');

        const uploadedIds = [];
        const localThumbs = [];
        _setProgress(0, files.length, files[0].name);

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          _setProgress(i, files.length, file.name);
          try {
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
        _setProgress(uploadedIds.length, files.length);
        setTimeout(() => _setProgress(0, 0), 800);

        await refresh();

        if (uploadedIds.length > 0) {
          _openTagModal(uploadedIds, localThumbs);
        }

        if (typeof options.onChange === 'function') {
          try { await options.onChange(); } catch {}
        }
      } finally {
        state.uploadBusy = false;
      }
    }

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
            const radio = row.querySelector(`input[name="tag-${CSS.escape(id)}"][value="${target}"]`);
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
            const checked = list.querySelector(`input[name="tag-${CSS.escape(id)}"]:checked`);
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

    function destroy() {
      containerEl.innerHTML = '';
    }

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
      drop.addEventListener('click', () => {
        if (galInput) galInput.click();
      });
    }

    refresh();

    return { refresh, destroy };
  }

  global.mountPhotoUploader = mountPhotoUploader;
})(window);
