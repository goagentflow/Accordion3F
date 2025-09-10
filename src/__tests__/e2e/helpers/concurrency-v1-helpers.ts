/**
 * Concurrency V1 Test Helpers
 * Common utilities for testing fragility and intermittent bugs
 */

import { Page, expect } from '@playwright/test';

export class ConcurrencyV1TestHelper {
  constructor(private page: Page) {}

  /**
   * Enhanced state validator with detailed logging
   */
  async validateState(testName: string, expectedState: any = {}) {
    console.log(`[${testName}] 🔍 Validating state at ${new Date().toISOString()}`);
    
    // Check if timeline is visible and populated
    const timelineExists = await this.page.locator('.gantt-container, [data-testid="gantt-chart"]').count() > 0;
    const assetsVisible = await this.page.locator('[data-testid="selected-assets"] .asset-item, .asset-selector .selected-asset').count();
    const tasksVisible = await this.page.locator('.gantt-task-row, [data-testid="task-row"]').count();

    console.log(`[${testName}] Timeline exists: ${timelineExists}, Assets: ${assetsVisible}, Tasks: ${tasksVisible}`);

    // Critical failure detection
    if (expectedState.shouldHaveTimeline !== false && tasksVisible === 0 && assetsVisible > 0) {
      throw new Error(`CRITICAL BUG: Timeline disappeared! Assets: ${assetsVisible}, Tasks: ${tasksVisible}`);
    }

    if (expectedState.shouldHaveAssets !== false && assetsVisible === 0 && expectedState.minimumAssets > 0) {
      throw new Error(`CRITICAL BUG: Assets disappeared! Expected: ${expectedState.minimumAssets}, Found: 0`);
    }

    return {
      timelineExists,
      assetsVisible,
      tasksVisible,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Add asset with comprehensive logging
   */
  async addAssetWithLogging(assetType: string, customName?: string) {
    console.log(`🎯 Adding asset: ${assetType}${customName ? ` (${customName})` : ''}`);
    
    try {
      // Look for the actual "Add" button next to the asset type
      const addButton = this.page.locator(`text="${assetType}" >> .. >> button:has-text("Add")`).first();
      
      // If that doesn't work, try a more generic approach
      if (await addButton.count() === 0) {
        // Find the row containing the asset type and click its Add button
        const assetRow = this.page.locator(`text="${assetType}"`).first().locator('..').locator('button:has-text("Add")');
        await assetRow.click();
      } else {
        await addButton.click();
      }
      
      // Wait for asset to be added to selected list
      await this.page.waitForTimeout(500);
      
      // If custom name is provided, try to edit the asset name
      if (customName) {
        const nameInput = this.page.locator('input[placeholder*="name"], input[data-testid="asset-name"], .asset-name input').first();
        if (await nameInput.count() > 0) {
          await nameInput.fill(customName);
        }
      }
      
    } catch (error) {
      console.log(`Failed to add asset with method 1, trying alternative method: ${error.message}`);
      
      // Alternative method - try clicking any Add button then select from list
      const anyAddButton = this.page.locator('button:has-text("Add")').first();
      await anyAddButton.click();
    }
    
    // Wait for UI to update
    await this.page.waitForTimeout(500);
    
    const state = await this.validateState(`After adding ${assetType}`, { 
      shouldHaveTimeline: true, 
      shouldHaveAssets: true,
      minimumAssets: 1
    });
    
    console.log(`✅ Asset added successfully: ${JSON.stringify(state)}`);
    return state;
  }

  /**
   * Drag task with enhanced error detection
   */
  async dragTaskWithLogging(taskSelector: string, pixelsX: number, testName: string) {
    console.log(`🎯 [${testName}] Dragging task: ${taskSelector} by ${pixelsX}px`);
    
    const stateBefore = await this.validateState(`Before ${testName} drag`);
    
    // Find the task element
    const taskElement = this.page.locator(taskSelector).first();
    await expect(taskElement).toBeVisible();
    
    // Get initial position
    const initialBox = await taskElement.boundingBox();
    console.log(`Initial position: ${JSON.stringify(initialBox)}`);
    
    // Perform drag operation
    await taskElement.hover();
    await this.page.mouse.down();
    await this.page.mouse.move(initialBox!.x + pixelsX, initialBox!.y);
    await this.page.mouse.up();
    
    // Wait for any animations or state updates
    await this.page.waitForTimeout(1000);
    
    const stateAfter = await this.validateState(`After ${testName} drag`, {
      shouldHaveTimeline: true,
      shouldHaveAssets: true,
      minimumAssets: stateBefore.assetsVisible
    });
    
    console.log(`✅ Drag completed: ${JSON.stringify(stateAfter)}`);
    return { before: stateBefore, after: stateAfter };
  }

  /**
   * Refresh page and validate recovery
   */
  async refreshAndValidateRecovery(testName: string, expectedAssets: number = 0) {
    console.log(`🔄 [${testName}] Refreshing page and checking recovery...`);
    
    await this.page.reload({ waitUntil: 'networkidle' });
    await this.page.waitForTimeout(2000); // Allow for recovery prompt
    
    // Check for recovery prompt
    const recoveryPromptVisible = await this.page.locator('text="Recover", text="Recovery", [data-testid="recovery-prompt"]').count() > 0;
    console.log(`Recovery prompt visible: ${recoveryPromptVisible}`);
    
    if (recoveryPromptVisible) {
      // Accept recovery
      await this.page.locator('button:has-text("Recover"), button:has-text("Accept"), button:has-text("Yes")').first().click();
      await this.page.waitForTimeout(1000);
      console.log(`✅ Accepted recovery prompt`);
    }
    
    const state = await this.validateState(`After ${testName} refresh/recovery`, {
      shouldHaveTimeline: expectedAssets > 0,
      shouldHaveAssets: expectedAssets > 0,
      minimumAssets: expectedAssets
    });
    
    return { recoveryPromptAppeared: recoveryPromptVisible, state };
  }

  /**
   * Simulate rapid actions to trigger race conditions
   */
  async rapidActionSequence(actions: string[], testName: string) {
    console.log(`⚡ [${testName}] Starting rapid action sequence: ${actions.join(' → ')}`);
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log(`[${i}/${actions.length}] Executing: ${action}`);
      
      try {
        await this.executeAction(action);
        await this.page.waitForTimeout(50); // Minimal delay to create race conditions
      } catch (error) {
        console.error(`❌ Action failed: ${action} - ${error}`);
        await this.validateState(`After failed action: ${action}`);
        throw error;
      }
    }
    
    // Final validation
    await this.validateState(`After rapid sequence: ${testName}`);
  }

  /**
   * Execute individual test actions
   */
  private async executeAction(action: string) {
    switch (action.toLowerCase()) {
      case 'add-asset':
        await this.addAssetWithLogging('Digital Display - Creative');
        break;
      case 'save':
        await this.page.keyboard.press('Control+S');
        break;
      case 'toggle-date':
        await this.page.locator('input[type="checkbox"]').first().click();
        break;
      case 'drag-task':
        const taskRow = this.page.locator('.gantt-task-row').first();
        if (await taskRow.count() > 0) {
          await this.dragTaskWithLogging('.gantt-task-row .task-bar', 50, 'rapid-drag');
        }
        break;
      case 'delete-asset':
        const deleteButton = this.page.locator('button:has-text("Delete"), .delete-asset-btn').first();
        if (await deleteButton.count() > 0) {
          await deleteButton.click();
        }
        break;
      default:
        console.warn(`Unknown action: ${action}`);
    }
  }

  /**
   * Monitor memory usage during test
   */
  async getMemoryUsage(): Promise<any> {
    return await this.page.evaluate(() => {
      const nav = (performance as any).memory;
      return nav ? {
        usedJSHeapSize: nav.usedJSHeapSize,
        totalJSHeapSize: nav.totalJSHeapSize,
        jsHeapSizeLimit: nav.jsHeapSizeLimit
      } : null;
    });
  }

  /**
   * Check localStorage for dependency data
   */
  async checkDependencyPersistence(): Promise<any> {
    return await this.page.evaluate(() => {
      const saved = localStorage.getItem('accordion_timeline_state');
      if (!saved) return null;
      
      try {
        const parsed = JSON.parse(saved);
        return {
          hasDependencies: !!parsed.taskDependencies,
          dependencyCount: parsed.taskDependencies ? Object.keys(parsed.taskDependencies).length : 0,
          fullState: parsed
        };
      } catch (e) {
        return { error: e.message };
      }
    });
  }

  /**
   * Take screenshot with timestamp
   */
  async takeScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `concurrency-v1-failures/${name}-${timestamp}.png`;
    await this.page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filename;
  }

  /**
   * Start video recording for bug capture
   */
  async startVideoRecording(testName: string) {
    // Playwright handles video automatically, but we can log it
    console.log(`🎥 Video recording active for: ${testName}`);
  }
}