#!/usr/bin/env node

/**
 * Scenario Analysis: When does the timeline rendering bug occur vs work correctly?
 * Testing different user paths to identify the pattern
 */

const { chromium } = require('playwright');

async function analyzeScenarios() {
  console.log('🔍 Analyzing Timeline Bug Scenarios...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 
  });
  
  const context = await browser.newContext();
  
  const scenarios = [
    {
      name: 'Fresh Start - Click First Add Button',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        const addButtons = page.locator('button:has-text("Add")');
        await addButtons.first().click();
        await page.waitForTimeout(1000);
        
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(2000);
      }
    },
    
    {
      name: 'Fresh Start - Use Getting Started Workflow',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        // Click Getting Started button if it exists
        const gettingStarted = page.locator('button:has-text("Getting Started")');
        if (await gettingStarted.count() > 0) {
          await gettingStarted.click();
          await page.waitForTimeout(1000);
        }
        
        // Then try normal workflow
        const addButtons = page.locator('button:has-text("Add")');
        if (await addButtons.count() > 0) {
          await addButtons.first().click();
          await page.waitForTimeout(1000);
        }
        
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(2000);
      }
    },
    
    {
      name: 'With Existing Data - Recovery Path',
      steps: async (page) => {
        // First, create some data
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        const addButtons = page.locator('button:has-text("Add")');
        await addButtons.first().click();
        await page.waitForTimeout(500);
        
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.keyboard.press('Control+S');
        await page.waitForTimeout(1500);
        
        // Now refresh and test recovery
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        const recoveryButton = page.locator('button:has-text("Recover")');
        if (await recoveryButton.count() > 0) {
          await recoveryButton.click();
          await page.waitForTimeout(2000);
        }
      }
    },
    
    {
      name: 'CSV Import Path',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        // Try clicking Import button
        const importButton = page.locator('button:has-text("Import")');
        if (await importButton.count() > 0) {
          console.log('Import button found - but skipping file upload for now');
          // Skip actual file upload, just test the button
        }
        
        // Fall back to normal add asset
        const addButtons = page.locator('button:has-text("Add")');
        await addButtons.first().click();
        await page.waitForTimeout(1000);
        
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(2000);
      }
    },
    
    {
      name: 'Multiple Assets - Sequential Addition',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        // Add multiple assets one by one
        for (let i = 0; i < 3; i++) {
          const addButtons = page.locator('button:has-text("Add")');
          const buttonCount = await addButtons.count();
          if (buttonCount > i) {
            await addButtons.nth(i).click();
            await page.waitForTimeout(800);
          }
        }
        
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(2000);
      }
    },
    
    {
      name: 'Date First, Then Assets',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        // Set date FIRST
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(1000);
        
        // THEN add assets
        const addButtons = page.locator('button:has-text("Add")');
        await addButtons.first().click();
        await page.waitForTimeout(2000);
      }
    },
    
    {
      name: 'Global Date Toggle Different',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        // Toggle global date checkbox first
        const globalDateCheckbox = page.locator('input[type="checkbox"]').first();
        if (await globalDateCheckbox.count() > 0) {
          await globalDateCheckbox.click();
          await page.waitForTimeout(500);
        }
        
        const addButtons = page.locator('button:has-text("Add")');
        await addButtons.first().click();
        await page.waitForTimeout(1000);
        
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(2000);
      }
    },
    
    {
      name: 'Browser Back/Forward Navigation',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        
        const addButtons = page.locator('button:has-text("Add")');
        await addButtons.first().click();
        await page.waitForTimeout(1000);
        
        // Navigate away and back
        await page.goto('about:blank');
        await page.waitForTimeout(500);
        await page.goBack();
        await page.waitForTimeout(1500);
        
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(2000);
      }
    }
  ];
  
  const results = [];
  
  for (const scenario of scenarios) {
    console.log(`\n🧪 Testing Scenario: ${scenario.name}`);
    
    const page = await context.newPage();
    page.on('console', msg => {
      if (msg.text().includes('timelineTasks calculated') || msg.text().includes('ERROR')) {
        console.log(`[${scenario.name}] ${msg.text()}`);
      }
    });
    
    try {
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');
      
      await scenario.steps(page);
      
      // Check result
      const timelineCheck = await page.evaluate(() => {
        const timelineElements = document.querySelectorAll('[class*="timeline"], [class*="gantt"], [class*="task"], .gantt-container');
        const taskBars = document.querySelectorAll('[class*="task-bar"], .task-row, .gantt-task-row');
        const placeholderText = document.body.textContent.includes('Your timeline will appear here');
        const selectedAssetsCount = document.querySelectorAll('[class*="selected"], [class*="asset"]').length || 
                                   (document.body.textContent.match(/(\d+) asset[s]? selected/) || [0, 0])[1];
        
        return {
          hasTimelineElements: timelineElements.length > 0,
          hasTaskBars: taskBars.length > 0,
          showsPlaceholder: placeholderText,
          selectedAssets: selectedAssetsCount,
          bodyHasAssetNames: document.body.textContent.includes('Digital Display') || document.body.textContent.includes('Print')
        };
      });
      
      const result = {
        scenario: scenario.name,
        success: timelineCheck.hasTaskBars && !timelineCheck.showsPlaceholder,
        details: timelineCheck
      };
      
      results.push(result);
      
      const status = result.success ? '✅ WORKS' : '❌ FAILS';
      console.log(`${status}: ${JSON.stringify(result.details)}`);
      
      // Take screenshot for evidence
      const filename = `scenario-${scenario.name.replace(/\s+/g, '-').toLowerCase()}`;
      await page.screenshot({ path: `concurrency-v1-failures/${filename}.png` });
      
    } catch (error) {
      console.error(`❌ Scenario failed with error: ${error.message}`);
      results.push({
        scenario: scenario.name,
        success: false,
        error: error.message
      });
    }
    
    await page.close();
  }
  
  // Summary analysis
  console.log('\n📊 SCENARIO ANALYSIS SUMMARY:');
  console.log('=====================================');
  
  const workingScenarios = results.filter(r => r.success);
  const failingScenarios = results.filter(r => !r.success);
  
  console.log(`✅ Working scenarios: ${workingScenarios.length}/${results.length}`);
  workingScenarios.forEach(r => console.log(`   - ${r.scenario}`));
  
  console.log(`❌ Failing scenarios: ${failingScenarios.length}/${results.length}`);
  failingScenarios.forEach(r => console.log(`   - ${r.scenario}`));
  
  if (workingScenarios.length > 0 && failingScenarios.length > 0) {
    console.log('\n🔍 PATTERN ANALYSIS:');
    console.log('This confirms it\'s an INTERMITTENT bug, not a complete failure!');
    console.log('Need to identify what makes some scenarios work vs fail.');
  } else if (failingScenarios.length === results.length) {
    console.log('\n🔍 PATTERN ANALYSIS:');
    console.log('Bug appears to be SYSTEMATIC - affects all scenarios tested.');
  }
  
  await browser.close();
  
  return results;
}

// Run analysis
analyzeScenarios().catch(console.error);