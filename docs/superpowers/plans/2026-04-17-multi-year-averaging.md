# Multi-Year Averaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user supplies ≥ 2 complete years of CSV data, show a "gem. N j" companion next to every "afgelopen jaar" number and a `▼` marker at the average position on every progress bar; when N ≤ 1 the UI is byte-identical to today.

**Architecture:** Two new JS helpers in `index.html` compute per-year stats and their averages without touching the existing rolling-year code path. `processData` calls them and adds new fields to the object passed to `renderResults`. The save/share state bumps `v: 2 → v: 3` (with v2 backwards-compatibility). Each render section (`renderResults` and `renderCapAnalysis`) is updated section-by-section, gated on `numYears > 1`, using a shared `renderWithAvg` helper and a `.bar-marker` CSS class.

**Tech Stack:** Plain HTML / CSS / vanilla JS in a single file (`index.html`). No build, no test framework — verification is grep + DevTools console + manual browser smoke tests.

**Spec:** `docs/superpowers/specs/2026-04-17-multi-year-averaging-design.md` — read it before starting.

---

## File map

- **Modify:** `index.html` only. The file currently has 1245 lines; it will grow to ~1500 lines.
- All new code lives near its consumers (helpers near `processData`; render helpers near `renderResults`; CSS near the existing related blocks).

## Working directory

`/home/ubuntu/battery-roi-tool`. Work directly on the `gh-pages` branch (no worktree, no feature branch — the user works this way for this repo). Each task ends with its own commit. The user pushes when they decide; the implementer does not push.

## Notes for the implementer

- The repo is a Belgian battery ROI calculator, in Dutch. Don't change copy language.
- There are no automated tests. Each task ends with a brief manual verification (DevTools console snippet, grep, or browser smoke test) — follow the verification step exactly. If a verification step says "open the browser and click X", you must be honest if you can't actually do that and stop with `BLOCKED`/`DONE_WITH_CONCERNS` — the controller will arrange the manual check.
- Several tasks add functions and fields that later tasks consume. Use the **exact** names defined in earlier tasks: `computePerYearStats`, `averageStats`, `renderWithAvg`, fields `numYears`, `yearsStart`, `avgTotals`, `scenWCAvg`, `scenOptAvg`, `avgInjectie` (per month), `avgQualDays` (per cap row).
- Follow the file's existing style: 2-space indent, embedded `<style>` block uses `var(--…)` tokens, embedded `<script>` block uses vanilla JS (no modules, no semicolons-optional — keep semicolons).

---

### Task 1: Add per-year and average helpers to the data layer

**Files:**
- Modify: `index.html` — insert two new functions just **before** `function processData(…)` (currently around line 811), and modify `processData` to call them and pass their output to `renderResults`.

The goal: after this task, `_saved` (the object passed to `renderResults`) gains five new fields — `numYears`, `yearsStart`, `avgTotals`, plus `scenWCAvg` / `scenOptAvg` on each `configResults[i]` — plus a per-month `avgInjectie` on `monthMap` and a per-row `avgQualDays` on `capAnalysis.rows`. Rendering still ignores these fields, so visually nothing changes yet.

- [ ] **Step 1: Locate `processData` and confirm context**

Run:
```bash
grep -n "^function processData" /home/ubuntu/battery-roi-tool/index.html
grep -n "^function renderResults" /home/ubuntu/battery-roi-tool/index.html
```

Expected: `processData` appears once around line 811, `renderResults` once around line 952. If line numbers have drifted, re-read the surrounding code to confirm the function bodies match what this plan assumes.

- [ ] **Step 2: Insert `computePerYearStats` immediately before `processData`**

Use Edit to replace this exact `old_string`:

```
function processData(csvText, pvInv, selectedConfigs, priceDay, priceNight) {
  const rows = parseCSV(csvText);
```

with this `new_string`:

```
// ─── MULTI-YEAR HELPERS ────────────────────────────────────────────────────────
// Slice allDays into N complete 365-day blocks counting backward from lastDate.
// Returns { numYears, yearsStart, perYear } where perYear[0] is the most recent year.
// numYears = floor((lastDate - firstDate + 1) / 365). When numYears < 1, returns
// { numYears: 0, yearsStart: null, perYear: [] } and callers should fall back to
// existing single-window behavior.
function computePerYearStats(allDays, selectedConfigs, lastDate, priceDay, priceNight) {
  if (!allDays.length) return { numYears: 0, yearsStart: null, perYear: [] };
  const firstDate = allDays[0].date;
  const spanDays  = Math.floor((lastDate - firstDate) / 86400000) + 1;
  const numYears  = Math.floor(spanDays / 365);
  if (numYears < 1) return { numYears: 0, yearsStart: null, perYear: [] };

  const dualTariff = !isNaN(priceNight) && priceNight > 0;
  const perYear = [];
  for (let k = 1; k <= numYears; k++) {
    const winEnd   = new Date(lastDate); winEnd.setDate(winEnd.getDate() - 365 * (k - 1));
    const winStart = new Date(lastDate); winStart.setDate(winStart.getDate() - 365 * k + 1);
    const days = allDays.filter(d => d.date >= winStart && d.date <= winEnd);

    const sums = days.reduce((s, d) => ({
      afname:        s.afname        + d.afname,
      injectie:      s.injectie      + d.injectie,
      afnamedag:     s.afnamedag     + d.afnamedag,
      afnamenacht:   s.afnamenacht   + d.afnamenacht,
      injectiedag:   s.injectiedag   + d.injectiedag,
      injectienacht: s.injectienacht + d.injectienacht,
    }), { afname:0, injectie:0, afnamedag:0, afnamenacht:0, injectiedag:0, injectienacht:0 });

    const effectivePrice = (dualTariff && sums.afname > 0)
      ? (sums.afnamedag / sums.afname) * priceDay + (sums.afnamenacht / sums.afname) * priceNight
      : priceDay;

    const scenarios = selectedConfigs.map(cfg => {
      const pvGtBat     = pvInv > cfg.batInv;
      const thresholdWC = pvGtBat ? cfg.batCap * (pvInv / cfg.batInv) : cfg.batCap;
      const thresholdOpt= cfg.batCap;
      function calc(threshold) {
        let qualifyingDays = 0, partialDays = 0, chargedFull = 0, chargedPartial = 0;
        for (const d of days) {
          if (d.injectie >= threshold) { qualifyingDays++; chargedFull += cfg.batCap * cfg.eff; }
          else if (d.injectie > 0)     { partialDays++;    chargedPartial += (d.injectie / threshold) * cfg.batCap * cfg.eff; }
        }
        const annualSavingFull    = chargedFull    * effectivePrice;
        const annualSavingPartial = chargedPartial * effectivePrice;
        const annualSaving        = annualSavingFull + annualSavingPartial;
        const payback             = cfg.price > 0 ? cfg.price / annualSaving : Infinity;
        const recoveryPctFull     = (chargedFull    / (sums.afname    || 1)) * 100;
        const recoveryPctPartial  = (chargedPartial / (sums.afname    || 1)) * 100;
        const injPctFull          = (chargedFull    / cfg.eff / (sums.injectie || 1)) * 100;
        const injPctPartial       = (chargedPartial / cfg.eff / (sums.injectie || 1)) * 100;
        return {
          qualifyingDays, partialDays, chargedFull, chargedPartial,
          annualSavingFull, annualSavingPartial, annualSaving, payback,
          recoveryPctFull, recoveryPctPartial, injPctFull, injPctPartial,
          threshold,
        };
      }
      return { scenWC: calc(thresholdWC), scenOpt: pvGtBat ? calc(thresholdOpt) : null };
    });

    perYear.push({ windowStart: winStart, windowEnd: winEnd, ...sums, effectivePrice, scenarios });
  }

  const yearsStart = perYear[perYear.length - 1].windowStart;
  return { numYears, yearsStart, perYear };
}

// Average across all per-year stats. For derived metrics (payback, recovery%),
// compute FROM averages (avgPayback = installPrice / avgAnnualSaving), not
// the mean of yearly derivatives. Returns null when perYear.length < 1.
function averageStats(perYear, selectedConfigs) {
  if (!perYear.length) return null;
  const N = perYear.length;
  const mean = key => perYear.reduce((s, y) => s + y[key], 0) / N;
  const totalAfname        = mean('afname');
  const totalInjectie      = mean('injectie');
  const totalAfnamedag     = mean('afnamedag');
  const totalAfnamenacht   = mean('afnamenacht');
  const totalInjectiedag   = mean('injectiedag');
  const totalInjectienacht = mean('injectienacht');
  const effectivePrice     = mean('effectivePrice');

  const scenarios = selectedConfigs.map((cfg, i) => {
    function avgScen(scenKey) {
      const arr = perYear.map(y => y.scenarios[i][scenKey]).filter(Boolean);
      if (!arr.length) return null;
      const m = key => arr.reduce((s, sc) => s + sc[key], 0) / arr.length;
      const avgChargedFull    = m('chargedFull');
      const avgChargedPartial = m('chargedPartial');
      const avgAnnualSavingFull    = m('annualSavingFull');
      const avgAnnualSavingPartial = m('annualSavingPartial');
      const avgAnnualSaving        = m('annualSaving');
      return {
        qualifyingDays: m('qualifyingDays'),
        partialDays:    m('partialDays'),
        chargedFull:    avgChargedFull,
        chargedPartial: avgChargedPartial,
        annualSavingFull:    avgAnnualSavingFull,
        annualSavingPartial: avgAnnualSavingPartial,
        annualSaving:        avgAnnualSaving,
        payback:             cfg.price > 0 && avgAnnualSaving > 0 ? cfg.price / avgAnnualSaving : Infinity,
        recoveryPctFull:     (avgChargedFull    / (totalAfname    || 1)) * 100,
        recoveryPctPartial:  (avgChargedPartial / (totalAfname    || 1)) * 100,
        injPctFull:          (avgChargedFull    / cfg.eff / (totalInjectie || 1)) * 100,
        injPctPartial:       (avgChargedPartial / cfg.eff / (totalInjectie || 1)) * 100,
        threshold:           arr[0].threshold,
      };
    }
    return { scenWCAvg: avgScen('scenWC'), scenOptAvg: avgScen('scenOpt') };
  });

  return {
    totalAfname, totalInjectie,
    totalAfnamedag, totalAfnamenacht, totalInjectiedag, totalInjectienacht,
    effectivePrice,
    avgAfnamePerDay:   totalAfname   / 365,
    avgInjectiePerDay: totalInjectie / 365,
    scenarios,
  };
}

function processData(csvText, pvInv, selectedConfigs, priceDay, priceNight) {
  const rows = parseCSV(csvText);
```

- [ ] **Step 3: Compute per-month avg injection inside `processData`**

Locate the existing monthly map block in `processData`. Use Edit to replace this exact `old_string`:

```
  // ── Monthly map (simplified — no threshold columns) ────────────────────────
  const monthMap = {};
  for (const d of windowDays) {
    const mk = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}`;
    if (!monthMap[mk]) monthMap[mk] = { injectie:0, afname:0, injectiedag:0, injectienacht:0, afnamedag:0, afnamenacht:0 };
    monthMap[mk].injectie      += d.injectie;
    monthMap[mk].afname        += d.afname;
    monthMap[mk].injectiedag   += d.injectiedag;
    monthMap[mk].injectienacht += d.injectienacht;
    monthMap[mk].afnamedag     += d.afnamedag;
    monthMap[mk].afnamenacht   += d.afnamenacht;
  }
```

with this `new_string`:

```
  // ── Monthly map (simplified — no threshold columns) ────────────────────────
  const monthMap = {};
  for (const d of windowDays) {
    const mk = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}`;
    if (!monthMap[mk]) monthMap[mk] = { injectie:0, afname:0, injectiedag:0, injectienacht:0, afnamedag:0, afnamenacht:0, avgInjectie: null };
    monthMap[mk].injectie      += d.injectie;
    monthMap[mk].afname        += d.afname;
    monthMap[mk].injectiedag   += d.injectiedag;
    monthMap[mk].injectienacht += d.injectienacht;
    monthMap[mk].afnamedag     += d.afnamedag;
    monthMap[mk].afnamenacht   += d.afnamenacht;
  }

  // ── Multi-year per-year stats + averages (gated on N >= 2 in renderer) ─────
  const py = computePerYearStats(allDays, selectedConfigs, lastDate, priceDay, priceNight);
  const numYears  = py.numYears;
  const yearsStart= py.yearsStart;
  const avgTotals = numYears >= 2 ? averageStats(py.perYear, selectedConfigs) : null;

  // Per-month avg injection across the same calendar month over all N years.
  if (numYears >= 2) {
    for (const mk of Object.keys(monthMap)) {
      const [, mo] = mk.split('-');
      const moNum = +mo;
      // Sum injection across all N year-blocks for this calendar month.
      let total = 0;
      for (const yr of py.perYear) {
        for (const day of allDays) {
          if (day.date >= yr.windowStart && day.date <= yr.windowEnd && (day.date.getMonth() + 1) === moNum) {
            total += day.injectie;
          }
        }
      }
      monthMap[mk].avgInjectie = total / numYears;
    }
  }
```

- [ ] **Step 4: Compute per-cap-row avg qualDays inside `processData`**

Locate the capacity analysis block. Use Edit to replace this exact `old_string`:

```
  // ── Capacity analysis — simplified: only qualDays per capacity step ────────
  const capRows = [];
  let capMaxDays = null;
  const CAP_STEP = 2.5;
  for (let cap = CAP_STEP; cap <= 200; cap = Math.round((cap + CAP_STEP) * 10) / 10) {
    let qualDays = 0;
    for (const day of windowDays) { if (day.injectie >= cap) qualDays++; }
    capRows.push({ cap, qualDays });
    if (qualDays >= 100) capMaxDays = cap;
    if (capMaxDays !== null && cap >= capMaxDays + 3 * CAP_STEP) break;
  }
  const capAnalysis = { rows: capRows, maxCap: capMaxDays };
```

with this `new_string`:

```
  // ── Capacity analysis — qualDays per capacity step (current year + multi-year avg) ──
  const capRows = [];
  let capMaxDays = null;
  const CAP_STEP = 2.5;
  for (let cap = CAP_STEP; cap <= 200; cap = Math.round((cap + CAP_STEP) * 10) / 10) {
    let qualDays = 0;
    for (const day of windowDays) { if (day.injectie >= cap) qualDays++; }
    let avgQualDays = null;
    if (numYears >= 2) {
      let totalQual = 0;
      for (const yr of py.perYear) {
        let yrQual = 0;
        for (const day of allDays) {
          if (day.date >= yr.windowStart && day.date <= yr.windowEnd && day.injectie >= cap) yrQual++;
        }
        totalQual += yrQual;
      }
      avgQualDays = totalQual / numYears;
    }
    capRows.push({ cap, qualDays, avgQualDays });
    if (qualDays >= 100) capMaxDays = cap;
    if (capMaxDays !== null && cap >= capMaxDays + 3 * CAP_STEP) break;
  }
  const capAnalysis = { rows: capRows, maxCap: capMaxDays };
```

- [ ] **Step 5: Decorate `configResults` with avg scenarios and pass new fields to `renderResults`**

Locate the `renderResults({...})` call at the end of `processData`. Use Edit to replace this exact `old_string`:

```
  // ── Render ─────────────────────────────────────────────────────────────────
  renderResults({
    isFullYear, windowStart, lastDate, daysInWindow,
    totalAfname, totalInjectie,
    totalAfnamedag, totalAfnamenacht, totalInjectiedag, totalInjectienacht,
    dualTariff, priceDay, priceNight, effectivePrice,
    pvInv, configResults,
    monthMap, eanCode, meterNr, meterType,
    firstDate, allDays, capAnalysis
  });
}
```

with this `new_string`:

```
  // Attach avg scenarios to each configResult (parallel to scenWC / scenOpt).
  if (avgTotals) {
    configResults.forEach((cr, i) => {
      cr.scenWCAvg  = avgTotals.scenarios[i].scenWCAvg;
      cr.scenOptAvg = avgTotals.scenarios[i].scenOptAvg;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  renderResults({
    isFullYear, windowStart, lastDate, daysInWindow,
    totalAfname, totalInjectie,
    totalAfnamedag, totalAfnamenacht, totalInjectiedag, totalInjectienacht,
    dualTariff, priceDay, priceNight, effectivePrice,
    pvInv, configResults,
    monthMap, eanCode, meterNr, meterType,
    firstDate, allDays, capAnalysis,
    numYears, yearsStart, avgTotals,
  });
}
```

- [ ] **Step 6: Verify the file parses and the new fields appear**

Run:
```bash
grep -n "function computePerYearStats\|function averageStats\|numYears, yearsStart, avgTotals" /home/ubuntu/battery-roi-tool/index.html
```

Expected: 3 hits — the two function declarations and the line inside the `renderResults({…})` call.

Then open `index.html` in a browser, open DevTools console, load a CSV that has at least 2 years of data, and run:
```javascript
calculate();        // wait for results to render
console.log({
  numYears: _saved.numYears,
  yearsStart: _saved.yearsStart,
  hasAvg: !!_saved.avgTotals,
  monthHasAvg: Object.values(_saved.monthMap).every(m => m.avgInjectie != null),
  capRowHasAvg: _saved.capAnalysis.rows.every(r => r.avgQualDays != null),
  cfgHasAvg: _saved.configResults.every(c => c.scenWCAvg != null),
});
```

Expected console output: `numYears` is an integer ≥ 2; `yearsStart` is a Date; `hasAvg/monthHasAvg/capRowHasAvg/cfgHasAvg` all `true`. No console errors.

Then load a CSV with **less than 1 year** of data and re-run `calculate()`:
```javascript
console.log({ numYears: _saved.numYears, hasAvg: !!_saved.avgTotals });
```

Expected: `numYears: 0, hasAvg: false`. Existing extrapolation behavior unchanged. No console errors.

If you cannot run the browser check yourself, report `DONE_WITH_CONCERNS` and list the parts you verified via grep so the controller can do the manual check.

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Add multi-year per-year stats and averaging helpers

Adds computePerYearStats and averageStats. processData now also
attaches numYears, yearsStart, avgTotals, scenWCAvg/scenOptAvg
on each configResult, monthMap[mk].avgInjectie, and
capAnalysis.rows[i].avgQualDays. Renderer ignores these for now —
no visible change.

Spec: docs/superpowers/specs/2026-04-17-multi-year-averaging-design.md
EOF
)"
```

---

### Task 2: Bump save/share state to v3 with backwards-compatibility for v2

**Files:**
- Modify: `index.html` — `_serializeState`, `_restoreState`, `_applyLoadedState` (currently around lines 575-690).

The goal: a fresh calculate-then-share round-trip preserves the new fields exactly; an old v2 link or JSON loads cleanly with `numYears: 1` (no avg UI) and zero console errors.

- [ ] **Step 1: Update `_serializeState` to v3**

Use Edit to replace this exact `old_string`:

```
function _serializeState() {
  if (!_saved) return null;
  const d = _saved;
  return {
    v: 2,
    form: {
      pvInv:    d.pvInv,
      priceDay: d.priceDay,
      priceNight: (d.dualTariff && !isNaN(d.priceNight)) ? d.priceNight : null,
      selectedConfigTypes: d.configResults.map(cr => cr.cfg.type),
    },
    r: {
      isFullYear: d.isFullYear,
      windowStart: d.windowStart.toISOString().slice(0,10),
      lastDate:    d.lastDate.toISOString().slice(0,10),
      firstDate:   d.firstDate.toISOString().slice(0,10),
      daysInWindow: d.daysInWindow,
      totalDaysCSV: d.allDays.length,
      totalAfname: d.totalAfname, totalInjectie: d.totalInjectie,
      totalAfnamedag: d.totalAfnamedag, totalAfnamenacht: d.totalAfnamenacht,
      totalInjectiedag: d.totalInjectiedag, totalInjectienacht: d.totalInjectienacht,
      dualTariff: d.dualTariff, priceDay: d.priceDay,
      priceNight: d.dualTariff ? d.priceNight : null,
      effectivePrice: d.effectivePrice,
      pvInv: d.pvInv,
      configResults: d.configResults,
      monthMap: d.monthMap,
      eanCode: d.eanCode, meterNr: d.meterNr, meterType: d.meterType,
      capAnalysis: d.capAnalysis
    }
  };
}
```

with this `new_string`:

```
function _serializeState() {
  if (!_saved) return null;
  const d = _saved;
  return {
    v: 3,
    form: {
      pvInv:    d.pvInv,
      priceDay: d.priceDay,
      priceNight: (d.dualTariff && !isNaN(d.priceNight)) ? d.priceNight : null,
      selectedConfigTypes: d.configResults.map(cr => cr.cfg.type),
    },
    r: {
      isFullYear: d.isFullYear,
      windowStart: d.windowStart.toISOString().slice(0,10),
      lastDate:    d.lastDate.toISOString().slice(0,10),
      firstDate:   d.firstDate.toISOString().slice(0,10),
      daysInWindow: d.daysInWindow,
      totalDaysCSV: d.allDays.length,
      totalAfname: d.totalAfname, totalInjectie: d.totalInjectie,
      totalAfnamedag: d.totalAfnamedag, totalAfnamenacht: d.totalAfnamenacht,
      totalInjectiedag: d.totalInjectiedag, totalInjectienacht: d.totalInjectienacht,
      dualTariff: d.dualTariff, priceDay: d.priceDay,
      priceNight: d.dualTariff ? d.priceNight : null,
      effectivePrice: d.effectivePrice,
      pvInv: d.pvInv,
      configResults: d.configResults,
      monthMap: d.monthMap,
      eanCode: d.eanCode, meterNr: d.meterNr, meterType: d.meterType,
      capAnalysis: d.capAnalysis,
      numYears:   d.numYears   || 1,
      yearsStart: d.yearsStart ? d.yearsStart.toISOString().slice(0,10) : null,
      avgTotals:  d.avgTotals  || null,
    }
  };
}
```

- [ ] **Step 2: Update `_restoreState` to handle v3 fields**

Use Edit to replace this exact `old_string`:

```
function _restoreState(r) {
  r.windowStart = new Date(r.windowStart + 'T00:00:00');
  r.lastDate    = new Date(r.lastDate    + 'T00:00:00');
  r.firstDate   = new Date(r.firstDate   + 'T00:00:00');
  r.allDays     = { length: r.totalDaysCSV };
  if (r.priceNight == null) r.priceNight = NaN;
  return r;
}
```

with this `new_string`:

```
function _restoreState(r) {
  r.windowStart = new Date(r.windowStart + 'T00:00:00');
  r.lastDate    = new Date(r.lastDate    + 'T00:00:00');
  r.firstDate   = new Date(r.firstDate   + 'T00:00:00');
  r.allDays     = { length: r.totalDaysCSV };
  if (r.priceNight == null) r.priceNight = NaN;
  // Multi-year fields: present in v3, absent in v2/v1.
  if (r.numYears == null)   r.numYears   = 1;
  if (r.yearsStart && typeof r.yearsStart === 'string') r.yearsStart = new Date(r.yearsStart + 'T00:00:00');
  if (r.avgTotals === undefined) r.avgTotals = null;
  return r;
}
```

- [ ] **Step 3: Accept v3 in `_applyLoadedState`**

Use Edit to replace this exact `old_string`:

```
function _applyLoadedState(state, showBanner) {
  if (!state || (state.v !== 1 && state.v !== 2)) { alert('Onbekend of verouderd bestandsformaat.'); return; }
  const f = state.form || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val != null ? val : ''; };
  set('pvInverter',    f.pvInv);
  set('elecPrice',     f.priceDay);
  set('elecPriceNight',f.priceNight);
  if (state.v === 2 && f.selectedConfigTypes && f.selectedConfigTypes.some(t => t)) {
    loadConfigs().then(() => _populateConfigSelects(f.selectedConfigTypes)).catch(() => {});
  }
```

with this `new_string`:

```
function _applyLoadedState(state, showBanner) {
  if (!state || (state.v !== 1 && state.v !== 2 && state.v !== 3)) { alert('Onbekend of verouderd bestandsformaat.'); return; }
  const f = state.form || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val != null ? val : ''; };
  set('pvInverter',    f.pvInv);
  set('elecPrice',     f.priceDay);
  set('elecPriceNight',f.priceNight);
  if ((state.v === 2 || state.v === 3) && f.selectedConfigTypes && f.selectedConfigTypes.some(t => t)) {
    loadConfigs().then(() => _populateConfigSelects(f.selectedConfigTypes)).catch(() => {});
  }
```

- [ ] **Step 4: Verify the round-trip**

Open `index.html` in a browser. Load a CSV with ≥ 2 years and click *Bereken ROI*. In DevTools console:

```javascript
const state = _serializeState();
console.log({ v: state.v, numYears: state.r.numYears, hasAvg: !!state.r.avgTotals, yearsStart: state.r.yearsStart });
```

Expected: `v: 3, numYears: <integer ≥ 2>, hasAvg: true, yearsStart: 'YYYY-MM-DD'`.

Then click *Download JSON*, open the downloaded file in a text editor and confirm `"v": 3` is at the top.

Then re-import the JSON via *Laden vanuit JSON* — page should re-render without errors and `_saved.numYears` / `_saved.avgTotals` should round-trip identically (they are still ignored by the renderer at this point, but the values must be present).

Backwards compatibility: paste this v2 sample into a file named `legacy_v2.json` somewhere temporary and load it via *Laden vanuit JSON*:

```json
{ "v": 2, "form": {"pvInv": 5, "priceDay": 0.28, "priceNight": null, "selectedConfigTypes": []}, "r": {"isFullYear": true, "windowStart": "2025-01-01", "lastDate": "2025-12-31", "firstDate": "2024-12-31", "daysInWindow": 365, "totalDaysCSV": 366, "totalAfname": 4000, "totalInjectie": 3500, "totalAfnamedag": 0, "totalAfnamenacht": 0, "totalInjectiedag": 0, "totalInjectienacht": 0, "dualTariff": false, "priceDay": 0.28, "priceNight": null, "effectivePrice": 0.28, "pvInv": 5, "configResults": [], "monthMap": {}, "eanCode": "TEST", "meterNr": "M1", "meterType": "T1", "capAnalysis": {"rows": [], "maxCap": null} } }
```

Expected: page renders without errors. `_saved.numYears === 1`, `_saved.avgTotals === null`. No prompt about "verouderd bestandsformaat".

If you cannot do the browser checks yourself, do at minimum the grep verification:
```bash
grep -n "v: 3\|state.v !== 3\|numYears: d.numYears" /home/ubuntu/battery-roi-tool/index.html
```
Expected: 3 hits, all in the three edited functions. Report `DONE_WITH_CONCERNS` and list which manual checks are still needed.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Bump save/share state to v3 with multi-year fields

v3 saves numYears, yearsStart, avgTotals; renderer still ignores
them (so a v3 link looks identical to v2 today). v2 and v1 keep
loading without prompts: numYears defaults to 1 and avgTotals to
null on restore, which the renderer will treat as "no avg UI".

Spec: docs/superpowers/specs/2026-04-17-multi-year-averaging-design.md
EOF
)"
```

---

### Task 3: Add `renderWithAvg` helper and `.bar-marker` / `.muted-inline` CSS

**Files:**
- Modify: `index.html` — add CSS rules near the existing scenario/bar styles, add the JS helper near the top of the `<script>` block (next to `fmt2` / `fmtEur`).

The goal: shared building blocks for all later tasks. Visually nothing changes (no consumer of these yet).

- [ ] **Step 1: Add CSS rules**

Locate the existing `.bar-bg` / `.bar-fill` block (around line 217). Use Edit to replace this exact `old_string`:

```
    .bar-bg.dual {
      position: relative;
      height: 14px;
    }
    .bar-bg.dual .bar-fill {
      position: absolute;
      top: 0;
      height: 100%;
    }
    .bar-legend {
      display: flex;
      gap: 12px;
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 5px;
    }
    .bar-legend span { display: flex; align-items: center; gap: 4px; }
    .bar-legend .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
```

with this `new_string`:

```
    .bar-bg.dual {
      position: relative;
      height: 14px;
    }
    .bar-bg.dual .bar-fill {
      position: absolute;
      top: 0;
      height: 100%;
    }
    .bar-legend {
      display: flex;
      gap: 12px;
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 5px;
      flex-wrap: wrap;
    }
    .bar-legend span { display: flex; align-items: center; gap: 4px; }
    .bar-legend .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }

    /* ── Multi-year average UI ─────────────────────────────────────────────── */
    .muted-inline {
      font-weight: 400;
      font-size: 0.85em;
      color: var(--muted);
      margin-left: 6px;
    }
    .bar-with-marker {
      flex: 1;
      position: relative;
    }
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

- [ ] **Step 2: Add `renderWithAvg` JS helper**

Locate the existing `fmtEur` definition. Use Edit to replace this exact `old_string`:

```
function fmt2(n) { return n.toFixed(2); }
function fmtEur(n) { return '€\u00a0' + n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
```

with this `new_string`:

```
function fmt2(n) { return n.toFixed(2); }
function fmtEur(n) { return '€\u00a0' + n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// Render a value with an optional "· gem. N j: <avg>" companion.
// formatter: function (number) -> string. numYears: integer. avgValue: number | null | undefined.
// When numYears < 2 or avgValue is null/undefined/NaN, returns just formatter(currentValue).
function renderWithAvg(currentValue, avgValue, formatter, numYears) {
  const cur = formatter(currentValue);
  if (!numYears || numYears < 2 || avgValue == null || (typeof avgValue === 'number' && isNaN(avgValue))) return cur;
  return cur + `<span class="muted-inline">· gem. ${numYears} j: ${formatter(avgValue)}</span>`;
}
```

- [ ] **Step 3: Verify presence**

Run:
```bash
grep -n "function renderWithAvg\|\.bar-marker {\|\.muted-inline {" /home/ubuntu/battery-roi-tool/index.html
```

Expected: 3 hits.

Open `index.html` in a browser, then in DevTools console:
```javascript
console.log(renderWithAvg(10, 12, fmt2, 3));
console.log(renderWithAvg(10, 12, fmt2, 1));
console.log(renderWithAvg(10, null, fmt2, 3));
```

Expected:
```
10.00<span class="muted-inline">· gem. 3 j: 12.00</span>
10.00
10.00
```

(The leading newline-or-whitespace before `<span` is fine if you wrote it differently — what matters is the v3 output contains the span and the v1/null outputs do not.)

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Add renderWithAvg helper and bar-marker / muted-inline CSS

Shared building blocks for the multi-year UI. No consumer yet —
no visible change.

Spec: docs/superpowers/specs/2026-04-17-multi-year-averaging-design.md
EOF
)"
```

---

### Task 4: Period alert mentions multi-year window

**Files:**
- Modify: `index.html` — the `else` branch of the period-alert block in `renderResults` (around lines 964-967).

First visible change: when `numYears >= 2`, the period alert gains a second sentence naming the multi-year date range.

- [ ] **Step 1: Update the period alert**

Use Edit to replace this exact `old_string`:

```
  } else {
    periodHTML = `<div class="alert alert-info">
      ℹ️ <div>Berekening op basis van rollend jaar: ${formatDate(d.windowStart)} – ${formatDate(d.lastDate)} (${d.daysInWindow} dagen).</div></div>`;
  }
```

with this `new_string`:

```
  } else {
    const avgLine = (d.numYears >= 2 && d.yearsStart)
      ? `<br><span style="font-size:0.88rem;">Gemiddelde berekend over <strong>${d.numYears} volledige jaren</strong> (${formatDate(d.yearsStart)} – ${formatDate(d.lastDate)}).</span>`
      : '';
    periodHTML = `<div class="alert alert-info">
      ℹ️ <div>Berekening op basis van rollend jaar: ${formatDate(d.windowStart)} – ${formatDate(d.lastDate)} (${d.daysInWindow} dagen).${avgLine}</div></div>`;
  }
```

- [ ] **Step 2: Verify**

Open `index.html` in a browser. With **a < 1 year** CSV and a **1 year** CSV the period-alert text must be exactly as today. With a **≥ 2 year** CSV, the alert shows the extra "Gemiddelde berekend over N volledige jaren (DD/MM/YYYY – DD/MM/YYYY)." sentence below the rolling-year line.

Grep check:
```bash
grep -n "Gemiddelde berekend over" /home/ubuntu/battery-roi-tool/index.html
```
Expected: 1 hit.

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Show multi-year window line in period alert

When numYears >= 2, the period alert gains a second sentence
naming the start of year N and the lastDate.

Spec: docs/superpowers/specs/2026-04-17-multi-year-averaging-design.md
EOF
)"
```

---

### Task 5: Avg companions in Overzicht meetpunt

**Files:**
- Modify: `index.html` — the summary-card block in `renderResults` (lines ~987-1037).

Add the `· gem. N j: …` companion to the eight numeric rows listed in the spec. Metadata rows untouched.

- [ ] **Step 1: Replace the summary card body**

Use Edit to replace this exact `old_string`:

```
  // ── Summary card ───────────────────────────────────────────────────────────
  const avgAfname   = d.totalAfname   / (d.daysInWindow || 1);
  const avgInjectie = d.totalInjectie / (d.daysInWindow || 1);
  const totalDaysCSV = d.allDays.length;
  const periodLabel = d.isFullYear ? 'Volledig rollend jaar' : `Gedeeltelijke periode (${d.daysInWindow} dagen)`;

  document.getElementById('summaryContent').innerHTML = `
    <div class="summary-grid">
      <div class="summary-item"><span class="s-label">EAN-code</span>
        <span class="s-value accent" style="font-size:0.92rem;word-break:break-all;">${d.eanCode || 'onbekend'}</span></div>
      <div class="summary-item"><span class="s-label">Meternummer</span>
        <span class="s-value">${d.meterNr || 'onbekend'}</span></div>
      <div class="summary-item"><span class="s-label">Metertype</span>
        <span class="s-value">${d.meterType || 'onbekend'}</span></div>
      <hr class="summary-divider" />
      <div class="summary-item"><span class="s-label">Volledige CSV periode</span>
        <span class="s-value" style="font-size:0.92rem;">${formatDate(d.firstDate)} – ${formatDate(d.lastDate)}</span></div>
      <div class="summary-item"><span class="s-label">Totaal dagen in CSV</span>
        <span class="s-value">${totalDaysCSV} dagen</span></div>
      <div class="summary-item"><span class="s-label">Berekeningsperiode</span>
        <span class="s-value" style="font-size:0.88rem;">${periodLabel}</span></div>
      <div class="summary-item"><span class="s-label">Van – tot (berekening)</span>
        <span class="s-value" style="font-size:0.92rem;">${formatDate(d.windowStart)} – ${formatDate(d.lastDate)}</span></div>
      <hr class="summary-divider" />
      <div class="summary-item"><span class="s-label">Totale afname (periode)</span>
        <span class="s-value orange">${fmt2(d.totalAfname)} kWh</span></div>
      ${d.dualTariff ? `
      <div class="summary-item"><span class="s-label">Afname dag</span>
        <span class="s-value orange">${fmt2(d.totalAfnamedag)} kWh <span style="font-size:0.8rem;font-weight:400;color:var(--muted)">(${fmt2(d.totalAfname>0?d.totalAfnamedag/d.totalAfname*100:0)}%)</span></span></div>
      <div class="summary-item"><span class="s-label">Afname nacht</span>
        <span class="s-value orange">${fmt2(d.totalAfnamenacht)} kWh <span style="font-size:0.8rem;font-weight:400;color:var(--muted)">(${fmt2(d.totalAfname>0?d.totalAfnamenacht/d.totalAfname*100:0)}%)</span></span></div>` : ''}
      <div class="summary-item"><span class="s-label">Totale injectie (periode)</span>
        <span class="s-value green">${fmt2(d.totalInjectie)} kWh</span></div>
      ${d.dualTariff ? `
      <div class="summary-item"><span class="s-label">Injectie dag</span>
        <span class="s-value green">${fmt2(d.totalInjectiedag)} kWh <span style="font-size:0.8rem;font-weight:400;color:var(--muted)">(${fmt2(d.totalInjectie>0?d.totalInjectiedag/d.totalInjectie*100:0)}%)</span></span></div>
      <div class="summary-item"><span class="s-label">Injectie nacht</span>
        <span class="s-value green">${fmt2(d.totalInjectienacht)} kWh <span style="font-size:0.8rem;font-weight:400;color:var(--muted)">(${fmt2(d.totalInjectie>0?d.totalInjectienacht/d.totalInjectie*100:0)}%)</span></span></div>` : ''}
      <div class="summary-item"><span class="s-label">Gem. afname per dag</span>
        <span class="s-value orange">${fmt2(avgAfname)} kWh/dag</span></div>
      <div class="summary-item"><span class="s-label">Gem. injectie per dag</span>
        <span class="s-value green">${fmt2(avgInjectie)} kWh/dag</span></div>
```

with this `new_string`:

```
  // ── Summary card ───────────────────────────────────────────────────────────
  const avgAfname   = d.totalAfname   / (d.daysInWindow || 1);
  const avgInjectie = d.totalInjectie / (d.daysInWindow || 1);
  const totalDaysCSV = d.allDays.length;
  const periodLabel = d.isFullYear ? 'Volledig rollend jaar' : `Gedeeltelijke periode (${d.daysInWindow} dagen)`;
  const a   = d.avgTotals; // shorthand; null when numYears < 2
  const fkw = n => fmt2(n) + ' kWh';
  const fkwd= n => fmt2(n) + ' kWh/dag';

  document.getElementById('summaryContent').innerHTML = `
    <div class="summary-grid">
      <div class="summary-item"><span class="s-label">EAN-code</span>
        <span class="s-value accent" style="font-size:0.92rem;word-break:break-all;">${d.eanCode || 'onbekend'}</span></div>
      <div class="summary-item"><span class="s-label">Meternummer</span>
        <span class="s-value">${d.meterNr || 'onbekend'}</span></div>
      <div class="summary-item"><span class="s-label">Metertype</span>
        <span class="s-value">${d.meterType || 'onbekend'}</span></div>
      <hr class="summary-divider" />
      <div class="summary-item"><span class="s-label">Volledige CSV periode</span>
        <span class="s-value" style="font-size:0.92rem;">${formatDate(d.firstDate)} – ${formatDate(d.lastDate)}</span></div>
      <div class="summary-item"><span class="s-label">Totaal dagen in CSV</span>
        <span class="s-value">${totalDaysCSV} dagen</span></div>
      <div class="summary-item"><span class="s-label">Berekeningsperiode</span>
        <span class="s-value" style="font-size:0.88rem;">${periodLabel}</span></div>
      <div class="summary-item"><span class="s-label">Van – tot (berekening)</span>
        <span class="s-value" style="font-size:0.92rem;">${formatDate(d.windowStart)} – ${formatDate(d.lastDate)}</span></div>
      <hr class="summary-divider" />
      <div class="summary-item"><span class="s-label">Totale afname (periode)</span>
        <span class="s-value orange">${renderWithAvg(d.totalAfname, a && a.totalAfname, fkw, d.numYears)}</span></div>
      ${d.dualTariff ? `
      <div class="summary-item"><span class="s-label">Afname dag</span>
        <span class="s-value orange">${renderWithAvg(d.totalAfnamedag, a && a.totalAfnamedag, fkw, d.numYears)} <span style="font-size:0.8rem;font-weight:400;color:var(--muted)">(${fmt2(d.totalAfname>0?d.totalAfnamedag/d.totalAfname*100:0)}%)</span></span></div>
      <div class="summary-item"><span class="s-label">Afname nacht</span>
        <span class="s-value orange">${renderWithAvg(d.totalAfnamenacht, a && a.totalAfnamenacht, fkw, d.numYears)} <span style="font-size:0.8rem;font-weight:400;color:var(--muted)">(${fmt2(d.totalAfname>0?d.totalAfnamenacht/d.totalAfname*100:0)}%)</span></span></div>` : ''}
      <div class="summary-item"><span class="s-label">Totale injectie (periode)</span>
        <span class="s-value green">${renderWithAvg(d.totalInjectie, a && a.totalInjectie, fkw, d.numYears)}</span></div>
      ${d.dualTariff ? `
      <div class="summary-item"><span class="s-label">Injectie dag</span>
        <span class="s-value green">${renderWithAvg(d.totalInjectiedag, a && a.totalInjectiedag, fkw, d.numYears)} <span style="font-size:0.8rem;font-weight:400;color:var(--muted)">(${fmt2(d.totalInjectie>0?d.totalInjectiedag/d.totalInjectie*100:0)}%)</span></span></div>
      <div class="summary-item"><span class="s-label">Injectie nacht</span>
        <span class="s-value green">${renderWithAvg(d.totalInjectienacht, a && a.totalInjectienacht, fkw, d.numYears)} <span style="font-size:0.8rem;font-weight:400;color:var(--muted)">(${fmt2(d.totalInjectie>0?d.totalInjectienacht/d.totalInjectie*100:0)}%)</span></span></div>` : ''}
      <div class="summary-item"><span class="s-label">Gem. afname per dag</span>
        <span class="s-value orange">${renderWithAvg(avgAfname, a && a.avgAfnamePerDay, fkwd, d.numYears)}</span></div>
      <div class="summary-item"><span class="s-label">Gem. injectie per dag</span>
        <span class="s-value green">${renderWithAvg(avgInjectie, a && a.avgInjectiePerDay, fkwd, d.numYears)}</span></div>
```

- [ ] **Step 2: Verify**

Open `index.html` in a browser.

- < 1 year and 1-year CSVs: summary card visually identical to today.
- ≥ 2 year CSV: each of the 8 numeric rows shows `… kWh · gem. N j: … kWh` (or `… kWh/dag · gem. N j: … kWh/dag` for the per-day rows). Metadata rows unchanged.

Grep check:
```bash
grep -n "renderWithAvg(d.totalAfname" /home/ubuntu/battery-roi-tool/index.html
```
Expected: 1 hit (in the summary card).

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Show multi-year averages in Overzicht meetpunt

The 8 numeric rows (totals + per-day averages) now render as
"<value> · gem. N j: <avg>" when numYears >= 2. Metadata rows
unchanged.

Spec: docs/superpowers/specs/2026-04-17-multi-year-averaging-design.md
EOF
)"
```

---

### Task 6: Avg companions in scenario card numeric rows + payback/saving prominence

**Files:**
- Modify: `index.html` — the body of `makeScenCard` inside `renderResults` (lines ~1043-1103).

`makeScenCard` is currently called with `(title, badge, badgeClass, cssClass, scen, installPrice, extraInfo, mainColorOverride)`. We need access to the matching `scenAvg` (one of `scenWCAvg` / `scenOptAvg`) and to `numYears`. We extend the call sites and the function signature.

- [ ] **Step 1: Extend `makeScenCard` signature and update its body**

Use Edit to replace this exact `old_string`:

```
  function makeScenCard(title, badge, badgeClass, cssClass, scen, installPrice, extraInfo, mainColorOverride) {
    const paybackText = !isFinite(scen.payback) || scen.payback <= 0 ? '—'
      : scen.payback > 100 ? '> 100 jaar' : `${fmt2(scen.payback)} jaar`;
    const mainColor = mainColorOverride || (cssClass === 'optimal' ? 'green' : 'blue');
    const pctFull    = Math.min(scen.recoveryPctFull,    100);
    const pctPartial = Math.min(scen.recoveryPctPartial, 100 - pctFull);
    const injFull    = Math.min(scen.injPctFull,    100);
    const injPartial = Math.min(scen.injPctPartial, 100 - injFull);
    const priceLine  = d.dualTariff ? `<div style="font-size:0.8rem;color:var(--primary);margin-top:4px;">💱 Effectieve prijs: <strong>${fmtEur(d.effectivePrice)}/kWh</strong></div>` : '';
    const barColor     = `var(--${mainColor === 'green' ? 'success' : mainColor === 'orange' ? 'warning' : 'primary'})`;
    // Partial color: clearly distinct from full color per scenario type
    // orange (worst-case) → red  |  blue (optimistic) → amber  |  green (optimal) → teal
    const partialColor = mainColor === 'orange' ? 'var(--danger)'
                       : mainColor === 'green'  ? '#00897b'
                       : 'rgba(246,166,35,0.85)';
    return `<div class="scenario-card ${cssClass}">
      <span class="badge ${badgeClass}">${badge}</span>
      <h3>${title}</h3>
      <div class="scenario-sub">${extraInfo}${priceLine}</div>
      <div class="stat-row"><span class="stat-label">Min. dagelijkse injectie nodig</span><span class="stat-value">${fmt2(scen.threshold)} kWh</span></div>
      <div class="stat-row"><span class="stat-label">Dagen drempel volledig bereikt</span><span class="stat-value">${scen.qualifyingDays} d</span></div>
      <div class="stat-row"><span class="stat-label">Dagen gedeeltelijk geladen</span><span class="stat-value" style="color:var(--warning)">${scen.partialDays} d</span></div>
      <div class="stat-row"><span class="stat-label">Opgeslagen volle cycli (periode)</span><span class="stat-value">${fmt2(scen.chargedFull)} kWh</span></div>
      <div class="stat-row"><span class="stat-label">Opgeslagen gedeeltelijk (periode)</span><span class="stat-value" style="color:var(--warning)">${fmt2(scen.chargedPartial)} kWh</span></div>
      <div class="stat-row"><span class="stat-label">Jaarl. besparing volle cycli</span><span class="stat-value green">${fmtEur(scen.annualSavingFull)} / jaar</span></div>
      <div class="stat-row"><span class="stat-label">Jaarl. besparing gedeeltelijk</span><span class="stat-value" style="color:var(--warning)">${fmtEur(scen.annualSavingPartial)} / jaar</span></div>
      <div class="stat-row"><span class="stat-label">Totale jaarlijkse besparing</span><span class="stat-value green big">${fmtEur(scen.annualSaving)} / jaar</span></div>
      <div class="stat-row"><span class="stat-label">Installatieprijs</span><span class="stat-value">${fmtEur(installPrice)}</span></div>
      <div class="stat-row"><span class="stat-label">Terugverdientijd</span><span class="stat-value big" style="color:var(--warning)">${paybackText}</span></div>
```

with this `new_string`:

```
  function makeScenCard(title, badge, badgeClass, cssClass, scen, installPrice, extraInfo, mainColorOverride, scenAvg) {
    const paybackText = !isFinite(scen.payback) || scen.payback <= 0 ? '—'
      : scen.payback > 100 ? '> 100 jaar' : `${fmt2(scen.payback)} jaar`;
    const mainColor = mainColorOverride || (cssClass === 'optimal' ? 'green' : 'blue');
    const pctFull    = Math.min(scen.recoveryPctFull,    100);
    const pctPartial = Math.min(scen.recoveryPctPartial, 100 - pctFull);
    const injFull    = Math.min(scen.injPctFull,    100);
    const injPartial = Math.min(scen.injPctPartial, 100 - injFull);
    const priceLine  = d.dualTariff ? `<div style="font-size:0.8rem;color:var(--primary);margin-top:4px;">💱 Effectieve prijs: <strong>${fmtEur(d.effectivePrice)}/kWh</strong></div>` : '';
    const barColor     = `var(--${mainColor === 'green' ? 'success' : mainColor === 'orange' ? 'warning' : 'primary'})`;
    // Partial color: clearly distinct from full color per scenario type
    // orange (worst-case) → red  |  blue (optimistic) → amber  |  green (optimal) → teal
    const partialColor = mainColor === 'orange' ? 'var(--danger)'
                       : mainColor === 'green'  ? '#00897b'
                       : 'rgba(246,166,35,0.85)';
    const N = d.numYears;
    const showAvg = N >= 2 && scenAvg;
    const fkw  = n => fmt2(n) + ' kWh';
    const fday = n => Math.round(n) + ' d';
    const feur = n => fmtEur(n) + ' / jaar';
    function avgPaybackText(p) {
      if (!isFinite(p) || p <= 0) return '—';
      return p > 100 ? '> 100 jaar' : `${fmt2(p)} jaar`;
    }
    const avgPaybackLine = showAvg
      ? `<div class="muted-inline" style="display:block;margin-left:0;margin-top:2px;">gem. ${N} j: ${avgPaybackText(scenAvg.payback)}</div>`
      : '';
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

- [ ] **Step 2: Pass `scenAvg` through at each `makeScenCard` call site**

Use Edit to replace this exact `old_string`:

```
    gridHTML += makeScenCard(
      pvGtBat ? 'Worst Case' : 'Standaard',
      pvGtBat ? '⚠️ Worst Case' : '✅ Standaard',
      pvGtBat ? 'badge-orange' : 'badge-blue',
      pvGtBat ? 'worst-case' : 'active',
      scenWC, cfg.price, subWC, pvGtBat ? 'orange' : 'blue'
    );
    if (pvGtBat && scenOpt) {
      gridHTML += makeScenCard(
        'Optimistisch', '✨ Optimistisch', 'badge-blue', 'optimistic',
        scenOpt, cfg.price,
        `Zelfde installatie — aanname: batterij laadt volledig (drempel = ${fmt2(cfg.batCap)} kWh)`,
        'blue'
      );
    }
```

with this `new_string`:

```
    gridHTML += makeScenCard(
      pvGtBat ? 'Worst Case' : 'Standaard',
      pvGtBat ? '⚠️ Worst Case' : '✅ Standaard',
      pvGtBat ? 'badge-orange' : 'badge-blue',
      pvGtBat ? 'worst-case' : 'active',
      scenWC, cfg.price, subWC, pvGtBat ? 'orange' : 'blue',
      cr.scenWCAvg
    );
    if (pvGtBat && scenOpt) {
      gridHTML += makeScenCard(
        'Optimistisch', '✨ Optimistisch', 'badge-blue', 'optimistic',
        scenOpt, cfg.price,
        `Zelfde installatie — aanname: batterij laadt volledig (drempel = ${fmt2(cfg.batCap)} kWh)`,
        'blue',
        cr.scenOptAvg
      );
    }
```

- [ ] **Step 3: Verify**

Open `index.html` in a browser.

- < 2 year CSV → scenario cards visually identical to today.
- ≥ 2 year CSV → numeric rows show `… · gem. N j: …`; the *Totale jaarlijkse besparing* row shows the avg as a second line below; the *Terugverdientijd* row shows the avg as a second line below.

Grep check:
```bash
grep -n "scenWCAvg\|scenOptAvg" /home/ubuntu/battery-roi-tool/index.html
```
Expected: at least 5 hits (1 in `processData`, 2 in the call sites, others wherever they're consumed).

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Show multi-year averages in scenario card stat rows

Numeric rows get the "· gem. N j: …" companion. Totale
jaarlijkse besparing and Terugverdientijd render the avg as a
second line below the headline value.

Spec: docs/superpowers/specs/2026-04-17-multi-year-averaging-design.md
EOF
)"
```

---

### Task 7: ▼ marker on scenario-card progress bars

**Files:**
- Modify: `index.html` — the two progress-bar blocks inside `makeScenCard` (the parts that render `Recuperatie t.o.v. afname` and `Recuperatie t.o.v. injectie`).

Add a `▼` marker positioned at the avg recovery position; add an extra legend item with the numeric avg.

- [ ] **Step 1: Replace both progress-bar blocks**

Use Edit to replace this exact `old_string`:

```
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;">
        <div>
          <div style="font-size:0.8rem;color:var(--muted);margin-bottom:5px;">Recuperatie t.o.v. <strong>afname</strong></div>
          <div class="bar-container">
            <div class="bar-bg" style="flex:1;height:14px;position:relative;background:var(--border);border-radius:5px;overflow:hidden;">
              <div style="width:${pctFull+pctPartial}%;position:absolute;top:0;height:100%;background:${barColor};border-radius:5px;"></div>
              <div style="width:${pctPartial}%;position:absolute;top:0;height:100%;left:${pctFull}%;background:${partialColor};border-radius:0 5px 5px 0;"></div>
            </div>
            <span style="font-size:0.82rem;font-weight:600;min-width:56px;text-align:right">${fmt2(pctFull+pctPartial)}%</span>
          </div>
          <div class="bar-legend">
            <span><span class="dot" style="background:${barColor}"></span>Volledig: ${fmt2(pctFull)}%</span>
            <span><span class="dot" style="background:${partialColor}"></span>Partieel: ${fmt2(pctPartial)}%</span>
          </div>
        </div>
        <div>
          <div style="font-size:0.8rem;color:var(--muted);margin-bottom:5px;">Recuperatie t.o.v. <strong>injectie</strong></div>
          <div class="bar-container">
            <div class="bar-bg" style="flex:1;height:14px;position:relative;background:var(--border);border-radius:5px;overflow:hidden;">
              <div style="width:${injFull+injPartial}%;position:absolute;top:0;height:100%;background:${barColor};border-radius:5px;"></div>
              <div style="width:${injPartial}%;position:absolute;top:0;height:100%;left:${injFull}%;background:${partialColor};border-radius:0 5px 5px 0;"></div>
            </div>
            <span style="font-size:0.82rem;font-weight:600;min-width:56px;text-align:right">${fmt2(injFull+injPartial)}%</span>
          </div>
          <div class="bar-legend">
            <span><span class="dot" style="background:${barColor}"></span>Volledig: ${fmt2(injFull)}%</span>
            <span><span class="dot" style="background:${partialColor}"></span>Partieel: ${fmt2(injPartial)}%</span>
          </div>
        </div>
      </div>
```

with this `new_string`:

```
      ${(() => {
        const avgRecPct = showAvg ? Math.min(100, scenAvg.recoveryPctFull + scenAvg.recoveryPctPartial) : null;
        const avgInjPct = showAvg ? Math.min(100, scenAvg.injPctFull      + scenAvg.injPctPartial)      : null;
        const recMarker = avgRecPct == null ? '' : `<div class="bar-marker" style="left:${avgRecPct}%" title="gem. ${N} j: ${fmt2(avgRecPct)}%"></div>`;
        const injMarker = avgInjPct == null ? '' : `<div class="bar-marker" style="left:${avgInjPct}%" title="gem. ${N} j: ${fmt2(avgInjPct)}%"></div>`;
        const recAvgLegend = avgRecPct == null ? '' : `<span class="muted-inline" style="margin-left:0;">▼ gem. ${N} j: ${fmt2(avgRecPct)}%</span>`;
        const injAvgLegend = avgInjPct == null ? '' : `<span class="muted-inline" style="margin-left:0;">▼ gem. ${N} j: ${fmt2(avgInjPct)}%</span>`;
        return `
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;">
        <div>
          <div style="font-size:0.8rem;color:var(--muted);margin-bottom:5px;">Recuperatie t.o.v. <strong>afname</strong></div>
          <div class="bar-container">
            <div class="bar-with-marker">
              <div class="bar-bg" style="height:14px;position:relative;background:var(--border);border-radius:5px;overflow:hidden;">
                <div style="width:${pctFull+pctPartial}%;position:absolute;top:0;height:100%;background:${barColor};border-radius:5px;"></div>
                <div style="width:${pctPartial}%;position:absolute;top:0;height:100%;left:${pctFull}%;background:${partialColor};border-radius:0 5px 5px 0;"></div>
              </div>
              ${recMarker}
            </div>
            <span style="font-size:0.82rem;font-weight:600;min-width:56px;text-align:right">${fmt2(pctFull+pctPartial)}%</span>
          </div>
          <div class="bar-legend">
            <span><span class="dot" style="background:${barColor}"></span>Volledig: ${fmt2(pctFull)}%</span>
            <span><span class="dot" style="background:${partialColor}"></span>Partieel: ${fmt2(pctPartial)}%</span>
            ${recAvgLegend}
          </div>
        </div>
        <div>
          <div style="font-size:0.8rem;color:var(--muted);margin-bottom:5px;">Recuperatie t.o.v. <strong>injectie</strong></div>
          <div class="bar-container">
            <div class="bar-with-marker">
              <div class="bar-bg" style="height:14px;position:relative;background:var(--border);border-radius:5px;overflow:hidden;">
                <div style="width:${injFull+injPartial}%;position:absolute;top:0;height:100%;background:${barColor};border-radius:5px;"></div>
                <div style="width:${injPartial}%;position:absolute;top:0;height:100%;left:${injFull}%;background:${partialColor};border-radius:0 5px 5px 0;"></div>
              </div>
              ${injMarker}
            </div>
            <span style="font-size:0.82rem;font-weight:600;min-width:56px;text-align:right">${fmt2(injFull+injPartial)}%</span>
          </div>
          <div class="bar-legend">
            <span><span class="dot" style="background:${barColor}"></span>Volledig: ${fmt2(injFull)}%</span>
            <span><span class="dot" style="background:${partialColor}"></span>Partieel: ${fmt2(injPartial)}%</span>
            ${injAvgLegend}
          </div>
        </div>
      </div>`;
      })()}
```

Note: the `${(() => { … return \`…\`; })()}` IIFE pattern is used because the surrounding template literal does not allow `let`/`const` directly. Keep the inline IIFE.

- [ ] **Step 2: Verify**

Open `index.html` in a browser.

- < 2 year CSV → progress bars visually identical to today (no marker, no extra legend item).
- ≥ 2 year CSV → each recovery bar shows a small `▼` triangle above it at the avg position; the legend below the bar gains a "▼ gem. N j: …%" item; hovering the marker shows a tooltip with the same value.

Grep check:
```bash
grep -n "bar-with-marker\|bar-marker" /home/ubuntu/battery-roi-tool/index.html
```
Expected: at least 5 hits (CSS, the four marker elements added in Step 1, possibly more if the helper appears).

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Add multi-year avg marker to scenario card progress bars

Adds a ▼ triangle above each recovery bar at the avg position
(when numYears >= 2), plus a "▼ gem. N j: X%" legend item.
Bar markup now wraps the bar-bg in a .bar-with-marker container
so the marker is positioned outside overflow:hidden.

Spec: docs/superpowers/specs/2026-04-17-multi-year-averaging-design.md
EOF
)"
```

---

### Task 8: Capacity analysis as 3 columns when N >= 2

**Files:**
- Modify: `index.html` — `renderCapAnalysis` (around lines 1182-1224). Also: change the call site to pass the new `numYears` arg.

- [ ] **Step 1: Update the call site**

Use Edit to replace this exact `old_string`:

```
  // ── Capacity analysis card ─────────────────────────────────────────────────
  renderCapAnalysis(d.capAnalysis, d.isFullYear, d.daysInWindow);
```

with this `new_string`:

```
  // ── Capacity analysis card ─────────────────────────────────────────────────
  renderCapAnalysis(d.capAnalysis, d.isFullYear, d.daysInWindow, d.numYears);
```

- [ ] **Step 2: Update `renderCapAnalysis` to render the avg column**

Use Edit to replace this exact `old_string`:

```
function renderCapAnalysis(capAnalysis, isFullYear, daysInWindow) {
  const card    = document.getElementById('capAnalysisCard');
  const content = document.getElementById('capAnalysisContent');
  card.style.display = '';
  const { rows, maxCap } = capAnalysis;

  if (!rows.length || (maxCap === null && rows[0] && rows[0].qualDays < 100)) {
    content.innerHTML = `<div class="alert alert-warning">⚠️ <div>Zelfs de kleinste capaciteit (2,5 kWh) heeft geen 100 dagen met volledige lading. Controleer uw data.</div></div>`;
    return;
  }

  let html = '';
  if (!isFullYear) {
    html += `<div class="alert alert-info" style="margin-bottom:12px;">ℹ️ <div>Gebaseerd op ${daysInWindow} beschikbare dagen (geen volledig jaar).</div></div>`;
  }
  html += `<div class="alert alert-info" style="margin-bottom:12px;">
    ℹ️ <div>Analyse bij <strong>gelijke omvormers</strong> (drempel = capaciteit, geen laadbeperking). Gebruik dit als referentie voor de maximaal zinvolle capaciteit.
    <br><strong style="color:var(--success)">Groen</strong> = ≥ 100 volle laaddagen &nbsp;|&nbsp; <span style="color:var(--warning);font-weight:600">Oranje</span> = &lt; 100 dagen &nbsp;|&nbsp; <span style="background:var(--success);color:#fff;border-radius:4px;padding:1px 6px;font-size:0.78rem;font-weight:700;">MAX</span> = grootste capaciteit met ≥ 100 dagen</div>
  </div>`;

  html += `<div class="cap-table-wrap"><table class="cap-table">
    <thead><tr><th>Capaciteit (kWh)</th><th style="text-align:center">Volle laaddagen (≥ drempel)</th></tr></thead><tbody>`;

  for (const r of rows) {
    const isMax    = r.cap === maxCap;
    const isOk     = r.qualDays >= 100;
    const rowClass = isMax ? 'cap-max' : (isOk ? 'cap-ok' : 'cap-fail');
    const badge    = isMax ? '<span class="badge-max">MAX</span>' : '';
    html += `<tr class="${rowClass}">
      <td>${fmt2(r.cap)} kWh${badge}</td>
      <td style="text-align:center;font-weight:${isMax?'700':'400'}">${r.qualDays}</td>
    </tr>`;
  }
  html += `</tbody></table></div>`;
```

with this `new_string`:

```
function renderCapAnalysis(capAnalysis, isFullYear, daysInWindow, numYears) {
  const card    = document.getElementById('capAnalysisCard');
  const content = document.getElementById('capAnalysisContent');
  card.style.display = '';
  const { rows, maxCap } = capAnalysis;
  const showAvg = numYears >= 2;

  if (!rows.length || (maxCap === null && rows[0] && rows[0].qualDays < 100)) {
    content.innerHTML = `<div class="alert alert-warning">⚠️ <div>Zelfs de kleinste capaciteit (2,5 kWh) heeft geen 100 dagen met volledige lading. Controleer uw data.</div></div>`;
    return;
  }

  let html = '';
  if (!isFullYear) {
    html += `<div class="alert alert-info" style="margin-bottom:12px;">ℹ️ <div>Gebaseerd op ${daysInWindow} beschikbare dagen (geen volledig jaar).</div></div>`;
  }
  html += `<div class="alert alert-info" style="margin-bottom:12px;">
    ℹ️ <div>Analyse bij <strong>gelijke omvormers</strong> (drempel = capaciteit, geen laadbeperking). Gebruik dit als referentie voor de maximaal zinvolle capaciteit.
    <br><strong style="color:var(--success)">Groen</strong> = ≥ 100 volle laaddagen &nbsp;|&nbsp; <span style="color:var(--warning);font-weight:600">Oranje</span> = &lt; 100 dagen &nbsp;|&nbsp; <span style="background:var(--success);color:#fff;border-radius:4px;padding:1px 6px;font-size:0.78rem;font-weight:700;">MAX</span> = grootste capaciteit met ≥ 100 dagen${showAvg ? ' (gebaseerd op afgelopen jaar)' : ''}</div>
  </div>`;

  html += `<div class="cap-table-wrap"><table class="cap-table">
    <thead><tr><th>Capaciteit (kWh)</th><th style="text-align:center">Volle laaddagen (afgelopen jaar)</th>${showAvg ? `<th style="text-align:center">Gem. ${numYears} j</th>` : ''}</tr></thead><tbody>`;

  for (const r of rows) {
    const isMax    = r.cap === maxCap;
    const isOk     = r.qualDays >= 100;
    const rowClass = isMax ? 'cap-max' : (isOk ? 'cap-ok' : 'cap-fail');
    const badge    = isMax ? '<span class="badge-max">MAX</span>' : '';
    const avgCell  = showAvg ? `<td style="text-align:center;color:var(--muted);font-weight:${isMax?'700':'400'}">${r.avgQualDays != null ? fmt2(r.avgQualDays) : '—'}</td>` : '';
    html += `<tr class="${rowClass}">
      <td>${fmt2(r.cap)} kWh${badge}</td>
      <td style="text-align:center;font-weight:${isMax?'700':'400'}">${r.qualDays}</td>
      ${avgCell}
    </tr>`;
  }
  html += `</tbody></table></div>`;
```

- [ ] **Step 3: Verify**

Open `index.html` in a browser.

- < 2 year CSV → capacity table is unchanged (2 columns).
- ≥ 2 year CSV → table has 3 columns: *Capaciteit (kWh)* | *Volle laaddagen (afgelopen jaar)* | *Gem. N j*. The MAX flag still appears on the row whose `qualDays` (afgelopen jaar) ≥ 100 — even if `avgQualDays` is < 100 or higher.

Grep check:
```bash
grep -n "renderCapAnalysis(d.capAnalysis, d.isFullYear, d.daysInWindow, d.numYears)\|Volle laaddagen (afgelopen jaar)\|Gem. \${numYears} j" /home/ubuntu/battery-roi-tool/index.html
```
Expected: 3 hits.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Capacity analysis: add Gem. N j column when numYears >= 2

Third column shows the multi-year average qualifying days per
capacity step. The MAX flag remains driven by the afgelopen-jaar
column, so the recommended capacity does not change because of
the average.

Spec: docs/superpowers/specs/2026-04-17-multi-year-averaging-design.md
EOF
)"
```

---

### Task 9: ▼ marker on monthly injection bars

**Files:**
- Modify: `index.html` — the monthly-table block in `renderResults` (around lines 1141-1177).

Per month: bar still shows last-year injection; a `▼` marker indicates the per-month avg across N year-blocks. Bar scale rescales to `max(monthInj, monthAvgInj)` across all months so the marker stays inside the visible range.

- [ ] **Step 1: Replace the monthly table block**

Use Edit to replace this exact `old_string`:

```
  // ── Monthly table ──────────────────────────────────────────────────────────
  const months = Object.keys(d.monthMap).sort();
  const maxInj = Math.max(...months.map(m => d.monthMap[m].injectie), 1);
  let tableHTML = `<table class="data-table"><thead><tr>
    <th>Maand</th>
    <th>Afname (kWh)</th>
    ${d.dualTariff ? '<th>Afname dag</th><th>Afname nacht</th>' : ''}
    <th>Injectie (kWh)</th>
    ${d.dualTariff ? '<th>Injectie dag</th><th>Injectie nacht</th>' : ''}
    <th>Injectie visueel</th>
  </tr></thead><tbody>`;

  let totAfn=0, totInj2=0, totAfndag=0, totAfnnacht=0, totInjdag=0, totInjnacht=0;
  for (const mk of months) {
    const m = d.monthMap[mk];
    const pct = (m.injectie / maxInj * 100).toFixed(1);
    const [y, mo] = mk.split('-');
    const label = new Date(+y, +mo-1, 1).toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' });
    totAfn+=m.afname; totInj2+=m.injectie;
    totAfndag+=(m.afnamedag||0); totAfnnacht+=(m.afnamenacht||0);
    totInjdag+=(m.injectiedag||0); totInjnacht+=(m.injectienacht||0);
    tableHTML += `<tr>
      <td>${label}</td><td>${fmt2(m.afname)}</td>
      ${d.dualTariff ? `<td>${fmt2(m.afnamedag||0)}</td><td>${fmt2(m.afnamenacht||0)}</td>` : ''}
      <td>${fmt2(m.injectie)}</td>
      ${d.dualTariff ? `<td>${fmt2(m.injectiedag||0)}</td><td>${fmt2(m.injectienacht||0)}</td>` : ''}
      <td><div class="bar-container"><div class="bar-bg" style="min-width:80px"><div class="bar-fill green" style="width:${pct}%"></div></div><span style="font-size:0.8rem">${fmt2(m.injectie)}</span></div></td>
    </tr>`;
  }
```

with this `new_string`:

```
  // ── Monthly table ──────────────────────────────────────────────────────────
  const months = Object.keys(d.monthMap).sort();
  const showMonthAvg = d.numYears >= 2;
  // Bar scale: include avg values so the marker stays within the visible range.
  const maxInj = Math.max(
    ...months.map(m => d.monthMap[m].injectie),
    ...(showMonthAvg ? months.map(m => d.monthMap[m].avgInjectie || 0) : []),
    1
  );
  let tableHTML = `<table class="data-table"><thead><tr>
    <th>Maand</th>
    <th>Afname (kWh)</th>
    ${d.dualTariff ? '<th>Afname dag</th><th>Afname nacht</th>' : ''}
    <th>Injectie (kWh)</th>
    ${d.dualTariff ? '<th>Injectie dag</th><th>Injectie nacht</th>' : ''}
    <th>Injectie visueel${showMonthAvg ? ` <span class="muted-inline" style="margin-left:0;">(▼ = gem. ${d.numYears} j)</span>` : ''}</th>
  </tr></thead><tbody>`;

  let totAfn=0, totInj2=0, totAfndag=0, totAfnnacht=0, totInjdag=0, totInjnacht=0;
  for (const mk of months) {
    const m = d.monthMap[mk];
    const pct = (m.injectie / maxInj * 100).toFixed(1);
    const avgPct = showMonthAvg && m.avgInjectie != null
      ? Math.min(100, m.avgInjectie / maxInj * 100).toFixed(1)
      : null;
    const markerHTML = avgPct == null ? '' : `<div class="bar-marker" style="left:${avgPct}%" title="gem. ${d.numYears} j: ${fmt2(m.avgInjectie)} kWh"></div>`;
    const [y, mo] = mk.split('-');
    const label = new Date(+y, +mo-1, 1).toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' });
    totAfn+=m.afname; totInj2+=m.injectie;
    totAfndag+=(m.afnamedag||0); totAfnnacht+=(m.afnamenacht||0);
    totInjdag+=(m.injectiedag||0); totInjnacht+=(m.injectienacht||0);
    tableHTML += `<tr>
      <td>${label}</td><td>${fmt2(m.afname)}</td>
      ${d.dualTariff ? `<td>${fmt2(m.afnamedag||0)}</td><td>${fmt2(m.afnamenacht||0)}</td>` : ''}
      <td>${fmt2(m.injectie)}</td>
      ${d.dualTariff ? `<td>${fmt2(m.injectiedag||0)}</td><td>${fmt2(m.injectienacht||0)}</td>` : ''}
      <td>
        <div class="bar-container">
          <div class="bar-with-marker" style="min-width:80px;">
            <div class="bar-bg" style="overflow:hidden;">
              <div class="bar-fill green" style="width:${pct}%"></div>
            </div>
            ${markerHTML}
          </div>
          <span style="font-size:0.8rem">${fmt2(m.injectie)}</span>
        </div>
      </td>
    </tr>`;
  }
```

- [ ] **Step 2: Verify**

Open `index.html` in a browser.

- < 2 year CSV → monthly table visually identical to today.
- ≥ 2 year CSV → each row's *Injectie visueel* bar shows a `▼` triangle above it at the per-month avg position; the column header gets a "(▼ = gem. N j)" annotation. The numeric columns (*Injectie (kWh)*, etc.) remain unchanged. Hovering a marker shows the avg value in kWh as a tooltip.

Grep check:
```bash
grep -n "showMonthAvg\|avgInjectie\b" /home/ubuntu/battery-roi-tool/index.html
```
Expected: at least 5 hits (definition in `processData`, render-side reads, `monthMap` initialization).

- [ ] **Step 3: Final full smoke test**

Open `index.html` in a browser. Walk the full flow with a `≥ 2 year` CSV:
1. Upload CSV, fill in pvInverter and elecPrice, *Configuraties laden*, pick 2 configs, *Bereken ROI*.
2. Verify period alert shows the multi-year sentence.
3. Verify Overzicht meetpunt rows show `… · gem. N j: …`.
4. Verify scenario cards: numeric rows have avg companions; *Totale jaarlijkse besparing* and *Terugverdientijd* show the avg as a second line; both progress bars show the `▼` marker and the legend's avg item.
5. Verify capacity table has 3 columns; MAX flag is on the row driven by Year 1.
6. Verify monthly table shows `▼` markers per row and the column header annotation.
7. *Kopieer deellink* — paste in a new tab — page reloads and renders identically.
8. *Download JSON* — re-load the JSON via *Laden vanuit JSON* — page renders identically.
9. (Backwards compat) Load a saved v2 JSON if available — page renders without console errors and without avg UI.

If you cannot do these manual steps, report `DONE_WITH_CONCERNS` listing exactly which checks are pending, so the controller can arrange for the user to do them.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Add per-month avg marker to monthly injection bars

Each Injectie visueel bar gets a ▼ marker at the per-month avg
across N year-blocks. Bar scale rescales to fit the larger of
current value and avg, computed once across all months.

Spec: docs/superpowers/specs/2026-04-17-multi-year-averaging-design.md
EOF
)"
```

---

## Self-review (controller, before handing off)

A pass against the spec sections and the No-Placeholders rule:

**Spec coverage:**
- Spec §"Per-year stats" → Task 1 (helpers + fields).
- Spec §"UI changes 1. Period alert" → Task 4.
- Spec §"UI changes 2. Overzicht meetpunt" → Task 5.
- Spec §"UI changes 3. Scenario-kaarten" → Task 6.
- Spec §"UI changes 4. Progress bars in scenario cards" → Task 7.
- Spec §"UI changes 5. Capaciteitsanalyse" → Task 8.
- Spec §"UI changes 6. Maandoverzicht" → Task 9.
- Spec §"Save/share state" → Task 2 (v3 bump + v2 BC).
- Spec §"Code organization" → helpers in Task 1, `renderWithAvg` + CSS in Task 3.
- Spec §"Edge cases":
  - N=1 no-op → all render tasks gate on `numYears >= 2` / `showAvg`.
  - avg=current → marker still rendered (Tasks 7, 9 unconditionally render the marker when avg is non-null).
  - avg=0 → `left: 0%` (no special case needed).
  - Year with afname=0 → handled in `computePerYearStats` effectivePrice fallback (Task 1).
  - Cap row Year-1 < 100 but avg ≥ 100 → MAX flag stays on Year-1 (Task 8 reads `r.qualDays`, not `r.avgQualDays`, for the flag).
  - Month with avg > current rescales globally → Task 9 includes avg in `maxInj` calculation.
- Spec §"Verification" → manual smoke tests appear in tasks 4-9 verification steps.

**Type/name consistency check:**
- `numYears`, `yearsStart`, `avgTotals` → introduced in Task 1, consumed in Tasks 4, 5, 6, 8, 9.
- `scenWCAvg` / `scenOptAvg` → introduced in Task 1, consumed in Task 6 call sites and Task 7 IIFE (`scenAvg` parameter alias).
- `avgInjectie` → introduced in Task 1 (initial null + computed), consumed in Task 9.
- `avgQualDays` → introduced in Task 1, consumed in Task 8.
- `renderWithAvg` → introduced in Task 3, consumed in Task 5, 6.
- `.bar-marker` / `.bar-with-marker` / `.muted-inline` → introduced in Task 3, consumed in Tasks 6, 7, 8, 9.
- `showAvg` is a local boolean inside `makeScenCard` (Task 6) — local scope, no cross-task contract.

**Placeholder scan:** All steps have actual code or actual commands. No "TBD", "implement later", "handle edge cases", or "similar to Task N".

No issues to fix.
