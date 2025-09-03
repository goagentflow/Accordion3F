/**
 * State Adapter Functions
 * Transforms between TimelineBuilder flat state and useAutoSave nested TimelineState
 * Follows Golden Rules: Safety First, Clear Roles
 */

/**
 * Convert flat TimelineBuilder state to nested TimelineState structure
 * @param {Object} flatState - The flat state from TimelineBuilder
 * @returns {Object} Nested TimelineState compatible with useAutoSave
 */
export function flatToNested(flatState) {
  const {
    selectedAssets = [],
    availableAssetTypes = [],
    assetLiveDates = {},
    assetTaskDurations = {},
    taskBank = {},  // Add taskBank handling
    customTasks = [],
    customTaskNames = {},
    globalLiveDate = '',
    useGlobalDate = true,
    bankHolidays = [],
    showInfoBox = false,
    // Additional fields that might exist
    parallelConfig = {},
    allTasks = [],
    timeline = []
  } = flatState;

  return {
    assets: {
      selected: selectedAssets,
      available: availableAssetTypes,
      liveDates: assetLiveDates,
      taskDurations: assetTaskDurations
    },
    tasks: {
      all: allTasks,
      custom: customTasks,
      timeline: timeline,
      names: customTaskNames,
      parallelConfig: parallelConfig,
      bank: taskBank  // Add taskBank to nested structure
    },
    dates: {
      globalLiveDate,
      useGlobalDate,
      bankHolidays,
      projectStartDate: null // Will be calculated
    },
    ui: {
      showInfoBox,
      dateErrors: []
    }
  };
}

/**
 * Convert nested TimelineState back to flat TimelineBuilder state
 * @param {Object} nestedState - The nested TimelineState from useAutoSave
 * @returns {Object} Flat state compatible with TimelineBuilder
 */
export function nestedToFlat(nestedState) {
  const {
    assets = {},
    tasks = {},
    dates = {},
    ui = {}
  } = nestedState;

  return {
    selectedAssets: assets.selected || [],
    availableAssetTypes: assets.available || [],
    assetLiveDates: assets.liveDates || {},
    assetTaskDurations: assets.taskDurations || {},
    taskBank: tasks.bank || {},  // Extract taskBank from nested structure
    customTasks: tasks.custom || [],
    customTaskNames: tasks.names || {},
    globalLiveDate: dates.globalLiveDate || '',
    useGlobalDate: dates.useGlobalDate !== false, // Default to true
    bankHolidays: dates.bankHolidays || [],
    showInfoBox: ui.showInfoBox || false,
    // Additional fields
    parallelConfig: tasks.parallelConfig || {},
    allTasks: tasks.all || [],
    timeline: tasks.timeline || []
  };
}

/**
 * Create a minimal state snapshot for change detection
 * @param {Object} flatState - The flat state from TimelineBuilder
 * @returns {string} Serialized state for comparison
 */
export function createStateSnapshot(flatState) {
  // Only include fields that represent actual user changes
  const relevantState = {
    selectedAssets: flatState.selectedAssets,
    globalLiveDate: flatState.globalLiveDate,
    useGlobalDate: flatState.useGlobalDate,
    assetLiveDates: flatState.assetLiveDates,
    assetTaskDurations: flatState.assetTaskDurations,
    taskBank: flatState.taskBank || {},  // Include taskBank for custom tasks
    customTasks: flatState.customTasks,
    customTaskNames: flatState.customTaskNames,
    parallelConfig: flatState.parallelConfig || {}
  };
  
  return JSON.stringify(relevantState);
}

/**
 * Compare two state snapshots to detect changes
 * @param {string} snapshot1 - First state snapshot
 * @param {string} snapshot2 - Second state snapshot
 * @returns {boolean} True if states are different
 */
export function hasStateChanged(snapshot1, snapshot2) {
  return snapshot1 !== snapshot2;
}