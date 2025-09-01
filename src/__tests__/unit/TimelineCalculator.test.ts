/**
 * TimelineCalculator Unit Tests
 * Tests all date calculation and timeline building logic
 * Ensures correct working day calculations with bank holidays
 */

import {
  buildAssetTimeline,
  calculateWorkingDaysNeeded,
  getEarliestStartDate,
  findDateConflicts,
  createTasksFromCsv,
  insertCustomTask
} from '../../services/TimelineCalculator';

import { Task, TimelineTask, Asset } from '../../types/timeline.types';

describe('TimelineCalculator', () => {

  // ============================================
  // Timeline Building Tests
  // ============================================
  
  describe('buildAssetTimeline', () => {
    const mockTasks: Task[] = [
      {
        id: 'task1',
        name: 'Design',
        duration: 5,
        owner: 'c',
        assetId: 'asset1',
        assetType: 'Banner'
      },
      {
        id: 'task2',
        name: 'Development',
        duration: 3,
        owner: 'm',
        assetId: 'asset1',
        assetType: 'Banner'
      },
      {
        id: 'task3',
        name: 'Go Live',
        duration: 1,
        owner: 'a',
        assetId: 'asset1',
        assetType: 'Banner'
      }
    ];

    it('should build timeline working backwards from live date', () => {
      const liveDate = '2024-12-20'; // Friday
      const timeline = buildAssetTimeline(mockTasks, liveDate, 'Banner');

      expect(timeline).toHaveLength(3);
      
      // Go Live task should end on the live date
      expect(timeline[2].endDate).toBe('2024-12-20');
      expect(timeline[2].name).toBe('Go Live');
      
      // Development should end before Go Live starts
      expect(timeline[1].endDate).toBe('2024-12-19');
      
      // Design should be the earliest
      expect(timeline[0].name).toBe('Design');
    });

    it('should handle weekends correctly', () => {
      const liveDate = '2024-12-23'; // Monday
      const timeline = buildAssetTimeline(mockTasks, liveDate, 'Banner');

      // Go Live on Monday (1 day)
      expect(timeline[2].startDate).toBe('2024-12-23');
      expect(timeline[2].endDate).toBe('2024-12-23');
      
      // Development (3 days) should skip the weekend
      // Should end on Friday Dec 20, start on Wednesday Dec 18
      expect(timeline[1].endDate).toBe('2024-12-20');
      expect(timeline[1].startDate).toBe('2024-12-18');
    });

    it('should account for bank holidays', () => {
      const liveDate = '2024-12-27'; // Friday after Christmas
      const bankHolidays = ['2024-12-25', '2024-12-26']; // Christmas and Boxing Day
      
      const timeline = buildAssetTimeline(
        mockTasks, 
        liveDate, 
        'Banner',
        {},
        bankHolidays
      );

      // Tasks should skip the bank holidays
      expect(timeline).toHaveLength(3);
      
      // Verify no tasks fall on bank holidays
      timeline.forEach(task => {
        expect(bankHolidays).not.toContain(task.startDate);
        expect(bankHolidays).not.toContain(task.endDate);
      });
    });

    it('should apply custom durations when provided', () => {
      const customDurations = {
        'Design': 10, // Override from 5 to 10
        'Development': 2  // Override from 3 to 2
      };
      
      const timeline = buildAssetTimeline(
        mockTasks,
        '2024-12-20',
        'Banner',
        customDurations
      );

      // Check that custom durations are applied
      const designTask = timeline.find(t => t.name === 'Design');
      const devTask = timeline.find(t => t.name === 'Development');
      
      expect(designTask?.duration).toBe(10);
      expect(devTask?.duration).toBe(2);
    });

    it('should handle empty task list', () => {
      const timeline = buildAssetTimeline([], '2024-12-20', 'Banner');
      expect(timeline).toEqual([]);
    });

    it('should handle invalid live date', () => {
      const timeline = buildAssetTimeline(mockTasks, 'invalid-date', 'Banner');
      expect(timeline).toEqual([]);
    });

    it('should handle missing live date', () => {
      const timeline = buildAssetTimeline(mockTasks, '', 'Banner');
      expect(timeline).toEqual([]);
    });
  });

  // ============================================
  // Working Days Calculation Tests
  // ============================================
  
  describe('calculateWorkingDaysNeeded', () => {
    const mockTimeline: TimelineTask[] = [
      {
        id: 'task1',
        name: 'Task 1',
        startDate: '2024-12-02', // Monday
        endDate: '2024-12-06', // Friday
        duration: 5,
        owner: 'c',
        assetId: 'asset1',
        assetType: 'Banner',
        assetName: 'Test Banner'
      },
      {
        id: 'task2',
        name: 'Task 2',
        startDate: '2024-12-09', // Monday
        endDate: '2024-12-11', // Wednesday
        duration: 3,
        owner: 'm',
        assetId: 'asset1',
        assetType: 'Banner',
        assetName: 'Test Banner'
      }
    ];

    it('should calculate total working days needed', () => {
      const days = calculateWorkingDaysNeeded(mockTimeline);
      expect(days).toBe(8); // 5 + 3 days
    });

    it('should handle empty timeline', () => {
      const days = calculateWorkingDaysNeeded([]);
      expect(days).toBe(0);
    });

    it('should sum durations correctly for multiple assets', () => {
      const multiAssetTimeline: TimelineTask[] = [
        ...mockTimeline,
        {
          id: 'task3',
          name: 'Task 3',
          startDate: '2024-12-02',
          endDate: '2024-12-04',
          duration: 3,
          owner: 'a',
          assetId: 'asset2',
          assetType: 'Email',
          assetName: 'Test Email'
        }
      ];

      const days = calculateWorkingDaysNeeded(multiAssetTimeline);
      expect(days).toBe(11); // 5 + 3 + 3 days
    });
  });

  // ============================================
  // Earliest Start Date Tests
  // ============================================
  
  describe('getEarliestStartDate', () => {
    it('should find the earliest start date in timeline', () => {
      const timeline: TimelineTask[] = [
        {
          id: 'task1',
          name: 'Early Task',
          startDate: '2024-12-01',
          endDate: '2024-12-03',
          duration: 3,
          owner: 'c',
          assetId: 'asset1',
          assetType: 'Banner',
          assetName: 'Test'
        },
        {
          id: 'task2',
          name: 'Late Task',
          startDate: '2024-12-10',
          endDate: '2024-12-12',
          duration: 3,
          owner: 'm',
          assetId: 'asset1',
          assetType: 'Banner',
          assetName: 'Test'
        }
      ];

      const earliest = getEarliestStartDate(timeline);
      expect(earliest).toBe('2024-12-01');
    });

    it('should handle empty timeline', () => {
      const earliest = getEarliestStartDate([]);
      expect(earliest).toBe('');
    });

    it('should handle single task', () => {
      const timeline: TimelineTask[] = [{
        id: 'task1',
        name: 'Only Task',
        startDate: '2024-12-15',
        endDate: '2024-12-15',
        duration: 1,
        owner: 'c',
        assetId: 'asset1',
        assetType: 'Banner',
        assetName: 'Test'
      }];

      const earliest = getEarliestStartDate(timeline);
      expect(earliest).toBe('2024-12-15');
    });
  });

  // ============================================
  // Date Conflict Detection Tests
  // ============================================
  
  describe('findDateConflicts', () => {
    it('should detect overlapping tasks', () => {
      const timeline: TimelineTask[] = [
        {
          id: 'task1',
          name: 'Task A',
          startDate: '2024-12-01',
          endDate: '2024-12-05',
          duration: 5,
          owner: 'c',
          assetId: 'asset1',
          assetType: 'Banner',
          assetName: 'Banner 1'
        },
        {
          id: 'task2',
          name: 'Task B',
          startDate: '2024-12-03', // Overlaps with Task A
          endDate: '2024-12-07',
          duration: 5,
          owner: 'm',
          assetId: 'asset1',
          assetType: 'Banner',
          assetName: 'Banner 1'
        }
      ];

      const conflicts = findDateConflicts(timeline);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toContain('overlap');
    });

    it('should not flag non-overlapping tasks', () => {
      const timeline: TimelineTask[] = [
        {
          id: 'task1',
          name: 'Task A',
          startDate: '2024-12-01',
          endDate: '2024-12-05',
          duration: 5,
          owner: 'c',
          assetId: 'asset1',
          assetType: 'Banner',
          assetName: 'Banner 1'
        },
        {
          id: 'task2',
          name: 'Task B',
          startDate: '2024-12-06', // Starts after Task A ends
          endDate: '2024-12-10',
          duration: 5,
          owner: 'm',
          assetId: 'asset1',
          assetType: 'Banner',
          assetName: 'Banner 1'
        }
      ];

      const conflicts = findDateConflicts(timeline);
      expect(conflicts).toHaveLength(0);
    });

    it('should handle tasks for different assets separately', () => {
      const timeline: TimelineTask[] = [
        {
          id: 'task1',
          name: 'Task A',
          startDate: '2024-12-01',
          endDate: '2024-12-05',
          duration: 5,
          owner: 'c',
          assetId: 'asset1',
          assetType: 'Banner',
          assetName: 'Banner 1'
        },
        {
          id: 'task2',
          name: 'Task B',
          startDate: '2024-12-03', // Same dates but different asset
          endDate: '2024-12-07',
          duration: 5,
          owner: 'm',
          assetId: 'asset2', // Different asset
          assetType: 'Email',
          assetName: 'Email 1'
        }
      ];

      const conflicts = findDateConflicts(timeline);
      expect(conflicts).toHaveLength(0); // No conflict as they're different assets
    });
  });

  // ============================================
  // CSV Task Creation Tests
  // ============================================
  
  describe('createTasksFromCsv', () => {
    const mockCsvData = [
      {
        'Asset Type': 'Banner',
        'Task': 'Design',
        'Duration': '5',
        'Owner': 'Client'
      },
      {
        'Asset Type': 'Banner',
        'Task': 'Development',
        'Duration': '3',
        'Owner': 'Agency'
      },
      {
        'Asset Type': 'Email',
        'Task': 'Copy',
        'Duration': '2',
        'Owner': 'Client'
      }
    ];

    it('should create tasks for specific asset type', () => {
      const asset: Asset = {
        id: 'asset1',
        type: 'Banner',
        name: 'Test Banner',
        startDate: '2024-12-20'
      };

      const tasks = createTasksFromCsv(mockCsvData as any, asset);
      
      expect(tasks).toHaveLength(2); // Only Banner tasks
      expect(tasks[0].name).toBe('Design');
      expect(tasks[0].duration).toBe(5);
      expect(tasks[1].name).toBe('Development');
    });

    it('should map owner names correctly', () => {
      const asset: Asset = {
        id: 'asset1',
        type: 'Banner',
        name: 'Test Banner',
        startDate: '2024-12-20'
      };

      const tasks = createTasksFromCsv(mockCsvData as any, asset);
      
      expect(tasks[0].owner).toBe('c'); // Client -> 'c'
      expect(tasks[1].owner).toBe('a'); // Agency -> 'a'
    });

    it('should handle empty CSV data', () => {
      const asset: Asset = {
        id: 'asset1',
        type: 'Banner',
        name: 'Test Banner',
        startDate: '2024-12-20'
      };

      const tasks = createTasksFromCsv([], asset);
      expect(tasks).toEqual([]);
    });

    it('should filter out non-matching asset types', () => {
      const asset: Asset = {
        id: 'asset1',
        type: 'Video',
        name: 'Test Video',
        startDate: '2024-12-20'
      };

      const tasks = createTasksFromCsv(mockCsvData as any, asset);
      expect(tasks).toHaveLength(0); // No Video tasks in CSV
    });
  });

  // ============================================
  // Custom Task Insertion Tests
  // ============================================
  
  describe('insertCustomTask', () => {
    const existingTasks: Task[] = [
      {
        id: 'task1',
        name: 'First Task',
        duration: 3,
        owner: 'c',
        assetId: 'asset1',
        assetType: 'Banner'
      },
      {
        id: 'task2',
        name: 'Second Task',
        duration: 2,
        owner: 'm',
        assetId: 'asset1',
        assetType: 'Banner'
      },
      {
        id: 'task3',
        name: 'Third Task',
        duration: 1,
        owner: 'a',
        assetId: 'asset1',
        assetType: 'Banner'
      }
    ];

    it('should insert custom task after specified task', () => {
      const customTask: Task = {
        id: 'custom1',
        name: 'Custom Task',
        duration: 4,
        owner: 'c',
        assetId: 'asset1',
        assetType: 'Banner',
        isCustom: true
      };

      const result = insertCustomTask(existingTasks, customTask, 'task1');
      
      expect(result).toHaveLength(4);
      expect(result[1].id).toBe('custom1'); // Inserted after task1
      expect(result[0].id).toBe('task1');
      expect(result[2].id).toBe('task2');
    });

    it('should append to end if insertAfter not found', () => {
      const customTask: Task = {
        id: 'custom1',
        name: 'Custom Task',
        duration: 4,
        owner: 'c',
        assetId: 'asset1',
        assetType: 'Banner',
        isCustom: true
      };

      const result = insertCustomTask(existingTasks, customTask, 'nonexistent');
      
      expect(result).toHaveLength(4);
      expect(result[3].id).toBe('custom1'); // Added at the end
    });

    it('should append to end if no insertAfter specified', () => {
      const customTask: Task = {
        id: 'custom1',
        name: 'Custom Task',
        duration: 4,
        owner: 'c',
        assetId: 'asset1',
        assetType: 'Banner',
        isCustom: true
      };

      const result = insertCustomTask(existingTasks, customTask);
      
      expect(result).toHaveLength(4);
      expect(result[3].id).toBe('custom1'); // Added at the end
    });

    it('should handle empty task list', () => {
      const customTask: Task = {
        id: 'custom1',
        name: 'Custom Task',
        duration: 4,
        owner: 'c',
        assetId: 'asset1',
        assetType: 'Banner',
        isCustom: true
      };

      const result = insertCustomTask([], customTask);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('custom1');
    });
  });
});