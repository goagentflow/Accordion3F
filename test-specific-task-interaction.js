#!/usr/bin/env node

/**
 * Test Specific Task Interaction
 * Direct test of the timeline manipulation bug using the discovered elements
 */

const { chromium } = require('playwright');

async function testTaskInteraction() {
  console.log('🎯 Testing direct task interaction for manipulation bugs');
  
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log(`[BROWSER]: ${msg.text()}`));
  
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // Set up timeline
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  
  console.log('🏗️ Setting up timeline...');
  const addButtons = page.locator('button:has-text("Add")');
  await addButtons.first().click();
  await page.waitForTimeout(800);
  await addButtons.nth(1).click(); // Add second asset for dependency testing
  await page.waitForTimeout(800);
  
  await page.locator('input[type="date"]').first().fill('2025-12-25');
  await page.waitForTimeout(3000);
  
  console.log('✅ Timeline created, looking for task elements...');
  
  // Find SVG and RECT elements specifically
  const svgTimeline = page.locator('svg').first();
  const rectElements = page.locator('rect');
  
  const svgExists = await svgTimeline.count() > 0;
  const rectCount = await rectElements.count();
  
  console.log(`📊 Found SVG timeline: ${svgExists}, RECT elements: ${rectCount}`);
  
  if (rectCount > 0) {
    console.log('\n🎯 TESTING THE CRITICAL BUG: Drag task and try to correct');
    
    try {
      // Test 1: Try to drag the first rect element (likely a task bar)
      const firstRect = rectElements.first();
      console.log('📋 Step 1: Initial drag of first task (2 days forward)');
      
      await firstRect.hover();
      await page.waitForTimeout(500);
      
      const rectBox = await firstRect.boundingBox();
      console.log(`Task bar position: ${JSON.stringify(rectBox)}`);
      
      if (rectBox) {
        // Simulate dragging 2 days forward (user mistake)
        await page.mouse.down();
        await page.waitForTimeout(200);
        await page.mouse.move(rectBox.x + 96, rectBox.y); // ~2 days worth of pixels
        await page.waitForTimeout(200);
        await page.mouse.up();
        await page.waitForTimeout(2000);
        
        console.log('✅ Step 1 completed: Dragged task forward 2 days');
        await page.screenshot({ path: 'concurrency-v1-failures/critical-bug-step1-drag-forward.png' });
        
        // Test 2: Try to correct by dragging back 1 day (THE CRITICAL BUG)
        console.log('📋 Step 2: CRITICAL - Try to correct by dragging back 1 day');
        
        await firstRect.hover();
        await page.waitForTimeout(200);
        
        const newRectBox = await firstRect.boundingBox();
        if (newRectBox) {
          await page.mouse.down();
          await page.waitForTimeout(200);
          await page.mouse.move(newRectBox.x - 48, newRectBox.y); // ~1 day back
          await page.waitForTimeout(200);
          await page.mouse.up();
          await page.waitForTimeout(2000);
          
          console.log('📋 Step 2 attempted: Correction drag completed');
          await page.screenshot({ path: 'concurrency-v1-failures/critical-bug-step2-correction.png' });
          
          // Test 3: Check if timeline still works
          console.log('📋 Step 3: Verify timeline is still functional');
          
          const timelineCheck = await page.evaluate(() => {
            const compressionMetrics = document.body.textContent.includes('Timeline Compression Metrics');
            const tasksAnalyzed = document.body.textContent.includes('tasks analyzed');
            const projectGantt = document.body.textContent.includes('Project Gantt Chart');
            const placeholder = document.body.textContent.includes('Your timeline will appear here');
            
            return {
              compressionMetrics,
              tasksAnalyzed,
              projectGantt,
              showsPlaceholder: placeholder,
              timestamp: new Date().toISOString()
            };
          });
          
          console.log('Timeline health check:', timelineCheck);
          
          if (timelineCheck.showsPlaceholder || !timelineCheck.compressionMetrics) {
            console.log('🎯 CRITICAL BUG REPRODUCED: Timeline disappeared after correction!');
            await page.screenshot({ path: 'concurrency-v1-failures/CRITICAL-BUG-REPRODUCED.png' });
          } else {
            console.log('✅ Timeline survived the correction attempt');
            await page.screenshot({ path: 'concurrency-v1-failures/correction-successful.png' });
          }
          
          // Test 4: Try multiple corrections (progressive degradation)
          console.log('📋 Step 4: Testing progressive degradation with multiple corrections');
          
          for (let i = 1; i <= 5; i++) {
            console.log(`  Correction attempt ${i}/5`);
            
            const currentBox = await firstRect.boundingBox();
            if (currentBox) {
              await firstRect.hover();
              await page.mouse.down();
              const moveX = (i % 2 === 0) ? 24 : -24; // Alternate corrections
              await page.mouse.move(currentBox.x + moveX, currentBox.y);
              await page.mouse.up();
              await page.waitForTimeout(1000);
              
              // Check health after each correction
              const health = await page.evaluate(() => ({
                timeline: document.body.textContent.includes('Timeline Compression Metrics'),
                placeholder: document.body.textContent.includes('Your timeline will appear here')
              }));
              
              if (health.placeholder || !health.timeline) {
                console.log(`💥 PROGRESSIVE BUG: Timeline broke after ${i} corrections`);
                await page.screenshot({ path: `concurrency-v1-failures/progressive-failure-${i}.png` });
                break;
              }
            }
          }
          
        }
      }
      
    } catch (error) {
      console.error(`❌ Task interaction test failed: ${error.message}`);
      await page.screenshot({ path: 'concurrency-v1-failures/interaction-test-error.png' });
    }
    
  } else {
    console.log('❌ No RECT elements found - cannot test task bar manipulation');
  }
  
  // Keep browser open for manual inspection
  await page.waitForTimeout(5000);
  await browser.close();
  
  console.log('\n🏁 Task interaction test completed');
}

testTaskInteraction().catch(console.error);