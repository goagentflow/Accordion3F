/**
 * Minimal test to debug timeline task generation
 */

import { test, expect } from '@playwright/test';

test.describe('Minimal Timeline Test', () => {
  test('Simple timeline creation test', async ({ page }) => {
    console.log('=== MINIMAL TIMELINE TEST ===');
    
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForSelector('[data-testid="timeline-container"]', { timeout: 10000 });
    
    // Set global date
    await page.fill('[data-testid="global-live-date"]', '2024-12-01');
    await page.press('[data-testid="global-live-date"]', 'Tab');
    
    // Ensure checkbox is checked
    const checkbox = page.locator('[data-testid="use-global-date-checkbox"]');
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
    
    console.log('Global date set and checkbox checked');
    
    // Add asset
    const addButton = page.locator('text=Digital Display - Creative (MMM creating)').locator('..').locator('button');
    await addButton.click();
    
    console.log('Asset added');
    
    // Wait for timeline to process
    await page.waitForTimeout(2000);
    
    // Check timeline status display
    const statusText = await page.locator('text=Timeline Status').locator('..').textContent();
    console.log('Timeline Status:', statusText);
    
    // Look for any console warnings about missing live dates
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('No live date')) {
        logs.push(msg.text());
      }
    });
    
    // Trigger a rerender
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Check if there are timeline tasks in the DOM
    const taskElements = await page.locator('text=Digital Assets sent to MMM').count();
    console.log('Task elements found:', taskElements);
    
    // Force test to show console output
    expect(taskElements).toBeGreaterThan(0);
  });
});