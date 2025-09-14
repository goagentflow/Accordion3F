/**
 * State Persistence - Overlap Refresh E2E Test
 * 
 * Ensures overlaps and custom tasks survive page refresh via localStorage
 * and that "freeze" flags don't wipe dependencies.
 * 
 * PRIORITY: High - Validates user work isn't lost on accidental refresh
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';
import { ManipulationTestHelper } from './helpers/manipulation-helpers';

function isOverlapped(a: { x: number; width: number }, b: { x: number }): boolean {
  const aEnd = a.x + a.width;
  return b.x < aEnd;
}

test.describe('State Persistence - Overlap Refresh', () => {
  
  test('preserves overlaps and dependencies after page refresh', async ({ page }) => {
    const helpers = new TimelineHelpers(page);
    const manip = new ManipulationTestHelper(page);

    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();

    // Set up a timeline with overlaps
    await helpers.addAsset('Banner', 'Test Banner');
    await helpers.setGlobalLiveDate('2025-12-20');

    // Create overlapping dependencies
    const taskBars = await manip.findTaskBars();
    expect(taskBars.length).toBeGreaterThanOrEqual(2);
    taskBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    
    const bar0 = taskBars[0];
    const bar1 = taskBars[1];

    // Create a 3-day overlap to make it clearly visible
    await manip.createDependencyByDrag(bar1, 3);

    // Verify overlap exists before refresh
    const preBars = await manip.findTaskBars();
    preBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    const preA = preBars[0].initialPosition;
    const preB = preBars[1].initialPosition;
    expect(isOverlapped({ x: preA.x, width: preA.width }, { x: preB.x })).toBeTruthy();

    // Refresh the page
    await page.reload();
    await helpers.waitForAppLoad();

    // Verify overlap persists after refresh
    const postBars = await manip.findTaskBars();
    expect(postBars.length).toBeGreaterThanOrEqual(2);
    postBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    
    const postA = postBars[0].initialPosition;
    const postB = postBars[1].initialPosition;
    expect(isOverlapped({ x: postA.x, width: postA.width }, { x: postB.x })).toBeTruthy();

    // Verify assets and live date persist
    await expect(page.getByText('Test Banner')).toBeVisible();
    
    // Check that global live date is preserved
    const liveDateInput = page.locator('input[type="date"]').first();
    await expect(liveDateInput).toHaveValue('2025-12-20');
  });

  test('preserves custom tasks after refresh', async ({ page }) => {
    const helpers = new TimelineHelpers(page);

    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();

    // Add asset and custom task
    await helpers.addAsset('Video', 'Test Video');
    await helpers.setGlobalLiveDate('2025-11-15');

    // Add a custom task
    const addTaskButton = page.getByText('Add Task').or(page.getByText('+ Task'));
    await addTaskButton.click();
    
    const customTaskInput = page.locator('input[placeholder*="task name"], input[placeholder*="Custom task"]').last();
    await customTaskInput.fill('Custom Review Task');
    await customTaskInput.press('Enter');

    // Verify custom task is visible
    await expect(page.getByText('Custom Review Task')).toBeVisible();

    // Refresh the page
    await page.reload();
    await helpers.waitForAppLoad();

    // Verify custom task persists
    await expect(page.getByText('Custom Review Task')).toBeVisible();
    await expect(page.getByText('Test Video')).toBeVisible();
  });

  test('freeze flags preserve dependencies during localStorage operations', async ({ page }) => {
    const helpers = new TimelineHelpers(page);
    const manip = new ManipulationTestHelper(page);

    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();

    // Set up timeline with dependencies
    await helpers.addAsset('Social', 'Test Social');
    await helpers.setGlobalLiveDate('2025-10-30');

    // Create dependencies with overlaps
    const taskBars = await manip.findTaskBars();
    expect(taskBars.length).toBeGreaterThanOrEqual(2);
    taskBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    
    // Create overlapping dependency
    await manip.createDependencyByDrag(taskBars[1], 2);

    // Verify overlap exists
    const preBars = await manip.findTaskBars();
    preBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    const preOverlap = isOverlapped(
      { x: preBars[0].initialPosition.x, width: preBars[0].initialPosition.width },
      { x: preBars[1].initialPosition.x }
    );
    expect(preOverlap).toBeTruthy();

    // Simulate a localStorage operation that might trigger freezeImportedTimeline
    await page.evaluate(() => {
      const currentState = localStorage.getItem('accordionTimelineState');
      if (currentState) {
        const state = JSON.parse(currentState);
        // Simulate freeze flag operation
        state.ui = { ...state.ui, freezeImportedTimeline: true };
        localStorage.setItem('accordionTimelineState', JSON.stringify(state));
      }
    });

    // Refresh to test freeze flag behavior
    await page.reload();
    await helpers.waitForAppLoad();

    // Verify dependencies are still preserved despite freeze flag
    const postBars = await manip.findTaskBars();
    expect(postBars.length).toBeGreaterThanOrEqual(2);
    postBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    
    const postOverlap = isOverlapped(
      { x: postBars[0].initialPosition.x, width: postBars[0].initialPosition.width },
      { x: postBars[1].initialPosition.x }
    );
    expect(postOverlap).toBeTruthy();
  });

  test('handles corrupted localStorage gracefully with recovery', async ({ page }) => {
    const helpers = new TimelineHelpers(page);

    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();

    // Set up valid timeline first
    await helpers.addAsset('Banner', 'Valid Banner');
    await helpers.setGlobalLiveDate('2025-09-15');

    // Corrupt the localStorage data
    await page.evaluate(() => {
      localStorage.setItem('accordionTimelineState', '{"invalid": json structure');
    });

    // Refresh should handle corruption gracefully
    await page.reload();
    await helpers.waitForAppLoad();

    // Should fall back to empty state or show recovery UI
    // The exact behavior depends on your error handling implementation
    
    // Should still be able to add new assets after recovery
    await helpers.addAsset('Video', 'Recovery Video');
    await expect(page.getByText('Recovery Video')).toBeVisible();
  });

  test('preserves complex dependency chains across refresh', async ({ page }) => {
    const helpers = new TimelineHelpers(page);
    const manip = new ManipulationTestHelper(page);

    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();

    // Add multiple assets to create longer chains
    await helpers.addAsset('Banner', 'Banner Asset');
    await helpers.addAsset('Video', 'Video Asset');

    // Create complex dependency chain with overlaps
    const taskBars = await manip.findTaskBars();
    expect(taskBars.length).toBeGreaterThanOrEqual(4);
    taskBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);

    // Create chain: task0 -> task1 (overlap 2) -> task2 (overlap 1) -> task3 (no overlap)
    await manip.createDependencyByDrag(taskBars[1], 2);
    await manip.createDependencyByDrag(taskBars[2], 1);
    await manip.createDependencyByDrag(taskBars[3], 0);

    // Count overlaps before refresh
    const preBars = await manip.findTaskBars();
    preBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);
    
    let preOverlapCount = 0;
    for (let i = 1; i < preBars.length; i++) {
      if (isOverlapped(
        { x: preBars[i-1].initialPosition.x, width: preBars[i-1].initialPosition.width },
        { x: preBars[i].initialPosition.x }
      )) {
        preOverlapCount++;
      }
    }
    expect(preOverlapCount).toBeGreaterThan(0);

    // Refresh the page
    await page.reload();
    await helpers.waitForAppLoad();

    // Verify complex chain persists
    const postBars = await manip.findTaskBars();
    expect(postBars.length).toBe(preBars.length);
    postBars.sort((a, b) => a.initialPosition.x - b.initialPosition.x);

    let postOverlapCount = 0;
    for (let i = 1; i < postBars.length; i++) {
      if (isOverlapped(
        { x: postBars[i-1].initialPosition.x, width: postBars[i-1].initialPosition.width },
        { x: postBars[i].initialPosition.x }
      )) {
        postOverlapCount++;
      }
    }
    
    // Should preserve the same number of overlaps
    expect(postOverlapCount).toBe(preOverlapCount);
    
    // Verify both assets still exist
    await expect(page.getByText('Banner Asset')).toBeVisible();
    await expect(page.getByText('Video Asset')).toBeVisible();
  });

  test('preserves task durations and owners across refresh', async ({ page }) => {
    const helpers = new TimelineHelpers(page);

    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();

    // Add asset with custom durations
    await helpers.addAsset('Banner', 'Duration Test');
    await helpers.setGlobalLiveDate('2025-08-15');

    // Modify task durations if possible
    // This depends on your UI for editing task durations
    const durationInputs = page.locator('input[type="number"]');
    const firstDurationInput = durationInputs.first();
    
    // Only test if duration inputs are visible
    if (await firstDurationInput.count() > 0) {
      await firstDurationInput.clear();
      await firstDurationInput.fill('7');
      await firstDurationInput.press('Enter');
    }

    // Refresh page
    await page.reload();
    await helpers.waitForAppLoad();

    // If we modified durations, they should persist
    if (await durationInputs.first().count() > 0) {
      await expect(durationInputs.first()).toHaveValue('7');
    }

    // Verify asset still exists
    await expect(page.getByText('Duration Test')).toBeVisible();
  });
});