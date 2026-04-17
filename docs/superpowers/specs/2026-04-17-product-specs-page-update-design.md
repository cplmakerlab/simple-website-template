# Product specs page update — combined spec table + shared photo carousel

**Date:** 2026-04-17
**Scope:** `producten.html` only. Updates the live page (commit `0af32b4`) — does not touch `index.html`.

## Problem

The first version of `producten.html` shipped with two issues:

1. **Photos scattered across sections.** Each product section had its own hero photo + gallery (3 placeholders). For Zendure that produced 8 separate placeholder boxes (1 hero + 3 gallery × 2 sections + the same again for the battery section), spread across the page. The salesperson asked for one bundled photo carousel that the customer can swipe through.
2. **Specs not contextualized to the chosen configuration.** Each spec row showed only the per-unit value. For a multi-unit configuration (e.g. Zendure 2×2 = 2 omvormers + 4 batterijen), the per-unit numbers don't directly tell the customer what the system as a whole delivers (e.g. 4,8 kW total AC power, 11,52 kWh total capacity). The previous "config totals" footer line was easy to overlook.

## Goal

1. Replace the per-section `.hero-photo` + `.photo-gallery` blocks with one shared horizontal-scroll **photo carousel** at the bottom of the page (above the footnote). 6 placeholders, CSS-only scroll-snap, swipe on mobile, scrollbar/scroll-wheel on desktop. Easy to swap placeholders for `<img>` tags later.
2. Restructure the spec table so the **per-config totals are the first column**, making them the headline number, with per-component values to the right. For Zendure (modular: omvormer + batterijmodule), use **one combined three-column table** instead of two separate sections. For Marstek (all-in-one), use a **two-column table**.

## Non-goals

- Changing the URL contract (`?type=…` patterns stay identical).
- Changing the manufacturer specs themselves.
- Replacing placeholders with real images (the user will drop those in later).
- Touching `index.html` (the button stays as-is).
- Real "carousel JS" with prev/next buttons. CSS scroll-snap is sufficient and free of JS.

## Page structure (after update)

```
<header>
  <h1>⚡ SmartPeak — Productspecs</h1>
  <p class="subtitle">…</p>
  <a class="back-link">← Terug naar calculator</a>
</header>

<main id="content">
  <!-- ONE of: -->

  <!-- Marstek case -->
  <div class="card config-banner">🔋 Uw configuratie: 3 × Marstek Venus E V3</div>
  <section class="product-section">
    <div class="brand-header"><h2>Marstek Venus E V3</h2></div>
    <p class="product-description">…</p>
    <table class="spec-table spec-2col">
      <thead><tr><th>Spec</th><th>Configuratie totaal</th><th>Per unit</th></tr></thead>
      <tbody>… 11 rows …</tbody>
    </table>
  </section>

  <!-- OR Zendure case -->
  <div class="card config-banner">🔋 Uw configuratie: 2 × Solarflow 2400 AC + 2 batterijmodules per omvormer = 4 batterijmodules totaal</div>
  <section class="product-section">
    <div class="brand-header"><h2>Zendure SolarFlow 2400 AC + AB3000X</h2></div>
    <p class="product-description">…</p>
    <table class="spec-table spec-3col">
      <thead><tr><th>Spec</th><th>Configuratie totaal</th><th>Per omvormer</th><th>Per batterijmodule</th></tr></thead>
      <tbody>… 11 rows …</tbody>
    </table>
  </section>

  <!-- OR fallback -->
  <div class="alert alert-warning">…</div>

  <!-- Shared bottom for Marstek and Zendure cases (NOT for fallback) -->
  <section class="card photo-section">
    <h2>📷 Foto's</h2>
    <div class="photo-carousel">
      <div class="photo-item">Foto 1 — volgt</div>
      <div class="photo-item">Foto 2 — volgt</div>
      … 6 items total …
    </div>
  </section>
  <div class="alert alert-info calc-footnote">ℹ️ Onze ROI-calculator…</div>
</main>
```

The Marstek and Zendure cases each render exactly one `.product-section` (no more two-section split for Zendure). The shared carousel + footnote sit below regardless of which product is rendered. The fallback case shows neither carousel nor footnote.

## Spec table contents

### Marstek (2-column, 11 rows)

For `MARVE03_X<n>`:
- `totalCap = n × 5.12` kWh
- `totalInverter = n × 2.5` kW
- `totalWeight = n × 60` kg

| Spec | Configuratie totaal | Per unit |
|---|---|---|
| Capaciteit | `${fmtKwh(totalCap)} kWh nominaal` | `5,12 kWh nominaal (4,608 kWh bij 90% DoD)` |
| AC-vermogen (omv. integrated) | `${fmtKw(totalInverter)} kW` | `2,5 kW bidirectioneel` |
| Chemie | — | `LFP (LiFePO4)` |
| Spanning | — | `51,2 V` |
| Cyclussen | — | `> 6.000 (90% DoD)` |
| Beschermingsklasse | — | `IP65` |
| Werktemperatuur | — | `−20 °C tot +60 °C` |
| Afmetingen (per unit) | — | `480 × 624 × 153 mm` |
| Gewicht (per unit) | — | `60 kg` |
| Totaal gewicht | `${n × 60} kg` | — |
| Connectiviteit | — | `WiFi · RS485` |

### Zendure (3-column, 11 rows)

For `ZSF2400AC_<i>X<b>`:
- `totalBatteries = i × b`
- `totalAcPower = i × 2.4` kW
- `totalLoadW = i × 2400` W
- `totalDischargeW = i × 2600` W
- `totalCapacity = totalBatteries × 2.88` kWh
- `totalWeight = i × 10.12 + totalBatteries × 26.1` kg
- `totalPeakKw = i × 3.6` kW

| Spec | Configuratie totaal | Per omvormer (Solarflow 2400 AC) | Per batterijmodule (AB3000X) |
|---|---|---|---|
| Capaciteit | `${fmtKwh(totalCapacity)} kWh nominaal` | — | `2,88 kWh (nominaal)` |
| AC-vermogen | `${fmtKw(totalAcPower)} kW (piek ${fmtKw(totalPeakKw)} kW / 10 s)` | `2.400 W (piek 3.600 W / 10 s)` | — |
| Laadvermogen | `${totalLoadW} W` | `2.400 W` | — |
| Ontlaadvermogen | `${totalDischargeW} W` | `2.600 W` | — |
| Spanning | — | `230 V / 50 Hz` | `48 V` |
| Chemie | — | — | `LiFePO4` |
| Efficiëntie | — | `93%` | — |
| Beschermingsklasse | — | `IP65` | `IP65` |
| Afmetingen (per stuk) | — | `410 × 302 × 75 mm` | `477,5 × 320 × 194 mm` |
| Gewicht (per stuk) | — | `10,12 kg` | `26,1 kg` |
| Totaal gewicht | `${fmtKg(totalWeight)} kg` | — | — |

`fmtKg(n)` formats a kg value with 2 decimals using `toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`. For `2X2`: `2 × 10.12 + 4 × 26.1 = 124.64 kg`.

Cells with `—` are rendered as the literal em-dash character. They are NOT empty `<td></td>` (which would render as a blank cell with no visual marker).

### Brand description copy

- **Marstek (unchanged):** "Plug-and-play AC-thuisbatterij met geïntegreerde bidirectionele omvormer. Modulair uitbreidbaar, eenvoudige installatie, native WiFi en RS485."
- **Zendure (combined, new):** "Modulair systeem met aparte AC-omvormer (SolarFlow 2400 AC) en stapelbare LiFePO4-batterijmodules (AB3000X). Tot 6 modules per omvormer; meerdere omvormers parallel schakelbaar voor hogere vermogens. Plug-and-play uitbreiding van bestaande zonne-installaties."

The two old Zendure descriptions (one per section) collapse into this single description.

## Photo carousel

Single section at the bottom of the page (in both Marstek and Zendure cases; not in the fallback case):

```html
<section class="card photo-section">
  <h2>📷 Foto's</h2>
  <p class="carousel-hint">Sleep horizontaal door de foto's.</p>
  <div class="photo-carousel">
    <div class="photo-item">Foto 1 — volgt</div>
    <div class="photo-item">Foto 2 — volgt</div>
    <div class="photo-item">Foto 3 — volgt</div>
    <div class="photo-item">Foto 4 — volgt</div>
    <div class="photo-item">Foto 5 — volgt</div>
    <div class="photo-item">Foto 6 — volgt</div>
  </div>
</section>
```

CSS:

```css
.photo-section h2 { margin-bottom: 6px; }
.carousel-hint {
  font-size: 0.82rem;
  color: var(--muted);
  margin-bottom: 12px;
}
.photo-carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 12px;
  padding-bottom: 8px;
  scrollbar-width: thin;
}
.photo-item {
  flex: 0 0 280px;
  aspect-ratio: 4 / 3;
  scroll-snap-align: start;
  background: var(--bg);
  border: 1px dashed var(--border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  font-size: 0.88rem;
  text-align: center;
  padding: 8px;
}
@media (max-width: 600px) {
  .photo-item { flex-basis: 80%; }
}
```

When real photos arrive, each `.photo-item` becomes `<img class="photo-item" src="..." alt="...">` with the same flex-basis and aspect-ratio. The `<div>` and `<img>` form is interchangeable for the carousel layout.

## Other CSS changes

- Remove obsolete classes (the rules can stay in the file harmlessly, but cleaner to delete): `.hero-photo`, `.photo-gallery`, `.photo-placeholder`, `.config-totals`. Their consumers are gone.
- Add the new spec-table structure. The existing `.spec-table` rule (two-column layout) is the baseline. Add modifier classes:
  - `.spec-table.spec-2col` — current behaviour, plus a `<thead>` with a 3-column header (Spec / Configuratie totaal / Per unit). Keep the alternating row borders. The first column (Spec label) stays muted; the second (Configuratie totaal) is bold (`font-weight: 600`, primary-dark color); the third (Per unit) stays normal weight.
  - `.spec-table.spec-3col` — same but with 4 columns (Spec / Configuratie totaal / Per omvormer / Per batterij). Same color emphasis: column 2 bold and primary-dark.
- Mobile (< 600px): tables stay scrollable horizontally — wrap `<table>` in `<div style="overflow-x:auto">` so they don't break the layout.

## Edge cases

- **Marstek `n = 1`:** "Configuratie totaal" column shows `5,12 kWh nominaal` and `2,5 kW`, the same numbers as the per-unit column. Visually fine — the customer sees that with a single unit, totaal == per unit.
- **Zendure `i × b = 1 × 1`:** Same — totals equal per-unit values for capacity-related rows. Visually fine.
- **Fallback (`?type=` missing or unknown):** No carousel and no footnote rendered (only the alert-warning + back-link). Verified by removing those blocks from the fallback HTML.
- **`—` rendering:** literal em-dash character (`U+2014`). In `<td>—</td>` it shows as a single dash; styled subtly via `color: var(--muted)` to read as "n.v.t." without text.
- **Old shared link from before this update:** the URL contract is unchanged, so the page still loads. Visually the user sees the new layout (single section for Zendure, combined table, carousel at the bottom). No breakage.

## Verification (manual, in a browser)

1. Open `producten.html?type=MARVE03_X3`. Banner shows "3 × Marstek Venus E V3". Single product section with brand header. Spec table has 3 columns (Spec / Configuratie totaal / Per unit) and 11 rows. "Configuratie totaal" column shows `15,36 kWh nominaal` for capacity, `7,5 kW` for AC-vermogen, `180 kg` for totaal gewicht. Other rows show `—` in the totaal column. Carousel section at the bottom with 6 placeholder items; horizontal scroll/swipe works. Footnote at the very bottom.
2. Open `producten.html?type=MARVE03_X1`. Same structure; totaal column equals per-unit column for capacity / AC-vermogen / totaal gewicht (60 kg).
3. Open `producten.html?type=ZSF2400AC_2X2`. Banner: "2 × Solarflow 2400 AC + 2 batterijmodules per omvormer = 4 batterijmodules totaal". Single product section "Zendure SolarFlow 2400 AC + AB3000X". Spec table has 4 columns and 11 rows. Configuratie totaal column shows: capaciteit `11,52 kWh nominaal`, AC-vermogen `4,8 kW (piek 7,2 kW / 10 s)`, laadvermogen `4800 W`, ontlaadvermogen `5200 W`, totaal gewicht `124,64 kg`. Other rows show `—` in the totaal column. Carousel at the bottom; footnote.
4. Open `producten.html?type=ZSF2400AC_3X6`. Totaal column shows `51,84 kWh nominaal`, `7,2 kW (piek 10,8 kW / 10 s)`, `7200 W` laad, `7800 W` ontlaad, `500,16 kg` totaal gewicht (= 3 × 10,12 + 18 × 26,1).
5. Open `producten.html?type=ABCDEF` (unknown). Fallback alert; no carousel; no footnote; only the back-link.
6. Resize the browser to mobile width (< 600px). The spec table scrolls horizontally inside its wrapper (no layout breakage). The photo carousel items become wider (~80% of viewport) and snap one-by-one on swipe.
7. (Once real photos arrive) replace each `<div class="photo-item">…</div>` with `<img class="photo-item" src="img/foto-1.jpg" alt="…">` — the carousel keeps working with no other code change.
