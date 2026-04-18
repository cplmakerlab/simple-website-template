# Energy Chart — Afname & Injectie over tijd

**Date:** 2026-04-18
**Scope:** Add a bar chart visualising per-period afname (above 0-axis) and injectie (below 0-axis) with three zoom levels (Jaar / Maand / Dag). Sits above the existing `#summaryCard` ("blokjes"). The existing `#monthlyTable` is kept but collapsed by default.

---

## Goal

Give the salesperson a high-level → drill-down visual of the customer's consumption and injection. Clicking **Jaar** answers *"hoe veranderde hun verbruik jaar-op-jaar?"*, **Maand** (default) answers *"waar zitten de zomer/winter pieken in het laatste jaar?"*, **Dag** answers *"hoe ziet één specifieke maand er dag-per-dag uit?"*. All data is already in `allDays`; no new CSV parsing needed — only new aggregation and rendering.

## Non-goals

- No calendar picker for dag-view — alleen sequentiële `◀/▶` maand-navigatie.
- Geen per-uur / per-kwartier data (CSV is al geaggregeerd naar dag door `processData`).
- Grafiek wordt NIET opgenomen in PDF-export (indien die later ooit toegevoegd wordt).

---

## UI

### Placement

New card `#energyChartCard` inserted **immediately before** `#summaryCard` in the DOM. Same `.card`-styling als andere resultaten-cards. Display rules: `display: none` by default, `.style.display = ''` zodra `renderResults` draait (zelfde pattern als `#summaryCard`).

### Card layout (top → bottom)

```
┌─ 📊 Afname & Injectie over tijd ─────────────────────┐
│  [ Jaar ] [ Maand ] [ Dag ]    ← segmented toggle    │
│                                                       │
│  (alleen in dag-view:)                                │
│  ◀ April 2026 ▶    ← prev/next maand navigatie       │
│                                                       │
│  ┌──────────── Chart.js canvas (±320px high) ──────┐  │
│  │                                                 │  │
│  │   ▓ afname dag    ░ afname nacht                │  │
│  │   ─ ─ Ø avg afname (horizontale lijn, rood)     │  │
│  │ ━━━━━━━━━━━━━━━━ 0-as ━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │   ▓ injectie dag  ░ injectie nacht              │  │
│  │   ─ ─ Ø avg injectie (horizontale lijn, groen)  │  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  Legend onder de grafiek (Chart.js default)           │
└───────────────────────────────────────────────────────┘
```

### Toggle (segmented)

Drie knoppen `[Jaar] [Maand] [Dag]` in een `.chart-level-toggle`-groep. Exact één is actief (`.active` class, primaire kleur). Standaard: **Maand**.

Jaar-knop is **disabled** wanneer er geen enkel volledig kalenderjaar (365 dagen, of 366 voor schrikkeljaar) in de data zit. `button.disabled = true` + `title="Onvoldoende data: minstens 1 volledig kalenderjaar nodig"`.

### Dag-view navigatie

Bovenaan de grafiek een rij met `◀ <Maandnaam> <Jaartal> ▶`. De `◀` knop is disabled wanneer we op de eerste maand-key van de data zitten, `▶` is disabled op de laatste. Navigatie wraps niet.

Voorbeeld: beschikbare maanden zijn `['2024-03', '2024-04', ..., '2026-04']`. Default start-index = laatste element (meest recente). Klik `◀` → index--, klik `▶` → index++.

### Existing `#monthlyTable`

Wordt gewrapt in `<details>`:
```html
<details id="monthlyTableDetails">
  <summary>📋 Toon maandoverzicht (tabel)</summary>
  <div class="chart-wrap" id="monthlyTable"></div>
</details>
```
Standaard dicht. De tabel zelf verandert niet.

---

## Data & berekening

### Bron

`d.allDays` — array van per-dag records (`{date, afname, injectie, afnamedag, afnamenacht, injectiedag, injectienacht}`), gesorteerd op datum. Bestaat al in de data-pipeline. `d.windowDays` — `allDays.filter(d => d.date >= windowStart && d.date <= lastDate)`. Wordt op dit moment als lokale var in `calculate()` berekend (line ~1060); moet aan het returned `d`-object toegevoegd worden zodat zowel fresh calculation als restore-from-share toegang heeft. Beide moeten ook beschikbaar zijn na share-link restore — zie § Save-link compatibility.

### Jaar-view buckets

```js
function _buildYearBuckets(allDays) {
  // Group per calendar year YYYY. Keep only years with a complete calendar year in data.
  const byYear = {};
  for (const d of allDays) {
    const y = d.date.getFullYear();
    if (!byYear[y]) byYear[y] = { afnamedag:0, afnamenacht:0, injectiedag:0, injectienacht:0, dayCount:0 };
    byYear[y].afnamedag    += d.afnamedag;
    byYear[y].afnamenacht  += d.afnamenacht;
    byYear[y].injectiedag  += d.injectiedag;
    byYear[y].injectienacht+= d.injectienacht;
    byYear[y].dayCount     += 1;
  }
  // A year is "complete" if dayCount === 365 (or 366 for leap years: 2024, 2028, 2032, ...).
  function isComplete(y, count) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    return count === (isLeap ? 366 : 365);
  }
  return Object.entries(byYear)
    .filter(([y, v]) => isComplete(parseInt(y, 10), v.dayCount))
    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
    .map(([y, v]) => ({ label: y, ...v }));
}
```

### Maand-view buckets

```js
function _buildMonthBuckets(windowDays) {
  // windowDays = allDays filtered to [windowStart, lastDate] — same rolling window
  // as used throughout the app (last 365 days). Aggregate per YYYY-MM.
  const byMonth = {};
  for (const d of windowDays) {
    const mk = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}`;
    if (!byMonth[mk]) byMonth[mk] = { afnamedag:0, afnamenacht:0, injectiedag:0, injectienacht:0 };
    byMonth[mk].afnamedag    += d.afnamedag;
    byMonth[mk].afnamenacht  += d.afnamenacht;
    byMonth[mk].injectiedag  += d.injectiedag;
    byMonth[mk].injectienacht+= d.injectienacht;
  }
  const keys = Object.keys(byMonth).sort();
  const MONTH_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  return keys.map(mk => {
    const [y, m] = mk.split('-');
    return { label: `${MONTH_NL[parseInt(m,10)-1]} '${y.slice(2)}`, monthKey: mk, ...byMonth[mk] };
  });
}
```

Note: input is `windowDays`, niet `allDays`. Dit matcht de rolling-window-logica die de rest van de app gebruikt (meestal 12 maanden, soms 13 als `windowStart` midden in een maand valt). Geen kalender-jan-tot-dec.

### Dag-view buckets

```js
function _buildDayBuckets(allDays, monthKey) {
  // monthKey: 'YYYY-MM'. Return all days in allDays with that month-prefix,
  // in date order. Labels are the day-of-month as a string ('1', '2', ...).
  return allDays
    .filter(d => {
      const mk = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}`;
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
    set.add(`${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}`);
  }
  return [...set].sort();
}
```

### Averages

Voor elke view: `avgAfname = mean(bar.afnamedag + bar.afnamenacht)` over de getoonde bars, en idem voor injectie. Deze waarden worden als Chart.js `type: 'line'`-datasets toegevoegd (horizontale lijn op `y = avgAfname` en `y = -avgInjectie`).

---

## Rendering — Chart.js config

### CDN load

In `<head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7"></script>
```

Specifieke versie, niet `@latest`, om surprise-breaks te voorkomen.

### Dataset shape (Maand-view, dual tariff)

```js
{
  type: 'bar',
  data: {
    labels: buckets.map(b => b.label),   // ['mei \'25', 'jun \'25', ...]
    datasets: [
      // Afname — positieve waardes (boven 0-as)
      { label: 'Afname dag',      data: buckets.map(b =>  b.afnamedag),    backgroundColor: '#e54545', stack: 'afname' },
      { label: 'Afname nacht',    data: buckets.map(b =>  b.afnamenacht),  backgroundColor: '#b02a2a', stack: 'afname' },
      // Injectie — negatieve waardes (onder 0-as, zo maakt Chart.js vanzelf een "below-axis" stack)
      { label: 'Injectie dag',    data: buckets.map(b => -b.injectiedag),  backgroundColor: '#00b478', stack: 'injectie' },
      { label: 'Injectie nacht',  data: buckets.map(b => -b.injectienacht),backgroundColor: '#007a52', stack: 'injectie' },
      // Avg-lijnen (type: 'line' in een mixed chart)
      { type: 'line', label: 'Ø afname',   data: Array(buckets.length).fill(avgAfname),    borderColor: '#7a1010', borderDash: [6,4], borderWidth: 2, pointRadius: 0, fill: false },
      { type: 'line', label: 'Ø injectie', data: Array(buckets.length).fill(-avgInjectie), borderColor: '#004d33', borderDash: [6,4], borderWidth: 2, pointRadius: 0, fill: false },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true },
      y: {
        stacked: true,
        ticks: {
          // Y-axis labels tonen altijd als positieve kWh (ook onder 0-as)
          callback: v => Math.abs(v).toLocaleString('nl-BE') + ' kWh',
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          // Negatieve injectie-waardes weer als positieve tonen in tooltip
          label: (ctx) => `${ctx.dataset.label}: ${Math.abs(ctx.parsed.y).toLocaleString('nl-BE', {maximumFractionDigits: 2})} kWh`,
        },
      },
      legend: { position: 'bottom' },
    },
  },
}
```

### Single-tariff fallback

Als `d.dualTariff === false`: laat de twee nacht-datasets weg (`afnamenacht` en `injectienacht` zijn dan 0 in de data maar ook het label is verwarrend). Render alleen `Afname` en `Injectie` als één dataset elk.

### Entry point

```js
let _energyChartInstance = null;
let _chartState = { level: 'month', dayMonthIdx: -1 /* = laatste */ };

function renderEnergyChart(d) {
  // d = the full computed/restored data object (already passed to renderResults)
  const canvas = document.getElementById('energyChartCanvas');
  if (typeof Chart === 'undefined') {
    document.getElementById('energyChartCard').innerHTML =
      '<div class="alert alert-warning">Grafiek niet beschikbaar — Chart.js kon niet laden.</div>';
    return;
  }
  if (_energyChartInstance) { _energyChartInstance.destroy(); _energyChartInstance = null; }

  let buckets;
  if (_chartState.level === 'year')       buckets = _buildYearBuckets(d.allDays);
  else if (_chartState.level === 'month') buckets = _buildMonthBuckets(d.windowDays);
  else /* day */ {
    const months = _availableMonthKeys(d.allDays);
    if (_chartState.dayMonthIdx < 0) _chartState.dayMonthIdx = months.length - 1;
    buckets = _buildDayBuckets(d.allDays, months[_chartState.dayMonthIdx]);
    _updateDayNavLabel(months[_chartState.dayMonthIdx], _chartState.dayMonthIdx, months.length);
  }

  const cfg = _buildChartConfig(buckets, d.dualTariff);
  _energyChartInstance = new Chart(canvas.getContext('2d'), cfg);
}
```

### Integration in `renderResults`

Aan het einde van `renderResults(d, s)`: `renderEnergyChart(d); document.getElementById('energyChartCard').style.display = '';`

Toggle-knoppen bevatten click-handlers:
```js
document.getElementById('btnLevelYear' ).addEventListener('click', () => { _chartState.level = 'year';  _setActiveLevel('year');  renderEnergyChart(window._lastD); });
document.getElementById('btnLevelMonth').addEventListener('click', () => { _chartState.level = 'month'; _setActiveLevel('month'); renderEnergyChart(window._lastD); });
document.getElementById('btnLevelDay'  ).addEventListener('click', () => { _chartState.level = 'day';   _setActiveLevel('day');   renderEnergyChart(window._lastD); });
document.getElementById('btnDayPrev'   ).addEventListener('click', () => { _chartState.dayMonthIdx--; renderEnergyChart(window._lastD); });
document.getElementById('btnDayNext'   ).addEventListener('click', () => { _chartState.dayMonthIdx++; renderEnergyChart(window._lastD); });
```

`window._lastD` wordt gezet door `renderResults(d, ...)` — enige "global" state. Alternatief: pass `d` via een closure op `renderResults`-tijd of via een IIFE die de handlers pas registreert wanneer `d` bekend is. Implementer kiest; beide zijn acceptabel.

**`_chartState` reset:** bij elke `renderResults`-aanroep (fresh calculate of share-link load) wordt `_chartState` gereset naar `{ level: 'month', dayMonthIdx: -1 }` zodat de default maand-view getoond wordt, niet een stale state van een vorige berekening.

---

## Save-link compatibility

### Current state (v:4)

`_saved` bevat `monthMap` maar **niet** `allDays` (enkel `.length`). Dag-view is daardoor onmogelijk vanuit een restored share-link.

### New state (v:5)

Bump to `v: 5`. `_saved.r` krijgt een nieuw veld `dailyCompact`:
```js
dailyCompact: {
  startDate: '2024-03-15',  // ISO date of first day in arrays
  afnamedag:    [1.23, 1.45, 0.98, ...],  // length = N days
  afnamenacht:  [0.87, 0.91, 0.55, ...],
  injectiedag:  [2.34, 3.45, 4.12, ...],
  injectienacht:[0.12, 0.15, 0.21, ...],
},
```

Geen expliciete `endDate` nodig — volgt uit `startDate + length`. Geen per-dag-totaal (afname/injectie) — gederiveerd als dag + nacht.

**Size estimate:** 2 jaar CSV = ~730 dagen × 4 arrays × ~5-7 bytes per getal (bv. `1.234,56` → 4-5 chars + komma) ≈ 20-25 KB JSON, ~30-35 KB na base64. Blijft binnen alle moderne browser-URL-limieten (Chrome/Firefox/Safari: ≥32K, doorgaans veel meer).

### `_restoreState` migration

In `_restoreState(r)`:
```js
// v4 and earlier: no dailyCompact. Expand to allDays if present.
if (r.dailyCompact) {
  const dc = r.dailyCompact;
  const start = new Date(dc.startDate + 'T00:00:00');
  r.allDays = dc.afnamedag.map((ad, i) => {
    const date = new Date(start); date.setDate(date.getDate() + i);
    const an = dc.afnamenacht[i],   id = dc.injectiedag[i], inn = dc.injectienacht[i];
    return {
      date,
      afnamedag: ad, afnamenacht: an, injectiedag: id, injectienacht: inn,
      afname: ad + an, injectie: id + inn,
    };
  });
  r.windowDays = r.allDays.filter(d => d.date >= r.windowStart && d.date <= r.lastDate);
} else {
  // v1-v4 save: allDays not available. Dag-view and Jaar-view fall back to monthMap.
  r.allDays = { length: r.totalDaysCSV };   // keep existing stub
}
```

### Graceful degradation (v1-v4 restored saves)

Oudere saves (v:1-4) hebben geen per-dag-data. Gedrag:
- **Maand-view**: wordt gebouwd uit `monthMap` (al beschikbaar). Werkt.
- **Jaar-view**: wordt gebouwd uit `monthMap` door YYYY-MM-keys per YYYY te groeperen. Disable-regel voor jaar-knop wordt: `monthMap` moet een volledig YYYY (12 maand-keys voor dat jaar) bevatten.
- **Dag-view**: knop disabled, tooltip `"Dagniveau alleen beschikbaar bij nieuwere save-bestanden — upload de CSV opnieuw"`.

De rendering-code moet dus check op `Array.isArray(d.allDays)` vs. de stub `{length: n}` — bij stub de Dag-knop disabled en Jaar/Maand afleiden uit `monthMap`.

### Share-link size check

Nieuwe `copyShareLink()`-flow: na serialisatie, als de final URL > 30 KB, toon een waarschuwing (`alert` of een inline notice) dat de link mogelijks te lang is voor sommige chat-apps. URL werkt technisch nog steeds in alle moderne browsers.

---

## Edge cases

1. **CSV met 1 maand data** — maand-view toont 1 bar, dag-view werkt, jaar-view disabled.
2. **Single-tariff CSV** — `dualTariff === false`, dag/nacht velden zijn 0, alleen `afname`/`injectie` datasets geshown (geen nacht-segmenten).
3. **Schrikkeljaar** — `_buildYearBuckets` isComplete-check handelt 2024/2028/… correct af (366 ipv 365 dagen).
4. **Jaar met alle waarden 0** (onwaarschijnlijk maar mogelijk) — bars hebben hoogte 0, avg = 0. Chart renders, geen NaN.
5. **Dag-view in maand met 0 dagen data** — kan niet voorkomen, want `_availableMonthKeys` enumereert alleen maanden die in `allDays` zitten.
6. **Restore vanuit oudere save (v:1-4)** — Dag-knop disabled, Maand+Jaar werken uit `monthMap`.
7. **Chart.js CDN faalt** — card toont fallback melding, rest van app blijft werken.
8. **Window resize** — `maintainAspectRatio: false` + CSS `.chart-canvas-wrap { height: 320px; }` zorgt dat de grafiek z'n hoogte vast houdt en breedte volgt.

---

## CSS additions

```css
.chart-level-toggle { display: flex; gap: 0; margin-bottom: 12px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; width: fit-content; }
.chart-level-toggle button { padding: 6px 14px; border: 0; background: var(--card); color: var(--muted); cursor: pointer; font: inherit; }
.chart-level-toggle button.active { background: var(--primary); color: #fff; }
.chart-level-toggle button:disabled { opacity: 0.45; cursor: not-allowed; }

.chart-day-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; font-size: 0.95rem; color: var(--text); }
.chart-day-nav button { background: transparent; border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; cursor: pointer; }
.chart-day-nav button:disabled { opacity: 0.35; cursor: not-allowed; }

.chart-canvas-wrap { height: 320px; position: relative; }
#monthlyTableDetails summary { cursor: pointer; font-weight: 600; color: var(--primary); padding: 6px 0; }
```

---

## Verificatie (manueel — geen tests in repo)

1. Upload Fluvius-CSV met 2 volledige kalenderjaren + partiële maand ertussen → Jaar-knop enabled, Maand-view default opent met 12-13 bars, Dag-view navigeert maand per maand.
2. Upload CSV met < 1 jaar data → Jaar-knop disabled met tooltip.
3. Single-tariff CSV (geen dag/nacht) → grafiek toont 1-kleur bars per richting.
4. Klik "Toon maandoverzicht (tabel)" onderaan → oude `#monthlyTable` opent.
5. `copyShareLink`, open in nieuw tabblad → grafiek verschijnt, alle 3 levels werken (inclusief Dag).
6. Laad een oude v4 save-JSON → Maand + Jaar werken, Dag-knop is disabled met tooltip.
7. Chart.js CDN blokkeren (DevTools network tab) → fallback melding verschijnt, rest van app werkt.
8. Resize browser window → grafiek blijft 320px hoog, breedte volgt.

---

## File changes (summary)

- **Modify:** `index.html` — enige file in de app.
  - `<head>`: nieuwe `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7">`.
  - `<style>`: ~20 regels voor `.chart-level-toggle`, `.chart-day-nav`, `.chart-canvas-wrap`, `#monthlyTableDetails summary`.
  - HTML body: nieuwe `<section id="energyChartCard" class="card" style="display:none">` vóór `#summaryCard`. Wikkel bestaande `#monthlyTable` in `<details id="monthlyTableDetails">`.
  - JS: nieuwe helpers `_buildYearBuckets`, `_buildMonthBuckets`, `_buildDayBuckets`, `_availableMonthKeys`, `_buildChartConfig`, `renderEnergyChart`, `_setActiveLevel`, `_updateDayNavLabel`. Wijzigingen aan `_serializeState` (bump naar v:5, voeg `dailyCompact` toe), `_restoreState` (decode `dailyCompact` → `allDays`), `_applyLoadedState` (accepteer v:5 + degrade v:1-4 voor Dag-view). Koppel `renderEnergyChart(d)` aan het einde van `renderResults`.
