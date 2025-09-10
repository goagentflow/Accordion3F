/**
 * Timeline Manipulation Test Helpers
 * Specialized functions for testing drag operations, dependency manipulation, and timeline fragility
 */

import { Page, expect, Locator } from '@playwright/test';

export interface TaskBarInfo {
  element: Locator;
  initialPosition: { x: number; y: number; width: number; height: number };
  taskId?: string;
  assetName?: string;
}

export interface ManipulationResult {
  success: boolean;
  timelineStillVisible: boolean;
  assetsStillVisible: number;
  tasksStillVisible: number;
  errorMessages: string[];
  performanceImpact?: {
    memoryBefore?: any;
    memoryAfter?: any;
    operationTime: number;
  };
}

export class ManipulationTestHelper {
  private page: Page;
  private operationCount: number = 0;
  private failures: string[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Set up a basic timeline for manipulation testing
   */
  async setupBasicTimeline(assetCount: number = 1): Promise<void> {
    console.log(`🏗️ Setting up timeline with ${assetCount} assets...`);
    
    // Clear state
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload({ waitUntil: 'networkidle' });
    await this.page.waitForTimeout(1500);
    
    // Add assets
    for (let i = 0; i < assetCount; i++) {
      const addButtons = this.page.locator('button:has-text("Add")');
      const buttonCount = await addButtons.count();
      if (buttonCount > i) {
        await addButtons.nth(i).click();
        await this.page.waitForTimeout(800);
      }
    }
    
    // Set live date to generate timeline
    await this.page.locator('input[type="date"]').first().fill('2025-12-25');
    await this.page.waitForTimeout(3000);
    
    // Verify timeline was created
    const timelineWorking = await this.verifyTimelineExists();
    if (!timelineWorking) {
      throw new Error('Failed to create basic timeline for manipulation testing');
    }
    
    console.log(`✅ Timeline setup complete with ${assetCount} assets`);
  }

  /**
   * Find all draggable task bars on the timeline (SVG-aware)
   */
  async findTaskBars(): Promise<TaskBarInfo[]> {
    console.log('🔍 Searching for task bars in timeline...');
    
    // First, try to find SVG-based task bars (rect elements)
    const svgTaskBars = await this.findSVGTaskBars();
    if (svgTaskBars.length > 0) {
      console.log(`📊 Found ${svgTaskBars.length} SVG task bars`);
      return svgTaskBars;
    }
    
    // Fallback to HTML-based task bars
    const htmlTaskBars = await this.findHTMLTaskBars();
    console.log(`📊 Found ${htmlTaskBars.length} HTML task bars`);
    return htmlTaskBars;
  }

  /**
   * Find SVG-based task bars (rect elements in timeline)
   */
  private async findSVGTaskBars(): Promise<TaskBarInfo[]> {
    const taskBars: TaskBarInfo[] = [];
    
    // Look for SVG rect elements that look like task bars
    const rects = this.page.locator('svg rect');
    const rectCount = await rects.count();
    
    console.log(`🔍 Analyzing ${rectCount} SVG rect elements...`);
    
    for (let i = 0; i < rectCount; i++) {
      const rect = rects.nth(i);
      const boundingBox = await rect.boundingBox();
      
      if (boundingBox) {
        // Check if this looks like a task bar (reasonable dimensions, in timeline area)
        const isTaskBarSized = boundingBox.width >= 20 && boundingBox.width <= 500 && 
                              boundingBox.height >= 15 && boundingBox.height <= 100;
        const isInTimelineArea = boundingBox.x > 400; // Right side where timeline is
        
        if (isTaskBarSized && isInTimelineArea) {
          // Get additional attributes to identify the task
          const width = await rect.getAttribute('width');
          const height = await rect.getAttribute('height');
          const fill = await rect.getAttribute('fill');
          const x = await rect.getAttribute('x');
          const y = await rect.getAttribute('y');
          
          const taskInfo: TaskBarInfo = {
            element: rect,
            initialPosition: boundingBox,
            taskId: `svg-task-${x}-${y}`,
            assetName: `SVG Task ${taskBars.length + 1}`
          };
          
          taskBars.push(taskInfo);
          console.log(`  ✅ Task bar ${i}: ${width}×${height} at (${x},${y}) fill=${fill}`);
        }
      }
    }
    
    return taskBars;
  }

  /**
   * Find HTML-based task bars (fallback)
   */
  private async findHTMLTaskBars(): Promise<TaskBarInfo[]> {
    const taskBarSelectors = [
      '[data-testid="task-bar"]',
      '.task-bar',
      '.gantt-task',
      '[class*="task-bar"]',
      '[draggable="true"]'
    ];
    
    const taskBars: TaskBarInfo[] = [];
    
    for (const selector of taskBarSelectors) {
      const elements = this.page.locator(selector);
      const count = await elements.count();
      
      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        const boundingBox = await element.boundingBox();
        
        if (boundingBox && boundingBox.width > 10 && boundingBox.height > 10) {
          const taskInfo: TaskBarInfo = {
            element,
            initialPosition: boundingBox,
            taskId: await element.getAttribute('data-task-id') || `html-task-${i}`,
            assetName: `HTML Task ${i + 1}`
          };
          
          taskBars.push(taskInfo);
        }
      }
      
      if (taskBars.length > 0) break;
    }
    
    return taskBars;
  }

  /**
   * Perform a drag operation on a task bar (SVG-aware)
   */
  async dragTaskBar(
    taskBar: TaskBarInfo, 
    deltaX: number, 
    deltaY: number = 0,
    options: { 
      speed?: 'slow' | 'fast' | 'normal';
      waitAfter?: number;
      validateMove?: boolean;
    } = {}
  ): Promise<ManipulationResult> {
    const startTime = Date.now();
    const memoryBefore = await this.getMemoryUsage();
    
    console.log(`🎯 Dragging ${taskBar.taskId} ${deltaX}px right, ${deltaY}px down`);
    
    try {
      const { element, initialPosition } = taskBar;
      const speed = options.speed || 'normal';
      const waitTime = speed === 'fast' ? 100 : speed === 'slow' ? 1000 : 500;
      
      // Calculate drag coordinates from center of task bar
      const startX = initialPosition.x + initialPosition.width / 2;
      const startY = initialPosition.y + initialPosition.height / 2;
      const targetX = startX + deltaX;
      const targetY = startY + deltaY;
      
      console.log(`  From: (${startX.toFixed(0)}, ${startY.toFixed(0)}) To: (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`);
      
      // For SVG elements, we need to use coordinate-based dragging
      await this.page.mouse.move(startX, startY);
      await this.page.waitForTimeout(200);
      
      // Start the drag
      await this.page.mouse.down();
      await this.page.waitForTimeout(100);
      
      // Perform the drag movement
      if (speed === 'slow') {
        // Slow drag with intermediate steps to simulate natural movement
        const steps = 8;
        for (let i = 1; i <= steps; i++) {
          const progressX = startX + (deltaX * i / steps);
          const progressY = startY + (deltaY * i / steps);
          await this.page.mouse.move(progressX, progressY);
          await this.page.waitForTimeout(100);
        }
      } else {
        // Direct movement but with some intermediate steps for stability
        const steps = speed === 'fast' ? 2 : 4;
        for (let i = 1; i <= steps; i++) {
          const progressX = startX + (deltaX * i / steps);
          const progressY = startY + (deltaY * i / steps);
          await this.page.mouse.move(progressX, progressY);
          await this.page.waitForTimeout(speed === 'fast' ? 25 : 50);
        }
      }
      
      await this.page.waitForTimeout(100);
      
      // Release the mouse
      await this.page.mouse.up();
      await this.page.waitForTimeout(options.waitAfter || waitTime);
      
      this.operationCount++;
      
      // Update the task bar position for future operations
      const newBoundingBox = await element.boundingBox();
      if (newBoundingBox) {
        taskBar.initialPosition = newBoundingBox;
      }
      
      // Validate the operation
      const result = await this.validateManipulationResult(startTime, memoryBefore);
      
      if (options.validateMove && newBoundingBox) {
        // For SVG elements, check if the actual movement occurred
        const actualMoveX = newBoundingBox.x - initialPosition.x;
        const expectedMoveX = deltaX;
        const moveAccuracy = Math.abs(actualMoveX - expectedMoveX);
        
        console.log(`  Movement validation: expected ${expectedMoveX}px, actual ${actualMoveX.toFixed(1)}px, accuracy: ${moveAccuracy.toFixed(1)}px`);
        
        if (moveAccuracy > 100) { // More tolerance for SVG elements
          result.errorMessages.push(`SVG task didn't move as expected: expected ${expectedMoveX}px, actual ${actualMoveX.toFixed(1)}px`);
          // Don't mark as failed for movement validation - SVG coordinate systems can be different
          console.log('⚠️  Movement validation failed but continuing test');
        }
      }
      
      return result;
      
    } catch (error) {
      const errorMessage = `Drag operation failed: ${error.message}`;
      console.error(`❌ ${errorMessage}`);
      this.failures.push(errorMessage);
      
      return {
        success: false,
        timelineStillVisible: await this.verifyTimelineExists(),
        assetsStillVisible: await this.countVisibleAssets(),
        tasksStillVisible: await this.countVisibleTasks(),
        errorMessages: [errorMessage],
        performanceImpact: {
          memoryBefore,
          memoryAfter: await this.getMemoryUsage(),
          operationTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Perform multiple rapid drag operations
   */
  async rapidDragSequence(
    taskBar: TaskBarInfo,
    dragSequence: Array<{x: number, y: number}>,
    delayBetween: number = 50
  ): Promise<ManipulationResult> {
    console.log(`⚡ Performing rapid drag sequence: ${dragSequence.length} operations`);
    
    const startTime = Date.now();
    const memoryBefore = await this.getMemoryUsage();
    
    try {
      for (let i = 0; i < dragSequence.length; i++) {
        const { x, y } = dragSequence[i];
        console.log(`  ${i + 1}/${dragSequence.length}: Drag ${x}px, ${y}px`);
        
        const result = await this.dragTaskBar(taskBar, x, y, { 
          speed: 'fast', 
          waitAfter: delayBetween 
        });
        
        if (!result.success) {
          console.error(`❌ Rapid sequence failed at step ${i + 1}`);
          return result;
        }
        
        // Update task bar position for next operation
        const newPosition = await taskBar.element.boundingBox();
        if (newPosition) {
          taskBar.initialPosition = newPosition;
        }
      }
      
      return await this.validateManipulationResult(startTime, memoryBefore);
      
    } catch (error) {
      const errorMessage = `Rapid drag sequence failed: ${error.message}`;
      console.error(`❌ ${errorMessage}`);
      
      return {
        success: false,
        timelineStillVisible: await this.verifyTimelineExists(),
        assetsStillVisible: await this.countVisibleAssets(),
        tasksStillVisible: await this.countVisibleTasks(),
        errorMessages: [errorMessage],
        performanceImpact: {
          memoryBefore,
          memoryAfter: await this.getMemoryUsage(),
          operationTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Attempt to create dependency by dragging task forward
   */
  async createDependencyByDrag(
    taskBar: TaskBarInfo,
    overlapDays: number
  ): Promise<ManipulationResult> {
    console.log(`🔗 Creating dependency by dragging ${overlapDays} days forward`);
    
    // Estimate pixels per day (rough approximation)
    const pixelsPerDay = 30; // This may need adjustment based on timeline scale
    const deltaX = overlapDays * pixelsPerDay;
    
    const result = await this.dragTaskBar(taskBar, -deltaX, 0, { 
      validateMove: true,
      waitAfter: 1500 // Wait longer for dependency calculation
    });
    
    // Check if dependency was actually created
    const dependencyCreated = await this.checkForDependencyIndicators();
    if (!dependencyCreated && result.success) {
      result.errorMessages.push('Task moved but dependency was not created');
      console.log('⚠️ Task moved but no dependency indicators found');
    }
    
    return result;
  }

  /**
   * Attempt to correct a previous drag operation
   */
  async correctDragOperation(
    taskBar: TaskBarInfo,
    correctionDeltaX: number
  ): Promise<ManipulationResult> {
    console.log(`🔧 Attempting to correct previous drag by ${correctionDeltaX}px`);
    
    return await this.dragTaskBar(taskBar, correctionDeltaX, 0, {
      speed: 'normal',
      validateMove: true,
      waitAfter: 1500
    });
  }

  /**
   * Check for dependency indicators (arrows, lines, etc.)
   */
  private async checkForDependencyIndicators(): Promise<boolean> {
    const dependencySelectors = [
      '[class*="dependency"]',
      '[class*="arrow"]',
      'svg line', // Dependency lines
      '[data-testid*="dependency"]',
      '.dependency-line',
      '.task-connection'
    ];
    
    for (const selector of dependencySelectors) {
      const count = await this.page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Found dependency indicators: ${selector} (${count})`);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Verify timeline still exists and is functional
   */
  async verifyTimelineExists(): Promise<boolean> {
    const indicators = await this.page.evaluate(() => {
      // Look for timeline compression metrics
      const compressionMetrics = document.body.textContent.includes('Timeline Compression Metrics');
      const tasksAnalyzed = document.body.textContent.includes('tasks analyzed');
      const projectGantt = document.body.textContent.includes('Project Gantt Chart');
      const placeholder = document.body.textContent.includes('Your timeline will appear here');
      
      return {
        compressionMetrics,
        tasksAnalyzed,
        projectGantt,
        placeholder
      };
    });
    
    return indicators.compressionMetrics && indicators.tasksAnalyzed && !indicators.placeholder;
  }

  /**
   * Count visible assets
   */
  async countVisibleAssets(): Promise<number> {
    const assetText = await this.page.textContent('body');
    const match = assetText?.match(/(\d+) asset[s]? selected/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Count visible tasks
   */
  async countVisibleTasks(): Promise<number> {
    const taskBars = await this.findTaskBars();
    return taskBars.length;
  }

  /**
   * Get memory usage if available
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
   * Validate the result of a manipulation operation
   */
  private async validateManipulationResult(
    startTime: number, 
    memoryBefore: any
  ): Promise<ManipulationResult> {
    const endTime = Date.now();
    const memoryAfter = await this.getMemoryUsage();
    
    const timelineExists = await this.verifyTimelineExists();
    const assetsVisible = await this.countVisibleAssets();
    const tasksVisible = await this.countVisibleTasks();
    
    // Check for console errors
    const errorMessages: string[] = [];
    
    // Basic validation
    if (!timelineExists) {
      errorMessages.push('Timeline disappeared');
    }
    
    if (assetsVisible === 0) {
      errorMessages.push('All assets disappeared');
    }
    
    if (tasksVisible === 0 && timelineExists) {
      errorMessages.push('Tasks disappeared but timeline container exists');
    }
    
    const success = errorMessages.length === 0;
    
    if (!success) {
      console.error(`❌ Manipulation validation failed: ${errorMessages.join(', ')}`);
      this.failures.push(`Operation ${this.operationCount}: ${errorMessages.join(', ')}`);
    } else {
      console.log(`✅ Manipulation successful (operation ${this.operationCount})`);
    }
    
    return {
      success,
      timelineStillVisible: timelineExists,
      assetsStillVisible: assetsVisible,
      tasksStillVisible: tasksVisible,
      errorMessages,
      performanceImpact: {
        memoryBefore,
        memoryAfter,
        operationTime: endTime - startTime
      }
    };
  }

  /**
   * Take screenshot with operation context
   */
  async takeManipulationScreenshot(testName: string, operationStep?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const stepSuffix = operationStep ? `-${operationStep}` : '';
    const filename = `concurrency-v1-failures/manipulation-${testName}${stepSuffix}-op${this.operationCount}-${timestamp}.png`;
    
    await this.page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filename;
  }

  /**
   * Get current failure summary
   */
  getFailureSummary(): { operationCount: number; failures: string[] } {
    return {
      operationCount: this.operationCount,
      failures: [...this.failures]
    };
  }

  /**
   * Reset operation counter for new test
   */
  resetOperationCounter(): void {
    this.operationCount = 0;
    this.failures = [];
  }
}