/**
 * Core Reducer Functions for Assets and Tasks
 * Handles fundamental state updates for assets and task management
 * 
 * Following Golden Rule #2: 400 Line Max - Extracted from timelineReducer.ts
 * Following Golden Rule #4: Clear Roles - Core state management separated
 */

import {
  TimelineState,
  TimelineAction,
  ActionType,
  Asset,
  Task
} from '../types/timeline.types';

import { ValidationService } from '../services/ValidationService';

// ============================================
// Helper Functions
// ============================================

/**
 * Helper function to generate unique asset IDs
 */
export const generateAssetId = (): string => {
  return `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Helper function to generate unique task IDs
 */
export const generateTaskId = (): string => {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// Asset Action Handlers
// ============================================

export function handleAddAsset(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.ADD_ASSET }>
): TimelineState {
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
    },
    ui: {
      ...state.ui,
      freezeImportedTimeline: false
    }
  };
}

export function handleRemoveAsset(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.REMOVE_ASSET }>
): TimelineState {
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
    },
    ui: {
      ...state.ui,
      freezeImportedTimeline: false
    }
  };
}

export function handleRenameAsset(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.RENAME_ASSET }>
): TimelineState {
  const { assetId, newName } = action.payload;
  
  const updatedAssets = state.assets.selected.map(asset =>
    asset.id === assetId ? { ...asset, name: newName } : asset
  );

  return {
    ...state,
    assets: {
      ...state.assets,
      selected: updatedAssets
    },
    ui: {
      ...state.ui
      // Do not alter freezeImportedTimeline on rename; preserves imported timeline
    }
  };
}

// ============================================
// Task Action Handlers
// ============================================

export function handleAddCustomTask(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.ADD_CUSTOM_TASK }>
): TimelineState {
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
  // Prefer stable matching: match by type as well as name
  const asset = state.assets.selected.find(a => a.name === assetType || a.type === assetType);
  if (!asset) {
    console.warn('Cannot add custom task: asset not found', assetType);
    return state;
  }

  const newTask: Task = {
    id: generateTaskId(),
    name: nameValidation.sanitized,
    duration: durationValidation.value,
    owner,
    assetId: asset.id,
    assetType: asset.type,
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

  // If the custom task is inserted after another, create a dependency
  let newDeps = state.tasks.deps ? { ...state.tasks.deps } : {};
  if (insertAfterTaskId) {
    newDeps[newTask.id] = [{ predecessorId: insertAfterTaskId, type: 'FS', lag: 0 }];
  }

  // Also update instanceBase when present (editable imported plan)
  let updatedInstanceBase = state.tasks.instanceBase ? { ...state.tasks.instanceBase } : state.tasks.instanceBase;
  if (updatedInstanceBase && Array.isArray(updatedInstanceBase[newTask.assetId])) {
    const baseArr = [...updatedInstanceBase[newTask.assetId]!];
    let baseInsertIndex = baseArr.length;
    if (insertAfterTaskId) {
      const idx = baseArr.findIndex((t: any) => t && t.id === insertAfterTaskId);
      baseInsertIndex = idx !== -1 ? idx + 1 : baseArr.length;
    }
    // Insert minimal Task into instanceBase; dependencies resolved via deps map during orchestration
    baseArr.splice(baseInsertIndex, 0, {
      id: newTask.id,
      name: newTask.name,
      duration: newTask.duration,
      owner: newTask.owner,
      assetId: newTask.assetId,
      assetType: newTask.assetType,
      isCustom: true
    } as any);
    updatedInstanceBase[newTask.assetId] = baseArr as any;
  }

  return {
    ...state,
    tasks: {
      ...state.tasks,
      bank: {
        ...state.tasks.bank,
        [asset.id]: updatedAssetTasks
      },
      custom: [...state.tasks.custom, newTask],
      deps: newDeps,
      instanceBase: updatedInstanceBase || state.tasks.instanceBase
    },
    ui: {
      ...state.ui,
      freezeImportedTimeline: false
    }
  };
}

export function handleUpdateTaskDuration(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.UPDATE_TASK_DURATION }>
): TimelineState {
  const { taskId, assetType, taskName, duration } = action.payload;
  
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
  
  // If taskId is provided, store as per-instance override
  // Otherwise, update the global name-based override (backwards compatibility)
  if (taskId) {
    return {
      ...state,
      tasks: {
        ...state.tasks,
        instanceDurations: {
          ...state.tasks.instanceDurations,
          [taskId]: durationValidation.value
        }
      }
    };
  }
  
  // Fallback to name-based duration override (backwards compatibility)
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

export function handleBulkUpdateDurations(
  state: TimelineState,
  action: Extract<TimelineAction, { type: ActionType.BULK_UPDATE_DURATIONS }>
): TimelineState {
  const { updates } = action.payload;
  
  // Performance guard: Limit bulk updates
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
