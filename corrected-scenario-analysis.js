#!/usr/bin/env node

/**
 * CORRECTED Scenario Analysis
 * Now that I see the timeline IS working in some cases, fix detection logic
 */

const { chromium } = require('playwright');

async function analyzeCorrectly() {
  console.log('🔍 CORRECTED Analysis: Detecting Timeline Success vs Failure...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 200 
  });
  
  const context = await browser.newContext();
  
  const scenarios = [
    {
      name: 'Normal User Flow - Add Asset Then Date',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        
        // First add asset
        const addButtons = page.locator('button:has-text("Add")');
        await addButtons.first().click();
        await page.waitForTimeout(1000);
        
        // Then set date
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(3000); // Give more time for rendering
      }
    },
    
    {
      name: 'Date First Flow - Date Then Asset',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        
        // First set date
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(1000);
        
        // Then add asset
        const addButtons = page.locator('button:has-text("Add")');
        await addButtons.first().click();
        await page.waitForTimeout(3000);
      }
    },
    
    {
      name: 'Recovery Flow - Save and Refresh',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        
        // Create timeline
        const addButtons = page.locator('button:has-text("Add")');
        await addButtons.first().click();
        await page.waitForTimeout(1000);
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(2000);
        
        // Save and refresh
        await page.keyboard.press('Control+S');
        await page.waitForTimeout(1000);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        // Accept recovery
        const recoveryButton = page.locator('button:has-text("Recover")');
        if (await recoveryButton.count() > 0) {
          await recoveryButton.click();
          await page.waitForTimeout(3000);
        }
      }
    },
    
    {
      name: 'Quick Sequence - Fast Actions',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        
        // Rapid sequence
        const addButtons = page.locator('button:has-text("Add")');
        await addButtons.first().click();
        await page.waitForTimeout(300); // Shorter wait
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(2000);
      }
    },
    
    {
      name: 'Multiple Assets Flow',
      steps: async (page) => {
        await page.evaluate(() => localStorage.clear());
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        
        // Add multiple assets
        const addButtons = page.locator('button:has-text("Add")');
        const buttonCount = Math.min(3, await addButtons.count());
        
        for (let i = 0; i < buttonCount; i++) {
          await addButtons.nth(i).click();
          await page.waitForTimeout(500);
        }
        
        await page.locator('input[type="date"]').first().fill('2025-12-25');
        await page.waitForTimeout(3000);
      }
    }
  ];
  
  const results = [];
  
  for (const scenario of scenarios) {
    console.log(`\n🧪 Testing: ${scenario.name}`);
    
    const page = await context.newPage();
    
    // Track console messages about timeline calculation
    let calculationSuccess = false;
    let taskCount = 0;
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('timelineTasks calculated')) {
        const match = text.match(/(\d+) tasks/);
        if (match) {
          taskCount = parseInt(match[1]);
          calculationSuccess = taskCount > 0;
          console.log(`   📊 Backend: ${taskCount} tasks calculated`);
        }
      }
    });
    
    try {
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');
      
      await scenario.steps(page);
      
      // CORRECTED detection logic - look for actual timeline indicators
      const timelineCheck = await page.evaluate(() => {
        // Look for Timeline Compression Metrics section
        const compressionMetrics = document.body.textContent.includes('Timeline Compression Metrics');
        const tasksAnalyzed = document.body.textContent.match(/(\d+) tasks analyzed/);
        const projectGantt = document.body.textContent.includes('Project Gantt Chart');
        const taskTotal = document.body.textContent.match(/(\d+) tasks • (\d+) days total/);
        
        // Look for the actual timeline table/calendar
        const hasTimelineTable = document.querySelector('[class*="gantt"], [class*="timeline"], table') !== null;
        const hasDateHeaders = document.body.textContent.match(/(Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct) \d{4}/);
        
        // Look for placeholder text
        const showsPlaceholder = document.body.textContent.includes('Your timeline will appear here');
        
        // Asset count
        const assetsSelected = document.body.textContent.match(/(\d+) asset[s]? selected/);
        
        return {
          compressionMetrics,
          tasksAnalyzedUI: tasksAnalyzed ? parseInt(tasksAnalyzed[1]) : 0,
          projectGantt,
          taskTotalUI: taskTotal ? parseInt(taskTotal[1]) : 0,
          hasTimelineTable,
          hasDateHeaders: !!hasDateHeaders,
          showsPlaceholder,
          assetsSelected: assetsSelected ? parseInt(assetsSelected[1]) : 0
        };
      });
      
      // Determine if timeline is working
      const timelineWorking = (
        timelineCheck.compressionMetrics && 
        timelineCheck.tasksAnalyzedUI > 0 &&
        timelineCheck.projectGantt &&
        !timelineCheck.showsPlaceholder
      );
      
      const result = {
        scenario: scenario.name,
        backendCalculation: { success: calculationSuccess, taskCount },
        uiRendering: { success: timelineWorking, details: timelineCheck },
        overallSuccess: calculationSuccess && timelineWorking
      };
      
      results.push(result);
      
      const status = result.overallSuccess ? '✅ WORKS' : '❌ FAILS';
      const detail = result.overallSuccess ? 
        `Backend: ${taskCount} tasks, UI: ${timelineCheck.tasksAnalyzedUI} tasks shown` :
        `Backend: ${taskCount} tasks, UI: ${timelineWorking ? 'rendered' : 'FAILED'}`;
      
      console.log(`   ${status} - ${detail}`);
      
      // Take screenshot
      const filename = `corrected-${scenario.name.replace(/\s+/g, '-').toLowerCase()}`;
      await page.screenshot({ path: `concurrency-v1-failures/${filename}.png` });
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      results.push({
        scenario: scenario.name,
        backendCalculation: { success: false, taskCount: 0 },
        uiRendering: { success: false, error: error.message },
        overallSuccess: false
      });
    }
    
    await page.close();
  }
  
  // Analysis
  console.log('\n📊 CORRECTED ANALYSIS RESULTS:');
  console.log('=====================================');
  
  const working = results.filter(r => r.overallSuccess);
  const failing = results.filter(r => !r.overallSuccess);
  
  console.log(`✅ Working scenarios: ${working.length}/${results.length}`);
  working.forEach(r => {
    const ui = r.uiRendering.details;
    console.log(`   - ${r.scenario}: ${r.backendCalculation.taskCount} tasks → ${ui.tasksAnalyzedUI} UI tasks`);
  });
  
  console.log(`❌ Failing scenarios: ${failing.length}/${results.length}`);
  failing.forEach(r => {
    const backend = r.backendCalculation.success ? 'Backend ✅' : 'Backend ❌';
    const ui = r.uiRendering.success ? 'UI ✅' : 'UI ❌';
    console.log(`   - ${r.scenario}: ${backend}, ${ui}`);
  });
  
  if (working.length > 0 && failing.length > 0) {
    console.log('\n🎯 PATTERN IDENTIFIED:');
    console.log('This IS an intermittent bug! Some scenarios work, others fail.');
    console.log('Need to analyze the differences between working and failing cases.');
  }
  
  await browser.close();
  return results;
}

analyzeCorrectly().catch(console.error);