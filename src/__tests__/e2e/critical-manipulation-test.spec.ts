/**
 * Critical Manipulation Test - Direct Bug Reproduction
 * Simplified test to directly reproduce the manipulation bugs you described
 */

import { test, expect } from '@playwright/test';
import { ManipulationTestHelper } from './helpers/manipulation-helpers';

test.describe('Critical Timeline Manipulation Bug Reproduction', () => {
  let helper: ManipulationTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new ManipulationTestHelper(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('🧹 Starting critical manipulation bug test');
  });

  test('CRITICAL BUG: Single Task Repeated Manipulation Until Failure', async ({ page }) => {
    console.log('🔥 TESTING: Drag task multiple times until timeline breaks');
    
    // Set up timeline with one asset to get at least one draggable task
    await helper.setupBasicTimeline(1);
    
    // Find task bars
    const taskBars = await helper.findTaskBars();
    console.log(`Found ${taskBars.length} task bars for manipulation`);
    
    if (taskBars.length === 0) {
      throw new Error('No task bars found - cannot test manipulation bugs');
    }
    
    const targetTask = taskBars[0];
    console.log(`Testing with task: ${targetTask.taskId} at position (${targetTask.initialPosition.x}, ${targetTask.initialPosition.y})`);
    
    // Take initial screenshot
    await helper.takeManipulationScreenshot('critical-test-initial');
    
    console.log('📋 Step 1: Initial drag forward (simulating user mistake - too far)');
    let result = await helper.dragTaskBar(targetTask, 100, 0, { // Drag 100px forward
      speed: 'normal',
      waitAfter: 1000,
      validateMove: false // Don't fail on movement validation
    });
    
    if (!result.success) {
      console.log('💥 CRITICAL BUG REPRODUCED: Failed at initial drag!');
      await helper.takeManipulationScreenshot('critical-bug-step1-failed');
      
      console.log('Bug analysis:', {
        step: 'Initial drag forward',
        timeline: result.timelineStillVisible,
        assets: result.assetsStillVisible,
        tasks: result.tasksStillVisible,
        errors: result.errorMessages
      });
      return; // Bug found at step 1
    }
    
    console.log('✅ Step 1 success: Task dragged forward');
    await helper.takeManipulationScreenshot('critical-test-step1-success');
    
    console.log('📋 Step 2: Try to correct by dragging back (THE CRITICAL MOMENT)');
    result = await helper.dragTaskBar(targetTask, -50, 0, { // Drag back to correct
      speed: 'normal', 
      waitAfter: 1500,
      validateMove: false
    });
    
    if (!result.success) {
      console.log('🎯 CRITICAL BUG REPRODUCED: Correction drag failed!');
      await helper.takeManipulationScreenshot('CRITICAL-BUG-CORRECTION-FAILED');
      
      console.log('Critical bug analysis:', {
        step: 'Correction drag back',
        timeline: result.timelineStillVisible,
        assets: result.assetsStillVisible, 
        tasks: result.tasksStillVisible,
        errors: result.errorMessages,
        timestamp: new Date().toISOString()
      });
      return; // Bug reproduced!
    }
    
    console.log('✅ Step 2 success: Correction worked');
    await helper.takeManipulationScreenshot('critical-test-step2-success');
    
    console.log('📋 Step 3: Progressive manipulation stress test');
    const manipulationPattern = [
      { move: 60, desc: 'Forward again' },
      { move: -40, desc: 'Back correction' },
      { move: 30, desc: 'Small forward' },
      { move: -20, desc: 'Small back' },
      { move: 80, desc: 'Large forward' },
      { move: -70, desc: 'Large back correction' },
      { move: 25, desc: 'Medium forward' },
      { move: -35, desc: 'Medium back correction' },
      { move: 45, desc: 'Another forward' },
      { move: -50, desc: 'Another back correction' }
    ];
    
    for (let i = 0; i < manipulationPattern.length; i++) {
      const manipulation = manipulationPattern[i];
      console.log(`  ${i + 3}: ${manipulation.desc} (${manipulation.move > 0 ? '+' : ''}${manipulation.move}px)`);
      
      result = await helper.dragTaskBar(targetTask, manipulation.move, 0, {
        speed: 'fast',
        waitAfter: 300,
        validateMove: false
      });
      
      if (!result.success) {
        console.log(`💥 PROGRESSIVE BUG REPRODUCED: Failed at manipulation ${i + 3}`);
        console.log(`Breaking manipulation: "${manipulation.desc}"`);
        await helper.takeManipulationScreenshot(`progressive-bug-step-${i + 3}`);
        
        console.log('Progressive bug analysis:', {
          manipulationStep: i + 3,
          manipulationDesc: manipulation.desc,
          moveAmount: manipulation.move,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible,
          errors: result.errorMessages
        });
        return; // Progressive bug found
      }
    }
    
    console.log('✅ All progressive manipulations succeeded');
    await helper.takeManipulationScreenshot('critical-test-all-manipulations-success');
    
    console.log('📋 Step 4: Rapid manipulation stress (speed demon pattern)');
    for (let i = 1; i <= 20; i++) {
      const rapidMove = (i % 2 === 0) ? 30 : -30; // Alternate back and forth
      console.log(`  Rapid ${i}/20: ${rapidMove > 0 ? '+' : ''}${rapidMove}px`);
      
      result = await helper.dragTaskBar(targetTask, rapidMove, 0, {
        speed: 'fast',
        waitAfter: 50, // Very fast
        validateMove: false
      });
      
      if (!result.success) {
        console.log(`💥 RAPID MANIPULATION BUG: Failed at rapid operation ${i}`);
        await helper.takeManipulationScreenshot(`rapid-manipulation-bug-${i}`);
        
        console.log('Rapid manipulation bug analysis:', {
          rapidStep: i,
          moveAmount: rapidMove,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible,
          totalOperations: helper.getFailureSummary().operationCount
        });
        return; // Rapid manipulation bug found
      }
    }
    
    console.log('🏆 TIMELINE SURVIVED ALL MANIPULATIONS!');
    console.log('No manipulation bugs reproduced in this session.');
    
    const summary = helper.getFailureSummary();
    console.log(`Final summary: ${summary.operationCount} operations completed, ${summary.failures.length} failures`);
    
    await helper.takeManipulationScreenshot('critical-test-complete-success');
  });

  test('CRITICAL BUG: Memory and State Monitoring During Manipulation', async ({ page }) => {
    console.log('🧠 TESTING: Memory and state integrity during manipulation');
    
    await helper.setupBasicTimeline(1);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) {
      console.log('⚠️ No task bars found, skipping memory test');
      return;
    }
    
    const targetTask = taskBars[0];
    const memoryBefore = await helper.getMemoryUsage();
    
    console.log(`Initial memory: ${memoryBefore?.usedJSHeapSize || 'N/A'} bytes`);
    
    let operationCount = 0;
    const maxOperations = 50;
    
    for (let i = 1; i <= maxOperations; i++) {
      operationCount = i;
      
      // Alternate manipulation pattern
      const moveAmount = (i % 4 === 0) ? 80 : (i % 3 === 0) ? -60 : (i % 2 === 0) ? 40 : -30;
      
      if (i % 10 === 0) {
        console.log(`Memory test operation ${i}/${maxOperations}: ${moveAmount}px`);
      }
      
      const result = await helper.dragTaskBar(targetTask, moveAmount, 0, {
        speed: 'fast',
        waitAfter: 100,
        validateMove: false
      });
      
      if (!result.success) {
        console.log(`💥 MEMORY/STATE BUG: Failed at operation ${i}`);
        
        const memoryAtFailure = await helper.getMemoryUsage();
        await helper.takeManipulationScreenshot(`memory-state-bug-${i}`);
        
        console.log('Memory/State bug analysis:', {
          operationNumber: i,
          moveAmount: moveAmount,
          memoryBefore: memoryBefore?.usedJSHeapSize,
          memoryAtFailure: memoryAtFailure?.usedJSHeapSize,
          memoryGrowth: memoryAtFailure && memoryBefore ? 
            memoryAtFailure.usedJSHeapSize - memoryBefore.usedJSHeapSize : 'N/A',
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible
        });
        return; // Bug found
      }
      
      // Check memory every 10 operations
      if (i % 10 === 0) {
        const currentMemory = await helper.getMemoryUsage();
        if (memoryBefore && currentMemory) {
          const memoryGrowth = currentMemory.usedJSHeapSize - memoryBefore.usedJSHeapSize;
          const growthMB = (memoryGrowth / 1024 / 1024).toFixed(2);
          console.log(`  Memory after ${i} ops: +${growthMB}MB`);
        }
      }
    }
    
    const memoryAfter = await helper.getMemoryUsage();
    console.log('🏆 MEMORY TEST COMPLETED SUCCESSFULLY!');
    
    if (memoryBefore && memoryAfter) {
      const totalGrowth = memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize;
      const totalGrowthMB = (totalGrowth / 1024 / 1024).toFixed(2);
      console.log(`Total memory growth: ${totalGrowthMB}MB over ${maxOperations} operations`);
    }
    
    await helper.takeManipulationScreenshot('memory-test-success');
  });

  test('CRITICAL BUG: Timeline State Corruption Detection', async ({ page }) => {
    console.log('🔍 TESTING: Timeline state corruption during manipulation');
    
    await helper.setupBasicTimeline(1);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) {
      console.log('⚠️ No task bars found, skipping corruption test');
      return;
    }
    
    const targetTask = taskBars[0];
    
    // Record initial state
    const initialState = await page.evaluate(() => {
      const compressionMetrics = document.body.textContent.includes('Timeline Compression Metrics');
      const tasksAnalyzed = document.body.textContent.match(/(\d+) tasks analyzed/);
      const projectGantt = document.body.textContent.includes('Project Gantt Chart');
      
      return {
        compressionMetrics,
        tasksAnalyzedCount: tasksAnalyzed ? parseInt(tasksAnalyzed[1]) : 0,
        projectGantt,
        timestamp: new Date().toISOString()
      };
    });
    
    console.log('Initial timeline state:', initialState);
    
    // Perform manipulations that commonly cause state corruption
    const corruptionTestPattern = [
      { move: 150, desc: 'Large forward drag' },
      { move: -200, desc: 'Overcorrection back' },
      { move: 120, desc: 'Forward again' },
      { move: -80, desc: 'Partial correction' },
      { move: 200, desc: 'Very large forward' },
      { move: -250, desc: 'Very large back' },
      { move: 50, desc: 'Small adjustment' },
      { move: -30, desc: 'Small correction' }
    ];
    
    for (let i = 0; i < corruptionTestPattern.length; i++) {
      const pattern = corruptionTestPattern[i];
      console.log(`Corruption test ${i + 1}: ${pattern.desc} (${pattern.move}px)`);
      
      const result = await helper.dragTaskBar(targetTask, pattern.move, 0, {
        speed: 'normal',
        waitAfter: 500,
        validateMove: false
      });
      
      if (!result.success) {
        console.log(`💥 STATE CORRUPTION DETECTED: Failed at pattern ${i + 1}`);
        await helper.takeManipulationScreenshot(`state-corruption-${i + 1}`);
        
        // Check what specific corruption occurred
        const corruptedState = await page.evaluate(() => {
          const compressionMetrics = document.body.textContent.includes('Timeline Compression Metrics');
          const tasksAnalyzed = document.body.textContent.match(/(\d+) tasks analyzed/);
          const projectGantt = document.body.textContent.includes('Project Gantt Chart');
          const placeholder = document.body.textContent.includes('Your timeline will appear here');
          
          return {
            compressionMetrics,
            tasksAnalyzedCount: tasksAnalyzed ? parseInt(tasksAnalyzed[1]) : 0,
            projectGantt,
            showsPlaceholder: placeholder
          };
        });
        
        console.log('State corruption analysis:', {
          corruptionStep: i + 1,
          corruptionPattern: pattern.desc,
          initialState: initialState,
          corruptedState: corruptedState,
          stateChanges: {
            lostCompressionMetrics: initialState.compressionMetrics && !corruptedState.compressionMetrics,
            taskCountChanged: initialState.tasksAnalyzedCount !== corruptedState.tasksAnalyzedCount,
            lostProjectGantt: initialState.projectGantt && !corruptedState.projectGantt,
            showsPlaceholder: corruptedState.showsPlaceholder
          }
        });
        return; // Corruption detected
      }
      
      // Check state integrity after each manipulation
      const currentState = await page.evaluate(() => {
        const compressionMetrics = document.body.textContent.includes('Timeline Compression Metrics');
        const tasksAnalyzed = document.body.textContent.match(/(\d+) tasks analyzed/);
        
        return {
          compressionMetrics,
          tasksAnalyzedCount: tasksAnalyzed ? parseInt(tasksAnalyzed[1]) : 0
        };
      });
      
      if (!currentState.compressionMetrics || currentState.tasksAnalyzedCount !== initialState.tasksAnalyzedCount) {
        console.log(`⚠️ STATE DEGRADATION at pattern ${i + 1}: ${pattern.desc}`);
        console.log(`Tasks: ${initialState.tasksAnalyzedCount} → ${currentState.tasksAnalyzedCount}`);
        console.log(`Compression metrics: ${currentState.compressionMetrics}`);
        
        await helper.takeManipulationScreenshot(`state-degradation-${i + 1}`);
        
        // Continue test to see if it gets worse
      }
    }
    
    console.log('🏆 STATE CORRUPTION TEST COMPLETED!');
    await helper.takeManipulationScreenshot('state-corruption-test-success');
  });
});