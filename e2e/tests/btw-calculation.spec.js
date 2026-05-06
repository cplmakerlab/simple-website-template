// e2e/tests/btw-calculation.spec.js
// Verifies that BTW (6% vs 21%) affects calculated installation prices.
import { test, expect } from '../helpers/auth-fixture.js';
import { firebaseSignIn } from '../helpers/auth-fixture.js';
import { createTestProject, uploadCsvToProject, cleanupProject } from '../helpers/project-helpers.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, '../fixtures/test-fluvius.csv');

let projectId;

test.describe('BTW calculation', () => {
  // This test runs two full calc cycles (6% → 21%), needs extra time
  test.setTimeout(60_000);
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create project
    const result = await createTestProject(page, {
      customerName: `E2E_BTW_${Date.now()}`,
    });
    projectId = result.projectId;

    // Upload CSV
    await uploadCsvToProject(page, projectId, CSV_PATH);

    // Fill inverter kW + price
    await page.goto(`/project-edit.html?project=${projectId}`);
    await firebaseSignIn(page);
    await page.waitForSelector('#fTotalKw', { state: 'visible', timeout: 15_000 });
    await page.fill('#fTotalKw', '5');
    await page.fill('#fPriceDay', '0.30');
    await page.click('#btnSave');
    await page.waitForTimeout(2000);

    await page.close();
    await context.close();
  });

  test.afterAll(async () => {
    await cleanupProject(projectId);
  });

  test('set house age >10y (6% BTW) and calculate', async ({ page }) => {
    // Set house age to >10 years (6% BTW)
    await page.goto(`/project-edit.html?project=${projectId}`);
    await firebaseSignIn(page);
    await page.waitForSelector('#fAge_true', { state: 'visible', timeout: 15_000 });
    await page.click('#fAge_true'); // 10 jaar of ouder = 6% BTW
    await page.click('#btnSaveAndCalc');
    await page.waitForURL(/\?project=/, { timeout: 15_000 });

    // On calculator page — load configs and calculate
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });
    await page.click('.btn-load-configs');
    await page.waitForSelector('.config-select', { state: 'visible', timeout: 15_000 });

    const firstSelect = page.locator('.config-select').first();
    const options = await firstSelect.locator('option:not([value=""])').all();
    expect(options.length).toBeGreaterThan(0);
    const firstValue = await options[0].getAttribute('value');
    await firstSelect.selectOption(firstValue);

    await page.click('.btn-calculate');
    await page.waitForSelector('#results', { state: 'visible', timeout: 30_000 });

    // Extract installation price from the first scenario card
    // The "Installatieprijs" row is inside each scenario card
    const priceRow6 = page.locator('.scenario-card').first()
      .locator('.stat-row', { has: page.locator('.stat-label', { hasText: 'Installatieprijs' }) });
    const priceText6 = await priceRow6.locator('.stat-value').textContent();

    // Store the 6% price for comparison
    // Navigate to edit, change to 21%, recalculate
    await page.goto(`/project-edit.html?project=${projectId}`);
    await firebaseSignIn(page);
    await page.waitForSelector('#fAge_false', { state: 'visible', timeout: 15_000 });
    await page.click('#fAge_false'); // Jonger dan 10 jaar = 21% BTW
    await page.click('#btnSaveAndCalc');
    await page.waitForURL(/\?project=/, { timeout: 15_000 });

    // Recalculate
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });
    await page.click('.btn-load-configs');
    await page.waitForSelector('.config-select', { state: 'visible', timeout: 15_000 });

    const secondSelect = page.locator('.config-select').first();
    const opts21 = await secondSelect.locator('option:not([value=""])').all();
    const val21 = await opts21[0].getAttribute('value');
    await secondSelect.selectOption(val21);

    await page.click('.btn-calculate');
    await page.waitForSelector('#results', { state: 'visible', timeout: 30_000 });

    const priceRow21 = page.locator('.scenario-card').first()
      .locator('.stat-row', { has: page.locator('.stat-label', { hasText: 'Installatieprijs' }) });
    const priceText21 = await priceRow21.locator('.stat-value').textContent();

    // The 21% BTW price should be higher than 6% BTW price
    // Extract numeric values (format: "€ 1.234,56" or similar)
    // nl-BE format: "€ 5.760,00" → strip non-numeric except , and . → remove dots → swap comma for dot
    const parse = (s) => parseFloat(s.replace(/[^0-9,.-]/g, '').replaceAll('.', '').replace(',', '.'));
    const price6 = parse(priceText6);
    const price21 = parse(priceText21);

    // Both prices should be positive numbers
    expect(price6).toBeGreaterThan(0);
    expect(price21).toBeGreaterThan(0);

    // 21% should be more expensive than 6%
    expect(price21).toBeGreaterThan(price6);
  });
});
