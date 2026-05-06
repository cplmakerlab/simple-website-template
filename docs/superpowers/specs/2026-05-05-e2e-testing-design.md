# E2E Testing met Playwright — Design Spec

## Doel

Herhaalbare end-to-end tests die de volledige applicatie doorlopen in een
echte browser tegen de productie Firebase backend. Elke test suite maakt een
eigen project aan en ruimt het volledig op (soft delete + hard delete) zodat
er geen data achterblijft.

## Keuzes

| Beslissing | Keuze | Motivatie |
|------------|-------|-----------|
| Framework | Playwright (`@playwright/test`) | Standaard, snelle Chromium support, native async/await |
| Auth strategie | Firebase Admin SDK custom token | Geen manuele login, werkt in CI |
| Omgeving | Productie Firebase | Simpelste setup, geen emulators nodig |
| Test isolatie | Per-suite project lifecycle | `beforeAll` create, `afterAll` cleanup |
| Runner | Apart van Vitest | `npm run test:e2e` naast `npm test` |

## Infrastructuur

### Packages (devDependencies)

```
@playwright/test   — E2E test runner + assertions
firebase-admin     — custom auth token generatie
```

### File layout

```
e2e/
  playwright.config.js          ← Playwright configuratie
  global-setup.js               ← Auth token + storageState generatie
  auth-state.json               ← Gegenereerd, in .gitignore
  service-account-key.json      ← Manueel geplaatst, in .gitignore
  fixtures/
    test-fluvius.csv            ← Synthetisch CSV met bekende waarden
    test-photo.jpg              ← Kleine test-afbeelding voor upload
  helpers/
    project-helpers.js          ← createTestProject, cleanupProject
  tests/
    project-crud.spec.js        ← Flow 1: CRUD lifecycle
    calculator.spec.js          ← Flow 2: Calculator + share-link
    dashboard-ui.spec.js        ← Flow 3: Dashboard UI interacties
```

### Scripts (package.json)

```json
{
  "test": "vitest run",
  "test:e2e": "playwright test",
  "test:all": "vitest run && playwright test"
}
```

### .gitignore toevoegingen

```
e2e/auth-state.json
e2e/service-account-key.json
```

## Auth flow

### global-setup.js

1. Firebase Admin SDK initialiseren met `e2e/service-account-key.json`
2. `admin.auth().createCustomToken('kevin@bloxit.be')` aanroepen
3. Playwright browser starten (chromium)
4. Navigeren naar de app (base URL)
5. Token injecteren via `page.evaluate`:
   ```js
   await firebase.auth().signInWithCustomToken(token);
   ```
6. Wachten tot `firebase.auth().currentUser` niet null is
7. `context.storageState({ path: 'e2e/auth-state.json' })` opslaan
8. Browser sluiten

### Per-test hergebruik

`playwright.config.js` bevat:
```js
use: {
  storageState: 'e2e/auth-state.json',
  baseURL: 'https://deploy-preview-1--smartpeak-battery-roi.netlify.app',
}
```

Elke test start meteen ingelogd, zonder login-flow.

**Base URL**: configureerbaar via environment variable `BASE_URL`. Default is
de Netlify deploy preview URL. Voor lokaal testen:
`BASE_URL=http://localhost:8000 npm run test:e2e`.

## Test helpers

### `createTestProject(page, opts)` — `e2e/helpers/project-helpers.js`

```
Input:  page, { customerName? }
Output: projectId (string)

Stappen:
1. customerName default: "E2E_Test_" + Date.now()
2. Navigeer naar project-edit.html?new=1
3. Wacht op formulier geladen (await #customerName visible)
4. Vul customerName in
5. Klik "Opslaan"
6. Wacht op navigatie of success-toast
7. Extraheer projectId uit URL (?project=<id>)
8. Return projectId
```

### `cleanupProject(page, projectId, projectName)` — zelfde bestand

```
Stappen:
1. Navigeer naar dashboard.html
2. Wacht op project-lijst geladen
3. Zoek project via zoekveld (typ projectName)
4. Klik trash-knop (fa-trash) op de matching rij
5. Bevestig confirm-dialog
6. Vink "Toon verwijderde" checkbox aan
7. Zoek het project opnieuw in de gefilterde lijst
8. Klik hard-delete knop (fa-circle-xmark) op de rij
9. Bevestig confirm-dialog
10. Verify project verdwenen uit lijst
```

### `uploadCsvToProject(page, projectId, csvPath)`

```
Stappen:
1. Navigeer naar project-edit.html?project=<id>
2. Wacht op Blok A geladen
3. Upload CSV via file input (setInputFiles)
4. Wacht op parsing feedback (success toast of data preview)
5. Klik "Opslaan"
```

## Test flows

### Flow 1 — Project CRUD lifecycle (`project-crud.spec.js`)

**Setup:** `beforeAll` → `createTestProject("E2E_CRUD_{timestamp}")`
**Teardown:** `afterAll` → `cleanupProject`

| # | Test | Wat wordt geverifieerd |
|---|------|----------------------|
| 1 | Project in lijst | Zoek op naam, rij bestaat, status = "Nieuw contact" |
| 2 | Drawer opent | Klik projectnaam, drawer toont klantnaam + contact |
| 3 | Project bewerken | Navigeer naar edit, wijzig telefoon, opslaan, verify in drawer |
| 4 | Status wijzigen | Klik status-chip, kies "Wachten op data", verify update |
| 5 | Soft delete + restore | Trash → verdwijnt uit lijst → "Toon verwijderde" → zichtbaar → restore → terug in lijst |

### Flow 2 — Calculator (`calculator.spec.js`)

**Setup:** `beforeAll` → `createTestProject` + `uploadCsvToProject`
**Teardown:** `afterAll` → `cleanupProject`

| # | Test | Wat wordt geverifieerd |
|---|------|----------------------|
| 1 | Calculator laadt | `index.html?project={id}`, klantnaam in project-banner |
| 2 | Configs laden | Config-picker verschijnt, selecteer configuratie |
| 3 | Bereken | Klik Bereken, #results verschijnt, WC + OPT kaarten aanwezig |
| 4 | Share-link | "Kopieer deellink", navigeer naar gedeelde URL, readonly mode, resultaten zichtbaar |

### Flow 3 — Dashboard UI (`dashboard-ui.spec.js`)

**Setup:** `beforeAll` → `createTestProject`
**Teardown:** `afterAll` → `cleanupProject`

| # | Test | Wat wordt geverifieerd |
|---|------|----------------------|
| 1 | Zoekfunctie | Typ naam in zoekveld, alleen matching project zichtbaar |
| 2 | Lijst/Bord toggle | Klik "Bord" → kanban-kolommen, klik "Lijst" → tabel terug |
| 3 | Foto-uploader | Open drawer, scroll naar foto's, upload test-foto, thumbnail verschijnt |
| 4 | Opmerkingen | Scroll naar comments, typ tekst, verstuur, verify opmerking verschijnt |

## Playwright configuratie

```js
// e2e/playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.js',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL
      || 'https://deploy-preview-1--smartpeak-battery-roi.netlify.app',
    storageState: './auth-state.json',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

## Service account key

Bestand: `~/Downloads/smartpeak-roi-firebase-adminsdk-fbsvc-aef5635488.json`
Wordt gekopieerd naar `e2e/service-account-key.json` bij setup.

## Naamconventie test-projecten

Alle test-projecten krijgen de naam `E2E_{suite}_{timestamp}`, bijv.:
- `E2E_CRUD_1746463200000`
- `E2E_CALC_1746463200000`
- `E2E_DASH_1746463200000`

Dit maakt ze herkenbaar voor manuele opruiming mocht cleanup falen.

## Risico's en mitigaties

| Risico | Mitigatie |
|--------|----------|
| Test laat data achter bij crash | E2E_ prefix maakt manueel herkenbaar; afterAll in finally-block |
| Auth token verloopt | globalSetup maakt elke run een vers token aan |
| Productie data per ongeluk gewijzigd | Tests maken alleen eigen projecten aan, nooit bestaande wijzigen |
| Trage netwerk / flaky | Playwright retries (1x), expliciete waits op elementen |
| Base URL verandert | Configureerbaar via BASE_URL env var |

---

*Aangemaakt: 2026-05-05*
