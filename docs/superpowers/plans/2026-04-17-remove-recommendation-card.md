# Remove "Aanbevolen configuratie" Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Aanbevolen configuratie" recommendation card (and its supporting code/styles) from the SmartPeak Batterij ROI Calculator so the results page no longer auto-picks a "winner" config.

**Architecture:** The app is a single static HTML file (`index.html`) with all CSS embedded in a `<style>` block and all JS in a single `<script>` block. The change is two surgical deletions in that one file, plus a verification pass. No build step, no automated tests — verification is grep + a manual browser smoke test.

**Tech Stack:** Plain HTML / CSS / vanilla JS, served as a static page from the `gh-pages` branch via GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-04-17-remove-recommendation-card-design.md`

---

## File map

- **Modify:** `index.html` — delete one CSS block and one JS block; nothing else changes.

---

### Task 1: Delete the recommendation-card JS block in `renderResults`

**Files:**
- Modify: `index.html` (currently lines 1147-1167, inside the `renderResults` function)

This block builds the `bestCandidates` / `best` / `worst` data and appends the recommendation card HTML to `gridHTML`. Nothing else in the file references those three locals, so the whole block goes.

- [ ] **Step 1: Confirm the exact current location of the block**

Run:
```bash
grep -n "Recommendation: config with best payback" index.html
grep -n "bestCandidates" index.html
```

Expected: each command prints exactly one line. The first hit is the comment that opens the block; the second confirms `bestCandidates` is referenced only inside the block (one or two lines, all between the comment and the closing `}`). If either prints zero or more than the expected hits, stop and re-read the spec — the file has drifted from the assumptions.

- [ ] **Step 2: Delete the block with an exact-string Edit**

Use the Edit tool to replace this exact `old_string` with an empty `new_string` (the leading two spaces and the trailing blank line matter — they preserve indentation and the existing blank line that separates this block from the next):

`old_string`:
```
  // ── Recommendation: config with best payback (using optimistic if available) ──
  const bestCandidates = d.configResults.map((cr, idx) => {
    const scen = cr.scenOpt || cr.scenWC;
    return { idx, cr, scen, payback: scen.payback };
  }).filter(c => isFinite(c.payback) && c.payback > 0);

  if (bestCandidates.length > 1) {
    const best = bestCandidates.reduce((a, b) => a.payback < b.payback ? a : b);
    const worst = bestCandidates.reduce((a, b) => a.payback > b.payback ? a : b);
    gridHTML += `<div class="recommendation-card" style="grid-column:1/-1;">
      <h3>⭐ Aanbevolen configuratie: Config ${best.idx+1} — ${best.cr.cfg.type}</h3>
      <div style="font-size:0.88rem;color:#2d6a4f;margin-bottom:12px;">${best.cr.cfg.omschrijving} &nbsp;·&nbsp; ${fmt2(best.cr.cfg.batCap)} kWh &nbsp;·&nbsp; ${fmt2(best.cr.cfg.batInv)} kW &nbsp;·&nbsp; ${fmtEur(best.cr.cfg.price)}</div>
      <div class="rec-row"><span>Jaarlijkse besparing</span><strong style="color:var(--success)">${fmtEur(best.scen.annualSaving)} / jaar</strong></div>
      <div class="rec-row"><span>Terugverdientijd</span><strong>${best.payback > 100 ? '> 100 jaar' : fmt2(best.payback) + ' jaar'}</strong></div>
      <div class="rec-row"><span>Recuperatie t.o.v. afname</span><strong>${fmt2(Math.min(best.scen.recoveryPctFull+best.scen.recoveryPctPartial,100))}%</strong></div>
      <div class="rec-row"><span>Recuperatie t.o.v. injectie</span><strong>${fmt2(Math.min(best.scen.injPctFull+best.scen.injPctPartial,100))}%</strong></div>
      <div style="margin-top:10px;font-size:0.82rem;color:#2d6a4f;">
        Verschil in terugverdientijd t.o.v. minst voordelige: <strong>${fmt2(Math.abs(best.payback - worst.payback))} jaar</strong>
      </div>
    </div>`;
  }

```

`new_string`: (empty string)

After the edit, the line that previously preceded the deleted block (the closing `});` of the `forEach` at the old line 1145) should be followed by exactly one blank line and then `  grid.innerHTML = gridHTML;`. The blank line in the `old_string` above is the one between the deleted block and `grid.innerHTML = gridHTML;` — removing it together with the block keeps spacing tidy without leaving a double blank.

- [ ] **Step 3: Verify the JS block is gone and surrounding code is intact**

Run:
```bash
grep -n "bestCandidates\|recommendation-card\|rec-row\|Aanbevolen configuratie" index.html
grep -n "grid.innerHTML = gridHTML" index.html
```

Expected:
- The first command prints lines that match **only** the CSS rules (`.recommendation-card`, `.rec-row`) — those go away in Task 2. Critically, no JS hits remain (no `bestCandidates`, no `Aanbevolen configuratie`).
- The second command prints exactly one line, and the line still reads `  grid.innerHTML = gridHTML;` (still inside `renderResults`).

If either expectation fails, undo the edit and re-read the file before retrying.

---

### Task 2: Delete the recommendation-card CSS block

**Files:**
- Modify: `index.html` (currently lines 393-402, inside the `<style>` block)

- [ ] **Step 1: Confirm the CSS block is the only consumer of the classes**

Run:
```bash
grep -n "recommendation-card\|rec-row" index.html
```

Expected: only CSS-side hits remain (the comment header on line 393 and the rules on lines 394-402). After Task 1 there should be no JS hits. If a JS hit appears, Task 1 wasn't applied cleanly — go back.

- [ ] **Step 2: Delete the CSS block with an exact-string Edit**

Use the Edit tool to replace this exact `old_string` with an empty `new_string`. The trailing blank line is part of `old_string` so the next CSS block (`/* ── Spinner ─── */`) keeps the same visual spacing it has now:

`old_string`:
```
    /* ── Recommendation card ─────────────────────────────────────────────── */
    .recommendation-card {
      background: linear-gradient(135deg, #eafaf4 0%, #d1fae5 100%);
      border: 2px solid var(--success);
      border-radius: var(--radius); padding: 22px;
    }
    .recommendation-card h3 { color: var(--success); font-size: 1.1rem; margin-bottom: 12px; }
    .rec-row { display: flex; justify-content: space-between; align-items: baseline;
      padding: 6px 0; border-bottom: 1px solid #b2e8d5; font-size: 0.93rem; }
    .rec-row:last-child { border-bottom: none; }

```

`new_string`: (empty string)

- [ ] **Step 3: Verify the classes are gone everywhere**

Run:
```bash
grep -n "recommendation-card\|rec-row\|bestCandidates\|Aanbevolen configuratie" index.html
```

Expected: zero output (no hits anywhere in the file).

If anything is still printed, do not proceed — re-open the file at the printed line and remove the leftover.

---

### Task 3: Manual browser smoke test

**Files:** none (manual verification only — there is no automated test suite in this repo).

- [ ] **Step 1: Serve the file locally**

Run from the repo root:
```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/index.html` in a browser. Open the browser DevTools console; it should be empty (no errors) on initial load.

- [ ] **Step 2: One-config calculation**

In the browser:
1. Upload a real Fluvius CSV (`Verbruikshistoriek uploaden`).
2. Fill in `Vermogen omvormer zonnepanelen` and `Kostprijs elektriciteit dag`.
3. Click `🔄 Configuraties laden`, wait for `✅ N configuraties geladen.`
4. Pick exactly one config in `Configuratie 1`; leave 2 and 3 empty.
5. Click `⚡ Bereken ROI`.

Expected: results render as before. The recommendation card was already not shown in this case (the old `if (bestCandidates.length > 1)` gate), so nothing visible should change. No console errors.

- [ ] **Step 3: Two-config calculation**

In the same browser session, additionally pick a second config in `Configuratie 2` and click `⚡ Bereken ROI` again.

Expected: the scenarios grid shows the per-config scenario cards (1-2 cards per config depending on whether worst-case + optimistic are both rendered) and **nothing else after them** — no green/gradient "⭐ Aanbevolen configuratie" card. The capacity-analysis card, monthly-overview card and save/share card render normally below the grid. No console errors.

- [ ] **Step 4: Three-config calculation**

Pick a third config in `Configuratie 3` and recalculate.

Expected: same as Step 3 — no recommendation card after the scenario cards. No console errors.

- [ ] **Step 5: Backwards-compatibility check for saved state**

If a saved JSON or `?data=...` link from before this change is available, load it (via `📂 Laden vanuit JSON` or by visiting the URL).

Expected: the page restores normally and renders without the recommendation card. No console errors. (`_serializeState` never stored the recommendation block — it is recomputed at render time from `configResults` — so removing the render code is enough; no version bump or migration is needed.)

If no old saved state is at hand, skip this step and note it in the commit message; it's not blocking.

- [ ] **Step 6: Stop the local server**

In the terminal running the server, press Ctrl-C.

---

### Task 4: Commit

**Files:**
- `index.html` (modified)

- [ ] **Step 1: Review the diff one last time**

Run:
```bash
git diff index.html
```

Expected: only deletions in two places — the CSS block (~10 lines) and the JS block (~21 lines). No additions, no unrelated edits.

- [ ] **Step 2: Stage and commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
Remove "Aanbevolen configuratie" recommendation card

The auto-pick was based purely on payback time, which made it awkward
to recommend a different config to a customer.

Spec: docs/superpowers/specs/2026-04-17-remove-recommendation-card-design.md
EOF
)"
```

- [ ] **Step 3: Confirm clean status**

Run:
```bash
git status
git log --oneline -3
```

Expected: working tree clean (apart from any unrelated untracked files such as `CLAUDE.md` from earlier work). The most recent commit on `gh-pages` is the one just created.
