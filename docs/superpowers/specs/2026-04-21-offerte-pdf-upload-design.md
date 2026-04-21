# Offerte PDF Upload per Configuratie — Design Spec

**Date:** 2026-04-21
**Status:** Draft
**Predecessors:**
- `2026-04-20-project-metadata-design.md` (project schema)
- `2026-04-20-dashboard-workspace-design.md` (drawer, warnings, status phases)

## Goal

Toevoegen van een manuele offerte-PDF upload per berekende configuratie op project-niveau. Zodra Kevin of Ruben een offerte heeft opgemaakt kunnen ze die PDF aan de juiste config koppelen, kunnen ze configs die niet (meer) geoffreerd zijn uit de warning houden, en wordt er vanuit de drawer duidelijk gemaakt welke configs nog een PDF nodig hebben.

Secundair scope: Font Awesome 6 uitrollen over de hele app zodat de bestaande emoji-iconen en de nieuwe offerte-iconen één consistente stijl hebben.

## Non-goals

- **Automatische PDF-generatie** vanuit calculator data. Offertes worden manueel opgemaakt in externe tooling en als PDF geüpload.
- **Versie-historiek per offerte.** Opnieuw uploaden overschrijft de vorige PDF. Geen archief van eerdere versies.
- **Meerdere offertes per config.** Strikt één PDF per config-type. Nieuw upload = replace.
- **Offerte-management in `index.html`** (calculator). De feature leeft puur in de dashboard-drawer. Calculator blijft pure berekening.
- **Offerte-info in share-links.** Klant-facing `?s=<id>` / `?data=<b64>` tonen nooit offertes — privacy + prijsbescherming.
- **Offerte-goedkeuring tracking** (wie accepteerde welke, wanneer). Status-enum (`wacht_op_beslissing`, `akkoord`, …) blijft het enige mechanisme.
- **Project-edit.html krijgt geen offerte-UI.** Alles via de drawer.

## Scope samenvatting

| Gebied | Verandering |
|---|---|
| Firestore schema | +2 top-level velden op project-doc: `offertes: { [configType]: {...} }`, `dismissedConfigs: string[]` |
| Firebase Storage | Nieuw pad `projects/{projectId}/offertes/{configType}_{timestamp}.pdf` |
| `firebase-init.js` | 5 nieuwe helpers + `mergeProjectMetadata` defaults + `needsOfferteWarning` predicate |
| `dashboard.html` | Offerte-modal + CSS, Configs-sectie upgrade met rij-state, offerte-warning banner, FA migratie |
| `project-edit.html` | Enkel FA migratie (geen offerte-UI) |
| `index.html` | Enkel FA migratie (geen offerte-UI) |
| Storage rules | Nieuwe rule voor `projects/{projectId}/offertes/**` (whitelisted-only read+write) |
| Iconen | FA 6 Free via cdnjs, volledige emoji→FA mapping over de 3 HTML-files |

## Data model

Uitbreiding van het Firestore `projects/{id}` document. Additief — bestaande velden ongewijzigd. Default waardes worden geïnjecteerd door `mergeProjectMetadata`.

```text
// — Bestaand (Phase 2, ongewijzigd) —
projectName, customerName, status, createdBy, ...
lastCalcRun:       { inputs: { selectedConfigTypes: string[], ... }, results, ... }

// — Nieuw —
offertes: {
  [configType: string]: {
    storagePath:  string,      // "projects/{id}/offertes/{type}_{ts}.pdf"
    filename:     string,      // originele filename bij upload
    sizeBytes:    number,
    contentType:  string,      // altijd "application/pdf"
    uploadedAt:   Timestamp,
    uploadedBy:   string       // email
  }
}
dismissedConfigs: string[]     // subset van lastCalcRun.inputs.selectedConfigTypes
                               // configs die NIET geoffreerd worden; uit warning
```

**Waarom top-level map ipv sub-collectie** (zoals photos): max ~4 configs per project, 1 PDF per config. Een map op het hoofddoc kost 1 read (de project-fetch die de dashboard-rij sowieso al doet) tegenover N+1 voor een sub-collectie. Dashboard kan per rij direct groen/oranje vinkje bepalen zonder extra fetch.

**Stable key = `cfg.type`.** `selectedConfigTypes` is een `string[]` van type-codes (bv. `"MARVE48-5K"`, `"ZENDURE15"`). Type-codes zijn uniek per project (pickers disable al-gekozen types). Geen risico op collisions.

**Re-calc edge case.** Bij re-Bereken in `index.html?project=<id>` raakt `saveProjectCalcRun` enkel `lastCalcRun`; `offertes` en `dismissedConfigs` blijven ongemoeid. Als een config uit `selectedConfigTypes` verdwijnt blijft `offertes[configType]` in de DB staan maar rendert niet meer (iteratie loopt over huidige `selectedConfigTypes`). Als dezelfde config later terug toegevoegd wordt verschijnt de oude PDF opnieuw — pragmatisch, geen data-verlies bij accidentele re-calc.

## Dismiss- en delete-gedrag

Twee verschillende paden, uniforme trigger (één `fa-trash` knop in de rij), verschillende handler afhankelijk van of er een PDF hangt.

**Config zónder PDF — soft-dismiss:**
- Eén klik op `fa-trash`. Geen confirm.
- Verschijnt in `dismissedConfigs`. Drawer-rij wordt grijs/doorgestreept, onder een `── Niet geoffreerd ──` scheidingslijn.
- Telt niet mee voor `needsOfferteWarning`.
- Knop wordt `fa-rotate-left` (restore) om terug naar actief-oranje te zetten.

**Config mét PDF — hard-delete:**
- Klik op `fa-trash`. **Confirm-dialog**: *"Je verwijdert ook de bijgevoegde offerte PDF. Zeker weten?"*
- Bevestig → cascade:
  1. Verwijder Storage blob (`storagePath`).
  2. Verwijder `offertes[configType]` uit project-doc.
  3. Verwijder `configType` uit `lastCalcRun.inputs.selectedConfigTypes`.
- De config is daarna volledig weg uit de project-view. Geen soft-state — verwijderd is verwijderd.

**Terug toegevoegd via calc:** clean slate. Moet opnieuw geüpload worden. Geen "komt vanzelf terug" (want bij hard-delete hebben we de PDF blob echt weggegooid, in tegenstelling tot de re-calc-zonder-offerte-wijziging edge case).

**Geen aparte "permanent verwijder dismissed config" actie.** Soft-dismiss is eindstation tot een volgende calc-ronde; bij re-Bereken zonder die config verdwijnt hij organisch.

## Helpers in `firebase-init.js`

Analoog aan de photo-helpers (`uploadProjectPhoto` etc.). Allen returnen Promises.

```js
// Upload nieuwe PDF voor een config; verwijdert vorige blob als die bestond.
uploadProjectOfferte(projectId, configType, file) -> Promise<{storagePath, ...metadata}>

// Hard-delete: verwijder Storage blob + map-entry. Laat selectedConfigTypes ongemoeid.
deleteProjectOfferte(projectId, configType) -> Promise<void>

// Cascade hard-delete voor de dismiss-flow-met-PDF: blob + map-entry + type uit selectedConfigTypes.
hardDeleteProjectConfig(projectId, configType) -> Promise<void>

// Soft-dismiss: voeg configType toe aan dismissedConfigs array (idempotent).
dismissProjectConfig(projectId, configType) -> Promise<void>

// Restore: verwijder configType uit dismissedConfigs.
restoreProjectConfig(projectId, configType) -> Promise<void>

// Predicate gebruikt door dashboard voor rij-icoon en drawer-banner.
needsOfferteWarning(project) -> boolean
  // true als phaseForStatus(project.status) === "offerte"
  //     én er bestaat een type in selectedConfigTypes
  //        die niet in dismissedConfigs zit én niet in offertes map.
```

Daarnaast:

```js
// Defaults in mergeProjectMetadata:
project.offertes         = project.offertes         || {};
project.dismissedConfigs = Array.isArray(project.dismissedConfigs)
                            ? project.dismissedConfigs : [];
```

**Download-URL** wordt on-demand via `firebase.storage().ref(storagePath).getDownloadURL()` opgehaald wanneer de drawer rendert of de download-knop geklikt wordt. Geen cache — URL's hebben een token dat verlopen kan. Analoog aan foto-lightbox.

## Upload-modal

Eerste modal in de codebase. Minimale generieke basis (herbruikbaar voor latere modals).

**Gedrag:**
- Overlay + centered dialog, klik-buiten-sluit, Escape-sluit, ✕ close in rechterbovenhoek.
- Auto-sluit na succesvolle upload. **Geen Opslaan-knop** (drop = save).
- Accept: `application/pdf` (input + drag-drop MIME check). Andere types → inline error "Enkel PDF-bestanden".
- Max 10 MB. Te groot → inline error. (De photos-feature heeft vandaag geen size-limit; ik introduceer die hier nieuw enkel voor offertes — PDFs met megabyte-scans zijn een veelvoorkomende bron van Firestore/Storage-kostenoverval.)
- Tijdens upload: drag-drop zone toont `Uploaden… 42%` via Storage upload-progress.

**Layout (één config per modal):**

```
┌─────────────────────────────────────────┐
│ Offerte uploaden                    ✕   │
├─────────────────────────────────────────┤
│ MARVE48-5K · Marstek Venus 5kWh         │
│ 5 kWh · 2.5 kW omvormer · € 4.290       │
├─────────────────────────────────────────┤
│  (bestaande PDF:)                       │
│   fa-file-pdf  offerte-venus-v2.pdf     │
│  Geupload door Kevin op 21 apr 2026     │
│  ┌─ Sleep nieuwe PDF om te vervangen ─┐ │
│  │        of klik om te kiezen         │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  (nieuwe upload:)                       │
│  ┌─ Sleep offerte PDF hier of klik ───┐ │
│  │      om een bestand te kiezen       │ │
│  └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│                         [Annuleren]     │
└─────────────────────────────────────────┘
```

**Prijs-bepaling** voor de config-header: hergebruik van `_getPriceKey(project)` logica — BTW afgeleid via `effectiveBtwFor(project)` (Phase 2), keuring uit `calcDefaults.inspectieGekozen`, dan `cfg[priceKey]`.

**Triggers:**
- Drawer per-config: `fa-upload` (nog geen PDF) of `fa-pen-to-square` (bestaande PDF). Beide openen dezelfde modal.
- Warning-banner heeft **géén** CTA-knop — de upload-knoppen per rij staan direct eronder en zijn duidelijk genoeg (minder UI-ruis).

## Drawer — Configs sectie upgrade

De bestaande `Configs` sectie (dashboard.html lines ~983-992) wordt uitgebreid met offerte-status per rij. Geen aparte nieuwe drawer-sectie — alles rond een config blijft op één plek.

**Rij-layout met state:**

```
┌ Configs ─────────────────────────────────────────┐
│                                                  │
│ 🟢 fa-circle-check  MARVE48-5K · Marstek Venus  │
│    € 4.290 · 5 kWh · 2.5 kW                     │
│    fa-file-pdf offerte-venus-v2.pdf              │
│    [fa-download] [fa-pen-to-square] [fa-trash]   │
│                                                  │
│ 🟠 fa-triangle-exclamation  ZENDURE15 · Zendure │
│    € 6.120 · 15 kWh · 3.6 kW                    │
│    Offerte nog niet toegevoegd                   │
│    [fa-upload] [fa-trash]                        │
│                                                  │
│ ── Niet geoffreerd ──                            │
│ MARVE10-3K · Marstek Venus 10kWh (grijs)         │
│                                   [fa-rotate-left]│
│                                                  │
└──────────────────────────────────────────────────┘
```

**Kleurconventies:**
- Groene staat (`fa-circle-check`, `.icon-ok`) → `#16a34a`
- Oranje staat (`fa-triangle-exclamation`, `.icon-warn`) → `#f59e0b`
- Rode destructieve hover (`.icon-danger`) → `#dc2626`
- Dismissed rij → `opacity: 0.5; text-decoration: line-through;` op de tekst, icoontjes blijven click-baar

## Drawer — offerte-warning banner

Volledig analoog aan de bestaande ground-fault banner (dashboard.html lines 951-958). Zelfde `alert alert-warning` class.

**Predicate:** `needsOfferteWarning(project)` — true als `phaseForStatus(project.status) === 'offerte'` én er is een niet-dismissed config zonder PDF.

**Plaatsing in drawer:** direct onder de ground-fault warning (indien die ook toont), boven het contact-blok. Twee warnings kunnen naast elkaar bestaan.

**Tekst:**

```
fa-triangle-exclamation  Offertes ontbreken
Dit project staat in offerte-fase maar N config(s) hebben nog geen offerte PDF.
```

Geen CTA-knop — de upload-knoppen in de Configs-sectie daaronder zijn zelfstandig duidelijk.

**Rij-icoon in dashboard-lijst** (analoog aan ground-fault `fa-triangle-exclamation` op de rij): wanneer `needsOfferteWarning(project)` → extra warning-icoontje in de project-rij zodat je niet in de drawer hoeft te kijken om te zien dat er offertes open staan.

## Font Awesome 6 migratie

**Setup:**
- Font Awesome 6 Free via cdnjs. Versie-pin op stabiele tag (bv. 6.5.2) zodat FA-updates de UI niet op eigen houtje wijzigen.
- `<link>` in de `<head>` van `dashboard.html`, `project-edit.html`, `index.html`.
- Enkel `solid` stijl gebruikt. Markup: `<i class="fa-solid fa-..." aria-label="..."></i>`

**Volledige emoji → FA mapping:**

| Huidig | Gebruik | FA class | Kleur |
|---|---|---|---|
| 🧮 | dashboard rij "Open berekening" | `fa-calculator` | default |
| ✏ | dashboard "Bewerk project"; offerte "Vervangen" | `fa-pen-to-square` | default |
| 🗑 | dashboard rij "Soft-delete project"; offerte "Dismiss/delete config" | `fa-trash` | `.icon-danger` op hover |
| ↶ | dashboard "Restore project"; offerte "Restore dismissed" | `fa-rotate-left` | default |
| ❌ | dashboard "Permanent hard-delete project" | `fa-circle-xmark` | `.icon-danger` |
| 💬 | dashboard "Ongelezen comments van andere user" | `fa-comment-dots` | default (pulse-animatie blijft) |
| ❗ | dashboard ground-fault warning (rij + banner) | `fa-triangle-exclamation` | `.icon-danger` (rood) |
| 📷 | drawer Photos-sectie header | `fa-images` | default |
| 🗂 | dashboard Lijst/Bord toggle (Bord-kant) | `fa-table-columns` | default |
| — | dashboard Lijst-view toggle (Lijst-kant, voor symmetrie) | `fa-list` | default |
| ✅ *nieuw* | offerte-rij "PDF aanwezig" | `fa-circle-check` | `.icon-ok` (groen) |
| ⚠️ *nieuw* | offerte-rij "PDF ontbreekt" + offerte-warning banner/rij | `fa-triangle-exclamation` | `.icon-warn` (oranje) |
| ⬆ *nieuw* | offerte-rij "Upload" | `fa-upload` | default |
| ⬇ *nieuw* | offerte-rij "Download" | `fa-download` | default |
| 📄 *nieuw* | offerte-rij filename prefix | `fa-file-pdf` | default |

**Iconenset is bewust uniform — ground-fault warning en offerte-missing gebruiken hetzelfde `fa-triangle-exclamation`, kleurverschil (rood vs oranje) draagt urgentie.**

**Emoji's in copy** (bv. confirm-dialog tekst, label-strings) blijven emoji — enkel *UI-iconen* (knoppen, indicators) worden geport.

**Scope-verificatie tijdens implementatie:** volledige scan van de drie HTML-files op `[\u{1F300}-\u{1FAFF}]`-range emoji's + tekst-iconen (✓ ✗ → ← ↶ etc.) om niks te missen. Als de lijst uitbreidt → inline toegevoegd met dezelfde stijlconventies.

## Interactie met bestaande paden

**1. Calculator re-run (`saveProjectCalcRun`):** raakt alleen `lastCalcRun` aan. `offertes` en `dismissedConfigs` blijven. Zie "Re-calc edge case" onder Data model.

**2. Share-links (`?s=<id>` en `?data=<b64>`):** offertes leven puur op het project-doc, niet in `_saved` / `_serializeState`. Share-snapshots bevatten dus automatisch geen offerte-data. Geen code-wijziging nodig; wel expliciet opgenomen in test-plan.

**3. `index.html` in project-mode:** geen offerte-UI. Calculator blijft pure berekening. De dashboard-drawer is de enige offerte-administratie plek.

**4. Dashboard-row ground-fault warning:** blijft ongewijzigd (andere predicate). Kan naast offerte-warning bestaan; beiden tonen een `fa-triangle-exclamation` — rood (ground-fault) en oranje (offerte). Tooltip op hover onderscheidt.

**5. `project-edit.html`:** enkel FA migratie, geen offerte-UI. Project-creatie en -bewerking raakt de nieuwe velden nooit direct.

## Firestore & Storage rules

**Firestore:** geen nieuwe rule. De bestaande `projects/{id}` update-rule (whitelisted writes) dekt `offertes` en `dismissedConfigs` automatisch — het zijn gewoon extra velden op hetzelfde doc.

**Storage:** nieuwe rule voor het offertes-pad:

```
match /projects/{projectId}/offertes/{path=**} {
  allow read, write: if isWhitelisted();
}
```

Niet publiek — offertes bevatten prijsinfo die we niet via directe Storage-URL willen lekken, zelfs niet aan klanten die een oude share-link hebben. Downloads gebeuren via `getDownloadURL()` met short-lived token, enkel gegenereerd voor ingelogde gebruikers.

## Manual test-plan

Geen automated tests in de repo. Handmatig walkthrough:

1. **Basis upload:** drawer → upload-knop per config → modal opent → PDF drop → modal sluit → drawer re-rendert met `fa-circle-check` groen + filename + download werkt in nieuw tabblad.
2. **Re-upload replace:** opnieuw uploaden → oude Storage blob verdwenen (check Firebase console), nieuwe zichtbaar, nieuwe uploadedAt/uploadedBy in Firestore.
3. **Niet-PDF geweigerd:** sleep een `.jpg` → inline error "Enkel PDF-bestanden", geen write.
4. **Te grote PDF geweigerd:** upload > 10 MB → inline error, geen write.
5. **Dismiss zonder PDF:** klik `fa-trash` op config zonder PDF → direct grijs onder scheidingslijn, warning banner verdwijnt (als dit de enige niet-PDF was).
6. **Dismiss met PDF — confirm + hard-delete:** klik `fa-trash` op config mét PDF → confirm-dialog → bevestig → PDF weg uit Storage, configType weg uit `selectedConfigTypes`, config volledig verdwenen uit drawer.
7. **Dismiss met PDF — annuleer:** zelfde flow, klik annuleer in confirm → niks gewijzigd.
8. **Restore dismissed:** `fa-rotate-left` knop op dismissed config → terug naar actief-oranje.
9. **Warning-banner verschijnt:** status op `offerte_uit` zetten met >= 1 non-dismissed config zonder PDF → banner in drawer + rij-icoon in dashboard-lijst.
10. **Warning-banner verdwijnt:** status terug naar `bezoek_gepland` → warning weg ook al staat de offerte nog open. Status op `afgesloten` → warning weg. Offerte uploaden voor de laatste open config → warning weg.
11. **Share-link clean:** project met offertes → genereer share-link → open in incognito → geen offerte-info in DOM, geen Storage 404 in console.
12. **Re-calc zonder wijziging:** Bereken opnieuw in `index.html?project=<id>` → PDF-info blijft 1:1 bewaard in drawer.
13. **Re-calc met minder configs:** verwijder een config uit calculator, Bereken → die config verdwijnt uit drawer; `offertes[configType]` is nog in DB (check Firestore).
14. **Re-calc met die config terug:** voeg config weer toe, Bereken → oude PDF verschijnt terug in drawer zonder re-upload.
15. **FA visuele check:** alle geporte iconen in dashboard-rij, board-toggle, drawer-secties, offerte-rij, banners renderen als FA-iconen in correcte kleur; geen resterende emoji in UI-knoppen.
16. **Permissions sanity:** uitloggen, probeer direct een Storage URL `projects/X/offertes/...` op te halen → 403. Probeer project-doc met `offertes`-veld te lezen zonder whitelist → denied.

## File-by-file impact

| Bestand | Wijziging |
|---|---|
| `assets/js/firebase-init.js` | +5 offerte-helpers, +`needsOfferteWarning` predicate, `mergeProjectMetadata` defaults voor `offertes` + `dismissedConfigs` |
| `dashboard.html` | Offerte-modal markup + CSS (generieke modal basis), offertes state per rij in Configs-sectie, offerte-warning banner in drawer, offerte-warning icoon in project-rij, FA CDN + volledige icoon-migratie, drag-drop + upload-progress JS |
| `project-edit.html` | FA CDN + icoon-migratie (geen offerte-UI) |
| `index.html` | FA CDN + icoon-migratie (geen offerte-UI) |
| `storage.rules` *(of waar de Firebase rules leven)* | +1 match-block voor `projects/{id}/offertes/**` |

## Open items (voor plan-fase)

- Exacte FA versie kiezen uit de 6.x reeks (laatste stable die cdnjs serveert).
- Bepalen of de modal-open state via hash-fragment of puur in-memory bewaard wordt (cosmetic; geen deep-link use case).
- Dubbelcheck tijdens implementatie: worden er ergens in `index.html` project-rijen gerenderd met emoji-iconen die ik nog niet in de migratie-tabel heb? Zo ja → inline toevoegen.
