// Shared UI for the "Configs & offertes" section + upload modal.
// Used by dashboard.html (inside the project drawer) and project-edit.html
// (as a standalone block on the edit page).
//
// Public API (exposed as globals because the project has no module system):
//   ensureOfferteModal()                                   — inject #offerteModal into <body> once
//   renderOffertesSection(project)                         — returns section HTML
//   wireOffertesClicks(containerEl, getProjectFn, onChange) — delegated click handler
//   openOfferteModal(project, configType, onUploaded)      — show upload modal
//   closeOfferteModal()                                    — hide upload modal
//
// The caller is responsible for:
//   - Including firebase-init.js (uploadProjectOfferte, deleteProjectOfferte,
//     deleteProjectConfig, effectiveBtwFor) before this file.
//   - Providing `escapeHtml(s)` and `showToast(msg, variant)` on the page.
//   - Calling ensureOfferteModal() once during page init.
//   - Re-rendering via `onChange()` (the caller's refresh function) after any mutation.

const OFFERTE_MODAL_HTML = `
  <div class="modal fade" id="offerteModal" tabindex="-1" aria-labelledby="offerteModalTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="offerteModalTitle">Offerte uploaden</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Sluiten"></button>
        </div>
        <div class="modal-body" id="offerteModalBody"></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" id="offerteModalCancel" data-bs-dismiss="modal">Annuleren</button>
        </div>
      </div>
    </div>
  </div>
`;

function ensureOfferteModal() {
  if (document.getElementById('offerteModal')) return;
  document.body.insertAdjacentHTML('beforeend', OFFERTE_MODAL_HTML);
}

function _findConfigByType(project, configType) {
  const results = project.lastCalcRun && project.lastCalcRun.results;
  const cfgResults = results && Array.isArray(results.configResults) ? results.configResults : [];
  const match = cfgResults.find(cr => cr.cfg && cr.cfg.type === configType);
  const cfg = match ? match.cfg : { type: configType, omschrijving: '' };
  const priceKey = _getProjectPriceKey(project);
  const priceEur = cfg.price || (cfg.prices && cfg.prices[priceKey]) || 0;
  return {
    type:        cfg.type || configType,
    omschrijving:cfg.omschrijving || '',
    batCap:      cfg.batCap || null,
    batInv:      cfg.batInv || null,
    priceEur
  };
}

function _getProjectPriceKey(project) {
  const btw     = (typeof effectiveBtwFor === 'function') ? effectiveBtwFor(project) : 21;
  const keuring = (project.calcDefaults && project.calcDefaults.inspectieGekozen === true) ? 'yes' : 'no';
  return `${btw}_${keuring}`;
}

function _formatEuros(v) {
  return Number(v || 0).toLocaleString('nl-BE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function _formatOfferteDate(d) {
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Inner content only — active configs grid.
// Returns '' when the project has no configs to display.
// Used by dashboard.html (wrapped in a <section>) and project-edit.html (wrapped in a .card).
function renderOffertesCards(project) {
  const types = (project.lastCalcRun && project.lastCalcRun.inputs && Array.isArray(project.lastCalcRun.inputs.selectedConfigTypes))
    ? project.lastCalcRun.inputs.selectedConfigTypes : [];
  const offertes  = project.offertes || {};
  const active = types;
  if (active.length === 0) return '';

  const activeCards = active.map(t => {
    const cfg = _findConfigByType(project, t);
    const pdf = offertes[t];
    const iconState = pdf
      ? '<i class="fa-solid fa-circle-check icon-ok" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-triangle-exclamation icon-warn" aria-hidden="true"></i>';
    const fileRow = pdf
      ? `<div class="offerte-row-pdf"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> ${escapeHtml(pdf.filename || '')}</div>`
      : `<div class="offerte-row-pdf" style="color:var(--sp-muted);">Nog geen offerte</div>`;
    const actions = pdf
      ? `<button class="btn btn-sm btn-outline-secondary offerte-download-btn" data-offerte-action data-type="${escapeHtml(t)}" title="Download PDF"><i class="fa-solid fa-download" aria-hidden="true"></i></button>
         <button class="btn btn-sm btn-outline-secondary offerte-replace-btn"  data-offerte-action data-type="${escapeHtml(t)}" title="Vervang PDF"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i></button>
         <button class="btn btn-sm btn-outline-warning   offerte-deletepdf-btn" data-offerte-action data-type="${escapeHtml(t)}" title="Alleen PDF verwijderen (config blijft)"><i class="fa-solid fa-file-circle-xmark" aria-hidden="true"></i></button>
         <button class="btn btn-sm btn-outline-danger    offerte-trash-btn"     data-offerte-action data-type="${escapeHtml(t)}" title="Config verwijderen (incl. offerte-PDF)"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>`
      : `<button class="btn btn-sm btn-outline-primary offerte-upload-btn"     data-offerte-action data-type="${escapeHtml(t)}" title="Upload offerte"><i class="fa-solid fa-upload" aria-hidden="true"></i></button>
         <button class="btn btn-sm btn-outline-danger  offerte-trash-btn"      data-offerte-action data-type="${escapeHtml(t)}" title="Config verwijderen"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>`;

    return `
      <div class="col">
        <div class="offerte-row h-100 ${pdf ? 'has-pdf' : 'missing-pdf'}">
          <div class="offerte-row-head">
            ${iconState}
            <span class="offerte-row-title">${escapeHtml(cfg.type)}</span>
          </div>
          <div class="offerte-row-desc">${escapeHtml(cfg.omschrijving || '')}</div>
          <div class="offerte-row-meta">
            € ${_formatEuros(cfg.priceEur)}${cfg.batCap ? ' · ' + escapeHtml(String(cfg.batCap)) + ' kWh' : ''}${cfg.batInv ? ' · ' + escapeHtml(String(cfg.batInv)) + ' kW' : ''}
          </div>
          ${fileRow}
          <div class="offerte-row-actions">${actions}</div>
        </div>
      </div>
    `;
  }).join('');

  return activeCards
    ? `<div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-2">${activeCards}</div>`
    : '';
}

// Section-wrapped variant for the dashboard drawer.
function renderOffertesSection(project) {
  const inner = renderOffertesCards(project);
  if (!inner) return '';
  return `
    <section class="border-bottom pb-3 mb-3 drawer-configs">
      <h6 class="mb-2 text-uppercase text-muted">Configs &amp; offertes</h6>
      ${inner}
    </section>
  `;
}

function wireOffertesClicks(containerEl, getProjectFn, onChange) {
  if (!containerEl || containerEl._offertesWired) return;
  containerEl._offertesWired = true;
  containerEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-offerte-action]');
    if (!btn) return;
    const type = btn.getAttribute('data-type');
    const project = getProjectFn();
    if (!project || !project.id || !type) return;

    try {
      if (btn.classList.contains('offerte-upload-btn') || btn.classList.contains('offerte-replace-btn')) {
        openOfferteModal(project, type, onChange);
      }
      else if (btn.classList.contains('offerte-download-btn')) {
        const pdf = (project.offertes || {})[type];
        if (!pdf || !pdf.storagePath) return;
        showSpinner();
        try {
          const url = await firebase.storage().ref(pdf.storagePath).getDownloadURL();
          window.open(url, '_blank');
        } finally {
          hideSpinner();
        }
      }
      else if (btn.classList.contains('offerte-deletepdf-btn')) {
        if (!confirm('Alleen de offerte-PDF wissen? De configuratie zelf blijft behouden.')) return;
        showSpinner();
        try {
          await deleteProjectOfferte(project.id, type);
          if (typeof onChange === 'function') await onChange();
        } finally {
          hideSpinner();
        }
      }
      else if (btn.classList.contains('offerte-trash-btn')) {
        showSpinner();
        try {
          await deleteProjectConfig(project.id, type);
          if (typeof onChange === 'function') await onChange();
        } finally {
          hideSpinner();
        }
      }
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('Er ging iets mis: ' + (err.message || err), 'danger');
      } else {
        console.error(err);
      }
    }
  });
}

function openOfferteModal(project, configType, onUploaded) {
  ensureOfferteModal();
  const body = document.getElementById('offerteModalBody');
  const cfg  = _findConfigByType(project, configType);
  const existing = (project.offertes || {})[configType];

  body.innerHTML = `
    <div class="offerte-cfg-header">
      <div class="offerte-cfg-type" style="font-weight:600;">${escapeHtml(cfg.type)} · ${escapeHtml(cfg.omschrijving || '')}</div>
      <div class="offerte-cfg-meta" style="color:var(--sp-muted);font-size:.9rem;margin-top:2px;">
        ${cfg.batCap ? escapeHtml(String(cfg.batCap)) + ' kWh · ' : ''}${cfg.batInv ? escapeHtml(String(cfg.batInv)) + ' kW omvormer · ' : ''}€ ${_formatEuros(cfg.priceEur)}
      </div>
    </div>

    ${existing ? `
      <div class="offerte-existing">
        <div><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> <strong>${escapeHtml(existing.filename || '')}</strong></div>
        <div style="color:var(--sp-muted);font-size:.85rem;">
          Geüpload door ${escapeHtml(existing.uploadedBy || 'onbekend')}${existing.uploadedAt && existing.uploadedAt.toDate ? ' op ' + _formatOfferteDate(existing.uploadedAt.toDate()) : ''}
        </div>
      </div>
    ` : ''}

    <div class="sp-drop-zone" id="offerteDropZone">
      <input type="file" accept="application/pdf" id="offerteFileInput" />
      <div>
        ${existing ? 'Sleep nieuwe PDF om te vervangen' : 'Sleep offerte PDF hier'}<br/>
        <span style="color:var(--sp-muted);font-size:.9rem;">of klik om te kiezen</span>
      </div>
    </div>
    <div id="offerteUploadError" class="text-danger mt-2" style="display:none;"></div>
    <div id="offerteUploadProgress" class="mt-2" style="display:none;">Uploaden… <span>0%</span></div>
  `;

  _bindOfferteDropZone(project.id, configType, onUploaded);
  const el = document.getElementById('offerteModal');
  bootstrap.Modal.getOrCreateInstance(el).show();
}

function closeOfferteModal() {
  const el = document.getElementById('offerteModal');
  if (el) bootstrap.Modal.getOrCreateInstance(el).hide();
}

function _bindOfferteDropZone(projectId, configType, onUploaded) {
  const zone  = document.getElementById('offerteDropZone');
  const input = document.getElementById('offerteFileInput');
  const err   = document.getElementById('offerteUploadError');
  const prog  = document.getElementById('offerteUploadProgress');
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) _handleOfferteFile(input.files[0]);
  });
  zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) _handleOfferteFile(f);
  });

  async function _handleOfferteFile(file) {
    err.style.display = 'none'; err.textContent = '';
    try {
      if (file.type !== 'application/pdf') throw new Error('Enkel PDF-bestanden');
      if (file.size > 10 * 1024 * 1024)    throw new Error('PDF is groter dan 10 MB');
      prog.style.display = 'block';
      prog.querySelector('span').textContent = '…';
      showSpinner();
      try {
        await uploadProjectOfferte(projectId, configType, file);
        closeOfferteModal();
        if (typeof onUploaded === 'function') await onUploaded();
      } finally {
        hideSpinner();
      }
    } catch (e) {
      err.textContent = e.message || String(e);
      err.style.display = 'block';
      prog.style.display = 'none';
    }
  }
}
