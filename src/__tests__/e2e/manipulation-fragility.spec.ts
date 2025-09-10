/**
 * Timeline Fragility Tests
 * Tests for progressive degradation where timeline gets worse with each manipulation
 * Focuses on cumulative stress and "death by a thousand cuts" scenarios
 */

import { test, expect } from '@playwright/test';
import { ManipulationTestHelper } from './helpers/manipulation-helpers';

test.describe('Timeline Fragility - Progressive Degradation', () => {
  let helper: ManipulationTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new ManipulationTestHelper(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('🧹 Starting timeline fragility test');
  });

  test('Death by Thousand Cuts - Single Task Repeated Manipulation', async ({ page }) => {
    console.log('💀 Testing single task repeated manipulation until failure');
    
    await helper.setupBasicTimeline(1);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) {
      throw new Error('No task bars found for fragility testing');
    }
    
    const targetTask = taskBars[0];
    let operationCount = 0;
    const maxOperations = 100;
    
    // Track degradation metrics
    let initialAssetCount = await helper.countVisibleAssets();
    let initialTaskCount = await helper.countVisibleTasks();
    
    console.log(`Baseline: ${initialAssetCount} assets, ${initialTaskCount} tasks`);
    
    const manipulationPattern = [
      { type: 'drag', x: 50, y: 0, description: 'Drag forward' },
      { type: 'drag', x: -30, y: 0, description: 'Drag back' },
      { type: 'drag', x: 20, y: 0, description: 'Drag forward small' },
      { type: 'drag', x: -40, y: 0, description: 'Drag back larger' },
      { type: 'drag', x: 100, y: 0, description: 'Drag forward large' },
      { type: 'drag', x: -80, y: 0, description: 'Correct large move' },
      { type: 'drag', x: 10, y: 0, description: 'Fine adjustment' },
      { type: 'drag', x: -5, y: 0, description: 'Micro adjustment' }
    ];
    
    for (let cycle = 1; cycle <= Math.ceil(maxOperations / manipulationPattern.length); cycle++) {
      console.log(`🔄 Manipulation cycle ${cycle}`);
      
      for (let i = 0; i < manipulationPattern.length; i++) {
        operationCount++;
        if (operationCount > maxOperations) break;
        
        const operation = manipulationPattern[i];
        console.log(`  ${operationCount}: ${operation.description}`);
        
        const result = await helper.dragTaskBar(targetTask, operation.x, operation.y, {
          speed: 'fast',
          waitAfter: 100
        });
        
        if (!result.success) {
          console.log(`💥 Timeline died after ${operationCount} operations`);
          console.log(`Failed operation: ${operation.description}`);
          await helper.takeManipulationScreenshot(`death-by-cuts-failed-${operationCount}`);
          
          // Analyze the failure
          console.log('Death analysis:', {
            lastOperation: operation.description,
            timeline: result.timelineStillVisible,
            assets: result.assetsStillVisible,
            tasks: result.tasksStillVisible,
            errors: result.errorMessages
          });
          
          return; // Test complete - found breaking point
        }
        
        // Check for gradual degradation
        const currentAssets = await helper.countVisibleAssets();
        const currentTasks = await helper.countVisibleTasks();
        
        if (currentAssets < initialAssetCount || currentTasks < initialTaskCount) {
          console.log(`⚠️ Degradation detected at operation ${operationCount}`);
          console.log(`Assets: ${initialAssetCount} → ${currentAssets}, Tasks: ${initialTaskCount} → ${currentTasks}`);
          
          await helper.takeManipulationScreenshot(`degradation-detected-${operationCount}`);
          
          if (currentAssets === 0 || currentTasks === 0) {
            console.log(`💥 Complete failure at operation ${operationCount}`);
            return;
          }
          
          // Continue with degraded state
          initialAssetCount = currentAssets;
          initialTaskCount = currentTasks;
        }
        
        // Update task position for next operation
        const newPosition = await targetTask.element.boundingBox();
        if (newPosition) {
          targetTask.initialPosition = newPosition;
        }
      }
      
      // Cycle complete
      console.log(`✅ Completed manipulation cycle ${cycle} (${operationCount} total operations)`);
      
      // Take periodic screenshots
      if (cycle % 5 === 0) {
        await helper.takeManipulationScreenshot(`death-by-cuts-cycle-${cycle}`);
      }
    }
    
    console.log(`🏆 Timeline survived ${operationCount} repeated manipulations!`);
  });

  test('Multi-Asset Progressive Stress', async ({ page }) => {
    console.log('🎪 Testing multi-asset progressive stress');
    
    await helper.setupBasicTimeline(3);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 2) {
      console.log('⚠️ Insufficient task bars for multi-asset test');
      return;
    }
    
    let operationCount = 0;
    const stressPhases = [
      {
        name: 'Light Stress',
        operations: 10,
        delay: 500,
        description: 'Gentle manipulations with pauses'
      },
      {
        name: 'Medium Stress', 
        operations: 15,
        delay: 200,
        description: 'Faster operations, less delay'
      },
      {
        name: 'Heavy Stress',
        operations: 20,
        delay: 50,
        description: 'Rapid fire operations'
      },
      {
        name: 'Extreme Stress',
        operations: 25,
        delay: 10,
        description: 'Maximum speed stress'
      }
    ];
    
    for (const phase of stressPhases) {
      console.log(`🔥 Starting ${phase.name}: ${phase.description}`);
      
      for (let i = 1; i <= phase.operations; i++) {
        operationCount++;
        
        // Rotate through available task bars
        const taskIndex = (operationCount - 1) % taskBars.length;
        const targetTask = taskBars[taskIndex];
        
        // Random drag operation
        const dragX = (Math.random() - 0.5) * 200; // -100 to +100
        const dragY = 0;
        
        console.log(`  ${phase.name} ${i}/${phase.operations}: Task ${taskIndex} by ${dragX.toFixed(0)}px`);
        
        const result = await helper.dragTaskBar(targetTask, dragX, dragY, {
          speed: 'fast',
          waitAfter: phase.delay
        });
        
        if (!result.success) {
          console.log(`💥 Failed during ${phase.name} at operation ${i} (total: ${operationCount})`);
          await helper.takeManipulationScreenshot(`multi-asset-stress-failed-${phase.name}-${i}`);
          
          console.log('Multi-asset failure:', {
            phase: phase.name,
            phaseOperation: i,
            totalOperations: operationCount,
            failedTask: taskIndex,
            dragAmount: dragX,
            timeline: result.timelineStillVisible,
            assets: result.assetsStillVisible,
            tasks: result.tasksStillVisible
          });
          
          return; // End test at failure point
        }
        
        // Update task position
        const newPosition = await targetTask.element.boundingBox();
        if (newPosition) {
          targetTask.initialPosition = newPosition;
        }
      }
      
      console.log(`✅ Survived ${phase.name} (${phase.operations} operations)`);
      await helper.takeManipulationScreenshot(`multi-asset-stress-after-${phase.name}`);
    }
    
    console.log(`🏆 Multi-asset stress test completed: ${operationCount} total operations`);
  });

  test('Escalating Complexity Stress', async ({ page }) => {
    console.log('📈 Testing escalating complexity stress');
    
    await helper.setupBasicTimeline(2);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 2) return;
    
    // Start simple, get more complex
    const complexityLevels = [
      {
        level: 1,
        description: 'Simple single drags',
        test: async (task: any) => {
          return await helper.dragTaskBar(task, 30, 0);
        }
      },
      {
        level: 2,
        description: 'Drag with corrections',
        test: async (task: any) => {
          let result = await helper.dragTaskBar(task, 50, 0, { waitAfter: 200 });
          if (result.success) {
            result = await helper.correctDragOperation(task, -20);
          }
          return result;
        }
      },
      {
        level: 3,
        description: 'Rapid drag sequences',
        test: async (task: any) => {
          return await helper.rapidDragSequence(task, [
            { x: 40, y: 0 },
            { x: -20, y: 0 },
            { x: 10, y: 0 }
          ], 100);
        }
      },
      {
        level: 4,
        description: 'Dependency creation attempts',
        test: async (task: any) => {
          return await helper.createDependencyByDrag(task, 1);
        }
      },
      {
        level: 5,
        description: 'Complex dependency corrections',
        test: async (task: any) => {
          let result = await helper.createDependencyByDrag(task, 2);
          if (result.success) {
            await page.waitForTimeout(300);
            result = await helper.correctDragOperation(task, 25);
          }
          return result;
        }
      }
    ];
    
    let currentLevel = 1;
    let operationsAtThisLevel = 0;
    const maxOperationsPerLevel = 10;
    
    while (currentLevel <= complexityLevels.length) {
      const level = complexityLevels[currentLevel - 1];
      operationsAtThisLevel++;
      
      console.log(`🎯 Level ${level.level} Operation ${operationsAtThisLevel}: ${level.description}`);
      
      // Alternate between task bars
      const taskIndex = operationsAtThisLevel % 2;
      const targetTask = taskBars[taskIndex];
      
      const result = await level.test(targetTask);
      
      if (!result.success) {
        console.log(`💥 Failed at complexity level ${level.level}, operation ${operationsAtThisLevel}`);
        await helper.takeManipulationScreenshot(`complexity-failed-L${level.level}-op${operationsAtThisLevel}`);
        
        console.log('Complexity failure analysis:', {
          level: level.level,
          levelDescription: level.description,
          operationAtLevel: operationsAtThisLevel,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible,
          errors: result.errorMessages
        });
        
        return; // Test complete - found breaking complexity
      }
      
      // Move to next level after enough operations
      if (operationsAtThisLevel >= maxOperationsPerLevel) {
        console.log(`✅ Completed complexity level ${level.level}`);
        currentLevel++;
        operationsAtThisLevel = 0;
        
        await helper.takeManipulationScreenshot(`complexity-completed-L${level.level}`);
      }
      
      // Update task positions
      for (const task of taskBars) {
        const newPosition = await task.element.boundingBox();
        if (newPosition) {
          task.initialPosition = newPosition;
        }
      }
    }
    
    console.log('🏆 Survived all complexity levels!');
  });

  test('Memory Leak Detection During Manipulation', async ({ page }) => {
    console.log('🧠 Testing for memory leaks during repeated manipulations');
    
    await helper.setupBasicTimeline(2);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) return;
    
    const targetTask = taskBars[0];
    const memorySnapshots: any[] = [];
    
    // Take initial memory snapshot
    let memoryBefore = await helper.getMemoryUsage();
    memorySnapshots.push({ operation: 0, memory: memoryBefore });
    
    console.log(`Initial memory: ${memoryBefore?.usedJSHeapSize || 'N/A'} bytes`);
    
    const operationsPerCheck = 5;
    const totalChecks = 10;
    
    for (let check = 1; check <= totalChecks; check++) {
      console.log(`🔄 Memory check ${check}/${totalChecks} (${operationsPerCheck} operations)`);
      
      // Perform operations
      for (let op = 1; op <= operationsPerCheck; op++) {
        const dragX = (Math.random() - 0.5) * 100;
        const result = await helper.dragTaskBar(targetTask, dragX, 0, { 
          speed: 'fast',
          waitAfter: 50 
        });
        
        if (!result.success) {
          console.log(`❌ Operation failed during memory test at check ${check}, operation ${op}`);
          return;
        }
        
        // Update position
        const newPosition = await targetTask.element.boundingBox();
        if (newPosition) {
          targetTask.initialPosition = newPosition;
        }
      }
      
      // Take memory snapshot
      const memoryAfter = await helper.getMemoryUsage();
      memorySnapshots.push({ 
        operation: check * operationsPerCheck, 
        memory: memoryAfter 
      });
      
      if (memoryBefore && memoryAfter) {
        const memoryGrowth = memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize;
        const growthMB = (memoryGrowth / 1024 / 1024).toFixed(2);
        
        console.log(`Memory after ${check * operationsPerCheck} ops: ${memoryAfter.usedJSHeapSize} (+${growthMB}MB)`);
        
        // Flag significant memory growth
        if (memoryGrowth > 10 * 1024 * 1024) { // 10MB threshold
          console.log(`⚠️ Significant memory growth detected: +${growthMB}MB`);
          await helper.takeManipulationScreenshot(`memory-growth-check-${check}`);
        }
        
        memoryBefore = memoryAfter;
      }
    }
    
    // Analyze memory trend
    console.log('\n📊 Memory Growth Analysis:');
    let totalGrowth = 0;
    
    if (memorySnapshots.length >= 2) {
      const initial = memorySnapshots[0].memory;
      const final = memorySnapshots[memorySnapshots.length - 1].memory;
      
      if (initial && final) {
        totalGrowth = final.usedJSHeapSize - initial.usedJSHeapSize;
        const totalGrowthMB = (totalGrowth / 1024 / 1024).toFixed(2);
        
        console.log(`Total memory growth: ${totalGrowthMB}MB over ${totalChecks * operationsPerCheck} operations`);
        console.log(`Average per operation: ${(totalGrowth / (totalChecks * operationsPerCheck) / 1024).toFixed(2)}KB`);
        
        if (totalGrowth > 50 * 1024 * 1024) { // 50MB total threshold
          console.log('🚨 POTENTIAL MEMORY LEAK: Significant total growth');
        } else if (totalGrowth > 20 * 1024 * 1024) { // 20MB warning threshold
          console.log('⚠️ MODERATE MEMORY GROWTH: Monitor for leaks');
        } else {
          console.log('✅ ACCEPTABLE MEMORY GROWTH: Within normal range');
        }
      }
    }
  });

  test('Performance Degradation Detection', async ({ page }) => {
    console.log('⏱️ Testing for performance degradation over time');
    
    await helper.setupBasicTimeline(1);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) return;
    
    const targetTask = taskBars[0];
    const performanceMetrics: Array<{operation: number, time: number}> = [];
    
    const totalOperations = 30;
    
    for (let i = 1; i <= totalOperations; i++) {
      console.log(`⏱️ Performance test ${i}/${totalOperations}`);
      
      const startTime = Date.now();
      
      // Perform standard drag operation
      const dragX = (Math.random() - 0.5) * 80;
      const result = await helper.dragTaskBar(targetTask, dragX, 0, { 
        speed: 'normal',
        waitAfter: 200 
      });
      
      const operationTime = Date.now() - startTime;
      performanceMetrics.push({ operation: i, time: operationTime });
      
      if (!result.success) {
        console.log(`❌ Performance test failed at operation ${i}`);
        break;
      }
      
      console.log(`Operation ${i}: ${operationTime}ms`);
      
      // Flag slow operations
      if (operationTime > 5000) { // 5 second threshold
        console.log(`⚠️ SLOW OPERATION: ${operationTime}ms at operation ${i}`);
        await helper.takeManipulationScreenshot(`slow-operation-${i}`);
      }
      
      // Update position
      const newPosition = await targetTask.element.boundingBox();
      if (newPosition) {
        targetTask.initialPosition = newPosition;
      }
    }
    
    // Analyze performance trend
    console.log('\n📊 Performance Analysis:');
    
    if (performanceMetrics.length >= 10) {
      const firstTen = performanceMetrics.slice(0, 10);
      const lastTen = performanceMetrics.slice(-10);
      
      const avgFirst = firstTen.reduce((sum, m) => sum + m.time, 0) / firstTen.length;
      const avgLast = lastTen.reduce((sum, m) => sum + m.time, 0) / lastTen.length;
      
      console.log(`First 10 operations average: ${avgFirst.toFixed(0)}ms`);
      console.log(`Last 10 operations average: ${avgLast.toFixed(0)}ms`);
      
      const degradationPercent = ((avgLast - avgFirst) / avgFirst * 100);
      
      if (degradationPercent > 50) {
        console.log(`🚨 SIGNIFICANT PERFORMANCE DEGRADATION: ${degradationPercent.toFixed(1)}% slower`);
      } else if (degradationPercent > 20) {
        console.log(`⚠️ MODERATE PERFORMANCE DEGRADATION: ${degradationPercent.toFixed(1)}% slower`);
      } else {
        console.log(`✅ STABLE PERFORMANCE: ${Math.abs(degradationPercent).toFixed(1)}% change`);
      }
    }
    
    const maxTime = Math.max(...performanceMetrics.map(m => m.time));
    const minTime = Math.min(...performanceMetrics.map(m => m.time));
    console.log(`Performance range: ${minTime}ms - ${maxTime}ms`);
  });
});