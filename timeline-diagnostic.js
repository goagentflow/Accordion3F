#!/usr/bin/env node

/**
 * Timeline Generation Diagnostic
 * Deep dive into why timeline generation is failing
 */

const { chromium } = require('playwright');

async function diagnoseTimeline() {
  console.log('🔬 Starting Timeline Diagnostic...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 200
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging from the page
  page.on('console', msg => console.log(`[BROWSER]: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[PAGE ERROR]: ${err.message}`));
  
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // Clear storage
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  
  console.log('🧹 Starting fresh...');
  
  try {
    // Step 1: Check initial state
    console.log('\n📋 STEP 1: Initial State Analysis');
    
    const initialState = await page.evaluate(() => {
      return {
        localStorage: localStorage.length,
        reduxState: window.__REDUX_DEVTOOLS_EXTENSION__ ? 'Available' : 'Not Available',
        hasSelectedAssets: document.querySelectorAll('[class*="selected"], [class*="asset"]').length,
        hasDateInput: document.querySelectorAll('input[type="date"]').length,
        hasTimelineContainer: document.querySelectorAll('[class*="timeline"], [class*="gantt"]').length
      };
    });
    
    console.log('Initial state:', initialState);
    
    // Step 2: Add asset step by step
    console.log('\n📋 STEP 2: Step-by-step Asset Addition');
    
    // Take screenshot before
    await page.screenshot({ path: 'concurrency-v1-failures/diagnostic-before-add.png' });
    
    const addButtons = page.locator('button:has-text("Add")');
    const addButtonCount = await addButtons.count();
    console.log(`Available Add buttons: ${addButtonCount}`);
    
    // Try to click the first Add button and monitor what happens
    console.log('Clicking Add button...');
    await addButtons.first().click();
    
    await page.waitForTimeout(1500);
    
    // Take screenshot after adding
    await page.screenshot({ path: 'concurrency-v1-failures/diagnostic-after-add.png' });
    
    // Check what changed
    const afterAddState = await page.evaluate(() => {
      const selectedAssets = Array.from(document.querySelectorAll('[class*="selected"], [class*="asset"]'))
        .map(el => ({ 
          class: el.className, 
          text: el.textContent.substring(0, 50),
          tagName: el.tagName 
        }));
      
      return {
        selectedAssetsFound: selectedAssets.length,
        selectedAssetsDetails: selectedAssets,
        bodyText: document.body.textContent.includes('Digital Display'),
        hasSelectedSection: document.body.textContent.includes('Selected Assets')
      };
    });
    
    console.log('After adding asset:', afterAddState);
    
    // Step 3: Set live date and monitor timeline generation
    console.log('\n📋 STEP 3: Timeline Generation Analysis');
    
    const dateInput = page.locator('input[type="date"]').first();
    const hasDateInput = await dateInput.count() > 0;
    console.log(`Date input found: ${hasDateInput}`);
    
    if (hasDateInput) {
      console.log('Setting live date to 2025-12-25...');
      await dateInput.fill('2025-12-25');
      
      // Wait and monitor for timeline elements
      console.log('Waiting for timeline generation...');
      
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(500);
        
        const timelineCheck = await page.evaluate(() => {
          const timelineElements = document.querySelectorAll('[class*="timeline"], [class*="gantt"], [class*="task"], .gantt-container');
          const taskBars = document.querySelectorAll('[class*="task-bar"], .task-row, .gantt-task-row');
          
          return {
            timelineElements: timelineElements.length,
            taskBars: taskBars.length,
            anyTimelineText: document.body.textContent.includes('timeline'),
            anyGanttText: document.body.textContent.includes('gantt'),
            generatedTimelineText: document.body.textContent.includes('Generated Timeline')
          };
        });
        
        console.log(`Timeline check ${i + 1}:`, timelineCheck);
        
        if (timelineCheck.timelineElements > 0 || timelineCheck.taskBars > 0) {
          console.log('✅ Timeline elements detected!');
          break;
        }
        
        if (i === 9) {
          console.log('❌ No timeline elements detected after 5 seconds');
        }
      }
    }
    
    // Step 4: Check for JavaScript errors and state
    console.log('\n📋 STEP 4: JavaScript State Analysis');
    
    const jsState = await page.evaluate(() => {
      // Check for common state management patterns
      const state = {};
      
      // Check if React is available
      state.hasReact = typeof window.React !== 'undefined';
      
      // Check for Redux or other state management
      state.hasRedux = typeof window.__REDUX_DEVTOOLS_EXTENSION__ !== 'undefined';
      
      // Check for any global timeline functions
      state.timelineFunctions = Object.keys(window).filter(key => 
        key.toLowerCase().includes('timeline') || 
        key.toLowerCase().includes('gantt') ||
        key.toLowerCase().includes('calculate')
      );
      
      // Check localStorage for timeline data
      const savedData = localStorage.getItem('accordion_timeline_state');
      state.savedData = savedData ? JSON.parse(savedData) : null;
      
      // Check for any error messages in the DOM
      const errorElements = Array.from(document.querySelectorAll('[class*="error"], [class*="warning"]'))
        .map(el => el.textContent);
      state.errorMessages = errorElements;
      
      return state;
    });
    
    console.log('JavaScript state:', jsState);
    
    // Step 5: Final diagnostic screenshot
    await page.screenshot({ path: 'concurrency-v1-failures/diagnostic-final-state.png' });
    
    // Step 6: Try force refresh and see what happens
    console.log('\n📋 STEP 5: Force Refresh Test');
    
    await page.keyboard.press('Control+S'); // Save first
    await page.waitForTimeout(1000);
    
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const afterRefreshCheck = await page.evaluate(() => {
      const hasRecoveryPrompt = document.body.textContent.includes('Recover');
      const hasAssetData = document.body.textContent.includes('Digital Display');
      
      return {
        hasRecoveryPrompt,
        hasAssetData,
        localStorageItems: localStorage.length
      };
    });
    
    console.log('After refresh state:', afterRefreshCheck);
    
    // Accept recovery if it appears
    const recoveryButton = page.locator('button:has-text("Recover")');
    if (await recoveryButton.count() > 0) {
      console.log('Accepting recovery...');
      await recoveryButton.click();
      await page.waitForTimeout(2000);
      
      const afterRecoveryCheck = await page.evaluate(() => {
        const timelineElements = document.querySelectorAll('[class*="timeline"], [class*="gantt"], [class*="task"]');
        return {
          timelineElementsAfterRecovery: timelineElements.length,
          hasAssetData: document.body.textContent.includes('Digital Display')
        };
      });
      
      console.log('After recovery state:', afterRecoveryCheck);
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    await page.screenshot({ path: 'concurrency-v1-failures/diagnostic-error.png' });
  }
  
  await page.waitForTimeout(3000); // Keep open for observation
  await browser.close();
  
  console.log('\n🔬 Diagnostic completed - check screenshots in concurrency-v1-failures/');
}

// Run diagnostic
diagnoseTimeline().catch(console.error);