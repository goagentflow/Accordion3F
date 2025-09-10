/**
 * Timeline Calculator with DAG (Directed Acyclic Graph) Support
 * Orchestrates CPM calculation using modular components
 * 
 * Following Golden Rule #2: 400 Line Max - Refactored using modules
 * Following Golden Rule #4: Clear Roles - Orchestration only
 * Following Golden Rule #1: Safety First - Comprehensive error handling
 */

import { Task, TimelineTask } from '../types/timeline.types';
import { isDebugMode } from '../config/features';
import { calculateWorkingDaysBetween } from '../utils/dateHelpers';

// Import modular components
import { buildTaskGraph, TaskGraph } from './dag/graphBuilder';
import { calculateCriticalPath, CPMResults } from './dag/criticalPathCalculator';
import { assignDatesToTasks, createDateAssignmentOptions, DateAssignmentResult } from './dag/dateAssigner';

// ============================================
// Calculation Result Interface
// ============================================

interface CalculationResult {
  tasks: TimelineTask[];
  criticalPath: string[];
  projectDuration: number;
  errors: string[];
}

// ============================================
// DAG Timeline Calculator Class
// ============================================

export class TimelineCalculatorDAG {
  /**
   * Build a dated timeline for a single asset using DAG/CPM methodology
   * Maintains identical results to sequential calculator when no dependencies exist
   * 
   * @param rawTasks - Array of tasks without dates
   * @param liveDateStr - The go-live date as ISO string
   * @param customDurations - Optional custom task durations
   * @param bankHolidays - Array of bank holiday dates
   * @returns Array of tasks with calculated start and end dates
   */
  public buildAssetTimeline(
    rawTasks: Task[],
    liveDateStr: string,
    customDurations: Record<string, number> = {},
    bankHolidays: string[] = []
  ): TimelineTask[] {
    try {
      // Input validation
      if (!liveDateStr || rawTasks.length === 0) {
        return [];
      }
      
      const liveDate = new Date(liveDateStr);
      if (isNaN(liveDate.getTime())) {
        console.error('Invalid live date:', liveDateStr);
        return [];
      }
      
      if (isDebugMode()) {
        console.log('DAG Calculator starting:', {
          taskCount: rawTasks.length,
          liveDate: liveDateStr,
          customDurations: Object.keys(customDurations).length,
          bankHolidays: bankHolidays.length
        });
      }
      
      // Execute calculation pipeline
      const result = this.calculateTimeline(rawTasks, customDurations, liveDate, bankHolidays);
      
      if (result.errors.length > 0) {
        console.warn('Timeline calculation warnings:', result.errors);
      }
      
      if (isDebugMode()) {
        console.log('DAG Calculator completed:', {
          taskCount: result.tasks.length,
          criticalPathTasks: result.criticalPath.length,
          projectDuration: result.projectDuration
        });
      }
      
      return result.tasks;
      
    } catch (error) {
      console.error('DAG Timeline calculation failed:', error);
      return []; // Graceful fallback
    }
  }
  
  /**
   * Main calculation pipeline using modular components
   */
  private calculateTimeline(
    rawTasks: Task[],
    customDurations: Record<string, number>,
    liveDate: Date,
    bankHolidays: string[]
  ): CalculationResult {
    // Step 1: Build task dependency graph
    const graph = this.buildGraph(rawTasks, customDurations);
    if (!graph.isValid) {
      return {
        tasks: [],
        criticalPath: [],
        projectDuration: 0,
        errors: graph.errors
      };
    }
    
    // Step 2: Calculate critical path using CPM
    const cmpResults = this.performCPMCalculation(graph);
    if (!cmpResults.calculationSuccess) {
      return {
        tasks: [],
        criticalPath: [],
        projectDuration: 0,
        errors: cmpResults.errors
      };
    }
    
    // Step 3: Assign actual calendar dates
    const dateResults = this.assignCalendarDates(graph, cmpResults, liveDate, bankHolidays);
    if (!dateResults.success) {
      return {
        tasks: [],
        criticalPath: [],
        projectDuration: 0,
        errors: dateResults.errors
      };
    }
    
    return {
      tasks: dateResults.tasks,
      criticalPath: cmpResults.criticalPath,
      projectDuration: cmpResults.projectDuration,
      errors: []
    };
  }
  
  /**
   * Step 1: Build and validate task dependency graph
   */
  private buildGraph(rawTasks: Task[], customDurations: Record<string, number>): TaskGraph {
    if (isDebugMode()) {
      // eslint-disable-next-line no-console
      console.log('Building task graph...');
    }
    
    const graph = buildTaskGraph(rawTasks, customDurations);
    
    if (isDebugMode()) {
      // eslint-disable-next-line no-console
      console.log('Graph built:', {
        nodes: graph.nodes.size,
        startNodes: graph.startNodes.length,
        endNodes: graph.endNodes.length,
        valid: graph.isValid
      });
    }
    
    return graph;
  }
  
  /**
   * Step 2: Perform Critical Path Method calculation
   */
  private performCPMCalculation(graph: TaskGraph): CPMResults {
    if (isDebugMode()) {
      // eslint-disable-next-line no-console
      console.log('Calculating critical path...');
    }
    
    const cmpResults = calculateCriticalPath(graph);
    
    if (isDebugMode()) {
      // eslint-disable-next-line no-console
      console.log('CPM calculation completed:', {
        projectDuration: cmpResults.projectDuration,
        criticalPathLength: cmpResults.criticalPath.length,
        success: cmpResults.calculationSuccess
      });
    }
    
    return cmpResults;
  }
  
  /**
   * Step 3: Assign calendar dates to calculated task times
   */
  private assignCalendarDates(
    graph: TaskGraph,
    cmpResults: CPMResults,
    liveDate: Date,
    bankHolidays: string[]
  ): DateAssignmentResult {
    if (isDebugMode()) {
      // eslint-disable-next-line no-console
      console.log('Assigning calendar dates...');
    }
    
    const options = createDateAssignmentOptions(liveDate, bankHolidays);
    const dateResults = assignDatesToTasks(graph, cmpResults, options);
    
    if (isDebugMode()) {
      // eslint-disable-next-line no-console
      console.log('Date assignment completed:', {
        taskCount: dateResults.tasks.length,
        projectStart: dateResults.projectStartDate,
        projectEnd: dateResults.projectEndDate,
        success: dateResults.success
      });
    }
    
    return dateResults;
  }
  
  /**
   * Get detailed calculation information for debugging
   */
  public getCalculationDetails(
    rawTasks: Task[],
    customDurations: Record<string, number> = {}
  ): {
    graph: TaskGraph;
    cmpResults: CPMResults;
    summary: string;
  } {
    const graph = buildTaskGraph(rawTasks, customDurations);
    const cmpResults = calculateCriticalPath(graph);
    
    const summary = `
DAG Calculator Analysis:
- Task count: ${rawTasks.length}
- Dependencies: ${rawTasks.filter(t => t.dependencies?.length).length} tasks have dependencies
- Graph valid: ${graph.isValid}
- Project duration: ${cmpResults.projectDuration} days
- Critical path: ${cmpResults.criticalPath.length} tasks
- Calculation success: ${cmpResults.calculationSuccess}
    `.trim();
    
    return { graph, cmpResults, summary };
  }
}

// ============================================
// Factory Function (matches existing interface)
// ============================================

/**
 * Factory function that matches the existing buildAssetTimeline signature
 * This ensures zero breaking changes for existing code
 */
export const buildAssetTimelineDAG = (
  rawTasks: Task[],
  liveDateStr: string,
  customDurations: Record<string, number> = {},
  bankHolidays: string[] = []
): TimelineTask[] => {
  const calculator = new TimelineCalculatorDAG();
  return calculator.buildAssetTimeline(rawTasks, liveDateStr, customDurations, bankHolidays);
};

// ============================================
// Utility Functions
// ============================================

/**
 * Check if two timeline results are identical (for testing backwards compatibility)
 */
export const compareTimelineResults = (
  result1: TimelineTask[],
  result2: TimelineTask[]
): boolean => {
  if (result1.length !== result2.length) return false;
  
  for (let i = 0; i < result1.length; i++) {
    const task1 = result1[i];
    const task2 = result2[i];
    
    if (task1.id !== task2.id ||
        task1.start !== task2.start ||
        task1.end !== task2.end ||
        task1.duration !== task2.duration) {
      return false;
    }
  }
  
  return true;
};

/**
 * Extract critical path information from timeline tasks
 */
export const extractCriticalPath = (tasks: TimelineTask[]): string[] => {
  return tasks
    .filter(task => task.isCritical)
    .map(task => task.id);
};

/**
 * Calculate total project compression achieved through overlaps
 */
export const calculateCompressionSavings = (
  sequentialTasks: TimelineTask[],
  dagTasks: TimelineTask[]
): number => {
  if (sequentialTasks.length === 0 || dagTasks.length === 0) return 0;
  
  const sequentialDuration = calculateWorkingDaysBetween(
    new Date(sequentialTasks[0].start),
    new Date(sequentialTasks[sequentialTasks.length - 1].end)
  );
  
  const dagDuration = calculateWorkingDaysBetween(
    new Date(dagTasks[0].start),
    new Date(dagTasks[dagTasks.length - 1].end)
  );
  
  return Math.max(0, sequentialDuration - dagDuration);
};
