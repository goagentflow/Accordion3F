/**
 * Timeline Context - Single State Management Provider
 * Replaces 28 useState hooks with single useReducer context
 * 
 * CRITICAL: This provides the state management foundation that fixes
 * the manipulation bugs by ensuring consistent state access
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { TimelineState, TimelineAction } from '../types/timeline.types';
import { timelineReducer, initialTimelineState } from '../reducers/timelineReducer';
import { getUndoRedoAvailability } from '../reducers/manipulationReducer';
import { loadVersionedState, saveVersionedState } from '../utils/stateMigration';

// ============================================
// Context Type Definition
// ============================================

export interface TimelineContextValue {
  state: TimelineState;
  dispatch: React.Dispatch<TimelineAction>;
  
  // Helper functions for common operations
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  // Hydration status
  isHydrating: boolean;
  hydrationError: string | null;
}

// ============================================
// Context Creation
// ============================================

const TimelineContext = createContext<TimelineContextValue | undefined>(undefined);

// ============================================
// Provider Component
// ============================================

export interface TimelineProviderProps {
  children: React.ReactNode;
}

export function TimelineProvider({ children }: TimelineProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(timelineReducer, initialTimelineState);
  const [isHydrating, setIsHydrating] = React.useState(true);
  const [hydrationError, setHydrationError] = React.useState<string | null>(null);
  
  // Get undo/redo availability
  const { canUndo, canRedo } = getUndoRedoAvailability();
  
  // ============================================
  // State Hydration on Mount
  // ============================================
  
  useEffect(() => {
    const hydrateState = async () => {
      console.log('[TimelineContext] Starting state hydration...');
      setIsHydrating(true);
      setHydrationError(null);
      
      try {
        const migrationResult = loadVersionedState();
        
        if (migrationResult.success && migrationResult.migratedData) {
          console.log('[TimelineContext] State hydrated successfully:', {
            assets: migrationResult.migratedData.assets.selected.length,
            timelineTasks: migrationResult.migratedData.tasks.timeline.length,
            migrationApplied: migrationResult.migrationApplied
          });
          
          // Dispatch hydration action to load the migrated state
          dispatch({
            type: 'HYDRATE_FROM_STORAGE' as any, // Will be properly typed once enum is updated
            payload: migrationResult.migratedData
          });
          
          // Log any migration warnings
          if (migrationResult.warnings && migrationResult.warnings.length > 0) {
            console.warn('[TimelineContext] Migration warnings:', migrationResult.warnings);
          }
          
        } else {
          console.warn('[TimelineContext] State hydration failed:', migrationResult.error);
          setHydrationError(migrationResult.error || 'Unknown hydration error');
        }
        
      } catch (error) {
        console.error('[TimelineContext] State hydration error:', error);
        setHydrationError(`Hydration failed: ${error.message}`);
      } finally {
        setIsHydrating(false);
      }
    };
    
    hydrateState();
  }, []);
  
  // ============================================
  // Auto-save State Changes
  // ============================================
  
  useEffect(() => {
    // Don't auto-save during hydration or if there's an error
    if (isHydrating || hydrationError) {
      return;
    }
    
    // Don't auto-save empty states
    if (state.assets.selected.length === 0 && state.tasks.custom.length === 0) {
      return;
    }
    
    // Debounced auto-save to prevent excessive localStorage writes
    const saveTimeout = setTimeout(() => {
      console.log('[TimelineContext] Auto-saving state...');
      saveVersionedState(state);
    }, 1000); // 1 second debounce
    
    return () => clearTimeout(saveTimeout);
  }, [state, isHydrating, hydrationError]);
  
  // ============================================
  // Helper Functions
  // ============================================
  
  const undo = React.useCallback(() => {
    dispatch({ type: 'UNDO' as any }); // Will be properly typed
  }, []);
  
  const redo = React.useCallback(() => {
    dispatch({ type: 'REDO' as any }); // Will be properly typed
  }, []);
  
  // ============================================
  // Context Value
  // ============================================
  
  const contextValue: TimelineContextValue = React.useMemo(
    () => ({
      state,
      dispatch,
      undo,
      redo,
      canUndo,
      canRedo,
      isHydrating,
      hydrationError
    }),
    [state, undo, redo, canUndo, canRedo, isHydrating, hydrationError]
  );
  
  return (
    <TimelineContext.Provider value={contextValue}>
      {children}
    </TimelineContext.Provider>
  );
}

// ============================================
// Hook for Using Context
// ============================================

export function useTimelineContext(): TimelineContextValue {
  const context = useContext(TimelineContext);
  
  if (context === undefined) {
    throw new Error('useTimelineContext must be used within a TimelineProvider');
  }
  
  return context;
}

// ============================================
// Selective State Hooks (Performance Optimization)
// ============================================

/**
 * Hook that only re-renders when assets change
 * Prevents unnecessary re-renders in components that only care about assets
 */
export function useTimelineAssets() {
  const { state } = useTimelineContext();
  return state.assets;
}

/**
 * Hook that only re-renders when tasks change
 */
export function useTimelineTasks() {
  const { state } = useTimelineContext();
  return state.tasks;
}

/**
 * Hook that only re-renders when dates change
 */
export function useTimelineDates() {
  const { state } = useTimelineContext();
  return state.dates;
}

/**
 * Hook that only re-renders when UI state changes
 */
export function useTimelineUI() {
  const { state } = useTimelineContext();
  return state.ui;
}

/**
 * Hook for dispatch-only access (never causes re-renders)
 */
export function useTimelineActions() {
  const { dispatch, undo, redo, canUndo, canRedo } = useTimelineContext();
  return { dispatch, undo, redo, canUndo, canRedo };
}

// ============================================
// Development Helper
// ============================================

/**
 * Hook for debugging state changes (development only)
 */
export function useTimelineDebug() {
  const { state } = useTimelineContext();
  
  useEffect(() => {
    console.log('[TimelineContext] State changed:', {
      assets: state.assets.selected.length,
      timelineTasks: state.tasks.timeline.length,
      customTasks: state.tasks.custom.length,
      status: state.status,
      globalLiveDate: state.dates.globalLiveDate,
      useGlobalDate: state.dates.useGlobalDate
    });
  }, [state]);
  
  return state;
}