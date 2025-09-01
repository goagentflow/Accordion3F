/**
 * TimelineReducer Unit Tests
 * Tests all reducer actions and state management logic
 */

import { timelineReducer } from '../../reducers/timelineReducer';
import { TimelineState, Asset, Task, ActionType } from '../../types/timeline.types';

// Mock ValidationService with proper return values
jest.mock('../../services/ValidationService', () => ({
  ValidationService: {
    validateAssetName: jest.fn().mockImplementation((name) => ({ 
      valid: name && name.length > 0, 
      sanitized: name || '',
      error: name && name.length > 0 ? undefined : 'Asset name is required'
    })),
    validateTaskName: jest.fn().mockImplementation((name) => ({ 
      valid: name && name.length > 0, 
      sanitized: name || '',
      error: name && name.length > 0 ? undefined : 'Task name is required'
    })),
    validateDuration: jest.fn().mockImplementation((duration) => ({ 
      valid: duration > 0 && duration <= 365, 
      value: Number(duration),
      error: duration > 0 && duration <= 365 ? undefined : 'Duration must be between 1 and 365 days'
    })),
    validateDate: jest.fn().mockImplementation((date) => ({ 
      valid: true, 
      value: new Date(date),
      error: undefined
    })),
    checkLimits: jest.fn().mockImplementation((type, count) => ({
      allowed: count < 50,
      error: count >= 50 ? 'Limit reached' : undefined
    })),
    sanitizeText: jest.fn().mockImplementation((text) => text),
    sanitizeCsvRow: jest.fn().mockImplementation((row) => row)
  },
  VALIDATION_LIMITS: {
    MAX_ASSETS: 50,
    MAX_TASKS: 500,
    MAX_CUSTOM_TASKS: 100,
    MIN_DURATION: 1,
    MAX_DURATION: 365
  }
}));

describe('timelineReducer', () => {
  // Create initial state matching actual reducer structure
  const createInitialState = (): TimelineState => ({
    assets: {
      available: [],
      selected: [],
      liveDates: {},
      taskDurations: {}
    },
    tasks: {
      all: [],
      bank: {},
      byAsset: {},
      timeline: [],
      custom: [],
      names: {}
    },
    dates: {
      globalLiveDate: '',
      useGlobalDate: true,
      projectStartDate: '',
      bankHolidays: []
    },
    ui: {
      showInfoBox: true,
      showGettingStarted: false,
      showAllInstructions: false,
      dateErrors: []
    }
  });

  // ============================================
  // Asset Actions Tests
  // ============================================

  describe('Asset Actions', () => {
    it('should handle ADD_ASSET action', () => {
      const initialState = createInitialState();
      const action = {
        type: ActionType.ADD_ASSET as const,
        payload: {
          assetType: 'Banner',
          name: 'Test Banner'
        }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.assets.selected).toHaveLength(1);
      expect(newState.assets.selected[0].type).toBe('Banner');
      expect(newState.assets.selected[0].name).toBe('Test Banner');
      expect(newState.assets.selected[0].id).toBeDefined();
    });

    it('should reject ADD_ASSET when limit reached', () => {
      const initialState = createInitialState();
      // Fill up to limit
      initialState.assets.selected = new Array(50).fill(null).map((_, i) => ({
        id: `asset-${i}`,
        type: 'Banner',
        name: `Banner ${i}`,
        startDate: ''
      }));

      const action = {
        type: ActionType.ADD_ASSET as const,
        payload: {
          assetType: 'Banner',
          name: 'Over Limit'
        }
      };

      const newState = timelineReducer(initialState, action);
      expect(newState.assets.selected).toHaveLength(50); // Should not add
    });

    it('should handle REMOVE_ASSET action', () => {
      const initialState = createInitialState();
      const asset: Asset = {
        id: 'asset-1',
        type: 'Banner',
        name: 'Test Banner',
        startDate: ''
      };
      initialState.assets.selected = [asset];

      const action = {
        type: ActionType.REMOVE_ASSET as const,
        payload: { assetId: 'asset-1' }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.assets.selected).toHaveLength(0);
    });

    it('should handle RENAME_ASSET action', () => {
      const initialState = createInitialState();
      const asset: Asset = {
        id: 'asset-1',
        type: 'Banner',
        name: 'Old Name',
        startDate: ''
      };
      initialState.assets.selected = [asset];

      const action = {
        type: ActionType.RENAME_ASSET as const,
        payload: {
          assetId: 'asset-1',
          newName: 'New Name'
        }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.assets.selected[0].name).toBe('New Name');
    });

    it('should handle SET_ASSET_LIVE_DATE action', () => {
      const initialState = createInitialState();
      
      const action = {
        type: ActionType.SET_ASSET_LIVE_DATE as const,
        payload: {
          assetId: 'asset-1',
          date: '2024-12-25'
        }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.assets.liveDates['asset-1']).toBe('2024-12-25');
    });
  });

  // ============================================
  // Date Actions Tests
  // ============================================

  describe('Date Actions', () => {
    it('should handle SET_GLOBAL_LIVE_DATE action', () => {
      const initialState = createInitialState();
      const action = {
        type: ActionType.SET_GLOBAL_LIVE_DATE as const,
        payload: { date: '2024-12-25' }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.dates.globalLiveDate).toBe('2024-12-25');
    });

    it('should handle TOGGLE_USE_GLOBAL_DATE action', () => {
      const initialState = createInitialState();
      initialState.dates.useGlobalDate = true;

      const action = {
        type: ActionType.TOGGLE_USE_GLOBAL_DATE as const,
        payload: {}
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.dates.useGlobalDate).toBe(false);
    });

    it('should handle SET_BANK_HOLIDAYS action', () => {
      const initialState = createInitialState();
      const action = {
        type: ActionType.SET_BANK_HOLIDAYS as const,
        payload: {
          holidays: ['2024-12-25', '2024-12-26']
        }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.dates.bankHolidays).toEqual(['2024-12-25', '2024-12-26']);
    });
  });

  // ============================================
  // Task Actions Tests
  // ============================================

  describe('Task Actions', () => {
    it('should handle ADD_CUSTOM_TASK action', () => {
      const initialState = createInitialState();
      const action = {
        type: ActionType.ADD_CUSTOM_TASK as const,
        payload: {
          assetId: 'asset-1',
          name: 'Custom Task',
          duration: 5,
          owner: 'c',
          insertAfter: null
        }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.tasks.custom).toHaveLength(1);
      expect(newState.tasks.custom[0].name).toBe('Custom Task');
      expect(newState.tasks.custom[0].duration).toBe(5);
    });

    it('should handle UPDATE_TASK_DURATION action', () => {
      const initialState = createInitialState();
      initialState.assets.taskDurations['task-1'] = 3;

      const action = {
        type: ActionType.UPDATE_TASK_DURATION as const,
        payload: {
          taskId: 'task-1',
          duration: 5
        }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.assets.taskDurations['task-1']).toBe(5);
    });

    it('should handle RENAME_TASK action', () => {
      const initialState = createInitialState();
      const customTask = {
        id: 'custom-1',
        name: 'Old Name',
        duration: 3,
        owner: 'c' as const,
        assetId: 'asset-1',
        assetType: 'Banner' as const,
        insertAfter: null,
        isCustom: true
      };
      initialState.tasks.custom = [customTask];

      const action = {
        type: ActionType.RENAME_TASK as const,
        payload: {
          taskId: 'custom-1',
          newName: 'New Name'
        }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.tasks.custom[0].name).toBe('New Name');
    });

    it('should handle UPDATE_TASK_BANK action', () => {
      const initialState = createInitialState();
      const taskBank = {
        'Banner': [
          {
            id: 'tb-1',
            name: 'Design',
            duration: 5,
            owner: 'c' as const,
            assetId: '',
            assetType: 'Banner' as const
          }
        ]
      };

      const action = {
        type: ActionType.UPDATE_TASK_BANK as const,
        payload: { taskBank }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.tasks.bank).toEqual(taskBank);
    });
  });

  // ============================================
  // UI Actions Tests
  // ============================================

  describe('UI Actions', () => {
    it('should handle TOGGLE_INFO_BOX action', () => {
      const initialState = createInitialState();
      initialState.ui.showInfoBox = true;

      const action = {
        type: ActionType.TOGGLE_INFO_BOX as const,
        payload: {}
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.ui.showInfoBox).toBe(false);
    });

    it('should handle SET_GETTING_STARTED action', () => {
      const initialState = createInitialState();

      const action = {
        type: ActionType.SET_GETTING_STARTED as const,
        payload: { show: true }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.ui.showGettingStarted).toBe(true);
    });

    it('should handle SET_ALL_INSTRUCTIONS action', () => {
      const initialState = createInitialState();

      const action = {
        type: ActionType.SET_ALL_INSTRUCTIONS as const,
        payload: { show: true }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.ui.showAllInstructions).toBe(true);
    });
  });

  // ============================================
  // System Actions Tests
  // ============================================

  describe('System Actions', () => {
    it('should handle IMPORT_STATE action', () => {
      const initialState = createInitialState();
      const importedState = {
        assets: {
          selected: [
            { id: 'imported-1', type: 'Banner' as const, name: 'Imported', startDate: '' }
          ],
          available: [],
          liveDates: {},
          taskDurations: {}
        },
        dates: {
          globalLiveDate: '2024-12-25',
          useGlobalDate: false,
          projectStartDate: '2024-11-01',
          bankHolidays: []
        }
      };

      const action = {
        type: ActionType.IMPORT_STATE as const,
        payload: { state: importedState }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.assets.selected).toHaveLength(1);
      expect(newState.assets.selected[0].name).toBe('Imported');
      expect(newState.dates.globalLiveDate).toBe('2024-12-25');
      expect(newState.dates.useGlobalDate).toBe(false);
    });

    it('should handle RESET_STATE action', () => {
      const initialState = createInitialState();
      // Add some data
      initialState.assets.selected = [
        { id: 'asset-1', type: 'Banner', name: 'Test', startDate: '' }
      ];
      initialState.dates.globalLiveDate = '2024-12-25';

      const action = {
        type: ActionType.RESET_STATE as const,
        payload: {}
      };

      const newState = timelineReducer(initialState, action);

      expect(newState.assets.selected).toHaveLength(0);
      expect(newState.dates.globalLiveDate).toBe('');
    });

    it('should handle LOAD_CSV_DATA action', () => {
      const initialState = createInitialState();
      const csvData = [
        {
          'Asset Type': 'Banner',
          'Task': 'Design',
          'Duration': '5',
          'Owner': 'Client'
        },
        {
          'Asset Type': 'Email',
          'Task': 'Copy',
          'Duration': '3',
          'Owner': 'Agency'
        }
      ];

      const action = {
        type: ActionType.LOAD_CSV_DATA as const,
        payload: { data: csvData }
      };

      const newState = timelineReducer(initialState, action);

      // CSV import should update task bank
      expect(Object.keys(newState.tasks.bank).length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // State Immutability Tests
  // ============================================

  describe('State Immutability', () => {
    it('should not mutate original state', () => {
      const initialState = createInitialState();
      const originalState = JSON.parse(JSON.stringify(initialState));

      const action = {
        type: ActionType.ADD_ASSET as const,
        payload: {
          assetType: 'Banner',
          name: 'Test'
        }
      };

      timelineReducer(initialState, action);

      expect(initialState).toEqual(originalState);
    });

    it('should create new object references for changed properties', () => {
      const initialState = createInitialState();
      
      const action = {
        type: ActionType.SET_GLOBAL_LIVE_DATE as const,
        payload: { date: '2024-12-25' }
      };

      const newState = timelineReducer(initialState, action);

      expect(newState).not.toBe(initialState);
      expect(newState.dates).not.toBe(initialState.dates);
      expect(newState.assets).toBe(initialState.assets); // Unchanged
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('Error Handling', () => {
    it('should return current state for unknown action', () => {
      const initialState = createInitialState();
      
      const action = {
        type: 'UNKNOWN_ACTION' as any,
        payload: {}
      };

      const newState = timelineReducer(initialState, action);

      expect(newState).toBe(initialState);
    });

    it('should handle missing payload gracefully', () => {
      const initialState = createInitialState();
      
      const action = {
        type: ActionType.ADD_ASSET as const,
        payload: undefined as any
      };

      const newState = timelineReducer(initialState, action);

      // Should not crash, return current state
      expect(newState).toBe(initialState);
    });
  });
});