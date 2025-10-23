import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';
import { ManipulationTestHelper } from './helpers/manipulation-helpers';

function rightEdge(pos: { x: number; width: number }) {
  return pos.x + pos.width;
}

test.describe('SS/FF Same-day Concurrency – Excel Round-Trip', () => {
  test.beforeEach(async ({ page }) => {
    // Enable typed dependency UI and DAG calculator before app loads
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

  test('FF=0 same-day link persists through export/import', async ({ page }) => {
    const helpers = new TimelineHelpers(page);
    const manip = new ManipulationTestHelper(page);

    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();

    // Setup: add a simple asset and a weekday live date
    await helpers.addAsset('Banner', 'FF Cluster Banner');
    await helpers.setGlobalLiveDate('2025-11-18'); // Tuesday

    // Find two adjacent task bars
    const bars = (await manip.findTaskBars()).sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    expect(bars.length).toBeGreaterThanOrEqual(2);
    const earlier = bars[0];
    const later = bars[1];

    // Drag later onto earlier to trigger chooser
    await manip.createDependencyByDrag(later, 1);

    // Chooser should appear – choose Finish together (FF=0), then Confirm
    await expect(page.getByText('Same‑day link')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Finish together/ }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Export to Excel
    const exportPath = await helpers.exportToExcel();

  // Reload and import
  await page.reload();
  await helpers.waitForAppLoad();
  await helpers.clearStorage();
  await helpers.importFromExcel(exportPath);

  // Verify same-day finish (right edges approximately equal)
  const postBars = (await manip.findTaskBars()).sort((a, b) => a.initialPosition.x - b.initialPosition.x);
  expect(postBars.length).toBeGreaterThanOrEqual(2);
  const postA = postBars[0].initialPosition;
  const postB = postBars[1].initialPosition;
  const diffRight = Math.abs(rightEdge(postA) - rightEdge(postB));
  expect(diffRight).toBeLessThanOrEqual(2 * 48); // within two day-columns tolerance

  // Metadata assertion: unlink button must be visible (proves SS/FF(0) preserved)
  const unlinkButton = page.locator('button[title^="Remove same"]');
  await expect(unlinkButton.first()).toBeVisible();
  });
});
