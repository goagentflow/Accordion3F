/**
 * Edge Case E2E Tests
 * Tests unusual scenarios, rapid interactions, and browser quirks
 * Includes senior dev feedback: invalid Excel imports and asset rename edge cases
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

test.describe('Edge Cases and Stress Tests', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
  });

  // ============================================
  // Senior Dev Suggested Tests
  // ============================================

  test('should handle manually edited Excel with invalid durations', async ({ page }) => {
    // Create and export timeline
    await helpers.addAsset('Banner', 'Invalid Duration Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    const exportPath = await helpers.exportToExcel();
    
    // Manually edit the Excel file to add invalid durations
    const workbook = XLSX.readFile(exportPath);
    
    // Find the _DATA sheet and corrupt some duration values
    if (workbook.Sheets['_DATA']) {
      const dataSheet = workbook.Sheets['_DATA'];
      const jsonData = XLSX.utils.sheet_to_json(dataSheet)[0] as any;
      
      // Inject invalid duration values
      if (jsonData.state) {
        const state = JSON.parse(jsonData.state);
        if (state.tasks && state.tasks.timeline && state.tasks.timeline[0]) {
          state.tasks.timeline[0].duration = 'abc'; // Invalid string
          state.tasks.timeline[1].duration = -5; // Negative number
          state.tasks.timeline[2].duration = 1000; // Exceeds max
        }
        jsonData.state = JSON.stringify(state);
      }
      
      // Write back to sheet
      const newSheet = XLSX.utils.json_to_sheet([jsonData]);
      workbook.Sheets['_DATA'] = newSheet;
    }
    
    // Save modified Excel file
    const modifiedPath = path.join(__dirname, 'modified-invalid.xlsx');
    XLSX.writeFile(workbook, modifiedPath);
    
    // Try to import the corrupted file
    await helpers.importFromExcel(modifiedPath);
    
    // Should show validation errors
    await helpers.checkToast('error', 'Invalid duration values found');
    
    // Should offer to fix or reject
    const fixButton = page.locator('[data-testid="fix-invalid-durations"]');
    await expect(fixButton).toBeVisible();
    
    // Click fix - should apply defaults
    await fixButton.click();
    
    // Verify durations were corrected to valid defaults
    await expect(page.locator('[data-testid="task-Design"] [data-testid="duration-input"]')).toHaveValue('5');
    
    // Clean up
    fs.unlinkSync(exportPath);
    fs.unlinkSync(modifiedPath);
  });

  test('should handle asset rename with immediate custom task addition', async ({ page }) => {
    // Add an asset
    await helpers.addAsset('Banner', 'Original Asset Name');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Rename the asset
    const assetItem = page.locator('[data-testid="asset-Original Asset Name"]');
    await assetItem.locator('[data-testid="edit-asset-name"]').click();
    
    const nameInput = assetItem.locator('[data-testid="asset-name-input"]');
    await nameInput.clear();
    await nameInput.fill('Renamed Asset');
    await nameInput.press('Enter');
    
    // Immediately try to add a custom task (while rename might still be processing)
    await page.click('[data-testid="asset-Renamed Asset"] [data-testid="add-custom-task"]');
    
    // The form should show the new asset name
    const assetNameInForm = page.locator('[data-testid="custom-task-form"] [data-testid="asset-name-display"]');
    await expect(assetNameInForm).toContainText('Renamed Asset');
    
    // Complete adding the custom task
    await page.fill('[data-testid="custom-task-name"]', 'Post-Rename Task');
    await page.fill('[data-testid="custom-task-duration"]', '3');
    await page.click('[data-testid="confirm-add-task"]');
    
    // Verify task is associated with renamed asset
    const customTask = page.locator('[data-testid="task-Post-Rename Task"]');
    await expect(customTask).toBeVisible();
    
    // Verify task appears under the renamed asset
    const renamedAssetTasks = page.locator('[data-testid="asset-Renamed Asset"] [data-testid^="task-"]');
    const taskTexts = await renamedAssetTasks.allTextContents();
    expect(taskTexts.some(text => text.includes('Post-Rename Task'))).toBe(true);
  });

  // ============================================
  // Rapid Interaction Tests
  // ============================================

  test('should handle rapid asset addition and deletion', async ({ page }) => {
    // Rapidly add and remove assets
    for (let i = 0; i < 5; i++) {
      await helpers.addAsset('Banner', `Rapid Asset ${i}`);
    }
    
    // Immediately start deleting while UI might still be updating
    for (let i = 0; i < 3; i++) {
      const assetToRemove = page.locator(`[data-testid="asset-Rapid Asset ${i}"]`);
      if (await assetToRemove.isVisible()) {
        await assetToRemove.locator('[data-testid="remove-asset"]').click();
        await page.click('[data-testid="confirm-remove"]');
      }
    }
    
    // Verify final state is consistent
    await page.waitForTimeout(1000);
    
    const remainingAssets = await page.locator('[data-testid^="asset-Rapid Asset"]').count();
    expect(remainingAssets).toBe(2); // Should have assets 3 and 4 remaining
    
    // Verify no duplicate assets
    const assetTexts = await page.locator('[data-testid^="asset-"]').allTextContents();
    const uniqueTexts = new Set(assetTexts);
    expect(uniqueTexts.size).toBe(assetTexts.length);
  });

  test('should handle double-click on action buttons', async ({ page }) => {
    // Add an asset
    await helpers.addAsset('Banner', 'Double Click Test');
    
    // Double-click the add asset button rapidly
    await page.dblclick('[data-testid="add-asset-button"]');
    
    // Should only show one dialog/form
    const dialogs = await page.locator('[data-testid="add-asset-dialog"]').count();
    expect(dialogs).toBeLessThanOrEqual(1);
    
    // Cancel if dialog is open
    if (dialogs === 1) {
      await page.click('[data-testid="cancel-add-asset"]');
    }
    
    // Verify still only one asset
    const assetCount = await page.locator('[data-testid^="asset-"]').count();
    expect(assetCount).toBe(1);
  });

  test('should handle form submission with Enter key in middle of form', async ({ page }) => {
    // Start adding an asset
    await page.click('[data-testid="add-asset-button"]');
    
    // Fill only the type, not the name
    await page.selectOption('[data-testid="asset-type-select"]', 'Banner');
    
    // Press Enter while in the middle of the form
    await page.keyboard.press('Enter');
    
    // Should show validation error, not submit
    await helpers.checkValidationError('asset-name-input', 'Asset name is required');
    
    // Form should still be open
    await expect(page.locator('[data-testid="add-asset-dialog"]')).toBeVisible();
  });

  // ============================================
  // Browser-Specific Quirks
  // ============================================

  test('should handle Safari date input format', async ({ page, browserName }) => {
    if (browserName !== 'webkit') {
      test.skip();
    }
    
    // Safari handles date inputs differently
    await helpers.addAsset('Banner', 'Safari Date Test');
    
    // Try various date formats
    const dateInput = page.locator('[data-testid="global-live-date"]');
    
    // Safari might require different format
    await dateInput.fill('12/25/2024');
    await dateInput.press('Tab');
    
    // Should either accept or show format error
    const errorVisible = await page.locator('[data-testid="date-format-error"]').isVisible();
    if (errorVisible) {
      // Try ISO format
      await dateInput.fill('2024-12-25');
      await dateInput.press('Tab');
    }
    
    // Date should be set
    await expect(dateInput).toHaveValue(/2024-12-25|12\/25\/2024/);
  });

  test('should handle Firefox clipboard operations', async ({ page, browserName }) => {
    if (browserName !== 'firefox') {
      test.skip();
    }
    
    // Firefox has different clipboard permissions
    await helpers.addAsset('Banner', 'Firefox Clipboard Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Try to copy timeline data
    await page.click('[data-testid="copy-timeline"]');
    
    // Should either succeed or show permission request
    const permissionDialog = page.locator('[data-testid="clipboard-permission"]');
    if (await permissionDialog.isVisible()) {
      await expect(permissionDialog).toContainText('clipboard access');
    } else {
      await helpers.checkToast('success', 'Timeline copied');
    }
  });

  // ============================================
  // Memory and Performance Tests
  // ============================================

  test('should handle maximum assets without crashing', async ({ page }) => {
    // Add maximum allowed assets (using smaller number for test speed)
    const maxAssets = 10; // Normally 50, reduced for test
    
    for (let i = 0; i < maxAssets; i++) {
      await helpers.addAsset('Banner', `Asset ${i}`);
      
      // Check memory usage periodically
      if (i % 5 === 0) {
        const metrics = await page.evaluate(() => {
          if ('memory' in performance) {
            return (performance as any).memory.usedJSHeapSize;
          }
          return 0;
        });
        
        // Memory should not grow excessively (less than 100MB)
        expect(metrics).toBeLessThan(100 * 1024 * 1024);
      }
    }
    
    // App should still be responsive
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Should calculate timeline for all assets
    const tasks = await page.locator('[data-testid^="task-"]').count();
    expect(tasks).toBeGreaterThan(maxAssets * 2); // At least 2 tasks per asset
  });

  test('should handle undo/redo at maximum history limit', async ({ page }) => {
    // Add asset
    await helpers.addAsset('Banner', 'History Limit Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Make many changes to fill history
    for (let i = 1; i <= 10; i++) {
      await helpers.editTaskDuration('Design', i.toString());
    }
    
    // Try to undo beyond limit (should stop at oldest state)
    for (let i = 0; i < 15; i++) {
      await helpers.undo();
    }
    
    // Should be at initial state (no date set)
    await expect(page.locator('[data-testid="global-live-date"]')).toHaveValue('');
    
    // Further undo should do nothing
    await helpers.undo();
    await expect(page.locator('[data-testid="global-live-date"]')).toHaveValue('');
  });

  // ============================================
  // Network and Timing Issues
  // ============================================

  test('should handle slow network when fetching bank holidays', async ({ page }) => {
    // Simulate slow network
    await page.route('**/api/bank-holidays', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ holidays: ['2024-12-25', '2024-12-26'] })
      });
    });
    
    // Add asset and set date
    await helpers.addAsset('Banner', 'Slow Network Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Should show loading indicator
    const loadingIndicator = page.locator('[data-testid="holidays-loading"]');
    await expect(loadingIndicator).toBeVisible();
    
    // Should eventually load and calculate
    await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });
    
    // Timeline should account for holidays
    const goLiveTask = page.locator('[data-testid="task-Go Live"]');
    await expect(goLiveTask).toBeVisible();
  });

  test('should handle bank holiday API failure gracefully', async ({ page }) => {
    // Simulate API failure
    await page.route('**/api/bank-holidays', route => {
      route.fulfill({
        status: 500,
        body: 'Internal Server Error'
      });
    });
    
    // Add asset and set date
    await helpers.addAsset('Banner', 'API Failure Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Should show warning but continue
    await helpers.checkToast('warning', 'Could not load bank holidays');
    
    // Timeline should still calculate (without holidays)
    const tasks = await page.locator('[data-testid^="task-"]').count();
    expect(tasks).toBeGreaterThan(0);
  });

  // ============================================
  // Data Validation Extremes
  // ============================================

  test('should handle extremely long asset names', async ({ page }) => {
    const longName = 'A'.repeat(100);
    
    await page.click('[data-testid="add-asset-button"]');
    await page.selectOption('[data-testid="asset-type-select"]', 'Banner');
    await page.fill('[data-testid="asset-name-input"]', longName);
    await page.click('[data-testid="confirm-add-asset"]');
    
    // Should truncate or handle gracefully
    const assetItem = page.locator('[data-testid^="asset-"]').first();
    await expect(assetItem).toBeVisible();
    
    const displayedName = await assetItem.textContent();
    expect(displayedName?.length).toBeLessThanOrEqual(105); // Some reasonable limit
  });

  test('should handle special characters in all text fields', async ({ page }) => {
    const specialChars = '!@#$%^&*()_+-=[]{}|;\':",.<>?/`~';
    
    // Add asset with special characters
    await page.click('[data-testid="add-asset-button"]');
    await page.selectOption('[data-testid="asset-type-select"]', 'Banner');
    await page.fill('[data-testid="asset-name-input"]', `Test ${specialChars} Asset`);
    await page.click('[data-testid="confirm-add-asset"]');
    
    // Should sanitize but preserve safe characters
    const assetItem = page.locator('[data-testid^="asset-"]').first();
    const assetText = await assetItem.textContent();
    
    // Should not contain script tags or dangerous HTML
    expect(assetText).not.toContain('<script>');
    expect(assetText).not.toContain('<img');
    
    // But should preserve some special characters
    expect(assetText).toContain('Test');
    expect(assetText).toContain('Asset');
  });

  // ============================================
  // Concurrent Operations
  // ============================================

  test('should handle export while timeline is recalculating', async ({ page }) => {
    // Setup complex timeline
    await helpers.addAsset('Banner', 'Concurrent Export Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Start changing duration (triggers recalculation)
    const durationInput = page.locator('[data-testid="task-Design"] [data-testid="duration-input"]');
    await durationInput.fill('20');
    
    // Immediately try to export while recalculation might be in progress
    const exportPromise = helpers.exportToExcel();
    
    // Complete the duration change
    await durationInput.press('Enter');
    
    // Export should complete successfully
    const exportPath = await exportPromise;
    expect(fs.existsSync(exportPath)).toBe(true);
    
    // Verify exported data has the new duration
    const workbook = XLSX.readFile(exportPath);
    const dataSheet = workbook.Sheets['_DATA'];
    if (dataSheet) {
      const jsonData = XLSX.utils.sheet_to_json(dataSheet)[0] as any;
      const state = JSON.parse(jsonData.state);
      const designTask = state.tasks.timeline.find((t: any) => t.name === 'Design');
      expect(designTask?.duration).toBe(20);
    }
    
    // Clean up
    fs.unlinkSync(exportPath);
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Make some changes
    await helpers.addAsset('Banner', 'Navigation Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Try browser back button
    await page.goBack();
    
    // Should show unsaved changes warning
    const dialog = await page.waitForEvent('dialog');
    expect(dialog.message()).toContain('unsaved changes');
    await dialog.dismiss();
    
    // Should still be on the page with data intact
    await expect(page.locator('[data-testid="asset-Navigation Test"]')).toBeVisible();
  });
});