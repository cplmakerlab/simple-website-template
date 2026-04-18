# Product Specs Page Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `producten.html` with a refined version that combines the Zendure specs into a single 3-column table (Configuratie totaal / Per omvormer / Per batterijmodule), shrinks the Marstek section to a 2-column table (Configuratie totaal / Per unit), and bundles all photos into one shared horizontal-scroll carousel at the bottom of the page (above the footnote).

**Architecture:** Single-file rewrite. The current page (commit `0af32b4`) has separate hero photos and gallery placeholders inside each product section, plus a per-section "config-totals" footer. The new version drops both: per-section photo blocks are gone; per-section "config-totals" is gone (totals now live in the spec table's first column). For Zendure, the previous two product sections (omvormer + batterij) collapse into one section with a single combined table. A new `<section class="card photo-section">` containing a horizontal-scroll carousel sits below the product section in both Marstek and Zendure cases (not in the fallback case). URL contract is unchanged.

**Tech Stack:** Plain HTML / CSS / vanilla JS. No build, no test framework — verification = grep + manual browser smoke.

**Spec:** `docs/superpowers/specs/2026-04-17-product-specs-page-update-design.md` — read before starting.

---

## File map

- **Modify (rewrite):** `producten.html` at the repo root.
- **Untouched:** `index.html` (the `📖 Productspecs ↗` button keeps working — URL contract is unchanged).

## Working directory

`/home/ubuntu/battery-roi-tool`. Work directly on `gh-pages`. One commit. The user pushes when they decide.

## Notes for the implementer

- UI text is in Dutch (`nl-BE`).
- The em-dash character `—` is used to mark cells where the spec doesn't apply for that column (instead of empty `<td>`).
- The 3-column Zendure table replaces what previously rendered as TWO `.product-section` blocks. Don't keep the old two-section layout — the spec is explicit that this is one combined section.
- The carousel is CSS-only (scroll-snap). No JS handlers, no prev/next buttons.

---

### Task 1: Rewrite `producten.html`

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/producten.html` (full rewrite via Write).

After this task: `producten.html?type=MARVE03_X3` shows a single Marstek section with a 3-column spec table (Spec / Configuratie totaal / Per unit) followed by the carousel and footnote. `producten.html?type=ZSF2400AC_2X2` shows a single combined Zendure section with a 4-column spec table (Spec / Configuratie totaal / Per omvormer / Per batterijmodule) followed by the carousel and footnote. Fallback case (missing or unknown `?type=`) shows only the warning alert + back link, no carousel, no footnote.

- [ ] **Step 1: Confirm the existing file matches what we're replacing**

Run:
```bash
ls -l /home/ubuntu/battery-roi-tool/producten.html
wc -l /home/ubuntu/battery-roi-tool/producten.html
grep -c "photo-gallery\|hero-photo\|config-totals" /home/ubuntu/battery-roi-tool/producten.html
```

Expected:
- File exists, length around 350 lines.
- 12 hits (4 CSS rule names × references + uses) for the about-to-be-removed classes (the exact count isn't critical — we just want to confirm we're starting from the v1 page).

If the file doesn't exist, stop and report `BLOCKED` — the spec assumes we're updating the live page.

- [ ] **Step 2: Read the current file once for context**

Run:
```bash
head -10 /home/ubuntu/battery-roi-tool/producten.html
```

You don't need to read the whole file. The new content is given verbatim in Step 3 — it replaces the file completely.

- [ ] **Step 3: Rewrite `producten.html` with the new content below**

Use the Write tool to overwrite `/home/ubuntu/battery-roi-tool/producten.html` with this EXACT content:

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SmartPeak — Productspecs</title>
  <style>
    :root {
      --primary: #2c7be5;
      --primary-dark: #1a5fba;
      --success: #00b478;
      --warning: #f6a623;
      --danger: #e54545;
      --bg: #f0f4fb;
      --card: #ffffff;
      --border: #dce3f0;
      --text: #1e2a3a;
      --muted: #6b7a99;
      --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 24px 16px;
    }
    h1 {
      font-size: 1.7rem;
      font-weight: 700;
      color: var(--primary-dark);
      margin-bottom: 4px;
    }
    h2 {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--primary-dark);
      margin: 0;
    }
    .subtitle { color: var(--muted); font-size: 0.95rem; margin-bottom: 12px; }
    .back-link {
      display: inline-block;
      font-size: 0.88rem;
      color: var(--primary);
      text-decoration: none;
      margin-bottom: 24px;
    }
    .back-link:hover { text-decoration: underline; }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(44, 123, 229, 0.06);
    }

    .alert {
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.92rem;
      margin-bottom: 16px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .alert-warning { background: #fff8ec; border: 1px solid #f6a623; color: #7a5000; }
    .alert-info    { background: #eef4ff; border: 1px solid #2c7be5; color: #1a3a6e; }

    .config-banner {
      background: linear-gradient(135deg, #eef4ff 0%, #dbeafe 100%);
      border-color: var(--primary);
      font-size: 1rem;
    }
    .config-banner strong { color: var(--primary-dark); }

    .product-section {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(44, 123, 229, 0.06);
    }
    .brand-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .product-description {
      font-style: italic;
      color: var(--muted);
      max-width: 70ch;
      margin-bottom: 14px;
      line-height: 1.5;
    }

    .spec-table-wrap { overflow-x: auto; margin-top: 8px; }
    table.spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.93rem;
    }
    table.spec-table th,
    table.spec-table td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      text-align: left;
    }
    table.spec-table thead th {
      background: var(--bg);
      color: var(--muted);
      font-weight: 600;
      font-size: 0.85rem;
      white-space: nowrap;
    }
    table.spec-table tr:last-child td { border-bottom: none; }
    table.spec-table td:first-child {
      color: var(--muted);
      width: 28%;
    }
    table.spec-table .col-totaal {
      font-weight: 600;
      color: var(--primary-dark);
    }
    table.spec-table .em-dash {
      color: var(--muted);
    }

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

    .calc-footnote {
      margin-top: 24px;
      font-size: 0.88rem;
    }

    @media (max-width: 600px) {
      h1 { font-size: 1.3rem; }
      h2 { font-size: 1.05rem; }
      .photo-item { flex-basis: 80%; }
    }
  </style>
</head>
<body>

<h1>⚡ SmartPeak — Productspecs</h1>
<p class="subtitle">Technische informatie voor uw geselecteerde configuratie.</p>
<a href="index.html" class="back-link">← Terug naar calculator</a>

<main id="content"></main>

<script>
// ─── PRODUCT SPECS (manufacturer-canonical, hard-coded) ─────────────────────
const MARSTEK_PER_UNIT = {
  capacityNominal: 5.12,   // kWh
  inverterPower:   2.5,    // kW
  weight:          60,     // kg
};
const ZENDURE_PER_INVERTER = {
  acPower:    2.4,         // kW
  peakKw:     3.6,         // kW
  loadW:      2400,        // W
  dischargeW: 2600,        // W
  weight:     10.12,       // kg
};
const ZENDURE_PER_BATTERY = {
  capacityNominal: 2.88,   // kWh
  weight:          26.1,   // kg
};

// ─── FORMATTING HELPERS ─────────────────────────────────────────────────────
function fmtKwh(n) {
  return n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtKw(n) {
  return n.toLocaleString('nl-BE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
function fmtKg(n) {
  return n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DASH = '<span class="em-dash">—</span>';

// ─── SHARED PIECES ──────────────────────────────────────────────────────────
function renderCarousel() {
  return `
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
  `;
}

function renderFootnote() {
  return `
    <div class="alert alert-info calc-footnote">
      ℹ️ <div>Onze ROI-calculator rekent met conservatievere waarden om realistische besparing te tonen — fabrikantswaarden zijn theoretische maxima en houden geen rekening met dagelijkse ontlaadbeperkingen, performantieverlies over de jaren, of niet-100%-bruikbare capaciteit.</div>
    </div>
  `;
}

// ─── RENDERERS ──────────────────────────────────────────────────────────────
function renderMarstek(numUnits) {
  const totalCap      = numUnits * MARSTEK_PER_UNIT.capacityNominal;
  const totalInverter = numUnits * MARSTEK_PER_UNIT.inverterPower;
  const totalWeight   = numUnits * MARSTEK_PER_UNIT.weight;
  return `
    <div class="card config-banner">
      🔋 Uw configuratie: <strong>${numUnits} × Marstek Venus E V3</strong>
    </div>
    <section class="product-section">
      <div class="brand-header"><h2>Marstek Venus E V3</h2></div>
      <p class="product-description">
        Plug-and-play AC-thuisbatterij met geïntegreerde bidirectionele omvormer.
        Modulair uitbreidbaar, eenvoudige installatie, native WiFi en RS485.
      </p>
      <div class="spec-table-wrap">
        <table class="spec-table spec-2col">
          <thead>
            <tr><th>Spec</th><th>Configuratie totaal</th><th>Per unit</th></tr>
          </thead>
          <tbody>
            <tr><td>Capaciteit</td><td class="col-totaal">${fmtKwh(totalCap)} kWh nominaal</td><td>5,12 kWh nominaal (4,608 kWh bij 90% DoD)</td></tr>
            <tr><td>AC-vermogen (omv. integrated)</td><td class="col-totaal">${fmtKw(totalInverter)} kW</td><td>2,5 kW bidirectioneel</td></tr>
            <tr><td>Chemie</td><td class="col-totaal">${DASH}</td><td>LFP (LiFePO4)</td></tr>
            <tr><td>Spanning</td><td class="col-totaal">${DASH}</td><td>51,2 V</td></tr>
            <tr><td>Cyclussen</td><td class="col-totaal">${DASH}</td><td>&gt; 6.000 (90% DoD)</td></tr>
            <tr><td>Beschermingsklasse</td><td class="col-totaal">${DASH}</td><td>IP65</td></tr>
            <tr><td>Werktemperatuur</td><td class="col-totaal">${DASH}</td><td>−20 °C tot +60 °C</td></tr>
            <tr><td>Afmetingen (per unit)</td><td class="col-totaal">${DASH}</td><td>480 × 624 × 153 mm</td></tr>
            <tr><td>Gewicht (per unit)</td><td class="col-totaal">${DASH}</td><td>60 kg</td></tr>
            <tr><td>Totaal gewicht</td><td class="col-totaal">${fmtKg(totalWeight)} kg</td><td>${DASH}</td></tr>
            <tr><td>Connectiviteit</td><td class="col-totaal">${DASH}</td><td>WiFi · RS485</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    ${renderCarousel()}
    ${renderFootnote()}
  `;
}

function renderZendure(numInverters, numBatteriesPerInverter) {
  const totalBatteries  = numInverters * numBatteriesPerInverter;
  const totalAcPower    = numInverters * ZENDURE_PER_INVERTER.acPower;
  const totalPeakKw     = numInverters * ZENDURE_PER_INVERTER.peakKw;
  const totalLoadW      = numInverters * ZENDURE_PER_INVERTER.loadW;
  const totalDischargeW = numInverters * ZENDURE_PER_INVERTER.dischargeW;
  const totalCapacity   = totalBatteries * ZENDURE_PER_BATTERY.capacityNominal;
  const totalWeight     = numInverters * ZENDURE_PER_INVERTER.weight + totalBatteries * ZENDURE_PER_BATTERY.weight;
  return `
    <div class="card config-banner">
      🔋 Uw configuratie: <strong>${numInverters} × Solarflow 2400 AC + ${numBatteriesPerInverter} batterijmodules per omvormer = ${totalBatteries} batterijmodules totaal</strong>
    </div>
    <section class="product-section">
      <div class="brand-header"><h2>Zendure SolarFlow 2400 AC + AB3000X</h2></div>
      <p class="product-description">
        Modulair systeem met aparte AC-omvormer (SolarFlow 2400 AC) en stapelbare LiFePO4-batterijmodules (AB3000X).
        Tot 6 modules per omvormer; meerdere omvormers parallel schakelbaar voor hogere vermogens.
        Plug-and-play uitbreiding van bestaande zonne-installaties.
      </p>
      <div class="spec-table-wrap">
        <table class="spec-table spec-3col">
          <thead>
            <tr><th>Spec</th><th>Configuratie totaal</th><th>Per omvormer (Solarflow 2400 AC)</th><th>Per batterijmodule (AB3000X)</th></tr>
          </thead>
          <tbody>
            <tr><td>Capaciteit</td><td class="col-totaal">${fmtKwh(totalCapacity)} kWh nominaal</td><td>${DASH}</td><td>2,88 kWh (nominaal)</td></tr>
            <tr><td>AC-vermogen</td><td class="col-totaal">${fmtKw(totalAcPower)} kW (piek ${fmtKw(totalPeakKw)} kW / 10 s)</td><td>2.400 W (piek 3.600 W / 10 s)</td><td>${DASH}</td></tr>
            <tr><td>Laadvermogen</td><td class="col-totaal">${totalLoadW} W</td><td>2.400 W</td><td>${DASH}</td></tr>
            <tr><td>Ontlaadvermogen</td><td class="col-totaal">${totalDischargeW} W</td><td>2.600 W</td><td>${DASH}</td></tr>
            <tr><td>Spanning</td><td class="col-totaal">${DASH}</td><td>230 V / 50 Hz</td><td>48 V</td></tr>
            <tr><td>Chemie</td><td class="col-totaal">${DASH}</td><td>${DASH}</td><td>LiFePO4</td></tr>
            <tr><td>Efficiëntie</td><td class="col-totaal">${DASH}</td><td>93%</td><td>${DASH}</td></tr>
            <tr><td>Beschermingsklasse</td><td class="col-totaal">${DASH}</td><td>IP65</td><td>IP65</td></tr>
            <tr><td>Afmetingen (per stuk)</td><td class="col-totaal">${DASH}</td><td>410 × 302 × 75 mm</td><td>477,5 × 320 × 194 mm</td></tr>
            <tr><td>Gewicht (per stuk)</td><td class="col-totaal">${DASH}</td><td>10,12 kg</td><td>26,1 kg</td></tr>
            <tr><td>Totaal gewicht</td><td class="col-totaal">${fmtKg(totalWeight)} kg</td><td>${DASH}</td><td>${DASH}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    ${renderCarousel()}
    ${renderFootnote()}
  `;
}

function renderFallback() {
  return `
    <div class="alert alert-warning">
      ⚠️ <div>Geen geldige configuratie geselecteerd. <a href="index.html">Ga terug naar de calculator</a> en klik op een 📖 Productspecs-knop bij een gekozen configuratie.</div>
    </div>
  `;
}

// ─── ENTRY POINT ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') || '';
  let html;
  let m;
  if ((m = type.match(/^MARVE03_X(\d+)$/))) {
    html = renderMarstek(parseInt(m[1], 10));
  } else if ((m = type.match(/^ZSF2400AC_(\d+)X(\d+)$/))) {
    html = renderZendure(parseInt(m[1], 10), parseInt(m[2], 10));
  } else {
    html = renderFallback();
  }
  document.getElementById('content').innerHTML = html;
});
</script>

</body>
</html>
```

- [ ] **Step 4: Verify file structure**

Run:
```bash
wc -l /home/ubuntu/battery-roi-tool/producten.html
grep -c "photo-gallery\|hero-photo\|config-totals" /home/ubuntu/battery-roi-tool/producten.html
grep -nE "^function (renderMarstek|renderZendure|renderFallback|renderFootnote|renderCarousel|fmtKwh|fmtKw|fmtKg)" /home/ubuntu/battery-roi-tool/producten.html
grep -n "photo-carousel\|spec-2col\|spec-3col\|col-totaal\|em-dash" /home/ubuntu/battery-roi-tool/producten.html
grep -nE "MARVE03_X|ZSF2400AC_" /home/ubuntu/battery-roi-tool/producten.html
grep -n 'id="content"' /home/ubuntu/battery-roi-tool/producten.html
```

Expected:
- File length around 290-330 lines.
- 0 hits for `photo-gallery|hero-photo|config-totals` (all removed in this update).
- 8 hits for the function declarations.
- Multiple hits for `photo-carousel`, `spec-2col`, `spec-3col`, `col-totaal`, `em-dash` (mix of CSS rule definitions and HTML class usages).
- 1 or more hits for the regex literals (in the entry-point block).
- 1 hit for `id="content"`.

If `photo-gallery|hero-photo|config-totals` returns any hits, the rewrite was incomplete — re-do Step 3.

- [ ] **Step 5: Optional sanity check via local server**

```bash
python3 -m http.server 8000 --directory /home/ubuntu/battery-roi-tool >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
curl -sI http://localhost:8000/producten.html | head -3
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
```

Expected: `HTTP/1.0 200 OK` (or just `200`). Confirms the file is served. Actual rendering verification is the user's manual smoke test.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add producten.html
git commit -m "$(cat <<'EOF'
Rework producten.html: combined spec table + shared photo carousel

Two changes per the update spec:

1. Spec tables now lead with a "Configuratie totaal" column that
   computes per-config totals (capaciteit, AC-vermogen, totaal
   gewicht, etc.) directly from the URL parameters. Per-unit
   values move to the right. For Zendure the previous two
   product sections (omvormer + batterij) collapse into one
   combined section with a single 4-column table (Spec / Totaal /
   Per omvormer / Per batterijmodule). Marstek uses the
   equivalent 3-column layout (Spec / Totaal / Per unit).

2. Per-section hero photos and 3-up gallery placeholders are
   replaced by one shared CSS scroll-snap carousel below the
   product section. 6 placeholder items by default; later real
   photos drop in by replacing each .photo-item div with an
   <img class="photo-item" src="..." alt="...">.

URL contract is unchanged — the index.html button keeps working
as-is. Old shared links keep loading with the new layout.

Spec: docs/superpowers/specs/2026-04-17-product-specs-page-update-design.md
EOF
)"
```

- [ ] **Step 7: Self-review**

Run:
```bash
git log --oneline -3
git status
git show --stat HEAD | head
git diff HEAD~1 -- producten.html | wc -l
```

Confirm:
- Top commit is yours, named "Rework producten.html: ...".
- `git status` shows a clean working tree (only previously-untracked plan files allowed).
- Single file changed (`producten.html`).
- Diff size in the few-hundred-lines range (significant rewrite).

## Report format

- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- New commit SHA
- Output of all greps from Step 4
- HTTP status from Step 5 (or note if skipped)
- Anything unexpected

---

## Self-review (controller, before handing off)

**Spec coverage:**
- Spec § Page structure → Step 3 (Marstek + Zendure + fallback HTML structures all present in the rewritten file).
- Spec § Spec table contents (Marstek 11 rows, Zendure 11 rows) → Step 3 tables.
- Spec § Brand description copy (Marstek unchanged, Zendure new combined wording) → Step 3 product-description blocks.
- Spec § Photo carousel (one shared section, 6 placeholders, scroll-snap) → Step 3 `renderCarousel()` + CSS `.photo-carousel` / `.photo-item`.
- Spec § Other CSS changes (drop obsolete classes, add `.spec-table-wrap`, `.col-totaal`, `.em-dash`, `.spec-2col`/`.spec-3col` modifiers, mobile breakpoint) → Step 3 `<style>` block.
- Spec § Edge cases (`n=1`, `1×1`, fallback no carousel/footnote, em-dash rendering, old shared links) → Step 3 implementations + Step 4 grep verification.
- Spec § Verification → Step 4 grep + Step 5 HTTP + user-driven manual browser smoke.

**Placeholder scan:** Every step has actual code or actual commands. The `Foto N — volgt` strings inside the rendered carousel are user-facing copy (intentional placeholders for images that don't exist yet), not implementation placeholders.

**Type/name consistency:**
- `MARSTEK_PER_UNIT`, `ZENDURE_PER_INVERTER`, `ZENDURE_PER_BATTERY` constants now include `weight` (new field used by total-weight calculations) — consistent across renderers.
- `fmtKwh` / `fmtKw` / `fmtKg` formatters consistent.
- `DASH` constant used uniformly for em-dash cells.
- `renderCarousel`, `renderFootnote` shared between both product renderers and called identically (after the product section, before nothing else).
- Regex patterns `^MARVE03_X(\d+)$` and `^ZSF2400AC_(\d+)X(\d+)$` unchanged from v1 — URL contract preserved.
- Class names `spec-2col`, `spec-3col`, `col-totaal`, `em-dash`, `photo-carousel`, `photo-item`, `spec-table-wrap`, `photo-section`, `carousel-hint` all defined in CSS and used in the HTML output of the renderers.
