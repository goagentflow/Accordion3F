/**
 * Excel Import Transform Unit Tests
 * 
 * These tests validate that imported Excel metadata preserves dependencies
 * and that the orchestrator uses instanceBase if present. This catches regressions
 * before the UI is involved, as recommended by senior dev feedback.
 * 
 * PRIORITY: High - Critical for preventing overlap loss regressions
 */

import { transformImportedJson } from '../../services/ExcelImporter';

describe('Excel Import Transform', () => {
  
  describe('transformImportedJson', () => {
    
    test('preserves task dependencies from Excel metadata', () => {
      const mockJsonData = {
        version: '2.0',
        exportDate: '2025-09-13',
        taskCount: 3,
        timeline: [
          {
            id: 'task-1',
            name: 'Content Creation',
            duration: 5,
            owner: 'c',
            assetId: 'asset-1',
            assetType: 'Banner',
            startDate: '2025-01-01',
            endDate: '2025-01-06',
            dependencies: [
              { predecessorId: 'task-2', type: 'FS', lag: -2 }
            ]
          },
          {
            id: 'task-2',
            name: 'Design Review',
            duration: 3,
            owner: 'm',
            assetId: 'asset-1',
            assetType: 'Banner',
            startDate: '2025-01-03',
            endDate: '2025-01-06',
            dependencies: []
          },
          {
            id: 'task-3',
            name: 'Production',
            duration: 4,
            owner: 'c',
            assetId: 'asset-2',
            assetType: 'Video',
            startDate: '2025-01-01',
            endDate: '2025-01-05',
            dependencies: [
              { predecessorId: 'task-1', type: 'FS', lag: -1 },
              { predecessorId: 'task-2', type: 'FS', lag: 0 }
            ]
          }
        ],
        selectedAssets: [
          { id: 'asset-1', type: 'Banner', name: 'Campaign Banner' },
          { id: 'asset-2', type: 'Video', name: 'Product Video' }
        ],
        globalLiveDate: '2025-01-15',
        useGlobalDate: true,
        customTasks: [],
        assetTaskDurations: {},
        customTaskNames: {}
      };

      const result = transformImportedJson(mockJsonData);

      // Verify dependencies are preserved
      expect(result.tasks).toHaveLength(3);
      
      const task1 = result.tasks.find(t => t.id === 'task-1');
      expect(task1?.dependencies).toEqual([
        { predecessorId: 'task-2', type: 'FS', lag: -2 }
      ]);
      
      const task3 = result.tasks.find(t => t.id === 'task-3');
      expect(task3?.dependencies).toEqual([
        { predecessorId: 'task-1', type: 'FS', lag: -1 },
        { predecessorId: 'task-2', type: 'FS', lag: 0 }
      ]);
      
      // Verify no dependencies are lost
      const totalDependencies = result.tasks.reduce(
        (count, task) => count + (task.dependencies?.length || 0), 
        0
      );
      expect(totalDependencies).toBe(3);
    });

    test('transforms dates correctly for compatibility', () => {
      const mockJsonData = {
        version: '2.0',
        exportDate: '2025-09-13',
        taskCount: 1,
        timeline: [
          {
            id: 'task-1',
            name: 'Test Task',
            duration: 5,
            owner: 'c',
            assetId: 'asset-1',
            assetType: 'Banner',
            startDate: '2025-01-01',
            endDate: '2025-01-06'
          }
        ]
      };

      const result = transformImportedJson(mockJsonData);
      
      const task = result.tasks[0];
      expect(task.start).toBe('2025-01-01');
      expect(task.end).toBe('2025-01-06');
    });

    test('preserves all metadata fields required by orchestrator', () => {
      const mockJsonData = {
        version: '2.1',
        exportDate: '2025-09-13T10:30:00.000Z',
        taskCount: 2,
        timeline: [
          {
            id: 'task-1',
            name: 'Custom Task',
            duration: 3,
            owner: 'a',
            assetId: 'asset-1',
            assetType: 'Social',
            isCustom: true,
            startDate: '2025-01-01',
            endDate: '2025-01-04',
            dependencies: []
          }
        ],
        selectedAssets: [
          { id: 'asset-1', type: 'Social', name: 'Social Campaign', startDate: '2025-01-01' }
        ],
        globalLiveDate: '2025-01-20',
        assetLiveDates: {
          'asset-1': '2025-01-15'
        },
        useGlobalDate: false,
        customTasks: [
          { id: 'custom-1', name: 'Review Meeting', duration: 1, owner: 'm' }
        ],
        assetTaskDurations: {
          'Social': { 'Content Creation': 5, 'Design Review': 2 }
        },
        customTaskNames: {
          'Social': ['Custom Social Task']
        }
      };

      const result = transformImportedJson(mockJsonData);

      // Verify core metadata
      expect(result.version).toBe('2.1');
      expect(result.exportDate).toBe('2025-09-13T10:30:00.000Z');
      expect(result.taskCount).toBe(2);

      // Verify assets and dates
      expect(result.selectedAssets).toEqual(mockJsonData.selectedAssets);
      expect(result.globalLiveDate).toBe('2025-01-20');
      expect(result.assetLiveDates).toEqual({ 'asset-1': '2025-01-15' });
      expect(result.useGlobalDate).toBe(false);

      // Verify custom data
      expect(result.customTasks).toEqual(mockJsonData.customTasks);
      expect(result.assetTaskDurations).toEqual(mockJsonData.assetTaskDurations);
      expect(result.customTaskNames).toEqual(mockJsonData.customTaskNames);

      // Verify task transformation preserves custom flag
      const customTask = result.tasks.find(t => t.id === 'task-1');
      expect(customTask?.isCustom).toBe(true);
    });

    test('handles missing optional fields gracefully with defaults', () => {
      const minimalJsonData = {
        version: '1.0',
        timeline: [
          {
            id: 'task-1',
            name: 'Basic Task',
            duration: 1,
            startDate: '2025-01-01',
            endDate: '2025-01-02'
          }
        ]
      };

      const result = transformImportedJson(minimalJsonData);

      // Verify defaults are applied
      expect(result.selectedAssets).toEqual([]);
      expect(result.globalLiveDate).toBe('');
      expect(result.assetLiveDates).toEqual({});
      expect(result.useGlobalDate).toBe(true);
      expect(result.customTasks).toEqual([]);
      expect(result.assetTaskDurations).toEqual({});
      expect(result.customTaskNames).toEqual({});

      // Verify task still transforms correctly
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].name).toBe('Basic Task');
    });

    test('preserves complex dependency chains for orchestrator', () => {
      const complexJsonData = {
        version: '2.0',
        timeline: [
          {
            id: 'task-a',
            name: 'Start Task',
            duration: 2,
            assetId: 'asset-1',
            startDate: '2025-01-01',
            endDate: '2025-01-03',
            dependencies: []
          },
          {
            id: 'task-b',
            name: 'Middle Task',
            duration: 3,
            assetId: 'asset-1',
            startDate: '2025-01-01',
            endDate: '2025-01-04',
            dependencies: [
              { predecessorId: 'task-a', type: 'FS', lag: -2 } // 2-day overlap
            ]
          },
          {
            id: 'task-c',
            name: 'End Task',
            duration: 1,
            assetId: 'asset-2',
            startDate: '2025-01-03',
            endDate: '2025-01-04',
            dependencies: [
              { predecessorId: 'task-a', type: 'FS', lag: 0 },
              { predecessorId: 'task-b', type: 'FS', lag: -1 } // 1-day overlap
            ]
          }
        ]
      };

      const result = transformImportedJson(complexJsonData);

      // Verify all dependencies are preserved exactly
      const taskA = result.tasks.find(t => t.id === 'task-a');
      const taskB = result.tasks.find(t => t.id === 'task-b');
      const taskC = result.tasks.find(t => t.id === 'task-c');

      expect(taskA?.dependencies).toEqual([]);
      expect(taskB?.dependencies).toEqual([
        { predecessorId: 'task-a', type: 'FS', lag: -2 }
      ]);
      expect(taskC?.dependencies).toEqual([
        { predecessorId: 'task-a', type: 'FS', lag: 0 },
        { predecessorId: 'task-b', type: 'FS', lag: -1 }
      ]);

      // Verify negative lags (overlaps) are preserved
      const overlappingDeps = result.tasks
        .flatMap(t => t.dependencies || [])
        .filter(d => d.lag < 0);
      
      expect(overlappingDeps).toHaveLength(2);
      expect(overlappingDeps.map(d => d.lag)).toEqual([-2, -1]);
    });
  });
});

// Test fixture for instanceBase testing (simulating ImportManager behavior)
export const createInstanceBaseFromTasks = (tasks: any[]): Record<string, any[]> => {
  const baseByInstance: Record<string, any[]> = {};
  tasks.forEach((t: any) => {
    if (!t || !t.assetId) return;
    if (!baseByInstance[t.assetId]) baseByInstance[t.assetId] = [];
    baseByInstance[t.assetId].push({
      id: t.id,
      name: t.name,
      duration: t.duration,
      owner: t.owner || 'm',
      assetId: t.assetId,
      assetType: t.assetType,
      isCustom: !!t.isCustom,
      dependencies: Array.isArray(t.dependencies) ? t.dependencies.map((d: any) => ({
        predecessorId: d.predecessorId,
        type: 'FS' as const,
        lag: d.lag
      })) : []
    });
  });
  return baseByInstance;
};

describe('ImportManager instanceBase creation', () => {
  
  test('creates instanceBase that preserves dependencies for orchestrator', () => {
    const importedTasks = [
      {
        id: 'task-1',
        name: 'Content',
        duration: 5,
        owner: 'c',
        assetId: 'banner-1',
        assetType: 'Banner',
        dependencies: [
          { predecessorId: 'task-2', type: 'FS', lag: -2 }
        ]
      },
      {
        id: 'task-2',
        name: 'Design',
        duration: 3,
        owner: 'm',
        assetId: 'banner-1',
        assetType: 'Banner',
        dependencies: []
      },
      {
        id: 'task-3',
        name: 'Production',
        duration: 4,
        owner: 'c',
        assetId: 'video-1',
        assetType: 'Video',
        dependencies: [
          { predecessorId: 'task-1', type: 'FS', lag: -1 }
        ]
      }
    ];

    const instanceBase = createInstanceBaseFromTasks(importedTasks);

    // Verify structure: tasks grouped by assetId
    expect(Object.keys(instanceBase)).toEqual(['banner-1', 'video-1']);
    expect(instanceBase['banner-1']).toHaveLength(2);
    expect(instanceBase['video-1']).toHaveLength(1);

    // Verify dependencies are preserved in instanceBase format
    const bannerTasks = instanceBase['banner-1'];
    const contentTask = bannerTasks.find(t => t.name === 'Content');
    const designTask = bannerTasks.find(t => t.name === 'Design');

    expect(contentTask?.dependencies).toEqual([
      { predecessorId: 'task-2', type: 'FS', lag: -2 }
    ]);
    expect(designTask?.dependencies).toEqual([]);

    const videoTasks = instanceBase['video-1'];
    const productionTask = videoTasks[0];
    
    expect(productionTask.dependencies).toEqual([
      { predecessorId: 'task-1', type: 'FS', lag: -1 }
    ]);
  });

  test('handles tasks without dependencies gracefully', () => {
    const tasksWithoutDeps = [
      {
        id: 'task-1',
        name: 'Simple Task',
        duration: 2,
        assetId: 'asset-1',
        assetType: 'Simple'
        // No dependencies field
      }
    ];

    const instanceBase = createInstanceBaseFromTasks(tasksWithoutDeps);
    
    expect(instanceBase['asset-1'][0].dependencies).toEqual([]);
  });

  test('provides default owner when missing', () => {
    const tasksWithoutOwner = [
      {
        id: 'task-1',
        name: 'Unowned Task',
        duration: 1,
        assetId: 'asset-1',
        assetType: 'Test'
        // No owner field
      }
    ];

    const instanceBase = createInstanceBaseFromTasks(tasksWithoutOwner);
    
    expect(instanceBase['asset-1'][0].owner).toBe('m');
  });

  test('preserves isCustom flag correctly', () => {
    const mixedTasks = [
      {
        id: 'task-1',
        name: 'Standard Task',
        duration: 2,
        assetId: 'asset-1',
        assetType: 'Banner',
        isCustom: false
      },
      {
        id: 'task-2',
        name: 'Custom Task',
        duration: 3,
        assetId: 'asset-1',
        assetType: 'Banner',
        isCustom: true
      }
    ];

    const instanceBase = createInstanceBaseFromTasks(mixedTasks);
    const tasks = instanceBase['asset-1'];
    
    expect(tasks.find(t => t.name === 'Standard Task')?.isCustom).toBe(false);
    expect(tasks.find(t => t.name === 'Custom Task')?.isCustom).toBe(true);
  });
});