/**
 * System Reducer Functions for Dates, UI, and System Operations
 * Handles dates, UI state, and system-level actions
 * 
 * Following Golden Rule #2: 400 Line Max - Extracted from timelineReducer.ts
 * Following Golden Rule #4: Clear Roles - System state management separated
 */

import {
  TimelineState,
  TimelineAction,
  ActionType,
  Task
} from '../types/timeline.types';

import { ValidationService } from '../services/ValidationService';

// ============================================
// Initial State
// ============================================

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
    instanceDurations: {},
    timeline: [],
    custom: [],
    names: {},
    deps: {}
  },
  dates: {
    globalLiveDate: '',
    useGlobalDate: true,
    projectStartDate: '',
    bankHolidays: [],
    calculatedStartDates: {}
  },
  ui: {
    showInfoBox: true,
    showGettingStarted: false,
    showAllInstructions: false,
    dateErrors: [],
    freezeImportedTimeline: false
  },
  status: 'ready'
};

// ============================================
// Date Action Handlers
// ============================================

export function handleSetGlobalLiveDate(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.SET_GLOBAL_LIVE_DATE }>
): TimelineState {
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

export function handleToggleUseGlobalDate(state: TimelineState): TimelineState {
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

export function handleSetBankHolidays(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.SET_BANK_HOLIDAYS }>
): TimelineState {
  const { holidays } = action.payload;
  
  return {
    ...state,
    dates: {
      ...state.dates,
      bankHolidays: holidays
    }
  };
}

export function handleSetAssetLiveDate(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.SET_ASSET_LIVE_DATE }>
): TimelineState {
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
    },
    ui: {
      ...state.ui,
      freezeImportedTimeline: false
    }
  };
}

export function handleSetAssetStartDate(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.SET_ASSET_START_DATE }>
): TimelineState {
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
    },
    ui: {
      ...state.ui,
      freezeImportedTimeline: false
    }
  };
}

// ============================================
// Calculated State Action Handlers
// ============================================

export function handleUpdateTimeline(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.UPDATE_TIMELINE }>
): TimelineState {
  const { timeline } = action.payload;
  
  return {
    ...state,
    tasks: {
      ...state.tasks,
      timeline
    }
  };
}

export function handleSetDateErrors(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.SET_DATE_ERRORS }>
): TimelineState {
  const { errors } = action.payload;
  
  return {
    ...state,
    ui: {
      ...state.ui,
      dateErrors: errors
    }
  };
}

export function handleSetProjectStartDate(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.SET_PROJECT_START_DATE }>
): TimelineState {
  const { date } = action.payload;
  
  return {
    ...state,
    dates: {
      ...state.dates,
      projectStartDate: date
    }
  };
}

export function handleSetCalculatedStartDates(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.SET_CALCULATED_START_DATES }>
): TimelineState {
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
// UI Action Handlers
// ============================================

export function handleToggleInfoBox(state: TimelineState): TimelineState {
  return {
    ...state,
    ui: {
      ...state.ui,
      showInfoBox: !state.ui.showInfoBox
    }
  };
}

export function handleSetGettingStarted(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.SET_GETTING_STARTED }>
): TimelineState {
  const { show } = action.payload;
  
  return {
    ...state,
    ui: {
      ...state.ui,
      showGettingStarted: show
    }
  };
}

export function handleSetAllInstructions(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.SET_ALL_INSTRUCTIONS }>
): TimelineState {
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
// System Action Handlers
// ============================================

export function handleLoadCsvData(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.LOAD_CSV_DATA }>
): TimelineState {
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

export function handleImportState(
  _state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.IMPORT_STATE }>
): TimelineState {
  const importedState = action.payload;
  
  // Start with clean initial state to get all default properties
  const mergedState: TimelineState = {
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
  
  return mergedState;
}

export function handleImportTimeline(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.IMPORT_TIMELINE }>
): TimelineState {
  const { importedData } = action.payload;
  
  // Merge the imported timeline data
  return {
    ...state,
    tasks: {
      ...initialTimelineState.tasks,
      timeline: importedData.tasks || [],
    },
    // Additional state restoration logic will be added here
    // For now, keeping it simple to avoid breaking changes
  };
}

export function handleRenameTask(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.RENAME_TASK }>
): TimelineState {
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

export function handleUpdateTaskBank(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.UPDATE_TASK_BANK }>
): TimelineState {
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
