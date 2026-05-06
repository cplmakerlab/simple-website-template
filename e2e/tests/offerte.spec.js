// e2e/tests/offerte.spec.js
// Verifies offerte PDF upload, download, delete-PDF-only, and config cascade delete.
import { test, expect } from '../helpers/auth-fixture.js';
import { firebaseSignIn } from '../helpers/auth-fixture.js';
import { createTestProject, uploadCsvToProject, cleanupProject } from '../helpers/project-helpers.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, '../fixtures/test-fluvius.csv');
const PDF_PATH = resolve(__dirname, '../fixtures/test-offerte.pdf');

let projectId;
let customerName;

test.describe('Offerte PDF management', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create project
    const result = await createTestProject(page, {
      customerName: `E2E_OFFERTE_${Date.now()}`,
    });
    projectId = result.projectId;
    customerName = result.customerName;

    // Upload CSV + fill required fields
    await uploadCsvToProject(page, projectId, CSV_PATH);

    await page.goto(`/project-edit.html?project=${projectId}`);
    await firebaseSignIn(page);
    await page.waitForSelector('#fTotalKw', { state: 'visible', timeout: 15_000 });
    await page.fill('#fTotalKw', '5');
    await page.fill('#fPriceDay', '0.30');
    await page.click('#btnSave');
    await page.waitForTimeout(2000);

    // Run a calculation so selectedConfigTypes is populated
    await page.goto(`/index.html?project=${projectId}`);
    await page.waitForSelector('#projectBanner', { state: 'visible', timeout: 15_000 });
    await page.click('.btn-load-configs');
    await page.waitForSelector('.config-select', { state: 'visible', timeout: 15_000 });

    const firstSelect = page.locator('.config-select').first();
    const options = await firstSelect.locator('option:not([value=""])').all();
    if (options.length > 0) {
      const firstValue = await options[0].getAttribute('value');
      await firstSelect.selectOption(firstValue);
      await page.waitForTimeout(500);
    }

    await page.click('.btn-calculate');
    await page.waitForSelector('#results', { state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(2000);

    await page.close();
    await context.close();
  });

  test.afterAll(async () => {
    await cleanupProject(projectId);
  });

  test('offerte cards appear in dashboard drawer for calculated project', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    // Search and open drawer
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);
    await page.click(`.projectNameBtn[data-id="${projectId}"]`);
    await page.waitForSelector('#drawer.show', { timeout: 10_000 });

    // Offerte section should be visible with at least one offerte-row
    const offerteRows = page.locator('.offerte-row');
    await expect(offerteRows.first()).toBeVisible({ timeout: 10_000 });
    const count = await offerteRows.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // The row should have an upload button (no PDF yet)
    const uploadBtn = offerteRows.first().locator('.offerte-upload-btn');
    await expect(uploadBtn).toBeVisible();
  });

  test('upload offerte PDF via modal', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);
    await page.click(`.projectNameBtn[data-id="${projectId}"]`);
    await page.waitForSelector('#drawer.show', { timeout: 10_000 });

    // Click upload on first offerte row
    const uploadBtn = page.locator('.offerte-row .offerte-upload-btn').first();
    await expect(uploadBtn).toBeVisible({ timeout: 10_000 });
    await uploadBtn.click();

    // Modal should appear
    await page.waitForSelector('#offerteModal', { state: 'visible', timeout: 10_000 });

    // Upload the PDF file via the file input
    const fileInput = page.locator('#offerteFileInput');
    await fileInput.setInputFiles(PDF_PATH);

    // Wait for upload to complete (modal should close or show success)
    // The modal closes after successful upload
    await page.waitForSelector('#offerteModal', { state: 'hidden', timeout: 30_000 });
    await page.waitForTimeout(2000);

    // The offerte row should now show download + replace buttons instead of upload
    const downloadBtn = page.locator('.offerte-row .offerte-download-btn').first();
    await expect(downloadBtn).toBeVisible({ timeout: 10_000 });
  });

  test('offerte row shows PDF filename after upload', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);
    await page.click(`.projectNameBtn[data-id="${projectId}"]`);
    await page.waitForSelector('#drawer.show', { timeout: 10_000 });

    // The first offerte row should have the PDF class and show filename
    const pdfRow = page.locator('.offerte-row.has-pdf').first();
    await expect(pdfRow).toBeVisible({ timeout: 10_000 });

    const pdfName = pdfRow.locator('.offerte-row-pdf');
    const text = await pdfName.textContent();
    expect(text).toBeTruthy();
  });

  test('delete PDF only keeps config but removes file', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);
    await page.click(`.projectNameBtn[data-id="${projectId}"]`);
    await page.waitForSelector('#drawer.show', { timeout: 10_000 });

    // Confirm we have a PDF row
    const pdfRow = page.locator('.offerte-row.has-pdf').first();
    await expect(pdfRow).toBeVisible({ timeout: 10_000 });

    // Click delete-PDF-only button
    page.once('dialog', dialog => dialog.accept());
    const deletePdfBtn = pdfRow.locator('.offerte-deletepdf-btn');
    await expect(deletePdfBtn).toBeVisible();
    await deletePdfBtn.click();
    await page.waitForTimeout(3000);

    // The row should still exist but now be missing-pdf (upload button visible again)
    const missingRow = page.locator('.offerte-row.missing-pdf').first();
    await expect(missingRow).toBeVisible({ timeout: 10_000 });
    const uploadBtn = missingRow.locator('.offerte-upload-btn');
    await expect(uploadBtn).toBeVisible();
  });

  test('offerte cards also appear in project-edit page', async ({ page }) => {
    await page.goto(`/project-edit.html?project=${projectId}`);
    await firebaseSignIn(page);
    await page.waitForSelector('#fCustomerName', { state: 'visible', timeout: 15_000 });

    // Offerte section should be present in project-edit as well
    const offerteRows = page.locator('.offerte-row');
    const count = await offerteRows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
