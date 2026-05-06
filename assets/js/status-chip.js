// Shared status-chip component.
// Renders a Bootstrap .badge with an optional dropdown picker for changing
// project status.  Used by dashboard.html (list view, kanban cards, drawer).
//
// Public API (globals — no module system):
//   statusChipHTML(statusKey, projectId)       — returns chip HTML string
//   wireStatusChipClicks(containerEl, onChange) — delegated click handler
//
// The caller is responsible for:
//   - Including firebase-init.js (PROJECT_STATUSES, getStatusMeta,
//     updateProjectStatus) before this file.
//   - Providing `escapeHtml(s)` and `showToast(msg, variant)` on the page.
//   - Providing `withSpinner(fn)` on the page (for the click handler).

/**
 * Render a status chip badge.
 * @param {string} statusKey  — one of the PROJECT_STATUSES keys
 * @param {string|null} projectId — when null, chip is readonly (no dropdown)
 * @returns {string} HTML string
 */
function statusChipHTML(statusKey, projectId) {
  const meta = getStatusMeta(statusKey);
  const readonly = projectId == null;
  if (readonly) {
    return `<span class="badge status-chip readonly" style="background:${meta.color};color:#fff;">${escapeHtml(meta.label)}</span>`;
  }
  const dropdownId = `stDd_${projectId}`;
  const options = PROJECT_STATUSES.map(s => `
    <li><button type="button" class="dropdown-item d-flex align-items-center gap-2"
                data-status="${s.key}" data-project-id="${projectId}">
      <span class="d-inline-block rounded-circle" style="width:10px;height:10px;background:${s.color};flex-shrink:0;"></span>
      ${escapeHtml(s.label)}
    </button></li>
  `).join('');
  return `
    <div class="dropdown d-inline-block">
      <button type="button" class="badge status-chip border-0" style="background:${meta.color};color:#fff;"
              id="${dropdownId}" data-bs-toggle="dropdown" data-bs-strategy="fixed" aria-expanded="false">
        ${escapeHtml(meta.label)} <i class="fa-solid fa-caret-down ms-1"></i>
      </button>
      <ul class="dropdown-menu" aria-labelledby="${dropdownId}">${options}</ul>
    </div>
  `;
}

/**
 * Wire delegated click handling for status-chip dropdown items inside a
 * container element.
 * @param {HTMLElement} containerEl — ancestor element to listen on
 * @param {(projectId: string, newStatus: string) => Promise<void>} onChange
 *        — called after updateProjectStatus succeeds
 */
function wireStatusChipClicks(containerEl, onChange) {
  containerEl.addEventListener('click', async (ev) => {
    const opt = ev.target.closest('.dropdown-menu .dropdown-item[data-status][data-project-id]');
    if (!opt) return;
    const statusKey = opt.getAttribute('data-status');
    const projectId = opt.getAttribute('data-project-id');
    await withSpinner(async () => {
      try {
        await updateProjectStatus(projectId, statusKey);
        if (onChange) await onChange(projectId, statusKey);
      } catch (err) {
        showToast('Kon status niet wijzigen: ' + (err && err.message ? err.message : err), 'danger');
      }
    });
  });
}
