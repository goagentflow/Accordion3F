/**
 * Excel Round-Trip E2E Tests
 * Tests exporting timeline to Excel and importing it back
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Excel Round-Trip', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
  });

  test('should export timeline to Excel with all data', async ({ page }) => {
    // Setup timeline
    await helpers.addAsset('Banner', 'Export Test Banner');
    await helpers.addAsset('Email', 'Export Test Email');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Add custom task
    await helpers.addCustomTask('Export Test Banner', 'Custom Review', '3');
    
    // Edit a duration
    await helpers.editTaskDuration('Design', '7');
    
    // Export to Excel
    const downloadPath = await helpers.exportToExcel();
    
    // Verify file exists
    expect(fs.existsSync(downloadPath)).toBe(true);
    
    // Verify file size is reasonable
    const stats = fs.statSync(downloadPath);
    expect(stats.size).toBeGreaterThan(5000); // At least 5KB
    expect(stats.size).toBeLessThan(10000000); // Less than 10MB
    
    // Clean up
    fs.unlinkSync(downloadPath);
  });

  test('should import Excel and restore complete state', async ({ page }) => {
    // Setup initial timeline
    await helpers.addAsset('Banner', 'Round Trip Banner');
    await helpers.addAsset('Video', 'Round Trip Video');
    await helpers.setGlobalLiveDate('2024-12-20');
    await helpers.addCustomTask('Round Trip Banner', 'QA Testing', '4');
    await helpers.editTaskDuration('Design', '8');
    
    // Export
    const exportPath = await helpers.exportToExcel();
    
    // Clear everything
    await page.reload();
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
    
    // Verify clean slate
    const assetCount = await page.locator('[data-testid^="asset-"]').count();
    expect(assetCount).toBe(0);
    
    // Import the file
    await helpers.importFromExcel(exportPath);
    
    // Verify all data restored
    await expect(page.locator('[data-testid="asset-Round Trip Banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="asset-Round Trip Video"]')).toBeVisible();
    
    // Verify custom task restored
    await expect(page.locator('[data-testid="task-QA Testing"]')).toBeVisible();
    
    // Verify edited duration restored
    await expect(page.locator('[data-testid="task-Design"] [data-testid="duration-input"]')).toHaveValue('8');
    
    // Verify date restored
    const dateInput = page.locator('[data-testid="global-live-date"]');
    await expect(dateInput).toHaveValue('2024-12-20');
    
    // Clean up
    fs.unlinkSync(exportPath);
  });

  test('should preserve individual asset dates in round-trip', async ({ page }) => {
    // Setup with individual dates
    await helpers.addAsset('Banner', 'Individual Date Banner');
    await helpers.addAsset('Email', 'Individual Date Email');
    
    await page.click('[data-testid="use-individual-dates"]');
    await helpers.setAssetLiveDate('Individual Date Banner', '2024-12-25');
    await helpers.setAssetLiveDate('Individual Date Email', '2024-12-20');
    
    // Export
    const exportPath = await helpers.exportToExcel();
    
    // Clear and reload
    await page.reload();
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
    
    // Import
    await helpers.importFromExcel(exportPath);
    
    // Verify individual dates mode
    const individualDatesCheckbox = page.locator('[data-testid="use-individual-dates"]');
    await expect(individualDatesCheckbox).toBeChecked();
    
    // Verify dates preserved
    await expect(page.locator('[data-testid="asset-Individual Date Banner"] [data-testid="asset-live-date"]'))
      .toHaveValue('2024-12-25');
    await expect(page.locator('[data-testid="asset-Individual Date Email"] [data-testid="asset-live-date"]'))
      .toHaveValue('2024-12-20');
    
    // Clean up
    fs.unlinkSync(exportPath);
  });

  test('should handle modified Excel file reimport', async ({ page }) => {
    // Create initial timeline
    await helpers.addAsset('Banner', 'Modify Test Banner');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Export
    const exportPath = await helpers.exportToExcel();
    
    // Modify timeline after export
    await helpers.addAsset('Email', 'Added After Export');
    await helpers.editTaskDuration('Design', '10');
    
    // Re-import the original file (should overwrite changes)
    await helpers.importFromExcel(exportPath);
    
    // Should show import warning
    await helpers.checkToast('warning', 'Current timeline will be replaced');
    
    // Confirm import
    await page.click('[data-testid="confirm-import"]');
    
    // Verify state reverted to exported version
    await expect(page.locator('[data-testid="asset-Modify Test Banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="asset-Added After Export"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="task-Design"] [data-testid="duration-input"]')).toHaveValue('5');
    
    // Clean up
    fs.unlinkSync(exportPath);
  });

  test('should validate imported Excel file', async ({ page }) => {
    // Try to import non-Excel file
    const invalidFile = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(invalidFile, 'This is not an Excel file');
    
    // Attempt import
    const fileInput = page.locator('[data-testid="import-excel-input"]');
    await fileInput.setInputFiles(invalidFile);
    
    // Should show error
    await helpers.checkToast('error', 'Invalid file format');
    
    // Clean up
    fs.unlinkSync(invalidFile);
  });

  test('should handle corrupted Excel import gracefully', async ({ page }) => {
    // Create a timeline and export
    await helpers.addAsset('Banner', 'Corruption Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    const validExport = await helpers.exportToExcel();
    
    // Create a corrupted file (truncate the valid one)
    const corruptedFile = path.join(__dirname, 'corrupted.xlsx');
    const content = fs.readFileSync(validExport);
    fs.writeFileSync(corruptedFile, content.slice(0, 100)); // Truncate file
    
    // Try to import corrupted file
    const fileInput = page.locator('[data-testid="import-excel-input"]');
    await fileInput.setInputFiles(corruptedFile);
    
    // Should show error
    await helpers.checkToast('error', 'Failed to read Excel file');
    
    // Original timeline should remain intact
    await expect(page.locator('[data-testid="asset-Corruption Test"]')).toBeVisible();
    
    // Clean up
    fs.unlinkSync(validExport);
    fs.unlinkSync(corruptedFile);
  });

  test('should export with metadata and timestamps', async ({ page }) => {
    // Setup timeline
    await helpers.addAsset('Banner', 'Metadata Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Add project name
    await page.fill('[data-testid="project-name"]', 'Q4 Campaign');
    
    // Export
    const exportPath = await helpers.exportToExcel();
    
    // Clear and import
    await page.reload();
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
    await helpers.importFromExcel(exportPath);
    
    // Verify project name restored
    await expect(page.locator('[data-testid="project-name"]')).toHaveValue('Q4 Campaign');
    
    // Verify export info displayed
    const exportInfo = page.locator('[data-testid="export-info"]');
    await expect(exportInfo).toContainText('Last exported:');
    await expect(exportInfo).toContainText('Version:');
    
    // Clean up
    fs.unlinkSync(exportPath);
  });

  test('should handle large timeline export/import', async ({ page }) => {
    // Create a larger timeline
    const assetCount = 10;
    
    for (let i = 1; i <= assetCount; i++) {
      await helpers.addAsset('Banner', `Asset ${i}`);
    }
    
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Add custom tasks to some assets
    await helpers.addCustomTask('Asset 1', 'Custom 1', '3');
    await helpers.addCustomTask('Asset 5', 'Custom 2', '4');
    await helpers.addCustomTask('Asset 10', 'Custom 3', '2');
    
    // Export
    const exportPath = await helpers.exportToExcel();
    
    // Verify file size is still reasonable
    const stats = fs.statSync(exportPath);
    expect(stats.size).toBeLessThan(1000000); // Less than 1MB even with many assets
    
    // Clear and import
    await page.reload();
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
    await helpers.importFromExcel(exportPath);
    
    // Verify all assets imported
    const importedAssets = await page.locator('[data-testid^="asset-"]').count();
    expect(importedAssets).toBe(assetCount);
    
    // Verify custom tasks imported
    await expect(page.locator('[data-testid="task-Custom 1"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-Custom 2"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-Custom 3"]')).toBeVisible();
    
    // Clean up
    fs.unlinkSync(exportPath);
  });

  test('should show progress during import of large file', async ({ page }) => {
    // Create timeline
    await helpers.addAsset('Banner', 'Progress Test');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Export
    const exportPath = await helpers.exportToExcel();
    
    // Clear
    await page.reload();
    await helpers.waitForAppLoad();
    
    // Start import and check for progress indicator
    const fileInput = page.locator('[data-testid="import-excel-input"]');
    const importPromise = fileInput.setInputFiles(exportPath);
    
    // Progress indicator should appear
    const progressBar = page.locator('[data-testid="import-progress"]');
    await expect(progressBar).toBeVisible({ timeout: 1000 });
    
    // Wait for import to complete
    await importPromise;
    await helpers.checkToast('success', 'Timeline imported successfully');
    
    // Progress should disappear
    await expect(progressBar).not.toBeVisible();
    
    // Clean up
    fs.unlinkSync(exportPath);
  });
});