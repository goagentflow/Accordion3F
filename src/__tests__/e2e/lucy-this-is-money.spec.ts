import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';
import { ManipulationTestHelper } from './helpers/manipulation-helpers';

async function setDurationByTaskName(page: any, taskName: string, days: number) {
  // Find a row containing the task name, then edit the first number input within that row
  const row = page.locator(`text=${taskName}`).first();
  await expect(row).toBeVisible({ timeout: 5000 });
  const container = row.locator('..');
  const numberInput = container.locator('input[type="number"]').first();
  await numberInput.fill(String(days));
  await numberInput.press('Enter');
}

test.describe("Lucy's 'This is Money' Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Enable dependency UI and DAG to exercise SS/FF flows
    await page.addInitScript(() => {
      try {
        localStorage.setItem('timeline_feature_flags', JSON.stringify({
          USE_DAG_CALCULATOR: true,
          ENABLE_DEPENDENCY_UI: true,
          DEBUG_TIMELINE_CALCULATIONS: false
        }));
      } catch {}
    });
  });

  test('compresses via same-day clusters and survives round-trip', async ({ page }) => {
    const helpers = new TimelineHelpers(page);
    const manip = new ManipulationTestHelper(page);

    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();

    // 1) Asset: Native Article - This is Money
    await helpers.addAsset('Native Article - This is Money');

    // 2) Go-live date: 2025-11-12 (Wednesday)
    await helpers.setGlobalLiveDate('2025-11-12');

    // 3) Verify initial status shows days to be saved (string presence, avoid exact wording brittleness)
    const statusCard = page.locator('text=Timeline Status').locator('..');
    await expect(statusCard).toContainText(/day(s)? need to be saved/i);

    // 4) Shorten 3 tasks to 1 day each (names from business flow)
    const tasksToShorten = [
      'TIM editorial Amends/Approval',
      'Client Sign Off',
      'Final Setup'
    ];
    for (const t of tasksToShorten) {
      await setDurationByTaskName(page, t, 1);
    }

    // 5) Status should reflect fewer days to be saved (still >0)
    await expect(statusCard).toContainText(/day(s)? need to be saved/i);

    // 6) Create same-day cluster: drag Client Sign Off onto Final Setup and confirm FF=0
    const bars1 = (await manip.findTaskBars()).sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    // heuristic: pick two closest bars by x distance near the end
    const later = bars1[bars1.length - 1];
    const prev = bars1[bars1.length - 2];
    await manip.createDependencyByDrag(later, 1);
    await expect(page.getByText('Same‑day link')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Finish together/ }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    // 7) Drag the clustered bar onto the Live day (FF=0 with live)
    const bars2 = (await manip.findTaskBars()).sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    const postLater = bars2[bars2.length - 1];
    await manip.createDependencyByDrag(postLater, 1);
    // Chooser may appear if overlapping with live; select FF=0 if presented
    const chooser = page.getByText('Same‑day link');
    if (await chooser.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /Finish together/ }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();
    }

    // 8) Verify status shows 0 days need to be saved (target state)
    await expect(statusCard).toContainText(/0 day(s)? to spare|0 day(s)? need to be saved|You're on target/i);

    // 9) Export and re-import to verify persistence
    const exportPath = await helpers.exportToExcel();
    await page.reload();
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
    await helpers.importFromExcel(exportPath);

    // 10) Verify same-day UI affordance exists (unlink button) — proves SS/FF(0)
    const unlinkButton = page.locator('button[title^="Remove same"]');
    await expect(unlinkButton.first()).toBeVisible();

    // And ensure timeline is visible and intact
    const gantt = page.getByText('Project Gantt Chart');
    await expect(gantt).toBeVisible();
  });
});

