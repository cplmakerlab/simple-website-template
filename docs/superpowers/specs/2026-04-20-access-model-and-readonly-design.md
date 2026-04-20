# Access Model & Read-Only Share-Links — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Predecessor:** `2026-04-18-firebase-projects-design.md` (Phase 1) + `2026-04-20-project-metadata-design.md`

## Goal

Voorkomen dat een klant op de kale calculator (`index.html` zonder querystring) uitkomt en zelf een volledige berekening kan maken — dat zou een lead wegnemen (klant doet het zelf i.p.v. contact op te nemen). Tegelijk moet Kevin/Ruben een **deel-link** kunnen sturen naar een klant die de berekening **alleen kan bekijken**, niet bewerken of opnieuw doen.

Om dit robuust te maken worden drie ingrepen samen gedaan die één samenhangend toegangsmodel vormen:

1. **Bare `index.html` afschermen** — redirect naar `dashboard.html` zodat een random bezoeker de login-wall ziet, net zoals op het dashboard.
2. **Product-sheet URL naar Firestore** — de hard-coded Google Sheet URL verdwijnt uit de HTML en wordt opgehaald uit een Firestore doc dat enkel leesbaar is voor ingelogde whitelisted users. Defense-in-depth: zelfs als iemand de redirect omzeilt (view-source, localhost, enz.), krijgt hij geen product-configuraties dus geen berekening.
3. **Read-only modus voor `?data=<b64>` share-links** — inputs disabled, Bereken-knop verborgen, duidelijke banner. Bestaande share-link flow blijft werken (geen URL-schema-wijziging), de klant ziet alleen het resultaat.

## Non-goals

- **Security-grade afscherming** — client-side redirect is bewust obscurity, niet cryptografische beveiliging. De echte data-afscherming zit in Firestore rules.
- **Private GitHub repo** — wordt door Kevin apart beslist; niet in deze spec.
- **Whitelist naar Firestore** — circulair probleem, blijft in code (`firebase-init.js` + rules).
- **"Unlock" knop op read-only links** — klant kan niet omschakelen naar edit. Kevin die een berekening wil aanpassen gaat via het dashboard + project.
- **Andere config-data naar Firestore** (bv. prijs-multipliers, UI-strings) — enkel de sheet URL verhuist. YAGNI voor de rest.
- **Retro-actief oude share-links migreren** — bestaande `?data=<b64>` links blijven gewoon werken; ze worden voortaan alleen read-only weergegeven.

## Scope samenvatting

| Gebied | Wijziging |
|---|---|
| Firestore | Nieuw doc `config/products` met `{ csvUrl: string }`. Security rule: read vereist whitelist, write = false (handmatig via console). |
| `firebase-init.js` | Nieuwe helper `getProductsConfig()` die het doc ophaalt. Geen signature-wijzigingen aan bestaande functies. |
| `index.html` | (a) Top-of-body redirect script voor bare mode. (b) `SHEET_CSV_URL` constante verwijderd — `loadConfigs()` gebruikt nu `getProductsConfig()`. (c) Nieuwe `readonly-mode` toestand die geactiveerd wordt wanneer `?data=<b64>` geladen is; disabled inputs, verborgen Bereken + share-acties, banner. |
| `dashboard.html` | Geen wijzigingen. |
| `project-edit.html` | Geen wijzigingen. |
| `CLAUDE.md` | Documenteert de drie nieuwe access-tier regels. |

## 1. Bare `index.html` redirect

Een bezoeker die `index.html` laadt zonder `?project=<id>` én zonder `?data=<b64>` krijgt een **onmiddellijke redirect** naar `dashboard.html` (via `window.location.replace` zodat er geen history-entry blijft).

Implementatie: een **inline `<script>`** direct na `<body>`, vóór enige content-rendering. Dit is een bewust klein, synchroon stukje code — niet in een externe file en niet in `DOMContentLoaded` — zodat de redirect zo vroeg mogelijk gebeurt. Voorbeeld:

```html
<body>
<script>
(function () {
  var p = new URLSearchParams(window.location.search);
  if (!p.has('project') && !p.has('data')) {
    window.location.replace('dashboard.html');
  }
})();
</script>
```

Gevolgen:
- Random bezoeker op root-URL → ziet kort wit scherm → landt op dashboard login.
- Kevin/Ruben die bookmark hebben op bare URL → idem → logint in via dashboard.
- Ingelogde Kevin die `index.html?project=<id>` of `?data=` opent → geen redirect, gewone flow.
- Klant met `?data=<b64>` link → geen redirect, read-only mode wordt geactiveerd (zie sectie 3).

Bewust **geen UI-toevoeging** op `index.html` (geen login-scherm inline). De dashboard doet die UX al; duplicatie vermijden we.

## 2. Product-sheet URL naar Firestore

### Firestore doc

Nieuwe collectie + doc: **`config/products`**

```json
{
  "csvUrl": "https://docs.google.com/spreadsheets/d/1BYNvK5nPm--nJWuim2rssC6W-ZcGHIfKLsifa4OSgTY/export?format=csv&gid=425908603"
}
```

Eenmalig te creëren door Kevin in de Firebase Console (copy-paste huidige URL uit `index.html:1199`). Verder onderhoud = aanpassen in console als de sheet ooit verhuist.

### Security rule

Toe te voegen aan de bestaande rules (Kevin past aan in console):

```
match /config/{doc} {
  allow read: if isWhitelisted();
  allow write: if false;
}
```

De `isWhitelisted()` functie bestaat al in de Phase 1 rules.

### Code: nieuwe helper in `firebase-init.js`

```js
async function getProductsConfig() {
  const snap = await getDb().collection('config').doc('products').get();
  if (!snap.exists) {
    throw new Error('Product-configuratie niet gevonden in Firestore (config/products).');
  }
  return snap.data();
}
```

Geeft het hele doc terug — dus `{ csvUrl }`. Toekomst-vriendelijk als er meer velden bijkomen.

### Code: `loadConfigs()` in `index.html`

De hard-coded `SHEET_CSV_URL` constante (`index.html:1199`) verdwijnt. `loadConfigs()` wordt:

```js
async function loadConfigs() {
  const statusEl = document.getElementById('configsStatus');
  statusEl.innerHTML = '<span class="spinner"></span> Laden...';
  try {
    const cfg = await getProductsConfig();     // ← nieuw, throws if not authed
    if (!cfg.csvUrl) throw new Error('config/products.csvUrl ontbreekt.');
    const resp = await fetch(cfg.csvUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    _sheetConfigs = _parseSheetConfigs(await resp.text());
    if (!_sheetConfigs.length) throw new Error('Geen configuraties gevonden in de sheet.');
    _populateConfigSelects();
    document.getElementById('configSelectorsArea').style.display = '';
    statusEl.textContent = `✅ ${_sheetConfigs.length} configuraties geladen.`;
  } catch (e) {
    statusEl.textContent = '❌ Laden mislukt: ' + (e && e.message ? e.message : e);
  }
}
```

Het verschil is precies één extra `await getProductsConfig()` + het gebruik van `cfg.csvUrl` i.p.v. de constante. De error-flow bij niet-ingelogd is dezelfde als bij een HTTP-fout: zichtbare foutmelding in de status-regel naast de knop.

### Gevolgen

- **`?project=<id>` mode** (Kevin/Ruben ingelogd) → `getProductsConfig()` werkt → alles zoals voorheen.
- **Bare mode** → redirect vuurt vóór `loadConfigs()` ooit wordt aangeroepen; onbereikbaar.
- **`?data=<b64>` mode** (read-only, niet ingelogd) → `loadConfigs()` wordt **niet meer aangeroepen** in read-only flow (zie sectie 3 — de knop is verborgen). Dus geen fout zichtbaar voor de klant.
- **Share-link restore** (`_applyLoadedState`) roept in de huidige code `loadConfigs()` aan op regel 1176 (`loadConfigs().then(() => _populateConfigSelects(f.selectedConfigTypes)).catch(() => {});`). Dit blijft draaien maar zal bij niet-ingelogde user `.catch(() => {})` doen — de dropdowns blijven dus leeg / disabled. De restore van de **resultaten** (scenario-kaarten, capaciteitsanalyse, energy chart) hangt **niet** af van `_sheetConfigs`: die komt volledig uit het `?data=` payload. UI werkt dus nog steeds, alleen de dropdowns tonen geen namen — en in read-only zijn die toch disabled. Accept.

## 3. Read-only modus voor `?data=<b64>` links

### Trigger

Wanneer de pagina geladen wordt met `?data=<b64>` én het state-object succesvol toegepast is via `_applyLoadedState`, zet de body class `readonly-mode` en render een nieuwe banner in `#loadedBanner`. Trigger ligt bij het einde van de `loadSharedState()`-flow die het data-param afhandelt (`index.html` rond regel 2122-2126).

In de code:

```js
function engageReadOnly() {
  document.body.classList.add('readonly-mode');
  const banner = document.getElementById('loadedBanner');
  banner.innerHTML = `
    <div class="alert alert-warning">
      🔒 <div>
        <strong>Gedeelde berekening — alleen-lezen.</strong>
        Dit is een voorstel dat je van je contactpersoon ontving.
        Heb je vragen of wil je aanpassingen? Neem contact op met je contactpersoon.
      </div>
    </div>`;
  banner.style.display = '';
}
```

Engaged na het toepassen van state op de restore-pad. **Project-mode** en **bare-mode** triggeren dit niet.

### Visuele effecten (CSS)

Eén nieuwe stylesheet-block:

```css
body.readonly-mode #csvUploadCard,
body.readonly-mode .btn-calculate,           /* Bereken knop */
body.readonly-mode label.btn-loadsave,       /* "Laden vanuit opgeslagen" */
body.readonly-mode #configSelectorsArea .btn-load-configs,  /* "Configuraties laden" */
body.readonly-mode #saveCard .btn-copyshare,                /* "Kopieer deellink" */
body.readonly-mode #shareUrlRow {
  display: none !important;
}
body.readonly-mode input,
body.readonly-mode select,
body.readonly-mode textarea {
  pointer-events: none;
  background: #f0f2f7;
  color: #6b7589;
  border-color: #d4dae5;
}
body.readonly-mode #results { /* resultaat-sectie blijft volledig zichtbaar en leesbaar */ }
```

Om dit te laten werken zonder brede regressies moeten de huidige knoppen een class krijgen die ze uniek identificeert (de `onclick="loadConfigs()"` is onvoldoende voor CSS-targeting). Minimale edits:

- `index.html:636` — `<button class="btn btn-secondary" onclick="loadConfigs()">` → voeg class `btn-load-configs` toe.
- `index.html:658-660` — `<button class="btn" onclick="calculate()">` → voeg class `btn-calculate` toe.
- `index.html:661-664` — het `<label class="btn btn-secondary">` wrapper van de JSON-load input → voeg class `btn-loadsave` toe.
- `index.html:732` — `<button class="btn btn-secondary" onclick="copyShareLink()">🔗 Kopieer deellink</button>` → voeg class `btn-copyshare` toe.

Bewust **niet** `display:none` op `.btn-download`. De klant kan een eigen JSON-snapshot bewaren — geen reden die te verbergen.

### Inputs disabled

Alle `<input>` / `<select>` / `<textarea>` in de parameter- + config-kaarten worden visueel uitgeschakeld via de CSS (`pointer-events:none` + grijs). Bewust **niet** het HTML `disabled` attribuut zetten via JS: dat zou de waarden onvindbaar maken voor een eventuele rerender, en `pointer-events:none` volstaat voor "klant kan niks aanklikken". De waarden zijn al ingevuld door `_applyLoadedState`, dus zichtbaar als read-only display.

Tab-through via keyboard blijft technisch mogelijk (pointer-events blokkeert dat niet), maar zonder Bereken-knop kan de klant toch niks meer doen. Geen wijziging waard.

### Banner visibility

De bestaande `#loadedBanner` wordt vandaag gevuld door `_applyLoadedState` met een generieke "Berekening geladen" boodschap (regel 1180 e.v.). In read-only modus overschrijven we die met de read-only boodschap hierboven. In project-mode of bij een lokale JSON-load blijft de generieke boodschap.

Logica: in `_applyLoadedState(state, showBanner)` bestaat al het `showBanner` argument. Read-only engage gebeurt **na** `_applyLoadedState` dus de banner wordt gewoon overschreven door `engageReadOnly()`.

## 4. Dashboard onveranderd

Dashboard.html heeft geen wijzigingen nodig. Het blijft de enige "front door" voor Kevin/Ruben.

## Edge cases

- **`?data=<b64>` met ingelogde Kevin** — dan krijgt Kevin óók de read-only view. Bewust: consistency > flexibility. Wil hij bewerken → via dashboard → project. De `?data=` link is definitionally een snapshot, niet een editable state.
- **`?data=<invalid-b64>`** — bestaande foutafhandeling blijft werken (de generieke error toast). Read-only wordt **niet** geactiveerd want `_applyLoadedState` faalt. De pagina valt terug naar bare — die redirect-triggers op basis van query params; vraag: wat gebeurt er? Bij een data-param dat aanwezig is maar ongeldig → pagina blijft op index.html tonen (de redirect vuurt niet want `p.has('data')` is true). Resultaat: bezoeker ziet bare calculator met een foutmelding. Dit is acceptabel (zeldzaam + de sheet URL is nu toch niet meer reachable zonder auth, dus geen berekening mogelijk). Geen extra logica nodig.
- **`?project=<id>` + niet-whitelisted** — bestaande Phase 1 gedrag: redirect naar dashboard. Ongewijzigd.
- **Pre-2026-04-20 share-links zonder config-data** — v:1-4 saves hebben wel `configResults` (dat is altijd aanwezig in de saved state). Read-only toont die gewoon als tekst in de scenario-kaarten. Dropdowns blijven leeg (geen sheet-lookup) maar in read-only zijn die toch onbruikbaar. Accept.
- **Sheet URL ontbreekt in Firestore** — `loadConfigs()` in project-mode toont een duidelijke foutmelding ("Product-configuratie niet gevonden in Firestore"). Kevin moet eenmalig het `config/products` doc aanmaken vóór de eerste deploy (zie setup-checklist hieronder).

## Setup checklist (Kevin, eenmalig)

Uit te voeren in de Firebase Console vóór deploy:

1. **Firestore → Data tab** → "Start collection" → collection id `config` → document id `products` → add field `csvUrl` (string) met waarde `https://docs.google.com/spreadsheets/d/1BYNvK5nPm--nJWuim2rssC6W-ZcGHIfKLsifa4OSgTY/export?format=csv&gid=425908603` → Save.
2. **Firestore → Rules tab** → toevoegen binnen het bestaande `match /databases/{database}/documents { ... }` blok:
   ```
   match /config/{doc} {
     allow read: if isWhitelisted();
     allow write: if false;
   }
   ```
   → Publish.
3. Na deploy: verifieer door ingelogd te zijn als kevin@bloxit.be, naar een bestaand project te gaan, en "🔄 Configuraties laden" te klikken. Moet werken. Log uit en probeer nogmaals → moet falen met de duidelijke foutmelding.

## Implementatie-volgorde (ter info — voor plan-skill)

1. Helper `getProductsConfig()` in `firebase-init.js`.
2. `index.html`: redirect-script bovenaan `<body>`.
3. `index.html`: `SHEET_CSV_URL` weg, `loadConfigs()` gebruikt `getProductsConfig()`.
4. `index.html`: classes `.btn-calculate`, `.btn-loadsave`, `.btn-load-configs`, `.btn-copyshare` toegevoegd aan de bestaande knoppen.
5. `index.html`: CSS-block voor `body.readonly-mode`.
6. `index.html`: `engageReadOnly()` functie + aanroep in de `?data=<b64>` restore-flow.
7. `CLAUDE.md`: documenteer bare-redirect + Firestore `config/products` + read-only mode.
8. Setup-checklist manueel uitvoeren door Kevin (Firestore data + rules).

Ongeveer één commit per punt, één push aan het einde.
