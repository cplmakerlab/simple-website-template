// e2e/tests/dashboard-ui.spec.js
import { test, expect } from '../helpers/auth-fixture.js';
import { createTestProject, cleanupProject } from '../helpers/project-helpers.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PHOTO_PATH = resolve(__dirname, '../fixtures/test-photo.jpg');

let projectId;
let customerName;

test.describe('Dashboard UI', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const result = await createTestProject(page, {
      customerName: `E2E_DASH_${Date.now()}`,
    });
    projectId = result.projectId;
    customerName = result.customerName;
    await page.close();
    await context.close();
  });

  test.afterAll(async () => {
    await cleanupProject(projectId);
  });

  test('search filters projects', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    // Type the unique E2E name
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    // Should see exactly our project
    const matchingBtn = page.locator(`.projectNameBtn[data-id="${projectId}"]`);
    await expect(matchingBtn).toBeVisible();

    // Other projects should be hidden (search filters)
    const allVisible = page.locator('.projectNameBtn:visible');
    const visibleCount = await allVisible.count();
    expect(visibleCount).toBe(1);
  });

  test('lijst/bord toggle', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    // Default is list view — verify table exists
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Switch to board view (only works on >= lg viewport)
    await page.setViewportSize({ width: 1200, height: 800 });
    const bordBtn = page.locator('#viewToggle button[data-view="board"]');

    if (await bordBtn.isVisible().catch(() => false)) {
      await bordBtn.click();
      await page.waitForTimeout(500);

      // Verify kanban board appears
      const board = page.locator('.kanban-board');
      await expect(board).toBeVisible();

      // Verify columns exist
      const columns = page.locator('.kanban-col');
      const colCount = await columns.count();
      expect(colCount).toBeGreaterThanOrEqual(3);

      // Switch back to list
      const lijstBtn = page.locator('#viewToggle button[data-view="list"]');
      await lijstBtn.click();
      await page.waitForTimeout(500);

      // Verify table is back
      await expect(table).toBeVisible();
    }
  });

  test('photo upload in drawer', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    // Open drawer
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);
    await page.click(`.projectNameBtn[data-id="${projectId}"]`);
    await page.waitForSelector('#drawer.show', { timeout: 10_000 });

    // Scroll to photo section
    const photoSection = page.locator('#drawerPhotoUploader');
    await photoSection.scrollIntoViewIfNeeded();

    // Upload a test photo via the gallery file input (not the camera one)
    const fileInput = photoSection.locator('input[type="file"][data-pu-gallery]');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(PHOTO_PATH);

      // Wait for upload + tag modal or grid update
      await page.waitForTimeout(5000);

      // If tag modal appears, close it (click Save/OK)
      const tagModal = page.locator('.modal.show');
      if (await tagModal.isVisible().catch(() => false)) {
        const saveBtn = tagModal.locator('button:has-text("Opslaan"), button:has-text("OK"), .btn-primary');
        if (await saveBtn.count() > 0) {
          await saveBtn.first().click();
          await page.waitForTimeout(1000);
        }
      }

      // Verify at least one photo thumbnail appears in the grid
      const photoThumb = photoSection.locator('.photo-grid img, .photo-grid .photo-thumb');
      const thumbCount = await photoThumb.count();
      expect(thumbCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('comments in drawer', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    // Open drawer
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);
    await page.click(`.projectNameBtn[data-id="${projectId}"]`);
    await page.waitForSelector('#drawer.show', { timeout: 10_000 });

    // Scroll to comments section
    const commentInput = page.locator('#drawerCommentInput');
    await commentInput.scrollIntoViewIfNeeded();

    // Type a comment
    const commentText = `E2E test comment ${Date.now()}`;
    await commentInput.fill(commentText);

    // Submit
    await page.click('#drawerCommentSubmit');
    await page.waitForTimeout(2000);

    // Verify comment appears in list
    const commentsList = page.locator('#drawerCommentsList');
    await expect(commentsList).toContainText(commentText);
  });
});
