# Product specs page (per selected configuration)

**Date:** 2026-04-17
**Scope:** New file `producten.html` at the repo root + a small addition to `index.html`'s `config-group-header` rendering.

## Problem

The calculator currently shows a config name and a one-line specs badge ("10 kWh · 4,8 kW omv · 95% eff · € 4.043,10") per selected configuration, but no deeper product information. A salesperson explaining a quote to a customer has no place to point to authoritative manufacturer specs, photos of the product, or a clear summary of what hardware the customer is actually getting (number of inverters, number of battery modules, total nominal capacity, etc.).

## Goal

Add a "📖 Productspecs ↗" button per configuration block in the calculator's results section. Clicking it opens a new tab to `producten.html?type=<TYPE>` — a clean, calculator-styled page that:

- Names the brand and product.
- Shows a personalized configuration banner (e.g., "2 × Solarflow 2400 AC + 2 batterijmodules per omvormer = 4 batterijmodules totaal").
- For each component (one section for Marstek all-in-one; two sections for Zendure modular: inverter + battery), shows manufacturer specs (per unit) plus the totals for this specific configuration.
- Includes hero photo placeholders + a small extra-photo gallery placeholder (the user will drop real images in later).
- Closes with a small footnote explaining that the ROI calculator deliberately uses more conservative numbers than the manufacturer spec.

## Non-goals

- Network calls. The page does not fetch the Google Sheet — manufacturer specs are static and the only dynamic input is the URL `?type=` parameter.
- Showing prices or the full configuration list. The calculator already does that.
- Server-side rendering, routing libraries, build steps, or any framework. Plain HTML/CSS/JS, single static file.
- Persisting the open/closed state, tracking analytics, or any other meta-feature.

## File layout

- **New:** `producten.html` at the repo root (~250-300 lines including the embedded `<style>` block and JS). Auto-deploys via GitHub Pages.
- **Modify:** `index.html` — add a `📖 Productspecs ↗` button to each `config-group-header` (one per selected config; max 3 in the page).

The page lives at `https://smartpeak-be.github.io/battery-roi-tool/producten.html?type=<TYPE>` once pushed.

## URL contract

`producten.html` reads `window.location.search` and parses the `type` query parameter. Two name patterns are recognized:

| Pattern | Matches | Extracted | Renders |
|---|---|---|---|
| `^MARVE03_X(\d+)$` | `MARVE03_X1` … `MARVE03_X6` | `numUnits` | Marstek section, per-unit specs + totals |
| `^ZSF2400AC_(\d+)X(\d+)$` | `ZSF2400AC_1X1` … `ZSF2400AC_3X6` | `numInverters`, `numBatteriesPerInverter`, `totalBatteries = inv × bat` | Zendure two-section layout, per-component specs + totals |

Anything else (missing `?type=`, unknown name pattern, wrong format) renders the **fallback**: a single `alert-warning` saying "Geen geldige configuratie geselecteerd. <a href="index.html">Terug naar de calculator</a>." and nothing else.

## Page structure

```
<header>
  <h1>⚡ SmartPeak — Productspecs</h1>
  <p class="subtitle">Technische informatie voor uw geselecteerde configuratie.</p>
  <a href="index.html" class="back-link">← Terug naar calculator</a>
</header>

<main id="content">
  <!-- one of three states fills this in via JS:
       (a) configuration banner + product section(s) + footnote, OR
       (b) fallback alert -->
</main>
```

### Configuration banner

A single `<div class="card config-banner">` near the top of the result content:

- **Marstek (MARVE03_X3 example):**
  > 🔋 Uw configuratie: **3 × Marstek Venus E V3**
- **Zendure (ZSF2400AC_2X2 example):**
  > 🔋 Uw configuratie: **2 × Solarflow 2400 AC + 2 batterijmodules per omvormer = 4 batterijmodules totaal**

### Product sections

**Marstek — one section per config (all-in-one product):**

```
<section class="product-section">
  <div class="brand-header">
    <h2>Marstek Venus E V3</h2>
  </div>
  <div class="hero-photo">[ "Foto van Marstek Venus E V3 volgt" placeholder, 16:9 ]</div>
  <p class="product-description">
    Plug-and-play AC-thuisbatterij met geïntegreerde bidirectionele omvormer.
    Modulair uitbreidbaar, eenvoudige installatie, native WiFi en RS485.
  </p>

  <table class="spec-table">
    <tbody>
      <tr><td>Capaciteit</td><td>5,12 kWh nominaal (4,608 kWh bij 90% DoD)</td></tr>
      <tr><td>Geïntegreerde omvormer</td><td>2,5 kW bidirectioneel</td></tr>
      <tr><td>Chemie</td><td>LFP (LiFePO4)</td></tr>
      <tr><td>Spanning</td><td>51,2 V</td></tr>
      <tr><td>Cyclussen</td><td>> 6.000 (90% DoD)</td></tr>
      <tr><td>Beschermingsklasse</td><td>IP65</td></tr>
      <tr><td>Werktemperatuur</td><td>−20 °C tot +60 °C</td></tr>
      <tr><td>Afmetingen</td><td>480 × 624 × 153 mm</td></tr>
      <tr><td>Gewicht</td><td>60 kg</td></tr>
      <tr><td>Connectiviteit</td><td>WiFi · RS485</td></tr>
    </tbody>
  </table>

  <div class="config-totals">
    <strong>Aantal in uw configuratie:</strong> 3 units &nbsp;·&nbsp;
    <strong>Totaal capaciteit:</strong> 15,36 kWh nominaal &nbsp;·&nbsp;
    <strong>Totaal AC-vermogen:</strong> 7,5 kW
  </div>

  <div class="photo-gallery">
    <div class="photo-placeholder">Extra foto 1 — volgt</div>
    <div class="photo-placeholder">Extra foto 2 — volgt</div>
    <div class="photo-placeholder">Extra foto 3 — volgt</div>
  </div>
</section>

<div class="alert alert-info calc-footnote">
  ℹ️ Onze ROI-calculator rekent met conservatievere waarden om realistische
  besparing te tonen — fabrikantswaarden zijn theoretische maxima en houden
  geen rekening met dagelijkse ontlaadbeperkingen, performantieverlies over
  de jaren, of niet-100%-bruikbare capaciteit.
</div>
```

Totals are computed from `numUnits`:
- Totaal capaciteit nominaal = `numUnits × 5.12` kWh
- Totaal AC-vermogen = `numUnits × 2.5` kW

**Zendure — two sections per config (modular: inverter + battery module):**

Section 1 — **Omvormer (Solarflow 2400 AC)**:

```
<section class="product-section">
  <div class="brand-header"><h2>Omvormer — Zendure SolarFlow 2400 AC</h2></div>
  <div class="hero-photo">[ "Foto van Solarflow 2400 AC volgt" placeholder ]</div>
  <p class="product-description">
    AC-gekoppelde omvormer/lader voor plug-and-play uitbreiding van bestaande
    zonne-installaties. Tot 6 batterijmodules per omvormer, parallel
    schakelbaar voor hogere vermogens.
  </p>

  <table class="spec-table">
    <tbody>
      <tr><td>AC-vermogen</td><td>2.400 W (piek 3.600 W gedurende 10 s)</td></tr>
      <tr><td>Spanning</td><td>230 V / 50 Hz</td></tr>
      <tr><td>Laadvermogen</td><td>2.400 W</td></tr>
      <tr><td>Ontlaadvermogen</td><td>2.600 W</td></tr>
      <tr><td>Efficiëntie</td><td>93%</td></tr>
      <tr><td>Beschermingsklasse</td><td>IP65</td></tr>
      <tr><td>Afmetingen</td><td>410 × 302 × 75 mm</td></tr>
      <tr><td>Gewicht</td><td>10,12 kg</td></tr>
    </tbody>
  </table>

  <div class="config-totals">
    <strong>Aantal in uw configuratie:</strong> 2 omvormers &nbsp;·&nbsp;
    <strong>Totaal AC-vermogen:</strong> 4,8 kW
  </div>

  <div class="photo-gallery"> [ 3 placeholders ] </div>
</section>
```

Section 2 — **Batterijmodule (AB3000X)**:

```
<section class="product-section">
  <div class="brand-header"><h2>Batterijmodule — Zendure AB3000X</h2></div>
  <div class="hero-photo">[ "Foto van AB3000X volgt" placeholder ]</div>
  <p class="product-description">
    LiFePO4-batterijmodule, stapelbaar tot 6 modules per omvormer. Elke module
    werkt op 48 V om verliezen te beperken.
  </p>

  <table class="spec-table">
    <tbody>
      <tr><td>Capaciteit</td><td>2,88 kWh (nominaal)</td></tr>
      <tr><td>Chemie</td><td>LiFePO4</td></tr>
      <tr><td>Spanning</td><td>48 V</td></tr>
      <tr><td>Beschermingsklasse</td><td>IP65</td></tr>
      <tr><td>Afmetingen</td><td>477,5 × 320 × 194 mm</td></tr>
      <tr><td>Gewicht</td><td>26,1 kg</td></tr>
    </tbody>
  </table>

  <div class="config-totals">
    <strong>Aantal in uw configuratie:</strong> 4 modules &nbsp;·&nbsp;
    <strong>Totaal capaciteit:</strong> 11,52 kWh nominaal
  </div>

  <div class="photo-gallery"> [ 3 placeholders ] </div>
</section>

<!-- Single shared footnote at the bottom (not per section): -->
<div class="alert alert-info calc-footnote"> ... </div>
```

Totals are computed from the parsed inverters and batteries-per-inverter:
- `totalBatteries = numInverters × numBatteriesPerInverter`
- Totaal AC-vermogen = `numInverters × 2.4` kW
- Totaal capaciteit nominaal = `totalBatteries × 2.88` kWh

## Styling

`producten.html` has its own embedded `<style>` block (the project's "everything in one file" pattern). It includes:

- The CSS variables (`--primary`, `--primary-dark`, `--success`, `--warning`, `--bg`, `--card`, `--border`, `--text`, `--muted`, `--radius`) — copied verbatim from `index.html`.
- Base typography: `body`, `h1`, `.subtitle`, `h2`.
- `.card` (same look as the calculator).
- `.alert`, `.alert-warning`, `.alert-info`.
- `table.spec-table` — two-column layout: label cell `text-align: left; color: var(--muted); width: 40%`; value cell `font-weight: 500`. Row dividers via `border-bottom: 1px solid var(--border)`.

New page-specific classes:

- `.back-link` — small link near the header, `font-size: 0.88rem`, `color: var(--primary)`, `text-decoration: none`.
- `.config-banner` — accent card with light primary tint, prominent "🔋 Uw configuratie: ..." text.
- `.product-section` — extends `.card`; one wrapper per spec section.
- `.brand-header` — flex row containing the section `<h2>`.
- `.hero-photo` — placeholder box, `aspect-ratio: 16 / 9; background: var(--bg); border: 1px dashed var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.92rem; margin: 14px 0;`.
- `.product-description` — italic, muted, max-width ~70ch, margin-bottom 12px.
- `.config-totals` — bordered box with light primary tint, slightly bigger text, top margin 14px.
- `.photo-gallery` — `display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px;`. Each `.photo-placeholder` is a square (`aspect-ratio: 1 / 1`) with the same dashed-border placeholder styling.
- `.calc-footnote` — `.alert .alert-info` already exists; this just margin-tops the footnote and uses smaller text.
- `@media (max-width: 600px)` — `.photo-gallery` collapses to 2 columns, `.brand-header h2` shrinks one step.

Estimated total CSS: ~150 lines.

## Index.html change — `📖 Productspecs ↗` button per config

In `renderResults`, the `config-group-header` block currently looks like this:

```
<div class="config-group-header">
  🔋 Configuratie ${idx+1}
  <span class="cfg-sub">${cfg.type} — ${cfg.omschrijving}</span>
  <span class="config-specs-badge">${fmt2(cfg.batCap)} kWh ... </span>
</div>
```

After the badge `<span>`, add:

```
<button class="btn-spec" onclick="window.open('producten.html?type=${encodeURIComponent(cfg.type)}', '_blank', 'noopener')">📖 Productspecs ↗</button>
```

The `noopener` flag prevents the new tab from getting a `window.opener` reference into the calculator (defensive).

CSS for `.btn-spec` (added near the existing `.config-specs-badge` rule):

```
.btn-spec {
  font-size: 0.82rem;
  padding: 4px 10px;
  border: 1px solid var(--primary);
  background: #fff;
  color: var(--primary);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-spec:hover { background: rgba(44, 123, 229, 0.08); }
```

Visually: small outlined button, sits to the right of the specs badge, doesn't compete with the headline information. Inherits the flex-layout of `.config-group-header`.

## Save / share state

Unchanged. The button's URL is generated at render time from `cfg.type` (already serialized in `configResults` save state). Loading an old v1/v2/v3/v4 share link still works — the renderer adds the button per config from the restored data; clicking it just opens `producten.html?type=...`. Old configs that no longer match the URL pattern (none today, but theoretically future config types) would land on the fallback page, which is the correct degraded behaviour.

## Edge cases

- **`?type=` missing:** fallback alert.
- **`?type=` doesn't match either pattern** (e.g. typo, future product not yet templated): fallback alert. This is intentional — adding a new product line to the price sheet without updating `producten.html` produces a visible "this isn't covered yet" rather than a half-rendered page.
- **`?type=` matches but parsed integer is zero or negative** (`MARVE03_X0`, `ZSF2400AC_0X1`, `ZSF2400AC_1X0`): the page renders normally with totals of zero — visually awkward but not broken. These don't appear in the price sheet so won't be encountered in practice; not worth special-casing.
- **Very large numbers** (`ZSF2400AC_99X99`): the page renders the math correctly; the totals are just very large numbers. Same — won't happen in practice.
- **No configurations selected in the calculator:** there are no buttons to click in the first place. The page is unreachable from index.html; direct URL still works (or shows fallback if `?type=` missing).
- **JavaScript disabled in the user's browser:** the calculator already requires JS. The product page also requires JS to parse `?type=` and render. Acceptable — this is consistent with the project's no-JS-fallback stance.

## Verification (manual, in a browser)

1. Open `index.html`, load a CSV, pick **`MARVE03_X3`** as Configuratie 1, calculate. Click `📖 Productspecs ↗` in the config-group-header. New tab opens with `producten.html?type=MARVE03_X3`. Page shows: Marstek section, banner "🔋 Uw configuratie: 3 × Marstek Venus E V3", spec table, totals "3 units / 15,36 kWh nominaal / 7,5 kW", footnote.
2. Pick **`ZSF2400AC_2X2`** as Configuratie 1. Click button. Page shows: TWO sections (omvormer + batterijmodule), banner "2 × Solarflow 2400 AC + 2 batterijmodules per omvormer = 4 batterijmodules totaal", omvormer totals "2 omvormers / 4,8 kW", batterij totals "4 modules / 11,52 kWh nominaal".
3. Pick `MARVE03_X1` and `ZSF2400AC_1X1` as two configs. Two buttons render, each opens its own page in a new tab. Verify each renders the correct product.
4. Open `producten.html` directly (no `?type=`). Fallback alert + Terug-link.
5. Open `producten.html?type=ABCDEF`. Fallback alert.
6. Open `producten.html?type=ZSF2400AC_2X3`. Page renders Zendure with 6 batterijmodules totaal (2 × 3) and totals 4,8 kW / 17,28 kWh nominaal.
7. Resize browser to mobile width (< 600px): photo gallery collapses to 2 columns; spec tables stay readable.
