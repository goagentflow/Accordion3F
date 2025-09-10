#!/usr/bin/env node

/**
 * Quick Concurrency Bug Hunter
 * Runs targeted tests to identify the specific intermittent bugs
 */

const { chromium } = require('playwright');

async function huntConcurrencyBugs() {
  console.log('🔍 Starting Concurrency Bug Hunt...');
  
  const browser = await chromium.launch({ 
    headless: false, // Show browser for visual debugging
    slowMo: 100 // Slow down for observation
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to app
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // Clear any existing data
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  
  console.log('🧹 Clean state established');
  
  try {
    // TEST 1: Basic asset addition and timeline generation
    console.log('\n📋 TEST 1: Basic Asset Addition');
    
    // Add first asset by clicking the first Add button we can find
    const addButtons = page.locator('button:has-text("Add")');
    const addButtonCount = await addButtons.count();
    console.log(`Found ${addButtonCount} Add buttons`);
    
    if (addButtonCount > 0) {
      console.log('Clicking first Add button...');
      await addButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Check if asset was added - try multiple selectors
      const selectedAssets = page.locator('.Selected-Assets, [data-testid="selected-assets"], .asset-item, .selected-asset');
      let selectedCount = await selectedAssets.count();
      console.log(`Assets after addition (first check): ${selectedCount}`);
      
      // Also check the "Selected Assets" section content
      const selectedSection = page.locator('text="Selected Assets"').first();
      const hasSectionContent = await selectedSection.count() > 0;
      console.log(`Has "Selected Assets" section: ${hasSectionContent}`);
      
      if (selectedCount === 0) {
        console.log('No assets found with standard selectors, checking DOM...');
        // Check what's actually in the selected assets area
        const assetsList = await page.locator('.Selected-Assets, [class*="selected"], [class*="asset"]').allTextContents();
        console.log('Assets list content:', assetsList);
        
        // Try alternative approach - look for any asset that might have been added
        const allText = await page.textContent('body');
        const hasDigitalDisplay = allText.includes('Digital Display');
        console.log(`Page contains "Digital Display": ${hasDigitalDisplay}`);
        
        if (hasDigitalDisplay) {
          selectedCount = 1; // Override if we can see the asset exists
          console.log('Asset appears to exist based on text content');
        }
      }
      console.log(`Final asset count: ${selectedCount}`);
      
      // Set a live date
      const dateInput = page.locator('input[type="date"]').first();
      await dateInput.fill('2025-12-25');
      await page.waitForTimeout(2000);
      
      // Check if timeline appears
      const timeline = page.locator('.gantt-container, [data-testid="gantt-chart"], .timeline');
      const timelineExists = await timeline.count() > 0;
      console.log(`Timeline generated: ${timelineExists}`);
      
      if (timelineExists) {
        const tasks = page.locator('.gantt-task-row, [data-testid="task-row"], .task-bar');
        const taskCount = await tasks.count();
        console.log(`Tasks visible: ${taskCount}`);
        
        if (taskCount > 0) {
          console.log('✅ Basic functionality working');
          
          // TEST 2: Save and refresh cycle
          console.log('\n📋 TEST 2: Save/Refresh Persistence');
          
          await page.keyboard.press('Control+S');
          await page.waitForTimeout(1000);
          
          const stateBefore = {
            assets: selectedCount,
            tasks: taskCount
          };
          
          await page.reload({ waitUntil: 'networkidle' });
          await page.waitForTimeout(2000);
          
          // Check for recovery prompt
          const recoveryPrompt = page.locator('text="Recover", button:has-text("Recover")');
          const hasRecovery = await recoveryPrompt.count() > 0;
          console.log(`Recovery prompt appeared: ${hasRecovery}`);
          
          if (hasRecovery) {
            await recoveryPrompt.first().click();
            await page.waitForTimeout(2000);
          }
          
          // Check state after refresh
          const assetsAfter = await page.locator('.asset-item, .selected-asset').count();
          const tasksAfter = await page.locator('.gantt-task-row, .task-bar').count();
          
          console.log(`State before refresh: ${JSON.stringify(stateBefore)}`);
          console.log(`State after refresh: {assets: ${assetsAfter}, tasks: ${tasksAfter}}`);
          
          if (assetsAfter === 0 && stateBefore.assets > 0) {
            console.error('❌ CRITICAL BUG FOUND: Assets disappeared after refresh!');
          }
          
          if (tasksAfter === 0 && stateBefore.tasks > 0) {
            console.error('❌ CRITICAL BUG FOUND: Timeline cleared after refresh!');
          }
          
          // TEST 3: Rapid operations to trigger race conditions
          console.log('\n📋 TEST 3: Race Condition Testing');
          
          for (let i = 0; i < 10; i++) {
            // Change date rapidly
            await dateInput.fill(`2025-12-${15 + (i % 10)}`);
            await page.keyboard.press('Control+S');
            await page.waitForTimeout(100); // Very short delay to create race conditions
            
            // Check if timeline still exists
            const stillHasTasks = await page.locator('.gantt-task-row, .task-bar').count() > 0;
            if (!stillHasTasks) {
              console.error(`❌ CRITICAL BUG: Timeline disappeared at iteration ${i}!`);
              await page.screenshot({ path: `concurrency-v1-failures/timeline-disappeared-${i}.png` });
              break;
            }
          }
          
          console.log('✅ Race condition testing completed');
          
        } else {
          console.error('❌ BUG: No tasks generated despite timeline container existing');
        }
      } else {
        console.error('❌ BUG: No timeline generated after setting live date');
      }
    } else {
      console.error('❌ BUG: No Add buttons found');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    await page.screenshot({ path: 'concurrency-v1-failures/error-screenshot.png' });
  }
  
  await page.waitForTimeout(2000); // Keep browser open for observation
  await browser.close();
  
  console.log('\n🔍 Bug hunt completed');
}

// Run if this script is executed directly
if (require.main === module) {
  huntConcurrencyBugs().catch(console.error);
}

module.exports = { huntConcurrencyBugs };