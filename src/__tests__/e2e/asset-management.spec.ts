/**
 * Asset Management E2E Tests
 * Tests the complete workflow of adding, editing, and removing assets
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';

test.describe('Asset Management', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
  });

  test('should add a single asset and see it in the list', async ({ page }) => {
    // Add a banner asset
    await helpers.addAsset('Banner', 'Homepage Banner');
    
    // Verify asset appears in the asset list
    const assetItem = page.locator('[data-testid="asset-Homepage Banner"]');
    await expect(assetItem).toBeVisible();
    await expect(assetItem).toContainText('Homepage Banner');
    await expect(assetItem).toContainText('Banner');
  });

  test('should add multiple assets of different types', async ({ page }) => {
    // Add various asset types
    await helpers.addAsset('Banner', 'Main Banner');
    await helpers.addAsset('Email', 'Welcome Email');
    await helpers.addAsset('Video', 'Product Demo');
    await helpers.addAsset('Landing Page', 'Campaign Page');
    
    // Verify all assets are visible
    await expect(page.locator('[data-testid="asset-Main Banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="asset-Welcome Email"]')).toBeVisible();
    await expect(page.locator('[data-testid="asset-Product Demo"]')).toBeVisible();
    await expect(page.locator('[data-testid="asset-Campaign Page"]')).toBeVisible();
    
    // Verify asset count
    const assetCount = await page.locator('[data-testid^="asset-"]').count();
    expect(assetCount).toBe(4);
  });

  test('should edit asset name', async ({ page }) => {
    // Add an asset
    await helpers.addAsset('Banner', 'Original Name');
    
    // Edit the asset name
    const assetItem = page.locator('[data-testid="asset-Original Name"]');
    await assetItem.locator('[data-testid="edit-asset-name"]').click();
    
    const nameInput = assetItem.locator('[data-testid="asset-name-input"]');
    await nameInput.clear();
    await nameInput.fill('Updated Name');
    await nameInput.press('Enter');
    
    // Verify name change
    await expect(page.locator('[data-testid="asset-Updated Name"]')).toBeVisible();
    await expect(page.locator('[data-testid="asset-Original Name"]')).not.toBeVisible();
  });

  test('should remove an asset', async ({ page }) => {
    // Add multiple assets
    await helpers.addAsset('Banner', 'Banner 1');
    await helpers.addAsset('Email', 'Email 1');
    await helpers.addAsset('Video', 'Video 1');
    
    // Remove the middle asset
    await helpers.removeAsset('Email 1');
    
    // Verify asset is removed
    await expect(page.locator('[data-testid="asset-Email 1"]')).not.toBeVisible();
    
    // Verify other assets remain
    await expect(page.locator('[data-testid="asset-Banner 1"]')).toBeVisible();
    await expect(page.locator('[data-testid="asset-Video 1"]')).toBeVisible();
  });

  test('should set individual asset live dates', async ({ page }) => {
    // Add assets
    await helpers.addAsset('Banner', 'Banner A');
    await helpers.addAsset('Email', 'Email B');
    
    // Switch to individual dates
    await page.click('[data-testid="use-individual-dates"]');
    
    // Set different dates for each asset
    await helpers.setAssetLiveDate('Banner A', '2024-12-25');
    await helpers.setAssetLiveDate('Email B', '2024-12-20');
    
    // Verify dates are set
    const banner = page.locator('[data-testid="asset-Banner A"]');
    const email = page.locator('[data-testid="asset-Email B"]');
    
    await expect(banner.locator('[data-testid="asset-live-date"]')).toHaveValue('2024-12-25');
    await expect(email.locator('[data-testid="asset-live-date"]')).toHaveValue('2024-12-20');
  });

  test('should validate asset names', async ({ page }) => {
    // Try to add asset with empty name
    await page.click('[data-testid="add-asset-button"]');
    await page.selectOption('[data-testid="asset-type-select"]', 'Banner');
    await page.fill('[data-testid="asset-name-input"]', '');
    await page.click('[data-testid="confirm-add-asset"]');
    
    // Check for validation error
    await helpers.checkValidationError('asset-name-input', 'Asset name is required');
    
    // Asset should not be added
    const assetCount = await page.locator('[data-testid^="asset-"]').count();
    expect(assetCount).toBe(0);
  });

  test('should prevent XSS in asset names', async ({ page }) => {
    // Try to add asset with script tag
    await page.click('[data-testid="add-asset-button"]');
    await page.selectOption('[data-testid="asset-type-select"]', 'Banner');
    await page.fill('[data-testid="asset-name-input"]', '<script>alert("XSS")</script>Banner');
    await page.click('[data-testid="confirm-add-asset"]');
    
    // Asset should be added with sanitized name
    const assetItem = page.locator('[data-testid^="asset-"]').first();
    await expect(assetItem).toBeVisible();
    
    // Verify script tags are escaped
    const assetText = await assetItem.textContent();
    expect(assetText).not.toContain('<script>');
    expect(assetText).toContain('Banner');
  });

  test('should enforce asset limit', async ({ page }) => {
    // Add maximum allowed assets (simplified for test - normally 50)
    const maxAssets = 5; // Using smaller number for test speed
    
    for (let i = 1; i <= maxAssets; i++) {
      await helpers.addAsset('Banner', `Asset ${i}`);
    }
    
    // Try to add one more
    await page.click('[data-testid="add-asset-button"]');
    
    // Should see limit warning
    await helpers.checkToast('warning', 'Maximum number of assets reached');
    
    // Add button should be disabled
    await expect(page.locator('[data-testid="add-asset-button"]')).toBeDisabled();
  });

  test('should handle asset with tasks when removing', async ({ page }) => {
    // Add asset and set date to generate tasks
    await helpers.addAsset('Banner', 'Banner with Tasks');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Verify tasks are generated
    await expect(page.locator('[data-testid^="task-"]')).toHaveCount(3); // Assuming 3 default tasks
    
    // Try to remove asset
    await page.click('[data-testid="asset-Banner with Tasks"] [data-testid="remove-asset"]');
    
    // Should show confirmation with task warning
    const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
    await expect(confirmDialog).toContainText('This will also remove 3 tasks');
    
    // Confirm removal
    await page.click('[data-testid="confirm-remove"]');
    
    // Verify asset and tasks are removed
    await expect(page.locator('[data-testid="asset-Banner with Tasks"]')).not.toBeVisible();
    await expect(page.locator('[data-testid^="task-"]')).toHaveCount(0);
  });

  test('should maintain asset order when dragging', async ({ page }) => {
    // Add multiple assets
    await helpers.addAsset('Banner', 'First');
    await helpers.addAsset('Email', 'Second');
    await helpers.addAsset('Video', 'Third');
    
    // Get initial order
    const assetsBefore = await page.locator('[data-testid^="asset-"]').allTextContents();
    expect(assetsBefore[0]).toContain('First');
    expect(assetsBefore[1]).toContain('Second');
    expect(assetsBefore[2]).toContain('Third');
    
    // Drag first asset to last position
    const firstAsset = page.locator('[data-testid="asset-First"]');
    const thirdAsset = page.locator('[data-testid="asset-Third"]');
    
    await firstAsset.dragTo(thirdAsset);
    
    // Verify new order
    const assetsAfter = await page.locator('[data-testid^="asset-"]').allTextContents();
    expect(assetsAfter[0]).toContain('Second');
    expect(assetsAfter[1]).toContain('Third');
    expect(assetsAfter[2]).toContain('First');
  });

  test('should expand and collapse asset details', async ({ page }) => {
    // Add asset with tasks
    await helpers.addAsset('Banner', 'Expandable Asset');
    await helpers.setGlobalLiveDate('2024-12-25');
    
    // Initially tasks should be visible
    await expect(page.locator('[data-testid="asset-Expandable Asset"] [data-testid^="task-"]')).toHaveCount(3);
    
    // Collapse asset
    await page.click('[data-testid="asset-Expandable Asset"] [data-testid="toggle-expand"]');
    
    // Tasks should be hidden
    await expect(page.locator('[data-testid="asset-Expandable Asset"] [data-testid^="task-"]')).toHaveCount(0);
    
    // Expand again
    await page.click('[data-testid="asset-Expandable Asset"] [data-testid="toggle-expand"]');
    
    // Tasks should be visible again
    await expect(page.locator('[data-testid="asset-Expandable Asset"] [data-testid^="task-"]')).toHaveCount(3);
  });

  test('should persist assets after page refresh', async ({ page }) => {
    // Add assets
    await helpers.addAsset('Banner', 'Persistent Banner');
    await helpers.addAsset('Email', 'Persistent Email');
    
    // Refresh page
    await helpers.refreshAndRecover();
    
    // Verify assets are still there
    await expect(page.locator('[data-testid="asset-Persistent Banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="asset-Persistent Email"]')).toBeVisible();
  });
});