/**
 * Auto-Save and Recovery E2E Tests
 * Tests automatic saving, session recovery, and unsaved changes warnings
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';

test.describe('Auto-Save and Recovery', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
  });

  test('should auto-save after meaningful actions', async ({ page }) => {
    // Add an asset (meaningful action)
    await helpers.addAsset('Banner', 'Auto-Save Test');
    
    // Check save indicator shows "Saving..."
    await helpers.checkAutoSaveStatus('saving');
    
    // Wait for save to complete
    await page.waitForTimeout(1000);
    
    // Check save indicator shows "Saved"
    await helpers.checkAutoSaveStatus('saved');
    
    // Verify data in localStorage
    const savedData = await page.evaluate(() => {
      return localStorage.getItem('timeline-state');
    });
    
    expect(savedData).toBeTruthy();
    expect(savedData).toContain('Auto-Save Test');
  });

  test('should debounce rapid changes before saving', async ({ page }) => {
    // Setup timeline
    await helpers.addAsset('Banner', 'Debounce Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Make rapid duration changes
    const durations = ['3', '5', '7', '9', '11'];
    for (const duration of durations) {
      await helpers.editTaskDuration('Design', duration);
      await page.waitForTimeout(100); // Small delay between changes
    }
    
    // Should show "Saving..." once after debounce period
    await helpers.checkAutoSaveStatus('saving');
    
    // Wait for save
    await page.waitForTimeout(1500);
    await helpers.checkAutoSaveStatus('saved');
    
    // Verify only final value was saved
    const savedData = await page.evaluate(() => {
      return localStorage.getItem('timeline-state');
    });
    
    expect(savedData).toContain('"duration":11');
    expect(savedData).not.toContain('"duration":3');
  });

  test('should recover state after browser refresh', async ({ page }) => {
    // Create complex state
    await helpers.addAsset('Banner', 'Recovery Banner');
    await helpers.addAsset('Email', 'Recovery Email');
    await helpers.setGlobalLiveDate('2024-12-20');
    await helpers.addCustomTask('Recovery Banner', 'Custom Task', '4');
    await helpers.editTaskDuration('Design', '8');
    
    // Wait for auto-save
    await page.waitForTimeout(1500);
    await helpers.checkAutoSaveStatus('saved');
    
    // Refresh browser
    await page.reload();
    await helpers.waitForAppLoad();
    
    // Should show recovery prompt
    const recoveryPrompt = page.locator('[data-testid="recovery-prompt"]');
    await expect(recoveryPrompt).toBeVisible();
    await expect(recoveryPrompt).toContainText('Recover your previous session?');
    
    // Accept recovery
    await page.click('[data-testid="recover-yes"]');
    
    // Verify all state recovered
    await expect(page.locator('[data-testid="asset-Recovery Banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="asset-Recovery Email"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-Custom Task"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-Design"] [data-testid="duration-input"]')).toHaveValue('8');
    await expect(page.locator('[data-testid="global-live-date"]')).toHaveValue('2024-12-20');
  });

  test('should handle recovery rejection', async ({ page }) => {
    // Create state
    await helpers.addAsset('Banner', 'Reject Recovery Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Wait for save
    await page.waitForTimeout(1500);
    
    // Refresh
    await page.reload();
    await helpers.waitForAppLoad();
    
    // Reject recovery
    const recoveryPrompt = page.locator('[data-testid="recovery-prompt"]');
    await expect(recoveryPrompt).toBeVisible();
    await page.click('[data-testid="recover-no"]');
    
    // Should start with clean slate
    const assetCount = await page.locator('[data-testid^="asset-"]').count();
    expect(assetCount).toBe(0);
    
    // localStorage should be cleared
    const savedData = await page.evaluate(() => {
      return localStorage.getItem('timeline-state');
    });
    expect(savedData).toBeNull();
  });

  test('should warn about unsaved changes when leaving', async ({ page, context }) => {
    // Setup dialog handler
    let dialogShown = false;
    page.on('dialog', async dialog => {
      dialogShown = true;
      expect(dialog.message()).toContain('unsaved changes');
      await dialog.dismiss();
    });
    
    // Make changes
    await helpers.addAsset('Banner', 'Unsaved Test');
    
    // Try to navigate away immediately (before auto-save)
    await page.evaluate(() => {
      window.location.href = 'https://example.com';
    });
    
    // Dialog should have been shown
    expect(dialogShown).toBe(true);
    
    // Should still be on the page
    await expect(page.locator('[data-testid="asset-Unsaved Test"]')).toBeVisible();
  });

  test('should not warn when all changes are saved', async ({ page }) => {
    // Setup dialog handler
    let dialogShown = false;
    page.on('dialog', async dialog => {
      dialogShown = true;
      await dialog.dismiss();
    });
    
    // Make changes
    await helpers.addAsset('Banner', 'Saved Test');
    
    // Wait for auto-save
    await page.waitForTimeout(1500);
    await helpers.checkAutoSaveStatus('saved');
    
    // Try to navigate away
    await page.evaluate(() => {
      window.location.href = 'https://example.com';
    });
    
    // No dialog should be shown
    await page.waitForTimeout(500);
    expect(dialogShown).toBe(false);
  });

  test('should save and recover undo/redo history', async ({ page }) => {
    // Make several changes
    await helpers.addAsset('Banner', 'History Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    await helpers.editTaskDuration('Design', '7');
    
    // Undo one action
    await helpers.undo();
    
    // Duration should revert
    await expect(page.locator('[data-testid="task-Design"] [data-testid="duration-input"]')).toHaveValue('5');
    
    // Wait for auto-save
    await page.waitForTimeout(1500);
    
    // Refresh and recover
    await helpers.refreshAndRecover();
    
    // Undo history should be preserved
    await helpers.undo(); // Should undo the date setting
    const dateInput = page.locator('[data-testid="global-live-date"]');
    await expect(dateInput).toHaveValue('');
    
    // Redo should also work
    await helpers.redo();
    await expect(dateInput).toHaveValue('2024-12-25');
    
    await helpers.redo();
    await expect(page.locator('[data-testid="task-Design"] [data-testid="duration-input"]')).toHaveValue('7');
  });

  test('should handle localStorage quota exceeded', async ({ page }) => {
    // Fill localStorage to near capacity
    await page.evaluate(() => {
      const largeData = 'x'.repeat(4 * 1024 * 1024); // 4MB of data
      try {
        localStorage.setItem('large-data', largeData);
      } catch (e) {
        // Might already be full
      }
    });
    
    // Try to make changes
    await helpers.addAsset('Banner', 'Quota Test');
    
    // Should show storage warning
    await helpers.checkToast('warning', 'Storage space is running low');
    
    // Should offer to clear old data
    const clearButton = page.locator('[data-testid="clear-storage"]');
    await expect(clearButton).toBeVisible();
    
    // Clear storage
    await clearButton.click();
    
    // Should be able to save now
    await helpers.checkAutoSaveStatus('saved');
    
    // Clean up
    await page.evaluate(() => {
      localStorage.removeItem('large-data');
    });
  });

  test('should handle concurrent auto-save and user actions', async ({ page }) => {
    // Create initial state
    await helpers.addAsset('Banner', 'Concurrent Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Start a save-triggering action
    await helpers.editTaskDuration('Design', '10');
    
    // Immediately make another change while saving
    await helpers.addCustomTask('Concurrent Test', 'Rush Task', '2');
    
    // Both changes should be saved
    await page.waitForTimeout(2000);
    await helpers.checkAutoSaveStatus('saved');
    
    // Refresh and verify both changes persisted
    await helpers.refreshAndRecover();
    
    await expect(page.locator('[data-testid="task-Design"] [data-testid="duration-input"]')).toHaveValue('10');
    await expect(page.locator('[data-testid="task-Rush Task"]')).toBeVisible();
  });

  test('should maintain save state indicator accuracy', async ({ page }) => {
    // Add asset
    await helpers.addAsset('Banner', 'Indicator Test');
    
    // Should show "Saving..."
    await helpers.checkAutoSaveStatus('saving');
    
    // Wait for save
    await page.waitForTimeout(1500);
    
    // Should show "Saved"
    await helpers.checkAutoSaveStatus('saved');
    
    // Make another change
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Should show "Saving..." again
    await helpers.checkAutoSaveStatus('saving');
    
    // Wait and verify "Saved"
    await page.waitForTimeout(1500);
    await helpers.checkAutoSaveStatus('saved');
    
    // Indicator should show last saved time
    const saveIndicator = page.locator('[data-testid="save-indicator"]');
    await expect(saveIndicator).toContainText('Last saved');
  });

  test('should handle recovery with invalid stored data', async ({ page }) => {
    // Store invalid data
    await page.evaluate(() => {
      localStorage.setItem('timeline-state', 'invalid-json-{not-valid}');
    });
    
    // Reload page
    await page.reload();
    await helpers.waitForAppLoad();
    
    // Should show error about corrupted data
    await helpers.checkToast('error', 'Failed to recover previous session');
    
    // Should start with clean slate
    const assetCount = await page.locator('[data-testid^="asset-"]').count();
    expect(assetCount).toBe(0);
    
    // Should clear bad data
    const savedData = await page.evaluate(() => {
      return localStorage.getItem('timeline-state');
    });
    expect(savedData).toBeNull();
  });

  test('should save project metadata with auto-save', async ({ page }) => {
    // Set project details
    await page.fill('[data-testid="project-name"]', 'Q4 Campaign 2024');
    await page.fill('[data-testid="pm-name"]', 'John Smith');
    
    // Add timeline data
    await helpers.addAsset('Banner', 'Campaign Banner');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Wait for save
    await page.waitForTimeout(1500);
    
    // Verify metadata saved
    const savedData = await page.evaluate(() => {
      return localStorage.getItem('timeline-state');
    });
    
    expect(savedData).toContain('Q4 Campaign 2024');
    expect(savedData).toContain('John Smith');
    
    // Refresh and verify metadata recovered
    await helpers.refreshAndRecover();
    
    await expect(page.locator('[data-testid="project-name"]')).toHaveValue('Q4 Campaign 2024');
    await expect(page.locator('[data-testid="pm-name"]')).toHaveValue('John Smith');
  });
});