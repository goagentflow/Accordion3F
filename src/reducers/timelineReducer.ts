/**
 * Main Timeline Reducer (Orchestrator)
 * Routes actions to specialized reducer functions
 * 
 * Following Golden Rule #2: 400 Line Max - Extracted logic to specialized reducers
 * Following Golden Rule #4: Clear Roles - Main reducer orchestrates, specialists handle logic
 */

import {
  TimelineState,
  TimelineAction,
  ActionType
} from '../types/timeline.types';

// Import specialized reducers
import {
  handleAddDependency,
  handleRemoveDependency,
  handleUpdateDependency,
  handleClearAllDependencies,
  handleRecalculateWithDependencies,
  handleBulkAddDependencies,
  handleBulkRemoveDependencies
} from './dependencyReducer';

import {
  handleAddAsset,
  handleRemoveAsset,
  handleRenameAsset,
  handleAddCustomTask,
  handleUpdateTaskDuration,
  handleBulkUpdateDurations
} from './coreReducer';

import {
  initialTimelineState,
  handleSetGlobalLiveDate,
  handleToggleUseGlobalDate,
  handleSetBankHolidays,
  handleSetAssetLiveDate,
  handleSetAssetStartDate,
  handleUpdateTimeline,
  handleSetDateErrors,
  handleSetProjectStartDate,
  handleSetCalculatedStartDates,
  handleToggleInfoBox,
  handleSetGettingStarted,
  handleSetAllInstructions,
  handleLoadCsvData,
  handleImportState,
  handleImportTimeline,
  handleRenameTask,
  handleUpdateTaskBank
} from './systemReducer';

import {
  handleDragTask,
  handleHydrateFromStorage,
  handleUndo,
  handleRedo,
  recordStateForUndo
} from './manipulationReducer';

export { initialTimelineState };

/**
 * Main timeline reducer (Orchestrator)
 * Routes actions to specialized handler functions
 */
export function timelineReducer(
  state: TimelineState = initialTimelineState,
  action: TimelineAction
): TimelineState {
  switch (action.type) {
    // ============================================
    // Asset Actions
    // ============================================
    case ActionType.ADD_ASSET:
      return handleAddAsset(state, action);
    case ActionType.REMOVE_ASSET:
      return handleRemoveAsset(state, action);
    case ActionType.RENAME_ASSET:
      return handleRenameAsset(state, action);
    case ActionType.SET_ASSET_LIVE_DATE:
      return handleSetAssetLiveDate(state, action);
    case ActionType.SET_ASSET_START_DATE:
      return handleSetAssetStartDate(state, action);

    // ============================================
    // Task Actions
    // ============================================
    case ActionType.ADD_CUSTOM_TASK:
      return handleAddCustomTask(state, action);
    case ActionType.UPDATE_TASK_DURATION:
      return handleUpdateTaskDuration(state, action);
    case ActionType.RENAME_TASK:
      return handleRenameTask(state, action);
    case ActionType.UPDATE_TASK_BANK:
      return handleUpdateTaskBank(state, action);
    case ActionType.BULK_UPDATE_DURATIONS:
      return handleBulkUpdateDurations(state, action);

    // ============================================
    // Date Actions
    // ============================================
    case ActionType.SET_GLOBAL_LIVE_DATE:
      return handleSetGlobalLiveDate(state, action);
    case ActionType.TOGGLE_USE_GLOBAL_DATE:
      return handleToggleUseGlobalDate(state);
    case ActionType.SET_BANK_HOLIDAYS:
      return handleSetBankHolidays(state, action);

    // ============================================
    // Calculated State Actions
    // ============================================
    case ActionType.UPDATE_TIMELINE:
      return handleUpdateTimeline(state, action);
    case ActionType.SET_DATE_ERRORS:
      return handleSetDateErrors(state, action);
    case ActionType.SET_PROJECT_START_DATE:
      return handleSetProjectStartDate(state, action);
    case ActionType.SET_CALCULATED_START_DATES:
      return handleSetCalculatedStartDates(state, action);

    // ============================================
    // UI Actions
    // ============================================
    case ActionType.TOGGLE_INFO_BOX:
      return handleToggleInfoBox(state);
    case ActionType.SET_GETTING_STARTED:
      return handleSetGettingStarted(state, action);
    case ActionType.SET_ALL_INSTRUCTIONS:
      return handleSetAllInstructions(state, action);

    // ============================================
    // System Actions
    // ============================================
    case ActionType.LOAD_CSV_DATA:
      return handleLoadCsvData(state, action);
    case ActionType.IMPORT_STATE:
      return handleImportState(state, action);
    case ActionType.CLEAR_ALL:
      return initialTimelineState;
    case ActionType.IMPORT_TIMELINE:
      return handleImportTimeline(state, action);
    case ActionType.RESET_STATE:
      return initialTimelineState;

    // ============================================
    // Dependency Actions (NEW for DAG Calculator) 
    // ============================================
    case ActionType.ADD_DEPENDENCY:
      return handleAddDependency(state, action);
    case ActionType.REMOVE_DEPENDENCY:
      return handleRemoveDependency(state, action);
    case ActionType.UPDATE_DEPENDENCY:
      return handleUpdateDependency(state, action);
    case ActionType.CLEAR_ALL_DEPENDENCIES:
      return handleClearAllDependencies(state);
    case ActionType.BULK_ADD_DEPENDENCIES:
      return handleBulkAddDependencies(state, action);
    case ActionType.BULK_REMOVE_DEPENDENCIES:
      return handleBulkRemoveDependencies(state, action);
    case ActionType.RECALCULATE_WITH_DEPENDENCIES:
      return handleRecalculateWithDependencies(state);

    // ============================================
    // NEW: Manipulation Bug Fix Actions
    // ============================================
    case ActionType.DRAG_TASK: {
      // Record state for undo before drag operation
      recordStateForUndo(state);
      return handleDragTask(state, action);
    }
    case ActionType.HYDRATE_FROM_STORAGE:
      return handleHydrateFromStorage(state, action);
    case ActionType.UNDO:
      return handleUndo(state, action);
    case ActionType.REDO:
      return handleRedo(state, action);

    default: {
      // TypeScript exhaustiveness check - this should never be reached
      throw new Error(`Unhandled action type: ${(action as any).type}`);
    }
  }
}

// Action creators have been moved to src/actions/timelineActions.ts
// This maintains Golden Rule #2: 400 Line Max