# Firebase Projects (Phase 1) — Design Spec

**Date:** 2026-04-18
**Scope:** Phase 1 of the multi-user project flow. Adds Firebase Auth + Firestore, a new `dashboard.html` landing page, and a `?project=<id>` mode for `index.html` that auto-saves calculations. Customer share-links keep the existing `?data=<b64>` mechanism (Phase 2 replaces this).

---

## Goal

Move from a single-page calculator-with-share-links to a shared-context tool where Kevin and Ruben can:
- create projects (per customer),
- track each project through 16 lifecycle statuses (from "Nieuw contact" to "Afgesloten" or "Niet akkoord"),
- both work in the same project across devices,
- upload a Fluvius CSV at creation OR later,
- run/re-run the ROI calculator inside a project — every "Bereken" call auto-saves the latest result.

After Phase 1, the existing public calculator (`index.html` zonder query) blijft beschikbaar; alleen het project-pad is login-gated. Phase 2+ vernauwen later de toegang.

## Non-goals (Phase 1)

- **Klant-share via Firestore** — blijft `?data=<b64>` URL-embedded zoals vandaag.
- **Multi-run history per project** — alleen de laatste calc-run wordt bewaard (`lastCalcRun`). Phase 3 zou dit splitsen in een sub-collection.
- **Klant-favoriet flag per geteste config** — Phase 3.
- **Gedetailleerde projectinfo** (adres, afspraakdatum, aantekeningen) — Phase 3.
- **Real-time co-editing waarschuwingen** — Phase 1 is last-write-wins op het hele doc.
- **Login verplichten op bare `index.html`** — pas in latere fase, expliciet uitgesteld.
- **Multi-tenant / role-based access** — Phase 4 als de tool buiten Kevin/Ruben zou opengaan.

---

## Storage choice (samenvatting)

**Firebase** (Firestore + Auth) gekozen na vergelijking met Google Drive shared folder. Argumenten:

- 2 actieve editors die hetzelfde project moeten kunnen openen — Firestore last-write-wins gedraagt zich voorspelbaarder dan een Drive folder met JSON-bestanden.
- "Overzicht" = één Firestore query; bij Drive zou dat alle JSON-bestanden moeten parsen.
- Firebase web SDK config is **publiek-by-design** (zelfde patroon als Google OAuth client ID) — kan dus veilig in publieke GitHub Pages code staan. Toegang wordt afgedwongen door server-side security rules.
- Auth via Google sign-in geeft Kevin/Ruben SSO zonder paswoord-management.
- Gratis tier (50k reads + 20k writes per dag, 1 GB opslag) is voor 2 verkopers + tientallen projecten ruim voldoende.

**Wat publiek mag** in deze repo: Firebase web config object (apiKey, authDomain, projectId, …) en alle client-side code. Toegang wordt enkel begrensd door (a) email-whitelist in security rules en (b) origin-restriction van het Firebase project.

**Wat niet publiek mag** (en dus ook niet nodig is voor deze opzet): service account JSON's, Firestore admin SDK keys, of gelijkaardige server-side credentials.

---

## File structure

- **`dashboard.html`** *(NIEUW)* — login-gated landing met project-lijst en "+ Nieuw project" formulier.
- **`index.html`** *(BESTAAND)* — krijgt nieuwe `?project=<id>` mode (laadt project uit Firestore, toont project-banner, auto-saves bij Bereken). Bare `index.html` (geen query) en `?data=<b64>` (legacy share-link) blijven 100% werken zonder login.
- **`producten.html`** — niet aangeraakt door deze fase (productspec-pagina blijft publiek toegankelijk via de share-link en directe URL).
- **Firebase JS SDK** — gebruik de **compat** builds zodat er geen ES-modules nodig zijn (consistent met de no-build-step filosofie). Pin op een specifieke versie:
  ```html
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js"></script>
  ```
  De modulaire SDK (`firebase/app`, `firebase/auth` import-statements) zou een build-step vergen; die wijken we daarom expliciet af.
- **Geen nieuwe assets** vereist; styling van `dashboard.html` deelt CSS-variabelen met `index.html` (kopieer `:root` palette en card/button stijlen voor consistentie).

---

## Auth

- Firebase Auth met Google sign-in provider.
- Twee whitelisted emails:
  - `kevin@bloxit.be`
  - `<ruben-email>` *(door Kevin nog door te geven; in de implementatie als placeholder die Kevin moet vervangen vóór deploy)*
- Sign-in flow op `dashboard.html`: Google popup → token in browser → Firestore-toegang via security rules.
- Token expiry ~1u; Firebase SDK refresh automatisch zolang de browser-tab open is.
- Bij `index.html?project=<id>` zonder geldige sessie: redirect naar `dashboard.html`. `dashboard.html` redirect terug naar `?project=<id>` na succesvolle login (return-URL via query param of sessionStorage).

---

## Data model

Eén Firestore collectie: `projects`. Elk document beschrijft één klant-project.

```js
{
  // — Metadata —
  projectName:     "De Meyer, Leuven",        // required at creation
  customerName:    "Bart De Meyer",            // required at creation
  status:          "klaar_voor_bezoek",        // required, see status enum below
  createdBy:       "kevin@bloxit.be",          // auto from Firebase Auth user
  createdAt:       <Firestore Timestamp>,
  updatedAt:       <Firestore Timestamp>,      // touched on any write
  deletedAt:       null | <Timestamp>,         // soft delete — ALWAYS set to null on creation (zonder explicit null faalt de Firestore `where('deletedAt', '==', null)` query op die docs)

  // — CSV (optional at creation, can be uploaded later) —
  csvUpload: null | {
    uploadedAt:    <Timestamp>,
    uploadedBy:    "kevin@bloxit.be",
    eanCode:       "541448820001234567",       // extracted by parseCSV/processData
    meterNr:       "1SAG..." ,
    meterType:     "tweevoudig",
    dailyCompact: {                             // identical structure to index.html v:5 dailyCompact
      startDate:     "2024-04-15",
      afname:        [<number>, ...],
      injectie:      [<number>, ...],
      afnamedag:     [<number>, ...],
      afnamenacht:   [<number>, ...],
      injectiedag:   [<number>, ...],
      injectienacht: [<number>, ...]
    }
  },

  // — Latest calculation result (null until first Bereken) —
  lastCalcRun: null | {
    calculatedAt:  <Timestamp>,
    calculatedBy:  "ruben@bloxit.be",
    inputs: {
      pvInv:                <number>,
      priceDay:             <number>,
      priceNight:           <number> | null,
      selectedConfigTypes:  [<string>, ...]
    },
    results: {
      // Volledige output van renderResults — het `r` object zoals door _serializeState
      // geproduceerd (totalAfname, totalInjectie, configResults, capAnalysis, monthMap,
      // numYears, yearsStart, avgTotals, dualTariff, effectivePrice, eanCode, meterNr, …).
      //
      // BELANGRIJK: strip `dailyCompact` voordat we naar Firestore schrijven — die zit al in
      // csvUpload, en bij restore wordt het uit csvUpload terug op het _saved object geplakt
      // (zelfde restore-pad als de v:5 share-link, maar met dailyCompact uit een ander veld).
      // Anders bewaren we de zware per-dag arrays dubbel in Firestore.
    }
  }
}
```

### Status enum (16 waarden, vrije transitie)

Bewaard als string; geen enforcement van welke transities toegestaan zijn — verkoper mag van elke status naar elke andere.

| key | label (nl) | category | kleur |
|---|---|---|---|
| `nieuw_contact` | Nieuw contact | early | grijs |
| `wachten_op_data` | Wachten op data | early | grijs |
| `klaar_voor_bezoek` | Klaar voor bezoek | early | lichtblauw |
| `bezoek_gepland` | Bezoek gepland | bezoek | blauw |
| `bezoek_gedaan` | Bezoek gedaan / link verstuurd | bezoek | blauw |
| `offerte_uit` | Offerte verzonden | offerte | geel |
| `wacht_op_beslissing` | Wacht op beslissing | offerte | geel |
| `akkoord` | Akkoord (go) | won | groen |
| `installatie_gepland` | Installatie gepland | won | groen |
| `in_uitvoering` | In uitvoering | won | groen |
| `keuring_aangevraagd` | Keuring aangevraagd | keuring | groen |
| `keuring_gepland` | Keuring gepland | keuring | groen |
| `keuring_gedaan` | Keuring gedaan | keuring | groen |
| `facturatie` | Facturatie | won | groen |
| `afgesloten` | Afgesloten | terminal-success | donkergroen |
| `niet_akkoord` | Niet akkoord | terminal-loss | rood |

Default voor een nieuw project: `nieuw_contact`.

---

## Security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isWhitelisted() {
      return request.auth != null && request.auth.token.email in [
        'kevin@bloxit.be',
        '<ruben-email>'   // Kevin vervangt vóór deploy
      ];
    }
    match /projects/{projectId} {
      allow read, write: if isWhitelisted();
    }
  }
}
```

Geldig zolang het bij 2 verkopers blijft. Phase 4 zou dit veralgemenen via een `users` sub-collectie met role.

---

## UI — `dashboard.html`

Drie zichtbare states (op basis van `firebase.auth().currentUser`):

### State 1: Niet ingelogd

- Centrale card met logo, korte intro ("SmartPeak project-dashboard — alleen voor Bloxit medewerkers."), en één knop "Log in met Google".
- Klik op knop → Firebase Auth Google popup. Bij succes → state 2 of 3.

### State 2: Ingelogd, niet op whitelist

- Melding "Je bent ingelogd als `<email>` maar dit account heeft geen toegang." + uitlog-knop.
- Geen project-lijst zichtbaar.

### State 3: Ingelogd, op whitelist (de hoofdvariant)

```
┌─ Header ────────────────────────────────────────────────┐
│ ⚡ SmartPeak — Projecten              👤 Kevin · Uitlog │
├─────────────────────────────────────────────────────────┤
│ [ + Nieuw project ]    [ ☐ Toon verwijderde projecten ] │
├─────────────────────────────────────────────────────────┤
│ Project              Klant              Status      Bijgewerkt   Door     ⋯  │
│ ─────────────────    ─────────────────  ─────────   ───────────  ────  ──── │
│ De Meyer, Leuven     Bart De Meyer      [Bezoek]    8 mrt 2026   Kevin  📂🗑️ │
│ Janssens, Aalst      Marie Janssens     [Akkoord]   22 feb 2026  Ruben  📂🗑️ │
│ ...                                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Project-lijst gedrag:**
- Sort: `updatedAt` desc default.
- Status-chip kleur volgt enum-tabel; klik op chip → inline dropdown om status te wijzigen (touch `updatedAt`).
- 📂 Open → navigeer naar `index.html?project=<id>`.
- 🗑️ Verwijderen → confirm modal, daarna soft delete (`deletedAt` = nu).
- "Toon verwijderde projecten" toggle: extra rij(en) met `deletedAt != null`, lichtere stijl, "↶ Herstellen" knop in plaats van 🗑️.
- Standaard query (Phase 1): `where('deletedAt', '==', null)` + bij toggle aan: een tweede query `where('deletedAt', '!=', null)`.

### Nieuw-project formulier (modal of in-page slide-down)

Velden:
- **Projectnaam** *(verplicht)* — vrij tekst.
- **Klantnaam** *(verplicht)* — vrij tekst.
- **Status** *(verplicht)* — dropdown van de 16 enum-waarden, default `nieuw_contact`.
- **CSV upload** *(optioneel)* — bestandsknop. Als geen CSV: project wordt aangemaakt met `csvUpload = null`.
- **Aanmaken** knop → schrijft Firestore-document, redirect naar `index.html?project=<nieuw-id>`.

Validatie: projectnaam + klantnaam mogen niet leeg zijn; CSV (indien aanwezig) wordt door dezelfde `parseCSV` / `processData` functies verwerkt als in `index.html` om `dailyCompact` + meta te produceren — code wordt extracted of gedupliceerd; zie § Code-deling.

---

## UI — `index.html` in project-mode (`?project=<id>`)

### Page-load flow

1. Detect `?project=<id>` → entering project-mode.
2. Firebase Auth check; geen user of niet whitelist → redirect naar `dashboard.html?return=<huidige-URL>`.
3. Fetch project document via `db.collection('projects').doc(id).get()`.
4. Niet gevonden, of `deletedAt != null` → toon "Project niet gevonden of verwijderd" + link naar dashboard.
5. Als `csvUpload != null`: rebuild `_saved` state (zelfde restore-pad als de huidige `?data=<b64>` flow gebruikt, maar input komt nu uit Firestore). Als `lastCalcRun != null`: rerender de resultaten direct.
6. Als `csvUpload == null`: toon project-banner + de leeg-staat boodschap (zie hieronder), calculator-form is disabled.

### Project-banner (bovenaan, vóór de form)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 📁  De Meyer, Leuven       👤 Bart De Meyer       [Bezoek gepland ▾]    │
│                                            ← Terug naar dashboard       │
└──────────────────────────────────────────────────────────────────────────┘
```

- Status-chip is klikbaar → inline dropdown (zelfde als dashboard).
- "← Terug naar dashboard" link rechts of links — duidelijk navigeerbaar.

### Auto-save

- Na elke succesvolle `renderResults` call (zowel de fresh-calculate path als een eventuele hercalculatie na CSV-vervanging) wordt `lastCalcRun` overschreven in Firestore.
- Update set: `lastCalcRun.calculatedAt`, `calculatedBy`, `inputs`, `results`, plus `updatedAt`.
- Failure: toast "⚠️ Niet opgeslagen — controleer netwerk". Gebruiker kan nogmaals op Bereken klikken.

### CSV-flow binnen project

- **Bij ontbrekende CSV**: prominente knop "📁 Upload CSV" + boodschap "Geen CSV beschikbaar voor dit project. Upload eerst een CSV om te kunnen rekenen." Het bestaande `<input type="file">` mechanisme van `index.html` wordt hergebruikt; bij upload wordt `csvUpload` in Firestore gevuld + `updatedAt` getouchet, waarna de pagina hercaltculaert.
- **Bij vervanging van CSV**: dezelfde knop blijft zichtbaar, met label "📁 Andere CSV uploaden". Confirm-modal: "Vorige CSV en berekening blijven bewaard tot je opnieuw rekent. Doorgaan?". Na bevestiging wordt `csvUpload` overschreven; `lastCalcRun` blijft staan tot user opnieuw op Bereken klikt — maar wordt visueel aangeduid als "uit eerdere CSV" (klein label rond resultaten).

### Bestaande knoppen

- "💾 Save (download JSON)" — blijft beschikbaar als noodbackup, ongewijzigd gedrag.
- "🔗 Deel link" — genereert nog steeds een `?data=<b64>` URL met de huidige in-memory state. Phase 2 vervangt dit door een Firestore-doc-gebaseerde link.

---

## Code-deling tussen `dashboard.html` en `index.html`

CSV-parsing logica (`parseCSV`, `processData`, dailyCompact-bouwen) leeft vandaag binnen het bottom-of-`index.html` `<script>` blok. Voor Phase 1 hebben we dezelfde logica nodig in `dashboard.html` (om de optionele CSV bij projectaanmaak te verwerken).

Twee opties:

- **A**: Extract gedeelde JS naar een `assets/js/csv.js` bestand, beide pagina's `<script src>`-en hem.
- **B**: Dupliceer de relevante functies in `dashboard.html` (~80 regels).

**Implementatie kiest A** — netter, geen drift-risico, en past bij CLAUDE.md's "extract into a new file and `<link>`/`<script src>` it from `index.html`" suggestie. Beide pagina's blijven verder zonder build-step.

Vergelijkbaar voor de Firebase-init code: `assets/js/firebase-init.js` met de SDK-config en gedeelde helpers (sign-in, sign-out, current-user, getProjectsRef).

---

## Firebase setup checklist (Kevin doet dit eenmalig vóór Phase 1 deploy)

1. Ga naar https://console.firebase.google.com → "Add project" → naam: `smartpeak-roi` (of vergelijkbaar).
2. Skip Google Analytics (niet nodig).
3. **Firestore Database** → "Create database" → location `eur3` (Europa) → start in **production mode** (we leveren custom rules in stap 6).
4. **Authentication** → "Get started" → enable provider **Google** (geen extra config).
5. **Project Settings** → "Add app" → web (</> icon) → app nickname `smartpeak-web` → kopieer de `firebaseConfig` object → die komt in `assets/js/firebase-init.js`.
6. **Firestore Rules** tab → vervang met de rules uit § Security rules (Kevin vult Ruben's email in).
7. **Authentication → Settings → Authorized domains** → voeg `<github-username>.github.io` toe (en eventueel custom domain).
8. Niets meer.

---

## Edge cases (Phase 1)

- **Twee verkopers tegelijk in zelfde project** → Firestore last-write-wins op het hele doc. Geen waarschuwing in Phase 1; kan in Phase 3 verfijnd worden.
- **Project geopend door iemand niet op whitelist** → Firestore rules blokkeren read; UI toont "Geen toegang" + link naar dashboard. (Praktisch onmogelijk omdat de redirect-flow dit eerder catcht, maar veiligheids-net.)
- **`?project=<id>` met onbekend ID** → toon "Project niet gevonden" + link naar dashboard.
- **`?project=<id>` met `deletedAt != null`** → behandel als "niet gevonden" (zelfde melding). Hersteld kan alleen via dashboard's "verwijderde projecten" toggle.
- **Bare `index.html`** zonder query → onveranderd, calculator werkt zonder login. Status quo voor backwards compat.
- **Klant share-link `?data=<b64>`** → 100% onveranderd, geen auth, blijft werken.
- **Stale `lastCalcRun` na CSV-vervanging** → blijft staan tot opnieuw gerekend; UI markeert resultaten visueel als "uit eerdere CSV" om verwarring te voorkomen.
- **Offline / Firebase down** → dashboard toont fout met retry-knop; project-mode blijft werken voor recompute (data al in memory) maar auto-save faalt stil → toast "⚠️ Niet opgeslagen — controleer netwerk".
- **Token expiry (~1u inactief)** → Firebase SDK refresh automatisch; alleen als de tab > ~1u inactief was kan de eerstvolgende write faillen → toast vraagt opnieuw inloggen via "↻ Opnieuw aanmelden" knop.

---

## Verificatie (manueel — geen tests in repo)

1. Verkoper A: open `dashboard.html`, log in met Google, verifieer toegang.
2. Verkoper B: log in met niet-whitelisted account, verifieer "Geen toegang" melding.
3. Maak nieuw project zonder CSV → verschijnt in lijst met status `nieuw_contact`. Open project → calculator-form is disabled, "Upload CSV" knop zichtbaar.
4. Upload CSV via project-pagina → form wordt enabled, laat oude `lastCalcRun` zien (geen, want nooit berekend).
5. Klik Bereken → resultaten verschijnen, status van project verandert niet automatisch (manueel via banner-dropdown), Firestore krijgt `lastCalcRun` update.
6. Sluit tab. Verkoper B: open zelfde project op zijn device → ziet de berekening van A.
7. Verkoper A wijzigt status via dashboard-chip → verkoper B verift dat update zichtbaar wordt na refresh dashboard.
8. Soft delete project; toggle "Toon verwijderde" → project zichtbaar met "↶ Herstellen". Herstel → project terug in normale lijst.
9. Open `index.html?project=<onbekend-id>` → "Project niet gevonden".
10. Open `index.html?data=<oude-b64-link>` → werkt onveranderd (geen Firebase betrokken).

---

## File changes (samenvatting)

- **NIEUW**: `dashboard.html`
- **NIEUW**: `assets/js/firebase-init.js`
- **NIEUW**: `assets/js/csv.js` (geëxtract uit `index.html`)
- **MODIFY**: `index.html` — voeg `?project=<id>` mode toe (auth check, Firestore load, project-banner, auto-save), inclusief CSV-upload knop binnen project-mode. Bestaande paths (bare + `?data=<b64>`) onveranderd.
- **MODIFY**: `CLAUDE.md` — vermeld nieuwe Firebase architectuur, dashboard.html, project-mode, en gedeelde js-files.
