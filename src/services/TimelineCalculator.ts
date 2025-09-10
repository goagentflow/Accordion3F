/**
 * Timeline calculation service with factory pattern
 * Routes between sequential and DAG calculators based on feature flags
 * 
 * Following Golden Rule #1: Safety First - Feature flags allow safe rollback
 * Following Golden Rule #4: Clear Roles - Factory handles calculator selection
 */

import { 
  Task, 
  TimelineTask, 
  Asset,
  CsvRow 
} from '../types/timeline.types';

import {
  subtractWorkingDays,
  addWorkingDays,
  getPreviousWorkingDay,
  isNonWorkingDay,
  safeToISOString,
  calculateWorkingDaysBetween
} from '../utils/dateHelpers';

import { useDAGCalculator, isDebugMode } from '../config/features';
import { buildAssetTimelineDAG } from './TimelineCalculatorDAG';

// ============================================
// Calculator Factory Pattern
// ============================================

/**
 * Main timeline calculation entry point
 * Routes to appropriate calculator based on feature flags and task dependencies
 * 
 * @param rawTasks - Array of tasks without dates
 * @param liveDateStr - The go-live date as ISO string
 * @param customDurations - Optional custom task durations
 * @param bankHolidays - Array of bank holiday dates
 * @returns Array of tasks with calculated start and end dates
 */
export const buildAssetTimeline = (
  rawTasks: Task[],
  liveDateStr: string,
  customDurations: Record<string, number> = {},
  bankHolidays: string[] = []
): TimelineTask[] => {
  // Early validation
  if (!liveDateStr || rawTasks.length === 0) {
    return [];
  }
  
  const liveDate = new Date(liveDateStr);
  if (isNaN(liveDate.getTime())) {
    console.error('Invalid live date:', liveDateStr);
    return [];
  }
  
  // Determine calculator strategy
  const shouldUseDAG = useDAGCalculator();
  const hasDependencies = rawTasks.some(task => task.dependencies && task.dependencies.length > 0);
  
  if (isDebugMode()) {
    console.log('Timeline calculation strategy:', {
      useDAGFeatureFlag: shouldUseDAG,
      hasDependencies,
      taskCount: rawTasks.length,
      selectedCalculator: shouldUseDAG ? 'DAG' : 'Sequential'
    });
  }
  
  // Route to appropriate calculator
  if (shouldUseDAG) {
    // Use DAG calculator (handles both sequential and overlapped tasks)
    return buildAssetTimelineDAG(rawTasks, liveDateStr, customDurations, bankHolidays);
  } else {
    // Use original sequential calculator (preserved for backwards compatibility)
    return buildAssetTimelineSequential(rawTasks, liveDateStr, customDurations, bankHolidays);
  }
};

// ============================================
// Sequential Calculator (Original Implementation)
// ============================================

/**
 * Sequential timeline calculator (original implementation)
 * Calculates task dates working backwards from the live date
 * PRESERVED EXACTLY for backwards compatibility
 */
export const buildAssetTimelineSequential = (
  rawTasks: Task[],
  liveDateStr: string,
  customDurations: Record<string, number> = {},
  bankHolidays: string[] = []
): TimelineTask[] => {
  if (!liveDateStr || rawTasks.length === 0) {
    return [];
  }
  
  const liveDate = new Date(liveDateStr);
  if (isNaN(liveDate.getTime())) {
    console.error('Invalid live date:', liveDateStr);
    return [];
  }
  
  let currentEnd = new Date(liveDate);
  const dated: TimelineTask[] = [];
  
  // Process tasks in reverse order (from live date backwards)
  for (let i = rawTasks.length - 1; i >= 0; i--) {
    const task = rawTasks[i];
    
    // Apply custom durations if available
    const taskName = task.name;
    const duration = customDurations[taskName] !== undefined 
      ? customDurations[taskName] 
      : (task.duration || 1);
    
    let startDate: Date;
    let endDate: Date;
    
    if (i === rawTasks.length - 1) {
      // Final task goes exactly on the live date
      startDate = new Date(currentEnd);
      endDate = new Date(currentEnd);
    } else {
      // Other tasks work backwards from the current end date
      startDate = subtractWorkingDays(currentEnd, duration, bankHolidays);
      endDate = new Date(currentEnd);
      endDate.setDate(endDate.getDate() - 1);
      
      // Ensure end date is a working day
      if (isNonWorkingDay(endDate, bankHolidays)) {
        endDate = getPreviousWorkingDay(endDate, bankHolidays);
      }
    }
    
    // Create timeline task with dates and correct duration
    const timelineTask: TimelineTask = {
      ...task,
      duration, // Use the calculated duration (including custom overrides)
      start: safeToISOString(startDate),
      end: safeToISOString(endDate),
      progress: 0
    };
    
    dated.unshift(timelineTask);
    currentEnd = new Date(startDate);
  }
  
  return dated;
};

/**
 * Process CSV data into task objects for a specific asset
 * 
 * @param csvData - Raw CSV data
 * @param asset - The asset to create tasks for
 * @returns Array of task objects
 */
export const createTasksFromCsv = (
  csvData: CsvRow[],
  asset: Asset
): Task[] => {
  const rows = csvData.filter(row => row['Asset Type'] === asset.type);
  
  return rows.map((row, idx) => ({
    id: `${asset.id}-template-${idx}`,
    name: row['Task'],
    duration: parseInt(row['Duration (Days)'], 10) || 1,
    owner: row['owner'] || 'm',
    assetId: asset.id,
    assetType: asset.name,
    isCustom: false
  }));
};

/**
 * Insert a custom task into an existing task array
 * 
 * @param tasks - Current array of tasks
 * @param customTask - The custom task to insert
 * @param insertAfterTaskId - Optional task ID to insert after
 * @returns New array with custom task inserted
 */
export const insertCustomTask = (
  tasks: Task[],
  customTask: Task,
  insertAfterTaskId?: string | null
): Task[] => {
  const newTasks = [...tasks];
  let insertIndex = 0;
  
  if (insertAfterTaskId) {
    const afterIndex = newTasks.findIndex(t => t.id === insertAfterTaskId);
    if (afterIndex !== -1) {
      insertIndex = afterIndex + 1;
    }
  }
  
  newTasks.splice(insertIndex, 0, customTask);
  return newTasks;
};

/**
 * Calculate the earliest start date from a timeline
 * 
 * @param timeline - Array of timeline tasks
 * @returns The earliest start date as ISO string
 */
export const getEarliestStartDate = (timeline: TimelineTask[]): string | null => {
  if (timeline.length === 0) return null;
  
  const dates = timeline.map(task => new Date(task.start));
  const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
  
  return safeToISOString(earliest);
};

/**
 * Calculate the latest end date from a timeline
 * 
 * @param timeline - Array of timeline tasks
 * @returns The latest end date as ISO string
 */
export const getLatestEndDate = (timeline: TimelineTask[]): string | null => {
  if (timeline.length === 0) return null;
  
  const dates = timeline.map(task => new Date(task.end));
  const latest = new Date(Math.max(...dates.map(d => d.getTime())));
  
  return safeToISOString(latest);
};

/**
 * Check for date conflicts in a timeline
 * Identifies assets that would need to start before today
 * 
 * @param assets - Array of selected assets
 * @param calculatedStartDates - Map of asset IDs to calculated start dates
 * @returns Array of asset IDs with date conflicts
 */
export const findDateConflicts = (
  assets: Asset[],
  calculatedStartDates: Record<string, string>
): string[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const conflicts: string[] = [];
  
  assets.forEach(asset => {
    const startDate = calculatedStartDates[asset.id];
    if (startDate && new Date(startDate) < today) {
      conflicts.push(asset.id);
    }
  });
  
  return conflicts;
};

/**
 * Calculate working days needed to save for timeline conflicts
 * 
 * @param assets - Array of selected assets
 * @param calculatedStartDates - Map of asset IDs to calculated start dates
 * @param dateErrors - Array of asset IDs with conflicts
 * @param bankHolidays - Array of bank holiday dates
 * @returns Object with available, allocated, and needed days
 */
export const calculateWorkingDaysNeeded = (
  assets: Asset[],
  calculatedStartDates: Record<string, string>,
  dateErrors: string[],
  bankHolidays: string[] = []
): { available: number; allocated: number; needed: number } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let totalDaysInPast = 0;
  
  // Calculate days for assets with errors
  assets.forEach(asset => {
    const calculatedStart = calculatedStartDates[asset.id];
    if (calculatedStart && dateErrors.includes(asset.id)) {
      const startDate = new Date(calculatedStart);
      totalDaysInPast += calculateWorkingDaysBetween(startDate, today, bankHolidays);
    }
  });
  
  return {
    available: 0, // This would be calculated from actual available time
    allocated: 0, // This would be calculated from current timeline
    needed: totalDaysInPast
  };
};

/**
 * Generate unique asset ID
 * @returns A unique asset ID string
 */
export const generateAssetId = (): string => {
  return `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate unique task ID
 * @returns A unique task ID string
 */
export const generateTaskId = (): string => {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Calculate task end date based on start date and duration
 * 
 * @param startDate - The task start date
 * @param duration - Duration in working days
 * @param bankHolidays - Array of bank holiday dates
 * @returns The calculated end date as ISO string
 */
export const calculateTaskEndDate = (
  startDate: string,
  duration: number,
  bankHolidays: string[] = []
): string => {
  const endDate = addWorkingDays(new Date(startDate), duration, bankHolidays);
  return safeToISOString(endDate);
};

/**
 * Get task name with custom name override
 * 
 * @param taskId - The task ID
 * @param defaultName - Default task name
 * @param customNames - Map of task IDs to custom names
 * @returns The task name (custom if available, otherwise default)
 */
export const getTaskDisplayName = (
  taskId: string,
  defaultName: string,
  customNames: Record<string, string> = {}
): string => {
  return customNames[taskId] || defaultName;
};

/**
 * Calculate total duration of a timeline in working days
 * 
 * @param timeline - Array of timeline tasks
 * @param bankHolidays - Array of bank holiday dates
 * @returns Total working days from start to end
 */
export const calculateTimelineDuration = (
  timeline: TimelineTask[],
  bankHolidays: string[] = []
): number => {
  if (timeline.length === 0) return 0;
  
  const earliestStart = getEarliestStartDate(timeline);
  const latestEnd = getLatestEndDate(timeline);
  
  if (!earliestStart || !latestEnd) return 0;
  
  return calculateWorkingDaysBetween(earliestStart, latestEnd, bankHolidays);
};

/**
 * Group timeline tasks by asset
 * 
 * @param timeline - Array of timeline tasks
 * @returns Map of asset IDs to their tasks
 */
export const groupTasksByAsset = (
  timeline: TimelineTask[]
): Record<string, TimelineTask[]> => {
  const grouped: Record<string, TimelineTask[]> = {};
  
  timeline.forEach(task => {
    const assetId = task.assetId;
    if (!grouped[assetId]) {
      grouped[assetId] = [];
    }
    grouped[assetId].push(task);
  });
  
  return grouped;
};

/**
 * Filter tasks by owner type
 * 
 * @param tasks - Array of tasks
 * @param owner - Owner type to filter by
 * @returns Filtered array of tasks
 */
export const filterTasksByOwner = (
  tasks: TimelineTask[],
  owner: 'c' | 'm' | 'a' | 'l'
): TimelineTask[] => {
  return tasks.filter(task => task.owner === owner);
};

/**
 * Sort timeline tasks by start date
 * 
 * @param tasks - Array of timeline tasks
 * @returns Sorted array (earliest first)
 */
export const sortTasksByStartDate = (
  tasks: TimelineTask[]
): TimelineTask[] => {
  return [...tasks].sort((a, b) => {
    const dateA = new Date(a.start).getTime();
    const dateB = new Date(b.start).getTime();
    return dateA - dateB;
  });
};