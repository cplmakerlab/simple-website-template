# Energy Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chart.js bar chart above `#summaryCard` with three zoom levels (Jaar / Maand / Dag) showing afname (above 0-axis) and injectie (below 0-axis), plus bump save format to v:5 so Dag-view works from share-links.

**Architecture:** Single-file change to `index.html`. Chart.js 4.4.7 loaded from CDN. New pure helpers (`_buildYearBuckets`, `_buildMonthBuckets`, `_buildDayBuckets`, `_availableMonthKeys`) transform existing `allDays` data into per-view buckets. `renderEnergyChart(d)` is the single render entry point called at the end of `renderResults`. Save-version bump from v:4 → v:5 with a compact 4-arrays-of-numbers serialisation of per-day values; `_restoreState` expands back to `allDays`; v:1-4 saves gracefully degrade (Dag-view disabled).

**Tech Stack:** Plain HTML / CSS / vanilla JS in `index.html`. Chart.js 4.4.7 via `cdn.jsdelivr.net`. No build step, no tests.

**Spec:** `docs/superpowers/specs/2026-04-18-energy-chart-design.md` — read before starting.

---

## File map

- **Modify:** `/home/ubuntu/battery-roi-tool/index.html` — the entire app is in this single file.
- **Modify:** `/home/ubuntu/battery-roi-tool/CLAUDE.md` — update the "Save / share state" paragraph to mention v:5 and `dailyCompact`.

## Working directory

`/home/ubuntu/battery-roi-tool`. Work directly on `gh-pages` (same as the `producten.html` rewrite). One commit per task; the user pushes when ready.

## Anchors (use these for locating insertion points)

The implementer should `grep` these markers rather than using line numbers, since lines shift as the file grows.

- `</style>` — end of CSS block (currently line 461). New CSS rules are inserted just before this.
- `</head>` — currently line 462. Chart.js `<script>` goes just before this.
- `<div class="card" id="summaryCard"` — the summary card (line 560). New `#energyChartCard` is inserted on the line immediately before this.
- `<div class="chart-wrap" id="monthlyTable"></div>` (line 574). The existing `#monthlyCard` wrapper (`<div class="card" id="monthlyCard" ...>`) gets its contents wrapped in `<details>`.
- `function calculate() {` — line 856. The `windowDays` local becomes part of the `renderResults({...})` payload (line ~1197).
- `function renderResults(d) {` — line 1209. A `renderEnergyChart(d)` call is added at the end (just before the final `}`).
- `function _serializeState() {` — line 647. Add `dailyCompact` to the returned `r` and bump `v` to 5.
- `function _restoreState(r) {` — line 689. Expand `dailyCompact` back to `allDays`.
- `function _applyLoadedState(state, showBanner) {` — line 749. Accept v:5 in the version list.

## Notes for the implementer

- UI text is in Dutch (`nl-BE`).
- The project has **no tests**. Verification = `grep` for structure + manual browser smoke (user responsibility).
- Keep `renderResults` pure with respect to its input `d` — the restore-from-share path and the fresh-calculate path must both end in the same UI.
- Don't `amend` any previously-committed work. Each task is a NEW commit.
- When adding event listeners, attach them ONCE at load time (wrap in `if` guard or just assume the DOM is parsed top-to-bottom — the `<script>` block at the bottom of `index.html` already runs after all HTML is parsed).

---

### Task 1: Add Chart.js CDN + CSS

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — add `<script>` tag in `<head>`, add CSS rules in `<style>` block.

After this task: the page still behaves identically (no HTML changes yet), but `Chart` is globally available once the page loads. Running `typeof Chart` in the browser console returns `'function'`.

- [ ] **Step 1: Add the Chart.js CDN script tag**

Use Edit. Locate the exact string `</head>` (it's alone on its own line near the top) and replace with:

```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7"></script>
</head>
```

- [ ] **Step 2: Add the chart CSS rules**

Use Edit. Locate the exact string `  </style>` (two spaces + `</style>`, alone on its own line) and replace with:

```css
    .chart-level-toggle {
      display: flex;
      gap: 0;
      margin-bottom: 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      width: fit-content;
    }
    .chart-level-toggle button {
      padding: 6px 14px;
      border: 0;
      background: var(--card);
      color: var(--muted);
      cursor: pointer;
      font: inherit;
    }
    .chart-level-toggle button.active { background: var(--primary); color: #fff; }
    .chart-level-toggle button:disabled { opacity: 0.45; cursor: not-allowed; }

    .chart-day-nav {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      font-size: 0.95rem;
      color: var(--text);
    }
    .chart-day-nav button {
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 4px 10px;
      cursor: pointer;
    }
    .chart-day-nav button:disabled { opacity: 0.35; cursor: not-allowed; }
    .chart-day-nav .chart-day-nav-label { font-weight: 600; min-width: 150px; text-align: center; }

    .chart-canvas-wrap { height: 320px; position: relative; }

    #monthlyTableDetails summary {
      cursor: pointer;
      font-weight: 600;
      color: var(--primary);
      padding: 6px 0;
    }
  </style>
```

- [ ] **Step 3: Verify**

Run:
```bash
grep -c "chart.js@4.4.7" /home/ubuntu/battery-roi-tool/index.html
grep -c "chart-level-toggle\|chart-day-nav\|chart-canvas-wrap\|monthlyTableDetails" /home/ubuntu/battery-roi-tool/index.html
```

Expected:
- First grep: `1`.
- Second grep: `≥ 8` (each class has at least 1 rule definition + some have child selectors).

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "Add Chart.js CDN + chart CSS for energy chart feature"
```

---

### Task 2: Add HTML for #energyChartCard and wrap #monthlyTable in <details>

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — insert new `#energyChartCard` HTML block, and wrap `#monthlyCard` contents in `<details>`.

After this task: a new empty chart card skeleton sits above the summary card (hidden by `display:none`), and the existing monthly table is collapsed by default inside a `<details>` disclosure. No JS is hooked up yet.

- [ ] **Step 1: Insert the energy chart card skeleton**

Use Edit. The target anchor is the exact string:
```
  <div class="card" id="summaryCard" style="margin-top:0;">
```

Replace with:
```
  <div class="card" id="energyChartCard" style="display:none;margin-top:0;">
    <h2><span class="icon">📊</span> Afname &amp; Injectie over tijd</h2>
    <div class="chart-level-toggle" role="tablist">
      <button type="button" id="btnLevelYear"  role="tab">Jaar</button>
      <button type="button" id="btnLevelMonth" role="tab" class="active">Maand</button>
      <button type="button" id="btnLevelDay"   role="tab">Dag</button>
    </div>
    <div class="chart-day-nav" id="chartDayNav" style="display:none;">
      <button type="button" id="btnDayPrev" aria-label="Vorige maand">◀</button>
      <span class="chart-day-nav-label" id="chartDayNavLabel">—</span>
      <button type="button" id="btnDayNext" aria-label="Volgende maand">▶</button>
    </div>
    <div class="chart-canvas-wrap">
      <canvas id="energyChartCanvas"></canvas>
    </div>
  </div>

  <div class="card" id="summaryCard" style="margin-top:0;">
```

- [ ] **Step 2: Wrap the monthly table in a `<details>` disclosure**

Use Edit. The target anchor is the exact string:
```
  <div class="card" id="monthlyCard" style="margin-top:0;">
    <h2><span class="icon">📅</span> Maandoverzicht injectie vs. batterijbenutting</h2>
    <div class="chart-wrap" id="monthlyTable"></div>
  </div>
```

Replace with:
```
  <div class="card" id="monthlyCard" style="margin-top:0;">
    <details id="monthlyTableDetails">
      <summary>📅 Toon maandoverzicht (tabel)</summary>
      <div class="chart-wrap" id="monthlyTable"></div>
    </details>
  </div>
```

Note the `<h2>` is intentionally dropped — the `<summary>` element now carries the same visual role (clickable header). Compare with the spec's UI section.

- [ ] **Step 3: Verify**

Run:
```bash
grep -n 'id="energyChartCard"\|id="btnLevelYear"\|id="btnLevelMonth"\|id="btnLevelDay"\|id="btnDayPrev"\|id="btnDayNext"\|id="energyChartCanvas"\|id="chartDayNav"\|id="chartDayNavLabel"' /home/ubuntu/battery-roi-tool/index.html
grep -n 'id="monthlyTableDetails"' /home/ubuntu/battery-roi-tool/index.html
grep -c 'Toon maandoverzicht' /home/ubuntu/battery-roi-tool/index.html
```

Expected:
- First grep: 9 lines (one per id).
- Second grep: 1 line.
- Third grep: `1`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "Add energy chart card skeleton + collapse monthly table in <details>"
```

---

### Task 3: Add bucket-building helper functions

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — add 4 pure helper functions to the JS block.

After this task: the file contains 4 new helper functions that transform per-day data into per-view buckets. They aren't called yet — we'll wire them up in Task 4.

- [ ] **Step 1: Insert the four bucket helpers**

Use Edit. The target anchor is the exact string:
```js
function _serializeState() {
```

Replace with (note: we prepend the 4 helpers BEFORE `_serializeState`, so `_serializeState` remains untouched in this step):
```js
// ─── ENERGY CHART HELPERS ──────────────────────────────────────────────────
function _buildYearBuckets(allDays) {
  // Group per calendar year; keep only years with a complete count of days (365, or 366 for leap years).
  const byYear = {};
  for (const d of allDays) {
    const y = d.date.getFullYear();
    if (!byYear[y]) byYear[y] = { afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0, dayCount: 0 };
    byYear[y].afnamedag     += d.afnamedag;
    byYear[y].afnamenacht   += d.afnamenacht;
    byYear[y].injectiedag   += d.injectiedag;
    byYear[y].injectienacht += d.injectienacht;
    byYear[y].dayCount      += 1;
  }
  function isComplete(y, count) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    return count === (isLeap ? 366 : 365);
  }
  return Object.entries(byYear)
    .filter(([y, v]) => isComplete(parseInt(y, 10), v.dayCount))
    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
    .map(([y, v]) => ({ label: y, afnamedag: v.afnamedag, afnamenacht: v.afnamenacht, injectiedag: v.injectiedag, injectienacht: v.injectienacht }));
}

function _buildMonthBuckets(windowDays) {
  // Aggregate the rolling-window days into per-month buckets. Keys are YYYY-MM.
  const byMonth = {};
  for (const d of windowDays) {
    const mk = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[mk]) byMonth[mk] = { afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0 };
    byMonth[mk].afnamedag     += d.afnamedag;
    byMonth[mk].afnamenacht   += d.afnamenacht;
    byMonth[mk].injectiedag   += d.injectiedag;
    byMonth[mk].injectienacht += d.injectienacht;
  }
  const MONTH_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return Object.keys(byMonth).sort().map(mk => {
    const [y, m] = mk.split('-');
    return { label: `${MONTH_NL[parseInt(m, 10) - 1]} '${y.slice(2)}`, monthKey: mk, ...byMonth[mk] };
  });
}

function _buildDayBuckets(allDays, monthKey) {
  return allDays
    .filter(d => {
      const mk = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`;
      return mk === monthKey;
    })
    .map(d => ({
      label: String(d.date.getDate()),
      afnamedag: d.afnamedag,
      afnamenacht: d.afnamenacht,
      injectiedag: d.injectiedag,
      injectienacht: d.injectienacht,
    }));
}

function _availableMonthKeys(allDays) {
  const set = new Set();
  for (const d of allDays) {
    set.add(`${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`);
  }
  return [...set].sort();
}

function _serializeState() {
```

- [ ] **Step 2: Verify**

Run:
```bash
grep -nE "^function (_buildYearBuckets|_buildMonthBuckets|_buildDayBuckets|_availableMonthKeys)" /home/ubuntu/battery-roi-tool/index.html
```

Expected: 4 function declarations found.

- [ ] **Step 3: Quick sanity run in a browser console**

This step is optional but recommended. Start a local server if not already running:
```bash
cd /home/ubuntu/battery-roi-tool && python3 -m http.server 8000 >/dev/null 2>&1 &
```
Then in the browser at `http://localhost:8000/` open DevTools and run:
```js
_buildYearBuckets([])                           // should return []
_availableMonthKeys([])                         // should return []
_buildMonthBuckets([])                          // should return []
_buildDayBuckets([], '2026-04')                 // should return []
```
All four should return empty arrays without throwing. Kill the server after.

If you skip this step, that's fine — the next task exercises these helpers.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "Add bucket-building helpers for energy chart (year/month/day)"
```

---

### Task 4: Add chart config builder + renderEnergyChart + event handlers

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — add `_buildChartConfig`, `renderEnergyChart`, `_setActiveLevel`, `_updateDayNavLabel`, `_wireChartHandlers`, and associated module-level state.

After this task: all chart-rendering code exists but is not yet called from `renderResults`. Calling `renderEnergyChart(window._lastD)` manually from the console (after a calculation) would render the chart. Event handlers are wired once on page load.

- [ ] **Step 1: Insert the chart rendering code**

Use Edit. The target anchor is the exact string:
```js
function _serializeState() {
```

Replace with (the 4 bucket helpers from Task 3 stay above; we insert new code between them and `_serializeState`):
```js
// ─── ENERGY CHART STATE ────────────────────────────────────────────────────
let _energyChartInstance = null;
let _chartState = { level: 'month', dayMonthIdx: -1 };
let _chartHandlersWired = false;

const MONTH_NL_FULL = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];

function _setActiveLevel(level) {
  ['Year','Month','Day'].forEach(L => {
    const btn = document.getElementById('btnLevel' + L);
    if (!btn) return;
    btn.classList.toggle('active', L.toLowerCase() === level);
  });
  document.getElementById('chartDayNav').style.display = level === 'day' ? '' : 'none';
}

function _updateDayNavLabel(monthKey, idx, total) {
  const [y, m] = monthKey.split('-');
  document.getElementById('chartDayNavLabel').textContent = `${MONTH_NL_FULL[parseInt(m, 10) - 1]} ${y}`;
  document.getElementById('btnDayPrev').disabled = idx <= 0;
  document.getElementById('btnDayNext').disabled = idx >= total - 1;
}

function _buildChartConfig(buckets, dualTariff) {
  const labels = buckets.map(b => b.label);
  const avgAfname   = buckets.length ? buckets.reduce((s, b) => s + b.afnamedag   + b.afnamenacht,   0) / buckets.length : 0;
  const avgInjectie = buckets.length ? buckets.reduce((s, b) => s + b.injectiedag + b.injectienacht, 0) / buckets.length : 0;

  const datasets = [];
  if (dualTariff) {
    datasets.push({ type: 'bar', label: 'Afname dag',      data: buckets.map(b =>  b.afnamedag),    backgroundColor: '#e54545', stack: 'afname',   order: 2 });
    datasets.push({ type: 'bar', label: 'Afname nacht',    data: buckets.map(b =>  b.afnamenacht),  backgroundColor: '#b02a2a', stack: 'afname',   order: 2 });
    datasets.push({ type: 'bar', label: 'Injectie dag',    data: buckets.map(b => -b.injectiedag),  backgroundColor: '#00b478', stack: 'injectie', order: 2 });
    datasets.push({ type: 'bar', label: 'Injectie nacht',  data: buckets.map(b => -b.injectienacht),backgroundColor: '#007a52', stack: 'injectie', order: 2 });
  } else {
    datasets.push({ type: 'bar', label: 'Afname',   data: buckets.map(b =>  (b.afnamedag   + b.afnamenacht)),   backgroundColor: '#e54545', stack: 'afname',   order: 2 });
    datasets.push({ type: 'bar', label: 'Injectie', data: buckets.map(b => -(b.injectiedag + b.injectienacht)), backgroundColor: '#00b478', stack: 'injectie', order: 2 });
  }
  datasets.push({ type: 'line', label: 'Ø afname',   data: Array(labels.length).fill(avgAfname),    borderColor: '#7a1010', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false, order: 1 });
  datasets.push({ type: 'line', label: 'Ø injectie', data: Array(labels.length).fill(-avgInjectie), borderColor: '#004d33', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false, order: 1 });

  return {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          ticks: {
            callback: v => Math.abs(v).toLocaleString('nl-BE', { maximumFractionDigits: 0 }) + ' kWh',
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Math.abs(ctx.parsed.y).toLocaleString('nl-BE', { maximumFractionDigits: 2 })} kWh`,
          },
        },
        legend: { position: 'bottom' },
      },
    },
  };
}

function renderEnergyChart(d) {
  const card = document.getElementById('energyChartCard');
  if (!card) return;
  const canvas = document.getElementById('energyChartCanvas');

  if (typeof Chart === 'undefined') {
    card.innerHTML = '<h2><span class="icon">📊</span> Afname &amp; Injectie over tijd</h2><div class="alert alert-warning">⚠️ <div>Grafiek niet beschikbaar — Chart.js kon niet laden.</div></div>';
    card.style.display = '';
    return;
  }
  if (_energyChartInstance) {
    _energyChartInstance.destroy();
    _energyChartInstance = null;
  }

  const hasRealAllDays = Array.isArray(d.allDays);

  // Jaar-knop disable rule: require at least 1 complete calendar year in the data.
  const btnYear = document.getElementById('btnLevelYear');
  const btnDay  = document.getElementById('btnLevelDay');
  const yearBuckets = hasRealAllDays ? _buildYearBuckets(d.allDays) : [];
  if (yearBuckets.length === 0) {
    btnYear.disabled = true;
    btnYear.title = 'Onvoldoende data: minstens 1 volledig kalenderjaar nodig';
    if (_chartState.level === 'year') { _chartState.level = 'month'; _setActiveLevel('month'); }
  } else {
    btnYear.disabled = false;
    btnYear.title = '';
  }
  // Dag-knop disable rule: require per-day data (real allDays array).
  if (!hasRealAllDays) {
    btnDay.disabled = true;
    btnDay.title = 'Dagniveau alleen beschikbaar bij nieuwere save-bestanden — upload de CSV opnieuw';
    if (_chartState.level === 'day') { _chartState.level = 'month'; _setActiveLevel('month'); }
  } else {
    btnDay.disabled = false;
    btnDay.title = '';
  }

  let buckets;
  if (_chartState.level === 'year') {
    buckets = yearBuckets;
  } else if (_chartState.level === 'month') {
    const wd = Array.isArray(d.windowDays) ? d.windowDays : (hasRealAllDays ? d.allDays.filter(x => x.date >= d.windowStart && x.date <= d.lastDate) : []);
    buckets = _buildMonthBuckets(wd);
  } else /* day */ {
    const months = _availableMonthKeys(d.allDays);
    if (_chartState.dayMonthIdx < 0 || _chartState.dayMonthIdx >= months.length) {
      _chartState.dayMonthIdx = months.length - 1;
    }
    buckets = _buildDayBuckets(d.allDays, months[_chartState.dayMonthIdx]);
    _updateDayNavLabel(months[_chartState.dayMonthIdx], _chartState.dayMonthIdx, months.length);
  }

  const cfg = _buildChartConfig(buckets, d.dualTariff);
  _energyChartInstance = new Chart(canvas.getContext('2d'), cfg);
  card.style.display = '';
}

function _wireChartHandlers() {
  if (_chartHandlersWired) return;
  _chartHandlersWired = true;
  document.getElementById('btnLevelYear' ).addEventListener('click', () => { if (!window._lastD) return; _chartState.level = 'year';  _setActiveLevel('year');  renderEnergyChart(window._lastD); });
  document.getElementById('btnLevelMonth').addEventListener('click', () => { if (!window._lastD) return; _chartState.level = 'month'; _setActiveLevel('month'); renderEnergyChart(window._lastD); });
  document.getElementById('btnLevelDay'  ).addEventListener('click', () => { if (!window._lastD) return; _chartState.level = 'day';   _setActiveLevel('day');   renderEnergyChart(window._lastD); });
  document.getElementById('btnDayPrev'   ).addEventListener('click', () => { if (!window._lastD) return; _chartState.dayMonthIdx--; renderEnergyChart(window._lastD); });
  document.getElementById('btnDayNext'   ).addEventListener('click', () => { if (!window._lastD) return; _chartState.dayMonthIdx++; renderEnergyChart(window._lastD); });
}

function _serializeState() {
```

- [ ] **Step 2: Verify**

Run:
```bash
grep -nE "^function (_buildChartConfig|renderEnergyChart|_setActiveLevel|_updateDayNavLabel|_wireChartHandlers)" /home/ubuntu/battery-roi-tool/index.html
grep -c "window._lastD" /home/ubuntu/battery-roi-tool/index.html
grep -c "_chartState" /home/ubuntu/battery-roi-tool/index.html
```

Expected:
- First grep: 5 function declarations.
- Second grep: `≥ 6` (once per handler closure + wherever else we set it in Task 5).
- Third grep: `≥ 10`.

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "Add chart config builder, renderEnergyChart, and event handlers"
```

---

### Task 5: Wire d.windowDays + integrate renderEnergyChart into the render flow

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — (a) add `windowDays` to the payload passed to `renderResults`, (b) set `window._lastD = d` and call `renderEnergyChart(d)` at the end of `renderResults`, (c) wire handlers once after DOM is parsed.

After this task: a fresh CSV calculation renders the chart above the summary card. Clicking the Jaar / Maand / Dag toggle re-renders. In Dag-view, the ◀/▶ buttons navigate through months.

- [ ] **Step 1: Add `windowDays` to the `renderResults` payload**

Use Edit. The target anchor is the exact string:
```js
    firstDate, allDays, capAnalysis,
```

Replace with:
```js
    firstDate, allDays, windowDays, capAnalysis,
```

(The `windowDays` local already exists at line ~1060; we're just passing it along.)

- [ ] **Step 2: Hook `renderEnergyChart` into `renderResults` + set `window._lastD`**

Use Edit. The target anchor is the exact string:
```js
function renderResults(d) {
  _saved = d; // persist for save/share
```

Replace with:
```js
function renderResults(d) {
  _saved = d; // persist for save/share
  window._lastD = d; // used by chart event handlers
  _chartState = { level: 'month', dayMonthIdx: -1 }; // reset to default view on each render
  _setActiveLevel('month');
```

- [ ] **Step 3: Call `renderEnergyChart` at the end of `renderResults`**

`renderResults` currently ends with `document.getElementById('monthlyTable').innerHTML = tableHTML;` around line 1499, followed by the function's closing `}`. Find the closing `}` of `renderResults` and insert a call just before it.

Use Edit. The target anchor is the exact string:
```js
  document.getElementById('monthlyTable').innerHTML = tableHTML;
}
```

Replace with:
```js
  document.getElementById('monthlyTable').innerHTML = tableHTML;

  // ── Render the energy chart ───────────────────────────────────────────────
  renderEnergyChart(d);
}
```

If the anchor above doesn't match uniquely, grep first:
```bash
grep -n 'monthlyTable.*innerHTML' /home/ubuntu/battery-roi-tool/index.html
```
and use the line that sits inside `renderResults` (the one immediately followed by a lone `}` on the next line).

- [ ] **Step 4: Wire chart handlers on page load**

Chart handlers (`btnLevelYear` etc.) need their event listeners attached once after the DOM is parsed. The JS block sits at the bottom of `<body>` so the relevant elements already exist by the time the script runs — but `_wireChartHandlers()` still has to be called explicitly.

Use Edit. The target anchor is the exact string:
```js
function _serializeState() {
```

Replace with:
```js
// Wire chart handlers once on page load (safe: this script runs after the DOM is parsed).
_wireChartHandlers();

function _serializeState() {
```

- [ ] **Step 5: Verify**

Run:
```bash
grep -n "renderEnergyChart(d)" /home/ubuntu/battery-roi-tool/index.html
grep -n "window._lastD = d" /home/ubuntu/battery-roi-tool/index.html
grep -n "firstDate, allDays, windowDays, capAnalysis" /home/ubuntu/battery-roi-tool/index.html
grep -n "_wireChartHandlers()" /home/ubuntu/battery-roi-tool/index.html
```

Expected:
- First grep: 1 line (call at end of `renderResults`).
- Second grep: 1 line.
- Third grep: 1 line.
- Fourth grep: ≥ 2 lines (1 definition + 1 call).

- [ ] **Step 6: Manual browser smoke (required for this task)**

```bash
cd /home/ubuntu/battery-roi-tool && python3 -m http.server 8000 >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
echo "Server running at http://localhost:8000/ — open in browser, upload a Fluvius CSV with 1-2 years of data."
echo "Verify:"
echo "  1. Chart appears above the summary card after 'Bereken ROI' is clicked."
echo "  2. Default view is Maand (12-13 bars)."
echo "  3. Clicking Jaar re-renders (if data has ≥1 complete calendar year); otherwise Jaar is disabled with tooltip."
echo "  4. Clicking Dag re-renders to the most recent month's days; ◀/▶ buttons navigate."
echo "  5. Y-axis labels show kWh, injectie bars are below the 0-axis."
echo "Press Enter when done."
read
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```

If any of the 5 checks fail, stop and debug before committing. Common failures:
- Chart doesn't appear: check DevTools console for errors. Likely `Chart is undefined` (CDN blocked) or a typo in the canvas/card IDs.
- Jaar button always disabled when it shouldn't be: check `_buildYearBuckets` leap-year math.
- Dag ◀/▶ always disabled: check `_updateDayNavLabel` bounds arithmetic.

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "Wire energy chart into renderResults flow"
```

---

### Task 6: Bump save-version to v:5 with dailyCompact

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — change `_serializeState` to emit v:5 with `dailyCompact`, change `_restoreState` to expand `dailyCompact` back to `allDays` + derive `windowDays`, update `_applyLoadedState` to accept v:5.

After this task: fresh calculations produce v:5 saves that include per-day data, the share-link flow and download-JSON flow both preserve Dag-view functionality across restores, and older v:1-4 saves still load with Dag-view gracefully disabled.

- [ ] **Step 1: Bump version and add dailyCompact to the serialized state**

Find the current `_serializeState` body. The key lines are:
```js
    v: 4,
    ...
    r: {
      ...
      avgTotals:  d.avgTotals  || null,
    }
  };
}
```

Use Edit. The target anchor is the exact string:
```js
      avgTotals:  d.avgTotals  || null,
    }
  };
}
```

Replace with:
```js
      avgTotals:  d.avgTotals  || null,
      dailyCompact: Array.isArray(d.allDays) ? {
        startDate:     d.allDays[0].date.toISOString().slice(0, 10),
        afnamedag:     d.allDays.map(x => x.afnamedag),
        afnamenacht:   d.allDays.map(x => x.afnamenacht),
        injectiedag:   d.allDays.map(x => x.injectiedag),
        injectienacht: d.allDays.map(x => x.injectienacht),
      } : null,
    }
  };
}
```

Then bump `v: 4` to `v: 5`. Use Edit with old_string `    v: 4,` (note: this appears only in `_serializeState` — confirm uniqueness by grepping):
```bash
grep -n '^    v: 4,' /home/ubuntu/battery-roi-tool/index.html
```
If that's exactly one match, do the edit:

Use Edit. The target anchor is the exact string:
```js
    v: 4,
```

Replace with:
```js
    v: 5,
```

- [ ] **Step 2: Expand dailyCompact back to allDays in _restoreState**

Use Edit. The target anchor is the exact string:
```js
  r.allDays     = { length: r.totalDaysCSV };
```

Replace with:
```js
  if (r.dailyCompact) {
    const dc = r.dailyCompact;
    const start = new Date(dc.startDate + 'T00:00:00');
    r.allDays = dc.afnamedag.map((ad, i) => {
      const date = new Date(start); date.setDate(date.getDate() + i);
      const an  = dc.afnamenacht[i];
      const id  = dc.injectiedag[i];
      const inn = dc.injectienacht[i];
      return {
        date,
        afnamedag: ad, afnamenacht: an, injectiedag: id, injectienacht: inn,
        afname: ad + an, injectie: id + inn,
      };
    });
    r.windowDays = r.allDays.filter(d => d.date >= r.windowStart && d.date <= r.lastDate);
  } else {
    // v1-v4 save: per-day data not available. Chart falls back to monthMap-derived views.
    r.allDays = { length: r.totalDaysCSV };
  }
```

- [ ] **Step 3: Accept v:5 in _applyLoadedState**

There are two bare `!==` chains to extend, both inside `_applyLoadedState` (around line 749-756).

**Edit 3a — rejection check.** Use Edit with the exact anchor:
```js
  if (!state || (state.v !== 1 && state.v !== 2 && state.v !== 3 && state.v !== 4)) { alert('Onbekend of verouderd bestandsformaat.'); return; }
```

Replace with:
```js
  if (!state || (state.v !== 1 && state.v !== 2 && state.v !== 3 && state.v !== 4 && state.v !== 5)) { alert('Onbekend of verouderd bestandsformaat.'); return; }
```

**Edit 3b — config-load gate.** Use Edit with the exact anchor:
```js
  if ((state.v === 2 || state.v === 3 || state.v === 4) && f.selectedConfigTypes && f.selectedConfigTypes.some(t => t)) {
```

Replace with:
```js
  if ((state.v === 2 || state.v === 3 || state.v === 4 || state.v === 5) && f.selectedConfigTypes && f.selectedConfigTypes.some(t => t)) {
```

- [ ] **Step 4: Verify**

Run:
```bash
grep -n "v: 5" /home/ubuntu/battery-roi-tool/index.html
grep -n "dailyCompact" /home/ubuntu/battery-roi-tool/index.html
grep -n "r.windowDays = r.allDays.filter" /home/ubuntu/battery-roi-tool/index.html
```

Expected:
- First grep: 1 line (inside `_serializeState`).
- Second grep: ≥ 4 lines (serialize + restore + possibly one more for version checks/comments).
- Third grep: 1 line (inside `_restoreState`).

- [ ] **Step 5: Manual browser smoke for save/restore**

```bash
cd /home/ubuntu/battery-roi-tool && python3 -m http.server 8000 >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
echo "Open http://localhost:8000/"
echo "1. Upload Fluvius CSV, calculate ROI."
echo "2. Click 'Deel link' (share link button). Copy the URL."
echo "3. Paste it into a new tab. Verify the chart appears AND Dag-view works."
echo "4. Open DevTools > Network > click 'Download save' and inspect the JSON — 'v' should be 5, 'dailyCompact' should be present."
echo "Press Enter when done."
read
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "Bump save state to v:5 with dailyCompact so Dag-view works from share links"
```

---

### Task 7: Update CLAUDE.md + final structural verification

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/CLAUDE.md` — update the "Save / share state" paragraph to reflect v:5 and `dailyCompact`.

After this task: project docs match the new save format, and a final structural grep confirms no loose ends.

- [ ] **Step 1: Update CLAUDE.md "Save / share state" paragraph**

The relevant paragraph currently reads (check with `grep`):
```bash
grep -n 'v: 4\|_applyLoadedState\|Save / share state' /home/ubuntu/battery-roi-tool/CLAUDE.md
```

Use Edit to update the mention of `v: 4` in CLAUDE.md. The target anchor is the exact string (verify with the grep above before editing):
```
`_serializeState` produces a versioned (`v: 4`) JSON of inputs + computed results (NOT the raw CSV).
```

Replace with:
```
`_serializeState` produces a versioned (`v: 5`) JSON of inputs + computed results (NOT the raw CSV). v:5 adds a `dailyCompact` field (4 parallel arrays + a `startDate`) so per-day data is preserved across share-links — needed by the energy chart's Dag-view.
```

Also extend the accepted-versions sentence. The current text says:
```
`_applyLoadedState` accepts `v: 1, 2, 3, 4` and degrades older versions gracefully
```

Replace with:
```
`_applyLoadedState` accepts `v: 1, 2, 3, 4, 5` and degrades older versions gracefully (e.g. v:1-4 saves have no per-day data → the energy chart's Dag-view is disabled with a tooltip and Jaar/Maand are derived from `monthMap`)
```

- [ ] **Step 2: Final structural verification**

Run:
```bash
grep -c "chart.js@4.4.7" /home/ubuntu/battery-roi-tool/index.html
grep -c 'id="energyChartCard"\|id="energyChartCanvas"\|id="monthlyTableDetails"' /home/ubuntu/battery-roi-tool/index.html
grep -cE "^function (_buildYearBuckets|_buildMonthBuckets|_buildDayBuckets|_availableMonthKeys|_buildChartConfig|renderEnergyChart|_setActiveLevel|_updateDayNavLabel|_wireChartHandlers)" /home/ubuntu/battery-roi-tool/index.html
grep -c "v: 5" /home/ubuntu/battery-roi-tool/index.html
grep -c "dailyCompact" /home/ubuntu/battery-roi-tool/index.html
```

Expected:
- First grep: `1` (Chart.js CDN tag).
- Second grep: `3`.
- Third grep: `9` (all chart functions defined).
- Fourth grep: `1` (just the `_serializeState` line).
- Fifth grep: `≥ 4` (serialize, restore expand, restore fallback comment, CLAUDE.md mentions are in a different file so don't count here).

- [ ] **Step 3: HTTP sanity check**

```bash
cd /home/ubuntu/battery-roi-tool && python3 -m http.server 8000 >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
curl -sI http://localhost:8000/ | head -1
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```

Expected: `HTTP/1.0 200 OK`.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add CLAUDE.md
git commit -m "Update CLAUDE.md: save state bumped to v:5 with dailyCompact for energy chart"
```

- [ ] **Step 5: Self-review**

```bash
cd /home/ubuntu/battery-roi-tool
git log --oneline -10
git status
```

Confirm:
- 7 new commits on top, one per task: Chart.js CDN/CSS → card HTML → bucket helpers → chart config/render → wire-into-renderResults → v:5 save → CLAUDE.md.
- `git status` shows a clean working tree (plus the usual untracked plan file).
- The plan file in `docs/superpowers/plans/` is still untracked, which is expected.

## Report format

- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- List of commit SHAs (7 commits).
- Output of all Step 2 greps from Task 7.
- Result of the two manual browser smokes (Task 5 Step 6 and Task 6 Step 5). If skipped, say so explicitly — the user then knows they own that verification.
- Anything unexpected (e.g. the v:4 anchor didn't appear uniquely, or Chart.js failed to load from the CDN).

---

## Self-review (controller, before handing off)

**Spec coverage:**
- Spec § UI → Placement → Task 2 Step 1 (card inserted before `#summaryCard`).
- Spec § UI → Toggle → Tasks 2 (HTML) + 4 (disable logic + handlers) + 5 (wire-up).
- Spec § UI → Dag-view navigatie → Task 2 (HTML) + Task 4 (`_updateDayNavLabel`, `btnDayPrev`/`Next` handlers).
- Spec § UI → Existing `#monthlyTable` → Task 2 Step 2 (wrap in `<details>`).
- Spec § Data → Jaar/Maand/Dag buckets → Task 3 (all 4 helpers).
- Spec § Data → Averages → Task 4 (`_buildChartConfig` computes `avgAfname`/`avgInjectie`).
- Spec § Rendering → Chart.js config → Task 4.
- Spec § Rendering → Single-tariff fallback → Task 4 (`if (dualTariff) … else …`).
- Spec § Rendering → Integration in `renderResults` → Task 5.
- Spec § Save-link compatibility → v:5 bump + `dailyCompact` + migration → Task 6.
- Spec § Save-link compatibility → Graceful degradation (v:1-4) → Task 4 (`hasRealAllDays` check, Dag-knop disable) + Task 6 Step 2 (restore fallback).
- Spec § Edge cases 1-8 → covered across Tasks 3 (buckets), 4 (disable logic + Chart.js-undefined fallback), 5 (fresh render flow), 6 (save/restore).
- Spec § CSS additions → Task 1 Step 2.
- Spec § Verificatie → Task 5 Step 6 + Task 6 Step 5 (manual smokes) + Task 7 Step 2 (structural greps).
- Spec § File changes → Tasks 1-7 collectively modify `index.html` + `CLAUDE.md`.

**Placeholder scan:** every step has actual code or actual commands. No "TBD"/"TODO"/"similar to…" shortcuts. The Task 6 Step 3 version-check edit leaves the exact pattern flexible (because the implementer needs to read the current code to see whether it's an `includes` array or a `!==` chain) — but concrete both-variant instructions are given.

**Type/name consistency:**
- Chart state object: `{ level: 'year'|'month'|'day', dayMonthIdx: number }` — consistent across Tasks 4 and 5.
- DOM IDs: `btnLevelYear/Month/Day`, `btnDayPrev/Next`, `chartDayNav`, `chartDayNavLabel`, `energyChartCanvas`, `energyChartCard`, `monthlyTableDetails` — used identically in HTML (Task 2), JS (Task 4), CSS (Task 1).
- Bucket shape: `{ label, afnamedag, afnamenacht, injectiedag, injectienacht }` — consistent across `_buildYearBuckets` / `_buildMonthBuckets` / `_buildDayBuckets` (month has extra `monthKey` field; not consumed by chart config).
- `window._lastD`: set in Task 5 Step 2, read in Task 4 Step 1 handlers.
- `dailyCompact` field names `afnamedag/afnamenacht/injectiedag/injectienacht`: identical in serialize (Task 6 Step 1) and restore (Task 6 Step 2).
- `hasRealAllDays = Array.isArray(d.allDays)` — correct predicate because v:1-4 restore sets `r.allDays = { length: n }` (a plain object), which fails `Array.isArray`.
