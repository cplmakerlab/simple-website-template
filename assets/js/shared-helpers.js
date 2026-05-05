// Shared UI helpers — ES module.
// Used by dashboard.html, project-edit.html, index.html.

// --- HTML/Security ---

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// --- String utils ---

export function shortEmail(e) { return e ? String(e).split('@')[0] : '\u2014'; }

// --- UI Feedback ---

/**
 * Show a Bootstrap 5 toast. Requires a #toastContainer element in the DOM.
 * Variants: 'primary' | 'success' | 'danger' | 'warning'
 */
export function showToast(message, variant = 'primary') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const id = 't_' + Date.now();
  const html = `
    <div id="${id}" class="toast text-bg-${variant} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Sluiten"></button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
  const el = document.getElementById(id);
  const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 4000 });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  t.show();
}

// --- Auth UI ---

export function showState(which) {
  ['stateLoggedOut', 'stateNotWhitelisted', 'stateAuthorized'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hide', id !== which);
  });
}

// --- Date Formatting (Firestore Timestamps) ---

export function fmtDate(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '\u2014';
  return ts.toDate().toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTs(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '\u2014';
  return ts.toDate().toLocaleString('nl-BE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export function fmtRelTime(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '\u2014';
  const date = ts.toDate();
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60)     return 'net nu';
  if (diffSec < 3600)   return Math.floor(diffSec / 60) + ' min geleden';
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) return 'vandaag ' + date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'gisteren ' + date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' }) +
         ' ' + date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
}
