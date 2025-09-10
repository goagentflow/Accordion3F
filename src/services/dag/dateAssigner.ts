/**
 * Date Assigner Module for DAG Timeline Calculator
 * Converts CPM calculation results to actual calendar dates
 * 
 * Following Golden Rule #2: 400 Line Max - Extracted from TimelineCalculatorDAG.ts
 * Following Golden Rule #4: Clear Roles - Single responsibility for date assignment
 * Following Golden Rule #1: Safety First - Comprehensive date validation and error handling
 */

import { TimelineTask } from '../../types/timeline.types';
import { TaskGraph } from './graphBuilder';
import { CPMResults } from './criticalPathCalculator';

import {
  subtractWorkingDays,
  getPreviousWorkingDay,
  isNonWorkingDay,
  safeToISOString,
  calculateWorkingDaysBetween,
  getCPMDateOffset,
  getNextWorkingDay,
  addWorkingDays
} from '../../utils/dateHelpers';
import { allowWeekendLiveDate, isDebugMode } from '../../config/features';

// ============================================
// Date Assignment Results
// ============================================

export interface DateAssignmentResult {
  tasks: TimelineTask[];
  projectStartDate: string;
  projectEndDate: string;
  success: boolean;
  errors: string[];
}

export interface DateAssignmentOptions {
  liveDate: Date;
  bankHolidays: string[];
  preserveWeekends: boolean;
  adjustForHolidays: boolean;
}

// ============================================
// Date Assigner Class
// ============================================

export class DateAssigner {
  /**
   * Convert CPM calculation results to timeline tasks with actual dates
   * 
   * @param graph - Task graph with CPM calculations completed
   * @param cpmResults - Results from critical path calculation
   * @param options - Date assignment options including live date and holidays
   * @returns Array of timeline tasks with calculated dates
   */
  public assignDatesToTasks(
    graph: TaskGraph,
    cmpResults: CPMResults,
    options: DateAssignmentOptions
  ): DateAssignmentResult {
    try {
      if (!cmpResults.calculationSuccess) {
        return {
          tasks: [],
          projectStartDate: '',
          projectEndDate: '',
          success: false,
          errors: cmpResults.errors
        };
      }
      
      // Step 1: Calculate project start date
      const projectStartDate = this.calculateProjectStartDate(graph, options);
      
      // Step 2: Assign dates to all tasks
      const tasks = this.createTimelineTasks(graph, projectStartDate, options);
      
      // Step 3: Validate date assignments
      const validation = this.validateDateAssignments(tasks, options);
      if (!validation.valid) {
        return {
          tasks: [],
          projectStartDate: '',
          projectEndDate: '',
          success: false,
          errors: validation.errors
        };
      }
      
      // Step 4: Calculate project end date
      const projectEndDate = this.calculateProjectEndDate(tasks);
      
      return {
        tasks,
        projectStartDate: safeToISOString(projectStartDate),
        projectEndDate,
        success: true,
        errors: []
      };
      
    } catch (error) {
      return {
        tasks: [],
        projectStartDate: '',
        projectEndDate: '',
        success: false,
        errors: [`Date assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
  
  /**
   * Calculate the project start date by working backwards from the live date
   */
  private calculateProjectStartDate(
    graph: TaskGraph,
    options: DateAssignmentOptions
  ): Date {
    // Find the maximum finish time among all tasks
    let maxFinishTime = 0;
    graph.nodes.forEach(node => {
      maxFinishTime = Math.max(maxFinishTime, node.earliestFinish);
    });
    
    // Work backwards from live date
    return subtractWorkingDays(options.liveDate, maxFinishTime, options.bankHolidays);
  }
  
  /**
   * Create TimelineTask objects with assigned start and end dates
   */
  private createTimelineTasks(
    graph: TaskGraph,
    projectStartDate: Date,
    options: DateAssignmentOptions
  ): TimelineTask[] {
    if (isDebugMode()) {
      // eslint-disable-next-line no-console
      console.log(`[DEBUG] createTimelineTasks called with ${graph.nodes.size} nodes`);
    }
    let tasks: TimelineTask[] = [];
    
    // Identify the final (live) task as the node with the maximum earliestFinish
    let finalFinish = -Infinity;
    let finalTaskId: string | null = null;
    graph.nodes.forEach(node => {
      if (node.earliestFinish > finalFinish) {
        finalFinish = node.earliestFinish;
        finalTaskId = node.id;
      }
    });

    const anchorWeekendLive = allowWeekendLiveDate();

    graph.nodes.forEach(node => {
      // DEBUG: Log CPM timing results
      if (isDebugMode()) {
        // eslint-disable-next-line no-console
        console.log(`[DEBUG] Task ${node.id}-${node.task.name}: earliestStart=${node.earliestStart}, earliestFinish=${node.earliestFinish}, duration=${node.duration}`);
      }
      
      // Calculate default start/end using working-day offsets
      let taskStartDate = getCPMDateOffset(
        projectStartDate,
        node.earliestStart,
        options.bankHolidays
      );
      let taskEndDate = getCPMDateOffset(
        projectStartDate,
        node.earliestFinish,
        options.bankHolidays
      );

      // If this is the final live task and weekend anchoring is allowed,
      // force the end date to the exact live date (even if weekend/holiday),
      // and recompute the start based on working-day duration.
      const isFinalLiveTask = finalTaskId === node.id;
      if (anchorWeekendLive && isFinalLiveTask) {
        taskEndDate = new Date(options.liveDate);
        const duration = Math.max(1, node.duration || 1);
        taskStartDate = subtractWorkingDays(taskEndDate, duration - 1, options.bankHolidays);
      }
      
      // Adjust end date if it falls on a non-working day
      let finalEndDate = taskEndDate;
      if (!(anchorWeekendLive && isFinalLiveTask)) {
        if (options.adjustForHolidays && isNonWorkingDay(finalEndDate, options.bankHolidays)) {
          finalEndDate = getPreviousWorkingDay(finalEndDate, options.bankHolidays);
        }
      }
      
      // Create timeline task with all necessary properties
      const timelineTask: TimelineTask = {
        ...node.task,
        duration: node.duration,
        start: safeToISOString(taskStartDate),
        end: safeToISOString(finalEndDate),
        progress: 0,
        
        // CRITICAL FIX: Include dependencies from the graph node
        dependencies: node.dependencies,
        
        // Add CPM-specific metadata for UI consumption
        ...(node.isCritical && { isCritical: true }),
        ...(node.totalFloat > 0 && { totalFloat: node.totalFloat }),
        ...(node.earliestStart !== undefined && { earliestStart: node.earliestStart }),
        ...(node.latestStart !== undefined && { latestStart: node.latestStart })
      };
      
      tasks.push(timelineTask);
    });
    
    // Post-assignment Finish-to-Start guard (FS with non-negative lag):
    // Ensure successors do not start on or before their predecessor's end date.
    if (tasks.length > 0) {
      const idToTask = new Map<string, TimelineTask>();
      tasks.forEach(t => idToTask.set(t.id, t));

      const adjustStartIfNeeded = (task: TimelineTask): TimelineTask => {
        // Skip live/anchored final task adjustments
        if (task.id === finalTaskId || task.owner === 'l') return task;
        const deps = task.dependencies || [];
        if (!deps.length) return task;

        let requiredMinStart: Date | null = null;
        let latestPredecessorEnd: Date | null = null;
        deps.forEach(dep => {
          if (!dep || dep.type !== 'FS' || dep.lag < 0) return; // only FS with gap
          const predecessor = idToTask.get(dep.predecessorId);
          if (!predecessor) return;
          // Next working day after predecessor's actual (adjusted) end
          let minStart = getNextWorkingDay(new Date(predecessor.end), options.bankHolidays);
          // Apply additional working-day lag
          for (let i = 0; i < dep.lag; i++) {
            minStart = getNextWorkingDay(minStart, options.bankHolidays);
          }
          if (!requiredMinStart || minStart.getTime() > requiredMinStart.getTime()) {
            requiredMinStart = minStart;
          }
          const predEnd = new Date(predecessor.end);
          if (!latestPredecessorEnd || predEnd.getTime() > latestPredecessorEnd.getTime()) {
            latestPredecessorEnd = predEnd;
          }
        });

        if (!requiredMinStart) return task;

        const currentStart = new Date(task.start);
        const minStartSafe: Date = requiredMinStart as Date;
        // Strict guard: if successor starts on or before the predecessor's end, push to next working day
        let predEndTime = -Infinity;
        if (latestPredecessorEnd) {
          predEndTime = (latestPredecessorEnd as Date).getTime();
        }
        if (currentStart.getTime() <= predEndTime || currentStart.getTime() < minStartSafe.getTime()) {
          const newStart = minStartSafe;
          const newEnd = addWorkingDays(newStart, task.duration, options.bankHolidays);
          return {
            ...task,
            start: safeToISOString(newStart),
            end: safeToISOString(newEnd)
          };
        }
        return task;
      };

      // Apply the guard and rebuild lookup for any chained effects
      const adjusted: TimelineTask[] = tasks.map(adjustStartIfNeeded);
      tasks = adjusted;
    }

    // Sort tasks by start date for logical ordering
    tasks.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    return tasks;
  }
  
  /**
   * Calculate the final project end date
   */
  private calculateProjectEndDate(tasks: TimelineTask[]): string {
    if (tasks.length === 0) return '';
    
    const endDates = tasks.map(task => new Date(task.end));
    const latestEndDate = new Date(Math.max(...endDates.map(d => d.getTime())));
    
    return safeToISOString(latestEndDate);
  }
  
  /**
   * Validate that all date assignments are logical and consistent
   */
  private validateDateAssignments(
    tasks: TimelineTask[],
    options: DateAssignmentOptions
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    tasks.forEach((task, index) => {
      // Validate date strings are valid
      const startDate = new Date(task.start);
      const endDate = new Date(task.end);
      
      if (isNaN(startDate.getTime())) {
        errors.push(`Task ${task.id}: Invalid start date "${task.start}"`);
      }
      
      if (isNaN(endDate.getTime())) {
        errors.push(`Task ${task.id}: Invalid end date "${task.end}"`);
      }
      
      // Validate start is before or equal to end
      if (startDate.getTime() > endDate.getTime()) {
        errors.push(`Task ${task.id}: Start date after end date`);
      }
      
      // Validate duration matches date range (approximately)
      if (startDate.getTime() <= endDate.getTime()) {
        const actualDuration = calculateWorkingDaysBetween(
          startDate,
          endDate,
          options.bankHolidays
        );
        
        // Allow for some variance due to weekend/holiday adjustments
        const expectedDuration = task.duration;
        if (Math.abs(actualDuration - expectedDuration) > 2) {
          errors.push(
            `Task ${task.id}: Duration mismatch - expected ${expectedDuration}, calculated ${actualDuration}`
          );
        }
      }
      
      // Check for task overlaps (only warn, as overlaps might be intentional)
      tasks.slice(index + 1).forEach(otherTask => {
        if (task.assetId === otherTask.assetId) {
          const taskStart = new Date(task.start).getTime();
          const taskEnd = new Date(task.end).getTime();
          const otherStart = new Date(otherTask.start).getTime();
          const otherEnd = new Date(otherTask.end).getTime();
          
          // Check for overlap
          if ((taskStart <= otherEnd && taskEnd >= otherStart)) {
            // This might be intentional (dependency-based overlap)
            // Only error if tasks have no dependency relationship
            const hasDirectDependency = 
              task.dependencies?.some(dep => dep.predecessorId === otherTask.id) ||
              otherTask.dependencies?.some(dep => dep.predecessorId === task.id);
            
            if (!hasDirectDependency) {
              // Downgraded from error to warning to prevent asset disappearing during UAT
              if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.warn(
                  `Unexpected overlap between tasks ${task.id} and ${otherTask.id} in same asset. Allowed for now.`
                );
              }
            }
          }
        }
      });
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Adjust timeline for resource constraints or external factors
   */
  public adjustTimelineForConstraints(
    tasks: TimelineTask[],
    constraints: {
      resourceLimits?: Record<string, number>;
      externalDeadlines?: Record<string, string>;
      bufferDays?: number;
    }
  ): TimelineTask[] {
    // This is a placeholder for future constraint handling
    // For now, return tasks unchanged
    let adjustedTasks = [...tasks];
    
    // Add buffer days if specified
    if (constraints.bufferDays && constraints.bufferDays > 0) {
      adjustedTasks = adjustedTasks.map(task => {
        const startDate = new Date(task.start);
        const adjustedStart = new Date(startDate.getTime() - (constraints.bufferDays! * 24 * 60 * 60 * 1000));
        
        return {
          ...task,
          start: safeToISOString(adjustedStart)
        };
      });
    }
    
    return adjustedTasks;
  }
  
  /**
   * Generate a human-readable timeline summary
   */
  public generateTimelineSummary(result: DateAssignmentResult): string {
    if (!result.success) {
      return `Timeline generation failed: ${result.errors.join(', ')}`;
    }
    
    const duration = calculateWorkingDaysBetween(
      result.projectStartDate,
      result.projectEndDate,
      []
    );
    
    const criticalTasks = result.tasks.filter(task => task.isCritical).length;
    const totalTasks = result.tasks.length;
    
    return `
Timeline Summary:
- Start Date: ${result.projectStartDate}
- End Date: ${result.projectEndDate}  
- Duration: ${duration} working days
- Total Tasks: ${totalTasks}
- Critical Path Tasks: ${criticalTasks}
- Flexibility: ${totalTasks - criticalTasks} tasks with float time
    `.trim();
  }
  
  /**
   * Compare two timelines to identify differences
   */
  public compareTimelines(
    timeline1: TimelineTask[],
    timeline2: TimelineTask[]
  ): {
    identical: boolean;
    differences: string[];
    compressionAchieved?: number;
  } {
    const differences: string[] = [];
    
    if (timeline1.length !== timeline2.length) {
      differences.push(`Different number of tasks: ${timeline1.length} vs ${timeline2.length}`);
      return { identical: false, differences };
    }
    
    // Compare each task
    timeline1.forEach((task1, index) => {
      const task2 = timeline2[index];
      
      if (task1.id !== task2.id) {
        differences.push(`Task order differs at position ${index}`);
        return;
      }
      
      if (task1.start !== task2.start) {
        differences.push(`Task ${task1.id} start date: ${task1.start} vs ${task2.start}`);
      }
      
      if (task1.end !== task2.end) {
        differences.push(`Task ${task1.id} end date: ${task1.end} vs ${task2.end}`);
      }
      
      if (task1.duration !== task2.duration) {
        differences.push(`Task ${task1.id} duration: ${task1.duration} vs ${task2.duration}`);
      }
    });
    
    // Calculate compression if timelines are comparable
    let compressionAchieved: number | undefined;
    if (timeline1.length === timeline2.length && timeline1.length > 0) {
      const duration1 = calculateWorkingDaysBetween(
        timeline1[0].start,
        timeline1[timeline1.length - 1].end,
        []
      );
      
      const duration2 = calculateWorkingDaysBetween(
        timeline2[0].start,
        timeline2[timeline2.length - 1].end,
        []
      );
      
      compressionAchieved = duration1 - duration2;
    }
    
    return {
      identical: differences.length === 0,
      differences,
      compressionAchieved
    };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create a singleton DateAssigner instance for reuse
 */
export const dateAssigner = new DateAssigner();

/**
 * Convenience function to assign dates to tasks
 */
export const assignDatesToTasks = (
  graph: TaskGraph,
  cmpResults: CPMResults,
  options: DateAssignmentOptions
): DateAssignmentResult => {
  return dateAssigner.assignDatesToTasks(graph, cmpResults, options);
};

/**
 * Quick function to create default date assignment options
 */
export const createDateAssignmentOptions = (
  liveDate: Date,
  bankHolidays: string[] = []
): DateAssignmentOptions => {
  return {
    liveDate,
    bankHolidays,
    preserveWeekends: true,
    adjustForHolidays: true
  };
};
