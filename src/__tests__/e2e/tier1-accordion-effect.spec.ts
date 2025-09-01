/**
 * TIER 1: Accordion Effect Validation Tests
 * Critical tests for duration changes cascading correctly through dependent tasks
 * Verifies the core PM workflow of adjusting tasks and seeing downstream effects
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';

test.describe('TIER 1: Accordion Effect Validation Tests', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
  });

  test.describe('Duration increase shifts subsequent tasks forward', () => {
    test('Increasing middle task duration shifts all following tasks', async ({ page }) => {
      // Setup basic timeline
      await helpers.setupBasicTimeline();
      
      // Capture initial state
      const originalState = await helpers.captureTimelineState();
      const originalEndDate = await helpers.getProjectEndDate();
      
      // Find a middle task to modify (Amendment Approval - 1st Mockup)
      const targetTask = 'Amendment Approval Phase - 1st Mockup to Client';
      const originalTask = await helpers.getTask(targetTask);
      expect(originalTask.duration).toBe(3); // Should be 3 days initially
      
      // Increase duration from 3→7 days (+4 days)
      await helpers.changeTaskDuration(targetTask, 7);
      
      // Verify the task duration changed
      const updatedTask = await helpers.getTask(targetTask);
      expect(updatedTask.duration).toBe(7);
      
      // Verify all subsequent tasks shifted forward by exactly 4 working days
      const newEndDate = await helpers.getProjectEndDate();
      const expectedNewEndDate = helpers.addWorkingDays(originalEndDate, 4);
      expect(newEndDate).toBe(expectedNewEndDate);
      
      // Verify specific subsequent tasks shifted correctly
      const subsequentTaskNames = [
        'Amendment Approval Phase - Client Feedback',
        'Amendment Approval Phase - 2nd Mockup to Client',
        'Live Date'
      ];
      
      for (const taskName of subsequentTaskNames) {
        const originalTaskState = originalState.tasks.find(t => t.name.includes(taskName));
        const currentTaskState = await helpers.getTask(taskName);
        
        if (originalTaskState) {
          const expectedStartDate = helpers.addWorkingDays(originalTaskState.startDate, 4);
          const expectedEndDate = helpers.addWorkingDays(originalTaskState.endDate, 4);
          
          expect(currentTaskState.startDate).toBe(expectedStartDate);
          expect(currentTaskState.endDate).toBe(expectedEndDate);
        }
      }
    });

    test('First task duration increase shifts entire timeline', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      const originalTasks = await helpers.getTimelineTasks();
      const firstTask = originalTasks[0];
      
      // Increase first task duration by 2 days
      await helpers.changeTaskDuration(firstTask.name, firstTask.duration + 2);
      
      // Every single task should shift by 2 days
      const updatedTasks = await helpers.getTimelineTasks();
      
      for (let i = 1; i < updatedTasks.length; i++) { // Skip first task
        const originalTask = originalTasks[i];
        const updatedTask = updatedTasks[i];
        
        const expectedStartDate = helpers.addWorkingDays(originalTask.startDate, 2);
        const expectedEndDate = helpers.addWorkingDays(originalTask.endDate, 2);
        
        expect(updatedTask.startDate).toBe(expectedStartDate);
        expect(updatedTask.endDate).toBe(expectedEndDate);
      }
    });

    test('Last task duration increase only affects project end date', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      const originalTasks = await helpers.getTimelineTasks();
      const lastTask = originalTasks[originalTasks.length - 1];
      const secondToLastTask = originalTasks[originalTasks.length - 2];
      
      // Increase last task duration
      await helpers.changeTaskDuration(lastTask.name, lastTask.duration + 3);
      
      // Verify only the last task changed, others remain same
      const updatedTasks = await helpers.getTimelineTasks();
      const updatedSecondToLast = updatedTasks[updatedTasks.length - 2];
      
      expect(updatedSecondToLast.startDate).toBe(secondToLastTask.startDate);
      expect(updatedSecondToLast.endDate).toBe(secondToLastTask.endDate);
      
      // But last task should have extended end date
      const updatedLastTask = updatedTasks[updatedTasks.length - 1];
      const expectedEndDate = helpers.addWorkingDays(lastTask.endDate, 3);
      expect(updatedLastTask.endDate).toBe(expectedEndDate);
    });
  });

  test.describe('Duration decrease compresses timeline correctly', () => {
    test('Decreasing task duration pulls subsequent tasks backward', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      const originalDuration = await helpers.getProjectDuration();
      const originalEndDate = await helpers.getProjectEndDate();
      
      // Find a task with sufficient duration to decrease
      const targetTask = 'Set Up, Browser Testing, Tagging Implementation, Link Testing';
      const originalTask = await helpers.getTask(targetTask);
      expect(originalTask.duration).toBe(3); // Should be 3 days
      
      // Shorten task from 3→1 days (-2 days)
      await helpers.changeTaskDuration(targetTask, 1);
      
      // Verify project duration decreased by 2 days
      const newDuration = await helpers.getProjectDuration();
      expect(newDuration).toBe(originalDuration - 2);
      
      // Verify live date remains fixed (global live date), start date moves later
      const globalLiveDate = await page.locator('[data-testid="global-live-date"]').inputValue();
      const newEndDate = await helpers.getProjectEndDate();
      expect(newEndDate).toBe(globalLiveDate);
      
      // Project should now start later
      const newStartDate = await helpers.getCalculatedStartDate();
      const originalStartDate = helpers.subtractWorkingDays(originalEndDate, originalDuration);
      const expectedNewStartDate = helpers.subtractWorkingDays(globalLiveDate, newDuration);
      
      expect(newStartDate).toBe(expectedNewStartDate);
    });

    test('Shortening multiple tasks compounds compression effect', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      const originalDuration = await helpers.getProjectDuration();
      
      // Shorten multiple tasks
      await helpers.changeTaskDuration('Amendment Approval Phase - 1st Mockup to Client', 1); // -2 days
      await helpers.changeTaskDuration('Amendment Approval Phase - 2nd Mockup to Client', 1); // -1 day  
      await helpers.changeTaskDuration('Set Up, Browser Testing, Tagging Implementation', 1); // -2 days
      
      // Total reduction: 5 days
      const newDuration = await helpers.getProjectDuration();
      expect(newDuration).toBe(originalDuration - 5);
      
      // Timeline should be 5 days shorter
      const globalLiveDate = await page.locator('[data-testid="global-live-date"]').inputValue();
      const actualStartDate = await helpers.getCalculatedStartDate();
      const expectedStartDate = helpers.subtractWorkingDays(globalLiveDate, newDuration);
      
      expect(actualStartDate).toBe(expectedStartDate);
    });
  });

  test.describe('Custom task insertion triggers accordion effect', () => {
    test('Adding custom task shifts subsequent tasks forward', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      const originalTasks = await helpers.getTimelineTasks();
      const insertAfterIndex = 4; // Insert after 5th task (0-indexed)
      const tasksAfterInsertPoint = originalTasks.slice(insertAfterIndex + 1);
      
      // Add custom task with 5-day duration after Task 5
      await helpers.addCustomTask('Test Asset', 'Special Client Review', '5', originalTasks[insertAfterIndex].name);
      
      // Verify custom task was inserted
      const updatedTasks = await helpers.getTimelineTasks();
      expect(updatedTasks.length).toBe(originalTasks.length + 1);
      
      // Find the custom task
      const customTask = updatedTasks.find(t => t.name.includes('Special Client Review'));
      expect(customTask).toBeDefined();
      expect(customTask?.duration).toBe(5);
      
      // Verify all tasks after insertion point shifted by 5 working days
      const tasksAfterCustom = updatedTasks.slice(insertAfterIndex + 2); // Skip the custom task
      
      for (let i = 0; i < tasksAfterInsertPoint.length; i++) {
        const originalTask = tasksAfterInsertPoint[i];
        const shiftedTask = tasksAfterCustom[i];
        
        if (originalTask && shiftedTask) {
          const expectedStartDate = helpers.addWorkingDays(originalTask.startDate, 5);
          const expectedEndDate = helpers.addWorkingDays(originalTask.endDate, 5);
          
          expect(shiftedTask.startDate).toBe(expectedStartDate);
          expect(shiftedTask.endDate).toBe(expectedEndDate);
        }
      }
    });

    test('Adding custom task at beginning shifts entire timeline', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      const originalTasks = await helpers.getTimelineTasks();
      
      // Add custom task at the very beginning
      await helpers.addCustomTask('Test Asset', 'Initial Planning Meeting', '2', ''); // Empty string = beginning
      
      const updatedTasks = await helpers.getTimelineTasks();
      
      // All original tasks should now appear 2 days later
      const shiftedTasks = updatedTasks.slice(1); // Skip the new first task
      
      for (let i = 0; i < originalTasks.length; i++) {
        const originalTask = originalTasks[i];
        const shiftedTask = shiftedTasks[i];
        
        if (originalTask && shiftedTask) {
          const expectedStartDate = helpers.addWorkingDays(originalTask.startDate, 2);
          const expectedEndDate = helpers.addWorkingDays(originalTask.endDate, 2);
          
          expect(shiftedTask.startDate).toBe(expectedStartDate);
          expect(shiftedTask.endDate).toBe(expectedEndDate);
        }
      }
    });
  });

  test.describe('Custom task deletion contracts timeline', () => {
    test('Removing custom task pulls subsequent tasks backward', async ({ page }) => {
      // First add a custom task
      await helpers.setupBasicTimeline();
      await helpers.addCustomTask('Test Asset', 'Review Meeting', '4', 'Digital Assets sent to MMM');
      
      const withCustomTaskDuration = await helpers.getProjectDuration();
      const tasksWithCustom = await helpers.getTimelineTasks();
      
      // Find tasks after the custom task
      const customTaskIndex = tasksWithCustom.findIndex(t => t.name.includes('Review Meeting'));
      const tasksAfterCustom = tasksWithCustom.slice(customTaskIndex + 1);
      
      // Remove the custom task
      const customTaskElement = page.locator('[data-testid*="task-"]').filter({ hasText: 'Review Meeting' });
      const removeButton = customTaskElement.locator('[data-testid*="remove"], [data-testid*="delete"]').first();
      await removeButton.click();
      
      // Confirm deletion if dialog appears
      const confirmButton = page.locator('[data-testid="confirm-delete"], [data-testid="confirm-remove"]');
      if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmButton.click();
      }
      
      await page.waitForTimeout(1000);
      
      // Verify timeline contracted by exactly 4 days
      const newDuration = await helpers.getProjectDuration();
      expect(newDuration).toBe(withCustomTaskDuration - 4);
      
      // Verify tasks that were after custom task moved backward
      const contractedTasks = await helpers.getTimelineTasks();
      
      for (let i = 0; i < tasksAfterCustom.length; i++) {
        const originalTask = tasksAfterCustom[i];
        const contractedTask = contractedTasks.find(t => t.name === originalTask.name);
        
        if (originalTask && contractedTask) {
          const expectedStartDate = helpers.subtractWorkingDays(originalTask.startDate, 4);
          const expectedEndDate = helpers.subtractWorkingDays(originalTask.endDate, 4);
          
          expect(contractedTask.startDate).toBe(expectedStartDate);
          expect(contractedTask.endDate).toBe(expectedEndDate);
        }
      }
    });
  });

  test.describe('Complex accordion scenarios', () => {
    test('Multiple simultaneous duration changes apply cumulatively', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      const originalEndDate = await helpers.getProjectEndDate();
      
      // Make multiple changes that should combine
      await helpers.changeTaskDuration('Digital Assets sent to MMM', 3); // +2 days
      await helpers.changeTaskDuration('Amendment Approval Phase - 1st Mockup to Client', 5); // +2 days  
      await helpers.changeTaskDuration('All 3rd Party Tracking sent to MMM', 3); // +2 days
      
      // Total increase: +6 working days
      const newEndDate = await helpers.getProjectEndDate();
      const expectedEndDate = helpers.addWorkingDays(originalEndDate, 6);
      expect(newEndDate).toBe(expectedEndDate);
    });

    test('Mixed increase and decrease duration changes net correctly', async ({ page }) => {
      await helpers.setupBasicTimeline();
      
      const originalDuration = await helpers.getProjectDuration();
      
      // Mix of increases and decreases
      await helpers.changeTaskDuration('Amendment Approval Phase - 1st Mockup to Client', 5); // +2 days
      await helpers.changeTaskDuration('Amendment Approval Phase - 2nd Mockup to Client', 1); // -1 day
      await helpers.changeTaskDuration('Set Up, Browser Testing, Tagging Implementation', 1); // -2 days
      
      // Net change: +2 -1 -2 = -1 day
      const newDuration = await helpers.getProjectDuration();
      expect(newDuration).toBe(originalDuration - 1);
    });

    test('Accordion effect works correctly with multiple assets', async ({ page }) => {
      // Create timeline with multiple assets
      await helpers.setGlobalLiveDate('2024-06-01');
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Asset A');
      await helpers.addAsset('Digital Display - Agency Tags', 'Asset B');
      
      await page.waitForTimeout(1500);
      
      const originalTasks = await helpers.getTimelineTasks();
      
      // Modify task in first asset
      await helpers.changeTaskDuration('Digital Assets sent to MMM', 4); // +3 days
      
      // Verify all subsequent tasks (including those in Asset B) shifted
      const updatedTasks = await helpers.getTimelineTasks();
      
      // Find the first task of Asset B
      const assetBFirstTask = updatedTasks.find(t => t.name.includes('Tags sent to MMM'));
      const originalAssetBFirstTask = originalTasks.find(t => t.name.includes('Tags sent to MMM'));
      
      expect(assetBFirstTask).toBeDefined();
      expect(originalAssetBFirstTask).toBeDefined();
      
      if (assetBFirstTask && originalAssetBFirstTask) {
        const expectedStartDate = helpers.addWorkingDays(originalAssetBFirstTask.startDate, 3);
        expect(assetBFirstTask.startDate).toBe(expectedStartDate);
      }
    });

    test('Weekend boundary handling during accordion effect', async ({ page }) => {
      // Set up timeline that will cross weekend boundaries during shifts
      await helpers.setGlobalLiveDate('2024-06-07'); // Friday
      await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Weekend Test');
      
      await page.waitForTimeout(1000);
      
      // Increase a task duration to push tasks across weekend
      await helpers.changeTaskDuration('Amendment Approval Phase - 1st Mockup to Client', 8); // +5 days
      
      // Verify no tasks have weekend dates
      const updatedTasks = await helpers.getTimelineTasks();
      
      for (const task of updatedTasks) {
        const startDate = new Date(task.startDate);
        const endDate = new Date(task.endDate);
        
        // Neither start nor end should be Saturday (6) or Sunday (0)
        expect([0, 6]).not.toContain(startDate.getDay());
        expect([0, 6]).not.toContain(endDate.getDay());
      }
    });
  });
});