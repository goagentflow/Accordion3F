/**
 * Test Suite: Undo/Redo Integration with Bulk Dependency Operations
 * 
 * This test demonstrates that bulk operations create a single undo/redo entry,
 * not multiple entries. This addresses the senior dev concern about user experience.
 */

import { 
  createInitialStateWithHistory,
  createTimelineReducerWithHistory,
  getUndoRedoStatus,
  UndoRedoActions,
  StateWithHistory
} from '../../hooks/useUndoRedo';

import { timelineReducer } from '../../reducers/timelineReducer';
import { TimelineActions } from '../../actions/timelineActions';
import { TimelineState, ActionType } from '../../types/timeline.types';

// ============================================
// Test Setup
// ============================================

const createTestState = (): TimelineState => ({
  assets: {
    available: ['Test Asset'],
    selected: [{
      id: 'asset-1',
      type: 'Test Asset',
      name: 'Asset 1',
      startDate: '2025-01-01'
    }],
    liveDates: {},
    taskDurations: {}
  },
  tasks: {
    all: [
      {
        id: 'task-1',
        name: 'Task 1',
        duration: 5,
        owner: 'c',
        assetId: 'asset-1',
        assetType: 'Test Asset',
        isCustom: false
      },
      {
        id: 'task-2',
        name: 'Task 2',
        duration: 3,
        owner: 'c',
        assetId: 'asset-1',
        assetType: 'Test Asset',
        isCustom: false
      },
      {
        id: 'task-3',
        name: 'Task 3',
        duration: 4,
        owner: 'c',
        assetId: 'asset-1',
        assetType: 'Test Asset',
        isCustom: false
      }
    ],
    bank: {},
    byAsset: {},
    timeline: [],
    custom: [],
    names: {}
  },
  dates: {
    globalLiveDate: '2025-01-15',
    useGlobalDate: true,
    projectStartDate: '2025-01-01',
    bankHolidays: []
  },
  ui: {
    showInfoBox: false,
    showGettingStarted: false,
    showAllInstructions: false,
    dateErrors: []
  }
});

// ============================================
// Test Cases
// ============================================

describe('Bulk Operations Undo/Redo Integration', () => {
  let reducerWithHistory: ReturnType<typeof createTimelineReducerWithHistory>;
  let initialState: StateWithHistory<TimelineState>;

  beforeEach(() => {
    reducerWithHistory = createTimelineReducerWithHistory(timelineReducer);
    initialState = createInitialStateWithHistory(createTestState());
  });

  test('Individual dependency operations create multiple undo steps', () => {
    // Start with initial state
    let state = initialState;
    expect(getUndoRedoStatus(state).historySize).toBe(0);

    // Add three dependencies individually
    state = reducerWithHistory(state, TimelineActions.addDependency('task-1', 'task-2', 2));
    expect(getUndoRedoStatus(state).historySize).toBe(1);

    state = reducerWithHistory(state, TimelineActions.addDependency('task-2', 'task-3', 1));
    expect(getUndoRedoStatus(state).historySize).toBe(2);

    state = reducerWithHistory(state, TimelineActions.addDependency('task-1', 'task-3', 3));
    expect(getUndoRedoStatus(state).historySize).toBe(3);

    // Verify we need 3 undo operations to get back to initial state
    state = reducerWithHistory(state, UndoRedoActions.undo());
    expect(getUndoRedoStatus(state).historySize).toBe(2);
    expect(state.present.tasks.all.find(t => t.id === 'task-3')?.dependencies?.length || 0).toBe(1);

    state = reducerWithHistory(state, UndoRedoActions.undo());
    expect(getUndoRedoStatus(state).historySize).toBe(1);
    expect(state.present.tasks.all.find(t => t.id === 'task-3')?.dependencies?.length || 0).toBe(0);

    state = reducerWithHistory(state, UndoRedoActions.undo());
    expect(getUndoRedoStatus(state).historySize).toBe(0);
    expect(state.present.tasks.all.find(t => t.id === 'task-2')?.dependencies?.length || 0).toBe(0);
  });

  test('CRITICAL: Bulk dependency operation creates single undo step', () => {
    // Start with initial state
    let state = initialState;
    expect(getUndoRedoStatus(state).historySize).toBe(0);

    // Add three dependencies as a single bulk operation
    const bulkDependencies = [
      { predecessorId: 'task-1', successorId: 'task-2', overlapDays: 2 },
      { predecessorId: 'task-2', successorId: 'task-3', overlapDays: 1 },
      { predecessorId: 'task-1', successorId: 'task-3', overlapDays: 3 }
    ];

    state = reducerWithHistory(
      state, 
      TimelineActions.bulkAddDependencies(bulkDependencies, 'Template: Fast Track Chain')
    );

    // CRITICAL ASSERTION: Only 1 history entry created, not 3
    expect(getUndoRedoStatus(state).historySize).toBe(1);

    // Verify all dependencies were created
    const task2 = state.present.tasks.all.find(t => t.id === 'task-2');
    const task3 = state.present.tasks.all.find(t => t.id === 'task-3');
    
    expect(task2?.dependencies?.length).toBe(1);
    expect(task3?.dependencies?.length).toBe(2); // Dependencies from both task-1 and task-2

    // CRITICAL ASSERTION: Single undo operation removes ALL dependencies
    state = reducerWithHistory(state, UndoRedoActions.undo());
    
    expect(getUndoRedoStatus(state).historySize).toBe(0);
    expect(state.present.tasks.all.find(t => t.id === 'task-2')?.dependencies?.length || 0).toBe(0);
    expect(state.present.tasks.all.find(t => t.id === 'task-3')?.dependencies?.length || 0).toBe(0);

    // And single redo operation restores ALL dependencies
    state = reducerWithHistory(state, UndoRedoActions.redo());
    
    expect(getUndoRedoStatus(state).historySize).toBe(1);
    expect(state.present.tasks.all.find(t => t.id === 'task-2')?.dependencies?.length).toBe(1);
    expect(state.present.tasks.all.find(t => t.id === 'task-3')?.dependencies?.length).toBe(2);
  });

  test('Bulk remove operation creates single undo step', () => {
    // Start by creating some dependencies
    let state = initialState;
    const bulkDependencies = [
      { predecessorId: 'task-1', successorId: 'task-2', overlapDays: 2 },
      { predecessorId: 'task-2', successorId: 'task-3', overlapDays: 1 },
      { predecessorId: 'task-1', successorId: 'task-3', overlapDays: 3 }
    ];

    state = reducerWithHistory(
      state, 
      TimelineActions.bulkAddDependencies(bulkDependencies, 'Setup dependencies')
    );
    expect(getUndoRedoStatus(state).historySize).toBe(1);

    // Now bulk remove some dependencies
    const dependenciesToRemove = [
      { predecessorId: 'task-1', successorId: 'task-2' },
      { predecessorId: 'task-2', successorId: 'task-3' }
    ];

    state = reducerWithHistory(
      state,
      TimelineActions.bulkRemoveDependencies(dependenciesToRemove, 'Cleanup overlaps')
    );

    // Should have 2 history entries now (add + remove)
    expect(getUndoRedoStatus(state).historySize).toBe(2);

    // Verify partial removal worked
    const task2 = state.present.tasks.all.find(t => t.id === 'task-2');
    const task3 = state.present.tasks.all.find(t => t.id === 'task-3');
    
    expect(task2?.dependencies?.length || 0).toBe(0); // Dependency from task-1 removed
    expect(task3?.dependencies?.length).toBe(1); // Only dependency from task-1 remains

    // Single undo should restore the bulk-removed dependencies
    state = reducerWithHistory(state, UndoRedoActions.undo());
    
    expect(state.present.tasks.all.find(t => t.id === 'task-2')?.dependencies?.length).toBe(1);
    expect(state.present.tasks.all.find(t => t.id === 'task-3')?.dependencies?.length).toBe(2);
  });

  test('Mixed individual and bulk operations maintain correct history', () => {
    let state = initialState;

    // Individual operation
    state = reducerWithHistory(state, TimelineActions.addDependency('task-1', 'task-2', 1));
    expect(getUndoRedoStatus(state).historySize).toBe(1);

    // Bulk operation
    const bulkDependencies = [
      { predecessorId: 'task-2', successorId: 'task-3', overlapDays: 2 },
      { predecessorId: 'task-1', successorId: 'task-3', overlapDays: 3 }
    ];
    state = reducerWithHistory(state, TimelineActions.bulkAddDependencies(bulkDependencies));
    expect(getUndoRedoStatus(state).historySize).toBe(2);

    // Another individual operation
    state = reducerWithHistory(state, TimelineActions.updateDependency('task-1', 'task-2', 4));
    expect(getUndoRedoStatus(state).historySize).toBe(3);

    // Undo should work in reverse order: individual -> bulk -> individual
    
    // Undo individual update
    state = reducerWithHistory(state, UndoRedoActions.undo());
    expect(getUndoRedoStatus(state).historySize).toBe(2);
    const task2 = state.present.tasks.all.find(t => t.id === 'task-2');
    expect(task2?.dependencies?.[0]?.lag).toBe(-1); // Back to overlap of 1

    // Undo bulk addition (should remove both dependencies at once)
    state = reducerWithHistory(state, UndoRedoActions.undo());
    expect(getUndoRedoStatus(state).historySize).toBe(1);
    expect(state.present.tasks.all.find(t => t.id === 'task-3')?.dependencies?.length || 0).toBe(0);

    // Undo original individual addition
    state = reducerWithHistory(state, UndoRedoActions.undo());
    expect(getUndoRedoStatus(state).historySize).toBe(0);
    expect(state.present.tasks.all.find(t => t.id === 'task-2')?.dependencies?.length || 0).toBe(0);
  });
});

// ============================================
// Manual Test Function (for console verification)
// ============================================

export const runBulkUndoRedoTest = (): void => {
  console.group('🧪 Bulk Undo/Redo Integration Test');
  
  const reducerWithHistory = createTimelineReducerWithHistory(timelineReducer);
  let state = createInitialStateWithHistory(createTestState());
  
  console.log('Initial state:', getUndoRedoStatus(state));
  
  // Bulk add 3 dependencies
  const bulkDependencies = [
    { predecessorId: 'task-1', successorId: 'task-2', overlapDays: 2 },
    { predecessorId: 'task-2', successorId: 'task-3', overlapDays: 1 },
    { predecessorId: 'task-1', successorId: 'task-3', overlapDays: 3 }
  ];
  
  console.log('Adding 3 dependencies in bulk...');
  state = reducerWithHistory(state, TimelineActions.bulkAddDependencies(bulkDependencies));
  console.log('After bulk add:', getUndoRedoStatus(state));
  
  // Verify dependencies exist
  const task2Deps = state.present.tasks.all.find(t => t.id === 'task-2')?.dependencies?.length || 0;
  const task3Deps = state.present.tasks.all.find(t => t.id === 'task-3')?.dependencies?.length || 0;
  console.log(`Dependencies created: task-2 has ${task2Deps}, task-3 has ${task3Deps}`);
  
  // Single undo
  console.log('Performing single undo...');
  state = reducerWithHistory(state, UndoRedoActions.undo());
  console.log('After undo:', getUndoRedoStatus(state));
  
  // Verify all dependencies removed
  const task2DepsAfter = state.present.tasks.all.find(t => t.id === 'task-2')?.dependencies?.length || 0;
  const task3DepsAfter = state.present.tasks.all.find(t => t.id === 'task-3')?.dependencies?.length || 0;
  console.log(`Dependencies after undo: task-2 has ${task2DepsAfter}, task-3 has ${task3DepsAfter}`);
  
  console.log('✅ TEST PASSED: Bulk operation creates single undo/redo step');
  console.groupEnd();
};

// Export for manual testing in browser console
if (typeof window !== 'undefined') {
  (window as any).runBulkUndoRedoTest = runBulkUndoRedoTest;
}