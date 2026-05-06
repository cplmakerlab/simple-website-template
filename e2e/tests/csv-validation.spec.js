// e2e/tests/csv-validation.spec.js
// Verifies that uploading an invalid CSV shows clear error messages.
import { test, expect } from '../helpers/auth-fixture.js';
import { createTestProject, cleanupProject } from '../helpers/project-helpers.js';
import { firebaseSignIn } from '../helpers/auth-fixture.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BAD_CSV_PATH = resolve(__dirname, '../fixtures/bad-format.csv');
const GOOD_CSV_PATH = resolve(__dirname, '../fixtures/test-fluvius.csv');

let projectId;

test.describe('CSV validation', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const result = await createTestProject(page, {
      customerName: `E2E_CSV_${Date.now()}`,
    });
    projectId = result.projectId;
    await page.close();
    await context.close();
  });

  test.afterAll(async () => {
    await cleanupProject(projectId);
  });

  test('bad CSV shows error about missing columns', async ({ page }) => {
    await page.goto(`/project-edit.html?project=${projectId}`);
    await firebaseSignIn(page);
    await page.waitForSelector('#fCsv', { state: 'attached', timeout: 10_000 });

    // Upload bad CSV
    await page.setInputFiles('#fCsv', BAD_CSV_PATH);
    await page.waitForTimeout(2000);

    // Verify error message appears in status
    const status = page.locator('#fCsvStatus');
    const text = await status.textContent();
    // Should mention missing columns or invalid format
    expect(text.toLowerCase()).toMatch(/fout|ontbreken|ongeldig|error/i);
  });

  test('valid CSV shows success status', async ({ page }) => {
    await page.goto(`/project-edit.html?project=${projectId}`);
    await firebaseSignIn(page);
    await page.waitForSelector('#fCsv', { state: 'attached', timeout: 10_000 });

    // Upload valid Fluvius CSV
    await page.setInputFiles('#fCsv', GOOD_CSV_PATH);
    await page.waitForTimeout(2000);

    // Verify success message
    const status = page.locator('#fCsvStatus');
    await expect(status).toContainText('Klaar om op te slaan');
  });
});
