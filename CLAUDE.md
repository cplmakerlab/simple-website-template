# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo actually is

A single-page **battery ROI calculator** for the Belgian solar/battery market ("SmartPeak — Batterij ROI Calculator"). UI and copy are in Dutch (`nl-BE`). The README is **leftover from the upstream `cplmakerlab/simple-website-template`** and does NOT describe this app — ignore it for context about the calculator.

The default branch is `gh-pages`; the site is published directly from it via GitHub Pages at `smartpeak-be/battery-roi-tool`. There is no build step, no package manager, no tests, no lint config.

## File layout — what's live vs. dead

- **`index.html`** (~1280 lines) — the entire app: embedded CSS in `<style>`, the form/results markup, and all JS in a single `<script>` block at the bottom. Edit this file for any feature work.
- **`background.jpg`, `logo.jpg`** — assets referenced by the dead template, not by the calculator. Safe to leave alone.
- **`style.css`, `script.js`** — **dead code from the upstream template** (jQuery hash-based menu navigation). The calculator does not load them. Don't add app logic here; either edit `index.html` directly or extract into a new file and `<link>`/`<script src>` it from `index.html`.

## How to work on it

- **Run locally:** open `index.html` directly in a browser, or `python3 -m http.server` from the repo root and visit `http://localhost:8000`. A local server is needed if you want the URL `?data=...` share-link flow to behave like production.
- **Deploy:** push to `gh-pages`. GitHub Pages serves the file as-is; allow ~1 min for the CDN to refresh.
- **No tests exist.** Verify changes by loading the page, uploading a real Fluvius CSV, and walking the full flow (load configs → calculate → check results, share link, JSON save/load).

## Architecture (the parts that span multiple sections)

**Data pipeline** (all inside `index.html`):
1. `parseCSV` — Fluvius export is **semicolon-separated**, dates are `dd-mm-yyyy`, decimals use `,` (handled by `parsVolume`).
2. `processData` aggregates per-day from rows keyed by `EAN-code` / `Register` (`afname`/`injectie`, optional `dag`/`nacht` split for dual-tariff users).
3. A **rolling 365-day window** ending on the last CSV date is the canonical period. If less than a year of data, results are **extrapolated** via `scaleFactor = 365 / daysInWindow` and `isFullYear = false` triggers warning UI.
4. Per-config scenarios: when `pvInverter > battery inverter`, the daily injection threshold to fully charge is scaled up by `pvInv / batInv` ("worst case"), and a second "optimistic" scenario is also computed at the unscaled threshold. Otherwise only one scenario is shown.
5. Capacity analysis (`capAnalysis`) sweeps 2.5→200 kWh in 2.5 kWh steps and reports the largest capacity that still has ≥100 fully-charged days/year — used as the "max sensible capacity" recommendation.

**Product config source** — `loadConfigs()` fetches a Google Sheet as CSV from a hard-coded URL (`SHEET_CSV_URL` near line 712, gid `425908603`). Each row defines a product (`type`, capacity, inverter kW, efficiency, and four price columns keyed by `BTW%_keuring`: `6_no`, `6_yes`, `21_no`, `21_yes`). If the sheet schema changes (column names or price keys), `_parseSheetConfigs` and `_getPriceKey` must be updated together.

**Save / share state** — `_serializeState` produces a versioned (`v: 2`) JSON of inputs + computed results (NOT the raw CSV). `copyShareLink` base64-encodes it into `?data=...`; `downloadSave` writes it as a JSON file. `_applyLoadedState` restores it on page load via the `DOMContentLoaded` handler. **When you change the shape of `_saved`/`renderResults` input**, bump the version and handle the old version in `_applyLoadedState`, or shared links and downloaded JSONs from before will silently break.

**Rendering** — `renderResults` is the single render entry point used by both fresh calculations and restored saved state; keep it pure with respect to `d` so both paths produce identical UI.
