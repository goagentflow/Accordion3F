/**
 * Playwright Test Helpers
 * Reusable utilities for E2E tests
 */

import { Page, expect } from '@playwright/test';

export class TimelineHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for the app to be fully loaded
   */
  async waitForAppLoad() {
    await this.page.waitForSelector('[data-testid="timeline-builder"]', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Add an asset to the timeline using real DMGT asset types
   */
  async addAsset(assetType: string, assetName?: string) {
    // First, look for the asset in the list and click its Add button
    const addButtons = await this.page.locator('[data-testid="add-asset-button"]').all();
    let buttonFound = false;
    
    for (const button of addButtons) {
      // Get the parent container to find the asset type text
      const parentDiv = button.locator('..');
      const assetText = await parentDiv.textContent();
      
      if (assetText && assetText.includes(assetType)) {
        await button.click();
        buttonFound = true;
        break;
      }
    }
    
    if (!buttonFound) {
      // Take a screenshot for debugging
      await this.screenshot('asset-not-found');
      
      // List all available assets for debugging
      const allButtons = await this.page.locator('[data-testid="add-asset-button"]').all();
      const availableAssets = [];
      for (const btn of allButtons) {
        const parent = btn.locator('..');
        const text = await parent.textContent();
        if (text) availableAssets.push(text.trim());
      }
      
      throw new Error(`Could not find asset type: ${assetType}. Available assets: ${availableAssets.join(', ')}`);
    }
    
    // Wait for asset to be added
    await this.page.waitForTimeout(1000);
    
    // If we need to set a custom name, find the newly added asset and rename it
    if (assetName && assetName !== assetType) {
      // Find the latest asset instance (they should have unique IDs)
      const assetInstances = await this.page.locator('[data-testid*="asset-instance"]').all();
      if (assetInstances.length > 0) {
        const lastAsset = assetInstances[assetInstances.length - 1];
        
        // Look for a name input or edit button
        const nameInput = lastAsset.locator('input').first();
        if (await nameInput.isVisible()) {
          await nameInput.clear();
          await nameInput.fill(assetName);
          await nameInput.press('Tab');
          await this.page.waitForTimeout(500);
        }
      }
    }
  }

  /**
   * Remove an asset from the timeline
   */
  async removeAsset(assetName: string) {
    // Find asset by checking the name input value
    const assetElements = await this.page.locator('[data-testid^="asset-"]').all();
    let targetAsset = null;
    
    for (const asset of assetElements) {
      const nameInput = asset.locator('input[data-testid*="asset-name-input"]').first();
      const currentName = await nameInput.inputValue().catch(() => '');
      if (currentName === assetName) {
        targetAsset = asset;
        break;
      }
    }
    
    if (!targetAsset) {
      throw new Error(`Could not find asset with name: ${assetName}`);
    }
    
    const removeButton = targetAsset.locator('[data-testid*="remove-asset"]').first();
    await removeButton.click();
    
    // Check if there's a confirmation dialog
    const confirmButton = this.page.locator('[data-testid="confirm-remove"]');
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }
    
    // Wait for asset to be removed
    await expect(targetAsset).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Set the global live date
   */
  async setGlobalLiveDate(date: string) {
    await this.page.fill('[data-testid="global-live-date"]', date);
    await this.page.press('[data-testid="global-live-date"]', 'Tab');
    
    // Ensure the "Use same live date for all assets" checkbox is checked
    const checkbox = this.page.locator('[data-testid="use-global-date-checkbox"]');
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
    
    // Wait for date to be applied
    await this.page.waitForTimeout(500);
  }

  /**
   * Set an individual asset's live date
   */
  async setAssetLiveDate(assetName: string, date: string) {
    // First ensure individual dates are enabled
    const useIndividualDates = this.page.locator('[data-testid="use-individual-dates"]');
    if (await useIndividualDates.isVisible()) {
      await useIndividualDates.click();
    }
    
    // Find asset by checking the name input value
    const assetElements = await this.page.locator('[data-testid^="asset-"]').all();
    let targetAsset = null;
    
    for (const asset of assetElements) {
      const nameInput = asset.locator('input[data-testid*="asset-name-input"]').first();
      const currentName = await nameInput.inputValue().catch(() => '');
      if (currentName === assetName) {
        targetAsset = asset;
        break;
      }
    }
    
    if (!targetAsset) {
      throw new Error(`Could not find asset with name: ${assetName}`);
    }
    
    const dateInput = targetAsset.locator('[data-testid*="asset-live-date"]').first();
    await dateInput.fill(date);
    await dateInput.press('Tab');
  }

  /**
   * Edit a task's duration
   */
  async editTaskDuration(taskName: string, newDuration: string) {
    const taskRow = this.page.locator(`[data-testid="task-${taskName}"]`);
    await taskRow.locator('[data-testid="duration-input"]').fill(newDuration);
    await taskRow.locator('[data-testid="duration-input"]').press('Enter');
    
    // Wait for recalculation
    await this.page.waitForTimeout(500);
  }

  /**
   * Add a custom task
   */
  async addCustomTask(assetName: string, taskName: string, duration: string, insertAfter?: string) {
    await this.page.click(`[data-testid="asset-${assetName}"] [data-testid="add-custom-task"]`);
    await this.page.fill('[data-testid="custom-task-name"]', taskName);
    await this.page.fill('[data-testid="custom-task-duration"]', duration);
    
    if (insertAfter) {
      await this.page.selectOption('[data-testid="insert-after-select"]', insertAfter);
    }
    
    await this.page.click('[data-testid="confirm-add-task"]');
    
    // Wait for task to appear
    await expect(this.page.locator(`[data-testid="task-${taskName}"]`)).toBeVisible();
  }

  /**
   * Export timeline to Excel
   */
  async exportToExcel(): Promise<string> {
    // Set up download promise before clicking
    const downloadPromise = this.page.waitForEvent('download');
    
    await this.page.click('[data-testid="export-excel"]');
    
    const download = await downloadPromise;
    const path = await download.path();
    
    if (!path) throw new Error('Download failed');
    
    return path;
  }

  /**
   * Import timeline from Excel
   */
  async importFromExcel(filePath: string) {
    const fileInput = await this.page.locator('[data-testid="import-excel-input"]');
    await fileInput.setInputFiles(filePath);
    
    // Wait for import to complete
    await this.page.waitForSelector('[data-testid="import-success"]', { timeout: 5000 });
  }

  /**
   * Verify timeline dates
   */
  async verifyTimelineDates(taskName: string, expectedStart: string, expectedEnd: string) {
    const taskRow = this.page.locator(`[data-testid="task-${taskName}"]`);
    
    await expect(taskRow.locator('[data-testid="start-date"]')).toHaveText(expectedStart);
    await expect(taskRow.locator('[data-testid="end-date"]')).toHaveText(expectedEnd);
  }

  /**
   * Check for validation error
   */
  async checkValidationError(fieldId: string, expectedError: string) {
    const errorElement = this.page.locator(`[data-testid="${fieldId}-error"]`);
    await expect(errorElement).toBeVisible();
    await expect(errorElement).toContainText(expectedError);
  }

  /**
   * Check for toast notification
   */
  async checkToast(type: 'error' | 'warning' | 'success', message: string) {
    const toast = this.page.locator(`[data-testid="toast-${type}"]`);
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(message);
  }

  /**
   * Perform undo action
   */
  async undo() {
    await this.page.keyboard.press('Control+z', { delay: 50 });
    await this.page.waitForTimeout(300);
  }

  /**
   * Perform redo action
   */
  async redo() {
    await this.page.keyboard.press('Control+Shift+z', { delay: 50 });
    await this.page.waitForTimeout(300);
  }

  /**
   * Check auto-save indicator
   */
  async checkAutoSaveStatus(status: 'saving' | 'saved') {
    const indicator = this.page.locator('[data-testid="save-indicator"]');
    
    if (status === 'saving') {
      await expect(indicator).toContainText('Saving');
    } else {
      await expect(indicator).toContainText('Saved');
    }
  }

  /**
   * Simulate browser refresh
   */
  async refreshAndRecover() {
    await this.page.reload();
    await this.waitForAppLoad();
    
    // Check for recovery prompt
    const recoveryPrompt = this.page.locator('[data-testid="recovery-prompt"]');
    if (await recoveryPrompt.isVisible()) {
      await this.page.click('[data-testid="recover-yes"]');
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Clear all local storage
   */
  async clearStorage() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Take a named screenshot for debugging
   */
  async screenshot(name: string) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}.png`,
      fullPage: true 
    });
  }

  // === COMPREHENSIVE TESTING HELPERS ===

  /**
   * Get timeline tasks with full details
   */
  async getTimelineTasks() {
    const taskDetails = [];
    
    // Known task names from CSV - look for these specific texts
    const knownTaskNames = [
      'Digital Assets sent to MMM',
      'Amendment Approval Phase - 1st Mockup to Client',
      'Amendment Approval Phase - Client Feedback',
      'Amendment Approval Phase - 2nd Mockup to Client',
      'Amendment Approval Phase - Final Mockup to Client',
      'Amendment Approval Phase - Client Sign off All creative',
      'All 3rd Party Tracking sent to MMM',
      'Set Up, Browser Testing, Tagging Implementation, Link Testing',
      'Live Date',
      'Tags sent to MMM with tracking',
      'Hub Build',
      'wire frame'
    ];
    
    for (const taskName of knownTaskNames) {
      try {
        const elements = await this.page.locator(`text=${taskName}`).all();
        
        for (const element of elements) {
          // Try to find duration information near this task
          let duration = 1; // Default duration
          
          // Look for input[type="number"] or spinbutton near this element
          const parentContainer = element.locator('..');
          const durationInput = parentContainer.locator('input[type="number"]').or(
            parentContainer.locator('spinbutton')
          ).first();
          
          if (await durationInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            const durationValue = await durationInput.inputValue();
            duration = parseInt(durationValue) || 1;
          }
          
          taskDetails.push({
            name: taskName,
            duration: duration,
            startDate: '',
            endDate: '',
            owner: ''
          });
          
          break; // Only add each task name once
        }
      } catch (e) {
        // Skip if task not found
        continue;
      }
    }
    
    return taskDetails;
  }

  /**
   * Get a specific task by name
   */
  async getTask(taskName: string) {
    const tasks = await this.getTimelineTasks();
    const task = tasks.find(t => t.name.includes(taskName));
    if (!task) {
      throw new Error(`Task not found: ${taskName}`);
    }
    return task;
  }

  /**
   * Change a task's duration
   */
  async changeTaskDuration(taskName: string, newDuration: number) {
    const taskElement = this.page.locator(`[data-testid*="task-"]`).filter({ hasText: taskName });
    const durationInput = taskElement.locator('[data-testid*="duration"], input[type="number"]').first();
    
    await durationInput.clear();
    await durationInput.fill(newDuration.toString());
    await durationInput.press('Enter');
    
    // Wait for accordion effect to apply
    await this.page.waitForTimeout(1000);
  }

  /**
   * Add working days to a date (skipping weekends)
   */
  addWorkingDays(date: string | Date, days: number): string {
    let result = new Date(date);
    let addedDays = 0;
    
    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }
    
    return result.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  }

  /**
   * Subtract working days from a date
   */
  subtractWorkingDays(date: string | Date, days: number): string {
    let result = new Date(date);
    let subtractedDays = 0;
    
    while (subtractedDays < days) {
      result.setDate(result.getDate() - 1);
      // Skip weekends
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        subtractedDays++;
      }
    }
    
    return result.toISOString().split('T')[0];
  }

  /**
   * Get the calculated project start date
   */
  async getCalculatedStartDate(): Promise<string> {
    const tasks = await this.getTimelineTasks();
    if (tasks.length === 0) throw new Error('No tasks found');
    
    // First task's start date is the project start
    return tasks[0].startDate;
  }

  /**
   * Get the project end date (last task's end date)
   */
  async getProjectEndDate(): Promise<string> {
    const tasks = await this.getTimelineTasks();
    if (tasks.length === 0) throw new Error('No tasks found');
    
    // Last task's end date is the project end
    return tasks[tasks.length - 1].endDate;
  }

  /**
   * Get total project duration in working days
   */
  async getProjectDuration(): Promise<number> {
    const tasks = await this.getTimelineTasks();
    return tasks.reduce((total, task) => total + task.duration, 0);
  }

  /**
   * Verify no task conflicts (overlapping dates)
   */
  async verifyNoTaskConflicts(tasks?: any[]) {
    const timelineTasks = tasks || await this.getTimelineTasks();
    
    for (let i = 0; i < timelineTasks.length - 1; i++) {
      const currentTask = timelineTasks[i];
      const nextTask = timelineTasks[i + 1];
      
      const currentEnd = new Date(currentTask.endDate);
      const nextStart = new Date(nextTask.startDate);
      
      // Next task should start on or after current task ends
      if (nextStart < currentEnd) {
        throw new Error(`Task conflict: ${currentTask.name} overlaps with ${nextTask.name}`);
      }
    }
  }

  /**
   * Capture complete timeline state for comparison
   */
  async captureTimelineState() {
    const tasks = await this.getTimelineTasks();
    const assets = await this.page.locator('[data-testid^="asset-"]').allTextContents();
    const globalDate = await this.page.locator('[data-testid="global-live-date"]').inputValue().catch(() => '');
    
    return {
      tasks,
      assets,
      globalLiveDate: globalDate,
      timestamp: Date.now()
    };
  }

  /**
   * Setup a basic timeline for testing
   */
  async setupBasicTimeline() {
    await this.setGlobalLiveDate('2024-03-01');
    await this.addAsset('Digital Display - Creative (MMM creating)', 'Test Asset');
    await this.page.waitForTimeout(1000);
  }

  /**
   * Click undo button or use keyboard shortcut
   */
  async clickUndo() {
    const undoButton = this.page.locator('[data-testid="undo-button"]');
    if (await undoButton.isVisible()) {
      await undoButton.click();
    } else {
      await this.undo(); // Use keyboard shortcut
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Click redo button or use keyboard shortcut
   */
  async clickRedo() {
    const redoButton = this.page.locator('[data-testid="redo-button"]');
    if (await redoButton.isVisible()) {
      await redoButton.click();
    } else {
      await this.redo(); // Use keyboard shortcut
    }
    await this.page.waitForTimeout(500);
  }

  /**
   * Format date for display
   */
  formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
  }

  /**
   * Wait for timeline warning to appear
   */
  async waitForTimelineWarning(message: string) {
    const warning = this.page.locator('[data-testid*="warning"], [data-testid*="alert"]');
    await warning.waitFor({ state: 'visible', timeout: 5000 });
    await expect(warning).toContainText(message);
    return warning;
  }

  /**
   * Add multiple assets in sequence
   */
  async addMultipleAssets(assetTypes: string[]) {
    for (const assetType of assetTypes) {
      await this.addAsset(assetType);
      await this.page.waitForTimeout(500);
    }
  }
}