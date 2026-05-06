// e2e/tests/calculator.spec.js
import { test, expect } from '../helpers/auth-fixture.js';
import { firebaseSignIn } from '../helpers/auth-fixture.js';
import { createTestProject, uploadCsvToProject, cleanupProject } from '../helpers/project-helpers.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, '../fixtures/test-fluvius.csv');

let projectId;
let customerName;

test.describe('Calculator flow', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create project
    const result = await createTestProject(page, {
      customerName: `E2E_CALC_${Date.now()}`,
    });
    projectId = result.projectId;
    customerName = result.customerName;

    // Upload CSV
    await uploadCsvToProject(page, projectId, CSV_PATH);

    // Fill in required calc fields: inverter kW + price
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

  test('calculator loads with project data', async ({ page }) => {
    await page.goto(`/index.html?project=${projectId}`);
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });

    // Verify project name in banner
    const pbName = page.locator('#pbName');
    await expect(pbName).toContainText(customerName);
  });

  test('load configs and select a configuration', async ({ page }) => {
    await page.goto(`/index.html?project=${projectId}`);
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });

    // Click "Configuraties laden"
    await page.click('.btn-load-configs');
    await page.waitForSelector('#configPickerList', { state: 'visible', timeout: 15_000 });

    // Select first available config
    const firstSelect = page.locator('.config-select').first();
    await expect(firstSelect).toBeVisible();

    // Pick the first non-empty option
    const options = await firstSelect.locator('option:not([value=""])').all();
    expect(options.length).toBeGreaterThan(0);
    const firstValue = await options[0].getAttribute('value');
    await firstSelect.selectOption(firstValue);
  });

  test('calculate shows results', async ({ page }) => {
    await page.goto(`/index.html?project=${projectId}`);
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });

    // Load configs and select one
    await page.click('.btn-load-configs');
    await page.waitForSelector('.config-select', { state: 'visible', timeout: 15_000 });
    const firstSelect = page.locator('.config-select').first();
    const options = await firstSelect.locator('option:not([value=""])').all();
    if (options.length > 0) {
      const firstValue = await options[0].getAttribute('value');
      await firstSelect.selectOption(firstValue);
    }

    // Click "Bereken ROI"
    await page.click('.btn-calculate');

    // Wait for results
    await page.waitForSelector('#results', { state: 'visible', timeout: 30_000 });

    // Verify scenario cards exist (worst-case + optimistic for the selected config)
    const scenarioCards = page.locator('.scenario-card');
    const count = await scenarioCards.count();
    expect(count).toBeGreaterThanOrEqual(2); // At least WC + OPT for one config

    // Verify summary card
    await expect(page.locator('#summaryCard')).toBeVisible();
  });

  test('share link works in readonly mode', async ({ page }) => {
    await page.goto(`/index.html?project=${projectId}`);
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });

    // Load configs, select, calculate
    await page.click('.btn-load-configs');
    await page.waitForSelector('.config-select', { state: 'visible', timeout: 15_000 });
    const firstSelect = page.locator('.config-select').first();
    const options = await firstSelect.locator('option:not([value=""])').all();
    if (options.length > 0) {
      await firstSelect.selectOption(await options[0].getAttribute('value'));
    }
    await page.click('.btn-calculate');
    await page.waitForSelector('#results', { state: 'visible', timeout: 30_000 });

    // Call copyShareLink and wait for the share URL to be written to the input.
    // Note: when clipboard API works, the input stays hidden but its value IS set.
    await page.evaluate(async () => { await window.copyShareLink(); });

    const shareUrl = await page.locator('#shareUrlInput').inputValue();
    expect(shareUrl).toBeTruthy();
    expect(shareUrl).toMatch(/[?&]s=/);

    // Navigate to share URL in a new context (no auth)
    const newContext = await page.context().browser().newContext();
    const sharePage = await newContext.newPage();
    await sharePage.goto(shareUrl);
    await sharePage.waitForSelector('#results', { state: 'visible', timeout: 15_000 });

    // Verify readonly mode
    await expect(sharePage.locator('body')).toHaveClass(/readonly-mode/);

    // Verify results visible
    const cards = sharePage.locator('.scenario-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(2);

    // Verify Bereken button hidden
    await expect(sharePage.locator('.btn-calculate')).toBeHidden();

    await sharePage.close();
    await newContext.close();
  });
});
