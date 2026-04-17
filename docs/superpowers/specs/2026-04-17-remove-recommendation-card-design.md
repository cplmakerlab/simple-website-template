# Remove "Aanbevolen configuratie" recommendation card

**Date:** 2026-04-17
**Scope:** `index.html` only

## Problem

When the user selects two or three product configurations, `renderResults` appends an "Aanbevolen configuratie" card at the bottom of the scenarios grid that picks the config with the lowest payback (`payback`) as the recommendation. The pick is purely terugverdientijd-driven, so it ignores other relevant factors (capacity headroom, brand fit, etc.) and creates friction with customers when the salesperson wants to recommend a different config than the one the tool labels "Aanbevolen".

## Goal

Remove the recommendation card and its supporting code so the results show only the per-configuration scenario cards. The user will compare configs themselves from the cards already on screen.

## Changes

All edits are in `index.html`.

### JS — `renderResults` (around lines 1147-1167)

Delete the block that:
- builds `bestCandidates` from `d.configResults`,
- selects `best` / `worst` via `reduce`,
- appends the `<div class="recommendation-card">…</div>` HTML to `gridHTML`.

This block is the only consumer of `bestCandidates`, `best`, and `worst`, so the variables disappear with it. No other code path references them.

### CSS — `<style>` (around lines 393-402)

Delete the `/* ── Recommendation card ─── */` block: the `.recommendation-card`, `.recommendation-card h3`, `.rec-row`, and `.rec-row:last-child` rules. Verify with grep that no other markup uses these classes before deleting.

### Out of scope

- Save/share state (`_serializeState` / `_applyLoadedState`): the recommendation card was derived at render time from `configResults` — it was never part of the saved state. No version bump needed; existing share links and JSON files keep working unchanged.
- Capacity analysis, monthly table, scenario cards, summary card, alerts: untouched.
- The `scenarios-grid` layout: untouched. Removing the trailing card just leaves the grid one row shorter when ≥ 2 configs are picked.

## Verification

Manual, in a browser:

1. Open `index.html` (directly or via `python3 -m http.server`).
2. Load a real Fluvius CSV.
3. Load product configs from the Google Sheet.
4. **One config selected** — calculate. Confirm the page renders normally; the recommendation card was never shown in this case, so nothing should look different.
5. **Two configs selected** — calculate. Confirm only the two scenario cards (or 2-4 cards if any config triggers worst-case + optimistic) are shown, with no recommendation card after them.
6. **Three configs selected** — same check.
7. Load a previously saved JSON (or a `?data=...` link) generated before this change. Confirm it still loads and renders without the recommendation card and without errors in the console.
8. Grep `index.html` after the edit for `recommendation-card`, `rec-row`, `bestCandidates`, `best.payback`, `worst.payback` — all should return zero matches.
