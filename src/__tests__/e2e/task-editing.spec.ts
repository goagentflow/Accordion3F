/**
 * Task Editing E2E Tests
 * Tests task duration changes, custom tasks, and timeline recalculation
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';

test.describe('Task Editing', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
    
    // Setup: Add an asset and set live date
    await helpers.addAsset('Banner', 'Test Banner');
    await helpers.setGlobalLiveDate('2024-12-25');
  });

  test('should edit task duration and recalculate timeline', async ({ page }) => {
    // Get initial dates for a task
    const designTask = page.locator('[data-testid="task-Design"]');
    const initialStartDate = await designTask.locator('[data-testid="start-date"]').textContent();
    
    // Edit duration
    await helpers.editTaskDuration('Design', '10');
    
    // Verify duration changed
    await expect(designTask.locator('[data-testid="duration-input"]')).toHaveValue('10');
    
    // Verify dates recalculated
    const newStartDate = await designTask.locator('[data-testid="start-date"]').textContent();
    expect(newStartDate).not.toBe(initialStartDate);
    
    // Verify timeline shifted appropriately
    await helpers.verifyTimelineDates('Go Live', '2024-12-25', '2024-12-25');
  });

  test('should validate duration input', async ({ page }) => {
    const designTask = page.locator('[data-testid="task-Design"]');
    
    // Try negative duration
    await designTask.locator('[data-testid="duration-input"]').fill('-5');
    await designTask.locator('[data-testid="duration-input"]').press('Enter');
    
    // Should show error
    await helpers.checkValidationError('task-Design-duration', 'Duration must be at least 1');
    
    // Duration should revert to valid value
    await expect(designTask.locator('[data-testid="duration-input"]')).toHaveValue('5');
    
    // Try excessive duration
    await designTask.locator('[data-testid="duration-input"]').fill('500');
    await designTask.locator('[data-testid="duration-input"]').press('Enter');
    
    // Should show error
    await helpers.checkValidationError('task-Design-duration', 'Duration cannot exceed 365 days');
  });

  test('should add custom task after specific task', async ({ page }) => {
    // Add custom task after Design
    await helpers.addCustomTask('Test Banner', 'Review', '2', 'Design');
    
    // Verify task appears in correct position
    const tasks = await page.locator('[data-testid^="task-"]').allTextContents();
    const designIndex = tasks.findIndex(t => t.includes('Design'));
    const reviewIndex = tasks.findIndex(t => t.includes('Review'));
    
    expect(reviewIndex).toBe(designIndex + 1);
    
    // Verify timeline recalculated
    await expect(page.locator('[data-testid="task-Review"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-Review"] [data-testid="duration-input"]')).toHaveValue('2');
  });

  test('should add custom task at end of timeline', async ({ page }) => {
    // Add custom task without specifying position
    await helpers.addCustomTask('Test Banner', 'Deployment', '1');
    
    // Verify task appears at end (before Go Live)
    const tasks = await page.locator('[data-testid^="task-"]').allTextContents();
    const deploymentIndex = tasks.findIndex(t => t.includes('Deployment'));
    const goLiveIndex = tasks.findIndex(t => t.includes('Go Live'));
    
    expect(deploymentIndex).toBe(goLiveIndex - 1);
  });

  test('should edit custom task name', async ({ page }) => {
    // Add custom task
    await helpers.addCustomTask('Test Banner', 'Initial Name', '3');
    
    // Edit the name
    const customTask = page.locator('[data-testid="task-Initial Name"]');
    await customTask.locator('[data-testid="edit-task-name"]').click();
    
    const nameInput = customTask.locator('[data-testid="task-name-input"]');
    await nameInput.clear();
    await nameInput.fill('Updated Name');
    await nameInput.press('Enter');
    
    // Verify name changed
    await expect(page.locator('[data-testid="task-Updated Name"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-Initial Name"]')).not.toBeVisible();
  });

  test('should remove custom task', async ({ page }) => {
    // Add custom task
    await helpers.addCustomTask('Test Banner', 'Removable Task', '2');
    
    // Verify task exists
    await expect(page.locator('[data-testid="task-Removable Task"]')).toBeVisible();
    
    // Remove the task
    await page.click('[data-testid="task-Removable Task"] [data-testid="remove-task"]');
    await page.click('[data-testid="confirm-remove"]');
    
    // Verify task removed
    await expect(page.locator('[data-testid="task-Removable Task"]')).not.toBeVisible();
    
    // Verify timeline recalculated
    const remainingTasks = await page.locator('[data-testid^="task-"]').count();
    expect(remainingTasks).toBe(3); // Back to original 3 tasks
  });

  test('should handle rapid duration changes', async ({ page }) => {
    const designTask = page.locator('[data-testid="task-Design"]');
    const durationInput = designTask.locator('[data-testid="duration-input"]');
    
    // Rapidly change duration multiple times
    await durationInput.fill('3');
    await durationInput.fill('7');
    await durationInput.fill('4');
    await durationInput.fill('6');
    await durationInput.press('Enter');
    
    // Final value should be applied
    await expect(durationInput).toHaveValue('6');
    
    // Timeline should be recalculated once
    await page.waitForTimeout(500);
    
    // Check that dates are consistent
    const startDate = await designTask.locator('[data-testid="start-date"]').textContent();
    const endDate = await designTask.locator('[data-testid="end-date"]').textContent();
    
    expect(startDate).toBeTruthy();
    expect(endDate).toBeTruthy();
  });

  test('should maintain task ownership colors', async ({ page }) => {
    // Check task ownership indicators
    const designTask = page.locator('[data-testid="task-Design"]');
    const developmentTask = page.locator('[data-testid="task-Development"]');
    const goLiveTask = page.locator('[data-testid="task-Go Live"]');
    
    // Verify different owners have different colors
    await expect(designTask.locator('[data-testid="owner-indicator"]')).toHaveClass(/owner-client/);
    await expect(developmentTask.locator('[data-testid="owner-indicator"]')).toHaveClass(/owner-mutuallyResponsible/);
    await expect(goLiveTask.locator('[data-testid="owner-indicator"]')).toHaveClass(/owner-agency/);
  });

  test('should show dependencies between tasks', async ({ page }) => {
    // Hover over a task to see dependencies
    const developmentTask = page.locator('[data-testid="task-Development"]');
    await developmentTask.hover();
    
    // Should show dependency line to previous task
    const dependencyLine = page.locator('[data-testid="dependency-line"]');
    await expect(dependencyLine).toBeVisible();
    
    // Click on task to highlight dependencies
    await developmentTask.click();
    
    // Previous and next tasks should be highlighted
    await expect(page.locator('[data-testid="task-Design"]')).toHaveClass(/dependency-highlight/);
    await expect(page.locator('[data-testid="task-Go Live"]')).toHaveClass(/dependency-highlight/);
  });

  test('should update Gantt chart when durations change', async ({ page }) => {
    // Get initial Gantt bar width
    const ganttBar = page.locator('[data-testid="task-Design"] [data-testid="gantt-bar"]');
    const initialWidth = await ganttBar.evaluate(el => el.getBoundingClientRect().width);
    
    // Change duration
    await helpers.editTaskDuration('Design', '10');
    
    // Get new width
    const newWidth = await ganttBar.evaluate(el => el.getBoundingClientRect().width);
    
    // Width should have increased (approximately doubled)
    expect(newWidth).toBeGreaterThan(initialWidth * 1.5);
  });

  test('should handle weekend exclusion in calculations', async ({ page }) => {
    // Set live date to Monday
    await helpers.setGlobalLiveDate('2024-12-23');
    
    // Add a 5-day task
    await helpers.addCustomTask('Test Banner', 'Week Task', '5');
    
    // Task should skip weekend
    const weekTask = page.locator('[data-testid="task-Week Task"]');
    const startDate = await weekTask.locator('[data-testid="start-date"]').textContent();
    const endDate = await weekTask.locator('[data-testid="end-date"]').textContent();
    
    // Parse dates and verify weekend is skipped
    const start = new Date(startDate!);
    const end = new Date(endDate!);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    // 5 working days should span 7 calendar days (includes weekend)
    expect(daysDiff).toBeGreaterThanOrEqual(6);
  });

  test('should enforce custom task limits', async ({ page }) => {
    // Add multiple custom tasks (simplified limit for testing)
    const maxCustomTasks = 5;
    
    for (let i = 1; i <= maxCustomTasks; i++) {
      await helpers.addCustomTask('Test Banner', `Custom ${i}`, '1');
    }
    
    // Try to add one more
    await page.click('[data-testid="asset-Test Banner"] [data-testid="add-custom-task"]');
    
    // Should show limit warning
    await helpers.checkToast('warning', 'Maximum custom tasks reached for this asset');
    
    // Add button should be disabled
    await expect(page.locator('[data-testid="add-custom-task"]')).toBeDisabled();
  });

  test('should maintain task data after undo/redo', async ({ page }) => {
    // Change a duration
    await helpers.editTaskDuration('Design', '8');
    
    // Verify change applied
    await expect(page.locator('[data-testid="task-Design"] [data-testid="duration-input"]')).toHaveValue('8');
    
    // Undo
    await helpers.undo();
    
    // Duration should revert
    await expect(page.locator('[data-testid="task-Design"] [data-testid="duration-input"]')).toHaveValue('5');
    
    // Redo
    await helpers.redo();
    
    // Duration should be back to 8
    await expect(page.locator('[data-testid="task-Design"] [data-testid="duration-input"]')).toHaveValue('8');
  });
});