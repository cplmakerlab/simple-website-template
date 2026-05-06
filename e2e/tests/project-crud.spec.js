// e2e/tests/project-crud.spec.js
import { test, expect } from '../helpers/auth-fixture.js';
import { createTestProject, cleanupProject } from '../helpers/project-helpers.js';

let projectId;
let customerName;

test.describe('Project CRUD lifecycle', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const result = await createTestProject(page, {
      customerName: `E2E_CRUD_${Date.now()}`,
    });
    projectId = result.projectId;
    customerName = result.customerName;
    await page.close();
    await context.close();
  });

  test.afterAll(async () => {
    await cleanupProject(projectId);
  });

  test('project appears in dashboard list', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    const row = page.locator(`.projectNameBtn[data-id="${projectId}"]`);
    await expect(row).toBeVisible();
  });

  test('drawer opens with project details', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });

    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    await page.click(`.projectNameBtn[data-id="${projectId}"]`);
    await page.waitForSelector('#drawer.show', { timeout: 10_000 });

    // Verify drawer shows correct project name
    const drawerTitle = page.locator('#drawerHeaderTitle');
    await expect(drawerTitle).toContainText(customerName);
  });

  test('edit project metadata', async ({ page }) => {
    // Navigate to edit page
    await page.goto(`/project-edit.html?project=${projectId}`);
    await page.waitForSelector('#fPhone', { state: 'visible', timeout: 15_000 });

    // Fill in phone number
    await page.fill('#fPhone', '+32470123456');
    await page.click('#btnSave');
    await page.waitForTimeout(2000);

    // Verify in drawer
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    await page.click(`.projectNameBtn[data-id="${projectId}"]`);
    await page.waitForSelector('#drawer.show', { timeout: 10_000 });

    const drawerBody = page.locator('#drawerBody');
    await expect(drawerBody).toContainText('+32470123456');
  });

  test('change status via chip', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    // Click the status chip dropdown trigger
    const chipBtn = page.locator(`tr:has(.projectNameBtn[data-id="${projectId}"]) .status-chip`);
    await chipBtn.click();

    // Select "Wachten op data" from the dropdown
    const statusOption = page.locator(
      `.dropdown-item[data-status="wachten_op_data"][data-project-id="${projectId}"]`
    );
    await statusOption.click();
    await page.waitForTimeout(1000);

    // Verify chip updated
    const updatedChip = page.locator(`tr:has(.projectNameBtn[data-id="${projectId}"]) .status-chip`);
    await expect(updatedChip).toContainText('Wachten op data');
  });

  test('soft delete and restore', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForSelector('.projectNameBtn', { state: 'visible', timeout: 15_000 });
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    // Soft delete
    page.once('dialog', dialog => dialog.accept());
    await page.click(`.deleteBtn[data-id="${projectId}"]`);
    await page.waitForTimeout(1000);

    // Verify project gone from list
    const gone = page.locator(`.projectNameBtn[data-id="${projectId}"]`);
    await expect(gone).toHaveCount(0);

    // Enable "Toon verwijderde"
    await page.check('#toggleShowDeleted');
    await page.waitForTimeout(1000);

    // Search again
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);

    // Verify project visible (deleted state)
    const deleted = page.locator(`.projectNameBtn[data-id="${projectId}"]`);
    await expect(deleted).toBeVisible();

    // Restore
    await page.click(`.restoreBtn[data-id="${projectId}"]`);
    await page.waitForTimeout(1000);

    // Uncheck "Toon verwijderde"
    await page.uncheck('#toggleShowDeleted');
    await page.waitForTimeout(500);

    // Search and verify project back in normal list
    await page.fill('#projectSearch', customerName);
    await page.waitForTimeout(500);
    const restored = page.locator(`.projectNameBtn[data-id="${projectId}"]`);
    await expect(restored).toBeVisible();
  });
});
