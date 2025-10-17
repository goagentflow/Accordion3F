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
import { safeToISOString } from '../utils/dateHelpers';

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
    instanceBase: {},
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
    freezeImportedTimeline: false,
    clientCampaignName: ''
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

  const validatedDate = dateValidation.value ? safeToISOString(dateValidation.value) : '';
  
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

  const validatedDate = dateValidation.value ? safeToISOString(dateValidation.value) : '';
  
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

  const validatedDate = dateValidation.value ? safeToISOString(dateValidation.value) : '';
  
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
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.IMPORT_STATE }>
): TimelineState {
  const importedState = action.payload || {};

  // Preserve existing catalog (assets.available, task bank/byAsset) while importing
  // recovered user data. Also ensure we do NOT freeze timeline rebuilds after import.
  const importedTasks = importedState.tasks || {} as any;
  const keepByAsset = state.tasks?.byAsset && Object.keys(state.tasks.byAsset).length > 0
    ? state.tasks.byAsset
    : (importedTasks.byAsset || {});

  return {
    ...state,
    assets: {
      ...state.assets,
      ...(importedState.assets || {}),
      // Always keep the catalog list loaded from CSV
      available: state.assets.available,
    },
    tasks: {
      ...state.tasks,
      ...(importedState.tasks || {}),
      // Prefer the live catalog mapping when present
      byAsset: keepByAsset,
    },
    dates: {
      ...state.dates,
      ...(importedState.dates || {}),
    },
    ui: {
      ...state.ui,
      ...(importedState.ui || {}),
      // Always reset these on import
      showGettingStarted: false,
      showAllInstructions: false,
      // Respect caller's intent: if import path sets freezeImportedTimeline, keep it
      freezeImportedTimeline: (importedState.ui as any)?.freezeImportedTimeline ?? state.ui.freezeImportedTimeline,
    }
  };
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
    ui: {
      ...state.ui,
      clientCampaignName: (importedData as any).clientCampaignName || state.ui.clientCampaignName
    }
    // Additional state restoration logic will be added here
    // For now, keeping it simple to avoid breaking changes
  };
}

// ============================================
// UI: Client/Campaign Name
// ============================================
export function handleSetClientCampaignName(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.SET_CLIENT_CAMPAIGN_NAME }>
): TimelineState {
  // Preserve user input exactly as typed (including spaces) to avoid
  // fighting the cursor during editing. We sanitize on export.
  const raw = (action as any).payload?.name ?? '';
  const name = typeof raw === 'string' ? raw : '';
  return {
    ...state,
    ui: {
      ...state.ui,
      clientCampaignName: name
    }
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
  
  // Update both the names map (for future rebuilds) and the current timeline (so it reflects immediately
  // even when the imported timeline is frozen and Orchestrator is not rebuilding).
  return {
    ...state,
    tasks: {
      ...state.tasks,
      names: {
        ...state.tasks.names,
        [taskId]: nameValidation.sanitized
      },
      timeline: Array.isArray(state.tasks.timeline)
        ? state.tasks.timeline.map(t => t.id === taskId ? { ...t, name: nameValidation.sanitized } : t)
        : state.tasks.timeline
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
