# Product Specs Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `📖 Productspecs ↗` button per selected configuration in the calculator's results that opens a new tab to a personalized spec page (`producten.html`) showing manufacturer specs + per-config totals + photo placeholders for the chosen product.

**Architecture:** A brand-new self-contained `producten.html` (HTML + embedded CSS + embedded JS, ~300 lines) at the repo root. It parses `?type=` from the URL, matches it against two regex patterns (`MARVE03_X<n>` for Marstek, `ZSF2400AC_<i>X<b>` for Zendure), and renders the matching product section. Manufacturer specs are hard-coded; only the per-config totals are computed from the URL parameters. The calculator's `index.html` gets a small `📖 Productspecs ↗` button added per `config-group-header`, opening the page in a new tab via `window.open(..., '_blank', 'noopener')`.

**Tech Stack:** Plain HTML / CSS / vanilla JS in static files. No build, no framework, no test harness — verification = grep + manual browser smoke.

**Spec:** `docs/superpowers/specs/2026-04-17-product-specs-page-design.md` — read before starting.

---

## File map

- **Create:** `producten.html` at repo root (~300 lines).
- **Modify:** `index.html` — one CSS rule added (around line 443) and one HTML edit inside `renderResults`'s scenario-card forEach (around line 1400).

## Working directory

`/home/ubuntu/battery-roi-tool`. Work directly on `gh-pages`. Each task ends with its own commit. Push is the user's call; the implementer does not push.

## Notes for the implementer

- All UI text is in Dutch (`nl-BE`). Do not translate.
- Number formatting: kWh and kW values use `nl-BE` locale (comma decimal, dot thousands), via `toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` for kWh and `(..., { minimumFractionDigits: 1, maximumFractionDigits: 2 })` for kW.
- `producten.html` shares the `--primary`, `--card`, `--border`, etc. CSS variables with `index.html` but does NOT share a stylesheet file — each page embeds its own subset. This matches the project's "everything in one file" pattern.
- `producten.html` does NO network calls — manufacturer specs are static, only the per-config quantities come from `?type=`.

---

### Task 1: Create `producten.html`

**Files:**
- Create: `/home/ubuntu/battery-roi-tool/producten.html`

After this task: opening `producten.html?type=MARVE03_X3` shows a Marstek section with totals computed for 3 units; opening `?type=ZSF2400AC_2X2` shows two Zendure sections with totals for 2 inverters and 4 batteries; opening with no `?type=` or an unknown one shows a fallback alert with a link back to `index.html`. The page works standalone — `index.html` integration follows in Task 2.

- [ ] **Step 1: Confirm the file doesn't already exist**

Run:
```bash
ls -l /home/ubuntu/battery-roi-tool/producten.html 2>&1 | head -2
```
Expected: `ls: cannot access ... No such file or directory`. If the file exists, stop and report `BLOCKED` — the spec assumes a fresh file.

- [ ] **Step 2: Create `producten.html` with the full content below**

Use Write to create `/home/ubuntu/battery-roi-tool/producten.html` with this exact content:

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
    .hero-photo {
      aspect-ratio: 16 / 9;
      background: var(--bg);
      border: 1px dashed var(--border);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      font-size: 0.92rem;
      margin: 14px 0;
    }
    .product-description {
      font-style: italic;
      color: var(--muted);
      max-width: 70ch;
      margin-bottom: 14px;
      line-height: 1.5;
    }

    table.spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.93rem;
      margin-top: 8px;
    }
    table.spec-table td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    table.spec-table tr:last-child td { border-bottom: none; }
    table.spec-table td:first-child {
      color: var(--muted);
      width: 40%;
    }
    table.spec-table td:last-child {
      font-weight: 500;
    }

    .config-totals {
      background: #eef4ff;
      border: 1px solid var(--primary);
      border-radius: 8px;
      padding: 12px 16px;
      margin-top: 16px;
      font-size: 0.95rem;
      color: var(--primary-dark);
    }

    .photo-gallery {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 16px;
    }
    .photo-placeholder {
      aspect-ratio: 1 / 1;
      background: var(--bg);
      border: 1px dashed var(--border);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      font-size: 0.82rem;
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
      .photo-gallery { grid-template-columns: repeat(2, 1fr); }
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
};
const ZENDURE_PER_INVERTER = {
  acPower: 2.4,            // kW
};
const ZENDURE_PER_BATTERY = {
  capacityNominal: 2.88,   // kWh
};

// ─── FORMATTING HELPERS ─────────────────────────────────────────────────────
function fmtKwh(n) {
  return n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtKw(n) {
  return n.toLocaleString('nl-BE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

// ─── RENDERERS ──────────────────────────────────────────────────────────────
function renderMarstek(numUnits) {
  const totalCap      = numUnits * MARSTEK_PER_UNIT.capacityNominal;
  const totalInverter = numUnits * MARSTEK_PER_UNIT.inverterPower;
  return `
    <div class="card config-banner">
      🔋 Uw configuratie: <strong>${numUnits} × Marstek Venus E V3</strong>
    </div>
    <section class="product-section">
      <div class="brand-header"><h2>Marstek Venus E V3</h2></div>
      <div class="hero-photo">Foto van Marstek Venus E V3 volgt</div>
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
          <tr><td>Cyclussen</td><td>&gt; 6.000 (90% DoD)</td></tr>
          <tr><td>Beschermingsklasse</td><td>IP65</td></tr>
          <tr><td>Werktemperatuur</td><td>−20 °C tot +60 °C</td></tr>
          <tr><td>Afmetingen</td><td>480 × 624 × 153 mm</td></tr>
          <tr><td>Gewicht</td><td>60 kg</td></tr>
          <tr><td>Connectiviteit</td><td>WiFi · RS485</td></tr>
        </tbody>
      </table>
      <div class="config-totals">
        <strong>Aantal in uw configuratie:</strong> ${numUnits} units &nbsp;·&nbsp;
        <strong>Totaal capaciteit:</strong> ${fmtKwh(totalCap)} kWh nominaal &nbsp;·&nbsp;
        <strong>Totaal AC-vermogen:</strong> ${fmtKw(totalInverter)} kW
      </div>
      <div class="photo-gallery">
        <div class="photo-placeholder">Extra foto 1 — volgt</div>
        <div class="photo-placeholder">Extra foto 2 — volgt</div>
        <div class="photo-placeholder">Extra foto 3 — volgt</div>
      </div>
    </section>
    ${renderFootnote()}
  `;
}

function renderZendure(numInverters, numBatteriesPerInverter) {
  const totalBatteries = numInverters * numBatteriesPerInverter;
  const totalAcPower   = numInverters * ZENDURE_PER_INVERTER.acPower;
  const totalCapacity  = totalBatteries * ZENDURE_PER_BATTERY.capacityNominal;
  return `
    <div class="card config-banner">
      🔋 Uw configuratie: <strong>${numInverters} × Solarflow 2400 AC + ${numBatteriesPerInverter} batterijmodules per omvormer = ${totalBatteries} batterijmodules totaal</strong>
    </div>
    <section class="product-section">
      <div class="brand-header"><h2>Omvormer — Zendure SolarFlow 2400 AC</h2></div>
      <div class="hero-photo">Foto van Solarflow 2400 AC volgt</div>
      <p class="product-description">
        AC-gekoppelde omvormer/lader voor plug-and-play uitbreiding van bestaande zonne-installaties.
        Tot 6 batterijmodules per omvormer, parallel schakelbaar voor hogere vermogens.
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
        <strong>Aantal in uw configuratie:</strong> ${numInverters} omvormers &nbsp;·&nbsp;
        <strong>Totaal AC-vermogen:</strong> ${fmtKw(totalAcPower)} kW
      </div>
      <div class="photo-gallery">
        <div class="photo-placeholder">Extra foto 1 — volgt</div>
        <div class="photo-placeholder">Extra foto 2 — volgt</div>
        <div class="photo-placeholder">Extra foto 3 — volgt</div>
      </div>
    </section>
    <section class="product-section">
      <div class="brand-header"><h2>Batterijmodule — Zendure AB3000X</h2></div>
      <div class="hero-photo">Foto van AB3000X volgt</div>
      <p class="product-description">
        LiFePO4-batterijmodule, stapelbaar tot 6 modules per omvormer.
        Elke module werkt op 48 V om verliezen te beperken.
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
        <strong>Aantal in uw configuratie:</strong> ${totalBatteries} modules &nbsp;·&nbsp;
        <strong>Totaal capaciteit:</strong> ${fmtKwh(totalCapacity)} kWh nominaal
      </div>
      <div class="photo-gallery">
        <div class="photo-placeholder">Extra foto 1 — volgt</div>
        <div class="photo-placeholder">Extra foto 2 — volgt</div>
        <div class="photo-placeholder">Extra foto 3 — volgt</div>
      </div>
    </section>
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

function renderFootnote() {
  return `
    <div class="alert alert-info calc-footnote">
      ℹ️ <div>Onze ROI-calculator rekent met conservatievere waarden om realistische besparing te tonen — fabrikantswaarden zijn theoretische maxima en houden geen rekening met dagelijkse ontlaadbeperkingen, performantieverlies over de jaren, of niet-100%-bruikbare capaciteit.</div>
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

- [ ] **Step 3: Verify the file structure with grep**

Run:
```bash
wc -l /home/ubuntu/battery-roi-tool/producten.html
grep -nE "^function (renderMarstek|renderZendure|renderFallback|renderFootnote|fmtKwh|fmtKw)" /home/ubuntu/battery-roi-tool/producten.html
grep -n "MARVE03_X|ZSF2400AC_" /home/ubuntu/battery-roi-tool/producten.html
grep -n "id=\"content\"" /home/ubuntu/battery-roi-tool/producten.html
```

Expected:
- File length around 280-320 lines.
- 6 hits for the function declarations.
- 1 hit each for the regex literals (in the entry-point block).
- 1 hit for `id="content"`.

If any expected hit is missing, the file content didn't match the spec — re-create from Step 2.

- [ ] **Step 4: Optional sanity check via headless URL parse**

This step requires a browser; if you can't open one, skip it and let the user verify manually after the commit.

```bash
python3 -m http.server 8000 --directory /home/ubuntu/battery-roi-tool >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
# Fetch the page; producten.html is a static file so curl just returns it as-is.
# We're not checking the rendered DOM (that requires JS), only that the file is served.
curl -sI http://localhost:8000/producten.html | head -3
kill $SERVER_PID 2>/dev/null
```

Expected: `HTTP/1.0 200 OK` (or `200`). Confirms the file is at the right path and the local server can serve it. The actual rendering (JS-driven) is for the user's manual smoke test.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add producten.html
git commit -m "$(cat <<'EOF'
Add producten.html — per-configuration product specs page

New standalone page that shows manufacturer specs and per-config
totals for a single chosen battery configuration. URL parameter
?type=<config-type> selects which product to render:

  - MARVE03_X<n>      → Marstek Venus E V3 (n units)
  - ZSF2400AC_<i>X<b> → Zendure SolarFlow 2400 AC (i inverters,
                       b batteries per inverter)

Anything else renders a fallback alert with a link back to the
calculator. Page is fully static (no network calls); manufacturer
specs are hard-coded. Photo placeholders included; the user will
drop real images in later.

Spec: docs/superpowers/specs/2026-04-17-product-specs-page-design.md
EOF
)"
```

- [ ] **Step 6: Self-review**

Run:
```bash
git log --oneline -3
git status
git show --stat HEAD | head
```
Confirm:
- Top commit is yours, named "Add producten.html ...".
- `git status` shows a clean working tree (only previously-untracked plan file is allowed; nothing else).
- Single file changed (`producten.html`, ~290 insertions).

---

### Task 2: Add `📖 Productspecs ↗` button per config in `index.html`

**Files:**
- Modify: `/home/ubuntu/battery-roi-tool/index.html` — one CSS rule added (~line 443) and one HTML edit inside `renderResults`'s scenario-card forEach (~line 1400-1404).

After this task: each `config-group-header` in the calculator's results renders a small outlined button on the right; clicking it opens `producten.html?type=<TYPE>` in a new tab via `window.open(..., '_blank', 'noopener')`.

- [ ] **Step 1: Add the `.btn-spec` CSS rule**

Locate the `.config-specs-badge` rule (around line 438). Use Edit to replace this exact `old_string`:

```
    .config-specs-badge {
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 6px; padding: 3px 10px;
      font-size: 0.8rem; font-weight: 500; color: var(--text);
      margin-left: auto;
    }
```

with this `new_string`:

```
    .config-specs-badge {
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 6px; padding: 3px 10px;
      font-size: 0.8rem; font-weight: 500; color: var(--text);
      margin-left: auto;
    }
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

`.config-specs-badge` already uses `margin-left: auto`, which pushes it (and now the new button beside it) to the right end of the flex row. The `.btn-spec` button will sit immediately after the badge, with the existing `gap: 10px` from `.config-group-header` providing the spacing.

- [ ] **Step 2: Add the button to the `config-group-header` HTML**

Use Edit to replace this exact `old_string`:

```
    gridHTML += `<div style="grid-column:1/-1;">
      <div class="config-group-header">
        🔋 Configuratie ${idx+1}
        <span class="cfg-sub">${cfg.type} — ${cfg.omschrijving}</span>
        <span class="config-specs-badge">${fmt2(cfg.batCap)} kWh &nbsp;·&nbsp; ${fmt2(cfg.batInv)} kW omv. &nbsp;·&nbsp; ${Math.round(cfg.eff*100)}% eff &nbsp;·&nbsp; ${fmtEur(cfg.price)}</span>
      </div>
    </div>`;
```

with this `new_string`:

```
    gridHTML += `<div style="grid-column:1/-1;">
      <div class="config-group-header">
        🔋 Configuratie ${idx+1}
        <span class="cfg-sub">${cfg.type} — ${cfg.omschrijving}</span>
        <span class="config-specs-badge">${fmt2(cfg.batCap)} kWh &nbsp;·&nbsp; ${fmt2(cfg.batInv)} kW omv. &nbsp;·&nbsp; ${Math.round(cfg.eff*100)}% eff &nbsp;·&nbsp; ${fmtEur(cfg.price)}</span>
        <button class="btn-spec" onclick="window.open('producten.html?type=${encodeURIComponent(cfg.type)}', '_blank', 'noopener')">📖 Productspecs ↗</button>
      </div>
    </div>`;
```

`encodeURIComponent` is defensive — config type names are already URL-safe alphanumerics (e.g. `MARVE03_X3`, `ZSF2400AC_2X2`), but encoding guards against any future product naming that might use special characters.

- [ ] **Step 3: Verify**

Run:
```bash
grep -n "\.btn-spec {" /home/ubuntu/battery-roi-tool/index.html
grep -n "\.btn-spec:hover" /home/ubuntu/battery-roi-tool/index.html
grep -n "📖 Productspecs ↗" /home/ubuntu/battery-roi-tool/index.html
grep -n "window.open('producten.html" /home/ubuntu/battery-roi-tool/index.html
```

Expected: 1 hit each (4 hits total — 2 CSS rules, 1 button text, 1 onclick handler).

```bash
grep -n "encodeURIComponent(cfg.type)" /home/ubuntu/battery-roi-tool/index.html
```
Expected: 1 hit.

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/battery-roi-tool
git add index.html
git commit -m "$(cat <<'EOF'
Add 📖 Productspecs button per config in calculator results

Each config-group-header in renderResults now ends with a small
outlined button that opens producten.html?type=<cfg.type> in a
new tab (noopener). One button per selected configuration.

Spec: docs/superpowers/specs/2026-04-17-product-specs-page-design.md
EOF
)"
```

- [ ] **Step 5: Self-review**

Run:
```bash
git diff HEAD~1 -- index.html | head -40
git log --oneline -3
git status
```

Confirm:
- The diff shows two hunks: a CSS hunk near `.config-specs-badge` adding `.btn-spec` rules, and an HTML hunk inside `renderResults` adding the `<button>` element.
- Top commit is yours.
- Working tree is clean (only previously-untracked plan file allowed).

---

## Self-review (controller, before handing off)

**Spec coverage:**
- Spec § Architecture and URL flow → Task 1 (page + URL parser); Task 2 (button generates the URL).
- Spec § Page structure (header, configuration banner, product sections, footnote, photo placeholders) → Task 1 step 2 (full HTML/JS).
- Spec § Styling (CSS variables, .product-section, .hero-photo, .spec-table, .config-totals, .photo-gallery, etc.) → Task 1 step 2 (embedded `<style>` block).
- Spec § Index.html change (button + CSS) → Task 2 (both edits).
- Spec § URL contract (Marstek + Zendure regex patterns + fallback) → Task 1 step 2 (entry-point block).
- Spec § Edge cases (missing/unknown `?type=`, fallback alert) → Task 1 step 2 (renderFallback).
- Spec § Verification → Task 1 step 3 (grep) + Task 2 step 3 (grep) + user-driven manual browser smoke.

**Placeholder scan:** Every step has actual code or actual commands. The "Foto … volgt" strings inside the rendered page are user-facing copy (intentional placeholders for images that don't exist yet), not implementation placeholders.

**Type/name consistency:**
- `MARSTEK_PER_UNIT`, `ZENDURE_PER_INVERTER`, `ZENDURE_PER_BATTERY` constants defined in Task 1 step 2 and used inside the same step's renderers.
- `fmtKwh` / `fmtKw` helpers consistent across both renderers.
- Regex patterns `^MARVE03_X(\d+)$` and `^ZSF2400AC_(\d+)X(\d+)$` match the spec's URL contract table.
- Button URL in Task 2 matches `producten.html?type=<TYPE>` per the spec; `encodeURIComponent` adds defensive encoding without changing observable behaviour.
- `.btn-spec` CSS class name in Task 2 step 1 matches what step 2's `<button>` references.
