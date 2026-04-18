# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo actually is

A single-page **battery ROI calculator** for the Belgian solar/battery market ("SmartPeak — Batterij ROI Calculator"). UI and copy are in Dutch (`nl-BE`). The README is **leftover from the upstream `cplmakerlab/simple-website-template`** and does NOT describe this app — ignore it for context about the calculator.

The default branch is `gh-pages`; the site is published directly from it via GitHub Pages at `smartpeak-be/battery-roi-tool`. There is no build step, no package manager, no tests, no lint config.

## File layout — what's live vs. dead

- **`index.html`** — the calculator. Three modes:
  - bare (no query) — public, no login, calculator works as it always did
  - `?data=<b64>` — legacy share-link, public, no login (v:1-5 supported)
  - `?project=<id>` — Firebase-backed project mode: auth-gated (Kevin/Ruben whitelist), loads project from Firestore, shows project-banner with status chip, auto-saves `lastCalcRun` on every Bereken
- **`dashboard.html`** — login-gated landing for Kevin & Ruben. Lists all (non-deleted) projects sorted by `updatedAt` desc, status chips per row (clickable to change), `+ Nieuw project` form with optional CSV at creation, soft delete + restore.
- **`assets/js/csv.js`** — CSV parsing helpers (`parseCSV`, `parseDate`, `parsVolume`, `extractCsvForStorage`) used by both `index.html` and `dashboard.html`.
- **`assets/js/firebase-init.js`** — Firebase init (compat SDK 10.13.2 via CDN, no build step), auth helpers (Google sign-in + email whitelist), Firestore CRUD (`projects` collection), `PROJECT_STATUSES` enum + `getStatusMeta()`. Contains `FIREBASE_CONFIG_PLACEHOLDER` and `RUBEN_EMAIL_PLACEHOLDER` sentinels — must be replaced with real values before deploy. Config object is public-by-design (security rules enforce access).
- **`background.jpg`, `logo.jpg`** — assets referenced by the dead template, not by the calculator. Safe to leave alone.
- **`style.css`, `script.js`** — **dead code from the upstream template** (jQuery hash-based menu navigation). The calculator does not load them. Don't add app logic here; either edit `index.html` directly or extract into a new file and `<link>`/`<script src>` it from `index.html`.
- **`docs/superpowers/specs/`, `docs/superpowers/plans/`** — design specs and implementation plans for past feature work, kept for traceability. Read the spec when touching a feature it covers; the plan documents the exact edits already made.

## How to work on it

- **Run locally:** open `index.html` directly in a browser, or `python3 -m http.server` from the repo root and visit `http://localhost:8000`. A local server is needed if you want the URL `?data=...` share-link flow to behave like production.
- **Deploy:** push to `gh-pages`. GitHub Pages serves the file as-is; allow ~1 min for the CDN to refresh. The `gh` CLI is configured for the `Blox-It` GitHub account; `git push origin gh-pages` works directly without further auth setup.
- **No tests exist.** Verify changes by loading the page, uploading a real Fluvius CSV, and walking the full flow (load configs → calculate → check results, share link, JSON save/load).

## Architecture (the parts that span multiple sections)

**Data pipeline** (all inside `index.html`):
1. `parseCSV` — Fluvius export is **semicolon-separated**, dates are `dd-mm-yyyy`, decimals use `,` (handled by `parsVolume`).
2. `processData` aggregates per-day from rows keyed by `EAN-code` / `Register` (`afname`/`injectie`, optional `dag`/`nacht` split for dual-tariff users). Each per-day record has `afname`, `injectie`, `afnamedag`, `afnamenacht`, `injectiedag`, `injectienacht` (in kWh).
3. A **rolling 365-day window** ending on the last CSV date is the canonical period. If less than a year of data, results are **extrapolated** via `scaleFactor = 365 / daysInWindow` and `isFullYear = false` triggers warning UI.
4. **Multi-year averaging:** when ≥ 2 complete 365-day blocks of data exist, `computePerYearStats` slices `allDays` into N year-blocks counting backward from `lastDate` and `averageStats` produces an avg-across-N-years counterpart for every numeric field. The renderer shows a `· gem. N j: …` companion (via the `renderWithAvg` helper) and a `▼` marker on progress bars at the avg position. All gated on `numYears >= 2`; the < 2-year UI is byte-identical to the single-year case.
5. **Per-config scenarios — always two cards.** For every config the renderer emits both Worst Case (`scenWC`) and Optimistisch (`scenOpt`):
   - **Worst Case** uses the `useCap=true` path in `calcScenario` / inner `calc`: each day's stored energy is capped at that day's `d.afname` (`Math.min(dayCharged, d.afname)`) so battery savings can never exceed actual grid consumption that day. When `pvInverter > batteryInverter`, the daily-injection threshold is also scaled up by `pvInv / batInv` (battery can't fully charge in a single day at low irradiance).
   - **Optimistisch** uses `useCap=false` and the unscaled threshold — the ideal-world ceiling.
   - The truth lies between the two; the salesperson presents the spread.
6. Capacity analysis (`capAnalysis`) sweeps 2.5→200 kWh in 2.5 kWh steps and reports the largest capacity that still has ≥100 fully-charged days/year — used as the "max sensible capacity" recommendation. The MAX flag is always driven by Year 1 (afgelopen jaar), not the multi-year average.

**Product config source** — `loadConfigs()` fetches a Google Sheet as CSV from a hard-coded URL (`SHEET_CSV_URL` around line 769, gid `425908603`). Each row defines a product (`type`, capacity, inverter kW, efficiency, and four price columns keyed by `BTW%_keuring`: `6_no`, `6_yes`, `21_no`, `21_yes`). If the sheet schema changes (column names or price keys), `_parseSheetConfigs` and `_getPriceKey` must be updated together.

**Save / share state** — same v:5 mechanism powers BOTH the legacy `?data=<b64>` share-links AND the Firestore project-mode storage. In project-mode, `csvUpload.dailyCompact` lives at the top level of the project doc (not inside `results`) to avoid duplicating per-day arrays. The restore-path in `index.html` (`buildSavedFromProject`) reassembles a v:5-shaped object from the project document so the existing `_applyLoadedState` flow can hydrate the UI unchanged. `_serializeState` produces a versioned (`v: 5`) JSON of inputs + computed results (NOT the raw CSV). v:5 adds a `dailyCompact` field (6 parallel arrays — `afname`, `injectie`, `afnamedag`, `afnamenacht`, `injectiedag`, `injectienacht` — plus a `startDate`) so per-day data is preserved across share-links — needed by the energy chart's Dag-view. `copyShareLink` base64-encodes it into `?data=...`; `downloadSave` writes it as a JSON file. `_applyLoadedState` accepts `v: 1, 2, 3, 4, 5` and degrades older versions gracefully (e.g. v:1-4 saves have no per-day data → the energy chart's Dag-view is disabled with a tooltip and Jaar/Maand are derived from `monthMap`). **When you change the shape of `_saved`/`renderResults` input**, bump the version and handle the old version in `_applyLoadedState`, or shared links and downloaded JSONs from before will silently break.

**Rendering** — `renderResults` is the single render entry point used by both fresh calculations and restored saved state; keep it pure with respect to `d` so both paths produce identical UI. The scenario card (`makeScenCard`) shows four headline rows + a closed-by-default `<details class="scen-details">` disclosure containing the 7 breakdown rows + two recovery progress bars at the bottom (each with a `▼` avg marker when `numYears >= 2`).
