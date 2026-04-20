# Project-Mode UI Polish — Design Spec

**Date:** 2026-04-20
**Status:** Draft
**Context:** Follow-up iteraties na de Firebase-projects + project-metadata + access-model releases. Kevin gebruikt het nu echt voor klantwerk en wil zes concrete verbeteringen aan de calculator/dashboard-UX.

## Goal

Zes kleine, onafhankelijke UX-verbeteringen, samen uit te rollen omdat ze allemaal in `index.html` of `dashboard.html` zitten en in één ronde te doen zijn:

1. **Dashboard**: snelle link naar een project waar al een berekening is opgeslagen.
2. **Installatieparameters kaart**: verberg de hele kaart als alle velden door het project ingevuld zijn.
3. **Laden vanuit JSON-bestand**: verwijder de feature volledig (project mode heeft dit vervangen).
4. **Config-dropdowns**: van vast 3 naar onbeperkt aantal; dynamisch "een extra dropdown wanneer de huidige laatste er een waarde krijgt"; al-gekozen configs disabled tonen in de andere dropdowns.
5. **"📊 Resultaten" kaart**: verwijderen omdat de informatie erin elders herhaald wordt.
6. **Energy chart legend**: gemiddelden tonen als gestippelde lijn (nu: gestippelde rechthoek) + duidelijkere labels.

## Non-goals

- Geen visuele herziening van de scenario-kaarten, capaciteitsanalyse of chart body zelf.
- Geen wijzigingen aan het save-payload schema (v:5 blijft). De `selectedConfigTypes` array is al willekeurig lang onder v:5 dus daar moet niks aan bumpen.
- Geen wijziging aan share-link read-only mode, project-edit flow, of dashboard CRUD flow buiten de nieuwe knop.
- Geen "verwijder config" knop per dropdown. User clears een dropdown door terug op `— Kies —` te zetten.

## Scope per tweak

Elke tweak wordt hieronder afzonderlijk beschreven zodat de implementer per-item kan werken.

---

### T1 — Dashboard: direct-open naar opgeslagen berekening

Wanneer een project-document een `lastCalcRun` bevat (niet-null, dus er is al eens berekend) toont het dashboard per rij een **extra knop** `💾` tussen `📂 Open` en `✏ Bewerken`. Klik = navigeer naar `index.html?project=<id>#results`. Het hash-fragment `#results` wordt door `index.html` opgevangen en na het renderen van de bestaande resultaten auto-scrollt de pagina naar het resultaten-blok.

**Waarom hash-scroll**: niet elke rij opent noodzakelijk op resultaten. `📂 Open` blijft de neutrale "open het project" actie (landt bovenaan de pagina). `💾` is "toon me de berekening" en scrollt meteen tot waar resultaten beginnen.

**Knop alleen getoond als** `p.lastCalcRun && p.lastCalcRun.calculatedAt`. Anders `editBtn` + `delete/restore` zoals vandaag, zonder 💾.

**Scroll-target**: de eerste `.card` in `#results` die daadwerkelijk zichtbaar is (bestaande Resultaten-card verdwijnt in T5, dus scroll-target wordt de eerste zichtbare card in `#results`, doorgaans het Samenvatting-kaartje of de eerste scenario-kaart). Concreet: `document.querySelector('#results .card')` + `scrollIntoView({behavior:'smooth', block:'start'})`. Fires éénmaal, in `index.html`'s existing bootstrap, nadat `_applyLoadedState` is voltooid.

---

### T2 — Installatieparameters kaart verbergen als leeg

Vandaag: kaart `<h2>🔧 Installatieparameters</h2>` wrapt `#pvInverter`, `#elecPrice`, `#elecPriceNight`. In project-mode verbergt `applyProjectToCalcForm` elke `.form-group` wrapper waarvan de projectwaarde niet-null is. Resultaat: als project alle drie invult, blijft de kaart zichtbaar maar leeg (enkel de h2).

**Fix**: geef de kaart een id (`#installParamsCard`). Aan het einde van `applyProjectToCalcForm` checken: als alle drie form-groups verborgen zijn → hele kaart `display:none`. Ook omgekeerd consistent: als project later via sync-back aangevuld wordt en applyProjectToCalcForm opnieuw zou aangeroepen worden, komt de logica nog kloppen.

**Zelfde patroon** is niet van toepassing op de Productconfiguratie-kaart (dropdowns zijn altijd zichtbaar).

---

### T3 — "Laden vanuit opgeslagen berekening" weghalen

Uit de HTML verwijderen:
- De `<label class="btn btn-secondary btn-loadsave">` + zijn `<input type="file" id="loadSaveFileTop">` naast de Bereken-knop (rond regel 697-702).
- De `<label class="btn btn-secondary">📂 Laden vanuit JSON</label>` + zijn `<input type="file" id="loadSaveFile">` in de save-card (rond regel 762-765).

Uit de JS verwijderen:
- Functie `loadFromJSONFile(e)` (rond regel 1181-1194) volledig.

Wat **blijft**: `copyShareLink()` (deel-URL genereren), `downloadSave()` (JSON snapshot downloaden), de `_applyLoadedState` functie zelf (nog gebruikt door `?data=<b64>` share-link restore flow en door `buildSavedFromProject` → `_applyLoadedState` in project-mode).

---

### T4 — Onbeperkt aantal config-dropdowns

**Huidige gedrag**: drie vaste `<select>` elementen (`#config1Select` / `#config2Select` / `#config3Select`) in een `.config-picker-grid`. `_populateConfigSelects` populateert alle drie. `calculate()`, `_serializeState`, `_applyLoadedState` itereren over de drie harde IDs.

**Nieuw gedrag**:
- Eén container `<div id="configPickerList">` met **dynamisch geïnjecteerde** picker-rijen. Beginstaat = één picker (de verplichte Configuratie 1).
- Zodra een picker een niet-lege waarde krijgt, verschijnt er automatisch één extra lege picker eronder.
- Wanneer er N pickers zijn waarvan K gevuld, toont de UI exact `K + 1` pickers — de extra is altijd de "volgende" en altijd leeg.
- Al-gekozen types zijn in de andere pickers gemarkeerd als **disabled** (graag uit + niet selecteerbaar), niet verwijderd. Dit voorkomt dubbele selectie zonder "waar is die config naartoe?" verwarring.
- User clears een picker door terug op de default-optie (`— Kies —`) te zetten. Als dat de laatste niet-lege was → de trailing lege picker collapseert (render houdt altijd `K+1`).
- Geen expliciete "verwijder"-knop per rij. Clearing via de dropdown zelf is de enige weg om een config weg te halen.

**Label-tekst per rij**:
- Rij 0: `Configuratie 1 *` (verplicht marker blijft).
- Rij 1+: `Configuratie N+1 (optioneel)`.

**Renderer**: één functie `renderConfigPickers(selectedTypes)` vervangt `_populateConfigSelects`. Input: een array van `types` (lege strings filteren). Wordt aangeroepen vanuit:
- `loadConfigs()` nadat de sheet gelezen is — initial render met lege selectie (of met huidige DOM waarden bij re-render na BTW/keuring wissel).
- Change-handler op élke `.config-select` — na mutatie roept het `renderConfigPickers(readSelectedConfigs())` aan en herbouwt. Dit is duur maar N is klein (max ~10 in de praktijk).
- `_applyLoadedState` wanneer een save herladen wordt — met de opgeslagen `selectedConfigTypes`.

**Reader**: `readSelectedConfigs()` leest alle `.config-select` elementen in DOM volgorde, mapt naar `.value`, filtert lege strings. Dit vervangt de `['config1Select','config2Select','config3Select'].map(...)` patronen in `calculate()` en `_serializeState`.

**Save-compat**: v:5 heeft al `selectedConfigTypes: string[]` zonder lengte-aanname — werkt out-of-the-box voor onbeperkt aantal. Geen versie-bump nodig.

**BTW/keuring wissel**: vandaag triggert een wijziging van `btwSelect` of `keuringSelect` een rerender van dropdowns (via bestaande listener, ~regel 2117-2120). Dit blijft zo — de nieuwe `renderConfigPickers` behoudt de huidige selectie en bouwt alleen options opnieuw met nieuwe prijzen.

---

### T5 — "📊 Resultaten" kaart weg

Het blok:
```html
<div class="card" style="margin-top:28px;">
  <h2><span class="icon">📊</span> Resultaten</h2>
  <div id="periodAlert"></div>
  <div id="scenarioAlert"></div>
  <div class="data-period" id="dataPeriod"></div>
</div>
```
(rond regel 710-715) wordt vervangen door:
```html
<div id="periodAlert"></div>
<div id="scenarioAlert"></div>
```
Deze twee divs blijven — de renderer zet ze op met de bestaande alert-logica (extrapolation warning + inverter-mismatch warning). Ze staan nu los en worden enkel rendered wanneer de alert-inhoud niet leeg is (de bestaande populatie-logica gebruikt al `innerHTML = '...'` conditioneel; als de inhoud leeg blijft zien ze er gewoon weggelaten uit omdat ze geen padding hebben).

`#dataPeriod` verdwijnt — "Totale afname/injectie periode" is redundant met wat de Samenvatting-kaart + Energy-chart al tonen. De JS-regel die `#dataPeriod.innerHTML = '...'` zet in `renderResults` wordt weggehaald.

**Null-safe**: na de wijziging doet `renderResults` nog `document.getElementById('periodAlert').innerHTML = ...` en `'scenarioAlert'` — die bestaan nog. `'dataPeriod'` wordt niet meer geraadpleegd.

---

### T6 — Chart legend: gemiddelden als gestippelde lijn + duidelijkere labels

**Wat Kevin ziet**: in de legend-balk onderaan de chart, de twee avg-datasets tonen als gekleurde rechthoeken met dashed-pattern eroverheen. Kevin wil daar gestippelde **lijntjes** zien (zoals de actual lijnen in de chart zelf).

**Oorzaak**: Chart.js' default legend rendering teekent voor elke dataset een `boxWidth × boxHeight` rechthoek gevuld met `dataset.backgroundColor` of omtrekt met `borderColor`. Dashed lines worden dan als dashed rechthoek-omtrek getekend.

**Fix**: override `plugins.legend.labels.generateLabels` in `_buildChartConfig`. De callback krijgt de default-items en kan per item `pointStyle`, `boxHeight`, `fillStyle`, etc. overschrijven. Voor de twee `type: 'line'` avg-datasets:
- `pointStyle: 'line'`
- `boxHeight: 1` (flatten de rechthoek tot lijn)

Voor de bar-datasets (Afname/Injectie) blijft de default rechthoek.

Extra: huidige labels `Ø afname` / `Ø injectie` → **`Gem. afname`** en **`Gem. injectie`**. Ø-symbool is ambigu voor sommige klanten die de chart te zien krijgen; "Gem." is expliciet Nederlands.

**Implementatie-detail**: Chart.js' `boxHeight` op een enkel label kan niet per-item gezet worden via `generateLabels` return-objecten direct — maar wel via het `options.plugins.legend.labels.boxHeight` dataset-level, of via `pointStyle` manipulation. Concreet gebruiken we:
```js
plugins: {
  legend: {
    position: 'bottom',
    labels: {
      usePointStyle: false,
      generateLabels: (chart) => {
        const defaults = Chart.defaults.plugins.legend.labels.generateLabels(chart);
        return defaults.map(item => {
          const ds = chart.data.datasets[item.datasetIndex];
          if (ds && ds.type === 'line') {
            // Render as a thin dashed line in the legend.
            item.pointStyle = 'line';
            item.lineDash = ds.borderDash || [6, 4];
            item.strokeStyle = ds.borderColor;
            item.fillStyle = ds.borderColor;
            // Make the legend slot visually flat:
            item.lineWidth = 2;
          }
          return item;
        });
      },
    },
  },
}
```
Dit werkt in Chart.js v4.x waar `usePointStyle` + een `pointStyle` per item de rendering aanstuurt. Voor de avg-datasets resulteert dat in een horizontaal lijntje met dashed pattern in plaats van een filled box.

Let op: de exacte Chart.js versie in gebruik moet gecontroleerd worden — bij oudere v2/v3 werkt dit pad anders. Als `generateLabels` overschrijven niet het gewenste visuele resultaat geeft, fallback = `boxWidth` op legend labels naar klein (10px) zetten en `boxHeight: 1` globaal — dat maakt ALLE legend items lijnen, ook de bars. Dat is visueel minder informatief. Eerst de `pointStyle: 'line'` aanpak proberen.

---

## Edge cases

- **T1 + hash fragment**: als een `?project=<id>#results` link wordt geopend maar er bestaat geen `lastCalcRun` (edge: project werd ondertussen gereset), wordt er niks gescrollt (geen `.card` in `#results`). Geen fout, gewoon geen scroll. Pagina blijft bovenaan. Accept.
- **T4 + geen _sheetConfigs**: bij eerste page-load voordat `loadConfigs()` aangeroepen is, is `_sheetConfigs = null`. De `#configSelectorsArea` is dan verborgen (bestaand gedrag). Eerste render van de pickers gebeurt pas binnen `loadConfigs()`. Geen verandering aan die timing.
- **T4 + project-mode heeft selectie maar sheet failt**: `_applyLoadedState` roept `loadConfigs()` aan met een `.catch(()=>{})`. Als de fetch faalt → geen sheet → `renderConfigPickers` kan niet met die selectie renderen (geen options beschikbaar). Huidig gedrag: stil falen. Behouden zoals nu.
- **T5 + inverter-mismatch warning**: die hangt aan `#scenarioAlert`; die div blijft bestaan, gewoon niet meer in een card-wrapper. Warning blijft werken.
- **T6 + oude Chart.js zonder `generateLabels` support**: zeldzaam — de repo gebruikt de CDN-versie die in de HTML ingeladen wordt. Fallback beschreven hierboven.

## Bestandsstructuur

Alle wijzigingen zitten in twee bestaande files — geen nieuwe files. Geen breaking change op share-link schema.

- `dashboard.html` — T1.
- `index.html` — T2, T3, T4, T5, T6.
- `CLAUDE.md` — korte verwijzing naar de tweaks.

## Implementatie-volgorde (voor plan-skill)

1. T3 (weghalen laden-vanuit-JSON) — cleanup-only, minste risico, eerst uit de weg.
2. T5 (Resultaten kaart weg) — cleanup-only, verwante renderResults-regels aanpassen.
3. T2 (Installatieparameters verbergen) — kleine toevoeging aan applyProjectToCalcForm.
4. T1 (Dashboard 💾 knop + hash-scroll) — twee bestanden, simpel.
5. T6 (Chart legend) — kleine tweak in `_buildChartConfig`.
6. T4 (Onbeperkt config-dropdowns) — grootste wijziging, komt als laatste zodat eerder opgeschoond HTML eenvoudiger te testen is.
7. CLAUDE.md update.
8. Push.
