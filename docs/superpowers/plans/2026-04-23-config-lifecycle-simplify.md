# Config lifecycle simplification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-state config lifecycle (selected / dismissed / orphan) with a single-state model: a config is either in `lastCalcRun.inputs.selectedConfigTypes` or it does not exist. A `delete` action in the drawer / project-edit / calc-view cascades through config entry + offerte PDF + Storage blob.

**Architecture:** One new helper `deleteProjectConfig(projectId, type)` in `firebase-init.js` does the cascade. `saveLastCalcRun` is extended to auto-cascade any `offertes[type]` whose type is no longer in the new `selectedConfigTypes`. The three old dismiss/restore/hard-delete helpers are removed. `offertes-ui.js` drops its dismissed-block render + restore button. Calc-view `Bereken` gets a pre-flight confirm when the save would cascade-delete PDFs. `dismissedConfigs` becomes inert legacy data (not read, not written, not migrated).

**Tech Stack:** Vanilla JS, Firebase compat SDK 10.13.2, Bootstrap 5.3.3 (unchanged), no build step, no test framework (manual verification).

**Spec:** [2026-04-23-config-lifecycle-simplify-design.md](../specs/2026-04-23-config-lifecycle-simplify-design.md)

---

## File structure

**Modified:**
- `assets/js/firebase-init.js` — add `deleteProjectConfig`; remove `dismissProjectConfig`/`restoreProjectConfig`/`hardDeleteProjectConfig`; extend `saveLastCalcRun` with PDF cascade; simplify `needsOfferteWarning`; drop `dismissedConfigs` defaults.
- `assets/js/offertes-ui.js` — remove dismissed-block rendering, restore-button, dismiss-click handler; swap trash-click handler to call `deleteProjectConfig`.
- `index.html` — add `_confirmConfigCascade` helper; gate the Bereken-save path on its result.
- `CLAUDE.md` — rewrite the "Offerte PDF upload per config" paragraph.

**Not touched:**
- `dashboard.html` — no changes (drawer uses `offertes-ui.js` helpers; those already live in a shared module).
- `project-edit.html` — no changes (same).
- Firestore/Storage security rules.
- Share-link flow (`?s=<id>`, `?data=<b64>`).

---

## Testing philosophy

No test framework. Each task ends with a **static verification** check (grep/read) for subagents, since browser verification is out-of-reach. Task 9 is end-to-end manual verification + merge — the user drives that one in the browser.

Local server for E2E: `python3 -m http.server 8000` from the worktree.

---

## Worktree setup

- [ ] **Step 0.1: Create worktree**

```bash
cd /home/ubuntu/battery-roi-tool
git worktree add .worktrees/config-simplify -b feat/config-simplify gh-pages
cd .worktrees/config-simplify
```

All subsequent steps run inside `.worktrees/config-simplify/`.

---

## Task 1: Add `deleteProjectConfig` helper

New helper that combines Firestore update (remove from `selectedConfigTypes`, delete `offertes[type]`) + Storage blob delete in one cascade call. Replaces `hardDeleteProjectConfig`.

**Files:**
- Modify: `assets/js/firebase-init.js`

- [ ] **Step 1.1: Add the helper**

Find the existing `hardDeleteProjectConfig` function (around line 752) and insert the new function IMMEDIATELY AFTER it. Do not touch `hardDeleteProjectConfig` yet — it's removed in Task 3.

```js
// ─── Cascade-delete a config (NEW single source of truth) ───────────────────
// Removes the type from lastCalcRun.inputs.selectedConfigTypes, deletes the
// offertes[type] entry from the project doc, and deletes the Storage blob (if
// any).  Best-effort on the Storage delete — warn on failure, don't throw.
async function deleteProjectConfig(projectId, type) {
  const ref  = projectDoc(projectId);
  const snap = await ref.get();
  const data = snap.data() || {};
  const types = (data.lastCalcRun && data.lastCalcRun.inputs && Array.isArray(data.lastCalcRun.inputs.selectedConfigTypes))
    ? data.lastCalcRun.inputs.selectedConfigTypes.filter(t => t !== type)
    : [];
  const pdfPath = data.offertes && data.offertes[type] && data.offertes[type].storagePath;

  await ref.update({
    'lastCalcRun.inputs.selectedConfigTypes': types,
    [`offertes.${type}`]: firebase.firestore.FieldValue.delete(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  if (pdfPath) {
    try { await firebase.storage().ref(pdfPath).delete(); }
    catch (e) { console.warn('Offerte blob verwijderen mislukt', e); }
  }
}
```

- [ ] **Step 1.2: Verify placement + function signature**

Run:

```bash
grep -n "^async function deleteProjectConfig\|^async function hardDeleteProjectConfig" assets/js/firebase-init.js
```

Expected: two hits, `hardDeleteProjectConfig` first, `deleteProjectConfig` right below.

- [ ] **Step 1.3: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "feat(configs): add deleteProjectConfig cascade helper

Combines Firestore update (remove from selectedConfigTypes + delete
offertes[type] field) and Storage blob delete in one call. Will
supersede hardDeleteProjectConfig once callers are migrated."
```

---

## Task 2: Update `offertes-ui.js` — call `deleteProjectConfig`, drop dismissed block

Swap the trash-click handler to the new helper. Remove the restore-click branch entirely. Remove the "Niet geoffreerd" divider + inactive-cards block from `renderOffertesCards`. Update the JSDoc globals header.

**Files:**
- Modify: `assets/js/offertes-ui.js`

- [ ] **Step 2.1: Update JSDoc globals header at the top of the file**

Find the `/* global ... */` block (around line 14). It currently includes `hardDeleteProjectConfig, dismissProjectConfig, restoreProjectConfig`. Replace with `deleteProjectConfig` (single name). The final block should read (exact):

```js
/* global bootstrap, firebase, escapeHtml, showToast, projectDoc,
          uploadProjectOfferte, deleteProjectOfferte,
          deleteProjectConfig,
          needsOfferteWarning */
```

Note: the pre-existing header includes other names you should **preserve** — if your file has additional globals not shown above, keep them and just swap the three dismiss/restore/hard-delete names for the one new `deleteProjectConfig`. Read the current header first and preserve the unknowns.

- [ ] **Step 2.2: Simplify `renderOffertesCards`**

Find the function (around line 75). Locate the lines:

```js
  const dismissed = new Set(project.dismissedConfigs || []);
  const active   = types.filter(t => !dismissed.has(t));
  const inactive = Array.from(dismissed);
  if (active.length === 0 && inactive.length === 0) return '';
```

Replace with:

```js
  const active = types;
  if (active.length === 0) return '';
```

Then find the `inactiveCards` assignment further down (starts with `const inactiveCards = inactive.length ? `). Delete the whole block from `const inactiveCards = ...` up to and including its closing `\`` and semicolon (should end with `` ` : ''; `` on its own line or similar).

Then find the final return statement:

```js
  const activeBlock = activeCards
    ? `<div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-2">${activeCards}</div>`
    : '';

  return activeBlock + inactiveCards;
```

Replace with:

```js
  return activeCards
    ? `<div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-2">${activeCards}</div>`
    : '';
```

- [ ] **Step 2.3: Update the trash-button tooltip**

In the activeCards template (where `actions` is built for both the `pdf` and `no-pdf` branches around lines 95-100), the current trash-button titles are:

```js
title="Niet geoffreerd (blijft zichtbaar onderaan, PDF behouden)"
```

```js
title="Niet geoffreerd (blijft zichtbaar onderaan)"
```

Replace BOTH occurrences. In the "with PDF" branch use:

```js
title="Config verwijderen (incl. offerte-PDF)"
```

In the "no PDF" branch use:

```js
title="Config verwijderen"
```

- [ ] **Step 2.4: Rewire the trash click handler**

In `wireOffertesClicks` (around line 157), find the `else if (btn.classList.contains('offerte-trash-btn'))` branch. Currently:

```js
      else if (btn.classList.contains('offerte-trash-btn')) {
        // Always dismiss — config blijft onder "Niet geoffreerd" staan en keert
        // automatisch terug wanneer de calculator hem opnieuw meerekent.
        // Een eventuele PDF blijft bewaard (gebruik de aparte "delete PDF"-knop
        // om die apart te wissen voordat je dismissed).
        await dismissProjectConfig(project.id, type);
        if (typeof onChange === 'function') await onChange();
      }
```

Replace with:

```js
      else if (btn.classList.contains('offerte-trash-btn')) {
        await deleteProjectConfig(project.id, type);
        if (typeof onChange === 'function') await onChange();
      }
```

- [ ] **Step 2.5: Delete the restore click handler**

Directly below the trash branch, find:

```js
      else if (btn.classList.contains('offerte-restore-btn')) {
        await restoreProjectConfig(project.id, type);
        if (typeof onChange === 'function') await onChange();
      }
```

Delete the whole `else if` block (including the blank line before or after it if present — leave exactly one blank line between the trash branch and the catch-level try-close).

- [ ] **Step 2.6: Static verification**

Run:

```bash
grep -n "dismissProjectConfig\|restoreProjectConfig\|hardDeleteProjectConfig\|offerte-restore-btn\|dismissedConfigs\|Niet geoffreerd\|inactiveCards" assets/js/offertes-ui.js
```

Expected: zero matches.

```bash
grep -n "deleteProjectConfig" assets/js/offertes-ui.js
```

Expected: at least 2 matches (one in globals header, one in the trash click handler).

- [ ] **Step 2.7: Commit**

```bash
git add assets/js/offertes-ui.js
git commit -m "refactor(offertes-ui): swap trash handler to cascade delete

- renderOffertesCards drops the dismissed/inactive block rendering;
  only active configs are listed, single block, no divider.
- Trash click now calls deleteProjectConfig (cascade) instead of
  dismissProjectConfig; config disappears immediately with its PDF.
- Restore-click handler removed (nothing to restore).
- Tooltip on trash updated: 'Config verwijderen (incl. offerte-PDF)'
  or 'Config verwijderen' depending on PDF presence.
- JSDoc globals header updated."
```

---

## Task 3: Remove old dismiss/restore/hard-delete helpers + `dismissedConfigs` defaults

After Task 2, the three old helpers have zero callers outside `firebase-init.js` itself. Delete them along with `dismissedConfigs` defaulting.

**Files:**
- Modify: `assets/js/firebase-init.js`

- [ ] **Step 3.1: Confirm zero external callers**

Run:

```bash
grep -rn "dismissProjectConfig\|restoreProjectConfig\|hardDeleteProjectConfig" --include="*.html" --include="*.js" . | grep -v firebase-init.js | grep -v docs/superpowers
```

Expected: zero matches. If any remain, STOP and report BLOCKED.

- [ ] **Step 3.2: Delete the three helper functions**

In `assets/js/firebase-init.js`, find and delete each function in full (signature + body + trailing blank line):
- `async function hardDeleteProjectConfig(projectId, configType)` (around line 752)
- `async function dismissProjectConfig(projectId, configType)` (around line 772)
- `async function restoreProjectConfig(projectId, configType)` (around line 786)

The new `deleteProjectConfig` added in Task 1 was placed right below `hardDeleteProjectConfig`, so the order in the file currently reads:
1. `hardDeleteProjectConfig` (delete this)
2. `deleteProjectConfig` (KEEP)
3. `dismissProjectConfig` (delete this)
4. `restoreProjectConfig` (delete this)

Result after deletion: only `deleteProjectConfig` remains in that section.

Use grep to verify:

```bash
grep -n "^async function \(hardDelete\|dismiss\|restore\)ProjectConfig" assets/js/firebase-init.js
```

Expected: zero matches.

```bash
grep -n "^async function deleteProjectConfig" assets/js/firebase-init.js
```

Expected: one match.

- [ ] **Step 3.3: Remove `dismissedConfigs` defaulting from `mergeProjectMetadata`**

Find `mergeProjectMetadata` (around line 100). Locate lines that currently look like:

```js
  merged.dismissedConfigs = Array.isArray(project.dismissedConfigs)
                              ? project.dismissedConfigs : [];
```

Delete both lines.

- [ ] **Step 3.4: Remove `dismissedConfigs` from `newEmptyProjectMetadata` if present**

Run:

```bash
grep -n "dismissedConfigs" assets/js/firebase-init.js
```

For each remaining match OUTSIDE of the calc-run body (Task 4 handles those) and OUTSIDE of the `deleteProjectConfig` body (which doesn't mention it), delete the relevant line or property. Common locations: `newEmptyProjectMetadata()` default object, any explicit write in other helpers.

If the only remaining matches are inside `saveLastCalcRun` (which Task 4 will replace anyway) you can leave them — Task 4's rewrite will wipe them. Note: if you delete them now too that's fine, Task 4 won't reintroduce them.

- [ ] **Step 3.5: Static verification**

```bash
grep -n "dismissProjectConfig\|restoreProjectConfig\|hardDeleteProjectConfig" assets/js/firebase-init.js
```

Expected: zero matches.

```bash
grep -n "dismissedConfigs" assets/js/firebase-init.js
```

Expected: zero matches OR only the references inside `saveLastCalcRun` (to be cleaned up in Task 4).

- [ ] **Step 3.6: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "chore(configs): remove dismiss/restore/hardDelete helpers

After offertes-ui rewiring the three old helpers have zero callers.
Also drop dismissedConfigs defaulting from mergeProjectMetadata and
newEmptyProjectMetadata; legacy data on existing project docs is
inert and safely ignored."
```

---

## Task 4: Extend `saveLastCalcRun` with PDF cascade + drop disjoint-invariant logic

`saveLastCalcRun` currently enforces `selectedConfigTypes ∩ dismissedConfigs = ∅` via `arrayRemove(...selected)` on the `dismissedConfigs` field. That invariant disappears. In its place: any type that was in `prevSelected` but not in `newSelected` AND has an `offertes[type]` entry gets its PDF deleted (Firestore field + Storage blob).

**Files:**
- Modify: `assets/js/firebase-init.js`

- [ ] **Step 4.1: Read the current function**

Run:

```bash
grep -n "^async function saveLastCalcRun" assets/js/firebase-init.js
```

Note the start line. Read the full function body (typically spans ~30 lines).

- [ ] **Step 4.2: Replace the function**

Replace the ENTIRE `saveLastCalcRun(projectId, saved)` function (signature + body) with:

```js
async function saveLastCalcRun(projectId, saved) {
  if (!projectId || !saved) throw new Error('saveLastCalcRun: projectId + saved vereist');

  const ref  = projectDoc(projectId);
  const snap = await ref.get();
  const data = snap.data() || {};

  // Build the lastCalcRun payload exactly as before.
  const lastCalcRun = {
    savedAt:  firebase.firestore.FieldValue.serverTimestamp(),
    savedBy:  currentUserEmail() || 'unknown',
    inputs:   saved.inputs   || {},
    results:  saved.results  || {},
  };

  // Determine which (prev-selected, pdf-holding) types are NOT in the new set.
  const prevSelected = (data.lastCalcRun && data.lastCalcRun.inputs
                        && Array.isArray(data.lastCalcRun.inputs.selectedConfigTypes))
    ? data.lastCalcRun.inputs.selectedConfigTypes : [];
  const newSelected  = (saved.inputs && Array.isArray(saved.inputs.selectedConfigTypes))
    ? saved.inputs.selectedConfigTypes : [];
  const offertes     = data.offertes || {};
  const removedWithPdf = prevSelected.filter(t =>
    !newSelected.includes(t) && offertes[t] && offertes[t].storagePath);

  // Firestore update: payload + PDF cascade field-deletes.
  const update = {
    lastCalcRun,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  for (const t of removedWithPdf) {
    update[`offertes.${t}`] = firebase.firestore.FieldValue.delete();
  }
  // Also drop the top-level csvUpload.dailyCompact field if provided (unchanged behaviour).
  if (saved.csvUpload && saved.csvUpload.dailyCompact) {
    update.csvUpload = saved.csvUpload;
  }

  await ref.update(update);

  // Best-effort blob cleanup.
  for (const t of removedWithPdf) {
    try { await firebase.storage().ref(offertes[t].storagePath).delete(); }
    catch (e) { console.warn(`Offerte blob (${t}) verwijderen mislukt`, e); }
  }
}
```

Important: if the existing function has any extra behavior not covered above (e.g., other fields it writes), preserve that behavior. Read the original function carefully and keep non-invariant-related code paths intact. The only things that should be REMOVED are:
- `dismissedConfigs: firebase.firestore.FieldValue.arrayRemove(...selected)` (and any surrounding comment about the invariant).

The only things that should be ADDED are:
- The `prevSelected` / `newSelected` / `offertes` / `removedWithPdf` computation.
- The per-type `offertes.${t}` delete sentinel in the update object.
- The post-update Storage blob cleanup loop.

- [ ] **Step 4.3: Static verification**

```bash
grep -n "dismissedConfigs" assets/js/firebase-init.js
```

Expected: zero matches.

```bash
grep -n "arrayRemove" assets/js/firebase-init.js
```

Expected: any remaining matches should NOT be about `dismissedConfigs`. A `grep -A2 arrayRemove assets/js/firebase-init.js` check should confirm.

- [ ] **Step 4.4: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "feat(configs): saveLastCalcRun cascades PDF delete on type removal

When Bereken saves a selectedConfigTypes array that no longer contains
a previously-selected type AND that type had an offertes[t] entry with
a storagePath, both the Firestore field and the Storage blob are
deleted as part of the save. The old dismissedConfigs-invariant
logic is dropped."
```

---

## Task 5: Simplify `needsOfferteWarning`

Drop the `dismissed` exclusion. The predicate becomes "any selected config without a PDF?".

**Files:**
- Modify: `assets/js/firebase-init.js`

- [ ] **Step 5.1: Replace the function**

Find `needsOfferteWarning` (around line 896). Replace the full function body with:

```js
function needsOfferteWarning(project) {
  if (!project || !project.lastCalcRun) return false;
  const types = (project.lastCalcRun.inputs && Array.isArray(project.lastCalcRun.inputs.selectedConfigTypes))
    ? project.lastCalcRun.inputs.selectedConfigTypes
    : [];
  if (types.length === 0) return false;
  const offertes = project.offertes || {};
  return types.some(t => !offertes[t]);
}
```

- [ ] **Step 5.2: Static verification**

```bash
grep -n "needsOfferteWarning" assets/js/firebase-init.js
```

Expected: one function definition (the rewritten one).

```bash
grep -n "dismissed" assets/js/firebase-init.js
```

Expected: zero matches across the file.

- [ ] **Step 5.3: Commit**

```bash
git add assets/js/firebase-init.js
git commit -m "refactor(offertes): simplify needsOfferteWarning

Predicate is now 'any selected type without a PDF?'. The dismissed
exclusion is gone along with the dismissedConfigs state."
```

---

## Task 6: Calc-view `_confirmConfigCascade` + wire into Bereken

Add a pre-flight helper in `index.html` that reads the current project state, compares against the about-to-be-saved `selectedConfigTypes`, and shows a `confirm()` dialog if any dropped type had a PDF. Wire it into the Bereken-handler path.

**Files:**
- Modify: `index.html`

- [ ] **Step 6.1: Locate the Bereken-save path**

Run:

```bash
grep -n "saveLastCalcRun\|saveProjectCalcRun\|readSelectedConfigs" index.html
```

Note the line numbers. The calc page saves project state via a wrapper that ultimately calls `saveLastCalcRun`. Identify the single call site where the `selectedConfigTypes` array is finalised before saving.

Read ~30 lines of context around that call site to understand the surrounding flow — specifically: where does `selectedConfigTypes` come from (likely `readSelectedConfigs()`), and what's the `projectId` variable name (grep reveals it).

- [ ] **Step 6.2: Add the helper above the Bereken-save call site**

Add this helper function in the `<script>` block, above `saveProjectCalcRun` (or the wrapper — whichever function contains the `saveLastCalcRun` call). Use your judgment on exact placement; the helper has no dependencies other than `projectDoc` (which is global).

```js
// Pre-Bereken confirm when the save would cascade-delete PDFs.
// Returns true if user confirms (or no PDFs are on the line), false if cancelled.
async function _confirmConfigCascade(projectId, newSelectedTypes) {
  if (!projectId) return true; // no-project mode — no PDFs possible.
  try {
    const snap = await projectDoc(projectId).get();
    const data = snap.data() || {};
    const prevSelected = (data.lastCalcRun && data.lastCalcRun.inputs
                          && Array.isArray(data.lastCalcRun.inputs.selectedConfigTypes))
      ? data.lastCalcRun.inputs.selectedConfigTypes : [];
    const offertes = data.offertes || {};
    const removedWithPdf = prevSelected.filter(t =>
      !newSelectedTypes.includes(t) && offertes[t]);
    if (removedWithPdf.length === 0) return true;
    const label = removedWithPdf.join(', ');
    const msg = removedWithPdf.length === 1
      ? `De config "${label}" heeft een offerte-PDF. Als je doorgaat wordt die ook verwijderd.\n\nDoorgaan?`
      : `De configs "${label}" hebben offerte-PDF's. Als je doorgaat worden die ook verwijderd.\n\nDoorgaan?`;
    return confirm(msg);
  } catch (e) {
    console.warn('_confirmConfigCascade: snapshot read mislukt, doorgaan zonder confirm', e);
    return true; // fail-open: don't block Bereken on a stale read error.
  }
}
```

- [ ] **Step 6.3: Gate the save-path on the confirm**

At the save-path you identified in Step 6.1, just BEFORE the `await saveLastCalcRun(...)` (or `await saveProjectCalcRun(...)`) call, insert a guard:

```js
  const _newSelectedTypes = readSelectedConfigs(); // same array passed into saved.inputs.selectedConfigTypes below
  if (!(await _confirmConfigCascade(projectId, _newSelectedTypes))) {
    return; // user cancelled — abort Bereken entirely.
  }
```

Adjust variable names to match the surrounding code. Key points:
- The variable holding the current `selectedConfigTypes` value may already be a local; reuse it rather than re-calling `readSelectedConfigs()`.
- `projectId` is known at the save site because we're in project mode (otherwise this function isn't called); if in doubt, grep for how the wrapper accesses the project ID.
- On `false` return: the entire Bereken flow must abort — no results render, no save, no side effects.

- [ ] **Step 6.4: Static verification**

```bash
grep -n "_confirmConfigCascade" index.html
```

Expected: exactly 2 matches (definition + call site).

```bash
grep -n "readSelectedConfigs" index.html
```

Expected: at least 2 matches (existing renderConfigPickers wire-up + the new call site or existing reuse).

- [ ] **Step 6.5: Commit**

```bash
git add index.html
git commit -m "feat(calc): confirm PDF cascade before Bereken save

When a Bereken click would remove a previously-selected type that has
an offerte PDF, prompt the user before committing. Cancel aborts the
entire Bereken flow (no render, no save). On OK, saveLastCalcRun
proceeds and performs the cascade itself."
```

---

## Task 7: Update `CLAUDE.md`

Rewrite the "Offerte PDF upload per config" paragraph to reflect the new lifecycle.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 7.1: Locate the paragraph**

Run:

```bash
grep -n "Offerte PDF upload per config" CLAUDE.md
```

Note the line number. Read the full paragraph (roughly 10-15 lines including the sub-bullets starting with "Per-config actions").

- [ ] **Step 7.2: Rewrite**

Replace the existing paragraph starting at `**Offerte PDF upload per config (2026-04-21, herzien 2026-04-22)**` and running down to (but not including) the `**Font Awesome 6 (2026-04-21)**` paragraph with:

```md
**Offerte PDF upload per config (2026-04-21, vereenvoudigd 2026-04-23)** —
Gedeelde UI in `assets/js/offertes-ui.js`: `renderOffertesCards(project)` +
`renderOffertesSection(project)` (section-wrapped variant voor de drawer),
`wireOffertesClicks(containerEl, getProjectFn, onChange)` voor delegated
click-handling, en `openOfferteModal/closeOfferteModal/ensureOfferteModal`
voor het upload-modal. Gebruikt door `dashboard.html` (drawer) én
`project-edit.html` (eigen blok onderaan). Upload-modal drag-drop, max 10
MB, PDF-only. Opslag: `project.offertes: { [configType]: { storagePath,
filename, sizeBytes, contentType, uploadedAt, uploadedBy } }` top-level op
het project-doc, blobs in Storage onder
`projects/{id}/offertes/{configType}_{ts}.pdf`.

Per-config actions:
- **Geen PDF**: `fa-upload` = open modal · `fa-trash` = **config
  verwijderen** (cascade: uit `selectedConfigTypes` én `offertes[type]` +
  Storage blob).
- **Met PDF**: `fa-download` · `fa-pen-to-square` vervang ·
  `fa-file-circle-xmark` = alleen PDF wissen (config blijft) · `fa-trash` =
  **config verwijderen incl. PDF** (cascade).

Delete-lifecycle (herzien 2026-04-23): één actie, overal cascade.
- Drawer / project-edit `fa-trash` → `deleteProjectConfig(id, type)` →
  Firestore + Storage in één call.
- Calc-view: wanneer de gebruiker een type uit de picker haalt en Bereken
  drukt, detecteert `_confirmConfigCascade` of de verwijderde types een
  PDF hebben en toont een confirm-dialog. Op OK → `saveLastCalcRun`
  schrijft de nieuwe `selectedConfigTypes` én ruimt automatisch alle
  `offertes[t]` + Storage blobs op voor types die niet meer in de set
  zitten. Op Cancel → Bereken wordt afgebroken, geen save.
- Read-only share-links hebben geen delete-UI.

Re-upload overschrijft de vorige blob atomair (nieuwe blob upload →
Firestore swap → oude blob delete). `fa-triangle-exclamation` oranje
warning-banner in drawer (en in project-edit) + parallel icoon in
dashboard-rij/board-kaart wanneer `needsOfferteWarning(project)` true is
(predicate = "enige selected type zonder PDF"). Helpers in
`firebase-init.js`: `uploadProjectOfferte`, `deleteProjectOfferte`
(PDF-only delete), `deleteProjectConfig` (cascade delete),
`needsOfferteWarning`. `mergeProjectMetadata` defaultet `offertes: {}`.
Het veld `dismissedConfigs` op oude project-docs is legacy en wordt
genegeerd. Calculator (`index.html`) blijft pure berekening — geen
offerte-UI daar; share-links (`?s=`/`?data=`) tonen automatisch geen
offertes want `_serializeState` kent de velden niet.
```

- [ ] **Step 7.3: Verify**

```bash
grep -n "dismissProjectConfig\|restoreProjectConfig\|hardDeleteProjectConfig\|dismissedConfigs\|Niet geoffreerd" CLAUDE.md
```

Expected: `dismissedConfigs` should appear in exactly ONE location (the "is legacy en wordt genegeerd" reference). Others: zero.

```bash
grep -n "deleteProjectConfig\|_confirmConfigCascade" CLAUDE.md
```

Expected: each mentioned at least once.

- [ ] **Step 7.4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): rewrite config lifecycle paragraph

Reflects the simplified model: single delete action cascades across
drawer/project-edit/calc. Mentions _confirmConfigCascade for the
calc-view pre-flight and notes dismissedConfigs as inert legacy."
```

---

## Task 8: Final integration test + merge

**Files:** none modified; verification + git operation only.

- [ ] **Step 8.1: End-to-end checklist**

Serve the worktree locally:

```bash
cd /home/ubuntu/battery-roi-tool/.worktrees/config-simplify && python3 -m http.server 8000
```

Open `http://localhost:8000/dashboard.html`, sign in. For a project that has at least 2 configs (one with a PDF, one without):

- [ ] **Drawer trash without PDF** — click the trash on a config that has no PDF. Config disappears. Firestore `selectedConfigTypes` no longer contains it. `offertes` unchanged (was empty for that type).
- [ ] **Drawer trash with PDF** — click the trash on a config that has a PDF. Config disappears. Firestore `offertes[type]` is gone. Storage `projects/{id}/offertes/{t}_*.pdf` is gone.
- [ ] **Project-edit trash with PDF** — navigate to `project-edit.html?project=<id>`, use the offerte block at the bottom. Same behavior.
- [ ] **Calc-view remove without PDF** — open the calc for a project, remove a type from a picker (select blank), click Bereken. No confirm dialog. Type gone from `selectedConfigTypes`.
- [ ] **Calc-view remove with PDF, Cancel** — remove a type that has a PDF, click Bereken. Confirm dialog appears. Click Cancel. Bereken doesn't run, no Firestore writes, no results render.
- [ ] **Calc-view remove with PDF, OK** — same but click OK. Bereken runs, type gone, PDF gone from Firestore + Storage.
- [ ] **Calc-view no config changes** — Bereken again without touching the pickers. No confirm. Normal recalc + save.
- [ ] **Legacy-project read** — inspect a project doc in Firebase Console and manually set `dismissedConfigs: ['T-10']` on it. Reload in dashboard + project-edit. The type doesn't show up anywhere. No console errors. `needsOfferteWarning` unaffected by the legacy field.
- [ ] **`fa-triangle-exclamation` correctness** — a project with all selected types having PDFs shows no warning icon. Remove one PDF via `fa-file-circle-xmark`, the warning appears.

- [ ] **Step 8.2: Merge to `gh-pages`**

```bash
cd /home/ubuntu/battery-roi-tool
git checkout gh-pages
git pull origin gh-pages
git merge --ff-only feat/config-simplify
git push origin gh-pages
```

- [ ] **Step 8.3: Cleanup**

```bash
git worktree remove .worktrees/config-simplify
git branch -d feat/config-simplify
```

- [ ] **Step 8.4: Post-deploy smoke test**

Wait ~1 minute for GitHub Pages CDN. Open the production dashboard and repeat 2 of the 9 checks above (drawer-trash-with-PDF and calc-view-remove-with-PDF). Report any regressions.

---

## Self-review notes

**Spec coverage** — every spec section is implemented by at least one task:
- Data model / `dismissedConfigs` retirement → Task 3
- `deleteProjectConfig` helper → Task 1
- `saveLastCalcRun` cascade → Task 4
- `needsOfferteWarning` simplify → Task 5
- `offertes-ui.js` UI changes → Task 2
- Calc-view confirm → Task 6
- CLAUDE.md update → Task 7
- Testing → Task 8

**Placeholder scan** — no "TBD" / "similar to" / "add error handling" / vague-what-without-how phrasings. Task 6 has one branch that relies on the implementer reading the surrounding Bereken-handler code to identify variable names (project ID, selectedTypes local); this is necessary because `index.html` has many calc-flow variants and naming conventions across versions, and pretending otherwise would produce wrong edits.

**Type / name consistency** — `deleteProjectConfig(projectId, type)` signature used identically in Tasks 1, 2, and 7. `_confirmConfigCascade(projectId, newSelectedTypes) → boolean` used in Task 6. `needsOfferteWarning(project) → boolean` unchanged. `saveLastCalcRun(projectId, saved)` signature unchanged; only the body changes in Task 4.

**Task ordering** — Task 2 deliberately runs before Task 3 so the dismiss/restore/hardDelete helpers have zero callers when we delete them. Task 1 precedes Task 2 so the new `deleteProjectConfig` exists when the trash handler is rewired.
