/**
 * Excel Round-Trip – Concurrency Regression
 * Ensures overlaps (FS with negative lag) survive export → refresh → import.
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';
import { ManipulationTestHelper } from './helpers/manipulation-helpers';

function isOverlapped(a: { x: number; width: number }, b: { x: number }): boolean {
  const aEnd = a.x + a.width; // right edge of first bar
  return b.x < aEnd; // second bar starts before first ends
}

test.describe('Excel Round-Trip – Overlaps', () => {
  test('preserves 1–2 day overlap after import', async ({ page }) => {
    const helpers = new TimelineHelpers(page);
    const manip = new ManipulationTestHelper(page);

    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();

    // Minimal setup: one asset and a live date
    await helpers.addAsset('Banner', 'Overlap Banner');
    await helpers.setGlobalLiveDate('2025-12-25');

    // Find two task bars and create an overlap by dragging the second left
    const taskBars = await manip.findTaskBars();
    expect(taskBars.length).toBeGreaterThanOrEqual(2);
    // Sort by X position so bar0 is earlier, bar1 is the next one (successor)
    taskBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    const bar0 = taskBars[0];
    const bar1 = taskBars[1];

    // Create ~2-day overlap to make it visually obvious and resilient
    await manip.createDependencyByDrag(bar1, 2);

    // Re-read positions to confirm overlap exists before export
    const refBars = await manip.findTaskBars();
    refBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    const preA = refBars[0].initialPosition;
    const preB = refBars[1].initialPosition;
    expect(isOverlapped({ x: preA.x, width: preA.width }, { x: preB.x })).toBeTruthy();

    // Export to Excel
    const exportPath = await helpers.exportToExcel();

    // Reload + clear and import the same file
    await page.reload();
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
    await helpers.importFromExcel(exportPath);

    // Verify overlap persists after import by checking bar geometry again
    const postBars = await manip.findTaskBars();
    expect(postBars.length).toBeGreaterThanOrEqual(2);
    postBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    const postA = postBars[0].initialPosition;
    const postB = postBars[1].initialPosition;
    expect(isOverlapped({ x: postA.x, width: postA.width }, { x: postB.x })).toBeTruthy();
  });
});

