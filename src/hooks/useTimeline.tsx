/**
 * useTimeline Hook and Context Provider
 * Provides centralized state management for the Timeline Builder application
 * Combines useReducer + Context pattern for clean state distribution
 * Includes integrated undo/redo functionality via higher-order reducer
 */

import { 
  createContext, 
  useContext, 
  useReducer, 
  useCallback, 
  useMemo,
  ReactNode
} from 'react';

import {
  TimelineState,
  TimelineContextValue
} from '../types/timeline.types';

import {
  timelineReducer,
  initialTimelineState,
  TimelineActions
} from '../reducers/timelineReducer';

import {
  createTimelineReducerWithHistory,
  createInitialStateWithHistory,
  UndoRedoActions,
  getUndoRedoStatus,
  getPresent,
  StateWithHistory,
  TimelineActionWithHistory
} from './useUndoRedo';

import { useAutoSave } from './useAutoSave';
import SaveIndicator from '../components/SaveIndicator';
import RecoveryPrompt from '../components/RecoveryPrompt';

// ============================================
// Context Creation
// ============================================

/**
 * Timeline Context
 * Provides state and dispatch to all child components
 */
const TimelineContext = createContext<TimelineContextValue | undefined>(undefined);

// ============================================
// Context Provider Component
// ============================================

interface TimelineProviderProps {
  children: ReactNode;
  initialState?: Partial<TimelineState>;
}

/**
 * TimelineProvider Component
 * Wraps the application and provides timeline state management
 * Now includes full undo/redo functionality
 */
export const TimelineProvider: React.FC<TimelineProviderProps> = ({ 
  children, 
  initialState 
}) => {
  // Create the reducer with history support
  const reducerWithHistory = useMemo(
    () => createTimelineReducerWithHistory(timelineReducer),
    []
  );

  // Initialize state with history
  const initialStateWithHistory = useMemo(
    () => createInitialStateWithHistory(
      initialState ? { ...initialTimelineState, ...initialState } : initialTimelineState
    ),
    [initialState]
  );

  // Initialize reducer with history support
  const [stateWithHistory, dispatch] = useReducer<
    React.Reducer<StateWithHistory<TimelineState>, TimelineActionWithHistory>
  >(
    reducerWithHistory,
    initialStateWithHistory
  );

  // Extract the present state for easier access
  const state = useMemo(
    () => getPresent(stateWithHistory),
    [stateWithHistory]
  );

  // ============================================
  // Undo/Redo Implementation
  // ============================================
  
  const undo = useCallback(() => {
    dispatch(UndoRedoActions.undo());
  }, []);

  const redo = useCallback(() => {
    dispatch(UndoRedoActions.redo());
  }, []);

  // Get undo/redo availability
  const { canUndo, canRedo } = useMemo(
    () => getUndoRedoStatus(stateWithHistory),
    [stateWithHistory]
  );

  // ============================================
  // Auto-Save Integration
  // ============================================
  
  const {
    saveStatus,
    recoverSession,
    discardRecovery,
    showRecoveryPrompt,
    recoveryPreview
  } = useAutoSave(state, true); // Enable auto-save

  // Handle session recovery
  const handleRecover = useCallback(() => {
    const recoveredState = recoverSession();
    if (recoveredState) {
      dispatch(TimelineActions.importState(recoveredState));
    }
  }, [recoverSession]);

  // Note: Auto-save is now handled by useAutoSave hook
  // which monitors state changes and triggers saves automatically

  // ============================================
  // Memoized Context Value
  // ============================================
  
  const contextValue = useMemo<TimelineContextValue>(
    () => ({
      state,
      dispatch,
      undo,
      redo,
      canUndo,
      canRedo
    }),
    [state, undo, redo, canUndo, canRedo]
  );

  return (
    <TimelineContext.Provider value={contextValue}>
      {/* Recovery Prompt */}
      <RecoveryPrompt
        isOpen={showRecoveryPrompt}
        preview={recoveryPreview}
        onRecover={handleRecover}
        onDiscard={discardRecovery}
      />
      
      {/* Save Status Indicator */}
      <SaveIndicator
        status={saveStatus.status}
        lastSaved={saveStatus.lastSaved}
        message={saveStatus.message}
      />
      
      {children}
    </TimelineContext.Provider>
  );
};

// ============================================
// Custom Hook for Consuming Context
// ============================================

/**
 * useTimeline Hook
 * Provides access to timeline state and dispatch
 * Must be used within a TimelineProvider
 */
export const useTimeline = (): TimelineContextValue => {
  const context = useContext(TimelineContext);
  
  if (!context) {
    throw new Error('useTimeline must be used within a TimelineProvider');
  }
  
  return context;
};

// ============================================
// Convenience Hooks for Specific State Slices
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

// ============================================
// Export Action Creators for Direct Use
// ============================================

export { TimelineActions };

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