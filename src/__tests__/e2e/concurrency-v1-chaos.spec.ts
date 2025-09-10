/**
 * Concurrency V1 Chaos Testing Suite
 * Random action sequences, rapid user interactions, and edge case combinations
 * Designed to find non-deterministic bugs through exploratory testing
 */

import { test, expect } from '@playwright/test';
import { ConcurrencyV1TestHelper } from './helpers/concurrency-v1-helpers';

test.describe('Concurrency V1 Chaos Testing', () => {
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
    console.log('🧹 Clean state established for chaos testing');
  });

  test('Chaos Test 1: 1000 Random Actions', async ({ page }) => {
    console.log('🌪️ Starting Chaos Test 1: 1000 Random Actions');
    
    const actions = [
      'add-digital-asset',
      'add-print-asset', 
      'add-radio-asset',
      'change-date',
      'toggle-global-date',
      'save-manual',
      'drag-task',
      'delete-asset',
      'rename-asset',
      'add-custom-task',
      'rapid-click',
      'keyboard-shortcut'
    ];
    
    let successfulActions = 0;
    let failedActions = 0;
    const failureLog: string[] = [];
    
    for (let i = 0; i < 1000; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      const actionId = `${i + 1}-${action}`;
      
      try {
        console.log(`[${i + 1}/1000] Random action: ${action}`);
        
        await this.executeRandomAction(page, helper, action);
        successfulActions++;
        
        // Periodic state validation (every 50 actions)
        if (i % 50 === 49) {
          await helper.validateState(`Chaos checkpoint ${i + 1}`);
          console.log(`✅ Checkpoint ${i + 1}: ${successfulActions} success, ${failedActions} failed`);
        }
        
        // Very short delay to stress the system
        await page.waitForTimeout(Math.random() * 100 + 10);
        
      } catch (error) {
        failedActions++;
        const errorMsg = `Action ${actionId} failed: ${error.message}`;
        failureLog.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
        
        // Take screenshot on failure
        await helper.takeScreenshot(`chaos-failure-${actionId}`);
        
        // Don't let single failure stop the chaos test
        try {
          await helper.validateState(`After failed action ${actionId}`);
        } catch (stateError) {
          console.error(`💥 CRITICAL: State invalid after ${actionId}: ${stateError.message}`);
          throw new Error(`CHAOS TEST CRITICAL FAILURE at action ${actionId}: ${stateError.message}`);
        }
      }
    }
    
    // Final analysis
    console.log(`🌪️ Chaos Test 1 Complete:`);
    console.log(`- Successful actions: ${successfulActions}/1000`);
    console.log(`- Failed actions: ${failedActions}/1000`);
    console.log(`- Success rate: ${(successfulActions / 1000 * 100).toFixed(2)}%`);
    
    if (failureLog.length > 0) {
      console.log('Failure summary:', failureLog.slice(0, 10)); // Show first 10 failures
    }
    
    // Final state validation
    const finalState = await helper.validateState('Chaos Test 1 final state');
    console.log('Final state after 1000 random actions:', finalState);
    
    // Test recovery after chaos
    await helper.refreshAndValidateRecovery('chaos-test-1-recovery');
  });

  test('Chaos Test 2: Rapid Fire UI Interactions', async ({ page }) => {
    console.log('🌪️ Starting Chaos Test 2: Rapid Fire UI Interactions');
    
    // Set up some initial state to work with
    await helper.addAssetWithLogging('Digital Display - Creative', 'Chaos Asset 1');
    await helper.addAssetWithLogging('Print - Supplement', 'Chaos Asset 2');
    await page.locator('input[type="date"]').first().fill('2025-12-25');
    await page.waitForTimeout(1000);
    
    // Rapid fire sequence of UI interactions
    const rapidSequences = [
      // Sequence 1: Button mashing
      async () => {
        console.log('⚡ Sequence 1: Button mashing');
        for (let i = 0; i < 50; i++) {
          try {
            const buttons = page.locator('button:visible');
            const count = await buttons.count();
            if (count > 0) {
              const randomButton = buttons.nth(Math.floor(Math.random() * count));
              await randomButton.click({ timeout: 100 });
            }
          } catch (e) {
            // Expected - some buttons might not be clickable
          }
        }
      },
      
      // Sequence 2: Input field chaos
      async () => {
        console.log('⚡ Sequence 2: Input field chaos');
        const inputs = page.locator('input:visible');
        const inputCount = await inputs.count();
        
        for (let i = 0; i < 30; i++) {
          if (inputCount > 0) {
            try {
              const randomInput = inputs.nth(Math.floor(Math.random() * inputCount));
              const inputType = await randomInput.getAttribute('type') || 'text';
              
              if (inputType === 'date') {
                await randomInput.fill(`2025-12-${Math.floor(Math.random() * 28) + 1}`);
              } else if (inputType === 'text') {
                await randomInput.fill(`chaos-text-${Math.random().toString(36).substring(7)}`);
              } else if (inputType === 'number') {
                await randomInput.fill(Math.floor(Math.random() * 100).toString());
              }
            } catch (e) {
              // Expected - some inputs might be readonly or have validation
            }
          }
        }
      },
      
      // Sequence 3: Mouse chaos
      async () => {
        console.log('⚡ Sequence 3: Mouse chaos');
        for (let i = 0; i < 25; i++) {
          const x = Math.random() * 1200;
          const y = Math.random() * 800;
          
          try {
            await page.mouse.move(x, y);
            if (Math.random() > 0.7) {
              await page.mouse.click(x, y);
            }
            if (Math.random() > 0.9) {
              await page.mouse.down();
              await page.mouse.move(x + Math.random() * 100, y + Math.random() * 100);
              await page.mouse.up();
            }
          } catch (e) {
            // Expected - random coordinates might hit invalid areas
          }
        }
      },
      
      // Sequence 4: Keyboard chaos
      async () => {
        console.log('⚡ Sequence 4: Keyboard chaos');
        const keys = ['Tab', 'Enter', 'Escape', 'Space', 'ArrowUp', 'ArrowDown', 'Delete', 'Backspace'];
        
        for (let i = 0; i < 40; i++) {
          try {
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            await page.keyboard.press(randomKey, { timeout: 100 });
          } catch (e) {
            // Expected - some key combinations might not work
          }
        }
      }
    ];
    
    // Execute all rapid sequences
    for (let i = 0; i < rapidSequences.length; i++) {
      await rapidSequences[i]();
      await page.waitForTimeout(500); // Brief pause between sequences
      await helper.validateState(`After rapid sequence ${i + 1}`);
    }
    
    // Final validation after all chaos
    await helper.validateState('After all rapid fire interactions');
    await helper.refreshAndValidateRecovery('rapid-fire-recovery', 2);
  });

  test('Chaos Test 3: Edge Case Combinations', async ({ page }) => {
    console.log('🌪️ Starting Chaos Test 3: Edge Case Combinations');
    
    // Test problematic sequences that might cause bugs
    const edgeCaseSequences = [
      {
        name: 'Add-Delete-Undo-Redo Chain',
        actions: async () => {
          await helper.addAssetWithLogging('Digital Display - Creative', 'Edge Case 1');
          await page.locator('button:has-text("Delete"), .delete-btn').first().click({ timeout: 5000 });
          await page.keyboard.press('Control+Z'); // Undo
          await page.keyboard.press('Control+Y'); // Redo
          await helper.addAssetWithLogging('Print - Supplement', 'Edge Case 2');
        }
      },
      
      {
        name: 'Rapid Date Changes During Save',
        actions: async () => {
          await helper.addAssetWithLogging('Radio - Spot', 'Date Edge Case');
          
          // Trigger save and immediately change dates
          await page.keyboard.press('Control+S');
          for (let i = 0; i < 10; i++) {
            await page.locator('input[type="date"]').first().fill(`2025-12-${15 + i}`);
            await page.waitForTimeout(50);
          }
        }
      },
      
      {
        name: 'Multi-Asset Drag Operations',
        actions: async () => {
          await helper.addAssetWithLogging('Digital Display - Creative', 'Drag Test 1');
          await helper.addAssetWithLogging('Print - Supplement', 'Drag Test 2');
          await page.locator('input[type="date"]').first().fill('2025-12-31');
          await page.waitForTimeout(2000);
          
          // Try to drag multiple tasks rapidly
          const tasks = page.locator('.gantt-task-row .task-bar, [data-testid="task-bar"]');
          const taskCount = await tasks.count();
          
          for (let i = 0; i < Math.min(3, taskCount); i++) {
            try {
              await helper.dragTaskWithLogging(`.gantt-task-row:nth-child(${i + 1}) .task-bar`, 60, `multi-drag-${i}`);
            } catch (e) {
              console.log(`Drag ${i} failed: ${e.message}`);
            }
          }
        }
      },
      
      {
        name: 'Storage Corruption During Operations',
        actions: async () => {
          await helper.addAssetWithLogging('Digital Display - Creative', 'Corruption Test');
          
          // Corrupt storage during operation
          await page.evaluate(() => {
            localStorage.setItem('accordion_timeline_state', '{ corrupted data');
          });
          
          // Try to continue operations
          await page.keyboard.press('Control+S');
          await helper.addAssetWithLogging('Print - Supplement', 'After Corruption');
        }
      },
      
      {
        name: 'Refresh During Active Drag',
        actions: async () => {
          await helper.addAssetWithLogging('Radio - Spot', 'Refresh Test');
          await page.locator('input[type="date"]').first().fill('2025-12-25');
          await page.waitForTimeout(1500);
          
          const task = page.locator('.gantt-task-row .task-bar').first();
          if (await task.count() > 0) {
            await task.hover();
            await page.mouse.down();
            
            // Refresh while dragging
            await page.reload({ waitUntil: 'networkidle' });
          }
        }
      }
    ];
    
    for (const sequence of edgeCaseSequences) {
      console.log(`🧪 Testing edge case: ${sequence.name}`);
      
      try {
        await sequence.actions();
        await helper.validateState(`After edge case: ${sequence.name}`);
        console.log(`✅ Edge case survived: ${sequence.name}`);
      } catch (error) {
        console.error(`❌ Edge case failed: ${sequence.name} - ${error.message}`);
        await helper.takeScreenshot(`edge-case-failure-${sequence.name.replace(/\s+/g, '-')}`);
        
        // Try to recover and continue
        try {
          await page.reload({ waitUntil: 'networkidle' });
          await helper.validateState(`Recovery after ${sequence.name}`);
        } catch (recoveryError) {
          console.error(`💥 CRITICAL: Cannot recover from ${sequence.name}: ${recoveryError.message}`);
        }
      }
    }
  });

  test('Chaos Test 4: Stress Pattern Detection', async ({ page }) => {
    console.log('🌪️ Starting Chaos Test 4: Stress Pattern Detection');
    
    // Known problematic patterns from manual testing
    const stressPatterns = [
      {
        name: 'Rapid Asset Addition with Date Changes',
        execute: async () => {
          for (let i = 0; i < 15; i++) {
            await helper.addAssetWithLogging('Digital Display - Creative', `Stress ${i}`);
            await page.locator('input[type="date"]').first().fill(`2025-12-${(i % 28) + 1}`);
            await page.waitForTimeout(200);
          }
        }
      },
      
      {
        name: 'Save-Refresh-Recover Loops',
        execute: async () => {
          await helper.addAssetWithLogging('Print - Supplement', 'Loop Test');
          
          for (let i = 0; i < 10; i++) {
            await page.keyboard.press('Control+S');
            await page.waitForTimeout(300);
            await page.reload({ waitUntil: 'networkidle' });
            
            // Handle recovery prompt
            const hasRecovery = await page.locator('button:has-text("Recover")').count() > 0;
            if (hasRecovery) {
              await page.locator('button:has-text("Recover")').first().click();
              await page.waitForTimeout(500);
            }
          }
        }
      },
      
      {
        name: 'Concurrent Drag and State Changes',
        execute: async () => {
          await helper.addAssetWithLogging('Digital Display - Creative', 'Concurrent Test');
          await helper.addAssetWithLogging('Radio - Spot', 'Concurrent Test 2');
          await page.locator('input[type="date"]').first().fill('2025-12-25');
          await page.waitForTimeout(2000);
          
          // Start drag operation
          const task = page.locator('.gantt-task-row .task-bar').first();
          if (await task.count() > 0) {
            await task.hover();
            await page.mouse.down();
            
            // Change state during drag
            await page.locator('input[type="checkbox"]').first().click(); // Toggle global date
            await page.locator('input[type="date"]').first().fill('2025-12-20');
            
            // Complete drag
            const taskBox = await task.boundingBox();
            await page.mouse.move(taskBox!.x + 80, taskBox!.y);
            await page.mouse.up();
          }
        }
      }
    ];
    
    for (const pattern of stressPatterns) {
      console.log(`🔍 Testing stress pattern: ${pattern.name}`);
      
      const startTime = Date.now();
      const memoryBefore = await helper.getMemoryUsage();
      
      try {
        await pattern.execute();
        
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        const memoryAfter = await helper.getMemoryUsage();
        
        console.log(`Pattern ${pattern.name} completed in ${executionTime}ms`);
        
        if (memoryBefore && memoryAfter) {
          const memoryGrowth = memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize;
          console.log(`Memory impact: ${memoryGrowth} bytes`);
        }
        
        await helper.validateState(`After stress pattern: ${pattern.name}`);
        console.log(`✅ Stress pattern survived: ${pattern.name}`);
        
      } catch (error) {
        console.error(`❌ Stress pattern failed: ${pattern.name} - ${error.message}`);
        await helper.takeScreenshot(`stress-pattern-failure-${pattern.name.replace(/\s+/g, '-')}`);
        
        // Critical failure - this pattern breaks the app
        throw new Error(`CRITICAL STRESS PATTERN FAILURE: ${pattern.name} - ${error.message}`);
      }
    }
    
    // Final recovery test after all stress patterns
    await helper.refreshAndValidateRecovery('stress-pattern-final-recovery');
  });

});

// Helper method for random actions
async function executeRandomAction(page: any, helper: ConcurrencyV1TestHelper, action: string) {
    const assetTypes = ['Digital Display - Creative', 'Print - Supplement', 'Radio - Spot'];
    
    switch (action) {
      case 'add-digital-asset':
        await helper.addAssetWithLogging('Digital Display - Creative', `Random-${Math.random().toString(36).substring(7)}`);
        break;
        
      case 'add-print-asset':
        await helper.addAssetWithLogging('Print - Supplement', `Random-${Math.random().toString(36).substring(7)}`);
        break;
        
      case 'add-radio-asset':
        await helper.addAssetWithLogging('Radio - Spot', `Random-${Math.random().toString(36).substring(7)}`);
        break;
        
      case 'change-date':
        const randomDay = Math.floor(Math.random() * 28) + 1;
        await page.locator('input[type="date"]').first().fill(`2025-12-${randomDay.toString().padStart(2, '0')}`);
        break;
        
      case 'toggle-global-date':
        const checkbox = page.locator('input[type="checkbox"]').first();
        if (await checkbox.count() > 0) {
          await checkbox.click();
        }
        break;
        
      case 'save-manual':
        await page.keyboard.press('Control+S');
        break;
        
      case 'drag-task':
        const tasks = page.locator('.gantt-task-row .task-bar, [data-testid="task-bar"]');
        const taskCount = await tasks.count();
        if (taskCount > 0) {
          const randomTask = tasks.nth(Math.floor(Math.random() * taskCount));
          await randomTask.hover();
          
          const taskBox = await randomTask.boundingBox();
          if (taskBox) {
            await page.mouse.down();
            await page.mouse.move(taskBox.x + Math.random() * 100 - 50, taskBox.y);
            await page.mouse.up();
          }
        }
        break;
        
      case 'delete-asset':
        const deleteButtons = page.locator('button:has-text("Delete"), .delete-btn');
        const deleteCount = await deleteButtons.count();
        if (deleteCount > 0) {
          await deleteButtons.first().click();
        }
        break;
        
      case 'rename-asset':
        const nameInputs = page.locator('input[placeholder*="name"], input[data-testid*="name"]');
        const nameCount = await nameInputs.count();
        if (nameCount > 0) {
          await nameInputs.first().fill(`Renamed-${Math.random().toString(36).substring(7)}`);
        }
        break;
        
      case 'rapid-click':
        const x = Math.random() * 800 + 100;
        const y = Math.random() * 600 + 100;
        for (let i = 0; i < 5; i++) {
          await page.mouse.click(x, y, { timeout: 50 });
        }
        break;
        
      case 'keyboard-shortcut':
        const shortcuts = ['Control+S', 'Control+Z', 'Control+Y', 'Tab', 'Enter', 'Escape'];
        const randomShortcut = shortcuts[Math.floor(Math.random() * shortcuts.length)];
        await page.keyboard.press(randomShortcut);
        break;
        
      default:
        console.log(`Unknown random action: ${action}`);
    }
}