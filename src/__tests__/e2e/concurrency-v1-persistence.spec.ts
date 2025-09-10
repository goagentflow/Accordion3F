/**
 * Concurrency V1 State Persistence Tests  
 * Focuses on save/reload bugs, dependency persistence, and data integrity across sessions
 */

import { test, expect } from '@playwright/test';
import { ConcurrencyV1TestHelper } from './helpers/concurrency-v1-helpers';

test.describe('Concurrency V1 State Persistence', () => {
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
    console.log('🧹 Clean state established for persistence tests');
  });

  test('Dependency Persistence: Drag-to-move across refresh cycles', async ({ page }) => {
    console.log('💾 Starting dependency persistence test: Drag-to-move');
    
    // Create timeline with multiple tasks
    await helper.addAssetWithLogging('Digital Display - Creative', 'Asset A');
    await helper.addAssetWithLogging('Print - Supplement', 'Asset B');
    
    // Set live date to generate tasks
    await page.locator('input[type="date"]').first().fill('2025-12-25');
    await page.waitForTimeout(2000);
    
    // Verify initial timeline
    const initialState = await helper.validateState('Initial timeline for dependency test', {
      shouldHaveTimeline: true,
      minimumAssets: 2
    });
    
    console.log(`Initial state: ${initialState.tasksVisible} tasks, ${initialState.assetsVisible} assets`);
    
    // Perform drag operation to create dependency
    console.log('🎯 Creating dependency via drag operation...');
    
    const taskElements = page.locator('.gantt-task-row .task-bar, [data-testid="task-bar"]');
    const taskCount = await taskElements.count();
    console.log(`Found ${taskCount} tasks for drag operation`);
    
    if (taskCount > 0) {
      const firstTask = taskElements.first();
      await firstTask.hover();
      
      const taskBox = await firstTask.boundingBox();
      if (taskBox) {
        // Drag task forward to create overlap
        await page.mouse.down({ button: 'left' });
        await page.mouse.move(taskBox.x + 80, taskBox.y); // Drag forward
        await page.mouse.up();
        
        console.log('✅ Drag operation completed');
        await page.waitForTimeout(1500); // Wait for dependency creation
      }
    }
    
    // Force save
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(1000);
    
    // Check dependency persistence in localStorage
    const dependencyStateBefore = await helper.checkDependencyPersistence();
    console.log('Dependencies before refresh:', dependencyStateBefore);
    
    // Capture state before refresh
    const stateBeforeRefresh = await helper.validateState('Before dependency persistence refresh');
    
    // === CRITICAL TEST: Refresh and check dependency persistence ===
    console.log('🔄 Refreshing to test dependency persistence...');
    const recoveryResult = await helper.refreshAndValidateRecovery('dependency-persistence', stateBeforeRefresh.assetsVisible);
    
    // Check dependencies after refresh
    const dependencyStateAfter = await helper.checkDependencyPersistence();
    console.log('Dependencies after refresh:', dependencyStateAfter);
    
    // Validate state after refresh
    const stateAfterRefresh = await helper.validateState('After dependency persistence refresh', {
      shouldHaveTimeline: true,
      minimumAssets: stateBeforeRefresh.assetsVisible
    });
    
    // Compare states
    console.log('📊 State Comparison:');
    console.log(`- Before: ${stateBeforeRefresh.tasksVisible} tasks, ${stateBeforeRefresh.assetsVisible} assets`);
    console.log(`- After: ${stateAfterRefresh.tasksVisible} tasks, ${stateAfterRefresh.assetsVisible} assets`);
    
    // CRITICAL BUG CHECK: Dependencies should persist
    if (dependencyStateBefore?.hasDependencies && !dependencyStateAfter?.hasDependencies) {
      console.error('❌ CRITICAL BUG: Dependencies lost after refresh!');
      await helper.takeScreenshot('dependency-persistence-failure');
      throw new Error('DEPENDENCY PERSISTENCE FAILURE: Dependencies were lost after page refresh');
    }
    
    // Test multiple refresh cycles
    for (let i = 0; i < 3; i++) {
      console.log(`🔄 Refresh cycle ${i + 1}/3`);
      await helper.refreshAndValidateRecovery(`dependency-cycle-${i + 1}`, stateAfterRefresh.assetsVisible);
      
      const cycleState = await helper.validateState(`Refresh cycle ${i + 1}`);
      if (cycleState.assetsVisible !== stateAfterRefresh.assetsVisible) {
        console.error(`❌ State degradation in cycle ${i + 1}`);
        await helper.takeScreenshot(`state-degradation-cycle-${i + 1}`);
      }
    }
  });

  test('Partial Save Scenarios: Interrupted save operations', async ({ page }) => {
    console.log('💾 Starting partial save test: Interrupted operations');
    
    // Set up complex state
    await helper.addAssetWithLogging('Digital Display - Creative');
    await helper.addAssetWithLogging('Print - Supplement');
    await helper.addAssetWithLogging('Radio - Spot');
    
    await page.locator('input[type="date"]').first().fill('2025-12-31');
    await page.waitForTimeout(1500);
    
    // Make multiple rapid changes without waiting for save completion
    console.log('⚡ Making rapid changes to trigger partial save scenarios...');
    
    for (let i = 0; i < 10; i++) {
      // Change date rapidly
      await page.locator('input[type="date"]').first().fill(`2025-12-${20 + (i % 10)}`);
      
      // Immediately start another operation
      if (i % 2 === 0) {
        // Try to add asset during auto-save
        try {
          await helper.addAssetWithLogging('Print - Supplement', `Rapid ${i}`);
        } catch (error) {
          console.log(`Expected error during rapid operations: ${error.message}`);
        }
      } else {
        // Try manual save during auto-save
        await page.keyboard.press('Control+S');
      }
      
      // Very short delay to create race conditions
      await page.waitForTimeout(150);
    }
    
    // Let all operations complete
    await page.waitForTimeout(3000);
    
    const finalState = await helper.validateState('After partial save test');
    console.log('Final state after partial save test:', finalState);
    
    // Test recovery after partial save scenarios
    await helper.refreshAndValidateRecovery('partial-save-recovery', finalState.assetsVisible);
  });

  test('Storage Corruption: Malformed data recovery', async ({ page }) => {
    console.log('💾 Starting storage corruption test: Malformed data');
    
    // Create valid baseline state
    await helper.addAssetWithLogging('Digital Display - Creative');
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(1000);
    
    // Test various corruption scenarios
    const corruptionScenarios = [
      {
        name: 'Invalid JSON',
        data: '{ invalid json'
      },
      {
        name: 'Missing required fields',
        data: JSON.stringify({ someField: 'value' })
      },
      {
        name: 'Wrong data types',
        data: JSON.stringify({
          selectedAssets: 'should be array',
          taskDependencies: null,
          globalLiveDate: 123456
        })
      },
      {
        name: 'Circular references',
        data: (() => {
          const obj: any = { a: {} };
          obj.a.circular = obj;
          try {
            return JSON.stringify(obj);
          } catch (e) {
            return '{"error": "circular"}';
          }
        })()
      }
    ];
    
    for (const scenario of corruptionScenarios) {
      console.log(`🧪 Testing corruption scenario: ${scenario.name}`);
      
      // Inject corrupted data
      await page.evaluate((data) => {
        localStorage.setItem('accordion_timeline_state', data);
      }, scenario.data);
      
      // Refresh and test recovery
      await page.reload({ waitUntil: 'networkidle' });
      
      try {
        // Check if app handles corruption gracefully
        const hasRecoveryPrompt = await page.locator('text="Recover", button:has-text("Recover")').count() > 0;
        
        if (hasRecoveryPrompt) {
          console.log('Recovery prompt appeared for corrupted data');
          await page.locator('button:has-text("Recover")').first().click();
          await page.waitForTimeout(1000);
        }
        
        // App should still be functional
        await helper.validateState(`After ${scenario.name} corruption`);
        
        // Try to use app normally
        await helper.addAssetWithLogging('Print - Supplement', `Recovery ${scenario.name}`);
        
      } catch (error) {
        console.error(`❌ App failed to handle corruption: ${scenario.name}`, error);
        await helper.takeScreenshot(`corruption-failure-${scenario.name.replace(/\s+/g, '-')}`);
        // Continue with other scenarios
      }
    }
  });

  test('Multi-tab Data Sync: Concurrent modifications', async ({ page, context }) => {
    console.log('💾 Starting multi-tab sync test: Concurrent modifications');
    
    // Set up initial state
    await helper.addAssetWithLogging('Digital Display - Creative', 'Sync Test Asset');
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(1000);
    
    // Open second tab
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.waitForLoadState('networkidle');
    
    const helper2 = new ConcurrencyV1TestHelper(page2);
    
    // Accept recovery on second tab
    const hasRecovery = await page2.locator('button:has-text("Recover")').count() > 0;
    if (hasRecovery) {
      await page2.locator('button:has-text("Recover")').first().click();
      await page2.waitForTimeout(1000);
    }
    
    // Make conflicting changes
    console.log('⚡ Making conflicting changes on both tabs...');
    
    // Tab 1: Change date and add asset
    const tab1Changes = (async () => {
      await page.locator('input[type="date"]').first().fill('2025-12-25');
      await helper.addAssetWithLogging('Print - Supplement', 'Tab 1 Asset');
      await page.keyboard.press('Control+S');
    })();
    
    // Tab 2: Change date differently and add different asset
    const tab2Changes = (async () => {
      await page2.locator('input[type="date"]').first().fill('2025-12-20');
      await helper2.addAssetWithLogging('Radio - Spot', 'Tab 2 Asset');
      await page2.keyboard.press('Control+S');
    })();
    
    // Wait for both to complete
    await Promise.all([tab1Changes, tab2Changes]);
    await page.waitForTimeout(2000);
    
    // Compare final states
    const tab1State = await helper.validateState('Tab 1 after concurrent changes');
    const tab2State = await helper2.validateState('Tab 2 after concurrent changes');
    
    console.log('Tab 1 final state:', tab1State);
    console.log('Tab 2 final state:', tab2State);
    
    // Check for data conflicts
    if (tab1State.assetsVisible !== tab2State.assetsVisible) {
      console.warn('⚠️ Data sync conflict detected between tabs!');
      await helper.takeScreenshot('multi-tab-conflict-tab1');
      await helper2.takeScreenshot('multi-tab-conflict-tab2');
    }
    
    // Test what happens when both tabs refresh
    console.log('🔄 Refreshing both tabs to test conflict resolution...');
    
    const refresh1 = helper.refreshAndValidateRecovery('multi-tab-refresh-1');
    const refresh2 = helper2.refreshAndValidateRecovery('multi-tab-refresh-2');
    
    await Promise.all([refresh1, refresh2]);
    
    // Final state comparison
    const final1 = await helper.validateState('Tab 1 final after refresh');
    const final2 = await helper2.validateState('Tab 2 final after refresh');
    
    console.log('Final states after refresh:');
    console.log('Tab 1:', final1);
    console.log('Tab 2:', final2);
    
    await page2.close();
  });

  test('Large Dataset Persistence: 30+ assets with dependencies', async ({ page }) => {
    console.log('💾 Starting large dataset persistence test: 30+ assets');
    
    const targetAssets = 30;
    
    // Create large dataset
    console.log(`📊 Creating dataset with ${targetAssets} assets...`);
    for (let i = 0; i < targetAssets; i++) {
      const assetType = i % 3 === 0 ? 'Digital Display - Creative' : 
                       i % 3 === 1 ? 'Print - Supplement' : 'Radio - Spot';
      
      await helper.addAssetWithLogging(assetType, `Dataset Asset ${i + 1}`);
      
      // Periodic saves and validations
      if (i % 10 === 9) {
        console.log(`💾 Checkpoint save at ${i + 1} assets`);
        await page.keyboard.press('Control+S');
        await page.waitForTimeout(1000);
        
        await helper.validateState(`Checkpoint at ${i + 1} assets`, {
          minimumAssets: i + 1
        });
      }
      
      // Small delay to avoid overwhelming the system
      await page.waitForTimeout(100);
    }
    
    // Set live date to trigger timeline calculation
    console.log('📅 Setting live date for timeline generation...');
    await page.locator('input[type="date"]').first().fill('2025-12-31');
    await page.waitForTimeout(3000); // Allow time for large timeline calculation
    
    const largeDatasetState = await helper.validateState('Large dataset timeline', {
      minimumAssets: targetAssets
    });
    
    console.log(`Large dataset state: ${largeDatasetState.assetsVisible} assets, ${largeDatasetState.tasksVisible} tasks`);
    
    // Perform some drag operations to create dependencies
    const taskElements = page.locator('.gantt-task-row .task-bar, [data-testid="task-bar"]');
    const availableTasks = await taskElements.count();
    
    if (availableTasks > 5) {
      console.log('🎯 Creating dependencies on large dataset...');
      
      // Create multiple dependencies
      for (let i = 0; i < Math.min(5, availableTasks - 1); i++) {
        try {
          const task = taskElements.nth(i);
          await task.hover();
          
          const taskBox = await task.boundingBox();
          if (taskBox) {
            await page.mouse.down();
            await page.mouse.move(taskBox.x + 60, taskBox.y);
            await page.mouse.up();
            await page.waitForTimeout(500);
          }
        } catch (error) {
          console.log(`Could not create dependency ${i}: ${error.message}`);
        }
      }
    }
    
    // Force save large dataset
    console.log('💾 Saving large dataset with dependencies...');
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(2000);
    
    // Check storage size and dependency count
    const dependencyState = await helper.checkDependencyPersistence();
    console.log('Large dataset dependencies:', dependencyState);
    
    const storageSize = await page.evaluate(() => {
      const data = localStorage.getItem('accordion_timeline_state');
      return data ? data.length : 0;
    });
    console.log(`Storage size: ${storageSize} characters`);
    
    // === CRITICAL TEST: Can large dataset be recovered? ===
    console.log('🔄 Testing large dataset recovery...');
    
    const recoveryResult = await helper.refreshAndValidateRecovery('large-dataset-recovery', targetAssets);
    
    // Validate final state
    const recoveredState = await helper.validateState('After large dataset recovery', {
      minimumAssets: targetAssets
    });
    
    console.log(`Recovery result: ${recoveredState.assetsVisible} assets, ${recoveredState.tasksVisible} tasks`);
    
    // Check if dependencies survived
    const recoveredDependencies = await helper.checkDependencyPersistence();
    console.log('Recovered dependencies:', recoveredDependencies);
    
    if (dependencyState?.dependencyCount > 0 && recoveredDependencies?.dependencyCount === 0) {
      console.error('❌ CRITICAL BUG: Dependencies lost during large dataset recovery!');
      await helper.takeScreenshot('large-dataset-dependency-loss');
    }
  });

  test('Browser Storage Limits: Storage quota handling', async ({ page }) => {
    console.log('💾 Starting storage limits test: Quota handling');
    
    // Fill storage with large data
    console.log('📊 Testing storage quota limits...');
    
    try {
      await page.evaluate(() => {
        // Try to fill localStorage close to its limit
        const bigData = 'x'.repeat(1024 * 1024); // 1MB string
        let i = 0;
        
        try {
          while (i < 10) { // Try to store ~10MB
            localStorage.setItem(`big_data_${i}`, bigData);
            i++;
          }
        } catch (e) {
          console.log(`Hit storage limit at ${i}MB`);
        }
        
        return i;
      });
      
      // Now try to save timeline data
      await helper.addAssetWithLogging('Digital Display - Creative');
      await page.keyboard.press('Control+S');
      await page.waitForTimeout(1000);
      
      // Test if save worked despite storage pressure
      const saveState = await helper.checkDependencyPersistence();
      console.log('Save state under storage pressure:', saveState);
      
      // Clean up and test normal operation
      await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('big_data_')) {
            localStorage.removeItem(key);
          }
        });
      });
      
      // Test recovery after storage cleanup
      await helper.refreshAndValidateRecovery('storage-quota-recovery', 1);
      
    } catch (error) {
      console.log('Storage quota test completed with expected errors:', error.message);
    }
  });
});