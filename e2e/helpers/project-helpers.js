// e2e/helpers/project-helpers.js
import { expect } from '@playwright/test';
import { firebaseSignIn } from './auth-fixture.js';

/**
 * Creates a new test project and returns the project ID.
 * Handles Firebase auth if the page is not yet authenticated.
 *
 * @param {import('@playwright/test').Page} page - Playwright page instance
 * @param {Object} opts - Options
 * @param {string} [opts.customerName] - Customer name (defaults to "E2E_Test_" + timestamp)
 * @returns {Promise<{projectId: string, customerName: string}>}
 */
export async function createTestProject(page, opts = {}) {
  const customerName = opts.customerName || `E2E_Test_${Date.now()}`;

  // Navigate to new project page
  await page.goto('/project-edit.html?new=1');

  // Authenticate (Firebase SDK loads on this page)
  await firebaseSignIn(page);

  // Wait for auth-gated UI to appear
  await page.waitForSelector('#fCustomerName', {
    state: 'visible',
    timeout: 15_000,
  });

  // Fill in customer name
  await page.fill('#fCustomerName', customerName);

  // Click "Opslaan & Bereken" — this redirects to index.html?project=<id>#results
  // (plain "Opslaan" redirects to dashboard.html without the project ID in URL)
  await page.click('#btnSaveAndCalc');

  // Wait for redirect to calculator page with project ID
  await page.waitForURL(/\?project=/, { timeout: 15_000 });

  // Extract project ID from URL
  const url = new URL(page.url());
  const projectId = url.searchParams.get('project');

  if (!projectId) {
    throw new Error('Failed to extract project ID from URL after save');
  }

  return { projectId, customerName };
}

/**
 * Uploads a CSV file to an existing project.
 *
 * @param {import('@playwright/test').Page} page - Playwright page instance
 * @param {string} projectId - The project ID
 * @param {string} csvPath - Absolute path to the CSV file
 * @returns {Promise<void>}
 */
export async function uploadCsvToProject(page, projectId, csvPath) {
  // Navigate to project edit page
  await page.goto(`/project-edit.html?project=${projectId}`);

  // Auth should persist in same context, but re-auth if needed
  await firebaseSignIn(page);

  // Wait for CSV input to be available
  await page.waitForSelector('#fCsv', { state: 'attached', timeout: 10_000 });

  // Get the initial CSV status text
  const initialStatus = await page.locator('#fCsvStatus').textContent();

  // Upload CSV file
  await page.setInputFiles('#fCsv', csvPath);

  // Wait for CSV parsing feedback (status text should change)
  await page.waitForFunction(
    (oldStatus) => {
      const statusEl = document.getElementById('fCsvStatus');
      return statusEl && statusEl.textContent !== oldStatus;
    },
    initialStatus,
    { timeout: 5000 },
  );

  // Verify CSV was parsed successfully
  const newStatus = await page.locator('#fCsvStatus').textContent();
  if (!newStatus.includes('Klaar om op te slaan')) {
    throw new Error(`CSV upload failed. Status: ${newStatus}`);
  }

  // Click save button
  await page.click('#btnSave');

  // Wait for save to complete (Firestore write + UI update)
  await page.waitForTimeout(2000);
}

/**
 * Deletes a test project (soft delete + hard delete).
 *
 * @param {import('@playwright/test').Page} page - Playwright page instance
 * @param {string} projectId - The project ID to delete
 * @param {string} customerName - The customer name (for searching)
 * @returns {Promise<void>}
 */
export async function cleanupProject(page, projectId, customerName) {
  try {
    // Navigate to dashboard
    await page.goto('/dashboard.html');

    // Authenticate
    await firebaseSignIn(page);

    // Wait for search field to be visible (auth-gated)
    await page.waitForSelector('#projectSearch', {
      state: 'visible',
      timeout: 15_000,
    });

    // Search for the project
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    // Soft delete: click delete button and handle confirm dialog
    const deleteBtn = page.locator(`.deleteBtn[data-id="${projectId}"]`);

    const deleteCount = await deleteBtn.count();
    if (deleteCount === 0) {
      console.warn(`[cleanup] Project ${projectId} not found for soft delete, skipping`);
      return;
    }

    // Handle confirm dialog
    page.once('dialog', dialog => dialog.accept());
    await deleteBtn.click();
    await page.waitForTimeout(1500);

    // Enable "Show deleted" toggle
    await page.check('#toggleShowDeleted');
    await page.waitForTimeout(500);

    // Search again for the soft-deleted project
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    // Hard delete: click permanent delete button
    const permdelBtn = page.locator(`.permdelBtn[data-id="${projectId}"]`);

    const permdelCount = await permdelBtn.count();
    if (permdelCount === 0) {
      console.warn(`[cleanup] Project ${projectId} not found for hard delete`);
      return;
    }

    page.once('dialog', dialog => dialog.accept());
    await permdelBtn.click();
    await page.waitForTimeout(1500);

    // Verify project is gone
    const projectNameBtn = page.locator(`.projectNameBtn[data-id="${projectId}"]`);
    const finalCount = await projectNameBtn.count();
    expect(finalCount).toBe(0);
  } catch (error) {
    console.error(`[cleanup] Failed to cleanup project ${projectId}:`, error.message);
    // Don't re-throw - cleanup should be best-effort
  }
}
