/**
 * Debug with Feasible Timeline Test
 * Test with a realistic future date that allows proper timeline calculation
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';

test.describe('Debug Feasible Timeline', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
  });

  test('Test with realistic future go-live date', async ({ page }) => {
    console.log('=== TESTING WITH FEASIBLE TIMELINE ===');
    
    // Calculate a feasible future date (30 working days from now)
    const today = new Date();
    let futureDate = new Date(today);
    let workingDaysAdded = 0;
    
    while (workingDaysAdded < 30) {
      futureDate.setDate(futureDate.getDate() + 1);
      const dayOfWeek = futureDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
        workingDaysAdded++;
      }
    }
    
    const futureDateStr = futureDate.toISOString().split('T')[0];
    console.log(`Setting feasible go-live date: ${futureDateStr} (30 working days from today)`);
    
    // Set the feasible go-live date
    await helpers.setGlobalLiveDate(futureDateStr);
    
    // Add the asset
    await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Feasible Asset');
    console.log('Added asset');
    
    // Wait for timeline to be generated
    await page.waitForTimeout(2000);
    
    // Check timeline status
    const timelineStatus = await page.locator('text=Timeline Status').locator('..').textContent();
    console.log(`Timeline Status: "${timelineStatus}"`);
    
    // Should not show error now
    const hasError = timelineStatus?.includes('days need to be saved') || false;
    console.log(`Has timeline error: ${hasError}`);
    
    // Check for actual task dates now
    const knownTasks = [
      'Digital Assets sent to MMM',
      'Amendment Approval Phase - 1st Mockup to Client',
      'Set Up, Browser Testing, Tagging Implementation, Link Testing',
      'Live Date'
    ];
    
    console.log('=== TASK DATE INSPECTION ===');
    for (const taskName of knownTasks) {
      const taskElements = await page.locator(`text=${taskName}`).all();
      console.log(`"${taskName}": found ${taskElements.length} elements`);
      
      if (taskElements.length > 0) {
        const taskElement = taskElements[0];
        const parentRow = taskElement.locator('../..');
        
        // Look for any date-like patterns near this task
        const nearbyText = await parentRow.textContent();
        const dateMatches = nearbyText?.match(/\\d{4}-\\d{2}-\\d{2}/g) || [];
        console.log(`  -> Dates found: ${dateMatches.join(', ') || 'none'}`);
        
        // Look at the parent container more broadly
        const rowText = await parentRow.textContent();
        console.log(`  -> Full row text: "${rowText?.substring(0, 200)}..."`);
      }
    }
    
    // Check if there are visible date columns with actual dates
    const ganttDateCells = await page.locator('[class*="date"], [class*="day"], [class*="gantt"] >> text=/\\d{1,2}\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Dec)/').all();
    console.log(`Found ${ganttDateCells.length} gantt date cells`);
    
    for (let i = 0; i < Math.min(10, ganttDateCells.length); i++) {
      const cellText = await ganttDateCells[i].textContent();
      console.log(`Gantt date cell ${i}: "${cellText}"`);
    }
    
    // Use our helper to get tasks
    const helperTasks = await helpers.getTimelineTasks();
    console.log(`=== HELPER RESULTS WITH FEASIBLE DATE ===`);
    console.log(`Helper found ${helperTasks.length} tasks:`);
    helperTasks.forEach((task, i) => {
      console.log(`${i}: "${task.name}" - ${task.duration} days - Start: "${task.startDate}" - End: "${task.endDate}"`);
    });
    
    // Take screenshot for visual inspection
    await helpers.screenshot('feasible-timeline-debug');
    
    // The test should fail so we can see all the debug output
    expect(true).toBe(false); // Force failure to see console output
  });
});