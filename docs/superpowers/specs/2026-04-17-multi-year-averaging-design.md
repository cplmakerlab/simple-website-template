# Multi-year averaging in the ROI calculator

**Date:** 2026-04-17
**Scope:** `index.html` only

## Problem

Today the calculator uses a rolling 365-day window ending on the last CSV date. When the user supplies more than a year of data, the extra history is silently ignored. Customers regularly send 2–4 years of Fluvius data and expect to see how the most recent year compares to a multi-year average, both for stability (a single bad solar year skews payback) and for confidence in the recommendation.

## Goal

When the dataset spans `N ≥ 2` complete 365-day blocks, show alongside every "afgelopen jaar" number a "gem. N j" companion (average across all complete year blocks, **including the most recent**). Progress bars get a `▼` marker at the average position. When `N = 1` (or `< 1`), the UI is byte-identical to today.

## Non-goals

- Changing how the `< 1 year` case is handled. Today it extrapolates with `scaleFactor = 365 / daysInWindow`; that stays.
- Refactoring `index.html` into multiple files. The file grows ~250 lines under this design; that is accepted scope creep.
- Pre-computing or caching anything across calculate-runs.

## Year-block model

**Window definition.** Counting backward from `lastDate` in 365-day blocks:
- Year 1 = `[lastDate − 364 .. lastDate]` (this is exactly the current `windowDays`).
- Year 2 = `[lastDate − 729 .. lastDate − 365]`.
- Year *k* = `[lastDate − (365k − 1) .. lastDate − 365(k − 1)]`.

`N = floor((lastDate − firstDate + 1) / 365)`. Any leftover days at the start of the dataset are dropped.

Examples (assuming `lastDate` is fixed):
| Data span | `N` | Behavior |
|---|---|---|
| 1y 11m 30d | 1 | unchanged from today |
| 2y exactly | 2 | "afgelopen jaar X / gem. 2 j Y" |
| 2y 5m | 2 | the extra 5m discarded |
| 3y exactly | 3 | "gem. 3 j" |
| 4y 6m | 4 | "gem. 4 j", 6m discarded |

## Per-year stats

For each Year *k* (1 .. N), compute the same shape currently produced by `processData` for the rolling year:
- `afname`, `injectie`
- `afnamedag`, `afnamenacht`, `injectiedag`, `injectienacht`
- `effectivePrice` — computed **per year** from that year's day/night ratio (the user's `priceDay` / `priceNight` are constant across years; the ratio is what varies). When a year has zero `afname`, fall back to `priceDay`.
- For each selected config: `qualifyingDays`, `partialDays`, `chargedFull`, `chargedPartial`, `annualSavingFull`, `annualSavingPartial`, `annualSaving`, `recoveryPctFull`, `recoveryPctPartial`, `injPctFull`, `injPctPartial`. (Note: `annual*` here just means the year's value — no `scaleFactor` for these because each year is exactly 365 days by construction.)

For capacity analysis: per capacity step, count `qualDays` per year.

**"Afgelopen jaar"** = Year 1 stats, identical formulas to today.

**"Gem. N j"** = arithmetic mean across all N year-stats. For derived metrics, compute **from** the averages, not as the mean of yearly derivatives:
- `avgPayback = installPrice / avgAnnualSaving`
- `avgRecoveryPctFull = avgChargedFull / avgAfname × 100`
- `avgInjPctFull = (avgChargedFull / eff) / avgInjectie × 100`
- (analogous for `Partial`)

This matches the way the single-year tool already computes these and is mathematically cleaner than averaging ratios.

## UI changes

All changes are gated on `N > 1`. When `N === 1`, no new UI element appears.

**Numeric pattern.** On every line that gets an average companion: the current-year value renders as today; immediately to its right (smaller, lighter weight, `var(--muted)` color) `· gem. N j: <value>`.

### 1. Period alert (top of Resultaten)

Append one sentence after the existing rollend-jaar text: *"Gemiddelde berekend over N volledige jaren (DD/MM/YYYY – DD/MM/YYYY)."* Date range = start of Year N to `lastDate`.

### 2. Overzicht meetpunt

Add the avg companion to: *Totale afname (periode)*, *Totale injectie (periode)*, *Afname dag*, *Afname nacht*, *Injectie dag*, *Injectie nacht*, *Gem. afname per dag*, *Gem. injectie per dag*. Metadata rows (EAN, Meternummer, Metertype, Volledige CSV periode, Totaal dagen in CSV, Berekeningsperiode, Van–tot) remain unchanged.

### 3. Scenario-kaarten per config

Every numeric `stat-row` gets the avg companion **except**:
- "Min. dagelijkse injectie nodig" (depends on config formula only)
- "Installatieprijs" (constant)

The big *Totale jaarlijkse besparing* and *Terugverdientijd* rows render the avg on a second visible line below the headline value (same color hierarchy, smaller font), e.g.:

```
Totale jaarlijkse besparing    € 612,40 / jaar
                               gem. 3 j: € 588,10 / jaar
```

### 4. Progress bars in scenario cards

Two bars per card (recovery vs afname, recovery vs injectie). Each bar today is a stacked `full + partial` segment on a 0–100% scale. New behavior:

- Stack segments still represent **Year 1** (afgelopen jaar) values.
- `▼` marker positioned absolutely above the bar at the avg position.
- Marker color: `var(--muted)` so it reads as "secondary info".
- A small label below the legend row: `gem. 3 j: 42,7%`.
- Bar visual scale: scenario-card bars are already on a 0–100% scale (`width: pct%`), so the marker — also positioned at `left: avgPct%` — naturally fits within the existing visible range. No rescaling is needed for these bars. If `avgPct > 100` (mathematically possible for recovery vs injectie when the battery rounds to slight > 100%), the marker pins to the 100% edge and the inline label still shows the true number.

### 5. Capaciteitsanalyse-tabel

Becomes three columns: *Capaciteit (kWh)* | *Volle laaddagen (afgelopen jaar)* | *Gem. N j*. The MAX flag (≥ 100 days) stays driven by the afgelopen-jaar column — the recommendation does not change because of the average. The avg column is informational only.

When `N === 1`, table stays two-column as today.

### 6. Maandoverzicht-tabel

Numeric columns remain Year-1 values (no inline avg, would be too dense). The *Injectie visueel* bar gets a `▼` marker at the per-month avg position.

- Per-month avg = mean injection of that calendar month across the N year-blocks. E.g., for January 2026 with N=3: average of January 2026, January 2025, January 2024.
- Bar scale: `maxInj = max over all months of max(monthInjectie, monthAvgInjectie)`. So if some month has avg > current, the entire row group rescales consistently.

When `N === 1`, table is unchanged.

## Code organization

All edits in `index.html`. New helpers (placed near the existing `processData` for proximity to where they're used):

- `computePerYearStats(allDays, configs, lastDate, priceDay, priceNight) → { N, perYear: [yearStats × N], yearsStart: Date }`
  - Slices `allDays` into N year-blocks counting backward from `lastDate`.
  - For each block, runs the same aggregation `processData` does today (re-use code by extracting the inner aggregation into a helper if cleaner, but a localized reimplementation is acceptable if extraction would touch too much surrounding code).
- `averageStats(perYearStats) → avgStats`
  - Returns the same shape as one element of `perYearStats`.
  - For derived metrics, computes from averaged inputs (see "Per-year stats" above).
- `renderWithAvg(currentValue, avgValue, formatter, numYears) → string`
  - Returns either `formatter(currentValue)` (when `numYears === 1` or `avgValue == null`) or `formatter(currentValue) + ' · <span class="muted-inline">gem. ' + numYears + ' j: ' + formatter(avgValue) + '</span>'`.
  - Used everywhere the `· gem. N j: …` pattern appears.
- One CSS class `.bar-marker` (positioned absolutely, `▼` rendered via Unicode or CSS triangle, color `var(--muted)`), shared between scenario and monthly bars.
- One CSS class `.muted-inline` for the inline `· gem. N j: …` snippet.

`processData` is extended to call `computePerYearStats`, then call `averageStats`, then store both on the result object passed to `renderResults`. `renderResults` is updated section-by-section using `renderWithAvg` and the new bar-marker class.

`monthMap` gets a new field per month: `avgInjectie` (mean across the same calendar month in N year-blocks).

`capAnalysis.rows[i]` gets a new field `qualDaysPerYear` (array of N) plus a derived `avgQualDays`.

## Save/share state

Bump `_serializeState` version `v: 2 → v: 3`. The save state is for **rendering**, not recomputation, so we save only what the renderer needs — not the full per-year breakdown. New fields on `r`:

- `numYears: N`
- `yearsStart: 'YYYY-MM-DD'` (used by the period alert text)
- `avg`: an object with the same shape as the existing top-level rolling-year stats but holding the multi-year averages. Keys mirror what `renderResults` already reads: `totalAfname`, `totalInjectie`, `totalAfnamedag`, `totalAfnamenacht`, `totalInjectiedag`, `totalInjectienacht`, plus per-config arrays parallel to `configResults` containing `qualifyingDays`, `partialDays`, `chargedFull`, `chargedPartial`, `annualSaving`, `recoveryPctFull/Partial`, `injPctFull/Partial`, `payback`.
- `monthMap[mk].avgInjectie` per month.
- `capAnalysis.rows[i].avgQualDays` per row.

`_applyLoadedState`:
- `state.v === 3`: read all new fields, render with avg.
- `state.v === 2`: set `numYears = 1`, ignore avg paths, render exactly like today (no console errors, no warning banner). Existing share links and downloaded JSONs continue to work without migration.
- `state.v === 1`: unchanged (already supported with degraded behavior).

## Edge cases

- `N === 1`: every new code path is a no-op. Visual parity with today is part of acceptance.
- `avgValue === currentValue`: marker still rendered (helpful signal that they coincide).
- `avgValue === 0`: marker at 0%.
- A year with `afname === 0`: `effectivePrice` for that year falls back to `priceDay`.
- Capacity row where Year-1 `qualDays < 100` but avg `≥ 100`: still no MAX flag (recommendation policy unchanged).
- A month with `monthAvgInjectie > monthInjectie` for one config but not all months: rescaling uses the per-month max across both values, computed once over all months, so the visual stays comparable across rows.

## Verification (manual, in a browser)

1. CSV with `< 1 year` → unchanged behavior, no avg UI.
2. CSV with **exactly 1 year** (or 1y +`<365d`) → unchanged behavior, no avg UI, console clean.
3. CSV with **exactly 2 years** → avg appears in: period alert, summary, scenario rows (incl. payback/saving), progress bars (`▼` marker visible), capacity table (3 columns), monthly bars. Numbers sanity-check: avg should equal `(Year1 + Year2) / 2` for raw totals.
4. CSV with **2y + 5m** → same as case 3; the leftover 5m must be invisible (avg is still over 2 years).
5. CSV with **3+ years** → "gem. 3 j" / "gem. 4 j" labels correct; avg matches manual `(Y1+Y2+…+YN)/N`.
6. Old v2 share link (generated before this change) → renders without avg UI, no console errors.
7. New v3 share link → round-trips: serialize, paste URL, page restores identically.
