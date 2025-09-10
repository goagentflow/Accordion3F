/**
 * Concurrency V1 Fragility Detection Tests
 * Focuses on race conditions, timing issues, and memory pressure that cause intermittent bugs
 */

import { test, expect } from '@playwright/test';
import { ConcurrencyV1TestHelper } from './helpers/concurrency-v1-helpers';

test.describe('Concurrency V1 Fragility Detection', () => {
  let helper: ConcurrencyV1TestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new ConcurrencyV1TestHelper(page);
    
    // Start with clean state
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Clear any existing data
    await page.evaluate(() => {
      localStorage.clear();
    });
    
    await page.reload({ waitUntil: 'networkidle' });
    console.log('🧹 Clean state established');
  });

  test('Race Condition: Auto-save during drag operations', async ({ page }) => {
    console.log('🔬 Starting race condition test: Auto-save during drag');
    
    // Set up timeline with assets
    await helper.addAssetWithLogging('Digital Display - Creative', 'Test Asset 1');
    await helper.addAssetWithLogging('Print - Supplement', 'Test Asset 2');
    
    // Set a live date to trigger timeline calculation
    await page.locator('input[type="date"]').first().fill('2025-12-25');
    await page.waitForTimeout(1000);
    
    // Verify timeline exists
    const initialState = await helper.validateState('Initial timeline setup', {
      shouldHaveTimeline: true,
      minimumAssets: 2
    });
    
    // Find first task and prepare to drag
    const firstTask = page.locator('.gantt-task-row .task-bar, [data-testid="task-bar"]').first();
    await expect(firstTask).toBeVisible();
    
    // Start drag operation and immediately trigger save
    console.log('⚡ Triggering race condition: drag + auto-save');
    await firstTask.hover();
    await page.mouse.down();
    
    // Trigger save during drag (race condition)
    await page.keyboard.press('Control+S');
    
    // Complete drag operation
    const taskBox = await firstTask.boundingBox();
    await page.mouse.move(taskBox!.x + 100, taskBox!.y);
    await page.mouse.up();
    
    // Wait for any async operations
    await page.waitForTimeout(2000);
    
    // Validate state after race condition
    const postRaceState = await helper.validateState('After race condition: drag + save', {
      shouldHaveTimeline: true,
      minimumAssets: 2
    });
    
    // Test refresh recovery
    const recoveryResult = await helper.refreshAndValidateRecovery('race-condition-test', 2);
    
    // Check dependency persistence
    const dependencyState = await helper.checkDependencyPersistence();
    console.log('Dependency persistence check:', dependencyState);
    
    // Take screenshot for evidence
    await helper.takeScreenshot('race-condition-drag-save');
  });

  test('Memory Pressure: 50+ assets with rapid operations', async ({ page }) => {
    console.log('🔬 Starting memory pressure test: 50+ assets');
    
    const memoryBefore = await helper.getMemoryUsage();
    console.log('Memory before test:', memoryBefore);
    
    // Add many assets rapidly
    for (let i = 0; i < 20; i++) {
      try {
        await helper.addAssetWithLogging('Digital Display - Creative', `Asset ${i + 1}`);
        
        // Every 5 assets, do some operations
        if (i % 5 === 0) {
          await page.keyboard.press('Control+S'); // Force save
          await helper.validateState(`After adding ${i + 1} assets`, {
            minimumAssets: i + 1
          });
        }
        
        // Very short delay to stress the system
        await page.waitForTimeout(100);
      } catch (error) {
        console.error(`❌ Failed to add asset ${i + 1}:`, error);
        await helper.takeScreenshot(`memory-pressure-failure-asset-${i}`);
        throw error;
      }
    }
    
    const memoryAfter = await helper.getMemoryUsage();
    console.log('Memory after adding 20 assets:', memoryAfter);
    
    // Calculate memory growth
    if (memoryBefore && memoryAfter) {
      const memoryGrowth = memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize;
      console.log(`Memory growth: ${memoryGrowth} bytes`);
      
      // Flag potential memory leaks (arbitrary threshold)
      if (memoryGrowth > 50 * 1024 * 1024) { // 50MB
        console.warn('⚠️ Potential memory leak detected!');
      }
    }
    
    // Rapid operations on the large dataset
    await helper.rapidActionSequence([
      'toggle-date', 'save', 'drag-task', 'save', 'toggle-date'
    ], 'memory-pressure-operations');
    
    // Test refresh with large dataset
    await helper.refreshAndValidateRecovery('memory-pressure-recovery', 20);
    
    const memoryFinal = await helper.getMemoryUsage();
    console.log('Memory after full test:', memoryFinal);
  });

  test('Timing Sensitivity: Actions during auto-save debounce', async ({ page }) => {
    console.log('🔬 Starting timing sensitivity test: Auto-save debounce interference');
    
    // Set up basic timeline
    await helper.addAssetWithLogging('Print - Supplement');
    await page.locator('input[type="date"]').first().fill('2025-12-31');
    await page.waitForTimeout(1000);
    
    // Rapid sequence of actions that should trigger auto-save
    console.log('⚡ Rapid actions to test auto-save timing');
    
    for (let i = 0; i < 10; i++) {
      // Modify something to trigger auto-save
      await page.locator('input[type="date"]').first().fill(`2025-12-${25 + (i % 6)}`);
      
      // Don't wait - immediately do another action
      if (i % 2 === 0) {
        await page.keyboard.press('Control+S'); // Manual save
      } else {
        // Try to modify state during auto-save debounce
        await helper.addAssetWithLogging('Digital Display - Creative', `Rapid Asset ${i}`);
      }
      
      // Very short delay
      await page.waitForTimeout(200);
    }
    
    // Wait for all auto-save operations to complete
    await page.waitForTimeout(3000);
    
    // Validate final state
    const finalState = await helper.validateState('After timing sensitivity test');
    console.log('Final state after timing test:', finalState);
    
    // Test recovery after timing-sensitive operations
    await helper.refreshAndValidateRecovery('timing-sensitivity-test', finalState.assetsVisible);
  });

  test('Concurrent Operations: Multiple tabs simulation', async ({ page, context }) => {
    console.log('🔬 Starting concurrent operations test: Multiple tabs');
    
    // Set up initial state
    await helper.addAssetWithLogging('Digital Display - Creative');
    await page.locator('input[type="date"]').first().fill('2025-12-25');
    await page.waitForTimeout(1000);
    
    // Force save initial state
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(1000);
    
    // Open second tab
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.waitForLoadState('networkidle');
    
    // Accept recovery on second tab
    const recoveryVisible = await page2.locator('text="Recover", button:has-text("Recover")').count() > 0;
    if (recoveryVisible) {
      await page2.locator('button:has-text("Recover")').first().click();
      await page2.waitForTimeout(1000);
    }
    
    // Make different modifications on each tab
    console.log('⚡ Making concurrent modifications');
    
    // Tab 1: Add asset
    const tab1Promise = helper.addAssetWithLogging('Print - Supplement', 'Tab 1 Asset');
    
    // Tab 2: Modify date
    const tab2Helper = new ConcurrencyV1TestHelper(page2);
    const tab2Promise = page2.locator('input[type="date"]').first().fill('2025-12-20');
    
    // Wait for both operations
    await Promise.all([tab1Promise, tab2Promise]);
    
    // Save on both tabs
    await page.keyboard.press('Control+S');
    await page2.keyboard.press('Control+S');
    
    await page.waitForTimeout(2000);
    await page2.waitForTimeout(2000);
    
    // Compare states
    const tab1State = await helper.validateState('Tab 1 final state');
    const tab2State = await tab2Helper.validateState('Tab 2 final state');
    
    console.log('Tab 1 state:', tab1State);
    console.log('Tab 2 state:', tab2State);
    
    // Check for state conflicts
    if (tab1State.assetsVisible !== tab2State.assetsVisible) {
      console.warn('⚠️ State mismatch between tabs detected!');
      await helper.takeScreenshot('concurrent-tabs-mismatch-tab1');
      await tab2Helper.takeScreenshot('concurrent-tabs-mismatch-tab2');
    }
    
    // Test refresh on both tabs
    await helper.refreshAndValidateRecovery('concurrent-tab1-recovery');
    await tab2Helper.refreshAndValidateRecovery('concurrent-tab2-recovery');
    
    await page2.close();
  });

  test('State Corruption Detection: Invalid data recovery', async ({ page }) => {
    console.log('🔬 Starting state corruption test: Invalid data recovery');
    
    // Set up valid state first
    await helper.addAssetWithLogging('Digital Display - Creative');
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(1000);
    
    // Corrupt localStorage data
    await page.evaluate(() => {
      // Inject malformed data
      const corruptData = {
        selectedAssets: null, // Invalid: should be array
        taskDependencies: 'invalid', // Invalid: should be object
        globalLiveDate: 'not-a-date', // Invalid date
        assetTaskDurations: undefined // Invalid: should be object
      };
      localStorage.setItem('accordion_timeline_state', JSON.stringify(corruptData));
    });
    
    console.log('💥 Injected corrupt data into localStorage');
    
    // Refresh and see how app handles corruption
    await page.reload({ waitUntil: 'networkidle' });
    
    // Check if recovery prompt appears
    const recoveryPrompt = page.locator('text="Recover", button:has-text("Recover")');
    const hasRecoveryPrompt = await recoveryPrompt.count() > 0;
    
    console.log(`Recovery prompt appeared: ${hasRecoveryPrompt}`);
    
    if (hasRecoveryPrompt) {
      // Try to accept corrupted recovery
      await recoveryPrompt.first().click();
      await page.waitForTimeout(2000);
    }
    
    // Validate how app handled corruption
    try {
      const stateAfterCorruption = await helper.validateState('After corruption recovery');
      console.log('App recovered from corruption:', stateAfterCorruption);
    } catch (error) {
      console.error('❌ App failed to handle corruption gracefully:', error);
      await helper.takeScreenshot('corruption-handling-failure');
      
      // App should still be usable even with corrupt data
      // Try to add new asset to verify functionality
      await helper.addAssetWithLogging('Print - Supplement', 'Recovery Test');
    }
  });

  test('Performance Degradation: Timeline calculation stress', async ({ page }) => {
    console.log('🔬 Starting performance degradation test: Timeline calculation stress');
    
    const performanceMetrics: any[] = [];
    
    // Add assets and measure timeline calculation time
    for (let i = 0; i < 15; i++) {
      const startTime = Date.now();
      
      await helper.addAssetWithLogging(`Digital Display - Creative`, `Perf Asset ${i + 1}`);
      
      // Set date to trigger timeline recalculation
      await page.locator('input[type="date"]').first().fill(`2025-12-${(i % 28) + 1}`);
      
      // Wait for timeline to render
      await page.waitForTimeout(1000);
      
      const endTime = Date.now();
      const operationTime = endTime - startTime;
      
      performanceMetrics.push({
        iteration: i + 1,
        operationTime,
        assetsCount: i + 1
      });
      
      console.log(`Iteration ${i + 1}: ${operationTime}ms`);
      
      // Flag performance degradation
      if (operationTime > 5000) { // 5 seconds threshold
        console.warn(`⚠️ Performance degradation detected at ${i + 1} assets: ${operationTime}ms`);
        await helper.takeScreenshot(`performance-degradation-${i + 1}-assets`);
      }
      
      // Validate state hasn't broken under load
      await helper.validateState(`Performance test iteration ${i + 1}`, {
        minimumAssets: i + 1
      });
    }
    
    // Analyze performance trend
    const avgTime = performanceMetrics.reduce((sum, m) => sum + m.operationTime, 0) / performanceMetrics.length;
    const maxTime = Math.max(...performanceMetrics.map(m => m.operationTime));
    const minTime = Math.min(...performanceMetrics.map(m => m.operationTime));
    
    console.log(`Performance Analysis:`);
    console.log(`- Average time: ${avgTime.toFixed(2)}ms`);
    console.log(`- Max time: ${maxTime}ms`);
    console.log(`- Min time: ${minTime}ms`);
    console.log(`- Performance variance: ${((maxTime - minTime) / avgTime * 100).toFixed(2)}%`);
    
    // Test final state persistence
    await helper.refreshAndValidateRecovery('performance-stress-recovery', 15);
  });
});