/**
 * Debug Asset StartDate Bug
 * Verify that assets get their startDate set properly when global date is set after asset creation
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';

test.describe('Debug Asset StartDate Bug', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
  });

  test('Verify asset startDate sync when global date set after asset creation', async ({ page }) => {
    console.log('=== TESTING ASSET START DATE SYNC ===');
    
    // Add asset FIRST (before setting global date)
    console.log('Adding asset without global live date set...');
    await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Test Asset');
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Check current state
    console.log('Checking timeline status after asset addition...');
    let timelineStatus = await page.locator('text=Timeline Status').locator('..').textContent();
    console.log(`Timeline Status: "${timelineStatus}"`);
    
    // NOW set the global live date (calculate realistic future date)
    const today = new Date();
    let futureDate = new Date(today);
    let workingDaysAdded = 0;
    
    while (workingDaysAdded < 30) {
      futureDate.setDate(futureDate.getDate() + 1);
      const dayOfWeek = futureDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDaysAdded++;
      }
    }
    
    const futureDateStr = futureDate.toISOString().split('T')[0];
    console.log(`Setting global live date AFTER asset creation: ${futureDateStr}`);
    
    await helpers.setGlobalLiveDate(futureDateStr);
    
    // Wait for useEffect to sync
    await page.waitForTimeout(2000);
    
    // Check timeline status again
    console.log('Checking timeline status after setting global date...');
    timelineStatus = await page.locator('text=Timeline Status').locator('..').textContent();
    console.log(`Timeline Status: "${timelineStatus}"`);
    
    // Check if tasks now have dates
    const helperTasks = await helpers.getTimelineTasks();
    console.log(`=== TASKS AFTER DATE SYNC ===`);
    console.log(`Helper found ${helperTasks.length} tasks:`);
    helperTasks.forEach((task, i) => {
      console.log(`${i}: "${task.name}" - ${task.duration} days - Start: "${task.startDate}" - End: "${task.endDate}"`);
    });
    
    // Check if we can see actual dates in the Gantt chart now
    const ganttHeaders = await page.locator('text=/\\d{1,2}\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/').all();
    console.log(`Found ${ganttHeaders.length} date headers in Gantt chart`);
    
    for (let i = 0; i < Math.min(10, ganttHeaders.length); i++) {
      const headerText = await ganttHeaders[i].textContent();
      console.log(`Date header ${i}: "${headerText}"`);
    }
    
    // Look for task bars or visual elements
    const taskBars = await page.locator('[style*="background"], [class*="task-bar"], [class*="gantt-bar"]').all();
    console.log(`Found ${taskBars.length} potential task bar elements`);
    
    // Check if there are any visible task durations
    const durationSpinners = await page.locator('input[type="number"]').all();
    console.log(`Found ${durationSpinners.length} duration inputs`);
    
    for (let i = 0; i < Math.min(5, durationSpinners.length); i++) {
      const value = await durationSpinners[i].inputValue();
      console.log(`Duration input ${i}: ${value}`);
    }
    
    // Take screenshot
    await helpers.screenshot('asset-startdate-sync');
    
    // Force failure to see debug output
    expect(helperTasks.some(task => task.startDate !== '')).toBe(true);
  });
});