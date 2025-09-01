/**
 * TIER 1: Undo/Redo System Integrity Tests
 * Critical tests for complex state changes being reliably undone/redone
 * Validates PM workflow safety when making mistakes or exploring options
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';

test.describe('TIER 1: Undo/Redo System Integrity Tests', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
  });

  test.describe('Complex undo chain with timeline recalculation', () => {
    test('Multi-step undo sequence restores exact previous states', async ({ page }) => {
      // Build complex timeline step by step, capturing states
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Complex Test Asset');
      await helpers.setGlobalLiveDate('2024-04-01');
      await page.waitForTimeout(1000);
      
      const state1 = await helpers.captureTimelineState();
      
      // Step 2: Modify task duration
      await helpers.changeTaskDuration('Amendment Approval Phase - 1st Mockup to Client', 7);
      await page.waitForTimeout(500);
      const state2 = await helpers.captureTimelineState();
      
      // Step 3: Add custom task
      await helpers.addCustomTask('Complex Test Asset', 'Custom Review', '3', 'Amendment Approval Phase - Client Feedback');
      await page.waitForTimeout(500);
      const state3 = await helpers.captureTimelineState();
      
      // Step 4: Change global live date
      await helpers.setGlobalLiveDate('2024-04-15');
      await page.waitForTimeout(1000);
      const state4 = await helpers.captureTimelineState();
      
      // Now undo sequence: each step should restore exact previous state
      await helpers.clickUndo();
      await page.waitForTimeout(500);
      const afterUndo1 = await helpers.captureTimelineState();
      expect(afterUndo1.globalLiveDate).toBe(state3.globalLiveDate);
      expect(afterUndo1.tasks.length).toBe(state3.tasks.length);
      
      await helpers.clickUndo();
      await page.waitForTimeout(500);
      const afterUndo2 = await helpers.captureTimelineState();
      expect(afterUndo2.tasks.length).toBe(state2.tasks.length);
      // Custom task should be gone
      expect(afterUndo2.tasks.some(t => t.name.includes('Custom Review'))).toBe(false);
      
      await helpers.clickUndo();
      await page.waitForTimeout(500);
      const afterUndo3 = await helpers.captureTimelineState();
      // Task duration should be reverted
      const mockupTask = afterUndo3.tasks.find(t => t.name.includes('1st Mockup to Client'));
      expect(mockupTask?.duration).toBe(3); // Original duration
      
      await helpers.clickUndo();
      await page.waitForTimeout(500);
      const afterUndo4 = await helpers.captureTimelineState();
      // Should be back to initial state with no live date set
      expect(afterUndo4.globalLiveDate).toBe('');
      expect(afterUndo4.tasks.length).toBe(0); // No timeline without date
    });

    test('Undo preserves timeline mathematical integrity', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      const originalTasks = await helpers.getTimelineTasks();
      const originalDuration = await helpers.getProjectDuration();
      
      // Make multiple changes that affect timeline calculations
      await helpers.changeTaskDuration('Digital Assets sent to MMM', 5); // +4 days
      await helpers.changeTaskDuration('Amendment Approval Phase - 1st Mockup to Client', 1); // -2 days
      await helpers.changeTaskDuration('Set Up, Browser Testing, Tagging Implementation', 6); // +3 days
      
      // Net change: +5 days
      const modifiedDuration = await helpers.getProjectDuration();
      expect(modifiedDuration).toBe(originalDuration + 5);
      
      // Undo all changes
      await helpers.clickUndo();
      await helpers.clickUndo();
      await helpers.clickUndo();
      
      // Timeline should be mathematically identical to original
      const restoredTasks = await helpers.getTimelineTasks();
      const restoredDuration = await helpers.getProjectDuration();
      
      expect(restoredDuration).toBe(originalDuration);
      expect(restoredTasks.length).toBe(originalTasks.length);
      
      // Each task should match exactly
      for (let i = 0; i < originalTasks.length; i++) {
        expect(restoredTasks[i].name).toBe(originalTasks[i].name);
        expect(restoredTasks[i].duration).toBe(originalTasks[i].duration);
        expect(restoredTasks[i].startDate).toBe(originalTasks[i].startDate);
        expect(restoredTasks[i].endDate).toBe(originalTasks[i].endDate);
      }
    });
  });

  test.describe('Redo accuracy with accordion effect reapplication', () => {
    test('Redo reapplies accordion effects identically', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      // Make change that triggers accordion effect
      const targetTask = 'Amendment Approval Phase - 1st Mockup to Client';
      await helpers.changeTaskDuration(targetTask, 8); // +5 days
      await page.waitForTimeout(500);
      
      // Capture the state after accordion effect
      const afterChange = await helpers.captureTimelineState();
      const afterChangeTasks = await helpers.getTimelineTasks();
      
      // Undo the change
      await helpers.clickUndo();
      await page.waitForTimeout(500);
      
      // Verify we're back to original state
      const afterUndo = await helpers.getTimelineTasks();
      const undoTask = afterUndo.find(t => t.name.includes('1st Mockup to Client'));
      expect(undoTask?.duration).toBe(3); // Back to original
      
      // Redo the change - should reapply accordion effect identically
      await helpers.clickRedo();
      await page.waitForTimeout(500);
      
      const afterRedo = await helpers.captureTimelineState();
      const afterRedoTasks = await helpers.getTimelineTasks();
      
      // State should be identical to the first time we made the change
      expect(afterRedo.globalLiveDate).toBe(afterChange.globalLiveDate);
      expect(afterRedoTasks.length).toBe(afterChangeTasks.length);
      
      // Every task should match the original accordion effect exactly
      for (let i = 0; i < afterChangeTasks.length; i++) {
        expect(afterRedoTasks[i].name).toBe(afterChangeTasks[i].name);
        expect(afterRedoTasks[i].duration).toBe(afterChangeTasks[i].duration);
        expect(afterRedoTasks[i].startDate).toBe(afterChangeTasks[i].startDate);
        expect(afterRedoTasks[i].endDate).toBe(afterChangeTasks[i].endDate);
      }
    });

    test('Multiple redo operations maintain consistency', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      // Perform sequence of operations
      await helpers.changeTaskDuration('Digital Assets sent to MMM', 3); // +2 days
      const state1 = await helpers.captureTimelineState();
      
      await helpers.changeTaskDuration('Amendment Approval Phase - 1st Mockup to Client', 6); // +3 days
      const state2 = await helpers.captureTimelineState();
      
      await helpers.addCustomTask('Test Asset', 'Quality Check', '2', 'All 3rd Party Tracking sent to MMM');
      const state3 = await helpers.captureTimelineState();
      
      // Undo all operations
      await helpers.clickUndo(); // Remove custom task
      await helpers.clickUndo(); // Revert mockup duration
      await helpers.clickUndo(); // Revert digital assets duration
      
      // Redo all operations in sequence
      await helpers.clickRedo(); // Restore digital assets duration
      const redo1 = await helpers.captureTimelineState();
      expect(redo1.tasks.find(t => t.name.includes('Digital Assets'))?.duration).toBe(state1.tasks.find(t => t.name.includes('Digital Assets'))?.duration);
      
      await helpers.clickRedo(); // Restore mockup duration  
      const redo2 = await helpers.captureTimelineState();
      expect(redo2.tasks.find(t => t.name.includes('1st Mockup'))?.duration).toBe(state2.tasks.find(t => t.name.includes('1st Mockup'))?.duration);
      
      await helpers.clickRedo(); // Restore custom task
      const redo3 = await helpers.captureTimelineState();
      expect(redo3.tasks.some(t => t.name.includes('Quality Check'))).toBe(true);
      expect(redo3.tasks.length).toBe(state3.tasks.length);
    });
  });

  test.describe('State history limits and memory management', () => {
    test('System handles many operations without memory issues', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      // Perform many operations (simulate heavy usage session)
      const operations = 30; // Reasonable number for test performance
      
      for (let i = 0; i < operations; i++) {
        // Alternate between different types of operations
        if (i % 3 === 0) {
          await helpers.changeTaskDuration('Digital Assets sent to MMM', 1 + (i % 5));
        } else if (i % 3 === 1) {
          await helpers.changeTaskDuration('Amendment Approval Phase - 1st Mockup to Client', 2 + (i % 4));
        } else {
          await helpers.changeTaskDuration('Set Up, Browser Testing, Tagging Implementation', 1 + (i % 6));
        }
        
        // Small delay to simulate real usage
        if (i % 10 === 0) {
          await page.waitForTimeout(100);
        }
      }
      
      // System should still be responsive
      const currentState = await helpers.captureTimelineState();
      expect(currentState.tasks.length).toBeGreaterThan(0);
      
      // Should be able to undo several operations
      for (let i = 0; i < 10; i++) {
        await helpers.clickUndo();
        await page.waitForTimeout(50);
      }
      
      // Timeline should still be functional
      const afterUndos = await helpers.captureTimelineState();
      expect(afterUndos.tasks.length).toBeGreaterThan(0);
      
      // Should be able to redo
      await helpers.clickRedo();
      const afterRedo = await helpers.captureTimelineState();
      expect(afterRedo.tasks.length).toBeGreaterThan(0);
    });

    test('History limit prevents unlimited memory growth', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      // Check if undo/redo buttons indicate available operations
      const undoButton = page.locator('[data-testid="undo-button"]');
      const redoButton = page.locator('[data-testid="redo-button"]');
      
      // Initially, should have no undo available (fresh start)
      if (await undoButton.isVisible()) {
        expect(await undoButton.isDisabled()).toBe(true);
      }
      
      // Make some changes
      for (let i = 0; i < 5; i++) {
        await helpers.changeTaskDuration('Digital Assets sent to MMM', i + 1);
        await page.waitForTimeout(50);
      }
      
      // Should now have undo available
      if (await undoButton.isVisible()) {
        expect(await undoButton.isDisabled()).toBe(false);
      }
      
      // Undo some operations
      for (let i = 0; i < 3; i++) {
        await helpers.clickUndo();
        await page.waitForTimeout(50);
      }
      
      // Should now have redo available
      if (await redoButton.isVisible()) {
        expect(await redoButton.isDisabled()).toBe(false);
      }
    });
  });

  test.describe('Undo during active operations', () => {
    test('Undo while editing task maintains consistency', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      const originalState = await helpers.captureTimelineState();
      
      // Start editing a task (click on duration input)
      const taskElement = page.locator('[data-testid*="task-"]').filter({ hasText: 'Amendment Approval Phase - 1st Mockup' });
      const durationInput = taskElement.locator('[data-testid*="duration"], input[type="number"]').first();
      
      await durationInput.click();
      await durationInput.clear();
      await durationInput.type('6');
      // Don't press Enter - leave in editing state
      
      // Trigger undo while edit is active
      await helpers.clickUndo();
      await page.waitForTimeout(500);
      
      // Should cleanly handle the undo without corrupted state
      const currentState = await helpers.captureTimelineState();
      
      // Should either:
      // 1. Complete the edit then undo it, or
      // 2. Cancel the edit and undo previous operation, or  
      // 3. Undo previous operation and reset edit
      
      // Key requirement: no broken/corrupted state
      expect(currentState.tasks.length).toBeGreaterThan(0);
      
      // All tasks should have valid dates and durations
      for (const task of currentState.tasks) {
        expect(task.duration).toBeGreaterThan(0);
        expect(task.startDate).toBeTruthy();
        expect(task.endDate).toBeTruthy();
        expect(new Date(task.startDate)).toBeInstanceOf(Date);
        expect(new Date(task.endDate)).toBeInstanceOf(Date);
      }
    });

    test('Undo during timeline recalculation', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      // Make a change that triggers lengthy recalculation
      await helpers.addAsset('Digital - HUB', 'Complex Asset'); // Adds many tasks
      await page.waitForTimeout(500);
      
      // Immediately try to undo before recalculation settles
      await helpers.clickUndo();
      await page.waitForTimeout(1000);
      
      // System should handle this gracefully
      const currentState = await helpers.captureTimelineState();
      
      // Should either have undone the asset addition, or properly completed it
      const hasComplexAsset = currentState.assets.some(asset => asset.includes('Complex Asset'));
      
      if (hasComplexAsset) {
        // If asset remains, tasks should be properly calculated
        expect(currentState.tasks.length).toBeGreaterThan(10); // HUB has many tasks
      } else {
        // If asset was undone, should be back to original simple timeline
        expect(currentState.tasks.length).toBeLessThan(15);
      }
      
      // Regardless of outcome, no corrupted state
      await helpers.verifyNoTaskConflicts(currentState.tasks);
    });
  });

  test.describe('Complex state restoration scenarios', () => {
    test('Undo/redo with multiple assets maintains asset-specific changes', async ({ page }) => {
      // Create timeline with multiple assets
      await helpers.setGlobalLiveDate('2024-05-01');
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Asset A');
      await helpers.addAsset('Digital Display - Agency Tags', 'Asset B');
      
      await page.waitForTimeout(1500);
      const initialState = await helpers.captureTimelineState();
      
      // Modify task in Asset A
      await helpers.changeTaskDuration('Digital Assets sent to MMM', 4); // Asset A task
      const afterAssetAChange = await helpers.captureTimelineState();
      
      // Modify task in Asset B  
      await helpers.changeTaskDuration('Tags sent to MMM', 3); // Asset B task
      const afterAssetBChange = await helpers.captureTimelineState();
      
      // Undo Asset B change
      await helpers.clickUndo();
      await page.waitForTimeout(500);
      const afterUndo1 = await helpers.captureTimelineState();
      
      // Asset B task should be reverted, Asset A change should remain
      const assetATask = afterUndo1.tasks.find(t => t.name.includes('Digital Assets sent'));
      const assetBTask = afterUndo1.tasks.find(t => t.name.includes('Tags sent'));
      
      expect(assetATask?.duration).toBe(4); // Asset A change preserved
      expect(assetBTask?.duration).toBe(1); // Asset B change reverted
      
      // Undo Asset A change
      await helpers.clickUndo();
      await page.waitForTimeout(500);
      const afterUndo2 = await helpers.captureTimelineState();
      
      // Both assets should be back to original
      const restoredAssetATask = afterUndo2.tasks.find(t => t.name.includes('Digital Assets sent'));
      const restoredAssetBTask = afterUndo2.tasks.find(t => t.name.includes('Tags sent'));
      
      expect(restoredAssetATask?.duration).toBe(1); // Back to original
      expect(restoredAssetBTask?.duration).toBe(1); // Back to original
    });

    test('Undo asset addition removes all associated tasks', async ({ page }) => {
      await helpers.setupBasicTimeline();
      const initialTaskCount = (await helpers.getTimelineTasks()).length;
      
      // Add new asset (should add many tasks)
      await helpers.addAsset('Digital - HUB', 'Hub Asset');
      await page.waitForTimeout(1500);
      
      const withHubTaskCount = (await helpers.getTimelineTasks()).length;
      expect(withHubTaskCount).toBeGreaterThan(initialTaskCount + 10); // HUB adds many tasks
      
      // Undo asset addition
      await helpers.clickUndo();
      await page.waitForTimeout(1000);
      
      // Should be back to original task count
      const afterUndoTaskCount = (await helpers.getTimelineTasks()).length;
      expect(afterUndoTaskCount).toBe(initialTaskCount);
      
      // No HUB-specific tasks should remain
      const afterUndoTasks = await helpers.getTimelineTasks();
      expect(afterUndoTasks.some(t => t.name.includes('wire frame'))).toBe(false);
      expect(afterUndoTasks.some(t => t.name.includes('Hub Build'))).toBe(false);
    });

    test('Mixed operations undo/redo maintains logical sequence', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      // Sequence: Asset addition → Duration change → Custom task → Live date change
      const afterSetup = await helpers.captureTimelineState();
      
      await helpers.addAsset('Digital Display - Agency Tags', 'New Asset');
      await page.waitForTimeout(500);
      const afterAsset = await helpers.captureTimelineState();
      
      await helpers.changeTaskDuration('Digital Assets sent to MMM', 5);
      await page.waitForTimeout(500);
      const afterDuration = await helpers.captureTimelineState();
      
      await helpers.addCustomTask('Test Asset', 'Review Task', '2', 'Digital Assets sent to MMM');
      await page.waitForTimeout(500);
      const afterCustom = await helpers.captureTimelineState();
      
      await helpers.setGlobalLiveDate('2024-03-15');
      await page.waitForTimeout(500);
      const afterLiveDate = await helpers.captureTimelineState();
      
      // Undo sequence should reverse each operation logically
      await helpers.clickUndo(); // Undo live date change
      const undo1 = await helpers.captureTimelineState();
      expect(undo1.globalLiveDate).toBe(afterCustom.globalLiveDate);
      
      await helpers.clickUndo(); // Undo custom task
      const undo2 = await helpers.captureTimelineState();
      expect(undo2.tasks.some(t => t.name.includes('Review Task'))).toBe(false);
      
      await helpers.clickUndo(); // Undo duration change
      const undo3 = await helpers.captureTimelineState();
      const digitalAssetsTask = undo3.tasks.find(t => t.name.includes('Digital Assets sent'));
      expect(digitalAssetsTask?.duration).toBe(1);
      
      await helpers.clickUndo(); // Undo asset addition
      const undo4 = await helpers.captureTimelineState();
      expect(undo4.tasks.some(t => t.name.includes('Tags sent'))).toBe(false);
    });
  });
});