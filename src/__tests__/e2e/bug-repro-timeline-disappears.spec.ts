
import { test, expect } from '@playwright/test';
import { ConcurrencyV1TestHelper } from './helpers/concurrency-v1-helpers';

test.describe('Bug Reproduction: Timeline Disappears', () => {
  let helper: ConcurrencyV1TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new ConcurrencyV1TestHelper(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
  });

  test('should not disappear after overlapping tasks and adding a custom task', async ({ page }) => {
    // 1. Add assets
    await helper.addAssetWithLogging('Digital Display - Creative (MMM creating)', 'Test Asset 1');
    await helper.addAssetWithLogging('Digital - HUB', 'Test Asset 2');

    // 2. Set a tight go-live date
    const today = new Date();
    const futureDate = new Date(today.setDate(today.getDate() + 5));
    const formattedDate = futureDate.toISOString().split('T')[0];
    await page.locator('input[type="date"]').first().fill(formattedDate);
    await page.waitForTimeout(1000); // wait for timeline to re-render

    // Ensure we have the warning message
    await expect(page.locator('text=Insufficient time for all tasks')).toBeVisible();

    // 3. Create overlaps
    const taskBars = await page.locator('[data-testid^="task-bar-"]');
    const firstAssetTasks = await taskBars.filter({ has: page.locator('[data-asset-id="asset-0"]') });

    // Drag the second task to overlap the first
    const task1 = await firstAssetTasks.nth(0);
    const task2 = await firstAssetTasks.nth(1);
    const task1Box = await task1.boundingBox();
    const task2Box = await task2.boundingBox();

    if (task1Box && task2Box) {
        await page.mouse.move(task2Box.x + task2Box.width / 2, task2Box.y + task2Box.height / 2);
        await page.mouse.down();
        await page.mouse.move(task1Box.x + task1Box.width / 2, task1Box.y + task1Box.height / 2, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
    }


    // 4. Insert a custom task
    await page.locator('button:has-text("Add Custom Task")').first().click();
    await page.locator('input[placeholder="Task Name"]').fill('My Custom Task');
    await page.locator('input[placeholder="Duration (days)"]').fill('2');
    await page.locator('button:has-text("Add Task")').click();
    await page.waitForTimeout(1000);

    // 5. Verify asset timeline is still visible
    const assetContainer = await page.locator('[data-asset-id="asset-0"]');
    await expect(assetContainer).toBeVisible();
    const taskRows = await assetContainer.locator('.gantt-task-row');
    await expect(taskRows).toHaveCountGreaterThan(0);
  });
});
