// e2e/helpers/project-helpers.js
import { expect } from '@playwright/test';
import { firebaseSignIn } from './auth-fixture.js';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

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
 * Initialise a Firebase Admin app scoped to E2E cleanup.
 * Re-uses an existing app named 'e2e-cleanup' if one is already initialised
 * (multiple test suites may run in the same Node process).
 */
function _getAdminApp() {
  const admin = require('firebase-admin');
  const APP_NAME = 'e2e-cleanup';
  try {
    return admin.app(APP_NAME);
  } catch {
    const sa = require(join(__dirname, '..', 'service-account-key.json'));
    return admin.initializeApp({
      credential: admin.credential.cert(sa),
      storageBucket: 'smartpeak-roi.firebasestorage.app',
    }, APP_NAME);
  }
}

/**
 * Hard-deletes a test project via Firebase Admin SDK.
 * Cascades: subcollections (photos, comments) + Storage blobs + project doc.
 *
 * This replaces the old UI-driven cleanup which was fragile (timing-dependent
 * button clicks, silent failures leaving orphaned projects).
 *
 * @param {string} projectId - The project ID to delete
 * @returns {Promise<void>}
 */
export async function cleanupProject(projectId) {
  const app = _getAdminApp();
  const db = app.firestore();
  const bucket = app.storage().bucket();

  console.log(`[cleanup] Hard-deleting project ${projectId} via Admin SDK`);

  try {
    // 1. Delete subcollection: photos
    const photoSnap = await db.collection(`projects/${projectId}/photos`).get();
    if (!photoSnap.empty) {
      const batch = db.batch();
      photoSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`[cleanup]   Deleted ${photoSnap.size} photo docs`);
    }

    // 2. Delete subcollection: comments
    const commentSnap = await db.collection(`projects/${projectId}/comments`).get();
    if (!commentSnap.empty) {
      const batch = db.batch();
      commentSnap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`[cleanup]   Deleted ${commentSnap.size} comment docs`);
    }

    // 3. Delete Storage files under projects/{id}/
    try {
      const [files] = await bucket.getFiles({ prefix: `projects/${projectId}/` });
      if (files.length > 0) {
        await Promise.all(files.map(f => f.delete().catch(() => {})));
        console.log(`[cleanup]   Deleted ${files.length} storage files`);
      }
    } catch (e) {
      // Storage bucket may not be configured or empty — non-fatal
      console.warn(`[cleanup]   Storage cleanup skipped: ${e.message}`);
    }

    // 4. Delete the project document itself
    await db.doc(`projects/${projectId}`).delete();
    console.log(`[cleanup]   Project doc deleted`);

  } catch (error) {
    console.error(`[cleanup] Failed to cleanup project ${projectId}:`, error.message);
    // Still best-effort — don't crash the test run
  }
}
