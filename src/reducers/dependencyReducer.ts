/**
 * Dependency Reducer for DAG Calculator
 * Handles all dependency-related state updates
 * 
 * Following Golden Rule #2: 400 Line Max - Extracted from timelineReducer.ts
 * Following Golden Rule #4: Clear Roles - Dependency management separated
 */

import {
  TimelineState,
  TimelineAction,
  ActionType
} from '../types/timeline.types';

// ============================================
// Dependency Reducer Functions
// ============================================

/**
 * Handle ADD_DEPENDENCY action
 */
export function handleAddDependency(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.ADD_DEPENDENCY }>
): TimelineState {
  const { predecessorId, successorId, overlapDays } = action.payload;
  
  // Validation guards
  if (!predecessorId || !successorId) {
    console.warn('ADD_DEPENDENCY: Both predecessor and successor IDs are required');
    return state;
  }
  
  if (overlapDays < 0) {
    console.warn('ADD_DEPENDENCY: Overlap days cannot be negative');
    return state;
  }
  
  // Create new dependency (negative lag for overlaps)
  const newDependency = {
    predecessorId,
    type: 'FS' as const,
    lag: -overlapDays // Convert positive overlap days to negative lag
  };

  const existing = state.tasks.deps?.[successorId] || [];
  if (existing.some(dep => dep.predecessorId === predecessorId)) {
    // Already exists; no-op
    return state;
  }

  return {
    ...state,
    tasks: {
      ...state.tasks,
      deps: {
        ...(state.tasks.deps || {}),
        [successorId]: [...existing, newDependency]
      }
    },
    ui: {
      ...state.ui,
      freezeImportedTimeline: false
    }
  };
}

/**
 * Handle REMOVE_DEPENDENCY action
 */
export function handleRemoveDependency(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.REMOVE_DEPENDENCY }>
): TimelineState {
  const { successorId, predecessorId } = action.payload;
  
  if (!successorId) {
    console.warn('REMOVE_DEPENDENCY: Successor ID is required');
    return state;
  }
  
  const existing = state.tasks.deps?.[successorId] || [];
  const filtered = predecessorId
    ? existing.filter(dep => dep.predecessorId !== predecessorId)
    : [];

  const newDeps = { ...(state.tasks.deps || {}) };
  if (filtered.length > 0) {
    newDeps[successorId] = filtered;
  } else {
    delete newDeps[successorId];
  }

  return {
    ...state,
    tasks: {
      ...state.tasks,
      deps: newDeps
    },
    ui: {
      ...state.ui,
      freezeImportedTimeline: false
    }
  };
}

/**
 * Handle UPDATE_DEPENDENCY action
 */
export function handleUpdateDependency(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.UPDATE_DEPENDENCY }>
): TimelineState {
  const { predecessorId, successorId, overlapDays } = action.payload;
  
  // Validation guards
  if (!predecessorId || !successorId) {
    console.warn('UPDATE_DEPENDENCY: Both predecessor and successor IDs are required');
    return state;
  }
  
  if (overlapDays < 0) {
    console.warn('UPDATE_DEPENDENCY: Overlap days cannot be negative');
    return state;
  }
  
  const existing = state.tasks.deps?.[successorId] || [];
  const updated = existing.map(dep => dep.predecessorId === predecessorId ? { ...dep, lag: -overlapDays } : dep);

  return {
    ...state,
    tasks: {
      ...state.tasks,
      deps: {
        ...(state.tasks.deps || {}),
        [successorId]: updated
      }
    },
    ui: {
      ...state.ui,
      freezeImportedTimeline: false
    }
  };
}

/**
 * Handle CLEAR_ALL_DEPENDENCIES action
 */
export function handleClearAllDependencies(state: TimelineState): TimelineState {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      deps: {}
    },
    ui: {
      ...state.ui,
      freezeImportedTimeline: false
    }
  };
}

/**
 * Handle RECALCULATE_WITH_DEPENDENCIES action
 */
export function handleRecalculateWithDependencies(state: TimelineState): TimelineState {
  // This action triggers a recalculation using the DAG calculator
  // The actual recalculation will be handled by the useTimeline hook
  // This action just signals that a recalculation is needed
  
  // Return state unchanged - recalculation happens in effects
  return state;
}

/**
 * Handle BULK_ADD_DEPENDENCIES action
 * Adds multiple dependencies in a single atomic operation for proper undo/redo
 */
export function handleBulkAddDependencies(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.BULK_ADD_DEPENDENCIES }>
): TimelineState {
  const { dependencies } = action.payload;
  
  if (!dependencies || dependencies.length === 0) {
    console.warn('BULK_ADD_DEPENDENCIES: No dependencies provided');
    return state;
  }
  
  // Apply all dependency additions in sequence
  let newState = state;
  for (const dep of dependencies) {
    // Reuse existing ADD_DEPENDENCY logic
    newState = handleAddDependency(newState, {
      type: ActionType.ADD_DEPENDENCY,
      payload: {
        predecessorId: dep.predecessorId,
        successorId: dep.successorId,
        overlapDays: dep.overlapDays
      }
    });
  }
  
  return newState;
}

/**
 * Handle BULK_REMOVE_DEPENDENCIES action
 * Removes multiple dependencies in a single atomic operation for proper undo/redo
 */
export function handleBulkRemoveDependencies(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.BULK_REMOVE_DEPENDENCIES }>
): TimelineState {
  const { dependencies } = action.payload;
  
  if (!dependencies || dependencies.length === 0) {
    console.warn('BULK_REMOVE_DEPENDENCIES: No dependencies provided');
    return state;
  }
  
  // Apply all dependency removals in sequence
  let newState = state;
  for (const dep of dependencies) {
    // Reuse existing REMOVE_DEPENDENCY logic
    newState = handleRemoveDependency(newState, {
      type: ActionType.REMOVE_DEPENDENCY,
      payload: {
        successorId: dep.successorId,
        predecessorId: dep.predecessorId
      }
    });
  }
  
  return newState;
}
