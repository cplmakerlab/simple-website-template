# Project-edit UX vereenvoudiging — Design

**Datum:** 2026-04-22
**Status:** Design (pre-plan)
**Scope:** `project-edit.html`, `dashboard.html`, `index.html`, `assets/js/firebase-init.js`, `assets/css/smartpeak.css`

## Aanleiding

`project-edit.html` toont vandaag **11 accordion-secties** die allemaal ongeveer even prominent zijn:
Basisgegevens · Klantcontact · Situatie & notities · Leverancier & tarieven · Woning · Elektrische aansluiting · Zekeringkast · Zonnepanelen & omvormer(s) · Voorkeuren berekening · Foto's · CSV.

Dat is te veel visuele ruis. In de praktijk heeft ieder project twéé soorten data:
een klein **berekeningsminimum** (klantnaam, omvormer-vermogen, BTW, leverancier-prijs, CSV)
dat nodig is om de ROI-calculator te draaien, en een grotere hoeveelheid
**vervolg-info** (contactgegevens, site-survey details, foto's) die pas relevant
wordt voor offerte / uitvoering. De huidige indeling verbergt die hiërarchie.

## Doelstellingen

- Reduceer 11 secties naar **4 top-level blokken** met duidelijke scope.
- Plaats het berekeningsminimum altijd zichtbaar bovenaan, in één samenhangend blok.
- Benut brede schermen (≥ lg) via een responsive grid.
- Maak de "Opslaan & Bereken"-actie altijd bereikbaar (sticky action bar) én pas
  actief zodra de calculator alle nodige input heeft.
- Maak project-aanmaak laagdrempeliger: enkel `customerName` is hard required;
  `projectName` wordt optioneel en fungeert als override-label.
- Maak mobiel foto-nemen directer (camera i.p.v. alleen file picker).
- Voeg de basis voor serienummer-registratie toe (text-inputs + optionele foto
  per serienummer) — barcode/OCR is **out of scope** voor deze iteratie en komt
  in een vervolg-spec.

## Niet-doelen

- De berekening zelf (`index.html` calculator-logica) verandert niet.
- De share-link-payload (v:5) wijzigt niet van versie; de extra velden
  (`serialNumbers`) leven top-level op het project-doc en worden niet in de
  share-snapshot meegestuurd.
- Barcode-OCR op serienummer-foto's wordt niet geïmplementeerd.
- De kanban-board-fasen en status-enum veranderen niet.

## Informatie-architectuur

### Blok A · "Voor de berekening" (altijd open, bovenaan, full-width)

Bundelt het complete berekeningsminimum + de CSV. Volgorde van top tot onder:

| Rij | Velden |
|-----|--------|
| Identiteit | Klantnaam * · Projectnaam (optioneel) |
| Woning | Leeftijd woning: ○ ≥ 10 jaar (6%) · ○ < 10 jaar (21%) · ○ Onbekend |
| Leverancier | Tarief: ○ Enkel · ○ Dag/nacht · Prijs dag (€/kWh) · Prijs nacht (€/kWh, alleen zichtbaar bij dag/nacht) |
| Omvormer | Totaal vermogen (kW) * · "Beheer per omvormer" link → Blok C (zie onder voor gedrag) |
| CSV | Drag-drop zone + knop "Kies bestand"; toont bestandsnaam en aantal dagen na upload |

Onder de blok-content een **disclosure `▸ Extra opties`** die de minder
gebruikte calc-overrides toont: Keuring ja/nee (gevolgen voor prijskolom),
BTW handmatig (als woning-leeftijd = Onbekend), Leverancier-naam (trivia).

### Blok B · "Klant & situatie"

Samenvoeging van Basisgegevens (status), Klantcontact, Situatie & notities.
Eén card met alle contactinfo die nodig is voor vervolgstappen (offerte-gesprek,
plaatsbezoek, opvolging):

- Status-chip (dropdown zoals in dashboard drawer)
- Adres (straat + nr, postcode + gemeente)
- Telefoon (`tel:` link bij tonen in drawer blijft werken)
- E-mail (`mailto:` link idem)
- Vrij notitieveld (textarea, uitbreidbaar)

### Blok C · "Technische opmeting"

Samenvoeging van Elektrische aansluiting + Zekeringkast + Omvormer-details
(merk/model/panelen/kringen/ligging per omvormer).

**Verhouding "Totaal kW" (Blok A) ↔ per-omvormer `powerKw` (Blok C)**:

Er is maar één bron van waarheid in het datamodel: `solar.inverters[].powerKw`.
De "Totaal kW"-input in Blok A is een slimme shortcut die zich aanpast aan het
aantal bestaande omvormers:

- **0 omvormers**: bij typen in Blok A wordt automatisch één `inverter`-entry aangemaakt met die `powerKw`.
- **Precies 1 omvormer**: Blok A toont en bewerkt de `powerKw` van die ene entry rechtstreeks (two-way binding).
- **2+ omvormers**: Blok A toont de som readonly met label *"Som van N omvormers — beheer in Technische opmeting"* en een deeplink-knop die Blok C opent en scrollt naar de omvormer-lijst. Individuele waarden zijn daar editeerbaar; de som in A update live.

Dit voorkomt dubbele invoer en sluit aan bij de user-intentie: simpele projecten
(één omvormer) invullen via Blok A; complexe projecten via Blok C.

Velden per sub-sectie:

- **Aansluiting:** Type aansluiting (select uit `CONNECTION_TYPES`) · Zekeringsterkte Fluvius-zijde (A)
- **Zekeringkast:** Vrije modules · Rem-automaat (tri-state) · Diameter bekabeling (mm²) · Stopcontact bij Fluvius (tri-state) · Wifi bij Fluvius (tri-state) · Plaats voor batterijen (tri-state) · Wifi bij zekeringkast (tri-state) · Meting fase↔aarde uitgevoerd (checkbox, verplicht voor Zendure)
- **Omvormer(s)-details:** Dynamische lijst van kaarten. Per kaart: powerKw · merk · model · aantal panelen · aantal kringen · ligging

### Blok D · "Foto's & serienummers"

Twee sub-secties binnen één card:

**D1 · Foto's** (huidige gedrag behouden, plus mobile camera capture):
- Desktop: drag-drop zone + knop "Kies bestanden"
- Mobile: twee knoppen → "Foto maken" (`<input type="file" accept="image/*" capture="environment">`) en "Kiezen uit bibliotheek" (zelfde input zonder `capture`)
- Foto-grid met lightbox blijft identiek aan huidige implementatie

**D2 · Serienummers** (nieuw):
- Dynamische lijst text-inputs. Lege trailing-input zoals in config-picker (`renderConfigPickers`-patroon); zodra user in de trailing input iets typt verschijnt er automatisch een nieuwe lege onder.
- Per gevulde rij: knop "Foto" (mobiel = camera capture) en delete-knop ×
- Foto hangt aan de specifieke serial-entry (geen gedeelde photo-grid)
- Barcode-OCR: **niet in scope**; de foto wordt opgeslagen zoals iedere andere project-foto

### Sticky action bar (onderaan viewport, altijd zichtbaar)

```
[ Annuleren ]    [ Opslaan ]    [ Opslaan & Bereken ]
```

- `position: sticky; bottom: 0` binnen de main-container
- Witte achtergrond met top-border schaduw om af te snijden van scroll-content
- Compact op mobiel (iconen + tekst; eventueel alleen iconen < sm)

**Enabled-logica voor "Opslaan & Bereken"**:

De knop is alleen actief als ALLE onderstaande inputs gevuld zijn
(hetzij via dit formulier, hetzij al in het project-doc opgeslagen):

1. `customerName` niet leeg
2. Totaal omvormervermogen > 0 kW (som van `solar.inverters[].powerKw`)
3. BTW-tarief bepaalbaar: `site.houseAgeOver10Years !== null` OF `calcDefaults.btw != null`
4. Leverancier-prijs: `supplier.priceDay > 0` (en als `supplier.isSingleTariff === false` ook `supplier.priceNight > 0`)
5. CSV aanwezig: `csvUpload.dailyCompact` staat op project OF er is in deze edit-sessie een nieuw CSV geüpload

"Opslaan" (zonder Bereken) blijft altijd actief — partial saves waren al toegelaten en blijven zo, dit is een eigenschap van de edit-flow.

Disabled-tooltip (`title`-attribuut op de button): een lijst van de ontbrekende
inputs, bv. *"Nog ontbreekt: klantnaam, CSV, prijs dag"*. Live bijgewerkt bij
iedere input-change (debounced via `requestAnimationFrame`).

## Responsive layout

Bootstrap 5.3 grid, `.row.g-3` op de main-container.

**≥ lg (992px)**:
```
[  Blok A (col-12)  ]
[ Blok B col-lg-6 | Blok C col-lg-6 ]
[  Blok D (col-12)  ]
```

**md (768–991px)** en **< md**:
```
[ Blok A (col-12) ]
[ Blok B (col-12) ]
[ Blok C (col-12) ]
[ Blok D (col-12) ]
```

Blok A en Blok D zijn altijd full-width — de calc-inputs in A hebben interne
rijen die binnen de kaart al op `col-md-6`/`col-md-4` opgesplitst worden;
Blok D heeft de photo-grid die breedte wil.

Blokken B en C krijgen een collapse-toggle in de card-header:
standaard open, klikken op de header klapt in. Voorkeur onthouden in
`localStorage.smartpeak.editCardCollapsed` als `{B: bool, C: bool}` (niet
per-sectie — blokken zelf).

## Datamodel

### Wijziging 1 — `projectName` wordt optioneel

- Validatie in `project-edit.html` `collectFromForm()`: verwijder de check op `!projectName`. `customerName` blijft required.
- Helper `getProjectLabel(project)` toegevoegd in `firebase-init.js`:
  ```js
  function getProjectLabel(p) {
    return (p?.projectName?.trim()) || (p?.customerName?.trim()) || '(zonder naam)';
  }
  ```
- Alle call-sites die vandaag `p.projectName || ''` of `p.projectName || '(zonder naam)'` doen, schakelen over op `getProjectLabel(p)`:
  - `dashboard.html:279` (permdel data-name)
  - `dashboard.html:293` (lijst-rij knop)
  - `dashboard.html:448` (kanban-card title)
  - `dashboard.html:827` (drawer header)
  - `index.html:2434` (project banner pbName)
  - `project-edit.html:194` (page title)
- Zoekbalk-filter (`dashboard.html:361`) blijft concatenatie op beide velden — werkt ongewijzigd.

### Wijziging 2 — `project.serialNumbers`

Nieuw top-level array op het project-doc:
```js
project.serialNumbers = [
  { id: 'sn_xxx', value: 'ABC123', photoStoragePath: 'projects/<id>/serials/sn_xxx.jpg', uploadedAt: Timestamp, uploadedBy: '<email>' },
  { id: 'sn_yyy', value: 'ABC124', photoStoragePath: null, uploadedAt: null, uploadedBy: null }
];
```

- `newEmptyProjectMetadata()` returned `serialNumbers: []`.
- `mergeProjectMetadata(project)` defaultet `serialNumbers: []` voor bestaande projects.
- Nieuwe helpers in `firebase-init.js`:
  - `addProjectSerial(projectId, value)` → genereert id, voegt entry toe
  - `updateProjectSerial(projectId, serialId, patch)` → update value
  - `deleteProjectSerial(projectId, serialId)` → verwijdert entry (en bijbehorende Storage blob indien aanwezig)
  - `uploadProjectSerialPhoto(projectId, serialId, file)` → upload naar `projects/{id}/serials/{serialId}.jpg`, update entry
- Storage-rule: valt onder bestaande `/projects/{id}/{allPaths=**}` — geen nieuwe rule nodig.

## UI-components — nieuwe patronen

### Dynamische serienummer-lijst

Analoog aan `renderConfigPickers`-patroon in `index.html`: altijd N+1 rijen
waarvan de laatste leeg is. Bij `input` op de laatste rij (zodra er tekst
verschijnt) trigger een re-render met één extra lege rij.

### Sticky footer action bar

Nieuwe reusable CSS-class in `smartpeak.css`:
```css
.sticky-action-bar {
  position: sticky;
  bottom: 0;
  background: #fff;
  border-top: 1px solid var(--bs-border-color);
  padding: 0.75rem 1rem;
  z-index: 1020;
  box-shadow: 0 -4px 12px rgba(0,0,0,0.04);
}
```

### Card-collapse toggle

Bootstrap card + collapse (niet accordion). Header is een `<button>` met een
chevron-icon die roteert op `aria-expanded`. Zie detail-patroon in
`bootstrap docs › collapse`.

### Mobile camera capture

Twee file-input-elementen per upload-zone:
```html
<input type="file" accept="image/*" capture="environment" class="d-none" id="pePhotoCamera">
<input type="file" accept="image/*" multiple class="d-none" id="pePhotoGallery">
```
Plus twee knoppen die elk het corresponderende input triggeren. Op desktop is
"Foto maken" ook aanwezig maar valt terug op de file-picker (browsers zonder
camera negeren `capture` stil).

## Migratie / backwards-compat

- Bestaande projects zonder `serialNumbers`: behandeld als leeg (via `mergeProjectMetadata`).
- Bestaande projects zonder `projectName`: het label wordt automatisch de `customerName` via `getProjectLabel`.
- Huidige share-links (`?s=`, `?data=`) zien deze wijzigingen niet: serienummers worden niet meegestuurd in de v:5-payload, en de calculator gebruikt geen project-label.
- De 11 oude accordion-secties worden volledig vervangen door 4 nieuwe blokken. Er is geen mode-switch of feature-flag; de nieuwe layout wordt direct de enige layout.

## Acceptance criteria

1. `project-edit.html` toont exact 4 blokken: "Voor de berekening", "Klant & situatie", "Technische opmeting", "Foto's & serienummers".
2. Een nieuw project kan aangemaakt worden met enkel `customerName` ingevuld.
3. De "Opslaan & Bereken"-knop is disabled zolang één van de 5 calc-vereisten ontbreekt; hover toont welke ontbreken.
4. Op mobiel (`< md`) opent "Foto maken"-knop in Blok D direct de camera, niet de file picker.
5. Serienummer-invoer groeit automatisch: na tekst in de trailing input verschijnt een nieuwe lege onderaan.
6. Dashboard-lijst, kanban-bord en drawer tonen `customerName` als het project geen `projectName` heeft.
7. De sticky action bar blijft zichtbaar bij scrollen op zowel mobiel als desktop.
8. Responsive grid: op ≥ lg staan Blok B en C naast elkaar (2-col); op < lg gestapeld.
9. Blokken B en C kunnen ingeklapt worden; keuze onthouden tussen sessies.
10. Geen regressies in bestaande flows: photo-upload, CSV-upload, project-save, project-save+calculate, share-link-generatie, dashboard-crud.

## Out of scope / follow-up

- **Barcode/OCR op serienummer-foto's** — aparte spec wanneer deze iteratie live staat. Waarschijnlijke richting: client-side `BarcodeDetector` API (Chrome/Edge, niet Safari) met fallback op server-side OCR via een Cloud Function.
- **Per-serienummer type-label** (batterij vs omvormer vs module) — voor nu zijn alle entries gelijkwaardig. Pas toevoegen als Kevin/Ruben in de praktijk zien dat het onderscheid nodig is.
- **Bulk-import van serienummers** (CSV-lijst plakken) — voor nu één-voor-één invoeren.
