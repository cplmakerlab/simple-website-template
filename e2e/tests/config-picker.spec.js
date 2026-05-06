// e2e/tests/config-picker.spec.js
// Verifies config picker dynamics: load, select multiple, already-picked disabled.
import { test, expect } from '../helpers/auth-fixture.js';
import { firebaseSignIn } from '../helpers/auth-fixture.js';
import { createTestProject, uploadCsvToProject, cleanupProject } from '../helpers/project-helpers.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, '../fixtures/test-fluvius.csv');

let projectId;

test.describe('Config picker', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const result = await createTestProject(page, {
      customerName: `E2E_PICKER_${Date.now()}`,
    });
    projectId = result.projectId;

    // Upload CSV + set required fields
    await uploadCsvToProject(page, projectId, CSV_PATH);

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

  test('load configs shows available configurations', async ({ page }) => {
    await page.goto(`/index.html?project=${projectId}`);
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });

    await page.click('.btn-load-configs');
    await page.waitForSelector('.config-select', { state: 'visible', timeout: 15_000 });

    // At least one config-select should be visible
    const selects = page.locator('.config-select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // The first select should have options
    const firstSelect = selects.first();
    const options = await firstSelect.locator('option:not([value=""])').all();
    expect(options.length).toBeGreaterThan(0);
  });

  test('selecting a config adds a new empty picker', async ({ page }) => {
    await page.goto(`/index.html?project=${projectId}`);
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });

    await page.click('.btn-load-configs');
    await page.waitForSelector('.config-select', { state: 'visible', timeout: 15_000 });

    // Count initial selects (should be 1 — the empty trailing one)
    const initialCount = await page.locator('.config-select').count();

    // Select a config in the first picker
    const firstSelect = page.locator('.config-select').first();
    const options = await firstSelect.locator('option:not([value=""])').all();
    expect(options.length).toBeGreaterThan(0);
    const firstValue = await options[0].getAttribute('value');
    await firstSelect.selectOption(firstValue);
    await page.waitForTimeout(500);

    // A new empty picker should have appeared (N+1 pattern)
    const newCount = await page.locator('.config-select').count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('already-selected config is disabled in other pickers', async ({ page }) => {
    await page.goto(`/index.html?project=${projectId}`);
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });

    await page.click('.btn-load-configs');
    await page.waitForSelector('.config-select', { state: 'visible', timeout: 15_000 });

    // Select the first option
    const firstSelect = page.locator('.config-select').first();
    const options = await firstSelect.locator('option:not([value=""])').all();
    if (options.length < 2) {
      // Need at least 2 configs to test disable logic — skip
      test.skip();
      return;
    }
    const selectedValue = await options[0].getAttribute('value');
    await firstSelect.selectOption(selectedValue);
    await page.waitForTimeout(500);

    // In the second picker, the selected value should be disabled
    const secondSelect = page.locator('.config-select').nth(1);
    const disabledOpt = secondSelect.locator(`option[value="${selectedValue}"]`);
    const isDisabled = await disabledOpt.getAttribute('disabled');
    expect(isDisabled).not.toBeNull();
  });

  test('calculate with multiple configs shows multiple scenario pairs', async ({ page }) => {
    await page.goto(`/index.html?project=${projectId}`);
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });

    await page.click('.btn-load-configs');
    await page.waitForSelector('.config-select', { state: 'visible', timeout: 15_000 });

    // Select first config
    const firstSelect = page.locator('.config-select').first();
    const options = await firstSelect.locator('option:not([value=""])').all();
    const firstValue = await options[0].getAttribute('value');
    await firstSelect.selectOption(firstValue);
    await page.waitForTimeout(500);

    // Select second config if available
    if (options.length >= 2) {
      const secondSelect = page.locator('.config-select').nth(1);
      const secondOptions = await secondSelect.locator('option:not([value=""]):not([disabled])').all();
      if (secondOptions.length > 0) {
        const secondValue = await secondOptions[0].getAttribute('value');
        await secondSelect.selectOption(secondValue);
        await page.waitForTimeout(500);
      }
    }

    // Calculate
    await page.click('.btn-calculate');
    await page.waitForSelector('#results', { state: 'visible', timeout: 30_000 });

    // Should have at least 2 scenario cards (WC + OPT per config)
    const cards = page.locator('.scenario-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(2);

    // Summary card should be visible
    await expect(page.locator('#summaryCard')).toBeVisible();
  });
});
