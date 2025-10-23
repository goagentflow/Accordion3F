/**
 * Manipulation Reducer - Fixes Timeline Manipulation Bugs
 * Handles drag operations and state hydration for manipulation bug fixes
 * 
 * CRITICAL: This file contains the exact fixes for the manipulation bugs
 * identified in the UAT testing: progressive degradation, correction failures
 */

import {
  TimelineState,
  DragTaskAction,
  HydrateFromStorageAction,
  UndoAction,
  RedoAction,
  MoveTaskAction
} from '../types/timeline.types';

import { safeToISOString } from '../utils/dateHelpers';

/**
 * Handle DRAG_TASK action - Fixes the manipulation degradation bug
 * 
 * CRITICAL BUG FIX: This replaces the broken multiple useState approach
 * that caused state corruption during rapid drag operations
 */
export function handleDragTask(state: TimelineState, action: DragTaskAction): TimelineState {
  const { taskId, deltaX, deltaY } = action.payload;
  
  console.log(`[ManipulationReducer] Dragging task ${taskId}: ${deltaX}px x, ${deltaY}px y`);
  
  return {
    ...state,
    tasks: {
      ...state.tasks,
      timeline: state.tasks.timeline.map(task => {
        if (task.id === taskId) {
          // CRITICAL: Calculate new dates atomically (prevents state corruption)
          const currentStart = new Date(task.start);
          
          // Convert pixel movement to days (assuming ~48px per day based on UAT findings)
          const daysToMove = Math.round(deltaX / 48);
          
          if (daysToMove === 0) {
            // No meaningful movement - return task unchanged
            return task;
          }
          
          // Calculate new start date
          const newStart = new Date(currentStart);
          newStart.setDate(newStart.getDate() + daysToMove);
          
          // Calculate new end date based on duration
          const newEnd = new Date(newStart);
          newEnd.setDate(newEnd.getDate() + task.duration - 1); // -1 because end date is inclusive
          
          // CRITICAL: Validate date calculations (prevents invalid states)
          if (newStart > newEnd) {
            console.warn(`[ManipulationReducer] Invalid date range prevented for task ${taskId}`);
            return task; // Return unchanged if dates would be invalid
          }
          
          console.log(`[ManipulationReducer] Task ${taskId} moved ${daysToMove} days: ${task.start} → ${safeToISOString(newStart)}`);

          return {
            ...task,
            start: safeToISOString(newStart),
            end: safeToISOString(newEnd)
          };
        }
        return task;
      })
    }
  };
}

/**
 * Handle HYDRATE_FROM_STORAGE action - Fixes the recovery bug
 * 
 * CRITICAL BUG FIX: This replaces the broken localStorage hydration
 * that caused timeline disappearance after save/refresh
 */
export function handleHydrateFromStorage(state: TimelineState, action: HydrateFromStorageAction): TimelineState {
  const hydratedData = action.payload;
  
  console.log(`[ManipulationReducer] Hydrating state from storage`, {
    hasAssets: !!hydratedData.assets,
    hasTasks: !!hydratedData.tasks,
    hasDates: !!hydratedData.dates,
    hasUI: !!hydratedData.ui
  });
  
  // CRITICAL: Merge hydrated data with current state structure
  // This ensures we don't lose any properties during hydration
  const hydratedState: TimelineState = {
    assets: {
      available: hydratedData.assets?.available || state.assets.available,
      selected: hydratedData.assets?.selected || state.assets.selected,
      liveDates: hydratedData.assets?.liveDates || state.assets.liveDates,
      taskDurations: hydratedData.assets?.taskDurations || state.assets.taskDurations
    },
    tasks: {
      all: hydratedData.tasks?.all || state.tasks.all,
      bank: hydratedData.tasks?.bank || state.tasks.bank,
      byAsset: hydratedData.tasks?.byAsset || state.tasks.byAsset,
      instanceDurations: hydratedData.tasks?.instanceDurations || state.tasks.instanceDurations,
      timeline: hydratedData.tasks?.timeline || state.tasks.timeline,
      custom: hydratedData.tasks?.custom || state.tasks.custom,
      names: hydratedData.tasks?.names || state.tasks.names,
      deps: hydratedData.tasks?.deps || state.tasks.deps
    },
    dates: {
      globalLiveDate: hydratedData.dates?.globalLiveDate || state.dates.globalLiveDate,
      useGlobalDate: hydratedData.dates?.useGlobalDate ?? state.dates.useGlobalDate,
      projectStartDate: hydratedData.dates?.projectStartDate || state.dates.projectStartDate,
      bankHolidays: hydratedData.dates?.bankHolidays || state.dates.bankHolidays,
      calculatedStartDates: hydratedData.dates?.calculatedStartDates || state.dates.calculatedStartDates
    },
    ui: {
      showInfoBox: hydratedData.ui?.showInfoBox ?? state.ui.showInfoBox,
      showGettingStarted: hydratedData.ui?.showGettingStarted ?? state.ui.showGettingStarted,
      showAllInstructions: hydratedData.ui?.showAllInstructions ?? state.ui.showAllInstructions,
      dateErrors: hydratedData.ui?.dateErrors || state.ui.dateErrors
    },
    status: 'ready' // Always set to ready after successful hydration
  };
  
  // Validate that we have meaningful data after hydration
  const hasValidData = hydratedState.assets.selected.length > 0 || hydratedState.tasks.timeline.length > 0;
  
  if (!hasValidData) {
    console.warn(`[ManipulationReducer] No meaningful data after hydration`);
  }
  
  console.log(`[ManipulationReducer] Hydration complete:`, {
    assets: hydratedState.assets.selected.length,
    timelineTasks: hydratedState.tasks.timeline.length,
    customTasks: hydratedState.tasks.custom.length,
    globalLiveDate: hydratedState.dates.globalLiveDate
  });
  
  return hydratedState;
}

/**
 * Handle MOVE_TASK action - Handles direct task repositioning from drag-and-drop
 */
export function handleMoveTask(state: TimelineState, action: MoveTaskAction): TimelineState {
  const { taskId, newStartDate } = action.payload;

  // Defensive guard: validate date
  const parsed = new Date(newStartDate);
  if (isNaN(parsed.getTime())) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[ManipulationReducer] Ignoring MOVE_TASK with invalid date', newStartDate);
    }
    return state;
  }

  return {
    ...state,
    tasks: {
      ...state.tasks,
      timeline: state.tasks.timeline.map(task => {
        if (task.id === taskId) {
          const newStart = new Date(parsed);
          const newEnd = new Date(newStart);
          newEnd.setDate(newEnd.getDate() + task.duration - 1);

          return {
            ...task,
            start: safeToISOString(newStart),
            end: safeToISOString(newEnd),
          };
        }
        return task;
      })
    }
  };
}

// History management for undo/redo (prevents memory leaks)
const MAX_HISTORY_SIZE = 50;
let undoHistory: TimelineState[] = [];
let redoHistory: TimelineState[] = [];

/**
 * Push state to undo history with bounded size (prevents memory leaks)
 */
function pushToUndoHistory(state: TimelineState): void {
  undoHistory.push(state);
  
  // Keep history bounded to prevent memory leaks
  if (undoHistory.length > MAX_HISTORY_SIZE) {
    undoHistory = undoHistory.slice(-MAX_HISTORY_SIZE);
  }
  
  // Clear redo history when new action is performed
  redoHistory = [];
}

/**
 * Handle UNDO action - Bounded undo with memory leak prevention
 */
export function handleUndo(state: TimelineState, _action: UndoAction): TimelineState {
  if (undoHistory.length === 0) {
    console.warn(`[ManipulationReducer] No undo history available`);
    return state;
  }
  
  // Move current state to redo history
  redoHistory.push(state);
  
  // Get previous state from undo history
  const previousState = undoHistory.pop()!;
  
  console.log(`[ManipulationReducer] Undo performed: ${undoHistory.length} remaining in history`);
  
  return previousState;
}

/**
 * Handle REDO action - Bounded redo with memory leak prevention
 */
export function handleRedo(state: TimelineState, _action: RedoAction): TimelineState {
  if (redoHistory.length === 0) {
    console.warn(`[ManipulationReducer] No redo history available`);
    return state;
  }
  
  // Move current state to undo history
  pushToUndoHistory(state);
  
  // Get next state from redo history
  const nextState = redoHistory.pop()!;
  
  console.log(`[ManipulationReducer] Redo performed: ${redoHistory.length} remaining in redo`);
  
  return nextState;
}

/**
 * Record state for undo functionality
 * Call this before any action that should be undoable
 */
export function recordStateForUndo(state: TimelineState): void {
  pushToUndoHistory(state);
}

/**
 * Get undo/redo availability for UI
 */
export function getUndoRedoAvailability(): { canUndo: boolean; canRedo: boolean } {
  return {
    canUndo: undoHistory.length > 0,
    canRedo: redoHistory.length > 0
  };
}
