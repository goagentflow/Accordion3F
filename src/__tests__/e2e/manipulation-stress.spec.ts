/**
 * Timeline Manipulation Stress Tests
 * Core stress testing for timeline manipulation operations
 * Combines all manipulation testing approaches to find breaking points
 */

import { test, expect } from '@playwright/test';
import { ManipulationTestHelper } from './helpers/manipulation-helpers';

test.describe('Timeline Manipulation Stress Tests - Core Breaking Points', () => {
  let helper: ManipulationTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new ManipulationTestHelper(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('🧹 Starting manipulation stress test');
  });

  test('Stress Test 1: Single Task Endurance - How Many Drags Before Break', async ({ page }) => {
    console.log('💪 Single task endurance test');
    
    await helper.setupBasicTimeline(1);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) {
      throw new Error('No task bars found for stress testing');
    }
    
    const targetTask = taskBars[0];
    let operationCount = 0;
    const maxOperations = 200; // High limit to find real breaking point
    
    console.log(`Starting endurance test: up to ${maxOperations} operations`);
    
    // Pattern: Forward, back, forward, back with increasing intensity
    for (let cycle = 1; cycle <= maxOperations / 4; cycle++) {
      const intensity = Math.min(cycle * 2, 50); // Gradually increase drag distance
      
      // Forward drag
      operationCount++;
      console.log(`${operationCount}: Forward drag ${intensity}px (cycle ${cycle})`);
      let result = await helper.dragTaskBar(targetTask, intensity, 0, { speed: 'normal', waitAfter: 100 });
      
      if (!result.success) {
        console.log(`💥 ENDURANCE LIMIT REACHED at operation ${operationCount}`);
        await helper.takeManipulationScreenshot(`endurance-failed-${operationCount}`);
        
        console.log('Endurance failure analysis:', {
          totalOperations: operationCount,
          cycleNumber: cycle,
          failedOperation: 'forward',
          dragIntensity: intensity,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible
        });
        return;
      }
      
      // Update position
      let newPosition = await targetTask.element.boundingBox();
      if (newPosition) targetTask.initialPosition = newPosition;
      
      // Back drag
      operationCount++;
      console.log(`${operationCount}: Back drag ${-intensity}px (cycle ${cycle})`);
      result = await helper.dragTaskBar(targetTask, -intensity, 0, { speed: 'normal', waitAfter: 100 });
      
      if (!result.success) {
        console.log(`💥 ENDURANCE LIMIT REACHED at operation ${operationCount}`);
        await helper.takeManipulationScreenshot(`endurance-failed-${operationCount}`);
        
        console.log('Endurance failure analysis:', {
          totalOperations: operationCount,
          cycleNumber: cycle,
          failedOperation: 'backward',
          dragIntensity: -intensity,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible
        });
        return;
      }
      
      // Update position
      newPosition = await targetTask.element.boundingBox();
      if (newPosition) targetTask.initialPosition = newPosition;
      
      // Progress check every 10 cycles
      if (cycle % 10 === 0) {
        console.log(`✅ Endurance milestone: ${cycle} cycles (${operationCount} operations) completed`);
        await helper.takeManipulationScreenshot(`endurance-milestone-${cycle}-cycles`);
      }
      
      // Early exit if we've reached the maximum
      if (operationCount >= maxOperations) {
        console.log(`🏆 MAXIMUM ENDURANCE: Survived all ${maxOperations} operations!`);
        break;
      }
    }
    
    console.log(`🏁 Endurance test completed: ${operationCount} operations survived`);
  });

  test('Stress Test 2: Rapid Fire Assault - Minimal Delay Operations', async ({ page }) => {
    console.log('⚡ Rapid fire assault test');
    
    await helper.setupBasicTimeline(2);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 2) return;
    
    let operationCount = 0;
    const assaultDuration = 60; // seconds
    const startTime = Date.now();
    
    console.log(`Starting rapid fire assault: ${assaultDuration}s of maximum speed operations`);
    
    while ((Date.now() - startTime) < assaultDuration * 1000) {
      operationCount++;
      
      // Alternate between tasks and random drag amounts
      const taskIndex = operationCount % taskBars.length;
      const targetTask = taskBars[taskIndex];
      const dragAmount = (Math.random() - 0.5) * 100; // -50 to +50
      
      if (operationCount % 20 === 0) {
        console.log(`Assault ${operationCount}: Task ${taskIndex} by ${dragAmount.toFixed(0)}px`);
      }
      
      const result = await helper.dragTaskBar(targetTask, dragAmount, 0, {
        speed: 'fast',
        waitAfter: 10 // Absolute minimum delay
      });
      
      if (!result.success) {
        console.log(`💥 RAPID FIRE LIMIT REACHED at operation ${operationCount}`);
        const timeElapsed = (Date.now() - startTime) / 1000;
        await helper.takeManipulationScreenshot(`rapid-fire-failed-${operationCount}`);
        
        console.log('Rapid fire failure analysis:', {
          operationsPerSecond: (operationCount / timeElapsed).toFixed(2),
          totalOperations: operationCount,
          timeElapsed: timeElapsed.toFixed(1),
          failedTask: taskIndex,
          failedDrag: dragAmount,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible
        });
        return;
      }
      
      // Update position
      const newPosition = await targetTask.element.boundingBox();
      if (newPosition) {
        targetTask.initialPosition = newPosition;
      }
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    const operationsPerSecond = operationCount / totalTime;
    
    console.log(`🏆 RAPID FIRE SURVIVED: ${operationCount} operations in ${totalTime.toFixed(1)}s`);
    console.log(`Average: ${operationsPerSecond.toFixed(2)} operations/second`);
    
    await helper.takeManipulationScreenshot('rapid-fire-assault-survived');
  });

  test('Stress Test 3: Chaos Mode - Random Everything', async ({ page }) => {
    console.log('🌪️ Chaos mode stress test');
    
    await helper.setupBasicTimeline(3);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) return;
    
    const chaosOperations = 150;
    let operationCount = 0;
    
    console.log(`Starting chaos mode: ${chaosOperations} random operations`);
    
    for (let i = 1; i <= chaosOperations; i++) {
      operationCount = i;
      
      // Random everything
      const randomTaskIndex = Math.floor(Math.random() * taskBars.length);
      const randomDragX = (Math.random() - 0.5) * 300; // -150 to +150
      const randomDragY = (Math.random() - 0.5) * 50;  // Small Y variation
      const randomSpeed = Math.random() < 0.7 ? 'fast' : 'slow';
      const randomDelay = Math.floor(Math.random() * 500); // 0-500ms
      
      const targetTask = taskBars[randomTaskIndex];
      
      if (i % 25 === 0) {
        console.log(`Chaos ${i}: Task ${randomTaskIndex}, drag (${randomDragX.toFixed(0)}, ${randomDragY.toFixed(0)}), ${randomSpeed}, ${randomDelay}ms`);
      }
      
      const result = await helper.dragTaskBar(targetTask, randomDragX, randomDragY, {
        speed: randomSpeed as any,
        waitAfter: randomDelay
      });
      
      if (!result.success) {
        console.log(`💥 CHAOS BROKE TIMELINE at operation ${i}`);
        await helper.takeManipulationScreenshot(`chaos-mode-failed-${i}`);
        
        console.log('Chaos failure analysis:', {
          chaosOperation: i,
          randomTask: randomTaskIndex,
          randomDragX: randomDragX.toFixed(0),
          randomDragY: randomDragY.toFixed(0),
          randomSpeed: randomSpeed,
          randomDelay: randomDelay,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible
        });
        return;
      }
      
      // Update position
      const newPosition = await targetTask.element.boundingBox();
      if (newPosition) {
        targetTask.initialPosition = newPosition;
      }
    }
    
    console.log(`🏆 CHAOS SURVIVED: ${chaosOperations} random operations completed`);
    await helper.takeManipulationScreenshot('chaos-mode-survived');
  });

  test('Stress Test 4: Memory Exhaustion - Large Asset Count', async ({ page }) => {
    console.log('🧠 Memory exhaustion stress test');
    
    // Create larger timeline for memory stress
    await helper.setupBasicTimeline(5); // More assets = more potential memory usage
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) return;
    
    console.log(`Testing with ${taskBars.length} assets for memory stress`);
    
    const memoryBefore = await helper.getMemoryUsage();
    console.log(`Initial memory: ${memoryBefore?.usedJSHeapSize || 'N/A'} bytes`);
    
    let operationCount = 0;
    const memoryOperations = 100;
    
    for (let i = 1; i <= memoryOperations; i++) {
      operationCount = i;
      
      // Cycle through all tasks to stress the system
      for (let taskIndex = 0; taskIndex < taskBars.length; taskIndex++) {
        const targetTask = taskBars[taskIndex];
        const complexDrag = (Math.sin(i / 10) * 50); // Create complex movement pattern
        
        const result = await helper.dragTaskBar(targetTask, complexDrag, 0, {
          speed: 'normal',
          waitAfter: 100
        });
        
        if (!result.success) {
          console.log(`💥 MEMORY EXHAUSTION at operation ${i}, task ${taskIndex}`);
          
          const memoryAtFailure = await helper.getMemoryUsage();
          await helper.takeManipulationScreenshot(`memory-exhaustion-failed-${i}`);
          
          console.log('Memory exhaustion analysis:', {
            operation: i,
            failedTaskIndex: taskIndex,
            memoryBefore: memoryBefore?.usedJSHeapSize,
            memoryAtFailure: memoryAtFailure?.usedJSHeapSize,
            memoryGrowth: memoryAtFailure && memoryBefore ? 
              memoryAtFailure.usedJSHeapSize - memoryBefore.usedJSHeapSize : 'N/A',
            timeline: result.timelineStillVisible,
            assets: result.assetsStillVisible,
            tasks: result.tasksStillVisible
          });
          return;
        }
        
        // Update position
        const newPosition = await targetTask.element.boundingBox();
        if (newPosition) {
          targetTask.initialPosition = newPosition;
        }
      }
      
      // Memory check every 10 operations
      if (i % 10 === 0) {
        const currentMemory = await helper.getMemoryUsage();
        if (memoryBefore && currentMemory) {
          const memoryGrowth = currentMemory.usedJSHeapSize - memoryBefore.usedJSHeapSize;
          const growthMB = (memoryGrowth / 1024 / 1024).toFixed(2);
          console.log(`Memory check ${i}: +${growthMB}MB growth`);
          
          if (memoryGrowth > 100 * 1024 * 1024) { // 100MB threshold
            console.log('⚠️ SIGNIFICANT MEMORY GROWTH: May indicate memory leak');
          }
        }
      }
    }
    
    const memoryAfter = await helper.getMemoryUsage();
    console.log(`🏆 MEMORY STRESS SURVIVED: ${memoryOperations * taskBars.length} total manipulations`);
    
    if (memoryBefore && memoryAfter) {
      const totalGrowth = memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize;
      console.log(`Total memory growth: ${(totalGrowth / 1024 / 1024).toFixed(2)}MB`);
    }
    
    await helper.takeManipulationScreenshot('memory-stress-survived');
  });

  test('Stress Test 5: Breaking Point Discovery - Find Exact Limit', async ({ page }) => {
    console.log('🎯 Breaking point discovery test');
    
    await helper.setupBasicTimeline(1);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) return;
    
    const targetTask = taskBars[0];
    
    // Binary search for breaking point
    let minOperations = 1;
    let maxOperations = 1000;
    let lastSuccessfulCount = 0;
    
    console.log('Using binary search to find exact breaking point...');
    
    while (minOperations <= maxOperations) {
      const testOperations = Math.floor((minOperations + maxOperations) / 2);
      console.log(`\n🔍 Testing ${testOperations} operations (range: ${minOperations}-${maxOperations})`);
      
      // Reset for this test
      helper.resetOperationCounter();
      await helper.setupBasicTimeline(1);
      const freshTaskBars = await helper.findTaskBars();
      if (freshTaskBars.length === 0) break;
      const testTask = freshTaskBars[0];
      
      let success = true;
      
      // Perform the test number of operations
      for (let i = 1; i <= testOperations && success; i++) {
        const dragX = (i % 2 === 0) ? 30 : -30; // Simple alternating pattern
        const result = await helper.dragTaskBar(testTask, dragX, 0, { 
          speed: 'fast', 
          waitAfter: 25 
        });
        
        if (!result.success) {
          success = false;
          console.log(`❌ Failed at operation ${i} of ${testOperations}`);
        } else {
          // Update position
          const newPosition = await testTask.element.boundingBox();
          if (newPosition) testTask.initialPosition = newPosition;
        }
      }
      
      if (success) {
        console.log(`✅ Successfully completed ${testOperations} operations`);
        lastSuccessfulCount = testOperations;
        minOperations = testOperations + 1; // Try higher
      } else {
        console.log(`❌ Failed at ${testOperations} operations`);
        maxOperations = testOperations - 1; // Try lower
      }
    }
    
    console.log(`\n🎯 BREAKING POINT DISCOVERED: ${lastSuccessfulCount} operations`);
    console.log(`Timeline can reliably handle ${lastSuccessfulCount} drag operations before failure`);
    
    if (lastSuccessfulCount < 10) {
      console.log('🚨 CRITICAL: Very low operation limit - high fragility');
    } else if (lastSuccessfulCount < 50) {
      console.log('⚠️ WARNING: Low operation limit - moderate fragility');
    } else if (lastSuccessfulCount < 100) {
      console.log('✅ ACCEPTABLE: Moderate operation limit - some fragility');
    } else {
      console.log('🏆 EXCELLENT: High operation limit - low fragility');
    }
    
    // Verify the breaking point by testing it again
    console.log(`\n🔬 Verifying breaking point by testing ${lastSuccessfulCount + 10} operations...`);
    
    helper.resetOperationCounter();
    await helper.setupBasicTimeline(1);
    const verifyTaskBars = await helper.findTaskBars();
    if (verifyTaskBars.length > 0) {
      const verifyTask = verifyTaskBars[0];
      let verificationFailed = false;
      
      for (let i = 1; i <= lastSuccessfulCount + 10; i++) {
        const dragX = (i % 2 === 0) ? 25 : -25;
        const result = await helper.dragTaskBar(verifyTask, dragX, 0, { speed: 'fast', waitAfter: 50 });
        
        if (!result.success) {
          console.log(`💥 Verification: Failed at operation ${i} (expected around ${lastSuccessfulCount})`);
          await helper.takeManipulationScreenshot(`breaking-point-verified-${i}`);
          verificationFailed = true;
          break;
        }
        
        const newPosition = await verifyTask.element.boundingBox();
        if (newPosition) verifyTask.initialPosition = newPosition;
      }
      
      if (!verificationFailed) {
        console.log('⚠️ Breaking point may be higher than discovered - timeline survived verification');
      }
    }
  });
});