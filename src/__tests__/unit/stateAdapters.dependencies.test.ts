import { flatToNested, nestedToFlat, createStateSnapshot } from '../../../src/utils/stateAdapters';

describe('stateAdapters - taskDependencies round-trip', () => {
  test('preserves taskDependencies from flat -> nested -> flat', () => {
    const flat = {
      selectedAssets: [{ id: 'a1', type: 'Banner', name: 'Banner', startDate: '2025-12-20' }],
      availableAssetTypes: ['Banner'],
      assetLiveDates: {},
      assetTaskDurations: {},
      taskDependencies: {
        'task-2': [
          { predecessorId: 'task-1', type: 'FS', lag: -2 }
        ],
        'task-4': [
          { predecessorId: 'task-3', type: 'FS', lag: 0 }
        ]
      },
      taskBank: {},
      customTasks: [],
      customTaskNames: {},
      globalLiveDate: '2025-12-31',
      useGlobalDate: true,
      bankHolidays: [],
      showInfoBox: false,
      parallelConfig: {},
      allTasks: [],
      timeline: []
    };

    const nested = flatToNested(flat as any);
    expect(nested.tasks).toBeDefined();
    expect(nested.tasks.dependencies).toBeDefined();
    expect(nested.tasks.dependencies).toEqual(flat.taskDependencies);

    const flat2 = nestedToFlat(nested as any) as any;
    expect(flat2.taskDependencies).toEqual(flat.taskDependencies);

    // Snapshot used by dirty-state detection should include dependencies
    const snapshot = createStateSnapshot(flat2);
    const parsed = JSON.parse(snapshot);
    expect(parsed.taskDependencies).toEqual(flat.taskDependencies);
  });
});

