/**
 * Timeline Manipulation Patterns Tests
 * Tests based on real user behavior patterns that commonly trigger bugs
 * Focuses on specific user workflows and decision patterns
 */

import { test, expect } from '@playwright/test';
import { ManipulationTestHelper } from './helpers/manipulation-helpers';

test.describe('Timeline Manipulation Patterns - User Behavior Simulation', () => {
  let helper: ManipulationTestHelper;

  test.beforeEach(async ({ page }) => {
    helper = new ManipulationTestHelper(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('🧹 Starting manipulation patterns test');
  });

  test('The Perfectionist Pattern - Keep Adjusting Until Perfect', async ({ page }) => {
    console.log('🎯 Simulating perfectionist user behavior');
    
    await helper.setupBasicTimeline(1);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) return;
    
    const targetTask = taskBars[0];
    
    // Perfectionist scenario: User keeps making small adjustments
    const perfectionistAdjustments = [
      { move: 40, thought: 'Move it forward a bit' },
      { move: -10, thought: 'Too far, back up slightly' },
      { move: 5, thought: 'Just a tiny bit more' },
      { move: -3, thought: 'Actually, back a little' },
      { move: 15, thought: 'No, definitely forward' },
      { move: -8, thought: 'Hmm, maybe not that much' },
      { move: 2, thought: 'Fine adjustment' },
      { move: -1, thought: 'Perfect... well, maybe one more' },
      { move: 20, thought: 'Actually, what if I moved it here' },
      { move: -25, thought: 'No, that was wrong, go back' },
      { move: 12, thought: 'Let me try this position' },
      { move: -7, thought: 'Close, but not quite' },
      { move: 3, thought: 'There, that should be it' },
      { move: -1, thought: 'One final micro-adjustment' }
    ];
    
    console.log(`📋 Simulating ${perfectionistAdjustments.length} perfectionist adjustments`);
    
    for (let i = 0; i < perfectionistAdjustments.length; i++) {
      const adjustment = perfectionistAdjustments[i];
      console.log(`  ${i + 1}: "${adjustment.thought}" (${adjustment.move > 0 ? '+' : ''}${adjustment.move}px)`);
      
      const result = await helper.dragTaskBar(targetTask, adjustment.move, 0, {
        speed: 'normal',
        waitAfter: 300 // Perfectionist takes time to think
      });
      
      if (!result.success) {
        console.log(`💥 Perfectionist pattern broke timeline at adjustment ${i + 1}`);
        console.log(`Breaking thought: "${adjustment.thought}"`);
        await helper.takeManipulationScreenshot(`perfectionist-broke-${i + 1}`);
        
        console.log('Perfectionist failure analysis:', {
          adjustmentNumber: i + 1,
          breakingMove: adjustment.move,
          breakingThought: adjustment.thought,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible
        });
        
        return; // Test complete - found breaking point
      }
      
      // Update position for next adjustment
      const newPosition = await targetTask.element.boundingBox();
      if (newPosition) {
        targetTask.initialPosition = newPosition;
      }
    }
    
    console.log('✅ Timeline survived perfectionist pattern!');
    await helper.takeManipulationScreenshot('perfectionist-completed');
  });

  test('The Panic Corrector Pattern - Rapid Mistake Corrections', async ({ page }) => {
    console.log('😰 Simulating panic correction behavior');
    
    await helper.setupBasicTimeline(2);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 2) return;
    
    const [taskA, taskB] = taskBars;
    
    // Panic scenario: User makes mistake, panics, tries to fix it quickly
    console.log('📋 Step 1: User makes initial "mistake"');
    let result = await helper.dragTaskBar(taskB, 80, 0); // Big move
    
    if (!result.success) {
      console.log('❌ Failed at initial mistake creation');
      return;
    }
    
    console.log('📋 Step 2: User realizes mistake, starts panicking');
    await page.waitForTimeout(200); // Brief "oh no" moment
    
    // Rapid panic corrections
    const panicCorrections = [
      { move: -40, speed: 'fast', delay: 100, thought: 'Quick! Move it back!' },
      { move: -20, speed: 'fast', delay: 50, thought: 'Not enough!' },
      { move: -30, speed: 'fast', delay: 100, thought: 'Too far back!' },
      { move: 25, speed: 'fast', delay: 80, thought: 'Forward again!' },
      { move: -15, speed: 'fast', delay: 60, thought: 'No wait!' },
      { move: 10, speed: 'fast', delay: 150, thought: 'Let me think...' },
      { move: -5, speed: 'fast', delay: 40, thought: 'Just a bit...' },
      { move: 20, speed: 'fast', delay: 70, thought: 'Maybe here?' },
      { move: -35, speed: 'fast', delay: 30, thought: 'No, definitely not!' }
    ];
    
    for (let i = 0; i < panicCorrections.length; i++) {
      const correction = panicCorrections[i];
      console.log(`  Panic ${i + 1}: "${correction.thought}" (${correction.move}px)`);
      
      result = await helper.dragTaskBar(taskB, correction.move, 0, {
        speed: correction.speed as any,
        waitAfter: correction.delay
      });
      
      if (!result.success) {
        console.log(`💥 Panic pattern broke timeline at correction ${i + 1}`);
        console.log(`Panic thought: "${correction.thought}"`);
        await helper.takeManipulationScreenshot(`panic-correction-broke-${i + 1}`);
        
        console.log('Panic failure analysis:', {
          panicStep: i + 1,
          panicThought: correction.thought,
          rapidMove: correction.move,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible
        });
        
        return;
      }
      
      // Update position for next panic move
      const newPosition = await taskB.element.boundingBox();
      if (newPosition) {
        taskB.initialPosition = newPosition;
      }
    }
    
    console.log('✅ Timeline survived panic correction pattern!');
    await helper.takeManipulationScreenshot('panic-correction-survived');
  });

  test('The Indecisive User Pattern - Constant Back and Forth', async ({ page }) => {
    console.log('🤔 Simulating indecisive user behavior');
    
    await helper.setupBasicTimeline(2);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 2) return;
    
    const targetTask = taskBars[1];
    
    // Indecisive pattern: User constantly changes their mind
    const indecisivePattern = [
      { move: 50, thought: 'Let me move this forward...' },
      { move: -50, thought: 'Actually, I liked it where it was' },
      { move: 30, thought: 'But maybe just a little forward' },
      { move: -40, thought: 'No, back is better' },
      { move: 60, thought: 'What about way forward?' },
      { move: -70, thought: 'Too much, go back further' },
      { move: 20, thought: 'Just a small amount forward' },
      { move: -15, thought: 'Hmm, maybe not' },
      { move: 45, thought: 'Let me try the forward position again' },
      { move: -55, thought: 'I keep changing my mind' },
      { move: 35, thought: 'One more try forward' },
      { move: -25, thought: 'Actually, I think back' },
      { move: 15, thought: 'Or maybe just slightly forward' },
      { move: -20, thought: 'You know what, back' },
      { move: 40, thought: 'Final decision: forward!' },
      { move: -40, thought: 'Wait, I changed my mind again' }
    ];
    
    console.log(`📋 Simulating ${indecisivePattern.length} indecisive decisions`);
    
    for (let i = 0; i < indecisivePattern.length; i++) {
      const decision = indecisivePattern[i];
      console.log(`  Decision ${i + 1}: "${decision.thought}" (${decision.move > 0 ? '+' : ''}${decision.move}px)`);
      
      const result = await helper.dragTaskBar(targetTask, decision.move, 0, {
        speed: 'normal',
        waitAfter: 400 // Indecisive user pauses to think
      });
      
      if (!result.success) {
        console.log(`💥 Indecisive pattern broke timeline at decision ${i + 1}`);
        console.log(`Breaking decision: "${decision.thought}"`);
        await helper.takeManipulationScreenshot(`indecisive-broke-${i + 1}`);
        
        console.log('Indecisive failure analysis:', {
          decisionNumber: i + 1,
          breakingThought: decision.thought,
          finalMove: decision.move,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible
        });
        
        return;
      }
      
      // Update position for next indecisive move
      const newPosition = await targetTask.element.boundingBox();
      if (newPosition) {
        targetTask.initialPosition = newPosition;
      }
    }
    
    console.log('✅ Timeline survived indecisive pattern!');
    await helper.takeManipulationScreenshot('indecisive-pattern-completed');
  });

  test('The Multi-Asset Juggler Pattern - Switching Between Assets', async ({ page }) => {
    console.log('🤹 Simulating multi-asset juggling behavior');
    
    await helper.setupBasicTimeline(3);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 3) {
      console.log('⚠️ Need at least 3 assets for juggling pattern');
      return;
    }
    
    // Juggling pattern: User rapidly switches focus between different assets
    const jugglingSequence = [
      { asset: 0, move: 30, thought: 'Adjust Asset A forward' },
      { asset: 1, move: -20, thought: 'Now Asset B needs to go back' },
      { asset: 2, move: 40, thought: 'Asset C should be forward' },
      { asset: 0, move: -15, thought: 'Wait, Asset A was too far' },
      { asset: 1, move: 25, thought: 'Asset B actually needs to be forward' },
      { asset: 2, move: -10, thought: 'Asset C back a little' },
      { asset: 0, move: 20, thought: 'Asset A forward again' },
      { asset: 1, move: -30, thought: 'Asset B way back' },
      { asset: 2, move: 15, thought: 'Asset C just a bit forward' },
      { asset: 0, move: -25, thought: 'Asset A back to where it was' },
      { asset: 1, move: 35, thought: 'Asset B forward more than before' },
      { asset: 2, move: -40, thought: 'Asset C way back now' },
      { asset: 0, move: 10, thought: 'Asset A fine tuning' },
      { asset: 1, move: -5, thought: 'Asset B tiny adjustment' },
      { asset: 2, move: 20, thought: 'Asset C back forward' }
    ];
    
    console.log(`📋 Simulating ${jugglingSequence.length} asset juggling moves`);
    
    for (let i = 0; i < jugglingSequence.length; i++) {
      const move = jugglingSequence[i];
      const targetTask = taskBars[move.asset];
      
      console.log(`  Juggle ${i + 1}: "${move.thought}" (${move.move > 0 ? '+' : ''}${move.move}px)`);
      
      const result = await helper.dragTaskBar(targetTask, move.move, 0, {
        speed: 'fast', // Juggler works quickly
        waitAfter: 150
      });
      
      if (!result.success) {
        console.log(`💥 Juggling pattern broke timeline at move ${i + 1}`);
        console.log(`Breaking move: "${move.thought}" on Asset ${move.asset}`);
        await helper.takeManipulationScreenshot(`juggling-broke-${i + 1}`);
        
        console.log('Juggling failure analysis:', {
          jugglingStep: i + 1,
          targetAsset: move.asset,
          jugglingThought: move.thought,
          moveAmount: move.move,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible
        });
        
        return;
      }
      
      // Update position for next juggling move
      const newPosition = await targetTask.element.boundingBox();
      if (newPosition) {
        targetTask.initialPosition = newPosition;
      }
    }
    
    console.log('✅ Timeline survived multi-asset juggling pattern!');
    await helper.takeManipulationScreenshot('juggling-pattern-completed');
  });

  test('The Explorer Pattern - Testing Timeline Limits', async ({ page }) => {
    console.log('🧭 Simulating explorer user behavior - testing limits');
    
    await helper.setupBasicTimeline(1);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length === 0) return;
    
    const targetTask = taskBars[0];
    
    // Explorer pattern: User explores what's possible, pushes boundaries
    const explorationSteps = [
      { move: 200, thought: 'What happens if I drag way to the right?' },
      { move: -400, thought: 'How about way to the left?' },
      { move: 300, thought: 'Can I go even further right?' },
      { move: -500, thought: 'What about the extreme left?' },
      { move: 250, thought: 'Back towards the center-right' },
      { move: -100, thought: 'A bit more left from there' },
      { move: 600, thought: 'What if I go really far right?' },
      { move: -800, thought: 'And then really far left?' },
      { move: 400, thought: 'Can it handle these big jumps?' },
      { move: -200, thought: 'How about back and forth?' },
      { move: 100, thought: 'Smaller movements now' },
      { move: -50, thought: 'Testing normal range' },
      { move: 1000, thought: 'One final extreme test!' },
      { move: -1000, thought: 'All the way back!' }
    ];
    
    console.log(`📋 Simulating ${explorationSteps.length} boundary exploration moves`);
    
    for (let i = 0; i < explorationSteps.length; i++) {
      const step = explorationSteps[i];
      console.log(`  Explore ${i + 1}: "${step.thought}" (${step.move > 0 ? '+' : ''}${step.move}px)`);
      
      const result = await helper.dragTaskBar(targetTask, step.move, 0, {
        speed: 'normal',
        waitAfter: 500, // Explorer takes time to observe results
        validateMove: true // Important for boundary testing
      });
      
      if (!result.success) {
        console.log(`💥 Explorer pattern broke timeline at exploration ${i + 1}`);
        console.log(`Breaking exploration: "${step.thought}"`);
        await helper.takeManipulationScreenshot(`explorer-broke-${i + 1}`);
        
        console.log('Explorer failure analysis:', {
          explorationStep: i + 1,
          explorationMove: step.move,
          explorationThought: step.thought,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible,
          errors: result.errorMessages
        });
        
        // Check if this was a boundary violation
        const boundaryError = result.errorMessages.some(err => 
          err.includes("didn't move as expected") || 
          err.includes("boundary") || 
          err.includes("limit")
        );
        
        if (boundaryError) {
          console.log('🎯 Boundary violation detected - this may be expected behavior');
        }
        
        return;
      }
      
      // Update position for next exploration
      const newPosition = await targetTask.element.boundingBox();
      if (newPosition) {
        targetTask.initialPosition = newPosition;
      }
    }
    
    console.log('✅ Timeline survived boundary exploration pattern!');
    await helper.takeManipulationScreenshot('explorer-pattern-completed');
  });

  test('The Speed Demon Pattern - Maximum Speed Operations', async ({ page }) => {
    console.log('💨 Simulating speed demon user behavior');
    
    await helper.setupBasicTimeline(2);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 2) return;
    
    // Speed demon: User works as fast as possible, no waiting
    console.log('📋 Speed demon: Rapid fire operations with minimal delays');
    
    const speedOperations = [
      { task: 0, move: 40 },
      { task: 1, move: -30 },
      { task: 0, move: -20 },
      { task: 1, move: 50 },
      { task: 0, move: 25 },
      { task: 1, move: -15 },
      { task: 0, move: -35 },
      { task: 1, move: 20 },
      { task: 0, move: 10 },
      { task: 1, move: -40 },
      { task: 0, move: 30 },
      { task: 1, move: -10 },
      { task: 0, move: -25 },
      { task: 1, move: 45 },
      { task: 0, move: -15 }
    ];
    
    for (let i = 0; i < speedOperations.length; i++) {
      const op = speedOperations[i];
      const targetTask = taskBars[op.task];
      
      console.log(`  Speed ${i + 1}: Task ${op.task} by ${op.move}px`);
      
      const result = await helper.dragTaskBar(targetTask, op.move, 0, {
        speed: 'fast',
        waitAfter: 25 // Minimum delay - speed demon doesn't wait
      });
      
      if (!result.success) {
        console.log(`💥 Speed demon pattern broke timeline at operation ${i + 1}`);
        await helper.takeManipulationScreenshot(`speed-demon-broke-${i + 1}`);
        
        console.log('Speed demon failure analysis:', {
          speedStep: i + 1,
          targetTask: op.task,
          speedMove: op.move,
          timeline: result.timelineStillVisible,
          assets: result.assetsStillVisible,
          tasks: result.tasksStillVisible
        });
        
        return;
      }
      
      // Update position for next speed operation
      const newPosition = await targetTask.element.boundingBox();
      if (newPosition) {
        targetTask.initialPosition = newPosition;
      }
    }
    
    console.log('✅ Timeline survived speed demon pattern!');
    await helper.takeManipulationScreenshot('speed-demon-completed');
  });

  test('The Real User Combination - Mixed Patterns', async ({ page }) => {
    console.log('👤 Simulating realistic combination of user patterns');
    
    await helper.setupBasicTimeline(2);
    const taskBars = await helper.findTaskBars();
    
    if (taskBars.length < 2) return;
    
    // Real users combine different patterns in the same session
    console.log('📋 Phase 1: Start carefully (normal user)');
    let result = await helper.dragTaskBar(taskBars[0], 30, 0, { speed: 'normal', waitAfter: 500 });
    if (!result.success) {
      await helper.takeManipulationScreenshot('real-user-phase1-failed');
      return;
    }
    
    console.log('📋 Phase 2: Get confident (speed up)');
    for (let i = 0; i < 3; i++) {
      result = await helper.dragTaskBar(taskBars[1], (i + 1) * 15, 0, { speed: 'fast', waitAfter: 200 });
      if (!result.success) {
        await helper.takeManipulationScreenshot(`real-user-phase2-failed-${i}`);
        return;
      }
    }
    
    console.log('📋 Phase 3: Make mistake, panic correct');
    result = await helper.dragTaskBar(taskBars[0], 100, 0); // Big mistake
    if (result.success) {
      result = await helper.dragTaskBar(taskBars[0], -60, 0, { speed: 'fast', waitAfter: 50 }); // Panic correction
      if (result.success) {
        result = await helper.dragTaskBar(taskBars[0], -20, 0, { speed: 'fast', waitAfter: 30 }); // More panic
      }
    }
    
    if (!result.success) {
      console.log('💥 Real user pattern broke during panic correction phase');
      await helper.takeManipulationScreenshot('real-user-panic-failed');
      return;
    }
    
    console.log('📋 Phase 4: Become perfectionist');
    const perfectionist = [3, -1, 2, -1, 1];
    for (let i = 0; i < perfectionist.length; i++) {
      result = await helper.dragTaskBar(taskBars[1], perfectionist[i], 0, { speed: 'normal', waitAfter: 300 });
      if (!result.success) {
        await helper.takeManipulationScreenshot(`real-user-perfectionist-failed-${i}`);
        return;
      }
    }
    
    console.log('📋 Phase 5: Final exploration');
    result = await helper.dragTaskBar(taskBars[0], 200, 0, { validateMove: true });
    if (result.success) {
      result = await helper.dragTaskBar(taskBars[0], -180, 0, { validateMove: true });
    }
    
    if (!result.success) {
      console.log('💥 Real user pattern broke during exploration phase');
      await helper.takeManipulationScreenshot('real-user-exploration-failed');
      return;
    }
    
    console.log('✅ Timeline survived realistic mixed user patterns!');
    await helper.takeManipulationScreenshot('real-user-pattern-completed');
    
    const summary = helper.getFailureSummary();
    console.log(`Real user session: ${summary.operationCount} total operations across all patterns`);
  });
});