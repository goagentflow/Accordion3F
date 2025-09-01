/**
 * Debug Timeline Logic Test
 * Actually inspect the timeline calculation to see what's happening
 */

import { test, expect } from '@playwright/test';
import { TimelineHelpers } from './helpers/test-helpers';

test.describe('Debug Timeline Logic', () => {
  let helpers: TimelineHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TimelineHelpers(page);
    await page.goto('/');
    await helpers.waitForAppLoad();
    await helpers.clearStorage();
  });

  test('Inspect actual timeline calculation behavior', async ({ page }) => {
    console.log('=== DEBUGGING TIMELINE CALCULATION ===');
    
    // Set a go-live date
    await helpers.setGlobalLiveDate('2024-03-01');
    console.log('Set global live date: 2024-03-01');
    
    // Add the asset
    await helpers.addAsset('Digital Display - Creative (MMM creating)', 'Debug Asset');
    console.log('Added asset');
    
    // Wait for timeline to be generated
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await helpers.screenshot('debug-timeline-generated');
    
    // Inspect the timeline structure in the DOM
    console.log('=== DOM INSPECTION ===');
    
    // Look for date displays in the Gantt chart
    const ganttDates = await page.locator('text=/\\d{1,2}\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/').all();
    console.log(`Found ${ganttDates.length} date columns`);
    
    for (let i = 0; i < Math.min(5, ganttDates.length); i++) {
      const dateText = await ganttDates[i].textContent();
      console.log(`Date column ${i}: "${dateText}"`);
    }
    
    // Look for task bars/cells in specific date columns
    const taskElements = await page.locator('[class*="task"], [class*="bar"]').all();
    console.log(`Found ${taskElements.length} task elements`);
    
    // Check if there are any visual task bars
    const ganttBars = await page.locator('[style*="background"], [class*="gantt"]').all();
    console.log(`Found ${ganttBars.length} gantt bar elements`);
    
    // Look for the specific task rows we know exist
    const knownTasks = [
      'Digital Assets sent to MMM',
      'Amendment Approval Phase - 1st Mockup to Client',
      'Set Up, Browser Testing, Tagging Implementation, Link Testing',
      'Live Date'
    ];
    
    console.log('=== TASK INSPECTION ===');
    for (const taskName of knownTasks) {
      const taskElements = await page.locator(`text=${taskName}`).all();
      console.log(`"${taskName}": found ${taskElements.length} elements`);
      
      if (taskElements.length > 0) {
        // Look for dates near this task
        const taskElement = taskElements[0];
        const parentRow = taskElement.locator('../..');
        
        // Look for any date-like patterns near this task
        const nearbyText = await parentRow.textContent();
        const dateMatches = nearbyText?.match(/\d{4}-\d{2}-\d{2}/g);
        if (dateMatches) {
          console.log(`  -> Dates found near task: ${dateMatches.join(', ')}`);
        }
        
        // Look for duration displays
        const durationElements = await parentRow.locator('input[type="number"], spinbutton').all();
        for (let i = 0; i < durationElements.length; i++) {
          const value = await durationElements[i].inputValue().catch(() => '');
          if (value) {
            console.log(`  -> Duration input ${i}: ${value}`);
          }
        }
      }
    }
    
    // Use our helper to get tasks and see what it finds
    const helperTasks = await helpers.getTimelineTasks();
    console.log(`=== HELPER RESULTS ===`);
    console.log(`Helper found ${helperTasks.length} tasks:`);
    helperTasks.forEach((task, i) => {
      console.log(`${i}: "${task.name}" - ${task.duration} days - Start: "${task.startDate}" - End: "${task.endDate}"`);
    });
    
    // Check the actual timeline status display
    const timelineStatus = await page.locator('text=Timeline Status').locator('..').textContent();
    console.log(`Timeline Status: "${timelineStatus}"`);
    
    // Check for any error messages
    const errors = await page.locator('[class*="error"], [class*="warning"], text=/error/i').all();
    console.log(`Found ${errors.length} error elements`);
    for (const error of errors) {
      const errorText = await error.textContent();
      console.log(`Error: "${errorText}"`);
    }
    
    // The test should fail so we can see all the debug output
    expect(true).toBe(false); // Force failure to see console output
  });
});