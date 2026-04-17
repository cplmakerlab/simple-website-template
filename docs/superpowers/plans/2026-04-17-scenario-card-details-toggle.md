# Scenario Card Details Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the seven breakdown rows of each scenario card behind a `<details>` disclosure (closed by default), and add one new prominent "Totale opgeslagen energie" row that aggregates `chargedFull + chargedPartial`.

**Architecture:** Single edit to `makeScenCard` (inside `renderResults` in `index.html`) plus one CSS block. The headline rows (new total + besparing + installatieprijs + TVT) stay outside the disclosure; the seven detail rows move inside a native `<details>` element. The progress bars below the disclosure are untouched. No JS required for the toggle (native HTML5 `<details>`).

**Tech Stack:** Plain HTML5 / CSS / vanilla JS in a single static file. No build, no test framework — verification is grep + manual browser.

**Spec:** `docs/superpowers/specs/2026-04-17-scenario-card-details-toggle-design.md` — read it before starting.

---

## File map

- **Modify:** `index.html` only.
  - One CSS block added near the existing `.bar-marker` rule (~line 264).
  - Two new local consts (`totalCharged`, `avgChargedLine`) and one restructured stat-row + details block inside `makeScenCard` (~lines 1281-1300).

## Working directory

`/home/ubuntu/battery-roi-tool`. Work directly on `gh-pages` (user explicitly chose this for this repo). Each task ends with its own commit. Push is the user's call; the implementer does not push.

## Notes for the implementer

- UI text is in Dutch — do not change copy language.
- No automated tests exist. Verification = grep + manual browser smoke test (which the user does).
- The `fkw` formatter (`n => fmt2(n) + ' kWh'`) lives in `renderResults`'s outer scope (declared near the summary card) and is reachable from inside `makeScenCard` via closure. Reuse it; do NOT redeclare.
- The new prominent row reuses the exact same styling pattern that the existing *Totale jaarlijkse besparing* row uses (`<span class="stat-value green big" style="display:flex;flex-direction:column;align-items:flex-end;">…</span>`).

---

### Task 1: Add CSS for `.scen-details` and restructure `makeScenCard`

**Files:**
- Modify: `index.html` — add CSS block (~line 273), update `makeScenCard` body (~lines 1281-1300).

This is one logical change (UI feature) split across CSS and JS in the same file, so it lives in one task with one commit. The CSS without a consumer would be dead code; the JS without the CSS would render an unstyled disclosure. Ship them together.

- [ ] **Step 1: Confirm anchor points still match what the plan expects**

Run:
```bash
grep -n "function makeScenCard\|^    \.bar-marker {" /home/ubuntu/battery-roi-tool/index.html
```
Expected: `function makeScenCard(...)` around line 1257 and `.bar-marker {` around line 264. Line numbers may drift slightly; if the surrounding code does not match the snippets in this task, stop and report `BLOCKED`.

- [ ] **Step 2: Add CSS for `.scen-details`**

Locate the `.bar-marker { … }` rule. Use Edit to replace this exact `old_string`:

```
    .bar-marker {
      position: absolute;
      top: -7px;
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 6px solid var(--muted);
      transform: translateX(-5px);
      pointer-events: none;
    }
```

with this `new_string`:

```
    .bar-marker {
      position: absolute;
      top: -7px;
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 6px solid var(--muted);
      transform: translateX(-5px);
      pointer-events: none;
    }

    /* ── Scenario card Details disclosure ──────────────────────────────────── */
    details.scen-details {
      margin: 8px 0 4px 0;
    }
    details.scen-details summary {
      cursor: pointer;
      list-style: none;
      padding: 10px 0;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
    }
    details.scen-details summary::-webkit-details-marker { display: none; }
    details.scen-details summary .chev {
      transition: transform 0.2s;
      font-size: 1rem;
      line-height: 1;
    }
    details.scen-details[open] summary .chev { transform: rotate(180deg); }
    details.scen-details[open] summary { border-bottom-color: transparent; }
    details.scen-details > .stat-row:first-of-type { padding-top: 10px; }
```

- [ ] **Step 3: Restructure the `makeScenCard` template — add helpers + new row + `<details>` wrapper**

The current template renders ten `.stat-row` divs (lines 1291-1300) in this order: Min injectie / Dagen volledig / Dagen gedeeltelijk / Opgeslagen volle / Opgeslagen gedeeltelijk / Besparing volle / Besparing gedeeltelijk / Totale besparing / Installatieprijs / Terugverdientijd. We're going to:
1. Add two local consts above the `return` (next to `avgPaybackLine` / `avgSavingLine`): `totalCharged` and `avgChargedLine`.
2. Replace that ten-row block with: the new *Totale opgeslagen energie* row first, then *Totale jaarlijkse besparing* / *Installatieprijs* / *Terugverdientijd* (unchanged), then a `<details class="scen-details">` containing the seven breakdown rows.

Use Edit to replace this exact `old_string`:

```
    const avgSavingLine = showAvg
      ? `<div class="muted-inline" style="display:block;margin-left:0;margin-top:2px;">gem. ${N} j: ${feur(scenAvg.annualSaving)}</div>`
      : '';
    return `<div class="scenario-card ${cssClass}">
      <span class="badge ${badgeClass}">${badge}</span>
      <h3>${title}</h3>
      <div class="scenario-sub">${extraInfo}${priceLine}</div>
      <div class="stat-row"><span class="stat-label">Min. dagelijkse injectie nodig</span><span class="stat-value">${fmt2(scen.threshold)} kWh</span></div>
      <div class="stat-row"><span class="stat-label">Dagen drempel volledig bereikt</span><span class="stat-value">${renderWithAvg(scen.qualifyingDays, showAvg ? scenAvg.qualifyingDays : null, fday, N)}</span></div>
      <div class="stat-row"><span class="stat-label">Dagen gedeeltelijk geladen</span><span class="stat-value" style="color:var(--warning)">${renderWithAvg(scen.partialDays, showAvg ? scenAvg.partialDays : null, fday, N)}</span></div>
      <div class="stat-row"><span class="stat-label">Opgeslagen volle cycli (periode)</span><span class="stat-value">${renderWithAvg(scen.chargedFull, showAvg ? scenAvg.chargedFull : null, fkw, N)}</span></div>
      <div class="stat-row"><span class="stat-label">Opgeslagen gedeeltelijk (periode)</span><span class="stat-value" style="color:var(--warning)">${renderWithAvg(scen.chargedPartial, showAvg ? scenAvg.chargedPartial : null, fkw, N)}</span></div>
      <div class="stat-row"><span class="stat-label">Jaarl. besparing volle cycli</span><span class="stat-value green">${renderWithAvg(scen.annualSavingFull, showAvg ? scenAvg.annualSavingFull : null, feur, N)}</span></div>
      <div class="stat-row"><span class="stat-label">Jaarl. besparing gedeeltelijk</span><span class="stat-value" style="color:var(--warning)">${renderWithAvg(scen.annualSavingPartial, showAvg ? scenAvg.annualSavingPartial : null, feur, N)}</span></div>
      <div class="stat-row"><span class="stat-label">Totale jaarlijkse besparing</span><span class="stat-value green big" style="display:flex;flex-direction:column;align-items:flex-end;">${feur(scen.annualSaving)}${avgSavingLine}</span></div>
      <div class="stat-row"><span class="stat-label">Installatieprijs</span><span class="stat-value">${fmtEur(installPrice)}</span></div>
      <div class="stat-row"><span class="stat-label">Terugverdientijd</span><span class="stat-value big" style="color:var(--warning);display:flex;flex-direction:column;align-items:flex-end;">${paybackText}${avgPaybackLine}</span></div>
```

with this `new_string`:

```
    const avgSavingLine = showAvg
      ? `<div class="muted-inline" style="display:block;margin-left:0;margin-top:2px;">gem. ${N} j: ${feur(scenAvg.annualSaving)}</div>`
      : '';
    const totalCharged = scen.chargedFull + scen.chargedPartial;
    const avgTotalCharged = showAvg ? scenAvg.chargedFull + scenAvg.chargedPartial : null;
    const avgChargedLine = showAvg
      ? `<div class="muted-inline" style="display:block;margin-left:0;margin-top:2px;">gem. ${N} j: ${fkw(avgTotalCharged)}</div>`
      : '';
    return `<div class="scenario-card ${cssClass}">
      <span class="badge ${badgeClass}">${badge}</span>
      <h3>${title}</h3>
      <div class="scenario-sub">${extraInfo}${priceLine}</div>
      <div class="stat-row"><span class="stat-label">Totale opgeslagen energie</span><span class="stat-value green big" style="display:flex;flex-direction:column;align-items:flex-end;">${fkw(totalCharged)}${avgChargedLine}</span></div>
      <div class="stat-row"><span class="stat-label">Totale jaarlijkse besparing</span><span class="stat-value green big" style="display:flex;flex-direction:column;align-items:flex-end;">${feur(scen.annualSaving)}${avgSavingLine}</span></div>
      <div class="stat-row"><span class="stat-label">Installatieprijs</span><span class="stat-value">${fmtEur(installPrice)}</span></div>
      <div class="stat-row"><span class="stat-label">Terugverdientijd</span><span class="stat-value big" style="color:var(--warning);display:flex;flex-direction:column;align-items:flex-end;">${paybackText}${avgPaybackLine}</span></div>
      <details class="scen-details">
        <summary>Details <span class="chev">▾</span></summary>
        <div class="stat-row"><span class="stat-label">Min. dagelijkse injectie nodig</span><span class="stat-value">${fmt2(scen.threshold)} kWh</span></div>
        <div class="stat-row"><span class="stat-label">Dagen drempel volledig bereikt</span><span class="stat-value">${renderWithAvg(scen.qualifyingDays, showAvg ? scenAvg.qualifyingDays : null, fday, N)}</span></div>
        <div class="stat-row"><span class="stat-label">Dagen gedeeltelijk geladen</span><span class="stat-value" style="color:var(--warning)">${renderWithAvg(scen.partialDays, showAvg ? scenAvg.partialDays : null, fday, N)}</span></div>
        <div class="stat-row"><span class="stat-label">Opgeslagen volle cycli (periode)</span><span class="stat-value">${renderWithAvg(scen.chargedFull, showAvg ? scenAvg.chargedFull : null, fkw, N)}</span></div>
        <div class="stat-row"><span class="stat-label">Opgeslagen gedeeltelijk (periode)</span><span class="stat-value" style="color:var(--warning)">${renderWithAvg(scen.chargedPartial, showAvg ? scenAvg.chargedPartial : null, fkw, N)}</span></div>
        <div class="stat-row"><span class="stat-label">Jaarl. besparing volle cycli</span><span class="stat-value green">${renderWithAvg(scen.annualSavingFull, showAvg ? scenAvg.annualSavingFull : null, feur, N)}</span></div>
        <div class="stat-row"><span class="stat-label">Jaarl. besparing gedeeltelijk</span><span class="stat-value" style="color:var(--warning)">${renderWithAvg(scen.annualSavingPartial, showAvg ? scenAvg.annualSavingPartial : null, feur, N)}</span></div>
      </details>
```

Note the indentation: the seven `.stat-row` divs inside `<details>` are indented with **8 spaces** (one extra level relative to today, since they sit inside `<details>`). The existing rendering of `.stat-row` does not depend on indentation.

- [ ] **Step 4: Verify**

Run these greps:

```bash
grep -n "details.scen-details {" /home/ubuntu/battery-roi-tool/index.html
grep -n "Totale opgeslagen energie" /home/ubuntu/battery-roi-tool/index.html
grep -nE "<details class=\"scen-details\">" /home/ubuntu/battery-roi-tool/index.html
grep -n "summary>Details <span class=\"chev\">" /home/ubuntu/battery-roi-tool/index.html
```

Expected: 1 hit each (1 CSS rule, 1 row label, 1 `<details>` open tag, 1 `<summary>` text).

```bash
grep -c "renderWithAvg(" /home/ubuntu/battery-roi-tool/index.html
```
Expected: **15** — same as before this change. The rows inside `<details>` are unchanged in their `renderWithAvg` calls; we did not add or remove any avg companion. (Helper definition = 1, summary card = 8, scenario stat rows = 6.)

```bash
grep -n "Min. dagelijkse injectie nodig\|Jaarl. besparing volle cycli" /home/ubuntu/battery-roi-tool/index.html
```
Expected: 1 hit each — the rows still exist (they just moved inside `<details>`).

**Browser-based verification is deferred** — the user will do it. You do NOT need to start a local server.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Add Details disclosure + Totale opgeslagen energie row to scenario cards

Customer-facing summary view now shows four headline rows (the new
Totale opgeslagen energie sum + Totale jaarlijkse besparing +
Installatieprijs + Terugverdientijd) plus the two recovery progress
bars. The seven breakdown rows (days full/partial, storage
full/partial, savings full/partial, min daily injection threshold)
move into a closed-by-default <details> block so the salesperson
isn't reading past them when explaining the result.

Spec: docs/superpowers/specs/2026-04-17-scenario-card-details-toggle-design.md
EOF
)"
```

- [ ] **Step 6: Self-review**

Run:
```bash
git diff HEAD~1 -- index.html | head -80
git log --oneline -3
git status
```

Confirm:
- The diff shows the CSS block addition (~22 lines) and the makeScenCard restructure (~25 lines net change from re-ordering and wrapping).
- Top commit is yours.
- Working tree is clean (only untracked files allowed).

## Report format

- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- New commit SHA
- Output of all greps from Step 4
- Anything unexpected
