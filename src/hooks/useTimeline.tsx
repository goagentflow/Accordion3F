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
  useState,
  useEffect,
  ReactNode
} from 'react';

import {
  TimelineState,
  TimelineContextValue
} from '../types/timeline.types';

import {
  timelineReducer,
  initialTimelineState
} from '../reducers/timelineReducer';

import { TimelineActions } from '../actions/timelineActions';
// import { migrateLocalStorageState } from '../utils/stateMigration';

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

  // Initialize state with history and migration support
  const initialStateWithHistory = useMemo(
    () => {
      // Use provided initial state or default state (migration disabled)
      const baseState = initialState ? { ...initialTimelineState, ...initialState } : initialTimelineState;
      
      return createInitialStateWithHistory(baseState);
    },
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

  // Hydration flag to gate UI during recovery/import + catalog readiness
  const [isHydrating, setIsHydrating] = useState(false);

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
  } = useAutoSave(state, !isHydrating); // Pause auto-save during hydration

  // Exit hydration when timeline is available or recovery is dismissed with no selected assets
  useEffect(() => {
    if (!isHydrating) return;
    const hasTimeline = Array.isArray(state.tasks?.timeline) && state.tasks.timeline.length > 0;
    const noAssets = Array.isArray(state.assets?.selected) && state.assets.selected.length === 0;
    if (hasTimeline || (noAssets && !showRecoveryPrompt)) {
      setIsHydrating(false);
    }
  }, [isHydrating, state.tasks?.timeline?.length, state.assets?.selected?.length, showRecoveryPrompt]);

  // Handle session recovery
  const handleRecover = useCallback(() => {
    setIsHydrating(true);
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
      canRedo,
      isHydrating
    }),
    [state, undo, redo, canUndo, canRedo, isHydrating]
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
// Export Action Creators for Direct Use  
// ============================================

export { TimelineActions };

// Note: Convenience hooks moved to src/hooks/useTimelineSelectors.tsx
// to comply with Golden Rule #2: 400 Line Max
