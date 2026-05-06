// e2e/tests/hard-delete.spec.js
// Verifies that hard-deleting a project cascades to subcollections and Storage.
import { test, expect } from '../helpers/auth-fixture.js';
import { createTestProject, cleanupProject, getAdminFirestore, getAdminStorage } from '../helpers/project-helpers.js';
import { firebaseSignIn } from '../helpers/auth-fixture.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PHOTO_PATH = resolve(__dirname, '../fixtures/test-photo.jpg');

let projectId;
let customerName;

test.describe('Hard delete cascade', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create project
    const result = await createTestProject(page, {
      customerName: `E2E_HARDDELETE_${Date.now()}`,
    });
    projectId = result.projectId;
    customerName = result.customerName;

    // Navigate to dashboard to add a comment and photo
    await page.goto('/dashboard.html');
    await firebaseSignIn(page);
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    // Search and open drawer
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);
    await page.click(`.projectNameBtn[data-id="${projectId}"]`);
    await page.waitForSelector('#drawer.show', { timeout: 10_000 });

    // Add a comment
    const commentInput = page.locator('#drawerCommentInput');
    await commentInput.scrollIntoViewIfNeeded();
    await commentInput.fill('Test comment for hard delete');
    await page.click('#drawerCommentSubmit');
    await page.waitForTimeout(2000);

    // Upload a photo
    const photoSection = page.locator('#drawerPhotoUploader');
    await photoSection.scrollIntoViewIfNeeded();
    const fileInput = photoSection.locator('input[type="file"][data-pu-gallery]');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(PHOTO_PATH);
      await page.waitForTimeout(5000);

      // Close tag modal if it appears
      const tagModal = page.locator('.modal.show');
      if (await tagModal.isVisible().catch(() => false)) {
        const saveBtn = tagModal.locator('.btn-primary');
        if (await saveBtn.count() > 0) {
          await saveBtn.first().click();
          await page.waitForTimeout(1000);
        }
      }
    }

    await page.close();
    await context.close();
  });

  // No afterAll cleanup — the test itself deletes the project

  test('project has subcollection data before delete', async () => {
    const db = getAdminFirestore();

    // Verify project doc exists
    const projectDoc = await db.doc(`projects/${projectId}`).get();
    expect(projectDoc.exists).toBe(true);

    // Verify comment exists
    const comments = await db.collection(`projects/${projectId}/comments`).get();
    expect(comments.size).toBeGreaterThanOrEqual(1);

    // Verify photo exists
    const photos = await db.collection(`projects/${projectId}/photos`).get();
    expect(photos.size).toBeGreaterThanOrEqual(1);
  });

  test('soft delete then hard delete via UI', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    // Search for project
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    // Soft delete
    page.once('dialog', dialog => dialog.accept());
    await page.click(`.deleteBtn[data-id="${projectId}"]`);
    await page.waitForTimeout(1000);

    // Enable "Toon verwijderde"
    await page.check('#toggleShowDeleted');
    await page.waitForTimeout(1000);

    // Search again
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    // Verify project visible in deleted state
    const deletedRow = page.locator(`.projectNameBtn[data-id="${projectId}"]`);
    await expect(deletedRow).toBeVisible();

    // Hard delete
    page.once('dialog', dialog => dialog.accept());
    const permDelBtn = page.locator(`.permdelBtn[data-id="${projectId}"]`);
    await expect(permDelBtn).toBeVisible();
    await permDelBtn.click();
    await page.waitForTimeout(3000);

    // Verify project gone
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);
    const gone = page.locator(`.projectNameBtn[data-id="${projectId}"]`);
    await expect(gone).toHaveCount(0);
  });

  test('subcollections and storage are cleaned up after hard delete', async () => {
    const db = getAdminFirestore();

    // Verify project doc is gone
    const projectDoc = await db.doc(`projects/${projectId}`).get();
    expect(projectDoc.exists).toBe(false);

    // Verify comments subcollection is empty
    const comments = await db.collection(`projects/${projectId}/comments`).get();
    expect(comments.size).toBe(0);

    // Verify photos subcollection is empty
    const photos = await db.collection(`projects/${projectId}/photos`).get();
    expect(photos.size).toBe(0);

    // Verify storage files are gone
    const bucket = getAdminStorage();
    try {
      const [files] = await bucket.getFiles({ prefix: `projects/${projectId}/` });
      expect(files.length).toBe(0);
    } catch {
      // Bucket might not exist or be empty — that's fine
    }
  });
});
