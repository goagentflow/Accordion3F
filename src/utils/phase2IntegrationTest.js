/**
 * Phase 2 Integration Test Utilities
 * Tests that DAG calculator integration works end-to-end
 * 
 * Following Golden Rule #1: Safety First - Comprehensive testing before deployment
 * Following Golden Rule #4: Clear Roles - Focused testing utilities
 */

import { buildAssetTimeline } from '../services/TimelineCalculator';
import { TimelineActions } from '../actions/timelineActions';
import { validateDependency } from '../services/DependencyValidator';
import { enableDAGCalculatorOnly, isDebugMode, featureFlags } from '../config/features';

// ============================================
// Test Data
// ============================================

const createTestTasks = () => [
  {
    id: 'task-1',
    name: 'Design Phase',
    duration: 5,
    owner: 'm',
    assetId: 'asset-1',
    assetType: 'Website'
  },
  {
    id: 'task-2', 
    name: 'Development Phase',
    duration: 10,
    owner: 'c',
    assetId: 'asset-1',
    assetType: 'Website'
  },
  {
    id: 'task-3',
    name: 'Testing Phase', 
    duration: 3,
    owner: 'a',
    assetId: 'asset-1',
    assetType: 'Website'
  }
];

const createTestTasksWithDependencies = () => [
  {
    id: 'task-1',
    name: 'Design Phase',
    duration: 5,
    owner: 'm',
    assetId: 'asset-1',
    assetType: 'Website'
  },
  {
    id: 'task-2', 
    name: 'Development Phase',
    duration: 10,
    owner: 'c',
    assetId: 'asset-1',
    assetType: 'Website',
    dependencies: [{
      predecessorId: 'task-1',
      type: 'FS',
      lag: -2  // Overlap by 2 days
    }]
  },
  {
    id: 'task-3',
    name: 'Testing Phase', 
    duration: 3,
    owner: 'a',
    assetId: 'asset-1',
    assetType: 'Website',
    dependencies: [{
      predecessorId: 'task-2',
      type: 'FS', 
      lag: -1  // Overlap by 1 day
    }]
  }
];

// ============================================
// Integration Tests
// ============================================

export const runPhase2IntegrationTests = () => {
  const results = [];
  
  console.log('🧪 Running Phase 2 Integration Tests...');
  
  try {
    // Test 1: Sequential Calculator (Feature Flag OFF)
    results.push(testSequentialCalculator());
    
    // Test 2: DAG Calculator (Feature Flag ON)
    results.push(testDAGCalculator());
    
    // Test 3: Action Creators
    results.push(testActionCreators());
    
    // Test 4: Dependency Validation
    results.push(testDependencyValidation());
    
    // Test 5: Calculator Factory Switching
    results.push(testCalculatorSwitching());
    
    // Test 6: Timeline Compression
    results.push(testTimelineCompression());
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    console.log(`✅ Phase 2 Integration Tests: ${passed}/${total} passed`);
    
    if (passed === total) {
      console.log('🎉 All integration tests passed! Phase 2 is ready for production.');
    } else {
      console.warn('⚠️  Some tests failed. Check individual test results.');
      results.filter(r => !r.success).forEach(r => {
        console.error(`❌ ${r.testName}: ${r.error}`);
      });
    }
    
    return {
      success: passed === total,
      passed,
      total,
      results
    };
    
  } catch (error) {
    console.error('💥 Integration testing failed:', error);
    return {
      success: false,
      passed: 0,
      total: results.length,
      results,
      error: error.message
    };
  }
};

/**
 * Test 1: Sequential Calculator
 */
const testSequentialCalculator = () => {
  try {
    // Ensure DAG calculator is disabled
    featureFlags.disable('USE_DAG_CALCULATOR');
    
    const tasks = createTestTasks();
    const timeline = buildAssetTimeline(tasks, '2024-12-31', {}, []);
    
    if (timeline.length !== 3) {
      throw new Error(`Expected 3 tasks, got ${timeline.length}`);
    }
    
    // Verify sequential ordering (no overlaps)
    const task1End = new Date(timeline[0].end);
    const task2Start = new Date(timeline[1].start);
    
    if (task2Start <= task1End) {
      throw new Error('Tasks should not overlap in sequential mode');
    }
    
    return {
      testName: 'Sequential Calculator',
      success: true,
      message: 'Sequential calculator works correctly'
    };
    
  } catch (error) {
    return {
      testName: 'Sequential Calculator',
      success: false,
      error: error.message
    };
  }
};

/**
 * Test 2: DAG Calculator
 */
const testDAGCalculator = () => {
  try {
    // Enable DAG calculator
    featureFlags.enable('USE_DAG_CALCULATOR');
    
    const tasks = createTestTasksWithDependencies();
    const timeline = buildAssetTimeline(tasks, '2024-12-31', {}, []);
    
    if (timeline.length !== 3) {
      throw new Error(`Expected 3 tasks, got ${timeline.length}`);
    }
    
    // Verify overlaps are calculated
    const task1 = timeline.find(t => t.id === 'task-1');
    const task2 = timeline.find(t => t.id === 'task-2');
    
    if (!task1 || !task2) {
      throw new Error('Could not find test tasks in timeline');
    }
    
    const task1End = new Date(task1.end);
    const task2Start = new Date(task2.start);
    
    // Task 2 should start before Task 1 ends (overlap)
    if (task2Start >= task1End) {
      throw new Error('Expected task overlap but found sequential scheduling');
    }
    
    return {
      testName: 'DAG Calculator',
      success: true,
      message: 'DAG calculator produces overlapped timeline correctly'
    };
    
  } catch (error) {
    return {
      testName: 'DAG Calculator', 
      success: false,
      error: error.message
    };
  }
};

/**
 * Test 3: Action Creators
 */
const testActionCreators = () => {
  try {
    // Test action creator structure
    const addDepAction = TimelineActions.addDependency('task-1', 'task-2', 2);
    
    if (!addDepAction.type || addDepAction.type !== 'ADD_DEPENDENCY') {
      throw new Error('ADD_DEPENDENCY action creator malformed');
    }
    
    if (!addDepAction.payload || !addDepAction.payload.predecessorId) {
      throw new Error('ADD_DEPENDENCY payload malformed');
    }
    
    const removeDepAction = TimelineActions.removeDependency('task-2');
    if (removeDepAction.type !== 'REMOVE_DEPENDENCY') {
      throw new Error('REMOVE_DEPENDENCY action creator malformed');
    }
    
    const recalcAction = TimelineActions.recalculateWithDependencies();
    if (recalcAction.type !== 'RECALCULATE_WITH_DEPENDENCIES') {
      throw new Error('RECALCULATE_WITH_DEPENDENCIES action creator malformed');
    }
    
    return {
      testName: 'Action Creators',
      success: true,
      message: 'All dependency action creators work correctly'
    };
    
  } catch (error) {
    return {
      testName: 'Action Creators',
      success: false,
      error: error.message
    };
  }
};

/**
 * Test 4: Dependency Validation
 */
const testDependencyValidation = () => {
  try {
    const tasks = createTestTasks();
    
    // Valid dependency
    const validResult = validateDependency('task-1', 'task-2', 2, tasks, {});
    if (!validResult.valid) {
      throw new Error('Valid dependency rejected');
    }
    
    // Invalid dependency (non-existent predecessor)
    const invalidResult = validateDependency('task-999', 'task-2', 2, tasks, {});
    if (invalidResult.valid) {
      throw new Error('Invalid dependency accepted');
    }
    
    // Invalid overlap amount
    const invalidOverlap = validateDependency('task-1', 'task-2', 10, tasks, {}); // More than task duration
    if (invalidOverlap.valid) {
      throw new Error('Invalid overlap amount accepted');
    }
    
    return {
      testName: 'Dependency Validation',
      success: true,
      message: 'Dependency validation working correctly'
    };
    
  } catch (error) {
    return {
      testName: 'Dependency Validation',
      success: false,
      error: error.message
    };
  }
};

/**
 * Test 5: Calculator Factory Switching
 */
const testCalculatorSwitching = () => {
  try {
    const tasks = createTestTasks();
    
    // Test with feature flag OFF
    featureFlags.disable('USE_DAG_CALCULATOR');
    const sequentialTimeline = buildAssetTimeline(tasks, '2024-12-31', {}, []);
    
    // Test with feature flag ON
    featureFlags.enable('USE_DAG_CALCULATOR');
    const dagTimeline = buildAssetTimeline(tasks, '2024-12-31', {}, []);
    
    // For tasks without dependencies, both should produce identical results
    if (sequentialTimeline.length !== dagTimeline.length) {
      throw new Error('Sequential and DAG calculators produce different task counts for same input');
    }
    
    // Check that dates are identical (no dependencies = no differences)
    for (let i = 0; i < sequentialTimeline.length; i++) {
      const seqTask = sequentialTimeline[i];
      const dagTask = dagTimeline[i];
      
      if (seqTask.start !== dagTask.start || seqTask.end !== dagTask.end) {
        throw new Error('Sequential and DAG calculators should produce identical results for tasks without dependencies');
      }
    }
    
    return {
      testName: 'Calculator Factory Switching',
      success: true,
      message: 'Feature flag correctly switches between calculators'
    };
    
  } catch (error) {
    return {
      testName: 'Calculator Factory Switching',
      success: false,
      error: error.message
    };
  }
};

/**
 * Test 6: Timeline Compression 
 */
const testTimelineCompression = () => {
  try {
    featureFlags.enable('USE_DAG_CALCULATOR');
    
    const sequentialTasks = createTestTasks();
    const dependentTasks = createTestTasksWithDependencies();
    
    const sequentialTimeline = buildAssetTimeline(sequentialTasks, '2024-12-31', {}, []);
    const compressedTimeline = buildAssetTimeline(dependentTasks, '2024-12-31', {}, []);
    
    // Calculate total project duration for both
    const getProjectDuration = (timeline) => {
      if (timeline.length === 0) return 0;
      const startDate = new Date(timeline[0].start);
      const endDate = new Date(timeline[timeline.length - 1].end);
      return Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));
    };
    
    const sequentialDuration = getProjectDuration(sequentialTimeline);
    const compressedDuration = getProjectDuration(compressedTimeline);
    
    // Compressed timeline should be shorter due to overlaps
    if (compressedDuration >= sequentialDuration) {
      throw new Error(`Expected compression but got ${compressedDuration} >= ${sequentialDuration} days`);
    }
    
    const compressionSavings = sequentialDuration - compressedDuration;
    
    return {
      testName: 'Timeline Compression',
      success: true,
      message: `Achieved ${compressionSavings} days of compression (${sequentialDuration} → ${compressedDuration} days)`
    };
    
  } catch (error) {
    return {
      testName: 'Timeline Compression',
      success: false,
      error: error.message
    };
  }
};

// ============================================
// Manual Test Interface
// ============================================

/**
 * Enable DAG features for manual testing
 */
export const enableDAGFeatures = () => {
  enableDAGCalculatorOnly();
  console.log('✅ DAG calculator enabled for manual testing');
  console.log('Use window.timelineFeatureFlags to control features');
};

/**
 * Quick test runner for console
 */
export const quickTest = () => {
  console.log('🚀 Running quick DAG calculator test...');
  
  const tasks = createTestTasksWithDependencies();
  enableDAGFeatures();
  
  const timeline = buildAssetTimeline(tasks, '2024-12-31', {}, []);
  
  console.log('📊 Test Results:');
  console.log(`- Tasks: ${timeline.length}`);
  console.log(`- Timeline span: ${timeline[0]?.start} to ${timeline[timeline.length - 1]?.end}`);
  console.log(`- Overlaps detected: ${timeline.some(t => t.dependencies?.length > 0) ? 'Yes' : 'No'}`);
  
  return timeline;
};

// ============================================
// Export Test Interface
// ============================================

export default {
  runPhase2IntegrationTests,
  enableDAGFeatures,
  quickTest,
  createTestTasks,
  createTestTasksWithDependencies
};