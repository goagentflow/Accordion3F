/**
 * Timeline Selector Hooks
 * Convenience hooks for specific state slices and computed values
 * 
 * Following Golden Rule #2: 400 Line Max - Extracted from useTimeline.tsx  
 * Following Golden Rule #4: Clear Roles - Selector hooks separated
 */

import { useCallback, useMemo } from 'react';
import { useTimeline } from './useTimeline';
import { TimelineActions } from '../actions/timelineActions';
import { calculateAssetConflicts, AssetAlert } from '../services/AssetConflictCalculator';

// ============================================
// State Slice Hooks  
// ============================================

/**
 * useAssets Hook
 * Provides access to assets state slice and related actions
 */
export const useAssets = () => {
  const { state, dispatch } = useTimeline();
  
  const addAsset = useCallback(
    (assetType: string, name?: string) => {
      dispatch(TimelineActions.addAsset(assetType, name, state.dates.globalLiveDate));
    },
    [dispatch, state.dates.globalLiveDate]
  );

  const removeAsset = useCallback(
    (assetId: string) => {
      dispatch(TimelineActions.removeAsset(assetId));
    },
    [dispatch]
  );

  const renameAsset = useCallback(
    (assetId: string, newName: string) => {
      dispatch(TimelineActions.renameAsset(assetId, newName));
    },
    [dispatch]
  );

  const setAssetStartDate = useCallback(
    (assetId: string, date: string) => {
      dispatch(TimelineActions.setAssetStartDate(assetId, date));
    },
    [dispatch]
  );

  return {
    assets: state.assets,
    addAsset,
    removeAsset,
    renameAsset,
    setAssetStartDate
  };
};

/**
 * useTasks Hook
 * Provides access to tasks state slice and related actions
 */
export const useTasks = () => {
  const { state, dispatch } = useTimeline();
  
  const addCustomTask = useCallback(
    (name: string, duration: number, owner: 'c' | 'm' | 'a' | 'l', assetType: string, insertAfterTaskId?: string) => {
      dispatch(TimelineActions.addCustomTask(name, duration, owner, assetType, insertAfterTaskId));
    },
    [dispatch]
  );

  const updateTaskDuration = useCallback(
    (taskId: string, assetType: string, taskName: string, duration: number) => {
      dispatch(TimelineActions.updateTaskDuration(taskId, assetType, taskName, duration));
    },
    [dispatch]
  );

  const renameTask = useCallback(
    (taskId: string, newName: string) => {
      dispatch(TimelineActions.renameTask(taskId, newName));
    },
    [dispatch]
  );

  return {
    tasks: state.tasks,
    addCustomTask,
    updateTaskDuration,
    renameTask
  };
};

/**
 * useDates Hook
 * Provides access to dates state slice and related actions
 */
export const useDates = () => {
  const { state, dispatch } = useTimeline();
  
  const setGlobalLiveDate = useCallback(
    (date: string) => {
      dispatch(TimelineActions.setGlobalLiveDate(date));
    },
    [dispatch]
  );

  const toggleUseGlobalDate = useCallback(() => {
    dispatch(TimelineActions.toggleUseGlobalDate());
  }, [dispatch]);

  const setBankHolidays = useCallback(
    (holidays: string[]) => {
      dispatch(TimelineActions.setBankHolidays(holidays));
    },
    [dispatch]
  );

  return {
    dates: state.dates,
    setGlobalLiveDate,
    toggleUseGlobalDate,
    setBankHolidays
  };
};

/**
 * useUI Hook
 * Provides access to UI state slice
 */
export const useUI = () => {
  const { state } = useTimeline();
  
  return {
    ui: state.ui,
    dateErrors: state.ui.dateErrors,
    calculatedStartDates: state.dates.calculatedStartDates || {},
    showInfoBox: state.ui.showInfoBox
  };
};

// ============================================
// Selector Hooks for Computed Values
// ============================================

/**
 * useSelectedAssets Hook
 * Returns just the selected assets array
 */
export const useSelectedAssets = () => {
  const { state } = useTimeline();
  return state.assets.selected;
};

/**
 * useTimelineTasks Hook
 * Returns the calculated timeline tasks
 */
export const useTimelineTasks = () => {
  const { state } = useTimeline();
  return state.tasks.timeline;
};

/**
 * useHasDateErrors Hook
 * Returns whether there are any date conflicts
 */
export const useHasDateErrors = () => {
  const { state } = useTimeline();
  return state.ui.dateErrors.length > 0;
};

/**
 * useProjectDates Hook
 * Returns key project dates
 */
export const useProjectDates = () => {
  const { state } = useTimeline();
  return {
    globalLiveDate: state.dates.globalLiveDate,
    projectStartDate: state.dates.projectStartDate,
    useGlobalDate: state.dates.useGlobalDate
  };
};

/**
 * useAssetConflicts Hook
 * Returns asset-specific conflict data for display in GanttAssetAlerts
 * Mirrors V1's calculateWorkingDaysNeededPerAsset logic
 */
export const useAssetConflicts = (): AssetAlert[] => {
  const { state } = useTimeline();
  
  return useMemo(() => {
    // Only calculate if we have the necessary data
    if (!state.dates?.calculatedStartDates || 
        !state.ui?.dateErrors || 
        state.ui.dateErrors.length === 0) {
      return [];
    }
    
    // Calculate conflicts for assets with date errors
    return calculateAssetConflicts(
      state.assets.selected || [],
      state.tasks.timeline || [],
      state.dates.calculatedStartDates,
      state.ui.dateErrors,
      state.dates.bankHolidays || [],
      state.dates.globalLiveDate,
      state.dates.useGlobalDate
    );
  }, [
    state.assets.selected,
    state.tasks.timeline,
    state.dates?.calculatedStartDates,
    state.dates?.bankHolidays,
    state.ui?.dateErrors,
    state.dates?.globalLiveDate,
    state.dates?.useGlobalDate
  ]);
};

// ============================================
// Development Helper (Remove in production)
// ============================================

/**
 * useTimelineDebug Hook
 * Provides debugging capabilities in development
 * Includes history information
 * TODO: Remove this before production
 */
export const useTimelineDebug = () => {
  const { state, canUndo, canRedo } = useTimeline();
  
  if (process.env.NODE_ENV === 'development') {
    // Safe logging in development only
    const logState = () => {
      console.group('📊 Timeline State');
      console.log('Assets:', state.assets);
      console.log('Tasks:', state.tasks);
      console.log('Dates:', state.dates);
      console.log('UI:', state.ui);
      console.groupEnd();
    };

    const logHistory = () => {
      console.group('🕒 History Status');
      console.log('Can Undo:', canUndo);
      console.log('Can Redo:', canRedo);
      console.groupEnd();
    };

    return { logState, logHistory };
  }
  
  return { 
    logState: () => {}, 
    logHistory: () => {} 
  };
};