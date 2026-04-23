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
      photos:         [],
      lightboxIdx:    0,
      backfillBusy:   false,
      backfillQueue:  [],
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
    }

    function destroy() {
      containerEl.innerHTML = '';
    }

    refresh();

    return { refresh, destroy };
  }

  global.mountPhotoUploader = mountPhotoUploader;
})(window);
