# Config lifecycle simplification

**Date:** 2026-04-23
**Status:** design approved, implementation pending

## Problem

Het huidige config-model heeft drie states (selected / dismissed / orphan) en
zes UI-acties per kaart (upload, download, replace, delete-PDF-only, dismiss,
restore). De `dismissedConfigs` split veroorzaakt verwarring: een klant die
via de read-only share-link kijkt ziet nog steeds "Niet geoffreerd"-kaarten
voor configs die eigenlijk weg moeten zijn, en in de backoffice moet de
gebruiker twee stappen zetten om iets echt te verwijderen (dismiss → zien →
delete-PDF separately).

De werkelijke workflow is lineair:
1. Bij klant op bezoek: geen configs. Via de calc view worden er meerdere
   toegevoegd/verwijderd tijdens het bezoek.
2. Na het bezoek: voor de nog relevante configs een offerte-PDF uploaden.
3. Later overleg met klant: "deze optie gaan we niet doen" → config weg uit
   de backoffice, incl. eventuele offerte.

Dismiss/restore heeft geen plaats in deze workflow. Wat we nodig hebben is
één `delete` operatie die cascadeert (config + PDF + Storage blob).

## Scope

**In-scope:**
- `dismissedConfigs` retireren (niet meer lezen/schrijven; oude data blijft
  inert als legacy-veld op bestaande project-docs).
- `deleteProjectConfig(projectId, type)` — nieuwe cascade helper (vervangt
  `hardDeleteProjectConfig`).
- `saveLastCalcRun` uitbreiden: cascade-delete PDFs voor types die NIET meer
  in de nieuwe `selectedConfigTypes` staan.
- Calc-view confirm-dialog vóór Bereken wanneer de save een config met
  bijbehorende PDF gaat verwijderen.
- `offertes-ui.js` UI updaten: dismissed-block verwijderen, trash-knop wordt
  hard-delete, restore-knop verdwijnt.
- `needsOfferteWarning` vereenvoudigen.
- `CLAUDE.md` docs updaten.

**Out-of-scope:**
- Migratie-script voor bestaande `dismissedConfigs` data (niet nodig —
  inert legacy, drie productie-projecten).
- Wijzigingen aan de offerte upload/replace modal zelf.
- Wijzigingen aan de share-link flow (`?s=<id>`, `?data=<b64>`) — die
  payloads bevatten al geen `dismissed`-lijst aan de leeszijde.
- Wijzigingen aan het calc-view config-picker-mechanisme (add-UX blijft
  identiek).
- `index.html` read-only-mode redesign — configs zijn daar al alleen-lezen
  zichtbaar via `renderResults`.

## Data model

### Blijft ongewijzigd

- `project.lastCalcRun.inputs.selectedConfigTypes: string[]` — enige
  source-of-truth voor "welke configs horen bij dit project".
- `project.offertes: { [type]: { storagePath, filename, sizeBytes, contentType, uploadedAt, uploadedBy } }`
  — PDF metadata per type.
- `projects/{id}/offertes/{type}_{ts}.pdf` Storage blob per PDF.

### Verdwijnt uit reads + writes

- `project.dismissedConfigs: string[]` — wordt niet meer gelezen, niet meer
  geschreven. `mergeProjectMetadata` stopt met dit veld te defaulten.

### Nieuwe invariant

Elke key in `project.offertes` MOET een type zijn dat in
`lastCalcRun.inputs.selectedConfigTypes` staat. Als deze invariant schendt →
bug. `saveLastCalcRun` en `deleteProjectConfig` zijn de enige writers; beide
bewaren de invariant.

### Legacy handling

Bestaande project-docs kunnen een `dismissedConfigs` array bevatten met types
uit een vorige iteratie. Deze data wordt niet gebruikt. De types verschijnen
niet meer in de UI. Geen actieve opruim — het veld blijft aanwezig op oude
docs tot het natuurlijk overschreven wordt door een `updateProjectMetadata`
call die het niet meer zet (wat gebeurt omdat `mergeProjectMetadata` het
niet meer produceert).

## Helpers — `assets/js/firebase-init.js`

### Verwijderd

- `dismissProjectConfig(projectId, type)` — delete volledig.
- `restoreProjectConfig(projectId, type)` — delete volledig.
- `hardDeleteProjectConfig(projectId, type)` — delete volledig (vervangen
  door nieuwe `deleteProjectConfig` hieronder; identieke functionaliteit,
  betere naam).

### Nieuw

`deleteProjectConfig(projectId, type)` — hard delete met cascade:

```js
async function deleteProjectConfig(projectId, type) {
  const ref  = projectDoc(projectId);
  const snap = await ref.get();
  const data = snap.data() || {};
  const types = (data.lastCalcRun && data.lastCalcRun.inputs && Array.isArray(data.lastCalcRun.inputs.selectedConfigTypes))
    ? data.lastCalcRun.inputs.selectedConfigTypes.filter(t => t !== type)
    : [];
  const pdfPath = data.offertes && data.offertes[type] && data.offertes[type].storagePath;

  await ref.update({
    'lastCalcRun.inputs.selectedConfigTypes': types,
    [`offertes.${type}`]: firebase.firestore.FieldValue.delete(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  if (pdfPath) {
    try { await firebase.storage().ref(pdfPath).delete(); }
    catch (e) { console.warn('Offerte blob verwijderen mislukt', e); }
  }
}
```

### Aangepast: `saveLastCalcRun`

De huidige functie schrijft `lastCalcRun` en bewaart de `selected ∩ dismissed
= ∅` invariant via een `arrayRemove(...selected)`. Die invariant verdwijnt.
In de plaats komt PDF-cascade:

1. Lees huidig `data.offertes` en `data.lastCalcRun.inputs.selectedConfigTypes`
   (= `prevSelected`) uit een fresh `get()`.
2. `newSelected = saved.inputs.selectedConfigTypes` (de array die we gaan
   wegschrijven).
3. `removedWithPdf = prevSelected.filter(t => !newSelected.includes(t) && data.offertes?.[t])`
4. De Firestore `update()` bevat naast `lastCalcRun`:
   - Voor elke `t` in `removedWithPdf`: `offertes.${t}` → `FieldValue.delete()`.
5. Na `update()` commit: voor elke `t` in `removedWithPdf` een best-effort
   Storage-blob delete (geen throw bij falen, alleen `console.warn`).
6. Het oude `dismissedConfigs: arrayRemove(...selected)` gedeelte wordt
   verwijderd.

Dit cascadeert automatisch ook wanneer de calc-view confirm geskipped werd
(bv. geen PDFs op het spel). Het is een pure set-diff cleanup.

### Vereenvoudigd: `needsOfferteWarning(project)`

Huidig:
```js
function needsOfferteWarning(project) {
  // ...
  const dismissed = new Set(Array.isArray(project.dismissedConfigs) ? project.dismissedConfigs : []);
  // ...check selected minus dismissed...
}
```

Nieuw:
```js
function needsOfferteWarning(project) {
  if (!project || !project.lastCalcRun) return false;
  const types = (project.lastCalcRun.inputs && Array.isArray(project.lastCalcRun.inputs.selectedConfigTypes))
    ? project.lastCalcRun.inputs.selectedConfigTypes
    : [];
  if (types.length === 0) return false;
  const offertes = project.offertes || {};
  return types.some(t => !offertes[t]);
}
```

### `mergeProjectMetadata`

Verwijder:

```js
merged.dismissedConfigs = Array.isArray(project.dismissedConfigs)
                            ? project.dismissedConfigs : [];
```

Verwijder ook eventuele verwijzing naar `dismissedConfigs` in
`newEmptyProjectMetadata()`.

## Calc-view confirm — `index.html`

Voor de `Bereken`-click-handler die `saveLastCalcRun` aanroept, nieuwe
pre-flight:

```js
async function _confirmConfigCascade(projectId, newSelectedTypes) {
  if (!projectId) return true; // no-project mode — geen PDFs mogelijk
  const snap = await projectDoc(projectId).get();
  const data = snap.data() || {};
  const prevSelected = (data.lastCalcRun && data.lastCalcRun.inputs
                        && Array.isArray(data.lastCalcRun.inputs.selectedConfigTypes))
    ? data.lastCalcRun.inputs.selectedConfigTypes : [];
  const offertes = data.offertes || {};
  const removedWithPdf = prevSelected.filter(t =>
    !newSelectedTypes.includes(t) && offertes[t]);

  if (removedWithPdf.length === 0) return true;

  const label = removedWithPdf.join(', ');
  const msg = removedWithPdf.length === 1
    ? `De config "${label}" heeft een offerte-PDF. Als je doorgaat wordt die ook verwijderd.\n\nDoorgaan?`
    : `De configs "${label}" hebben offerte-PDF's. Als je doorgaat worden die ook verwijderd.\n\nDoorgaan?`;
  return confirm(msg);
}
```

Call-site: in de Bereken-handler vlak vóór `saveLastCalcRun(...)` een
`if (!(await _confirmConfigCascade(projectId, selectedTypes))) return;`.

`confirm()` in plaats van een custom Bootstrap modal houdt de diff klein;
kan later herzien als UX dit vraagt.

## UI — `assets/js/offertes-ui.js`

### `renderOffertesCards(project)`

- `const dismissed = new Set(project.dismissedConfigs || []);` — verwijder.
- `const active = types.filter(t => !dismissed.has(t));` — vervangen door
  `const active = types;`.
- `const inactive = Array.from(dismissed);` — verwijder.
- De `inactiveCards` block (Niet geoffreerd divider + kaarten met restore-knop)
  → verwijder helemaal.
- Early-return guard `if (active.length === 0 && inactive.length === 0) return '';`
  wordt `if (active.length === 0) return '';`.
- Return-expressie wordt `activeBlock` (zonder `+ inactiveCards`).

Per-kaart acties:
- **Geen PDF**: `fa-upload` (open modal) · `fa-trash` (delete cascade).
- **Met PDF**: `fa-download` · `fa-pen-to-square` (replace) ·
  `fa-file-circle-xmark` (alleen PDF wissen — ongewijzigd) ·
  `fa-trash` (delete config + PDF cascade).

Tooltip op `fa-trash` wordt bijgewerkt:
- Nieuw: `"Config verwijderen (incl. offerte)"` of `"Config verwijderen"`
  (afhankelijk van of er een PDF is — conditioneel, net zoals andere
  tooltips).

De CSS-class `offerte-trash-btn` en `data-offerte-action data-type=...`
blijven identiek zodat de click-handler-wiring op dezelfde knop blijft haken;
alleen het target helper verandert.

### `wireOffertesClicks`

Branch-handler voor `offerte-trash-btn`:
```js
else if (btn.classList.contains('offerte-trash-btn')) {
  await deleteProjectConfig(project.id, type);
  if (typeof onChange === 'function') await onChange();
}
```

Branch voor `offerte-restore-btn`: **delete volledig** (knop bestaat niet
meer).

Branch voor `offerte-deletepdf-btn` blijft ongewijzigd.

De voormalige comment boven de trash-branch (`// Always dismiss — config
blijft onder "Niet geoffreerd" staan...`) → verwijder.

### Globals-lijst bovenaan `offertes-ui.js`

Verwijder `dismissProjectConfig` en `restoreProjectConfig` uit de
`/* global ... */` JSDoc-header. Voeg `deleteProjectConfig` toe.

## Testing (manueel — repo heeft geen test suite)

1. **Backoffice delete zonder PDF** — drawer of project-edit, klik `fa-trash`
   op een config zonder PDF. Config verdwijnt. Firestore `selectedConfigTypes`
   bevat het type niet meer. `offertes` ongewijzigd (want leeg).
2. **Backoffice delete met PDF** — idem met een config die wel een PDF heeft.
   Config verdwijnt. Firestore `selectedConfigTypes` niet meer, `offertes[t]`
   is weg, Storage blob `projects/{id}/offertes/{t}_*.pdf` is weg.
3. **Calc remove zonder PDF** — open calc met project, verwijder type uit
   picker, Bereken. Geen confirm-dialog. Type weg uit `selectedConfigTypes`.
4. **Calc remove met PDF** — idem maar het type had een PDF. Confirm-dialog
   verschijnt (OK/Cancel). Op Cancel: niks gebeurt (calc-run niet
   uitgevoerd, geen save). Op OK: calc-run voert uit, type weg uit
   `selectedConfigTypes`, `offertes[t]` weg, Storage blob weg.
5. **Calc bereken zonder wijziging** — gewone recalculatie, geen configs
   verwijderd. Geen confirm. `saveLastCalcRun` past alleen andere inputs aan
   — `offertes` ongewijzigd.
6. **Legacy project met `dismissedConfigs`** — projects.{id} doc met array
   in dat veld. Opent in drawer, project-edit, calc: geen errors, geen
   "Niet geoffreerd" sectie meer, de types in `dismissedConfigs` komen niet
   meer terug.
7. **`needsOfferteWarning`** — project met 2 selected types, 1 zonder PDF,
   1 met PDF: warning blijft rood. Project met alle PDFs: geen warning.
   Project dat legacy `dismissedConfigs` data heeft: wordt genegeerd.
8. **Share-links** — `?s=<id>` en `?data=<b64>` tonen configs op dezelfde
   manier als vandaag (snapshot-based); geen dismissed-UI aanwezig.

## Rollout

Een of twee commits op een feature-branch, daarna fast-forward merge naar
`gh-pages` en push. Eerste test op een productie-project via dashboard.
Geen feature-flag nodig.

## CLAUDE.md update

Na merge: de "Offerte PDF upload per config (2026-04-21, herzien 2026-04-22)"
paragraaf herschrijven:
- Dismiss-semantiek verwijderen.
- Per-config actions: trash wordt hard-delete cascade (incl. PDF).
- `deleteProjectConfig` helper vermelden, `dismissProjectConfig` /
  `restoreProjectConfig` / `hardDeleteProjectConfig` uit de helpers-lijst
  verwijderen.
- Nieuwe calc-view confirm-flow vermelden.
- Opmerking dat `dismissedConfigs` een legacy-veld is dat genegeerd wordt.
