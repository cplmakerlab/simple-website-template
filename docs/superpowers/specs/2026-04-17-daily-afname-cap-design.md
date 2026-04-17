# Daily afname cap on Worst Case + always-show both scenarios

**Date:** 2026-04-17
**Scope:** `index.html` only — `calcScenario` (single-year path), the `calc(threshold)` helper inside `computePerYearStats` (multi-year path), the scenario-card render loop in `renderResults`, the period/scenario alerts, the save-state version (`v: 3 → v: 4`).

## Problem

The current calculation accumulates `chargedFull += batCap × eff` for every day where injection meets the threshold, and turns that sum into savings via `chargedTotal × effectivePrice`. Nothing checks whether the household actually *consumed* enough that day to make use of the stored energy. For a small consumer with a large battery (e.g. holiday home, summer absence, light user with oversized install), this overstates savings — the salesperson is then comparing a real installation cost against an inflated yearly saving, producing a falsely short payback.

The same calc also currently shows two scenarios (Worst Case + Optimistisch) **only** when the PV inverter is stronger than the battery inverter. In every other case the customer sees one card called "Standaard" — which behaves exactly like today's Optimistic (no cap, no inflation). The customer has no way to see a conservative bound when there is no inverter mismatch.

## Goal

1. Make Worst Case the always-shown realistic floor: include both the existing PV-inverter threshold inflation (when `pvGtBat`) **and** a new per-day cap that limits each day's stored-and-used energy to the day's grid afname.
2. Make Optimistisch the always-shown ideal ceiling: existing behaviour (threshold = `batCap`, no cap), unchanged formula.
3. Remove the "Standaard" label entirely. Every scenario card the customer sees from now on is either Worst Case or Optimistisch. The customer always sees both per config.

The truth lies between the two; the salesperson presents the spread honestly.

## Non-goals

- Splitting `afname_dag` into morning vs evening to model when the battery actually discharges. Only daily aggregates are available; we accept the simplification that the battery can displace any of the day's afname.
- Changing `effectivePrice`. Both scenarios continue to multiply by the household-weighted day/night price. (We considered allocating the displaced energy night-first, then day-first; rejected as adding assumption complexity for marginal accuracy improvement.)
- Touching the capacity-analysis table or the monthly table — neither uses the cap.
- Migrating pre-cap saved JSONs to backfill an Optimistic scenario. Old v3 files render in degraded mode (Worst Case only when `!pvGtBat`); we don't recompute.

## Calculation

Both `calcScenario` (in `processData`, single-year path) and the inner `calc(threshold)` inside `computePerYearStats` (multi-year path) get the same change. They run twice per config — once with `useCap = true` for the Worst Case, once with `useCap = false` for the Optimistic.

```
function calcScenarioOrPerYearVariant(threshold, batCap, eff, useCap):
  qualifyingDays = 0; partialDays = 0; chargedFull = 0; chargedPartial = 0
  for each day d in window:
    let dayCharged
    let bucket  // 'full' or 'partial' or null

    if d.injectie >= threshold:
      dayCharged = batCap * eff
      bucket = 'full'
    else if d.injectie > 0:
      dayCharged = (d.injectie / threshold) * batCap * eff
      bucket = 'partial'
    else:
      continue

    let dayUsable = useCap ? min(dayCharged, d.afname) : dayCharged

    if bucket == 'full':    qualifyingDays++; chargedFull    += dayUsable
    if bucket == 'partial': partialDays++;    chargedPartial += dayUsable
```

Notes:

- The `qualifyingDays` / `partialDays` counters keep their current meaning: number of days the battery would charge fully / partially based on injection alone. The cap does **not** change which bucket a day lands in (it would be misleading to label a day "non-qualifying" because the household used too little).
- All downstream metrics (`annualSaving*`, `payback`, `recoveryPct*`, `injPct*`) use `chargedFull` / `chargedPartial` after the cap, so they all naturally reflect the cap in the Worst Case scenario. Recovery percentages can no longer exceed 100% in the Worst Case (mathematically guaranteed by the cap).
- Same `effectivePrice` formula in both scenarios. No price-allocation change.

### Threshold table

For each config:

| Scenario     | Threshold                                              | `useCap` |
|---           |---                                                     |---       |
| Worst Case   | `pvGtBat ? batCap × (pvInv / batInv) : batCap`         | `true`   |
| Optimistisch | `batCap`                                               | `false`  |

When `pvInv ≤ batInv`, the two scenarios share the same threshold and differ only by the cap. When `pvInv > batInv`, they differ in both.

### Multi-year averaging

`computePerYearStats` already computes `scenWC` and `scenOpt` per year (the helper is duplicated logic from `calcScenario`). Both get the same `useCap` flag treatment. `averageStats` then averages each year's per-config scenario as today; no change to the averaging math.

## Render

### Scenario card render loop in `renderResults`

Today:
- If `pvGtBat`: render Worst Case card + Optimistic card.
- Else: render a single "Standaard" card (which calls `makeScenCard` with `'Standaard'` title and the Worst-Case-but-not-really data).

After the change:
- Always render two cards per config: Worst Case (`scenWC`) and Optimistisch (`scenOpt`). The "Standaard" path goes away — `makeScenCard` is called with the same `title='Worst Case' / badge='⚠️ Worst Case' / cssClass='worst-case'` regardless of `pvGtBat`, and the same `title='Optimistisch' / badge='✨ Optimistisch' / cssClass='optimistic'` for the second card.
- Each card already shows the avg companions (multi-year), the prominent rows, the Details disclosure (collapsed) and the two recovery progress bars — all unchanged.

### Scenario-sub text per card

Today's `subWC` line varies by `pvGtBat` only. After the change, it varies by `pvGtBat` because the threshold inflation only applies in that case, **and** always mentions the cap:

- **Worst Case sub-text:**
  - When `pvGtBat`: `ZP (X kW) > bat-omv. (Y kW) — laaddrempel ×Z. Verbruikscap toegepast (besparing begrensd door dagelijkse afname).`
  - When `!pvGtBat`: `Verbruikscap toegepast — besparing begrensd door dagelijkse afname.`
- **Optimistisch sub-text:**
  - When `pvGtBat`: `Zelfde installatie — aanname: batterij laadt volledig (drempel = X kWh) en wordt elke dag volledig verbruikt.`
  - When `!pvGtBat`: `Aanname: batterij laadt volledig en wordt elke dag volledig verbruikt.`

### Top alerts (above the scenario grid)

Today there are two pieces:
- The "scenario alert" that says either ✅ "ZP-omvormer ≤ batterijomvormer voor alle geselecteerde configuraties" or ⚠️ "ZP-omvormer is sterker bij ...".

Replace this single alert with two pieces, in this order:

1. **Always shown** (`alert alert-info`):

   > ℹ️ Voor elke configuratie tonen we twee scenario's: **Worst Case** (realistisch — met cap op dagelijkse afname) en **Optimistisch** (ideaal — geen beperking). De waarheid ligt ertussen.

2. **Conditional, only when at least one config has `pvGtBat`** (`alert alert-warning`):

   > ⚠️ ZP-omvormer (5 kW) is sterker dan de batterijomvormer bij: Config 1 (3 kW), Config 3 (2.5 kW). Bij Worst Case wordt de drempel daarom hoger gezet voor deze configuraties.

The success alert ("✅ ZP-omvormer ≤ batterijomvormer voor alle geselecteerde configuraties") goes away — the always-shown info alert covers that case adequately.

## Save / share state

Bump `_serializeState` from `v: 3` to `v: 4`. The shape of `r` is identical to v3 (both `scenWC` and `scenOpt` already exist on `cr`, plus the avg fields). The version bump signals "scenarios are now always populated" so the renderer can rely on it.

`_applyLoadedState` accepts versions 1, 2, 3, and 4. For loaded v3 data:

- The renderer's new "always render both" path checks for `cr.scenOpt` truthy before rendering the Optimistic card. v3 files where `pvGtBat = false` have `scenOpt = null`, so they degrade to a single Worst-Case-but-with-no-cap-applied card (since the saved Worst Case in v3 doesn't have the cap). This is acceptable — old shared links remain viewable; new shares get the new behaviour.

For v3 (and earlier) loads, the new top-alert text still renders. The conditional inverter-mismatch line uses `cr.pvGtBat` which is preserved. The `alert alert-info` that mentions "Worst Case (met cap...)" is technically inaccurate for v3 data (cap not applied), but is a documentation issue not a functional one — old links don't get re-rendered with the new calc.

`_restoreState` is unchanged. No new fields to defensively rehydrate.

## Edge cases

- `useCap = true` and `dayAfname = 0` (typical: vacation, all loads off): `dayUsable = 0`. The day still increments `qualifyingDays` or `partialDays` (the battery *would have* charged — the bucket is determined by injection only) but contributes nothing to `chargedFull` / `chargedPartial`. This is the discrepancy the spec is designed to surface; expected behaviour.
- `useCap = true` and `dayAfname >> dayCharged` (typical normal household): `dayUsable = dayCharged`. WC equals Opt for that day. Across many such days, WC and Opt totals converge — telling the customer "for your profile the cap doesn't bite".
- `useCap = false` (Optimistic): identical to today's behaviour for that scenario. No regression in the Optimistic numbers.
- `pvGtBat = false` previously had only the "Standaard" card. After the change, the customer sees both WC and Opt. WC's threshold equals Opt's threshold; the *only* difference in the numbers is the cap. The two cards visually communicate "with realistic cap" vs "without realistic cap" — useful information that today's UI hides.
- Multi-year average: each year's WC has the cap applied per-year-day; averages of the per-year `chargedFull` / `chargedPartial` carry the cap correctly.
- Recovery percentages > 100% can no longer happen in Worst Case (cap guarantees `chargedX ≤ totalAfname`). Optimistic can still produce > 100% (already capped visually at 100% on the bar).

## Verification (manual, in a browser)

1. **Small consumer / large battery** dataset (any CSV where total injection ≫ total afname): WC headline numbers (Totale opgeslagen energie, Totale jaarlijkse besparing, Terugverdientijd) clearly worse than Opt; WC recuperatie t.o.v. afname stays well under 100%.
2. **Normal consumer with `pvInv ≤ batInv`:** Both WC and Opt cards render. Numbers are close (within a few %). WC sub-text reads "Verbruikscap toegepast — besparing begrensd door dagelijkse afname." Opt sub-text reads "Aanname: batterij laadt volledig en wordt elke dag volledig verbruikt."
3. **`pvInv > batInv`:** Both cards render. WC sub-text mentions both the threshold inflation AND the cap. Opt sub-text mentions the assumption with the explicit threshold.
4. **Always-shown info alert** appears at the top of every Resultaten section, regardless of `pvGtBat`. The conditional warning alert appears only when at least one config triggers `pvGtBat`.
5. **Multi-year (≥ 2 years) data:** Avg companions still render on every numeric row; both WC and Opt cards have their own averages.
6. **Old v3 share link:** loads without console errors, renders in degraded mode (Worst Case card only when `!pvGtBat`, no cap on the WC numbers because the saved data was pre-cap).
7. **New v4 share link:** round-trips, always two cards per config, cap applied to WC.
8. **Unit check:** open DevTools console after a calculation. `_saved.configResults[0].scenWC.chargedFull` should now be ≤ `_saved.totalAfname × scaleFactor` (cap upper bound). `_saved.configResults[0].scenOpt.chargedFull` is unchanged from today's calc.
