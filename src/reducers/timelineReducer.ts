/**
 * Main reducer for Timeline Builder state management
 * Handles all state updates in a predictable, type-safe manner
 */

import {
  TimelineState,
  TimelineAction,
  ActionType,
  Asset,
  Task,
  TimelineTask
} from '../types/timeline.types';

import { 
  ValidationService 
} from '../services/ValidationService';

/**
 * Initial state for the timeline application
 */
export const initialTimelineState: TimelineState = {
  assets: {
    available: [],
    selected: [],
    liveDates: {},
    taskDurations: {}
  },
  tasks: {
    all: [],
    bank: {},
    byAsset: {},
    timeline: [],
    custom: [],
    names: {}
  },
  dates: {
    globalLiveDate: '',
    useGlobalDate: true,
    projectStartDate: '',
    bankHolidays: []
  },
  ui: {
    showInfoBox: true,
    showGettingStarted: false,
    showAllInstructions: false,
    dateErrors: []
  }
};

/**
 * Helper function to generate unique asset IDs
 */
const generateAssetId = (): string => {
  return `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Helper function to generate unique task IDs
 */
const generateTaskId = (): string => {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Main timeline reducer
 * Pure function that returns new state based on actions
 */
export function timelineReducer(
  state: TimelineState = initialTimelineState,
  action: TimelineAction
): TimelineState {
  switch (action.type) {
    // ============================================
    // Asset Actions
    // ============================================
    
    case ActionType.ADD_ASSET: {
      // Performance guard: Check asset limit
      const limitCheck = ValidationService.checkLimits('assets', state.assets.selected.length);
      if (!limitCheck.allowed) {
        console.warn('Asset limit reached:', limitCheck.error);
        return state; // Don't add, return current state
      }

      const { assetType, name, startDate } = action.payload;
      
      // Validate and sanitize asset name
      const nameValidation = ValidationService.validateAssetName(name || assetType);
      if (!nameValidation.valid) {
        console.warn('Invalid asset name:', nameValidation.error);
        return state;
      }

      const newAsset: Asset = {
        id: generateAssetId(),
        type: assetType,
        name: nameValidation.sanitized,
        startDate: startDate || state.dates.globalLiveDate || ''
      };

      return {
        ...state,
        assets: {
          ...state.assets,
          selected: [...state.assets.selected, newAsset]
        }
      };
    }

    case ActionType.REMOVE_ASSET: {
      const { assetId } = action.payload;
      
      // Remove asset from selected
      const filteredAssets = state.assets.selected.filter(
        asset => asset.id !== assetId
      );

      // Also clean up related data
      const newTaskBank = { ...state.tasks.bank };
      delete newTaskBank[assetId];

      // Remove any custom tasks for this asset
      const filteredCustomTasks = state.tasks.custom.filter(
        task => task.assetId !== assetId
      );

      return {
        ...state,
        assets: {
          ...state.assets,
          selected: filteredAssets
        },
        tasks: {
          ...state.tasks,
          bank: newTaskBank,
          custom: filteredCustomTasks
        }
      };
    }

    case ActionType.RENAME_ASSET: {
      const { assetId, newName } = action.payload;
      
      const updatedAssets = state.assets.selected.map(asset =>
        asset.id === assetId ? { ...asset, name: newName } : asset
      );

      return {
        ...state,
        assets: {
          ...state.assets,
          selected: updatedAssets
        }
      };
    }

    case ActionType.SET_ASSET_LIVE_DATE: {
      const { assetName, date } = action.payload;
      
      // Validate date
      const dateValidation = ValidationService.validateDate(date);
      if (!dateValidation.valid) {
        console.warn('Invalid asset live date:', dateValidation.error);
        return state;
      }

      const validatedDate = dateValidation.value?.toISOString().split('T')[0] || '';
      
      return {
        ...state,
        assets: {
          ...state.assets,
          liveDates: {
            ...state.assets.liveDates,
            [assetName]: validatedDate
          }
        }
      };
    }

    case ActionType.SET_ASSET_START_DATE: {
      const { assetId, date } = action.payload;
      
      // Validate date
      const dateValidation = ValidationService.validateDate(date);
      if (!dateValidation.valid) {
        console.warn('Invalid asset start date:', dateValidation.error);
        return state;
      }

      const validatedDate = dateValidation.value?.toISOString().split('T')[0] || '';
      
      const updatedAssets = state.assets.selected.map(asset =>
        asset.id === assetId ? { ...asset, startDate: validatedDate } : asset
      );

      return {
        ...state,
        assets: {
          ...state.assets,
          selected: updatedAssets
        }
      };
    }

    // ============================================
    // Task Actions
    // ============================================
    
    case ActionType.ADD_CUSTOM_TASK: {
      // Performance guard: Check custom task limit
      const customTaskLimit = ValidationService.checkLimits('custom_tasks', state.tasks.custom.length);
      if (!customTaskLimit.allowed) {
        console.warn('Custom task limit reached:', customTaskLimit.error);
        return state;
      }

      // Performance guard: Check total task limit
      const totalTasks = state.tasks.timeline.length + state.tasks.custom.length;
      const totalTaskLimit = ValidationService.checkLimits('tasks', totalTasks);
      if (!totalTaskLimit.allowed) {
        console.warn('Total task limit reached:', totalTaskLimit.error);
        return state;
      }

      const { name, duration, owner, assetType, insertAfterTaskId } = action.payload;
      
      // Validate task name
      const nameValidation = ValidationService.validateTaskName(name);
      if (!nameValidation.valid) {
        console.warn('Invalid task name:', nameValidation.error);
        return state;
      }

      // Validate duration
      const durationValidation = ValidationService.validateDuration(duration);
      if (!durationValidation.valid) {
        console.warn('Invalid task duration:', durationValidation.error);
        return state;
      }

      // Validate owner
      if (!['c', 'm', 'a', 'l'].includes(owner)) {
        console.warn('Invalid task owner:', owner);
        return state;
      }
      
      // Find the asset this task belongs to
      const asset = state.assets.selected.find(a => a.name === assetType);
      if (!asset) {
        console.warn('Cannot add custom task: asset not found', assetType);
        return state;
      }

      const newTask: Task = {
        id: generateTaskId(),
        name: `Custom: ${nameValidation.sanitized}`,
        duration: durationValidation.value,
        owner,
        assetId: asset.id,
        assetType,
        isCustom: true,
        insertAfterTaskId: insertAfterTaskId || null
      };

      // Add to task bank for the asset
      const assetTasks = state.tasks.bank[asset.id] || [];
      let insertIndex = 0;
      
      if (insertAfterTaskId) {
        const afterIndex = assetTasks.findIndex(t => t.id === insertAfterTaskId);
        if (afterIndex !== -1) {
          insertIndex = afterIndex + 1;
        }
      }

      const updatedAssetTasks = [...assetTasks];
      updatedAssetTasks.splice(insertIndex, 0, newTask);

      return {
        ...state,
        tasks: {
          ...state.tasks,
          bank: {
            ...state.tasks.bank,
            [asset.id]: updatedAssetTasks
          },
          custom: [...state.tasks.custom, newTask]
        }
      };
    }

    case ActionType.UPDATE_TASK_DURATION: {
      const { assetType, taskName, duration } = action.payload;
      
      // Validate duration
      const durationValidation = ValidationService.validateDuration(duration);
      if (!durationValidation.valid) {
        console.warn('Invalid task duration:', durationValidation.error);
        return state;
      }

      // Validate asset type and task name are not empty
      if (!assetType || !taskName) {
        console.warn('Asset type and task name are required for duration update');
        return state;
      }
      
      return {
        ...state,
        assets: {
          ...state.assets,
          taskDurations: {
            ...state.assets.taskDurations,
            [assetType]: {
              ...state.assets.taskDurations[assetType],
              [taskName]: durationValidation.value
            }
          }
        }
      };
    }

    case ActionType.RENAME_TASK: {
      const { taskId, newName } = action.payload;
      
      // Validate task name
      const nameValidation = ValidationService.validateTaskName(newName);
      if (!nameValidation.valid) {
        console.warn('Invalid task name:', nameValidation.error);
        return state;
      }
      
      return {
        ...state,
        tasks: {
          ...state.tasks,
          names: {
            ...state.tasks.names,
            [taskId]: nameValidation.sanitized
          }
        }
      };
    }

    case ActionType.UPDATE_TASK_BANK: {
      const { taskBank } = action.payload;
      
      return {
        ...state,
        tasks: {
          ...state.tasks,
          all: taskBank,
          byAsset: taskBank.reduce((acc, task) => {
            const assetType = task.assetType || 'Other';
            if (!acc[assetType]) {
              acc[assetType] = [];
            }
            acc[assetType].push(task);
            return acc;
          }, {} as Record<string, Task[]>)
        }
      };
    }

    case ActionType.BULK_UPDATE_DURATIONS: {
      const { updates } = action.payload;
      
      // Performance guard: Limit bulk update size
      if (updates.length > 100) {
        console.warn('Bulk update too large, limiting to first 100 items');
        updates.splice(100);
      }
      
      // Validate all durations before applying any updates
      const validatedUpdates = updates.filter(update => {
        const validation = ValidationService.validateDuration(update.duration);
        if (!validation.valid) {
          console.warn(`Invalid duration for ${update.assetType}-${update.taskName}:`, validation.error);
          return false;
        }
        return true;
      });

      // Create a map for quick lookup with validated values
      const updateMap = new Map(
        validatedUpdates.map(u => {
          const validation = ValidationService.validateDuration(u.duration);
          return [`${u.assetType}-${u.taskName}`, validation.value];
        })
      );
      
      // Update all tasks in the task bank
      const updatedTasks = state.tasks.all.map(task => {
        const key = `${task.assetType}-${task.name}`;
        const newDuration = updateMap.get(key);
        
        if (newDuration !== undefined) {
          return { ...task, duration: newDuration };
        }
        return task;
      });
      
      // Update byAsset mapping
      const updatedByAsset = updatedTasks.reduce((acc, task) => {
        const assetType = task.assetType || 'Other';
        if (!acc[assetType]) {
          acc[assetType] = [];
        }
        acc[assetType].push(task);
        return acc;
      }, {} as Record<string, Task[]>);
      
      return {
        ...state,
        tasks: {
          ...state.tasks,
          all: updatedTasks,
          byAsset: updatedByAsset
        }
      };
    }

    // ============================================
    // Date Actions
    // ============================================
    
    case ActionType.SET_GLOBAL_LIVE_DATE: {
      const { date } = action.payload;
      
      // Validate date
      const dateValidation = ValidationService.validateDate(date);
      if (!dateValidation.valid) {
        console.warn('Invalid global live date:', dateValidation.error);
        return state;
      }

      const validatedDate = dateValidation.value?.toISOString().split('T')[0] || '';
      
      // If using global date, update all asset start dates
      let updatedAssets = state.assets.selected;
      if (state.dates.useGlobalDate) {
        updatedAssets = state.assets.selected.map(asset => ({
          ...asset,
          startDate: validatedDate
        }));
      }

      return {
        ...state,
        dates: {
          ...state.dates,
          globalLiveDate: validatedDate
        },
        assets: {
          ...state.assets,
          selected: updatedAssets
        }
      };
    }

    case ActionType.TOGGLE_USE_GLOBAL_DATE: {
      const newUseGlobalDate = !state.dates.useGlobalDate;
      
      // If switching to global date, sync all assets to global date
      let updatedAssets = state.assets.selected;
      if (newUseGlobalDate && state.dates.globalLiveDate) {
        updatedAssets = state.assets.selected.map(asset => ({
          ...asset,
          startDate: state.dates.globalLiveDate
        }));
      }

      return {
        ...state,
        dates: {
          ...state.dates,
          useGlobalDate: newUseGlobalDate
        },
        assets: {
          ...state.assets,
          selected: updatedAssets
        }
      };
    }

    case ActionType.SET_BANK_HOLIDAYS: {
      const { holidays } = action.payload;
      
      return {
        ...state,
        dates: {
          ...state.dates,
          bankHolidays: holidays
        }
      };
    }

    // ============================================
    // Calculated State Actions
    // ============================================
    
    case ActionType.UPDATE_TIMELINE: {
      const { timeline } = action.payload;
      
      return {
        ...state,
        tasks: {
          ...state.tasks,
          timeline
        }
      };
    }

    case ActionType.SET_DATE_ERRORS: {
      const { errors } = action.payload;
      
      return {
        ...state,
        ui: {
          ...state.ui,
          dateErrors: errors
        }
      };
    }

    case ActionType.SET_PROJECT_START_DATE: {
      const { date } = action.payload;
      
      return {
        ...state,
        dates: {
          ...state.dates,
          projectStartDate: date
        }
      };
    }

    case ActionType.SET_CALCULATED_START_DATES: {
      const { dates } = action.payload;
      
      return {
        ...state,
        dates: {
          ...state.dates,
          calculatedStartDates: dates
        }
      };
    }

    // ============================================
    // UI Actions
    // ============================================
    
    case ActionType.TOGGLE_INFO_BOX: {
      return {
        ...state,
        ui: {
          ...state.ui,
          showInfoBox: !state.ui.showInfoBox
        }
      };
    }

    case ActionType.SET_GETTING_STARTED: {
      const { show } = action.payload;
      
      return {
        ...state,
        ui: {
          ...state.ui,
          showGettingStarted: show
        }
      };
    }

    case ActionType.SET_ALL_INSTRUCTIONS: {
      const { show } = action.payload;
      
      return {
        ...state,
        ui: {
          ...state.ui,
          showAllInstructions: show
        }
      };
    }

    // ============================================
    // System Actions
    // ============================================
    
    case ActionType.LOAD_CSV_DATA: {
      const { uniqueAssets } = action.payload;
      
      return {
        ...state,
        assets: {
          ...state.assets,
          available: uniqueAssets
        }
        // CSV data will be processed into task bank separately
      };
    }

    case ActionType.IMPORT_STATE: {
      const importedState = action.payload;
      
      // Robust deep merge: merge each top-level key individually
      // This ensures new properties added to initial state aren't lost
      return {
        // Start with clean initial state to get all default properties
        ...initialTimelineState,
        
        // Merge assets state
        assets: {
          ...initialTimelineState.assets,
          ...(importedState.assets || {}),
        },
        
        // Merge tasks state
        tasks: {
          ...initialTimelineState.tasks,
          ...(importedState.tasks || {}),
        },
        
        // Merge dates state
        dates: {
          ...initialTimelineState.dates,
          ...(importedState.dates || {}),
        },
        
        // Merge UI state, but reset certain flags
        ui: {
          ...initialTimelineState.ui,
          ...(importedState.ui || {}),
          // Always reset these on import
          showGettingStarted: false,
          showAllInstructions: false,
        }
      };
    }

    case ActionType.CLEAR_ALL: {
      return initialTimelineState;
    }
    
    case ActionType.IMPORT_TIMELINE: {
      const { importedData } = action.payload;
      
      // Transform imported data back to timeline state
      // This is a simplified transformation - may need adjustment based on actual imported data structure
      return {
        ...initialTimelineState,
        tasks: {
          ...initialTimelineState.tasks,
          timeline: importedData.tasks || [],
        },
        // Additional state restoration logic will be added here
        // For now, keeping it simple to avoid breaking changes
      };
    }
    
    case ActionType.RESET_STATE: {
      return initialTimelineState;
    }

    default: {
      // TypeScript exhaustiveness check - this should never be reached
      throw new Error(`Unhandled action type: ${(action as any).type}`);
    }
  }
}

/**
 * Action creator helper functions
 * These provide type-safe ways to create actions
 */
export const TimelineActions = {
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

  updateTimeline: (timeline: TimelineTask[]): TimelineAction => ({
    type: ActionType.UPDATE_TIMELINE,
    payload: { timeline }
  }),

  loadCsvData: (csvData: any[], uniqueAssets: string[]): TimelineAction => ({
    type: ActionType.LOAD_CSV_DATA,
    payload: { csvData, uniqueAssets }
  }),

  importState: (state: Partial<TimelineState>): TimelineAction => ({
    type: ActionType.IMPORT_STATE,
    payload: state
  }),

  updateTaskBank: (taskBank: Task[]): TimelineAction => ({
    type: ActionType.UPDATE_TASK_BANK,
    payload: { taskBank }
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
  })
};