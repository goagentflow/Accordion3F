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
}

export interface TimelineTask extends Task {
  start: string;        // ISO date string
  end: string;          // ISO date string
  progress: number;     // 0-100
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
  timeline: TimelineTask[];      // Calculated timeline with dates
  custom: Task[];                // User-added custom tasks
  names: Record<string, string>; // taskId -> custom name
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
}

export interface TimelineState {
  assets: AssetsState;
  tasks: TasksState;
  dates: DatesState;
  ui: UIState;
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
  UPDATE_TASK_BANK = 'UPDATE_TASK_BANK',
  BULK_UPDATE_DURATIONS = 'BULK_UPDATE_DURATIONS',
  
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
  IMPORT_TIMELINE = 'IMPORT_TIMELINE'
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

// Union type of all actions
export type TimelineAction =
  | AddAssetAction
  | RemoveAssetAction
  | RenameAssetAction
  | SetAssetLiveDateAction
  | SetAssetStartDateAction
  | AddCustomTaskAction
  | UpdateTaskDurationAction
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
  | SetProjectStartDateAction;

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