/**
 * Action creator helper functions
 * Type-safe ways to create timeline actions
 * 
 * Following Golden Rule #2: 400 Line Max - Extracted from timelineReducer.ts
 * Following Golden Rule #4: Clear Roles - Actions creation separated from state management
 */

  import {
  TimelineAction,
  ActionType,
  TimelineState,
  Task,
  TimelineTask
} from '../types/timeline.types';

// ============================================
// Core Action Creators
// ============================================

export const TimelineActions = {
  // Asset actions
  addAsset: (assetType: string, name?: string, startDate?: string): TimelineAction => ({
    type: ActionType.ADD_ASSET,
    payload: { assetType, name, startDate }
  }),

  removeAsset: (assetId: string): TimelineAction => ({
    type: ActionType.REMOVE_ASSET,
    payload: { assetId }
  }),

  renameAsset: (assetId: string, newName: string): TimelineAction => ({
    type: ActionType.RENAME_ASSET,
    payload: { assetId, newName }
  }),

  setAssetLiveDate: (assetName: string, date: string): TimelineAction => ({
    type: ActionType.SET_ASSET_LIVE_DATE,
    payload: { assetName, date }
  }),

  setAssetStartDate: (assetId: string, date: string): TimelineAction => ({
    type: ActionType.SET_ASSET_START_DATE,
    payload: { assetId, date }
  }),

  // Task actions
  addCustomTask: (
    name: string,
    duration: number,
    owner: 'c' | 'm' | 'a' | 'l',
    assetType: string,
    insertAfterTaskId?: string
  ): TimelineAction => ({
    type: ActionType.ADD_CUSTOM_TASK,
    payload: { name, duration, owner, assetType, insertAfterTaskId }
  }),

  updateTaskDuration: (
    taskId: string,
    assetType: string,
    taskName: string,
    duration: number
  ): TimelineAction => ({
    type: ActionType.UPDATE_TASK_DURATION,
    payload: { taskId, assetType, taskName, duration }
  }),

  renameTask: (taskId: string, newName: string): TimelineAction => ({
    type: ActionType.RENAME_TASK,
    payload: { taskId, newName }
  }),

  moveTask: (taskId: string, newStartDate: string): TimelineAction => ({
    type: ActionType.MOVE_TASK,
    payload: { taskId, newStartDate }
  }),

  removeTask: (taskId: string, assetId: string): TimelineAction => ({
    type: ActionType.REMOVE_TASK,
    payload: { taskId, assetId }
  }),

  updateTaskBank: (taskBank: Task[]): TimelineAction => ({
    type: ActionType.UPDATE_TASK_BANK,
    payload: { taskBank }
  }),

  bulkUpdateDurations: (updates: Array<{ taskId: string; assetType: string; taskName: string; duration: number }>): TimelineAction => ({
    type: ActionType.BULK_UPDATE_DURATIONS,
    payload: { updates }
  }),

  // Date actions
  setGlobalLiveDate: (date: string): TimelineAction => ({
    type: ActionType.SET_GLOBAL_LIVE_DATE,
    payload: { date }
  }),

  toggleUseGlobalDate: (): TimelineAction => ({
    type: ActionType.TOGGLE_USE_GLOBAL_DATE
  }),

  setBankHolidays: (holidays: string[]): TimelineAction => ({
    type: ActionType.SET_BANK_HOLIDAYS,
    payload: { holidays }
  }),

  // Calculated state actions
  updateTimeline: (timeline: TimelineTask[]): TimelineAction => ({
    type: ActionType.UPDATE_TIMELINE,
    payload: { timeline }
  }),

  setDateErrors: (errors: string[]): TimelineAction => ({
    type: ActionType.SET_DATE_ERRORS,
    payload: { errors }
  }),

  setProjectStartDate: (date: string): TimelineAction => ({
    type: ActionType.SET_PROJECT_START_DATE,
    payload: { date }
  }),

  setCalculatedStartDates: (dates: Record<string, string>): TimelineAction => ({
    type: ActionType.SET_CALCULATED_START_DATES,
    payload: { dates }
  }),

  // UI actions
  toggleInfoBox: (): TimelineAction => ({
    type: ActionType.TOGGLE_INFO_BOX
  }),

  setGettingStarted: (show: boolean): TimelineAction => ({
    type: ActionType.SET_GETTING_STARTED,
    payload: { show }
  }),

  setAllInstructions: (show: boolean): TimelineAction => ({
    type: ActionType.SET_ALL_INSTRUCTIONS,
    payload: { show }
  }),

  // System actions
  loadCsvData: (csvData: any[], uniqueAssets: string[]): TimelineAction => ({
    type: ActionType.LOAD_CSV_DATA,
    payload: { csvData, uniqueAssets }
  }),

  importState: (state: Partial<TimelineState>): TimelineAction => ({
    type: ActionType.IMPORT_STATE,
    payload: state
  }),

  resetState: (): TimelineAction => ({
    type: ActionType.RESET_STATE
  }),

  clearAll: (): TimelineAction => ({
    type: ActionType.CLEAR_ALL
  }),

  importTimeline: (importedData: any): TimelineAction => ({
    type: ActionType.IMPORT_TIMELINE,
    payload: { importedData }
  }),

  // UI/project metadata
  setClientCampaignName: (name: string): TimelineAction => ({
    type: ActionType.SET_CLIENT_CAMPAIGN_NAME,
    payload: { name }
  }),

  // ============================================
  // Dependency Actions (NEW for DAG Calculator)
  // ============================================

  addDependency: (predecessorId: string, successorId: string, overlapDays: number): TimelineAction => ({
    type: ActionType.ADD_DEPENDENCY,
    payload: { predecessorId, successorId, overlapDays }
  }),

  removeDependency: (successorId: string, predecessorId?: string): TimelineAction => ({
    type: ActionType.REMOVE_DEPENDENCY,
    payload: { successorId, predecessorId }
  }),

  updateDependency: (predecessorId: string, successorId: string, overlapDays: number): TimelineAction => ({
    type: ActionType.UPDATE_DEPENDENCY,
    payload: { predecessorId, successorId, overlapDays }
  }),

  clearAllDependencies: (): TimelineAction => ({
    type: ActionType.CLEAR_ALL_DEPENDENCIES
  }),

  // Bulk dependency actions for proper undo/redo
  bulkAddDependencies: (dependencies: Array<{
    predecessorId: string;
    successorId: string;
    overlapDays: number;
  }>, description?: string): TimelineAction => ({
    type: ActionType.BULK_ADD_DEPENDENCIES,
    payload: { dependencies, description }
  }),

  bulkRemoveDependencies: (dependencies: Array<{
    predecessorId: string;
    successorId: string;
  }>, description?: string): TimelineAction => ({
    type: ActionType.BULK_REMOVE_DEPENDENCIES,
    payload: { dependencies, description }
  }),

  recalculateWithDependencies: (): TimelineAction => ({
    type: ActionType.RECALCULATE_WITH_DEPENDENCIES
  }),

  // Typed dependency actions (SS/FF support)
  addTypedDependency: (
    predecessorId: string,
    successorId: string,
    depType: 'FS' | 'SS' | 'FF',
    lag: number = 0
  ): TimelineAction => ({
    type: ActionType.ADD_TYPED_DEPENDENCY,
    payload: { predecessorId, successorId, depType, lag }
  }),

  updateTypedDependency: (
    predecessorId: string,
    successorId: string,
    depType: 'FS' | 'SS' | 'FF',
    lag: number = 0
  ): TimelineAction => ({
    type: ActionType.UPDATE_TYPED_DEPENDENCY,
    payload: { predecessorId, successorId, depType, lag }
  }),

  // ============================================
  // Safety & Fallback UI/system actions
  // ============================================

  setCalcWarning: (message: string | null): TimelineAction => ({
    type: ActionType.SET_CALC_WARNING,
    payload: { message }
  }),

  setLastGoodByAsset: (assetId: string, tasks: TimelineTask[]): TimelineAction => ({
    type: ActionType.SET_LAST_GOOD_BY_ASSET,
    payload: { assetId, tasks }
  })
};
