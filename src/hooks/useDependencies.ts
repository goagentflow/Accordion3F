/**
 * Dependency Management Hook for DAG Calculator
 * Provides dependency management and enhanced recalculation triggers
 * 
 * Following Golden Rule #1: Safety First - Validate dependencies and handle errors
 * Following Golden Rule #4: Clear Roles - Dependency management separated from main timeline
 */

import { 
  useCallback, 
  useEffect, 
  useMemo 
} from 'react';

import { useTimeline } from './useTimeline';
import { TimelineActions } from '../actions/timelineActions';
import { useDAGCalculator, isDebugMode } from '../config/features';
import { validateDependency } from '../services/DependencyValidator';

// ============================================
// Dependency Management Hook
// ============================================

/**
 * useDependencies Hook
 * Provides dependency management and recalculation triggers for DAG calculator
 */
export const useDependencies = () => {
  const { state, dispatch } = useTimeline();

  // ============================================
  // Dependency Actions
  // ============================================

  const addDependency = useCallback(
    (predecessorId: string, successorId: string, overlapDays: number) => {
      // Validate dependency before adding
      const validation = validateDependency(
        predecessorId,
        successorId,
        overlapDays,
        [...state.tasks.all, ...state.tasks.custom],
        {}
      );

      if (!validation.valid) {
        console.warn('Cannot add dependency:', validation.error);
        return { success: false, error: validation.error };
      }

      dispatch(TimelineActions.addDependency(predecessorId, successorId, overlapDays));
      
      if (isDebugMode()) {
        console.log(`Added dependency: ${predecessorId} → ${successorId} (overlap: ${overlapDays} days)`);
      }
      
      return { success: true };
    },
    [dispatch, state.tasks.all, state.tasks.custom]
  );

  const removeDependency = useCallback(
    (successorId: string, predecessorId?: string) => {
      dispatch(TimelineActions.removeDependency(successorId, predecessorId));
      
      if (isDebugMode()) {
        console.log(`Removed dependency: ${predecessorId || 'all'} → ${successorId}`);
      }
    },
    [dispatch]
  );

  const updateDependency = useCallback(
    (predecessorId: string, successorId: string, overlapDays: number) => {
      // Validate updated dependency
      const validation = validateDependency(
        predecessorId,
        successorId,
        overlapDays,
        [...state.tasks.all, ...state.tasks.custom],
        {}
      );

      if (!validation.valid) {
        console.warn('Cannot update dependency:', validation.error);
        return { success: false, error: validation.error };
      }

      dispatch(TimelineActions.updateDependency(predecessorId, successorId, overlapDays));
      
      if (isDebugMode()) {
        console.log(`Updated dependency: ${predecessorId} → ${successorId} (overlap: ${overlapDays} days)`);
      }
      
      return { success: true };
    },
    [dispatch, state.tasks.all, state.tasks.custom]
  );

  const clearAllDependencies = useCallback(() => {
    dispatch(TimelineActions.clearAllDependencies());
    
    if (isDebugMode()) {
      console.log('Cleared all dependencies');
    }
  }, [dispatch]);

  // ============================================
  // Enhanced Recalculation Triggers
  // ============================================

  const recalculateTimeline = useCallback(() => {
    dispatch(TimelineActions.recalculateWithDependencies());
    
    if (isDebugMode()) {
      console.log('Triggered timeline recalculation with dependencies');
    }
  }, [dispatch]);

  // Auto-recalculation effect for dependency changes
  useEffect(() => {
    const shouldUseDAG = useDAGCalculator();
    
    if (shouldUseDAG) {
      // Trigger recalculation when:
      // 1. Tasks change (additions, duration updates)
      // 2. Asset live dates change
      // 3. Bank holidays change
      // 4. Dependencies are modified
      
      if (isDebugMode()) {
        console.log('Auto-recalculation triggered by state change');
      }
      
      // Debounced recalculation to avoid excessive calculations
      const timeoutId = setTimeout(() => {
        recalculateTimeline();
      }, 100); // 100ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [
    state.tasks.all,
    state.tasks.custom,
    state.assets.selected,
    state.dates.globalLiveDate,
    state.dates.bankHolidays,
    recalculateTimeline
  ]);

  // ============================================
  // Dependency Analysis
  // ============================================

  const getDependenciesForTask = useCallback(
    (taskId: string) => {
      const allTasks = [...state.tasks.all, ...state.tasks.custom];
      const task = allTasks.find(t => t.id === taskId);
      return task?.dependencies || [];
    },
    [state.tasks.all, state.tasks.custom]
  );

  const getTasksWithDependencies = useMemo(() => {
    const allTasks = [...state.tasks.all, ...state.tasks.custom];
    return allTasks.filter(task => task.dependencies && task.dependencies.length > 0);
  }, [state.tasks.all, state.tasks.custom]);

  const hasDependencies = useMemo(() => {
    return getTasksWithDependencies.length > 0;
  }, [getTasksWithDependencies]);

  const getDependencyCount = useMemo(() => {
    return getTasksWithDependencies.reduce(
      (count, task) => count + (task.dependencies?.length || 0),
      0
    );
  }, [getTasksWithDependencies]);

  // ============================================
  // Critical Path Analysis
  // ============================================

  const getCriticalPathTasks = useMemo(() => {
    return state.tasks.timeline.filter(task => task.isCritical === true);
  }, [state.tasks.timeline]);

  const hasCriticalPath = useMemo(() => {
    return getCriticalPathTasks.length > 0;
  }, [getCriticalPathTasks]);

  // ============================================
  // Timeline Compression Analysis
  // ============================================

  const getTimelineCompressionInfo = useMemo(() => {
    const tasksWithFloat = state.tasks.timeline.filter(task => 
      typeof task.totalFloat === 'number' && task.totalFloat > 0
    );

    const totalFloatAvailable = tasksWithFloat.reduce(
      (sum, task) => sum + (task.totalFloat || 0),
      0
    );

    return {
      tasksWithFloat: tasksWithFloat.length,
      totalFloatAvailable,
      canCompress: totalFloatAvailable > 0,
      compressionOpportunities: tasksWithFloat.map(task => ({
        taskId: task.id,
        taskName: task.name,
        floatDays: task.totalFloat || 0
      }))
    };
  }, [state.tasks.timeline]);

  // ============================================
  // Bulk Dependency Operations (for proper undo/redo)
  // ============================================

  const bulkAddDependencies = useCallback(
    (dependencies: Array<{ predecessorId: string; successorId: string; overlapDays: number }>, description?: string) => {
      // Validate all dependencies first
      const validationErrors: string[] = [];
      
      for (const dep of dependencies) {
        const validation = validateDependency(
          dep.predecessorId,
          dep.successorId,
          dep.overlapDays,
          [...state.tasks.all, ...state.tasks.custom],
          {}
        );
        
        if (!validation.valid) {
          validationErrors.push(`${dep.predecessorId} → ${dep.successorId}: ${validation.error}`);
        }
      }
      
      if (validationErrors.length > 0) {
        return { 
          success: false, 
          error: `Validation errors: ${validationErrors.join('; ')}`,
          validationErrors 
        };
      }

      // Use BULK_ADD_DEPENDENCIES action for single undo/redo step
      dispatch(TimelineActions.bulkAddDependencies(dependencies, description));
      
      if (isDebugMode()) {
        console.log(`Bulk added ${dependencies.length} dependencies:`, description || 'No description');
      }
      
      return { success: true, count: dependencies.length };
    },
    [dispatch, state.tasks.all, state.tasks.custom]
  );

  const bulkRemoveDependencies = useCallback(
    (dependencies: Array<{ predecessorId: string; successorId: string }>, description?: string) => {
      // Use BULK_REMOVE_DEPENDENCIES action for single undo/redo step
      dispatch(TimelineActions.bulkRemoveDependencies(dependencies, description));
      
      if (isDebugMode()) {
        console.log(`Bulk removed ${dependencies.length} dependencies:`, description || 'No description');
      }
      
      return { success: true, count: dependencies.length };
    },
    [dispatch]
  );

  return {
    // Dependency actions
    addDependency,
    removeDependency,
    updateDependency,
    clearAllDependencies,
    
    // Bulk operations (for proper undo/redo)
    bulkAddDependencies,
    bulkRemoveDependencies,

    // Recalculation
    recalculateTimeline,

    // Dependency analysis
    getDependenciesForTask,
    getTasksWithDependencies,
    hasDependencies,
    dependencyCount: getDependencyCount,

    // Critical path
    criticalPathTasks: getCriticalPathTasks,
    hasCriticalPath,

    // Timeline compression
    compressionInfo: getTimelineCompressionInfo
  };
};

// ============================================
// Batch Operations Hook
// ============================================

/**
 * useBatchDependencies Hook
 * Provides batch operations for multiple dependencies
 */
export const useBatchDependencies = () => {
  const { dispatch } = useTimeline();

  const addMultipleDependencies = useCallback(
    (dependencies: Array<{ predecessorId: string; successorId: string; overlapDays: number }>) => {
      // TODO: Implement batch validation and atomic operations
      let successCount = 0;
      const errors: string[] = [];

      dependencies.forEach(({ predecessorId, successorId, overlapDays }, index) => {
        try {
          dispatch(TimelineActions.addDependency(predecessorId, successorId, overlapDays));
          successCount++;
        } catch (error) {
          errors.push(`Dependency ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      return {
        successCount,
        errorCount: errors.length,
        errors
      };
    },
    [dispatch]
  );

  return {
    addMultipleDependencies
  };
};

// ============================================
// Performance Monitoring Hook
// ============================================

/**
 * useTimelinePerformance Hook
 * Monitors timeline calculation performance
 */
export const useTimelinePerformance = () => {
  const { state } = useTimeline();

  const performanceMetrics = useMemo(() => {
    const taskCount = state.tasks.all.length + state.tasks.custom.length;
    const assetCount = state.assets.selected.length;
    const timelineTaskCount = state.tasks.timeline.length;

    // Performance indicators
    const isLargeTimeline = taskCount > 100;
    const hasComplexDependencies = state.tasks.timeline.some(task => 
      task.dependencies && task.dependencies.length > 2
    );

    return {
      taskCount,
      assetCount,
      timelineTaskCount,
      isLargeTimeline,
      hasComplexDependencies,
      performanceLevel: isLargeTimeline ? 
        (hasComplexDependencies ? 'heavy' : 'moderate') : 'light'
    };
  }, [state.tasks, state.assets.selected, state.tasks.timeline]);

  return performanceMetrics;
};