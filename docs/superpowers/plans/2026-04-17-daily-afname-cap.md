# Daily Afname Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Worst Case the universally-shown realistic floor (always cap each day's stored energy at that day's grid afname), make Optimistisch the universally-shown ideal ceiling (no cap), and remove the "Standaard" label entirely so every config now shows two cards side-by-side.

**Architecture:** Three coupled-but-independently-committable changes in `index.html`. (1) Calc layer: add a `useCap` parameter to both `calcScenario` (single-year) and the inner `calc(threshold)` of `computePerYearStats` (multi-year), and call them with `useCap=true` for WC and `useCap=false` for Opt; always populate both scenarios per config. (2) Render layer: drop the "Standaard" path so the scenario-card render loop always emits two cards, with new sub-text for both, plus restructured top alerts (always-shown info + conditional inverter-mismatch warning). (3) Save state: bump `v: 3 → v: 4` to signal the new always-both-scenarios contract; v3 backwards-compat via a defensive `scenOpt` truthy check in the renderer.

**Tech Stack:** Plain HTML / CSS / vanilla JS in a single static file. No build, no test framework — verification = grep + DevTools console + manual browser smoke.

**Spec:** `docs/superpowers/specs/2026-04-17-daily-afname-cap-design.md` — read it before starting.

---

## File map

- **Modify:** `index.html` only.
- Three commits, one per task.

## Working directory

`/home/ubuntu/battery-roi-tool`. Work directly on `gh-pages` (user explicitly chose this for this repo). Each task ends with its own commit. Push is the user's call; the implementer does not push.

## Notes for the implementer

- UI text is in Dutch — do not translate.
- The cap field on each day is `d.afname` (set in `processData`'s dayMap aggregation as the sum of all afname-related Volume rows for that date — equivalent to `afnamedag + afnamenacht` for dual-tariff users, equal to a single afname value for single-tariff users).
- The current code has TWO functions doing the per-config scenario calc: `calcScenario` in `processData` (~line 1064, single-year path) and a function-scoped `calc(threshold)` inside `computePerYearStats` (~line 916, multi-year path). Both must change identically. There is no shared helper; do not extract one for this task.
- `scenWCAvg` / `scenOptAvg` are attached to each `cr` (`configResult`) inside `processData` after `averageStats` runs; that wiring is unchanged by this plan.
- After Task 1 completes, the calc has changed but the renderer still gates on `pvGtBat` for whether to show the Optimistic card. Net visible effect after Task 1 only: `!pvGtBat` cards (currently labeled "Standaard") show capped numbers (lower than today). That intermediate state is acceptable; Task 2 cleans up the labeling.

---

### Task 1: Add `useCap` parameter to both calc functions; always compute both scenarios

**Files:**
- Modify: `index.html` — `calcScenario` (~lines 1064-1093), the `configResults` map immediately after it (~lines 1095-1102), and the `calc(threshold)` + scenarios map inside `computePerYearStats` (~lines 912-938).

After this task: each config's `scenWC` reflects the cap; each config's `scenOpt` is always populated (not gated on `pvGtBat`); the `scenWCAvg` / `scenOptAvg` wiring downstream still works unchanged because `averageStats` already iterates per-config and per-scenario.

- [ ] **Step 1: Refactor `calcScenario` to accept a `useCap` parameter**

Use Edit to replace this exact `old_string`:

```
  function calcScenario(threshold, installPrice, batCap, eff) {
    let qualifyingDays = 0, partialDays = 0, chargedFull = 0, chargedPartial = 0;
    for (const d of windowDays) {
      if (d.injectie >= threshold) {
        qualifyingDays++;
        chargedFull += batCap * eff;
      } else if (d.injectie > 0) {
        partialDays++;
        chargedPartial += (d.injectie / threshold) * batCap * eff;
      }
    }
```

with this `new_string`:

```
  function calcScenario(threshold, installPrice, batCap, eff, useCap) {
    let qualifyingDays = 0, partialDays = 0, chargedFull = 0, chargedPartial = 0;
    for (const d of windowDays) {
      let dayCharged = 0, isFull = false, isPartial = false;
      if (d.injectie >= threshold) {
        isFull = true;
        dayCharged = batCap * eff;
      } else if (d.injectie > 0) {
        isPartial = true;
        dayCharged = (d.injectie / threshold) * batCap * eff;
      } else {
        continue;
      }
      const dayUsable = useCap ? Math.min(dayCharged, d.afname) : dayCharged;
      if (isFull)    { qualifyingDays++; chargedFull    += dayUsable; }
      else            { partialDays++;    chargedPartial += dayUsable; }
    }
```

The downstream lines (`annualChargedFull = chargedFull * scaleFactor;` and so on through the `return { … }`) are unchanged. The cap touches what gets accumulated into `chargedFull` / `chargedPartial`; everything that consumes those values keeps the same formulas.

- [ ] **Step 2: Update the single-year configResults call sites to pass `useCap` and always populate `scenOpt`**

Use Edit to replace this exact `old_string`:

```
  const configResults = selectedConfigs.map(cfg => {
    const pvGtBat    = pvInv > cfg.batInv;
    const thresholdWC  = pvGtBat ? cfg.batCap * (pvInv / cfg.batInv) : cfg.batCap;
    const thresholdOpt = cfg.batCap;
    const scenWC  = calcScenario(thresholdWC,  cfg.price, cfg.batCap, cfg.eff);
    const scenOpt = pvGtBat ? calcScenario(thresholdOpt, cfg.price, cfg.batCap, cfg.eff) : null;
    return { cfg, pvGtBat, thresholdWC, thresholdOpt, scenWC, scenOpt };
  });
```

with this `new_string`:

```
  const configResults = selectedConfigs.map(cfg => {
    const pvGtBat    = pvInv > cfg.batInv;
    const thresholdWC  = pvGtBat ? cfg.batCap * (pvInv / cfg.batInv) : cfg.batCap;
    const thresholdOpt = cfg.batCap;
    const scenWC  = calcScenario(thresholdWC,  cfg.price, cfg.batCap, cfg.eff, true);
    const scenOpt = calcScenario(thresholdOpt, cfg.price, cfg.batCap, cfg.eff, false);
    return { cfg, pvGtBat, thresholdWC, thresholdOpt, scenWC, scenOpt };
  });
```

`scenOpt` is now always a real scenario object (never `null`), regardless of `pvGtBat`. The `pvGtBat` field stays on `cr` because the renderer (Task 2) still uses it to decide WC sub-text wording and which configs appear in the inverter-mismatch warning alert.

- [ ] **Step 3: Refactor the multi-year `calc(threshold)` to accept `useCap` and always populate both scenarios**

Use Edit to replace this exact `old_string`:

```
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
```

with this `new_string`:

```
    const scenarios = selectedConfigs.map(cfg => {
      const pvGtBat     = pvInv > cfg.batInv;
      const thresholdWC = pvGtBat ? cfg.batCap * (pvInv / cfg.batInv) : cfg.batCap;
      const thresholdOpt= cfg.batCap;
      function calc(threshold, useCap) {
        let qualifyingDays = 0, partialDays = 0, chargedFull = 0, chargedPartial = 0;
        for (const d of days) {
          let dayCharged = 0, isFull = false, isPartial = false;
          if (d.injectie >= threshold) { isFull = true; dayCharged = cfg.batCap * cfg.eff; }
          else if (d.injectie > 0)     { isPartial = true; dayCharged = (d.injectie / threshold) * cfg.batCap * cfg.eff; }
          else { continue; }
          const dayUsable = useCap ? Math.min(dayCharged, d.afname) : dayCharged;
          if (isFull)    { qualifyingDays++; chargedFull    += dayUsable; }
          else            { partialDays++;    chargedPartial += dayUsable; }
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
      return { scenWC: calc(thresholdWC, true), scenOpt: calc(thresholdOpt, false) };
    });
```

`scenOpt` is now always a real scenario object in the per-year stats too, mirroring Step 2.

- [ ] **Step 4: Verify**

Run:
```bash
grep -n "function calcScenario(threshold, installPrice, batCap, eff, useCap)" /home/ubuntu/battery-roi-tool/index.html
grep -n "function calc(threshold, useCap)" /home/ubuntu/battery-roi-tool/index.html
grep -nE "useCap \? Math\.min\(dayCharged, d\.afname\) : dayCharged" /home/ubuntu/battery-roi-tool/index.html
grep -n "calcScenario(thresholdWC,  cfg.price, cfg.batCap, cfg.eff, true)" /home/ubuntu/battery-roi-tool/index.html
grep -n "calcScenario(thresholdOpt, cfg.price, cfg.batCap, cfg.eff, false)" /home/ubuntu/battery-roi-tool/index.html
grep -n "scenWC: calc(thresholdWC, true), scenOpt: calc(thresholdOpt, false)" /home/ubuntu/battery-roi-tool/index.html
```

Expected: 1 hit each (6 hits total). The `useCap ? Math.min(...)` pattern appears in BOTH `calcScenario` and the inner `calc` — count is 2 for that grep.

```bash
grep -nE "scenOpt = pvGtBat \? calcScenario|scenOpt: pvGtBat \? calc" /home/ubuntu/battery-roi-tool/index.html
```
Expected: zero hits — the gated forms are gone.

**Browser-based verification is deferred** — the user will do it. For optional sanity, you could open `index.html` in a browser, run a calculation with a sample CSV, and inspect `_saved.configResults[0].scenWC.chargedFull` vs `_saved.configResults[0].scenOpt.chargedFull` in the DevTools console; WC must be ≤ Opt. Skip if you can't run a browser.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Cap daily charged at daily afname in Worst Case scenario

Both calcScenario (single year) and the inner calc (multi-year)
gain a useCap parameter. When useCap=true, each day's stored
energy is capped at that day's grid consumption — preventing the
overestimation that occurred for small consumers with large
batteries (vacation home, summer-absent households).

Both scenWC (useCap=true) and scenOpt (useCap=false) are now
computed for every config regardless of pvGtBat. The renderer
still gates rendering on pvGtBat for now (Task 2 will lift that
gate).

Spec: docs/superpowers/specs/2026-04-17-daily-afname-cap-design.md
EOF
)"
```

---

### Task 2: Always render two scenario cards per config; new sub-text and top alerts

**Files:**
- Modify: `index.html` — the scenario alert block (~lines 1209-1221) and the scenario-card render loop (~lines 1389-1417), both inside `renderResults`.

After this task: every config shows two cards (Worst Case + Optimistisch) regardless of `pvGtBat`. The "Standaard" label/badge/cssClass disappears entirely. New sub-text on both cards. New top alerts.

- [ ] **Step 1: Replace the scenario alert block**

Use Edit to replace this exact `old_string`:

```
  // Scenario alert: summarise pvGtBat status per config
  const anyPvGtBat = d.configResults.some(cr => cr.pvGtBat);
  let scenAlert = '';
  if (anyPvGtBat) {
    const names = d.configResults
      .map((cr, idx) => cr.pvGtBat ? `Config ${idx+1} (${cr.cfg.batInv} kW)` : null)
      .filter(Boolean).join(', ');
    scenAlert = `<div class="alert alert-warning">⚡ <div><strong>ZP-omvormer (${d.pvInv} kW) is sterker dan de batterijomvormer bij: ${names}.</strong><br>
      Voor deze configuraties wordt zowel een <strong style="color:var(--warning)">worst-case</strong> als een <strong style="color:var(--primary)">optimistisch</strong> scenario getoond.</div></div>`;
  } else {
    scenAlert = `<div class="alert alert-success">✅ <div>ZP-omvormer (${d.pvInv} kW) ≤ batterijomvormer voor alle geselecteerde configuraties. Geen laadbeperking.</div></div>`;
  }
  document.getElementById('scenarioAlert').innerHTML = scenAlert;
```

with this `new_string`:

```
  // Scenario alert: always-shown explanation + optional inverter-mismatch warning
  let scenAlert = `<div class="alert alert-info">ℹ️ <div>Voor elke configuratie tonen we twee scenario's: <strong>Worst Case</strong> (realistisch — met cap op dagelijkse afname) en <strong>Optimistisch</strong> (ideaal — geen beperking). De waarheid ligt ertussen.</div></div>`;
  const anyPvGtBat = d.configResults.some(cr => cr.pvGtBat);
  if (anyPvGtBat) {
    const names = d.configResults
      .map((cr, idx) => cr.pvGtBat ? `Config ${idx+1} (${fmt2(cr.cfg.batInv)} kW)` : null)
      .filter(Boolean).join(', ');
    scenAlert += `<div class="alert alert-warning">⚠️ <div>ZP-omvormer (${d.pvInv} kW) is sterker dan de batterijomvormer bij: ${names}. Bij Worst Case wordt de drempel daarom hoger gezet voor deze configuraties.</div></div>`;
  }
  document.getElementById('scenarioAlert').innerHTML = scenAlert;
```

The success-style "✅ ZP-omvormer ≤ batterijomvormer" alert goes away — the always-shown info alert covers that case.

- [ ] **Step 2: Replace the scenario-card render loop**

Use Edit to replace this exact `old_string`:

```
  // Build grid HTML: one group header per config + 1-2 scenario cards
  let gridHTML = '';
  d.configResults.forEach((cr, idx) => {
    const { cfg, pvGtBat, scenWC, scenOpt } = cr;
    gridHTML += `<div style="grid-column:1/-1;">
      <div class="config-group-header">
        🔋 Configuratie ${idx+1}
        <span class="cfg-sub">${cfg.type} — ${cfg.omschrijving}</span>
        <span class="config-specs-badge">${fmt2(cfg.batCap)} kWh &nbsp;·&nbsp; ${fmt2(cfg.batInv)} kW omv. &nbsp;·&nbsp; ${Math.round(cfg.eff*100)}% eff &nbsp;·&nbsp; ${fmtEur(cfg.price)}</span>
      </div>
    </div>`;
    const subWC = pvGtBat
      ? `ZP (${d.pvInv} kW) > bat-omv. (${fmt2(cfg.batInv)} kW) — laaddrempel ×${fmt2(d.pvInv/cfg.batInv)}`
      : `ZP (${d.pvInv} kW) ≤ bat-omv. (${fmt2(cfg.batInv)} kW) — geen laadbeperking`;
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
  });
```

with this `new_string`:

```
  // Build grid HTML: one group header per config + always two scenario cards (WC + Opt)
  let gridHTML = '';
  d.configResults.forEach((cr, idx) => {
    const { cfg, pvGtBat, scenWC, scenOpt } = cr;
    gridHTML += `<div style="grid-column:1/-1;">
      <div class="config-group-header">
        🔋 Configuratie ${idx+1}
        <span class="cfg-sub">${cfg.type} — ${cfg.omschrijving}</span>
        <span class="config-specs-badge">${fmt2(cfg.batCap)} kWh &nbsp;·&nbsp; ${fmt2(cfg.batInv)} kW omv. &nbsp;·&nbsp; ${Math.round(cfg.eff*100)}% eff &nbsp;·&nbsp; ${fmtEur(cfg.price)}</span>
      </div>
    </div>`;
    const subWC = pvGtBat
      ? `ZP (${d.pvInv} kW) > bat-omv. (${fmt2(cfg.batInv)} kW) — laaddrempel ×${fmt2(d.pvInv/cfg.batInv)}. Verbruikscap toegepast (besparing begrensd door dagelijkse afname).`
      : `Verbruikscap toegepast — besparing begrensd door dagelijkse afname.`;
    gridHTML += makeScenCard(
      'Worst Case', '⚠️ Worst Case', 'badge-orange', 'worst-case',
      scenWC, cfg.price, subWC, 'orange',
      cr.scenWCAvg
    );
    if (scenOpt) {
      const subOpt = pvGtBat
        ? `Zelfde installatie — aanname: batterij laadt volledig (drempel = ${fmt2(cfg.batCap)} kWh) en wordt elke dag volledig verbruikt.`
        : `Aanname: batterij laadt volledig en wordt elke dag volledig verbruikt.`;
      gridHTML += makeScenCard(
        'Optimistisch', '✨ Optimistisch', 'badge-blue', 'optimistic',
        scenOpt, cfg.price, subOpt, 'blue',
        cr.scenOptAvg
      );
    }
  });
```

The `if (scenOpt)` guard remains for v3 backwards compat: when loading an old v3 share link where `pvGtBat = false`, `scenOpt` is `null` and the Optimistic card is skipped (degraded mode — single card). For new v4 data, `scenOpt` is always populated (Task 1) so both cards always render.

- [ ] **Step 3: Verify**

Run:
```bash
grep -n "Voor elke configuratie tonen we twee scenario's" /home/ubuntu/battery-roi-tool/index.html
grep -n "Bij Worst Case wordt de drempel daarom hoger gezet" /home/ubuntu/battery-roi-tool/index.html
grep -n "Verbruikscap toegepast" /home/ubuntu/battery-roi-tool/index.html
grep -n "wordt elke dag volledig verbruikt" /home/ubuntu/battery-roi-tool/index.html
```
Expected: 1 hit each for the alert messages (lines 1+2), and 2 hits each for the sub-text patterns (one in pvGtBat branch, one in `else` branch — that's 2 hits for "Verbruikscap toegepast", 2 hits for "wordt elke dag volledig verbruikt").

```bash
grep -nE "'Standaard'|✅ Standaard|badge-orange' : 'badge-blue'" /home/ubuntu/battery-roi-tool/index.html
```
Expected: zero hits. The "Standaard" label and the conditional badge selection are gone.

```bash
grep -n "if (scenOpt)" /home/ubuntu/battery-roi-tool/index.html
```
Expected: 1 hit (the v3 backwards-compat guard).

```bash
grep -n "alert alert-success.*ZP-omvormer" /home/ubuntu/battery-roi-tool/index.html
```
Expected: zero hits. The success-style ZP alert is gone.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Always render Worst Case + Optimistisch per config; new alert + sub-text

Drops the conditional "Standaard" path. Every config now shows two
scenario cards regardless of pvGtBat: Worst Case (cap applied) and
Optimistisch (no cap). New top alerts: an always-shown info line
explaining the two-scenario model, plus a conditional warning when
at least one config has the inverter-mismatch threshold inflation.
Sub-text on each card explains the source(s) of conservatism /
optimism.

The "if (scenOpt)" guard around the Optimistic card stays as v3
backwards-compat for old share links where scenOpt was null.

Spec: docs/superpowers/specs/2026-04-17-daily-afname-cap-design.md
EOF
)"
```

---

### Task 3: Bump save state v3 → v4

**Files:**
- Modify: `index.html` — `_serializeState` (~lines 636-670) and `_applyLoadedState` (~lines 740-757).

After this task: new shares write `v: 4`. Old v3, v2, v1 still load (v3 in degraded "no-Opt-when-!pvGtBat" mode, as designed in Task 2's render-loop guard). No new fields on `r`; this is a pure version bump signaling the new always-both-scenarios contract.

- [ ] **Step 1: Bump `_serializeState` to v4**

Use Edit to replace this exact `old_string`:

```
function _serializeState() {
  if (!_saved) return null;
  const d = _saved;
  return {
    v: 3,
    form: {
```

with this `new_string`:

```
function _serializeState() {
  if (!_saved) return null;
  const d = _saved;
  return {
    v: 4,
    form: {
```

- [ ] **Step 2: Accept v4 in `_applyLoadedState`**

Locate the version guard and the configs-load conditional. Use Edit to replace this exact `old_string`:

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

with this `new_string`:

```
function _applyLoadedState(state, showBanner) {
  if (!state || (state.v !== 1 && state.v !== 2 && state.v !== 3 && state.v !== 4)) { alert('Onbekend of verouderd bestandsformaat.'); return; }
  const f = state.form || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val != null ? val : ''; };
  set('pvInverter',    f.pvInv);
  set('elecPrice',     f.priceDay);
  set('elecPriceNight',f.priceNight);
  if ((state.v === 2 || state.v === 3 || state.v === 4) && f.selectedConfigTypes && f.selectedConfigTypes.some(t => t)) {
    loadConfigs().then(() => _populateConfigSelects(f.selectedConfigTypes)).catch(() => {});
  }
```

`_restoreState` is NOT modified — no new fields are introduced in v4 (the shape is identical to v3). The version bump is purely a contract signal.

- [ ] **Step 3: Verify**

Run:
```bash
grep -n "v: 4" /home/ubuntu/battery-roi-tool/index.html
grep -n "state.v !== 4" /home/ubuntu/battery-roi-tool/index.html
grep -n "state.v === 2 || state.v === 3 || state.v === 4" /home/ubuntu/battery-roi-tool/index.html
```
Expected: 1 hit each (3 hits total).

```bash
grep -nE "v: 3," /home/ubuntu/battery-roi-tool/index.html
```
Expected: zero hits — the old version literal is gone.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Bump save/share state to v4 (always-both-scenarios contract)

Pure version bump — shape of r is identical to v3. The bump
signals to the renderer that scenOpt is guaranteed to be present
for all configs. Old v3/v2/v1 files keep loading; v3 files where
scenOpt was null (because pvGtBat=false at save time) degrade to
a single Worst-Case card via the renderer's defensive
"if (scenOpt)" guard added in the prior commit.

Spec: docs/superpowers/specs/2026-04-17-daily-afname-cap-design.md
EOF
)"
```

---

## Self-review (controller, before handing off)

**Spec coverage:**
- Spec § Calculation → Task 1 (both calc functions get `useCap`, both scenarios always populated).
- Spec § Threshold table → Task 1 step 2 + step 3 (call sites pass `useCap=true` for WC, `false` for Opt; thresholds unchanged).
- Spec § Multi-year averaging → Task 1 step 3 (multi-year `calc` gets the same treatment; `averageStats` is unchanged so per-config avg propagates naturally).
- Spec § Scenario card render loop → Task 2 step 2 (always-two-cards loop with `if (scenOpt)` v3 fallback).
- Spec § Scenario-sub text per card → Task 2 step 2 (new `subWC` and `subOpt` strings per pvGtBat).
- Spec § Top alerts → Task 2 step 1 (always-shown info + conditional warning).
- Spec § Save / share state → Task 3 (v3 → v4 bump, v3 backwards compat handled by Task 2's `if (scenOpt)` guard).
- Spec § Edge cases → all naturally handled by the calc + render changes; not separate tasks (cap=0 when afname=0 falls out of `Math.min(dayCharged, d.afname)`; recovery percentages > 100% can no longer occur in WC because `chargedX ≤ totalAfname`).
- Spec § Verification → step 3 of each task (grep) plus user-driven manual browser smoke test.

**Placeholder scan:** Every step has actual code or actual commands. No "TBD" / "implement later" / "handle edge cases" in any step.

**Type/name consistency:**
- `useCap` parameter name consistent across both calc functions (Task 1).
- `dayCharged` / `dayUsable` / `isFull` / `isPartial` local var names consistent across both calc bodies.
- `scenWC` / `scenOpt` / `cr.scenWCAvg` / `cr.scenOptAvg` field names unchanged from prior features (Task 2 reads them).
- `pvGtBat` field on each `cr` is preserved (Task 1 step 2: still in the returned object); Task 2 reads it for sub-text branching and for the conditional warning alert.
- `if (scenOpt)` guard introduced in Task 2 step 2 protects the renderer when loading v3 data; Task 3 step 1's bump to `v: 4` makes new files always have `scenOpt` populated, so the guard becomes a no-op for new data.
