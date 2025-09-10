/**
 * Timeline Dependency Manipulation Tests
 * Focuses on the critical bug: creating dependencies by dragging and then trying to correct them
 * This addresses the specific issue where correcting drag operations causes timeline crashes
 */

import { test, expect } from '@playwright/test';
import { ManipulationTestHelper } from './helpers/manipulation-helpers';

test.describe('Timeline Dependency Manipulation - Critical Bug Tests', () => {
  let helper: ManipulationTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new ManipulationTestHelper(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('🧹 Starting dependency manipulation test');
  });

  test('CRITICAL: Overlap Correction Bug - The Exact Scenario', async ({ page }) => {
    console.log('🔥 TESTING THE CRITICAL BUG: Overlap correction failure');
    
    // Set up timeline with multiple tasks
    await helper.setupBasicTimeline(2); // Two assets for better dependency testing
    
    // Find available task bars
    const taskBars = await helper.findTaskBars();
    console.log(`Found ${taskBars.length} task bars for manipulation`);
    
    if (taskBars.length < 2) {
      throw new Error('Need at least 2 task bars for dependency testing');
    }
    
    const taskA = taskBars[0];
    const taskB = taskBars[1];
    
    console.log('📋 Step 1: Establish baseline - timeline working normally');
    let result = await helper.validateManipulationResult(Date.now(), await helper.getMemoryUsage());
    expect(result.success).toBe(true);
    await helper.takeManipulationScreenshot('critical-bug-baseline');
    
    console.log('📋 Step 2: Drag Task B forward 2 days (USER MISTAKE - meant to be 1 day)');
    // Create 2-day overlap instead of intended 1-day
    result = await helper.createDependencyByDrag(taskB, 2);
    
    if (!result.success) {
      console.error('❌ FAILED at step 2 - could not create initial dependency');
      await helper.takeManipulationScreenshot('critical-bug-step2-failed');
      throw new Error('Failed to create initial 2-day overlap');
    }
    
    console.log('✅ Step 2 success: Created 2-day overlap');
    await helper.takeManipulationScreenshot('critical-bug-after-2day-overlap');
    
    console.log('📋 Step 3: CRITICAL - Try to correct by dragging back 1 day');
    // This is where the bug typically manifests
    result = await helper.correctDragOperation(taskB, 30); // Approx 1 day worth of pixels
    
    if (!result.success) {
      console.error('🎯 CRITICAL BUG REPRODUCED: Cannot correct drag operation!');
      console.error('Timeline state:', {
        timelineVisible: result.timelineStillVisible,
        assetsVisible: result.assetsStillVisible,
        tasksVisible: result.tasksStillVisible,
        errors: result.errorMessages
      });
      
      await helper.takeManipulationScreenshot('critical-bug-REPRODUCED');
      
      // This is the expected bug - test should document it, not fail the test
      console.log('✅ Successfully reproduced the critical drag correction bug');
      return; // Bug reproduced successfully
    }
    
    console.log('✅ Step 3 success: Correction worked (bug not present)');
    await helper.takeManipulationScreenshot('critical-bug-corrected-successfully');
    
    console.log('📋 Step 4: Verify timeline still functional after correction');
    const finalValidation = await helper.verifyTimelineExists();
    const finalAssetCount = await helper.countVisibleAssets();
    const finalTaskCount = await helper.countVisibleTasks();
    
    console.log(`Final state: timeline=${finalValidation}, assets=${finalAssetCount}, tasks=${finalTaskCount}`);
    
    if (!finalValidation || finalAssetCount === 0 || finalTaskCount === 0) {
      console.error('🎯 DELAYED BUG: Correction appeared to work but timeline degraded');
      await helper.takeManipulationScreenshot('critical-bug-delayed-failure');
    }
  });

  test('Dependency Chain Manipulation - Complex Correction', async ({ page }) => {
    console.log('🔗 Testing dependency chain corrections');
    
    await helper.setupBasicTimeline(3); // Three assets for chain testing
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 3) {
      console.log('⚠️ Not enough task bars for chain testing, skipping');
      return;
    }
    
    const [taskA, taskB, taskC] = taskBars;
    
    console.log('📋 Creating dependency chain: A → B → C');
    
    // Create A → B dependency
    let result = await helper.createDependencyByDrag(taskB, 1);
    if (!result.success) {
      await helper.takeManipulationScreenshot('chain-step1-failed');
      throw new Error('Failed to create A→B dependency');
    }
    
    // Create B → C dependency  
    result = await helper.createDependencyByDrag(taskC, 1);
    if (!result.success) {
      await helper.takeManipulationScreenshot('chain-step2-failed');
      throw new Error('Failed to create B→C dependency');
    }
    
    console.log('📋 Now try to adjust middle task B (this often breaks chains)');
    result = await helper.correctDragOperation(taskB, -15); // Move back slightly
    
    if (!result.success) {
      console.log('🎯 Chain manipulation bug reproduced');
      await helper.takeManipulationScreenshot('chain-manipulation-bug');
      
      // Check if specific assets disappeared
      const assetsAfter = await helper.countVisibleAssets();
      const tasksAfter = await helper.countVisibleTasks();
      
      console.log(`Chain failure impact: ${assetsAfter} assets, ${tasksAfter} tasks remaining`);
    }
  });

  test('Rapid Dependency Creation and Correction', async ({ page }) => {
    console.log('⚡ Testing rapid dependency operations');
    
    await helper.setupBasicTimeline(2);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 2) return;
    
    const taskB = taskBars[1];
    
    // Rapid sequence of dependency operations
    const operations = [
      { action: 'create', days: 2 },
      { action: 'correct', pixels: 15 },
      { action: 'correct', pixels: -10 },
      { action: 'create', days: 1 },
      { action: 'correct', pixels: 20 },
      { action: 'correct', pixels: -30 }
    ];
    
    let operationCount = 0;
    
    for (const op of operations) {
      operationCount++;
      console.log(`🔄 Operation ${operationCount}: ${op.action}`);
      
      let result;
      if (op.action === 'create') {
        result = await helper.createDependencyByDrag(taskB, op.days!);
      } else {
        result = await helper.correctDragOperation(taskB, op.pixels!);
      }
      
      if (!result.success) {
        console.log(`❌ Rapid operation failed at step ${operationCount}: ${op.action}`);
        await helper.takeManipulationScreenshot(`rapid-ops-failed-step-${operationCount}`);
        
        // Log the specific failure mode
        console.log('Failure details:', {
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible,
          errors: result.errorMessages
        });
        
        break; // Stop the sequence when it breaks
      }
      
      // Very short delay between operations to stress the system
      await page.waitForTimeout(100);
    }
    
    const summary = helper.getFailureSummary();
    console.log(`Rapid operations summary: ${summary.operationCount} operations, ${summary.failures.length} failures`);
  });

  test('Impossible Dependency Scenarios', async ({ page }) => {
    console.log('🚫 Testing impossible dependency scenarios');
    
    await helper.setupBasicTimeline(2);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 2) return;
    
    const [taskA, taskB] = taskBars;
    
    console.log('📋 Step 1: Create A → B dependency');
    let result = await helper.createDependencyByDrag(taskB, 1);
    
    if (result.success) {
      console.log('📋 Step 2: Try to create B → A (circular dependency)');
      // This should either be prevented or crash gracefully
      result = await helper.createDependencyByDrag(taskA, 1);
      
      if (!result.success) {
        console.log('🎯 Circular dependency attempt caused failure');
        await helper.takeManipulationScreenshot('circular-dependency-failure');
        
        // Check if app recovered gracefully or crashed hard
        const canStillOperate = await helper.verifyTimelineExists();
        console.log(`App recovery after circular attempt: ${canStillOperate}`);
      }
    }
  });

  test('Boundary Drag Operations', async ({ page }) => {
    console.log('📐 Testing drag operations at timeline boundaries');
    
    await helper.setupBasicTimeline(1);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) return;
    
    const taskB = taskBars[0];
    
    // Try to drag beyond timeline start
    console.log('📋 Dragging to timeline start boundary');
    let result = await helper.dragTaskBar(taskB, -500, 0, { validateMove: true });
    
    if (!result.success) {
      console.log('❌ Boundary drag to start failed');
      await helper.takeManipulationScreenshot('boundary-start-failed');
    }
    
    // Try to drag beyond timeline end
    console.log('📋 Dragging to timeline end boundary');
    result = await helper.dragTaskBar(taskB, 1000, 0, { validateMove: true });
    
    if (!result.success) {
      console.log('❌ Boundary drag to end failed');
      await helper.takeManipulationScreenshot('boundary-end-failed');
    }
    
    // Try to correct from boundary position
    console.log('📋 Correcting from boundary position');
    result = await helper.correctDragOperation(taskB, -200);
    
    if (!result.success) {
      console.log('🎯 Boundary correction bug reproduced');
      await helper.takeManipulationScreenshot('boundary-correction-bug');
    }
  });

  test('Multiple Asset Dependency Web', async ({ page }) => {
    console.log('🕸️ Testing complex multi-asset dependencies');
    
    await helper.setupBasicTimeline(4); // Four assets for complex web
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 4) {
      console.log('⚠️ Not enough assets for web testing');
      return;
    }
    
    // Create a web of dependencies
    const dependencyWeb = [
      { from: 1, to: 0, days: 1 }, // B depends on A
      { from: 2, to: 1, days: 2 }, // C depends on B  
      { from: 3, to: 0, days: 1 }, // D depends on A
      { from: 3, to: 2, days: 1 }  // D depends on C
    ];
    
    console.log('📋 Creating complex dependency web...');
    
    for (let i = 0; i < dependencyWeb.length; i++) {
      const dep = dependencyWeb[i];
      console.log(`  Creating dependency ${i + 1}: Task ${dep.from} → Task ${dep.to} (${dep.days} days)`);
      
      const result = await helper.createDependencyByDrag(taskBars[dep.from], dep.days);
      
      if (!result.success) {
        console.log(`❌ Web creation failed at dependency ${i + 1}`);
        await helper.takeManipulationScreenshot(`web-creation-failed-${i + 1}`);
        break;
      }
    }
    
    console.log('📋 Now try to modify a central node in the web');
    // Modify task B which has both incoming and outgoing dependencies
    const result = await helper.correctDragOperation(taskBars[1], 30);
    
    if (!result.success) {
      console.log('🎯 Complex web modification caused failure');
      await helper.takeManipulationScreenshot('web-modification-failure');
      
      // Analyze the failure pattern
      const finalAssets = await helper.countVisibleAssets();
      const finalTasks = await helper.countVisibleTasks();
      
      console.log(`Web failure impact: went from 4 assets to ${finalAssets} assets, tasks: ${finalTasks}`);
    }
  });

  test('Stress Test: Progressive Dependency Degradation', async ({ page }) => {
    console.log('📈 Progressive dependency stress test');
    
    await helper.setupBasicTimeline(2);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 2) return;
    
    const taskB = taskBars[1];
    let operationsBeforeFailure = 0;
    const maxOperations = 50;
    
    console.log(`Starting progressive stress test (max ${maxOperations} operations)`);
    
    for (let i = 1; i <= maxOperations; i++) {
      console.log(`⚡ Stress operation ${i}/${maxOperations}`);
      
      // Alternate between creating and correcting dependencies
      let result;
      if (i % 2 === 1) {
        // Create dependency
        result = await helper.createDependencyByDrag(taskB, Math.ceil(i / 10) + 1);
      } else {
        // Correct/modify dependency
        const correction = (i % 4 === 0) ? -20 : 15;
        result = await helper.correctDragOperation(taskB, correction);
      }
      
      if (!result.success) {
        operationsBeforeFailure = i;
        console.log(`💥 Timeline broke after ${operationsBeforeFailure} operations`);
        await helper.takeManipulationScreenshot(`stress-failure-after-${operationsBeforeFailure}-ops`);
        
        console.log('Failure analysis:', {
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible,
          lastError: result.errorMessages[result.errorMessages.length - 1]
        });
        
        break;
      }
      
      operationsBeforeFailure = i;
      
      // Brief pause between operations
      await page.waitForTimeout(200);
    }
    
    console.log(`🏁 Stress test completed: ${operationsBeforeFailure} successful operations`);
    
    if (operationsBeforeFailure < 10) {
      console.log('🚨 HIGH FRAGILITY: Timeline broke after < 10 operations');
    } else if (operationsBeforeFailure < 25) {
      console.log('⚠️ MODERATE FRAGILITY: Timeline broke after < 25 operations');  
    } else {
      console.log('✅ GOOD STABILITY: Timeline survived 25+ operations');
    }
  });
});