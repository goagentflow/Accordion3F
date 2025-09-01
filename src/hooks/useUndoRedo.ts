/**
 * Higher-Order Reducer for Undo/Redo Functionality
 * Wraps the main timeline reducer to add history management
 * Keeps undo/redo logic completely separate from core business logic
 */

import { Reducer } from 'react';
import { TimelineState, TimelineAction, ActionType } from '../types/timeline.types';

// ============================================
// Undo/Redo Types
// ============================================

/**
 * Actions specific to undo/redo functionality
 */
export enum UndoRedoActionType {
  UNDO = 'UNDO',
  REDO = 'REDO',
  CLEAR_HISTORY = 'CLEAR_HISTORY'
}

export interface UndoAction {
  type: UndoRedoActionType.UNDO;
}

export interface RedoAction {
  type: UndoRedoActionType.REDO;
}

export interface ClearHistoryAction {
  type: UndoRedoActionType.CLEAR_HISTORY;
}

export type UndoRedoAction = UndoAction | RedoAction | ClearHistoryAction;

/**
 * State shape with history
 */
export interface StateWithHistory<T> {
  present: T;
  past: T[];
  future: T[];
}

/**
 * Combined action type that includes both timeline and undo/redo actions
 */
export type TimelineActionWithHistory = TimelineAction | UndoRedoAction;

// ============================================
// Configuration
// ============================================

/**
 * Configuration options for the undo/redo functionality
 */
interface UndoRedoConfig {
  /**
   * Maximum number of history entries to keep
   * Prevents memory issues with large state objects
   */
  limit: number;
  
  /**
   * Actions that should not create history entries
   * For example, UI-only actions or calculated state updates
   */
  excludeActions?: ActionType[];
  
  /**
   * Debounce time in milliseconds for grouping rapid actions
   * Set to 0 to disable debouncing
   */
  debounceTime?: number;
}

/**
 * Default configuration
 */
const defaultConfig: UndoRedoConfig = {
  limit: 50, // Keep last 50 states
  excludeActions: [
    // These actions don't need history as they're UI-only or calculated
    ActionType.TOGGLE_INFO_BOX,
    ActionType.SET_GETTING_STARTED,
    ActionType.SET_ALL_INSTRUCTIONS,
    ActionType.UPDATE_TIMELINE, // This is recalculated, not user action
    ActionType.SET_DATE_ERRORS,
    ActionType.SET_PROJECT_START_DATE,
    ActionType.SET_CALCULATED_START_DATES
  ],
  debounceTime: 0 // No debouncing by default
};

// ============================================
// Helper Functions
// ============================================

/**
 * Check if an action should create a history entry
 */
const shouldCreateHistoryEntry = (
  action: TimelineActionWithHistory,
  config: UndoRedoConfig
): action is TimelineAction => {
  // Undo/redo actions don't create history
  if ('type' in action && Object.values(UndoRedoActionType).includes(action.type as any)) {
    return false;
  }
  
  // Check if action is in exclude list
  const timelineAction = action as TimelineAction;
  return !config.excludeActions?.includes(timelineAction.type);
};

/**
 * Create initial state with history
 */
export const createInitialStateWithHistory = <T>(
  initialState: T
): StateWithHistory<T> => ({
  present: initialState,
  past: [],
  future: []
});

// ============================================
// Higher-Order Reducer
// ============================================

/**
 * Creates a higher-order reducer that adds undo/redo functionality
 * @param reducer The base reducer to wrap
 * @param config Configuration options
 * @returns A new reducer with undo/redo capabilities
 */
export function withUndoRedo<S, A extends { type: string }>(
  reducer: Reducer<S, A>,
  config: UndoRedoConfig = defaultConfig
): Reducer<StateWithHistory<S>, A | UndoRedoAction> {
  
  return (state: StateWithHistory<S>, action: A | UndoRedoAction): StateWithHistory<S> => {
    // Handle undo/redo actions  
    if (action.type === UndoRedoActionType.UNDO || 
        action.type === UndoRedoActionType.REDO || 
        action.type === UndoRedoActionType.CLEAR_HISTORY) {
      switch (action.type) {
        case UndoRedoActionType.UNDO: {
          if (state.past.length === 0) {
            // Nothing to undo
            return state;
          }
          
          // Move present to future and get previous state from past
          const previous = state.past[state.past.length - 1];
          const newPast = state.past.slice(0, state.past.length - 1);
          
          return {
            past: newPast,
            present: previous,
            future: [state.present, ...state.future]
          };
        }
        
        case UndoRedoActionType.REDO: {
          if (state.future.length === 0) {
            // Nothing to redo
            return state;
          }
          
          // Move present to past and get next state from future
          const next = state.future[0];
          const newFuture = state.future.slice(1);
          
          return {
            past: [...state.past, state.present],
            present: next,
            future: newFuture
          };
        }
        
        case UndoRedoActionType.CLEAR_HISTORY: {
          return {
            past: [],
            present: state.present,
            future: []
          };
        }
      }
    }
    
    // Handle regular actions
    const newPresent = reducer(state.present, action as A);
    
    // If state didn't change, don't create history entry
    if (newPresent === state.present) {
      return state;
    }
    
    // Check if this action should create history
    if (!shouldCreateHistoryEntry(action as TimelineActionWithHistory, config)) {
      // Update present without creating history
      return {
        ...state,
        present: newPresent
      };
    }
    
    // Create new history entry
    let newPast = [...state.past, state.present];
    
    // Apply history limit
    if (newPast.length > config.limit) {
      newPast = newPast.slice(newPast.length - config.limit);
    }
    
    return {
      past: newPast,
      present: newPresent,
      future: [] // Clear future when new action is taken
    };
  };
}

// ============================================
// Specific Implementation for Timeline
// ============================================

/**
 * Timeline reducer with undo/redo functionality
 */
export const createTimelineReducerWithHistory = (
  baseReducer: Reducer<TimelineState, TimelineAction>,
  config?: Partial<UndoRedoConfig>
): Reducer<StateWithHistory<TimelineState>, TimelineActionWithHistory> => {
  const finalConfig = { ...defaultConfig, ...config };
  return withUndoRedo(baseReducer, finalConfig);
};

// ============================================
// Action Creators
// ============================================

/**
 * Action creators for undo/redo
 */
export const UndoRedoActions = {
  undo: (): UndoAction => ({
    type: UndoRedoActionType.UNDO
  }),
  
  redo: (): RedoAction => ({
    type: UndoRedoActionType.REDO
  }),
  
  clearHistory: (): ClearHistoryAction => ({
    type: UndoRedoActionType.CLEAR_HISTORY
  })
};

// ============================================
// Utility Functions
// ============================================

/**
 * Get undo/redo availability from state
 */
export const getUndoRedoStatus = <T>(state: StateWithHistory<T>) => ({
  canUndo: state.past.length > 0,
  canRedo: state.future.length > 0,
  historySize: state.past.length,
  futureSize: state.future.length
});

/**
 * Extract just the present state (for components that don't need history)
 */
export const getPresent = <T>(state: StateWithHistory<T>): T => state.present;

// ============================================
// Debugging Utilities (Development Only)
// ============================================

/**
 * Debug logger for history state
 * Only runs in development mode
 */
export const debugHistory = <T>(state: StateWithHistory<T>, action?: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🕒 History Debug${action ? `: ${action}` : ''}`);
    console.log('Past states:', state.past.length);
    console.log('Current state:', state.present);
    console.log('Future states:', state.future.length);
    console.log('Can undo:', state.past.length > 0);
    console.log('Can redo:', state.future.length > 0);
    console.groupEnd();
  }
};

// ============================================
// Advanced Features (Optional)
// ============================================

/**
 * Create a debounced version of the reducer for grouping rapid actions
 * Useful for actions like dragging or typing that fire frequently
 */
export const createDebouncedReducer = <S, A extends { type: string }>(
  reducer: Reducer<StateWithHistory<S>, A | UndoRedoAction>,
  debounceTime: number
): Reducer<StateWithHistory<S>, A | UndoRedoAction> => {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingActions: A[] = [];
  
  return (state: StateWithHistory<S>, action: A | UndoRedoAction): StateWithHistory<S> => {
    // Undo/redo actions are never debounced
    if (action.type === UndoRedoActionType.UNDO || 
        action.type === UndoRedoActionType.REDO || 
        action.type === UndoRedoActionType.CLEAR_HISTORY) {
      // Clear any pending actions
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        pendingActions = [];
      }
      return reducer(state, action);
    }
    
    // Regular actions might be debounced
    pendingActions.push(action as A);
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Apply all pending actions at once after debounce period
    timeoutId = setTimeout(() => {
      let newState = state;
      for (const pendingAction of pendingActions) {
        newState = reducer(newState, pendingAction);
      }
      pendingActions = [];
      timeoutId = null;
      return newState;
    }, debounceTime);
    
    // Return current state while debouncing
    return state;
  };
};