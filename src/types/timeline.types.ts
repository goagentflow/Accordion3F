/**
 * Type definitions for the Timeline Builder application
 * This file defines all TypeScript interfaces and types used throughout the refactored application
 */

// ============================================
// Core Data Types
// ============================================

export interface Asset {
  id: string;
  type: string;        // Asset type from CSV (e.g., "Digital Display - Creative")
  name: string;        // User-customizable name
  startDate: string;   // ISO date string (YYYY-MM-DD)
}

export interface Task {
  id: string;
  name: string;
  duration: number;     // Duration in working days
  owner: 'c' | 'm' | 'a' | 'l';  // client | MMM | agency | live
  assetId: string;      // Reference to parent asset
  assetType: string;    // Denormalized for easier filtering
  isCustom: boolean;
  insertAfterTaskId?: string | null;
  
  // NEW: Optional dependency tracking for DAG calculator (null/undefined for sequential tasks)
  dependencies?: Array<{
    predecessorId: string;    // Which task this depends on
    type: 'FS' | 'SS' | 'FF'; // Dependency type: Finish-Start, Start-Start, Finish-Finish
    lag: number;              // Working-day lag (negative = overlap)
  }>;
}

export interface TimelineTask extends Task {
  start: string;        // ISO date string
  end: string;          // ISO date string
  progress: number;     // 0-100
  
  // DAG-specific properties (added by TimelineCalculatorDAG)
  isCritical?: boolean;     // True if task is on critical path
  totalFloat?: number;      // Float time available for task scheduling
}

// ============================================
// State Shape
// ============================================

export interface AssetsState {
  available: string[];           // Asset types from CSV
  selected: Asset[];             // User-selected asset instances
  liveDates: Record<string, string>;      // assetName -> ISO date
  taskDurations: Record<string, Record<string, number>>; // assetType -> taskName -> duration
}

export interface TasksState {
  all: Task[];                   // All tasks from CSV
  bank: Record<string, Task[]>;  // assetId -> Task[] (for backward compat)
  byAsset: Record<string, Task[]>; // Grouped by asset type
  // NEW: Per-asset instance base tasks (used when importing an editable plan)
  instanceBase?: Record<string, Task[]>; // assetId -> Task[]
  instanceDurations: Record<string, number>; // taskId -> duration (per-instance overrides)
  timeline: TimelineTask[];      // Calculated timeline with dates
  custom: Task[];                // User-added custom tasks
  names: Record<string, string>; // taskId -> custom name
  // NEW: Explicit dependencies keyed by successor task ID
  deps?: Record<string, Array<{ predecessorId: string; type: 'FS' | 'SS' | 'FF'; lag: number }>>;
  // NEW: Last known good timelines per asset (for graceful fallback)
  lastGoodByAsset?: Record<string, TimelineTask[]>;
}

export interface DatesState {
  globalLiveDate: string;
  useGlobalDate: boolean;
  projectStartDate: string;
  bankHolidays: string[];        // Array of ISO date strings
  calculatedStartDates?: Record<string, string>; // assetId -> ISO date (optional for migration)
}

export interface UIState {
  showInfoBox: boolean;
  showGettingStarted: boolean;
  showAllInstructions: boolean;
  dateErrors: string[];          // Array of asset IDs with conflicts
  // When true, Orchestrator will not rebuild timeline after an Excel import
  // and will only compute derived warnings (earliest starts, conflicts)
  freezeImportedTimeline?: boolean;
  // Project identity field shown in UI and exported to Excel
  clientCampaignName?: string;
  // CALC warning banner for graceful fallback (non-blocking)
  calcWarning?: string | null;
}

export interface TimelineState {
  assets: AssetsState;
  tasks: TasksState;
  dates: DatesState;
  ui: UIState;
  status: 'loading' | 'ready' | 'error' | 'hydrating';
}

// ============================================
// Action Types
// ============================================

export enum ActionType {
  // Asset actions
  ADD_ASSET = 'ADD_ASSET',
  REMOVE_ASSET = 'REMOVE_ASSET',
  RENAME_ASSET = 'RENAME_ASSET',
  SET_ASSET_LIVE_DATE = 'SET_ASSET_LIVE_DATE',
  SET_ASSET_START_DATE = 'SET_ASSET_START_DATE',
  
  // Task actions
  ADD_CUSTOM_TASK = 'ADD_CUSTOM_TASK',
  UPDATE_TASK_DURATION = 'UPDATE_TASK_DURATION',
  RENAME_TASK = 'RENAME_TASK',
  MOVE_TASK = 'MOVE_TASK', // Correctly handle drag-and-drop repositioning
  REMOVE_TASK = 'REMOVE_TASK',
  UPDATE_TASK_BANK = 'UPDATE_TASK_BANK',
  BULK_UPDATE_DURATIONS = 'BULK_UPDATE_DURATIONS',
  
  // NEW: Dependency actions for DAG calculator
  ADD_DEPENDENCY = 'ADD_DEPENDENCY',
  REMOVE_DEPENDENCY = 'REMOVE_DEPENDENCY',
  UPDATE_DEPENDENCY = 'UPDATE_DEPENDENCY',
  ADD_TYPED_DEPENDENCY = 'ADD_TYPED_DEPENDENCY',
  UPDATE_TYPED_DEPENDENCY = 'UPDATE_TYPED_DEPENDENCY',
  CLEAR_ALL_DEPENDENCIES = 'CLEAR_ALL_DEPENDENCIES',
  RECALCULATE_WITH_DEPENDENCIES = 'RECALCULATE_WITH_DEPENDENCIES',
  
  // Bulk dependency actions (for proper undo/redo)
  BULK_ADD_DEPENDENCIES = 'BULK_ADD_DEPENDENCIES',
  BULK_REMOVE_DEPENDENCIES = 'BULK_REMOVE_DEPENDENCIES',
  
  // Date actions
  SET_GLOBAL_LIVE_DATE = 'SET_GLOBAL_LIVE_DATE',
  TOGGLE_USE_GLOBAL_DATE = 'TOGGLE_USE_GLOBAL_DATE',
  SET_BANK_HOLIDAYS = 'SET_BANK_HOLIDAYS',
  
  // Calculated state actions
  UPDATE_TIMELINE = 'UPDATE_TIMELINE',
  SET_DATE_ERRORS = 'SET_DATE_ERRORS',
  SET_PROJECT_START_DATE = 'SET_PROJECT_START_DATE',
  SET_CALCULATED_START_DATES = 'SET_CALCULATED_START_DATES',
  
  // UI actions
  TOGGLE_INFO_BOX = 'TOGGLE_INFO_BOX',
  SET_GETTING_STARTED = 'SET_GETTING_STARTED',
  SET_ALL_INSTRUCTIONS = 'SET_ALL_INSTRUCTIONS',
  
  // System actions
  LOAD_CSV_DATA = 'LOAD_CSV_DATA',
  IMPORT_STATE = 'IMPORT_STATE',
  RESET_STATE = 'RESET_STATE',
  CLEAR_ALL = 'CLEAR_ALL',
  IMPORT_TIMELINE = 'IMPORT_TIMELINE',
  // UI/project metadata
  SET_CLIENT_CAMPAIGN_NAME = 'SET_CLIENT_CAMPAIGN_NAME',
  
  // NEW: Manipulation bug fix actions
  DRAG_TASK = 'DRAG_TASK',
  HYDRATE_FROM_STORAGE = 'HYDRATE_FROM_STORAGE',
  
  // NEW: Undo/redo actions  
  UNDO = 'UNDO',
  REDO = 'REDO',
  
  // NEW: Safety & Fallback UI/system actions
  SET_CALC_WARNING = 'SET_CALC_WARNING',
  SET_LAST_GOOD_BY_ASSET = 'SET_LAST_GOOD_BY_ASSET'
}

// ============================================
// Action Payloads
// ============================================

export interface AddAssetAction {
  type: ActionType.ADD_ASSET;
  payload: {
    assetType: string;
    name?: string;
    startDate?: string;
  };
}

export interface RemoveAssetAction {
  type: ActionType.REMOVE_ASSET;
  payload: {
    assetId: string;
  };
}

export interface RenameAssetAction {
  type: ActionType.RENAME_ASSET;
  payload: {
    assetId: string;
    newName: string;
  };
}

export interface SetAssetLiveDateAction {
  type: ActionType.SET_ASSET_LIVE_DATE;
  payload: {
    assetName: string;
    date: string;
  };
}

export interface SetAssetStartDateAction {
  type: ActionType.SET_ASSET_START_DATE;
  payload: {
    assetId: string;
    date: string;
  };
}

export interface AddCustomTaskAction {
  type: ActionType.ADD_CUSTOM_TASK;
  payload: {
    name: string;
    duration: number;
    owner: 'c' | 'm' | 'a' | 'l';
    assetType: string;
    insertAfterTaskId?: string;
  };
}

export interface UpdateTaskDurationAction {
  type: ActionType.UPDATE_TASK_DURATION;
  payload: {
    taskId: string;
    assetType: string;
    taskName: string;
    duration: number;
  };
}

export interface MoveTaskAction {
  type: ActionType.MOVE_TASK;
  payload: {
    taskId: string;
    newStartDate: string;
  };
}

export interface RemoveTaskAction {
  type: ActionType.REMOVE_TASK;
  payload: {
    taskId: string;
    assetId: string;
  };
}

export interface BulkUpdateDurationsAction {
  type: ActionType.BULK_UPDATE_DURATIONS;
  payload: {
    updates: Array<{ taskId: string; assetType: string; taskName: string; duration: number }>;
  };
}

export interface UpdateTaskBankAction {
  type: ActionType.UPDATE_TASK_BANK;
  payload: {
    taskBank: Task[];
  };
}

export interface SetDateErrorsAction {
  type: ActionType.SET_DATE_ERRORS;
  payload: {
    errors: string[];
  };
}

export interface SetCalculatedStartDatesAction {
  type: ActionType.SET_CALCULATED_START_DATES;
  payload: {
    dates: Record<string, string>; // ISO date strings
  };
}

export interface RenameTaskAction {
  type: ActionType.RENAME_TASK;
  payload: {
    taskId: string;
    newName: string;
  };
}

export interface SetCalcWarningAction {
  type: ActionType.SET_CALC_WARNING;
  payload: { message: string | null };
}

export interface SetLastGoodByAssetAction {
  type: ActionType.SET_LAST_GOOD_BY_ASSET;
  payload: { assetId: string; tasks: TimelineTask[] };
}

export interface SetGlobalLiveDateAction {
  type: ActionType.SET_GLOBAL_LIVE_DATE;
  payload: {
    date: string;
  };
}

export interface ToggleUseGlobalDateAction {
  type: ActionType.TOGGLE_USE_GLOBAL_DATE;
  payload?: never;
}

export interface SetBankHolidaysAction {
  type: ActionType.SET_BANK_HOLIDAYS;
  payload: {
    holidays: string[];
  };
}

export interface UpdateTimelineAction {
  type: ActionType.UPDATE_TIMELINE;
  payload: {
    timeline: TimelineTask[];
  };
}

export interface LoadCsvDataAction {
  type: ActionType.LOAD_CSV_DATA;
  payload: {
    csvData: any[];
    uniqueAssets: string[];
  };
}

export interface ImportStateAction {
  type: ActionType.IMPORT_STATE;
  payload: Partial<TimelineState>;
}

export interface ResetStateAction {
  type: ActionType.RESET_STATE;
  payload?: never;
}

export interface ClearAllAction {
  type: ActionType.CLEAR_ALL;
  payload?: never;
}

export interface ImportTimelineAction {
  type: ActionType.IMPORT_TIMELINE;
  payload: {
    importedData: any; // Will contain the imported Excel data
  };
}

export interface ToggleInfoBoxAction {
  type: ActionType.TOGGLE_INFO_BOX;
}

export interface SetGettingStartedAction {
  type: ActionType.SET_GETTING_STARTED;
  payload: {
    show: boolean;
  };
}

export interface SetAllInstructionsAction {
  type: ActionType.SET_ALL_INSTRUCTIONS;
  payload: {
    show: boolean;
  };
}

export interface SetProjectStartDateAction {
  type: ActionType.SET_PROJECT_START_DATE;
  payload: {
    date: string;
  };
}

// NEW: Dependency action payloads for DAG calculator
export interface AddDependencyAction {
  type: ActionType.ADD_DEPENDENCY;
  payload: {
    predecessorId: string;
    successorId: string;
    overlapDays: number; // Positive number (converted to negative lag internally)
  };
}

export interface RemoveDependencyAction {
  type: ActionType.REMOVE_DEPENDENCY;
  payload: {
    successorId: string;
    predecessorId?: string; // If not provided, remove all dependencies for successor
  };
}

export interface UpdateDependencyAction {
  type: ActionType.UPDATE_DEPENDENCY;
  payload: {
    predecessorId: string;
    successorId: string;
    overlapDays: number;
  };
}

export interface ClearAllDependenciesAction {
  type: ActionType.CLEAR_ALL_DEPENDENCIES;
  payload?: never;
}

export interface BulkAddDependenciesAction {
  type: ActionType.BULK_ADD_DEPENDENCIES;
  payload: {
    dependencies: Array<{
      predecessorId: string;
      successorId: string;
      overlapDays: number;
    }>;
    description?: string; // Optional description for undo/redo display
  };
}

export interface BulkRemoveDependenciesAction {
  type: ActionType.BULK_REMOVE_DEPENDENCIES;
  payload: {
    dependencies: Array<{
      predecessorId: string;
      successorId: string;
    }>;
    description?: string;
  };
}

export interface RecalculateWithDependenciesAction {
  type: ActionType.RECALCULATE_WITH_DEPENDENCIES;
  payload?: never;
}

export interface AddTypedDependencyAction {
  type: ActionType.ADD_TYPED_DEPENDENCY;
  payload: {
    predecessorId: string;
    successorId: string;
    depType: 'FS' | 'SS' | 'FF';
    lag: number;
  };
}

export interface UpdateTypedDependencyAction {
  type: ActionType.UPDATE_TYPED_DEPENDENCY;
  payload: {
    predecessorId: string;
    successorId: string;
    depType: 'FS' | 'SS' | 'FF';
    lag: number;
  };
}

// NEW: Manipulation bug fix action payloads
export interface DragTaskAction {
  type: ActionType.DRAG_TASK;
  payload: {
    taskId: string;
    deltaX: number; // Horizontal drag distance in pixels
    deltaY: number; // Vertical drag distance in pixels
  };
}

export interface HydrateFromStorageAction {
  type: ActionType.HYDRATE_FROM_STORAGE;
  payload: Partial<TimelineState>;
}

export interface UndoAction {
  type: ActionType.UNDO;
  payload?: never;
}

export interface RedoAction {
  type: ActionType.REDO;
  payload?: never;
}

export interface SetClientCampaignNameAction {
  type: ActionType.SET_CLIENT_CAMPAIGN_NAME;
  payload: { name: string };
}

// Union type of all actions
export type TimelineAction =
  | AddAssetAction
  | RemoveAssetAction
  | RenameAssetAction
  | SetAssetLiveDateAction
  | SetAssetStartDateAction
  | AddCustomTaskAction
  | UpdateTaskDurationAction
  | MoveTaskAction
  | RemoveTaskAction
  | BulkUpdateDurationsAction
  | UpdateTaskBankAction
  | SetDateErrorsAction
  | SetCalculatedStartDatesAction
  | RenameTaskAction
  | SetGlobalLiveDateAction
  | ToggleUseGlobalDateAction
  | SetBankHolidaysAction
  | UpdateTimelineAction
  | LoadCsvDataAction
  | ImportStateAction
  | ResetStateAction
  | ClearAllAction
  | ImportTimelineAction
  | ToggleInfoBoxAction
  | SetGettingStartedAction
  | SetAllInstructionsAction
  | SetProjectStartDateAction
  | AddDependencyAction
  | RemoveDependencyAction
  | UpdateDependencyAction
  | ClearAllDependenciesAction
  | BulkAddDependenciesAction
  | BulkRemoveDependenciesAction
  | RecalculateWithDependenciesAction
  | SetCalcWarningAction
  | SetLastGoodByAssetAction
  | AddTypedDependencyAction
  | UpdateTypedDependencyAction
  | DragTaskAction
  | HydrateFromStorageAction
  | UndoAction
  | RedoAction
  | SetClientCampaignNameAction;

// ============================================
// Dependency Validation Types
// ============================================

export interface DependencyValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface DependencyValidationError {
  taskId: string;
  dependencyIndex: number;
  error: string;
  severity: 'error' | 'warning';
}

// ============================================
// Context Types
// ============================================

export interface TimelineContextValue {
  state: TimelineState;
  dispatch: React.Dispatch<TimelineAction>;
  // Helper functions that will be exposed via context
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Hydration status for recovery/catalog readiness
  isHydrating?: boolean;
}

// ============================================
// Utility Types
// ============================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface WorkingDaysResult {
  available: number;
  allocated: number;
  needed: number;
}

export interface AssetAlert {
  assetId: string;
  assetName: string;
  assetType: string;
  daysNeeded: number;
  daysSaved: number;
  startDate: string;
  isCritical: boolean;
}

// ============================================
// CSV Data Types
// ============================================

export interface CsvRow {
  'Asset Type': string;
  'Task': string;
  'Duration (Days)': string;
  'owner': 'c' | 'm' | 'a' | 'l';
}
