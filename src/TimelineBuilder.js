import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import Papa from 'papaparse';
import AssetSelector from './components/AssetSelector';
import CampaignSetup from './components/CampaignSetup';
import GanttChart from './components/GanttChart';
import RecoveryPrompt from './components/RecoveryPrompt';
import SaveIndicator from './components/SaveIndicator';
import { exportToExcel } from './services/ExcelExporter';
import { importFromExcel, validateExcelFile, getImportPreview } from './services/ExcelImporter';
import { useAutoSave } from './hooks/useAutoSave';
import { useBeforeUnload } from './hooks/useBeforeUnload';
import { flatToNested, nestedToFlat, createStateSnapshot, hasStateChanged } from './utils/stateAdapters';
import { isSundayOnlyAsset } from './components/ganttUtils';
import { buildAssetTimeline as buildAssetTimelineCalculator } from './services/TimelineCalculator';
import { TimelineActions } from './actions/timelineActions';
// import DependencyManagementButton from './components/DependencyManagementButton';
import TimelineCompressionMetrics from './components/TimelineCompressionMetrics.tsx';
import SimpleAnalytics from './components/SimpleAnalytics';

const TimelineBuilder = () => {
    // CSV and asset data
    const [csvData, setCsvData] = useState([]);
    const [uniqueAssets, setUniqueAssets] = useState([]);
    // Each selected asset is now an object with a unique id, type, name, and startDate
    const [selectedAssets, setSelectedAssets] = useState([]);
    
    // Live date management
    const [globalLiveDate, setGlobalLiveDate] = useState('');
    const [useGlobalDate, setUseGlobalDate] = useState(true);
    const [assetLiveDates, setAssetLiveDates] = useState({}); // {assetName: 'YYYY-MM-DD'}
    
    // Calculated results
    const [calculatedStartDates, setCalculatedStartDates] = useState({}); // {assetName: 'YYYY-MM-DD'}
    const [projectStartDate, setProjectStartDate] = useState(''); // Earliest start date across all assets
    const [dateErrors, setDateErrors] = useState([]); // Array of asset names that start before today
    const [sundayDateErrors, setSundayDateErrors] = useState([]); // Array of asset IDs that violate Sunday-only rule
    
    // timelineTasks will be derived using useMemo - no longer state
    const [showInfoBox, setShowInfoBox] = useState(true); // Add state for info box

    // Add state to store custom task durations for each asset instance
    const [assetTaskDurations, setAssetTaskDurations] = useState({}); // { assetId: { taskName: duration, ... } }
    // Add state to store task dependencies for DAG calculation
    const [taskDependencies, setTaskDependencies] = useState({}); // { taskId: [{predecessorId, type, lag}, ...] }

    // Task bank will be derived using useMemo - no longer state

    // Add state to store custom tasks separately
    const [customTasks, setCustomTasks] = useState([]); // Array of custom task objects

    // Add state to store custom task names
    const [customTaskNames, setCustomTaskNames] = useState({}); // { taskId: customName }

    // Add state to store bank holidays
    const [bankHolidays, setBankHolidays] = useState([]); // Array of YYYY-MM-DD strings

    // State for parallel task configuration (empty for now, ready for future use)
    const [parallelConfig, setParallelConfig] = useState({}); // { taskName: { parallelWith: string, startOffset: number } }

    // State for undo/redo functionality
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isUndoRedoAction, setIsUndoRedoAction] = useState(false);
    
    // State for progressive disclosure
    const [showGettingStarted, setShowGettingStarted] = useState(false);
    const [showAllInstructions, setShowAllInstructions] = useState(false);
    
    // Excel import/export state
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [importError, setImportError] = useState(null);
    const [showImportConfirm, setShowImportConfirm] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [importPreview, setImportPreview] = useState(null);
    const fileInputRef = useRef(null);

    // State change tracking for dirty state detection
    const [initialStateSnapshot, setInitialStateSnapshot] = useState(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Function to get current flat state dynamically
    const getCurrentFlatState = useCallback(() => {
        return {
            selectedAssets,
            globalLiveDate,
            useGlobalDate,
            assetLiveDates,
            assetTaskDurations,
            taskDependencies,
            // taskBank is now derived data, not source data - don't save it
            customTasks,
            customTaskNames,
            bankHolidays,
            parallelConfig,
            availableAssetTypes: uniqueAssets,
            // timelineTasks is now derived data, not source data - don't save it
            showInfoBox
        };
    }, [selectedAssets, globalLiveDate, useGlobalDate, assetLiveDates, assetTaskDurations, taskDependencies, customTasks, customTaskNames, bankHolidays, parallelConfig, uniqueAssets, showInfoBox]);

    // Memoized nested state for auto-save
    const currentNestedState = useMemo(() => {
        return flatToNested(getCurrentFlatState());
    }, [getCurrentFlatState]);

    // Auto-save integration with proper nested state
    const {
        saveStatus,
        saveNow,
        triggerSave,
        recoverSession,
        discardRecovery,
        showRecoveryPrompt,
        recoveryPreview
    } = useAutoSave(currentNestedState, true); // Enable auto-save

    // Handle session recovery
    const handleRecover = useCallback(() => {
        const recoveredNestedState = recoverSession();
        if (recoveredNestedState) {
            // Convert nested state back to flat structure
            const recoveredFlatState = nestedToFlat(recoveredNestedState);
            
            // Restore flat state to component state
            if (recoveredFlatState.selectedAssets) setSelectedAssets(recoveredFlatState.selectedAssets);
            if (recoveredFlatState.globalLiveDate) setGlobalLiveDate(recoveredFlatState.globalLiveDate);
            if (recoveredFlatState.useGlobalDate !== undefined) setUseGlobalDate(recoveredFlatState.useGlobalDate);
            if (recoveredFlatState.assetLiveDates) setAssetLiveDates(recoveredFlatState.assetLiveDates);
            if (recoveredFlatState.assetTaskDurations) setAssetTaskDurations(recoveredFlatState.assetTaskDurations);
            if (recoveredFlatState.taskDependencies) setTaskDependencies(recoveredFlatState.taskDependencies);
            // taskBank is now derived from customTasks, so we don't need to restore it separately
            if (recoveredFlatState.customTasks) setCustomTasks(recoveredFlatState.customTasks);
            if (recoveredFlatState.customTaskNames) setCustomTaskNames(recoveredFlatState.customTaskNames);
            if (recoveredFlatState.bankHolidays) setBankHolidays(recoveredFlatState.bankHolidays);
            if (recoveredFlatState.parallelConfig) setParallelConfig(recoveredFlatState.parallelConfig);
            if (recoveredFlatState.showInfoBox !== undefined) setShowInfoBox(recoveredFlatState.showInfoBox);
            
            // Reset dirty state after recovery
            setHasUnsavedChanges(false);
            const newSnapshot = createStateSnapshot(recoveredFlatState);
            setInitialStateSnapshot(newSnapshot);
        }
    }, [recoverSession]);

    // Track state changes for dirty state detection
    useEffect(() => {
        const currentSnapshot = createStateSnapshot(getCurrentFlatState());
        
        if (initialStateSnapshot === null) {
            // Set initial snapshot on first render
            setInitialStateSnapshot(currentSnapshot);
        } else {
            // Check if state has changed from initial
            const isDirty = hasStateChanged(initialStateSnapshot, currentSnapshot);
            setHasUnsavedChanges(isDirty);
        }
    }, [getCurrentFlatState, initialStateSnapshot]);

    // Browser warning for unsaved changes (only when actually dirty)
    useBeforeUnload(hasUnsavedChanges, "You have unsaved changes. Are you sure you want to leave?");

    // Helper function to get task name (custom or default)
    const getTaskName = (taskId, assetName, taskInfo) => {
        // Check if there's a custom name for this task
        if (customTaskNames[taskId]) {
            return customTaskNames[taskId];
        }
        // Return default format
        return `${assetName}: ${taskInfo['Task']}`;
    };

    // Create a snapshot of the current app state for undo/redo
    const createStateSnapshot = (actionDescription, additionalCustomTask = null) => {
        const snapshot = {
            // Asset state
            selectedAssets: JSON.parse(JSON.stringify(selectedAssets)),
            assetLiveDates: JSON.parse(JSON.stringify(assetLiveDates)),
            useGlobalDate,
            globalLiveDate,
            
            // Task state
            customTaskNames: JSON.parse(JSON.stringify(customTaskNames)),
            assetTaskDurations: JSON.parse(JSON.stringify(assetTaskDurations)),
            customTasks: JSON.parse(JSON.stringify(customTasks)),
            
            // UI state
            showInfoBox,
            
            // Calculated state (will be recalculated after restoration)
            timelineTasks: JSON.parse(JSON.stringify(timelineTasks)),
            calculatedStartDates: JSON.parse(JSON.stringify(calculatedStartDates)),
            dateErrors: JSON.parse(JSON.stringify(dateErrors)),
            projectStartDate,
            
            // Metadata
            timestamp: Date.now(),
            actionDescription,
            actionType: 'user_action'
        };
        
        // If we're adding a custom task, include it in the snapshot
        if (additionalCustomTask) {
            snapshot.customTasks = [...snapshot.customTasks, additionalCustomTask];
        }
        
        console.log('Creating snapshot with action:', actionDescription);
        console.log('Snapshot customTasks length:', snapshot.customTasks.length);
        console.log('Snapshot customTasks:', snapshot.customTasks);
        
        return snapshot;
    };

    // Restore app state from a snapshot
    const restoreFromSnapshot = (snapshot) => {
        console.log('restoreFromSnapshot called with:', snapshot);
        
        // Validate snapshot before restoring
        if (!snapshot || typeof snapshot !== 'object') {
            console.error('Invalid snapshot provided to restoreFromSnapshot');
            return;
        }
        
        console.log('Restoring state from snapshot...');
        
        // Restore only the input state (what the user controls)
        if (snapshot.selectedAssets) {
            console.log('Restoring selectedAssets:', snapshot.selectedAssets);
            setSelectedAssets(snapshot.selectedAssets);
        }
        if (snapshot.assetLiveDates) {
            console.log('Restoring assetLiveDates:', snapshot.assetLiveDates);
            setAssetLiveDates(snapshot.assetLiveDates);
        }
        if (snapshot.useGlobalDate !== undefined) {
            console.log('Restoring useGlobalDate:', snapshot.useGlobalDate);
            setUseGlobalDate(snapshot.useGlobalDate);
        }
        if (snapshot.globalLiveDate) {
            console.log('Restoring globalLiveDate:', snapshot.globalLiveDate);
            setGlobalLiveDate(snapshot.globalLiveDate);
        }
        if (snapshot.customTaskNames) {
            console.log('Restoring customTaskNames:', snapshot.customTaskNames);
            setCustomTaskNames(snapshot.customTaskNames);
        }
        if (snapshot.assetTaskDurations) {
            console.log('Restoring assetTaskDurations:', snapshot.assetTaskDurations);
            setAssetTaskDurations(snapshot.assetTaskDurations);
        }
        if (snapshot.customTasks) {
            console.log('Restoring customTasks:', snapshot.customTasks);
            setCustomTasks(snapshot.customTasks);
        }
        if (snapshot.showInfoBox !== undefined) {
            console.log('Restoring showInfoBox:', snapshot.showInfoBox);
            setShowInfoBox(snapshot.showInfoBox);
        }
        
        console.log('State restoration complete');
        
        // Don't restore calculated state - let the useEffect recalculate it fresh
        // This prevents conflicts between old calculated state and new input state
        // setTimelineTasks(snapshot.timelineTasks);
        // setCalculatedStartDates(snapshot.calculatedStartDates);
        // setDateErrors(snapshot.dateErrors);
        // setProjectStartDate(snapshot.projectStartDate);
    };

    // Undo function
    const undo = () => {
        console.log('undo called');
        console.log('Current history length:', history.length, 'historyIndex:', historyIndex);
        console.log('History array:', history);
        
        if (historyIndex > 0 && history.length > 0) {
            console.log('Attempting undo to index:', historyIndex - 1);
            
            // Ensure historyIndex doesn't exceed history length
            const validIndex = Math.min(historyIndex - 1, history.length - 1);
            console.log('Using valid index:', validIndex);
            
            const previousSnapshot = history[validIndex];
            console.log('Previous snapshot:', previousSnapshot);
            
            if (previousSnapshot && previousSnapshot.selectedAssets) {
                console.log('Restoring from snapshot');
                setIsUndoRedoAction(true);
                restoreFromSnapshot(previousSnapshot);
                setHistoryIndex(validIndex);
                setIsUndoRedoAction(false);
            } else {
                console.error('Invalid snapshot found in history during undo');
            }
        } else {
            console.log('Cannot undo: historyIndex <= 0 or no previous snapshot');
            console.log('historyIndex:', historyIndex);
            console.log('history.length:', history.length);
        }
    };

    // Redo function
    const redo = () => {
        if (historyIndex < history.length - 1 && history[historyIndex + 1]) {
            setIsUndoRedoAction(true);
            const nextSnapshot = history[historyIndex + 1];
            if (nextSnapshot && nextSnapshot.selectedAssets) {
                restoreFromSnapshot(nextSnapshot);
                setHistoryIndex(prev => prev + 1);
            } else {
                console.error('Invalid snapshot found in history during redo');
                // Remove the invalid snapshot and try again
                setHistory(prev => prev.filter(snapshot => snapshot && snapshot.selectedAssets));
                setHistoryIndex(prev => Math.min(prev, history.length - 1));
            }
            setIsUndoRedoAction(false);
        }
    };

    // Execute an action and save it to history
    const executeAction = (action, description, additionalCustomTask = null) => {
        console.log('executeAction called with:', description);
        console.log('Current history length:', history.length, 'historyIndex:', historyIndex);
        
        // Execute the action
        action();
        
        // Create a snapshot of current state AFTER executing the action
        const currentSnapshot = createStateSnapshot(description, additionalCustomTask);
        console.log('Created snapshot:', currentSnapshot);
        
        // Add to history (but not during undo/redo operations)
        if (!isUndoRedoAction) {
            console.log('Adding to history (not undo/redo action)');
            setHistory(prev => {
                const newHistory = [...prev.slice(0, historyIndex + 1), currentSnapshot];
                console.log('New history length:', newHistory.length);
                console.log('New history array:', newHistory);
                return newHistory;
            });
            setHistoryIndex(prev => {
                const newIndex = prev + 1;
                console.log('New history index:', newIndex);
                return newIndex;
            });
        } else {
            console.log('Skipping history update (undo/redo action)');
        }
    };

    // Helper function to check if date is a non-working day (weekend or bank holiday)
    const isNonWorkingDay = (date) => {
        if (!date || isNaN(date.getTime())) {
            return true; // Treat invalid dates as non-working days
        }
        
        const day = date.getDay();
        const yyyy_mm_dd = date.toISOString().split('T')[0];
        return day === 0 || day === 6 || bankHolidays.includes(yyyy_mm_dd);
    };

    // Helper function to get previous working day
    const getPreviousWorkingDay = (date) => {
        if (!date || isNaN(date.getTime())) {
            return new Date();
        }
        
        let workingDate = new Date(date);
        let iterations = 0;
        const maxIterations = 1000; // Prevent infinite loops
        
        do {
            workingDate.setDate(workingDate.getDate() - 1);
            iterations++;
            
            // Check if date has become invalid (before 1970)
            if (workingDate.getFullYear() < 1970 || iterations >= maxIterations) {
                console.warn('getPreviousWorkingDay exceeded maximum iterations or went too far back');
                return new Date('1970-01-01');
            }
        } while (isNonWorkingDay(workingDate));
        
        return workingDate;
    };

    // Helper function to get next working day
    const getNextWorkingDay = (date) => {
        if (!date || isNaN(date.getTime())) {
            return new Date();
        }
        
        let workingDate = new Date(date);
        let iterations = 0;
        const maxIterations = 1000; // Prevent infinite loops
        
        do {
            workingDate.setDate(workingDate.getDate() + 1);
            iterations++;
            
            // Check if date has become too far in the future
            if (workingDate.getFullYear() > 2100 || iterations >= maxIterations) {
                console.warn('getNextWorkingDay exceeded maximum iterations or went too far forward');
                return new Date('2100-12-31');
            }
        } while (isNonWorkingDay(workingDate));
        
        return workingDate;
    };

    // Helper function to subtract working days (backwards calculation)
    const subtractWorkingDays = (endDate, workingDaysToSubtract) => {
        if (!endDate || isNaN(endDate.getTime()) || workingDaysToSubtract <= 0) {
            return new Date(endDate);
        }
        
        let currentDate = new Date(endDate);
        let remainingDays = workingDaysToSubtract;
        let iterations = 0;
        const maxIterations = 10000; // Prevent infinite loops
        
        // Subtract working days
        while (remainingDays > 0 && iterations < maxIterations) {
            currentDate.setDate(currentDate.getDate() - 1);
            iterations++;
            
            // Check if date has become invalid (before 1970)
            if (currentDate.getFullYear() < 1970) {
                console.warn('Date calculation went too far back, stopping at 1970-01-01');
                return new Date('1970-01-01');
            }
            
            // Only count non-non-working days
            if (!isNonWorkingDay(currentDate)) {
                remainingDays--;
            }
        }
        
        if (iterations >= maxIterations) {
            console.warn('subtractWorkingDays exceeded maximum iterations, returning original date');
            return new Date(endDate);
        }
        
        return currentDate;
    };

    // Helper function to add working days (forward calculation for display)
    const addWorkingDays = (startDate, workingDaysToAdd) => {
        if (!startDate || isNaN(startDate.getTime()) || workingDaysToAdd <= 0) {
            return new Date(startDate);
        }
        
        let currentDate = new Date(startDate);
        let remainingDays = workingDaysToAdd - 1;
        let iterations = 0;
        const maxIterations = 10000; // Prevent infinite loops
        
        while (remainingDays > 0 && iterations < maxIterations) {
            currentDate.setDate(currentDate.getDate() + 1);
            iterations++;
            
            // Check if date has become too far in the future
            if (currentDate.getFullYear() > 2100) {
                console.warn('Date calculation went too far forward, stopping at 2100-12-31');
                return new Date('2100-12-31');
            }
            
            if (!isNonWorkingDay(currentDate)) {
                remainingDays--;
            }
        }
        
        if (iterations >= maxIterations) {
            console.warn('addWorkingDays exceeded maximum iterations, returning original date');
            return new Date(startDate);
        }
        
        // Ensure the final day is a working day
        iterations = 0;
        while (isNonWorkingDay(currentDate) && iterations < 100) {
            currentDate.setDate(currentDate.getDate() + 1);
            iterations++;
        }
        
        return currentDate;
    };

    // Pure helper: build dated timeline for a single asset using factory-pattern calculator
    // This now routes to either sequential or DAG calculator based on feature flags
    const buildAssetTimeline = (rawTasks = [], liveDateStr, assetType, customDurations = {}) => {
        // Inject dependencies into tasks before calculation
        const tasksWithDependencies = rawTasks.map(task => ({
            ...task,
            dependencies: taskDependencies[task.id] || []
        }));
        
        // Use factory-pattern calculator that handles both sequential and DAG calculations
        return buildAssetTimelineCalculator(tasksWithDependencies, liveDateStr, customDurations, bankHolidays);
    };

    // Load CSV data
    useEffect(() => {
        Papa.parse(`${window.location.origin}/Group_Asset_Task_Time.csv`, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedData = results.data;
                setCsvData(parsedData);
                
                // Extract unique asset types from CSV
                const assetTypes = [...new Set(parsedData.map(row => row['Asset Type']))].filter(type => type);
                setUniqueAssets(assetTypes);
            },
            error: (error) => {
                console.error("Error parsing CSV file:", error);
            }
        });
    }, []);

    // Helper function to safely convert date to ISO string
    const safeToISOString = (date) => {
        if (!date || isNaN(date.getTime())) {
            console.warn('Invalid date detected:', date);
            return new Date().toISOString().split('T')[0]; // Return today's date as fallback
        }
        return date.toISOString().split('T')[0];
    };

    // Memoized taskBank calculation - derived from source states
    const taskBank = useMemo(() => {
        console.log('🔨 Recalculating taskBank from source data...');
        
        // Early returns for empty states
        if (selectedAssets.length === 0 || csvData.length === 0) {
            console.log('   ⏸️ No assets or CSV data - returning empty taskBank');
            return {};
        }
        
        // Build base taskBank from CSV data
        const bank = {};
        selectedAssets.forEach(asset => {
            const rows = csvData.filter(row => row['Asset Type'] === asset.type);
            bank[asset.id] = rows.map((row, idx) => ({
                id: `${asset.id}-template-${idx}`,
                name: row['Task'],
                duration: parseInt(row['Duration (Days)'], 10) || 1,
                owner: row['owner'] || 'm',
                assetType: asset.name,
                isCustom: false,
            }));
        });
        
        // Insert custom tasks at their specified positions
        customTasks.forEach(customTask => {
            const asset = selectedAssets.find(a => a.name === customTask.assetType);
            if (asset && bank[asset.id]) {
                console.log(`📝 Inserting custom task "${customTask.name}" into asset "${asset.name}"`);
                
                // Find insertion point using task name (stable) or ID (fallback)
                let insertIndex = 0;
                let positionFound = false;
                
                // First try: Use task name (stable across import/export)
                if (customTask.insertAfterTaskName) {
                    const idx = bank[asset.id].findIndex(t => t.name === customTask.insertAfterTaskName);
                    if (idx !== -1) {
                        insertIndex = idx + 1;
                        positionFound = true;
                        console.log(`   ✅ Found position by task name "${customTask.insertAfterTaskName}" at index ${insertIndex}`);
                    }
                }
                
                // Fallback: Try using task ID (may not work after import due to ID changes)
                if (!positionFound && customTask.insertAfterTaskId) {
                    const idx = bank[asset.id].findIndex(t => t.id === customTask.insertAfterTaskId);
                    if (idx !== -1) {
                        insertIndex = idx + 1;
                        positionFound = true;
                        console.log(`   ⚠️ Found position by task ID "${customTask.insertAfterTaskId}" at index ${insertIndex}`);
                    }
                }
                
                if (!positionFound) {
                    console.log(`   ❌ Could not find insertion point for custom task, defaulting to beginning (index ${insertIndex})`);
                    console.log(`      - insertAfterTaskName: "${customTask.insertAfterTaskName || 'none'}"`);
                    console.log(`      - insertAfterTaskId: "${customTask.insertAfterTaskId || 'none'}"`);
                    console.log(`      - Available task names:`, bank[asset.id].map(t => t.name));
                }
                
                // Insert the custom task
                bank[asset.id].splice(insertIndex, 0, customTask);
            } else {
                console.warn(`Cannot insert custom task "${customTask.name}": asset "${customTask.assetType}" not found or has no task bank`);
            }
        });
        
        console.log('✅ taskBank calculated:', bank);
        return bank;
    }, [selectedAssets, csvData, customTasks]);

    // Build timelineTasks from taskBank + live dates
    const timelineTasks = useMemo(() => {
        console.log('📅 Recalculating timelineTasks from taskBank...');
        
        if (Object.keys(taskBank).length === 0) {
            return [];
        }
        
        const all = [];
        selectedAssets.forEach(asset => {
            // Get the correct live date for this asset
            let liveDateStr;
            if (useGlobalDate && globalLiveDate) {
                // When using global date, always use globalLiveDate regardless of asset.startDate
                liveDateStr = globalLiveDate;
            } else {
                // For individual dates, use the asset's startDate property
                liveDateStr = asset.startDate;
            }
            
            const raw = taskBank[asset.id] || [];
            
            if (!liveDateStr) {
                console.warn(`No live date found for asset ${asset.name} (useGlobalDate: ${useGlobalDate}, globalLiveDate: ${globalLiveDate}, asset.startDate: ${asset.startDate}), skipping`);
                return;
            }
            
            const timelineTasks = buildAssetTimeline(raw, liveDateStr, asset.type, assetTaskDurations[asset.type] || {});
            all.push(...timelineTasks);
        });
        
        console.log('✅ timelineTasks calculated:', all.length, 'tasks');
        return all;
    }, [taskBank, selectedAssets, globalLiveDate, useGlobalDate, assetTaskDurations, taskDependencies]);


    // Calculate project start dates and error detection from timelineTasks
    useEffect(() => {
        if (timelineTasks.length === 0 || selectedAssets.length === 0) {
            setCalculatedStartDates({});
            setDateErrors([]);
            setProjectStartDate('');
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const newCalculatedStartDates = {};
        const newDateErrors = [];
        const allStartDates = [];

        // Calculate start dates for each asset
        selectedAssets.forEach(asset => {
            const assetTasks = timelineTasks.filter(task => 
                task.assetType === asset.name || task.id.startsWith(`${asset.id}-`)
            );
            
            if (assetTasks.length > 0) {
                // Find the earliest task for this asset
                const earliestTask = assetTasks.reduce((earliest, task) => {
                    return new Date(task.start) < new Date(earliest.start) ? task : earliest;
                });
                
                // Store calculated start date
                newCalculatedStartDates[asset.id] = earliestTask.start;
                allStartDates.push(new Date(earliestTask.start));
                
                // Check if start date is before today
                if (new Date(earliestTask.start) < today) {
                    newDateErrors.push(asset.id);
                }
            }
        });

        // Set the earliest project start date
        if (allStartDates.length > 0) {
            const earliestDate = new Date(Math.min(...allStartDates));
            setProjectStartDate(earliestDate.toISOString().split('T')[0]);
        }

        setCalculatedStartDates(newCalculatedStartDates);
        setDateErrors(newDateErrors);
    }, [timelineTasks, selectedAssets]);

    // Fetch UK bank holidays for England and Wales on app load
    useEffect(() => {
        fetch('https://www.gov.uk/bank-holidays.json')
            .then(response => response.json())
            .then(data => {
                // Get all dates for England and Wales
                const events = data['england-and-wales'].events;
                // Get all dates for the next 10 years
                const now = new Date();
                const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
                const holidayDates = events
                    .map(event => event.date)
                    .filter(dateStr => {
                        const date = new Date(dateStr);
                        return date >= now && date <= tenYearsFromNow;
                    });
                setBankHolidays(holidayDates);
            })
            .catch(err => {
                // If fetch fails, fallback to an empty array (or you could use a static list)
                setBankHolidays([]);
            });
    }, []);

    // LEGACY CODE - DISABLED - using new taskBank system instead
    // Calculate backwards timeline when live dates or assets change
    /*useEffect(() => {
        if (selectedAssets.length === 0 || csvData.length === 0) {
            setTimelineTasks([]);
            setCalculatedStartDates({});
            setProjectStartDate('');
            setDateErrors([]);
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
        
        const newCalculatedStartDates = {};
        const newDateErrors = [];
        const allStartDates = [];
        const allTasks = [];

        // Loop over each selected asset instance (not just type)
        selectedAssets.forEach(asset => {
            // asset: { id, type, name, startDate }
            
            // Get ALL tasks for this asset type from the CSV (no filtering)
            const assetTasks = csvData.filter(row => row['Asset Type'] === asset.type);
            if (assetTasks.length === 0) return;

            // Use the global live date if useGlobalDate is true, otherwise use the asset's individual startDate
            // Respect user's choice even if it's a non-working day
            const liveDate = useGlobalDate 
                ? new Date(globalLiveDate) 
                : new Date(asset.startDate);
            if (isNaN(liveDate.getTime())) return; // Skip if no valid date available

            // Identify the final task (last task in the CSV for this asset type)
            const finalTask = assetTasks[assetTasks.length - 1];
            
            // We'll build the tasks in reverse (from final task backwards)
            let currentEndDate = new Date(liveDate);
            const ganttTasks = [];
            let taskIndex = 0;

            // Process all tasks in reverse order, starting with the final task
            for (let i = assetTasks.length - 1; i >= 0; i--) {
                const taskInfo = assetTasks[i];
                const isFinalTask = (i === assetTasks.length - 1);
                
                // Use custom duration if present, else default from CSV
                const customDurations = assetTaskDurations[asset.type] || {};
                const duration = customDurations[taskInfo['Task']] !== undefined
                    ? customDurations[taskInfo['Task']]
                    : parseInt(taskInfo['Duration (Days)'], 10) || 1;
                
                let taskStartDate, taskEndDate;
                
                if (isFinalTask) {
                    // Final task goes exactly on the live date
                    taskStartDate = new Date(liveDate);
                    taskEndDate = new Date(liveDate);
                } else {
                    // Other tasks work backwards from the current end date
                    taskStartDate = subtractWorkingDays(currentEndDate, duration);
                    taskEndDate = new Date(currentEndDate);
                taskEndDate.setDate(taskEndDate.getDate() - 1);
                    
                    // Ensure end date is a working day (for non-final tasks)
                    if (isNonWorkingDay(taskEndDate)) {
                        taskEndDate = getPreviousWorkingDay(taskEndDate);
                    }
                }
                
                // Validate dates before creating task
                if (!isNaN(taskStartDate.getTime()) && !isNaN(taskEndDate.getTime())) {
                const taskId = `${asset.id}-task-${taskIndex}`;
                ganttTasks.unshift({
                    id: taskId,
                    name: getTaskName(taskId, asset.name, taskInfo),
                        start: safeToISOString(taskStartDate),
                        end: safeToISOString(taskEndDate),
                    progress: 0,
                    owner: taskInfo['owner'] || 'm', // Get owner from CSV, default to MMM
                        assetType: asset.name, // NEW - add explicit asset type for all tasks
                });
                taskIndex++;
                    
                    // Update currentEndDate for the next task (working backwards)
                currentEndDate = new Date(taskStartDate);
                } else {
                    console.warn(`Invalid date calculated for task ${taskInfo['Task']}:`, { taskStartDate, taskEndDate });
                }
            }

            // Add all tasks for this asset instance to the main list
            allTasks.push(...ganttTasks);

            // Set the calculated start date for this asset to the start date of the first (earliest) task
            if (ganttTasks.length > 0 && ganttTasks[0].start) {
                newCalculatedStartDates[asset.id] = ganttTasks[0].start;
                allStartDates.push(new Date(ganttTasks[0].start));
            }

            // Check if start date is before today
            if (ganttTasks.length > 0 && new Date(ganttTasks[0].start) < today) {
                newDateErrors.push(asset.id);
            }
        });

        // Find earliest start date across all assets
        if (allStartDates.length > 0) {
            const earliestDate = new Date(Math.min(...allStartDates));
            setProjectStartDate(earliestDate.toISOString().split('T')[0]);
        }

        // Always process custom tasks (if any exist)
        const tasksToProcess = [...allTasks];
        let finalTimeline = allTasks;
        
        setTimelineTasks(allTasks);
    }, [selectedAssets, globalLiveDate, useGlobalDate, assetLiveDates, csvData, assetTaskDurations, customTaskNames]);*/

    // REMOVED: Separate useEffect to handle custom tasks - was overriding correct timeline
    // Custom tasks now integrated into taskBank system
    /*useEffect(() => {
        if (customTasks.length > 0) {
            console.log('Processing custom tasks in separate useEffect:', customTasks);
            
            // Use a functional update to get the current timeline tasks
            setTimelineTasks(currentTimelineTasks => {
                // Build per-asset task arrays from existing timeline tasks
                const tasksByAsset = {};
                selectedAssets.forEach(asset => {
                    const assetTasks = currentTimelineTasks.filter(task => 
                        task.assetType === asset.name || task.id.startsWith(`${asset.id}-`)
                    );
                    if (assetTasks.length > 0) {
                        tasksByAsset[asset.id] = [...assetTasks];
                    }
                });

                // Insert custom tasks into the correct asset's array
            customTasks.forEach(customTask => {
                    const asset = selectedAssets.find(a => a.name === customTask.assetType);
                    if (!asset || !asset.startDate) {
                        console.warn(`Cannot find asset or asset has no start date for custom task:`, customTask);
                        return;
                    }
                    
                    const assetId = asset.id;
                    if (!tasksByAsset[assetId]) tasksByAsset[assetId] = [];
                    
                    // Validate custom task data
                    if (!customTask.duration || customTask.duration < 1) {
                        console.warn(`Invalid duration for custom task:`, customTask);
                        return;
                    }
                    
                    // Check if custom task already exists
                    const existingTask = tasksByAsset[assetId].find(t => t.id === customTask.id);
                    if (existingTask) {
                        console.log('Custom task already exists:', customTask.id);
                        return;
                    }
                    
                    // Insert at the beginning or after a specific task
                    let insertIndex = 0;
                    if (customTask.insertAfterTaskId) {
                        const idx = tasksByAsset[assetId].findIndex(t => t.id === customTask.insertAfterTaskId);
                        if (idx !== -1) insertIndex = idx + 1;
                    }
                    
                    // Create the custom task with proper structure
                    const customTaskWithStructure = {
                    ...customTask,
                        id: customTask.id || `custom-task-${Date.now()}`,
                        name: customTask.name, // Clean name without "Custom:" prefix
                        duration: customTask.duration || 1,
                        owner: customTask.owner || 'm',
                        assetType: customTask.assetType,
                        isCustom: true,
                        progress: 0,
                        // These will be calculated in the recalculation step
                        start: null,
                        end: null
                    };
                    
                    tasksByAsset[assetId].splice(insertIndex, 0, customTaskWithStructure);
                });

                // Recalculate dates for each asset's tasks
                Object.keys(tasksByAsset).forEach(assetId => {
                    const asset = selectedAssets.find(a => a.id === assetId);
                    if (!asset || !asset.startDate) return;
                    
                    const assetTasks = tasksByAsset[assetId];
                if (assetTasks.length === 0) return;
                
                    // Validate the current end date
                    let currentEndDate = new Date(useGlobalDate ? globalLiveDate : asset.startDate);
                    if (isNaN(currentEndDate.getTime())) {
                        console.warn(`Invalid start date for asset ${assetId}:`, asset.startDate);
                        return;
                    }
                    
                    for (let i = assetTasks.length - 1; i >= 0; i--) {
                        const task = assetTasks[i];
                        const duration = task.duration || 1;
                        let taskStartDate, taskEndDate;
                        
                        if (i === assetTasks.length - 1) {
                            // Final task goes exactly on the live date
                            taskStartDate = new Date(currentEndDate);
                            taskEndDate = new Date(currentEndDate);
                    } else {
                            // Other tasks work backwards from the current end date
                            taskStartDate = subtractWorkingDays(currentEndDate, duration);
                            taskEndDate = new Date(currentEndDate);
                        taskEndDate.setDate(taskEndDate.getDate() - 1);
                            if (isNonWorkingDay(taskEndDate)) {
                                taskEndDate = getPreviousWorkingDay(taskEndDate);
                            }
                        }
                        
                        // Validate dates before updating
                        if (!isNaN(taskStartDate.getTime()) && !isNaN(taskEndDate.getTime())) {
                            assetTasks[i] = {
                            ...task,
                                start: safeToISOString(taskStartDate),
                                end: safeToISOString(taskEndDate),
                            };
                        currentEndDate = new Date(taskStartDate);
                        } else {
                            console.warn(`Invalid date calculated for task ${task.id}:`, { taskStartDate, taskEndDate });
                            // Set fallback dates to prevent crashes
                            assetTasks[i] = {
                                ...task,
                                start: safeToISOString(new Date()),
                                end: safeToISOString(new Date()),
                            };
                        }
                    }
                });

                // Merge all assets' tasks for display/export
                const finalTimeline = Object.values(tasksByAsset).flat();
                
                // Update calculated start dates and date errors for custom tasks
            const finalDateErrors = [];
                const todayForErrors = new Date();
                todayForErrors.setHours(0, 0, 0, 0);
            
            selectedAssets.forEach(asset => {
                // Get all tasks for this asset (including custom tasks)
                const assetTasks = finalTimeline.filter(task => {
                    // Regular asset tasks
                    if (task.id.startsWith(`${asset.id}-`) && !task.name.includes('Go-Live')) {
                        return true;
                    }
                    // Custom tasks that belong to this asset
                        if (task.isCustom && task.assetType === asset.name) {
                            return true;
                    }
                    return false;
                });
                
                if (assetTasks.length > 0) {
                    // Find the earliest task for this asset
                    const earliestTask = assetTasks.reduce((earliest, task) => {
                        return new Date(task.start) < new Date(earliest.start) ? task : earliest;
                    });
                    
                    // Update calculated start date
                        setCalculatedStartDates(prev => ({
                            ...prev,
                            [asset.id]: earliestTask.start
                        }));
                    
                    // Check if start date is before today
                        if (new Date(earliestTask.start) < todayForErrors) {
                        finalDateErrors.push(asset.id);
                    }
                }
            });
            
            setDateErrors(finalDateErrors);
            
            // Update the global project start date to reflect the new earliest start date
                const allFinalStartDates = Object.values(finalTimeline).map(task => new Date(task.start));
            if (allFinalStartDates.length > 0) {
                const earliestDate = new Date(Math.min(...allFinalStartDates));
                setProjectStartDate(earliestDate.toISOString().split('T')[0]);
            }
                
                return finalTimeline;
            });
        }
    }, [customTasks, selectedAssets, globalLiveDate, useGlobalDate]);*/

    // Keyboard shortcuts for undo/redo
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                redo();
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [historyIndex, history.length]);
// This new useEffect pre-populates individual dates when switching from global mode
    useEffect(() => {
        if (!useGlobalDate && globalLiveDate && selectedAssets.length > 0) {
            const newLiveDates = { ...assetLiveDates };
            let updated = false;
            selectedAssets.forEach(asset => {
                // Pre-fill only if the asset doesn't have an individual date set
                if (!newLiveDates[asset.name]) { // Changed to asset.name
                    newLiveDates[asset.name] = globalLiveDate; // Changed to asset.name
                    updated = true;
                }
            });
            if (updated) {
                setAssetLiveDates(newLiveDates);
            }
        }
    }, [useGlobalDate, globalLiveDate, selectedAssets, assetLiveDates]);

    // Sync all asset instance startDates to globalLiveDate if useGlobalDate is true
useEffect(() => {
    if (useGlobalDate && globalLiveDate && !isUndoRedoAction) {
        setSelectedAssets(prev =>
            prev.map(asset =>
                asset.startDate !== globalLiveDate
                    ? { ...asset, startDate: globalLiveDate }
                    : asset
            )
        );
    }
    // Optionally, if unchecked, you could clear the dates or leave as-is
}, [useGlobalDate, globalLiveDate, isUndoRedoAction]);

    // (Legacy generateTimelineTasks effect removed – taskBank pipeline is now the source of timelineTasks)

    // Keep historyIndex in sync with history length
    useEffect(() => {
        if (historyIndex >= history.length && history.length > 0) {
            console.log('Fixing out-of-sync historyIndex:', historyIndex, '->', history.length - 1);
            setHistoryIndex(history.length - 1);
        }
    }, [history, historyIndex]);

    // REMOVED: Separate custom task merging useEffect
    // Custom tasks are now integrated directly into the main timeline calculation

    // REMOVED: Custom task merging useEffect that was causing timeline disruption
    // Custom tasks are now handled properly in the main timeline calculation
    // Sunday-only validation for supplement assets
    useEffect(() => {
        if (!useGlobalDate || !globalLiveDate) {
            setSundayDateErrors([]);
            return;
        }

        const globalDate = new Date(globalLiveDate);
        const isSunday = globalDate.getDay() === 0;
        
        if (isSunday) {
            setSundayDateErrors([]);
            return;
        }

        // Find all selected assets that require Sunday-only dates
        const violatingAssets = selectedAssets.filter(asset => 
            isSundayOnlyAsset(asset.type)
        );
        
        setSundayDateErrors(violatingAssets.map(asset => asset.id));
    }, [globalLiveDate, selectedAssets, useGlobalDate]);


    // Generate timeline tasks for Gantt chart
    const generateTimelineTasks = (startDates) => {
        if (selectedAssets.length === 0 || Object.keys(startDates).length === 0) {
            // Legacy function - timelineTasks are now derived
            return;
        }

        const newCalculatedStartDates = { ...startDates };
        const allTasks = [];
        let taskIndex = 0;

        selectedAssets.forEach(asset => {
            const assetName = asset.name; // Assuming asset object has a 'name' property
            // Get ALL tasks for this asset type from the CSV (no filtering)
            const assetTasks = csvData.filter(row => row['Asset Type'] === assetName);
            if (assetTasks.length === 0) return;

            // Get the correct live date for this asset - respect user's choice even if it's a non-working day
            const liveDate = new Date(useGlobalDate ? globalLiveDate : assetLiveDates[assetName]);
            if (isNaN(liveDate.getTime())) return;

            // Identify the final task (last task in the CSV for this asset type)
            const finalTask = assetTasks[assetTasks.length - 1];
            
            // We'll build the tasks in reverse (from final task backwards)
            let currentEndDate = new Date(liveDate);
            const ganttTasks = [];
            let taskIndex = 0;

            // Process all tasks in reverse order, starting with the final task
            for (let i = assetTasks.length - 1; i >= 0; i--) {
                const taskInfo = assetTasks[i];
                const isFinalTask = (i === assetTasks.length - 1);
                
                const duration = parseInt(taskInfo['Duration (Days)'], 10) || 1;
                
                let taskStartDate, taskEndDate;
                
                if (isFinalTask) {
                    // Final task goes exactly on the live date
                    taskStartDate = new Date(liveDate);
                    taskEndDate = new Date(liveDate);
                } else {
                    // Other tasks work backwards from the current end date
                    taskStartDate = subtractWorkingDays(currentEndDate, duration);
                    taskEndDate = new Date(currentEndDate);
                taskEndDate.setDate(taskEndDate.getDate() - 1);
                    
                    // Ensure end date is a working day (for non-final tasks)
                    if (isNonWorkingDay(taskEndDate)) {
                        taskEndDate = getPreviousWorkingDay(taskEndDate);
                    }
                }
                
                ganttTasks.unshift({
                    id: `task-${taskIndex}`,
                    name: `${taskInfo['Asset Type']}: ${taskInfo['Task']}`,
                    assetType: taskInfo['Asset Type'], // NEW - explicit asset type
                    start: taskStartDate.toISOString().split('T')[0],
                    end: taskEndDate.toISOString().split('T')[0],
                    progress: 0,
                });
                taskIndex++;
                
                // Update currentEndDate for the next task (working backwards)
                currentEndDate = new Date(taskStartDate);
            }

            // Add all tasks for this asset to the main list
            allTasks.push(...ganttTasks);

            // Set the calculated start date for this asset to the start date of the first (earliest) task
            if (ganttTasks.length > 0 && ganttTasks[0].start) {
                newCalculatedStartDates[assetName] = ganttTasks[0].start;
            }
        });
        
        // Merge custom tasks back into the timeline
        if (customTasks.length > 0) {
            // Insert custom tasks at their specified positions
            customTasks.forEach(customTask => {
                let insertIndex = 0;
                
                if (customTask.insertAfterTaskId && customTask.insertAfterTaskId !== '') {
                    // If a specific task is specified, insert after it
                    const afterTaskIndex = allTasks.findIndex(task => task.id === customTask.insertAfterTaskId);
                    if (afterTaskIndex !== -1) {
                        insertIndex = afterTaskIndex + 1;
                    }
                } else if (customTask.assetType) {
                    // User chose "At the beginning of [Asset]" - find consecutive groups of this asset type
                    console.log('=== CUSTOM TASK DEBUG ===');
                    console.log('Custom task:', customTask);
                    console.log('Looking for asset type:', customTask.assetType);
                    
                    // Find all consecutive groups of this asset type
                    const groups = [];
                    let currentGroup = null;
                    
                    for (let i = 0; i < allTasks.length; i++) {
                        const task = allTasks[i];
                        let taskAssetType;
                        
                        // Get the asset type for this task
                        if (task.assetType) {
                            taskAssetType = task.assetType;
                        } else {
                            // Extract from task name (e.g., "Digital Display - Creative: Task Name" -> "Digital Display - Creative")
                            const nameParts = task.name.split(': ');
                            taskAssetType = nameParts.length > 1 ? nameParts[0] : 'Unknown';
                        }
                        
                        console.log(`Task ${i}: "${task.name}" -> assetType: "${taskAssetType}"`);
                        
                        if (taskAssetType === customTask.assetType) {
                            if (!currentGroup) {
                                // Start a new group
                                currentGroup = { startIndex: i, endIndex: i, assetId: task.id.split('-')[0] };
                            } else {
                                // Continue the current group
                                currentGroup.endIndex = i;
                            }
                        } else if (currentGroup) {
                            // End the current group and save it
                            groups.push(currentGroup);
                            currentGroup = null;
                        }
                    }
                    
                    // Don't forget to add the last group if it exists
                    if (currentGroup) {
                        groups.push(currentGroup);
                    }
                    
                    console.log(`Found ${groups.length} group(s) of asset type "${customTask.assetType}"`);
                    groups.forEach((group, idx) => {
                        console.log(`  Group ${idx}: indices ${group.startIndex}-${group.endIndex}, assetId: ${group.assetId}`);
                    });
                    
                    if (groups.length > 0) {
                        // Use the last (most recent) group as it's likely what the user is working with
                        // This matches the behavior when custom tasks are inserted in the middle/end
                        const targetGroup = groups[groups.length - 1];
                        insertIndex = targetGroup.startIndex;
                        console.log(`*** SETTING INSERT INDEX TO ${insertIndex} (beginning of last group) ***`);
                    } else {
                        console.log(`*** NO TASKS FOUND FOR ASSET TYPE "${customTask.assetType}" ***`);
                        // If no tasks found, insert at the beginning
                        insertIndex = 0;
                    }
                    console.log('=== END DEBUG ===');
                }
                
                // Create a new custom task with updated dates
                const newCustomTask = {
                    ...customTask,
                    id: customTask.id, // Keep the same ID
                    name: customTask.name,
                    duration: customTask.duration,
                    isCustom: true
                };
                
                // Insert the custom task
                allTasks.splice(insertIndex, 0, newCustomTask);
            });
            
            // Recalculate all task dates to accommodate custom tasks
            // This is a simplified version - in practice, you'd want to recalculate dates
            // based on the new timeline structure
        }
        
        // Legacy function - these setters no longer exist
    };

    // Helper to generate a unique id (could use a counter or Date.now())
    const generateAssetId = () => Date.now() + Math.random();

    // Add a new asset instance
    const handleAddAsset = (assetType) => {
        executeAction(() => {
            const newAsset = {
                id: generateAssetId(),
                type: assetType,
                name: assetType, // default name, can be edited later
                startDate: useGlobalDate && globalLiveDate ? globalLiveDate : ''
            };
            setSelectedAssets(prev => [...prev, newAsset]);
        }, `Add ${assetType} asset`);
        saveNow(`Added ${assetType} asset`);
    };

    // Remove an asset instance by id
    const handleRemoveAsset = (assetId) => {
        const assetToRemove = selectedAssets.find(asset => asset.id === assetId);
        executeAction(() => {
            setSelectedAssets(prev => prev.filter(asset => asset.id !== assetId));
        }, `Remove ${assetToRemove?.name || 'asset'}`);
        saveNow(`Removed ${assetToRemove?.name || 'asset'}`);
    };

    // Handler to rename an asset instance by id
    const handleRenameAsset = (assetId, newName) => {
        const assetToRename = selectedAssets.find(asset => asset.id === assetId);
        executeAction(() => {
            setSelectedAssets(prev =>
                prev.map(asset =>
                    asset.id === assetId ? { ...asset, name: newName } : asset
                )
            );
        }, `Rename asset to "${newName}"`);
        triggerSave(`Renamed asset to "${newName}"`);
    };

    // Handler to rename a task
    const handleRenameTask = (taskId, newName) => {
        const currentTask = timelineTasks.find(task => task.id === taskId);
        if (!currentTask) return;
        
        // Preserve the assetType if it exists, otherwise try to infer it
        let preservedAssetType = currentTask.assetType;
        
        // If no assetType exists, try to infer it from the current name or position
        if (!preservedAssetType) {
            // Try to extract from current name format (Asset Type: Task Name)
            const nameParts = currentTask.name.split(': ');
            if (nameParts.length > 1) {
                preservedAssetType = nameParts[0];
            } else {
                // If we can't extract from name, we'll let the Excel export logic handle it
                // by looking at nearby tasks
                preservedAssetType = null;
            }
        }
        
        executeAction(() => {
            setCustomTaskNames(prev => ({
                ...prev,
                [taskId]: newName
            }));
            
            // assetType is now derived automatically from the timeline calculation
        }, `Rename task to "${newName}"`);
        triggerSave(`Renamed task to "${newName}"`);
    };

    const handleAssetLiveDateChange = (assetName, date) => {
        executeAction(() => {
            setAssetLiveDates(prev => ({
                ...prev,
                [assetName]: date
            }));
        }, `Change ${assetName} go-live date to ${date}`);
        saveNow(`Changed ${assetName} live date to ${date}`);
    };

    const handleAssetStartDateChange = (assetId, newDate) => {
        const assetToUpdate = selectedAssets.find(asset => asset.id === assetId);
        executeAction(() => {
            setSelectedAssets(prev =>
                prev.map(asset =>
                    asset.id === assetId ? { ...asset, startDate: newDate } : asset
                )
            );
        }, `Change ${assetToUpdate?.name || 'asset'} go-live date to ${newDate}`);
        saveNow(`Changed ${assetToUpdate?.name || 'asset'} start date to ${newDate}`);
    };

    // Handler to save custom task durations for an asset
    const handleSaveTaskDurations = (assetId, durations) => {
        const assetToUpdate = selectedAssets.find(asset => asset.id === assetId);
        if (!assetToUpdate) return;
        
        executeAction(() => {
            // Use asset.type as the key to match how duration changes are stored
            setAssetTaskDurations(prev => ({ 
                ...prev, 
                [assetToUpdate.type]: durations 
            }));
            
            // REMOVED: The line that was overwriting customTasks
            // Custom tasks are already properly maintained in the customTasks array
        }, `Update task durations for ${assetToUpdate?.name || 'asset'}`);
        saveNow(`Changed task durations for ${assetToUpdate?.name || 'asset'}`);
    };

    // Handler for drag-to-resize task duration
    const handleTaskDurationChange = (taskId, newDuration, newEndDate) => {
        // Find the task being modified
        const taskIndex = timelineTasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return;

        const task = timelineTasks[taskIndex];
        
        // For tasks from taskBank, use the task's original name property
        const taskName = task.name; // Use the direct name from task bank
        
        // Find the asset this task belongs to
        const asset = selectedAssets.find(a => a.name === task.assetType);
        if (!asset) {
            console.warn('No asset found for task:', task);
            return;
        }
        
        executeAction(() => {
            // Update the assetTaskDurations state to trigger recalculation
            setAssetTaskDurations(prev => {
                const currentDurations = prev[asset.type] || {};
                return {
                    ...prev,
                    [asset.type]: {
                        ...currentDurations,
                        [taskName]: newDuration
                    }
                };
            });
        }, `Change ${taskName} duration to ${newDuration} days`);
        
        // Trigger debounced save for continuous action
        triggerSave(`Adjusted ${taskName} duration to ${newDuration} days`);
    };

    // Handler for drag-to-move task start date
    const handleTaskMove = (taskId, newStartDate, assetType, taskName) => {
        console.log(`[DEBUG] handleTaskMove called: ${taskId}, ${newStartDate}, ${assetType}, ${taskName}`);
        
        // Find the task being moved and its current position
        const taskIndex = timelineTasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) {
            console.warn('Task not found for move:', taskId);
            return;
        }
        
        const currentTask = timelineTasks[taskIndex];
        const currentStartDate = new Date(currentTask.start);
        const targetStartDate = new Date(newStartDate);
        
        // Calculate days difference (positive = moving forward, negative = moving backward)
        const daysDifference = Math.round((targetStartDate - currentStartDate) / (24 * 60 * 60 * 1000));
        
        console.log(`[DEBUG] Moving ${taskName}: ${daysDifference} days from ${currentStartDate.toDateString()} to ${targetStartDate.toDateString()}`);
        
        if (daysDifference === 0) {
            console.log(`[DEBUG] No movement needed for ${taskName}`);
            return;
        }
        
        // Find the predecessor task (the task that comes immediately before in the timeline)
        // Look for tasks in the same asset that end before the current task starts
        const assetTasks = timelineTasks
            .filter(task => task.assetType === assetType)
            .sort((a, b) => new Date(a.start) - new Date(b.start));
        
        const currentTaskAssetIndex = assetTasks.findIndex(task => task.id === taskId);
        
        if (currentTaskAssetIndex > 0) {
            const predecessorTask = assetTasks[currentTaskAssetIndex - 1];
            
            // Calculate the overlap: negative = overlap, positive = gap
            // If moving forward (daysDifference > 0), we create overlap
            // If moving backward (daysDifference < 0), we create gap
            const overlapDays = Math.abs(daysDifference);
            
            console.log(`[DEBUG] Creating dependency: ${predecessorTask.id} -> ${taskId} with ${overlapDays} overlap days`);
            
            executeAction(() => {
                // Add or update the dependency
                setTaskDependencies(prev => {
                    const existingDeps = prev[taskId] || [];
                    
                    // Remove any existing dependency from this predecessor
                    const filteredDeps = existingDeps.filter(dep => dep.predecessorId !== predecessorTask.id);
                    
                    // Add the new dependency with calculated overlap
                    const newDependency = {
                        predecessorId: predecessorTask.id,
                        type: 'FS', // Finish-to-Start
                        lag: -overlapDays // Negative lag creates overlap
                    };
                    
                    return {
                        ...prev,
                        [taskId]: [...filteredDeps, newDependency]
                    };
                });
            }, `Move ${taskName} to create ${overlapDays}-day ${daysDifference > 0 ? 'overlap' : 'gap'} with ${predecessorTask.name}`);
            
        } else {
            console.log(`[DEBUG] Cannot move ${taskName} - no predecessor task found`);
        }
    };

    // Handler for adding custom tasks
    const handleAddCustomTask = ({ name, duration, owner, assetType, insertAfterTaskId }) => {
        const asset = selectedAssets.find(a => a.name === assetType);
        if (!asset) {
            console.warn('Asset not found for custom task', assetType);
            return;
        }
        const rawTask = {
            id: `custom-task-${Date.now()}`,
            name: name, // Clean name without "Custom:" prefix
            duration: duration || 1,
            owner: owner || 'm',
            assetType,
            isCustom: true,
            insertAfterTaskId: insertAfterTaskId || null,
        };
        
        // FIRST: Update customTasks array for persistence (before executeAction)
        // Use flushSync to ensure state update happens immediately
        flushSync(() => {
            setCustomTasks(prev => {
                // Find the name of the task we're inserting after for stable positioning
                let insertAfterTaskName = null;
                if (insertAfterTaskId) {
                    // Look through all tasks to find the name of the task we're inserting after
                    const allTasks = Object.values(taskBank).flat();
                    const insertAfterTask = allTasks.find(t => t.id === insertAfterTaskId);
                    if (insertAfterTask) {
                        insertAfterTaskName = insertAfterTask.name;
                    }
                }
                
                const customTaskForArray = {
                    ...rawTask,
                    insertAfterTaskName, // Store task name for stable positioning
                    insertAfterTaskId    // Keep ID as fallback
                };
                
                return [...prev, customTaskForArray];
            });
        });

        // The useEffect will automatically rebuild taskBank with the custom task
        // No need to update taskBank directly since it gets rebuilt from customTasks
        
        // Trigger immediate save for important action
        saveNow(`Add custom task "${name}"`);
    };

        // Helper function to count working days between two dates (exclusive)
    const countWorkingDays = (startDate, endDate) => {
        let count = 0;
        const current = new Date(startDate);
        const end = new Date(endDate);

        // Move to next day to make it exclusive
        current.setDate(current.getDate() + 1);

        while (current <= end) {
            if (!isNonWorkingDay(current)) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        return count;
    };

    // Single source of truth for working days calculation (same as AssetSelector)
    const calculateWorkingDaysBetween = (startDate, endDate) => {
        if (!startDate || !endDate) return 0;
       
        const start = new Date(startDate);
        const end = new Date(endDate);
       
        if (start >= end) return 0;
       
        let workingDays = 0;
        let currentDate = new Date(start);
       
        while (currentDate < end) {
            const dayOfWeek = currentDate.getDay();
            // Count if not weekend (0 = Sunday, 6 = Saturday)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                workingDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
       
        return workingDays;
    };

    // Helper function to calculate task end date based on start date and duration
    const calculateTaskEndDate = (startDate, duration) => {
        let endDate = new Date(startDate);
        let remainingDays = duration - 1; // -1 because we count the start date
        
        while (remainingDays > 0) {
            endDate.setDate(endDate.getDate() + 1);
            if (!isNonWorkingDay(endDate)) {
                remainingDays--;
            }
        }
        
        return endDate.toISOString().split('T')[0];
    };

    // Calculate working days needed per asset for detailed timeline alerts
    const calculateWorkingDaysNeededPerAsset = () => {
        if (!globalLiveDate || timelineTasks.length === 0) return [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const assetAlerts = [];
        
        // Calculate for each asset that has date errors
        selectedAssets.forEach(asset => {
            const calculatedStart = calculatedStartDates[asset.id];
            if (calculatedStart && dateErrors.includes(asset.id)) {
                const startDate = new Date(calculatedStart);
                const daysInPast = calculateWorkingDaysBetween(startDate, today);
                
                if (daysInPast > 0) {
                    assetAlerts.push({
                        assetId: asset.id,
                        assetName: asset.name,
                        assetType: asset.type,
                        daysNeeded: daysInPast,
                        daysSaved: 0, // This would need to be calculated based on original vs current durations
                        startDate: calculatedStart,
                        isCritical: daysInPast > 5 // Mark as critical if more than 5 days needed
                    });
                }
            }
        });
        
        // Sort by urgency (most days needed first)
        return assetAlerts.sort((a, b) => b.daysNeeded - a.daysNeeded);
    };

    // Single source of truth for working days needed (same as AssetSelector's getWorkingDaysToSave)
    const calculateWorkingDaysNeeded = () => {
        if (!globalLiveDate || timelineTasks.length === 0) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Use the exact same logic as AssetSelector's getWorkingDaysToSave
        let totalDaysInPast = 0;
        
        // Only count assets that are in dateErrors (same as asset-specific calculation)
        selectedAssets.forEach(asset => {
            const calculatedStart = calculatedStartDates[asset.id];
            if (calculatedStart && dateErrors.includes(asset.id)) {
                const startDate = new Date(calculatedStart);
                totalDaysInPast += calculateWorkingDaysBetween(startDate, today);
            }
        });
        
        // Also check custom tasks that start in the past
        timelineTasks.forEach(task => {
            if (task.isCustom) {
                const taskStart = new Date(task.start);
                if (taskStart < today) {
                    totalDaysInPast += calculateWorkingDaysBetween(taskStart, today);
                }
            }
        });
        
        return {
            available: 0, // Not used in this calculation
            allocated: 0, // Not used in this calculation
            needed: totalDaysInPast
        };
    };

    // Excel Import/Export Handlers
    const handleExportExcel = async () => {
        if (timelineTasks.length === 0) {
            setImportError('No timeline to export. Please add some assets first.');
            return;
        }

        setIsExporting(true);
        setImportError(null);

        try {
            // Calculate date columns for export
            const dates = timelineTasks.reduce((acc, task) => {
                if (task.start) acc.push(new Date(task.start));
                if (task.end) acc.push(new Date(task.end));
                return acc;
            }, []);

            const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
            const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
            
            // Add padding
            minDate.setDate(minDate.getDate() - 2);
            maxDate.setDate(maxDate.getDate() + 5);

            const dateColumns = [];
            const current = new Date(minDate);
            while (current <= maxDate) {
                dateColumns.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }

            // Debug: Log current state before export
            console.log('=== EXPORT DEBUG ===');
            console.log('selectedAssets:', selectedAssets);
            console.log('selectedAssets.length:', selectedAssets.length);
            console.log('timelineTasks.length:', timelineTasks.length);
            console.log('Sample task assetTypes:', timelineTasks.slice(0, 3).map(t => t.assetType));

            // Prepare application state for export
            let applicationState = {
                selectedAssets,
                globalLiveDate,
                assetLiveDates,
                useGlobalDate,
                customTasks,
                assetTaskDurations,
                customTaskNames
            };

            // If selectedAssets is empty but we have tasks, reconstruct assets from tasks
            if (selectedAssets.length === 0 && timelineTasks.length > 0) {
                console.log('⚠️ selectedAssets is empty, reconstructing from tasks...');
                
                // Get unique asset types from tasks
                const assetTypesFromTasks = [...new Set(timelineTasks.map(t => t.assetType).filter(Boolean))];
                console.log('Asset types found in tasks:', assetTypesFromTasks);
                
                // Reconstruct assets
                const reconstructedAssets = assetTypesFromTasks.map(assetType => ({
                    id: generateAssetId(),
                    type: assetType, // This should match CSV "Asset Type" 
                    name: assetType,
                    startDate: globalLiveDate || ''
                }));
                
                console.log('Reconstructed assets:', reconstructedAssets);
                applicationState.selectedAssets = reconstructedAssets;
            }

            // Extract custom tasks from timeline (they might not be in customTasks state)
            const customTasksFromTimeline = timelineTasks.filter(task => task.isCustom);
            if (customTasksFromTimeline.length > 0) {
                console.log('📝 Extracting custom tasks from timeline:', customTasksFromTimeline);
                
                // Enhance custom tasks with task name references for positioning
                const enhancedCustomTasks = customTasksFromTimeline.map(customTask => {
                    if (customTask.insertAfterTaskId) {
                        // Find the task that this custom task should be inserted after
                        const afterTask = timelineTasks.find(t => t.id === customTask.insertAfterTaskId);
                        if (afterTask) {
                            console.log(`🔗 Custom task "${customTask.name}" should insert after task "${afterTask.name}"`);
                            return {
                                ...customTask,
                                insertAfterTaskName: afterTask.name // Add task name for stable reference
                            };
                        }
                    }
                    return customTask;
                });
                
                applicationState.customTasks = enhancedCustomTasks;
            }

            await exportToExcel(timelineTasks, dateColumns, bankHolidays, minDate, maxDate, applicationState);
        } catch (error) {
            console.error('Export error:', error);
            setImportError('Failed to export timeline. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportFileSelect = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportError(null);
        setIsImporting(true);

        try {
            if (!validateExcelFile(file)) {
                throw new Error('Please select a valid Excel file (.xlsx or .xls).');
            }

            const preview = await getImportPreview(file);
            if (!preview.success) {
                throw new Error(preview.error || 'Failed to read Excel file.');
            }

            setImportPreview({ file, preview });
            setShowImportConfirm(true);
        } catch (error) {
            console.error('Import validation error:', error);
            setImportError(error.message || 'Failed to process Excel file.');
        } finally {
            setIsImporting(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleConfirmImport = async () => {
        if (!importPreview?.file) return;

        setIsImporting(true);
        setShowImportConfirm(false);

        try {
            const importedData = await importFromExcel(importPreview.file);
            console.log('Imported data:', importedData);
            
            // Restore application state from imported data
            console.log('=== IMPORT DEBUG ===');
            console.log('importedData.selectedAssets:', importedData.selectedAssets);
            console.log('importedData.selectedAssets.length:', importedData.selectedAssets?.length || 0);
            console.log('importedData.tasks.length:', importedData.tasks?.length || 0);
            
            // Restore or reconstruct selectedAssets
            if (importedData.selectedAssets && importedData.selectedAssets.length > 0) {
                console.log('✅ Restoring selectedAssets directly:', importedData.selectedAssets);
                setSelectedAssets(importedData.selectedAssets);
            } else if (importedData.tasks && importedData.tasks.length > 0) {
                console.log('⚠️ selectedAssets empty, reconstructing from imported tasks...');
                
                // Get unique asset types from imported tasks
                const assetTypesFromTasks = [...new Set(importedData.tasks.map(t => t.assetType).filter(Boolean))];
                console.log('Asset types found in imported tasks:', assetTypesFromTasks);
                
                // Reconstruct assets with unique IDs
                const reconstructedAssets = assetTypesFromTasks.map(assetType => ({
                    id: generateAssetId(),
                    type: assetType, // This should match CSV "Asset Type"
                    name: assetType,
                    startDate: importedData.globalLiveDate || ''
                }));
                
                console.log('Reconstructed assets from import:', reconstructedAssets);
                setSelectedAssets(reconstructedAssets);
            }
            
            if (importedData.globalLiveDate) {
                console.log('Restoring globalLiveDate:', importedData.globalLiveDate);
                setGlobalLiveDate(importedData.globalLiveDate);
            }
            
            if (importedData.assetLiveDates) {
                console.log('Restoring assetLiveDates:', importedData.assetLiveDates);
                setAssetLiveDates(importedData.assetLiveDates);
            }
            
            if (importedData.useGlobalDate !== undefined) {
                console.log('Restoring useGlobalDate:', importedData.useGlobalDate);
                setUseGlobalDate(importedData.useGlobalDate);
            }
            
            // Restore custom tasks - both from customTasks array and extract from timeline
            let finalCustomTasks = [];
            
            if (importedData.customTasks && importedData.customTasks.length > 0) {
                console.log('Restoring customTasks from metadata:', importedData.customTasks);
                finalCustomTasks = importedData.customTasks;
            } else {
                // Fallback: extract custom tasks from imported timeline
                const customTasksFromImportedTimeline = importedData.tasks.filter(t => t.isCustom);
                if (customTasksFromImportedTimeline.length > 0) {
                    console.log('📝 Extracting custom tasks from imported timeline:', customTasksFromImportedTimeline);
                    finalCustomTasks = customTasksFromImportedTimeline;
                }
            }
            
            if (finalCustomTasks.length > 0) {
                setCustomTasks(finalCustomTasks);
            }
            
            // Note: We no longer directly set timelineTasks here because the taskBank rebuild
            // will now properly include custom tasks and rebuild the timeline correctly
            
            if (importedData.assetTaskDurations) {
                console.log('Restoring assetTaskDurations:', importedData.assetTaskDurations);
                setAssetTaskDurations(importedData.assetTaskDurations);
            }
            
            if (importedData.customTaskNames) {
                console.log('Restoring customTaskNames:', importedData.customTaskNames);
                setCustomTaskNames(importedData.customTaskNames);
            }
            
            // Timeline tasks will be rebuilt automatically by useEffect hooks once assets are restored
            setImportError(null);
            
            // Get final asset count (either from imported data or reconstructed)
            const finalAssetCount = (importedData.selectedAssets && importedData.selectedAssets.length > 0) 
                ? importedData.selectedAssets.length 
                : [...new Set(importedData.tasks.map(t => t.assetType).filter(Boolean))].length;
                
            const customTaskCount = finalCustomTasks.length;
            const totalTasks = importedData.tasks.length;
            const customTaskText = customTaskCount > 0 ? ` (including ${customTaskCount} custom task${customTaskCount === 1 ? '' : 's'})` : '';
                
            alert(`Successfully imported timeline with ${finalAssetCount} assets and ${totalTasks} tasks${customTaskText}!`);
        } catch (error) {
            console.error('Import error:', error);
            setImportError(error.message || 'Failed to import timeline.');
        } finally {
            setIsImporting(false);
            setImportPreview(null);
        }
    };

    const handleCancelImport = () => {
        setShowImportConfirm(false);
        setImportPreview(null);
        setImportError(null);
    };

    return (
        <div className="bg-gray-100 min-h-screen font-sans" data-testid="timeline-builder">
            {/* Recovery Prompt */}
            <RecoveryPrompt
                isOpen={showRecoveryPrompt}
                preview={recoveryPreview}
                onRecover={handleRecover}
                onDiscard={discardRecovery}
            />
            
            {/* Save Status Indicator */}
            <SaveIndicator
                status={saveStatus.status}
                lastSaved={saveStatus.lastSaved}
                message={saveStatus.message}
            />

            <header className="bg-white shadow-md">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-800">Accordion Timeline Builder</h1>
                        <div className="flex items-center space-x-2">
                            {/* Excel Import/Export */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isImporting}
                                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                title="Import Timeline from Excel"
                            >
                                {isImporting ? '⏳ Importing...' : '📥 Import'}
                            </button>
                            <button
                                data-testid="export-excel"
                                onClick={handleExportExcel}
                                disabled={isExporting || timelineTasks.length === 0}
                                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                title="Export Timeline to Excel"
                            >
                                {isExporting ? '⏳ Exporting...' : '📊 Export'}
                            </button>
                            
                            {/* Analytics Button */}
                            <button
                                onClick={() => setShowAnalytics(true)}
                                disabled={timelineTasks.length === 0}
                                className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                title="View Analytics"
                            >
                                📊 Analytics
                            </button>
                            
                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleImportFileSelect}
                                data-testid="import-excel-input"
                                className="hidden"
                            />
                            
                            {/* Undo/Redo */}
                            <button
                                data-testid="undo-button"
                                onClick={undo}
                                disabled={historyIndex <= 0}
                                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                title="Undo (Ctrl+Z)"
                            >
                                ↩️ Undo
                            </button>
                            <button
                                data-testid="redo-button"
                                onClick={redo}
                                disabled={historyIndex >= history.length - 1}
                                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                title="Redo (Ctrl+Y)"
                            >
                                ↪️ Redo
                            </button>
                        </div>
                    </div>
                    
                    {/* Error Messages */}
                    {importError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <div className="flex items-center">
                                <span className="text-red-500 mr-2">⚠️</span>
                                <span className="text-red-700 text-sm">{importError}</span>
                                <button
                                    onClick={() => setImportError(null)}
                                    className="ml-auto text-red-400 hover:text-red-600 text-lg"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Getting Started Button */}
                    <div className="mt-4 text-center">
                        <button
                            onClick={() => setShowGettingStarted(true)}
                            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                        >
                            🚀 Getting Started
                        </button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: CONTROLS */}
                    <div
  className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg overflow-x-auto"
  style={{ minWidth: 380 }} // You can adjust 380 to your needs
>
                        <h2 className="text-xl font-semibold mb-4 border-b pb-3 text-gray-700">Timeline Setup</h2>
                        <CampaignSetup 
                            globalLiveDate={globalLiveDate}
                            onGlobalLiveDateChange={(date) => {
                                executeAction(() => setGlobalLiveDate(date), `Change global go-live date to ${date}`);
                            }}
                            useGlobalDate={useGlobalDate}
                            onUseGlobalDateChange={(useGlobal) => {
                                executeAction(() => setUseGlobalDate(useGlobal), `Switch to ${useGlobal ? 'global' : 'individual'} date mode`);
                            }}
                            projectStartDate={projectStartDate}
                            dateErrors={dateErrors}
                            workingDaysNeeded={calculateWorkingDaysNeeded()}
                        />
<AssetSelector
    assets={uniqueAssets || []}
    selectedAssets={selectedAssets || []}
    onAddAsset={handleAddAsset}
    onRemoveAsset={handleRemoveAsset}
    useGlobalDate={useGlobalDate}
    globalLiveDate={globalLiveDate || ''}
    assetLiveDates={assetLiveDates || {}}
    onAssetLiveDateChange={handleAssetLiveDateChange}
    calculatedStartDates={calculatedStartDates || {}}
    dateErrors={dateErrors || []}
    sundayDateErrors={sundayDateErrors || []}
    onRenameAsset={handleRenameAsset}
    onAssetStartDateChange={handleAssetStartDateChange}
    csvData={csvData}
    onSaveTaskDurations={handleSaveTaskDurations}
    isNonWorkingDay={isNonWorkingDay}
    calculateWorkingDaysBetween={calculateWorkingDaysBetween}
/>
                    </div>
                    
                    {/* RIGHT COLUMN: TIMELINE */}
                    <div
  className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg"
  style={{ minWidth: 0, maxWidth: "100%" }}
>
                        <h2 className="text-xl font-semibold mb-4 border-b pb-3 text-gray-700">Generated Timeline</h2>
                        
                        {/* Timeline Conflict Warnings */}
                        {dateErrors.length > 0 && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                                <h3 className="text-red-800 font-medium mb-2">⚠️ Timeline Conflicts</h3>
                                <p className="text-red-700 text-sm mb-2">
                                    The following assets cannot be completed by their live dates:
                                </p>
                                <ul className="text-red-700 text-sm">
                                    {dateErrors.map(assetId => {
                                        const asset = selectedAssets.find(a => a.id === assetId);
                                        return (
                                            <li key={assetId} className="ml-4">
                                                • {asset?.name || 'Unknown Asset'} (would need to start on {calculatedStartDates[assetId]})
                                            </li>
                                        );
                                    })}
                                </ul>
                                <p className="text-red-700 text-sm mt-2 font-medium">
                                    Manual adjustment of task durations required.
                                </p>
                            </div>
                        )}

                        {/* Sunday Date Validation Error Banner */}
                        {sundayDateErrors.length > 0 && (
                            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-start">
                                    <div className="mr-3 mt-0.5">
                                        <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                                            <span className="text-red-600 text-sm font-bold">!</span>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-red-800 mb-2">Date Conflict</h3>
                                        <p className="text-red-700 text-sm mb-3">
                                            Print Supplements require a Sunday Go-Live date, but your global date is set to {' '}
                                            <span className="font-medium">
                                                {globalLiveDate && new Date(globalLiveDate).toLocaleDateString('en-GB', { 
                                                    weekday: 'long', 
                                                    year: 'numeric', 
                                                    month: 'long', 
                                                    day: 'numeric' 
                                                })}
                                            </span>.
                                        </p>
                                        <div className="bg-red-100 border border-red-300 rounded p-3 text-sm text-red-800">
                                            <p className="font-medium mb-1">To fix this:</p>
                                            <p>Uncheck "Use same live date for all assets" and set individual Sunday dates for your Print Supplement assets below.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {timelineTasks && timelineTasks.length > 0 ? (
                            <div className="space-y-4">
                                {/* Timeline Compression Tools */}
                                <div className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                                    <div>
                                        <h3 className="font-medium text-gray-800">Timeline Compression</h3>
                                        <p className="text-sm text-gray-600">Create task overlaps to fit more work into less time</p>
                                    </div>
                                    {/* <DependencyManagementButton variant="primary" size="medium" /> */}
                                </div>

                                {/* Timeline Compression Metrics */}
                                <TimelineCompressionMetrics 
                                    tasks={timelineTasks}
                                    originalDuration={calculateWorkingDaysNeeded()}
                                />

                                <GanttChart 
                            tasks={timelineTasks}
                            bankHolidays={bankHolidays}
                            onTaskDurationChange={handleTaskDurationChange}
                            onTaskMove={handleTaskMove}
                            onTaskNameChange={handleRenameTask}
                            workingDaysNeeded={calculateWorkingDaysNeeded()}
                            assetAlerts={calculateWorkingDaysNeededPerAsset()}
                            onAddCustomTask={handleAddCustomTask}
                            selectedAssets={selectedAssets}
                            isExportDisabled={sundayDateErrors.length > 0}
                        />
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 py-10">
                                <p className="text-lg">Your timeline will appear here.</p>
                                <p className="text-sm">Set a live date and select some assets to begin.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            
            {/* Import Confirmation Modal */}
            {showImportConfirm && importPreview && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <span className="text-yellow-500 mr-3 text-2xl">⚠️</span>
                                <h2 className="text-xl font-bold text-gray-800">Confirm Timeline Import</h2>
                            </div>
                            
                            <div className="space-y-3 mb-6">
                                <p className="text-gray-600">
                                    This will replace your current timeline with the imported data:
                                </p>
                                <div className="bg-gray-50 p-3 rounded text-sm">
                                    <div><strong>File:</strong> {importPreview.preview.fileName}</div>
                                    <div><strong>Tasks:</strong> {importPreview.preview.taskCount}</div>
                                    <div><strong>Exported:</strong> {importPreview.preview.exportDate ? new Date(importPreview.preview.exportDate).toLocaleDateString() : 'Unknown'}</div>
                                </div>
                                <p className="text-red-600 text-sm font-medium">
                                    Your current work will be lost unless you export it first.
                                </p>
                            </div>
                            
                            <div className="flex space-x-3">
                                <button
                                    onClick={handleCancelImport}
                                    className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={isImporting}
                                    data-testid="confirm-import"
                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                                >
                                    {isImporting ? 'Importing...' : 'Import Timeline'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Progressive Disclosure Modal */}
            {showGettingStarted && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">Getting Started</h2>
                                <button
                                    onClick={() => {
                                        setShowGettingStarted(false);
                                        setShowAllInstructions(false);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                                >
                                    ×
                                </button>
                            </div>
                            
                            {!showAllInstructions ? (
                                // Quick Start Guide
                                <div className="space-y-6">
                                    <div className="text-center mb-6">
                                        <p className="text-gray-600 text-lg">
                                            Build your campaign timeline in 4 simple steps
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="flex items-start space-x-4">
                                            <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                1
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-800">Select Your Assets</h3>
                                                <p className="text-gray-600 text-sm">
                                                    Choose the campaign assets you need from the left panel. 
                                                    You can add multiple instances of the same asset type.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-start space-x-4">
                                            <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                2
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-800">Set Your Go-Live Date</h3>
                                                <p className="text-gray-600 text-sm">
                                                    Choose whether all assets launch on the same day or set individual dates. 
                                                    The system will calculate when work needs to start.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-start space-x-4">
                                            <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                3
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-800">Review Your Timeline</h3>
                                                <p className="text-gray-600 text-sm">
                                                    Check the Gantt chart to see your timeline. 
                                                    If you see warnings, you'll need to adjust task durations.
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-start space-x-4">
                                            <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                4
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-800">Export to Excel</h3>
                                                <p className="text-gray-600 text-sm">
                                                    Once your timeline is perfect, export it to Excel for your team.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="border-t pt-6 mt-6">
                                        <button
                                            onClick={() => setShowAllInstructions(true)}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            Show all instructions →
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Full Instructions
                                <div className="space-y-4">
                                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Complete Instructions</h3>
                                    
                                    <ol className="list-decimal pl-5 space-y-4 text-sm">
                                        <li>
                                            <strong className="text-gray-800">Choose Your Campaign Start Date:</strong><br />
                                            <span className="text-gray-600">
                                                If all assets launch on the same day, set a global start date and check "Use same live date for all assets."<br />
                                                If assets launch on different days, uncheck the box and set dates individually for each asset.
                                            </span>
                                        </li>
                                        <li>
                                            <strong className="text-gray-800">Add Assets:</strong><br />
                                            <span className="text-gray-600">
                                                Click "Add" next to each asset type you need.<br />
                                                Need the same asset type more than once? Click "Add" again and give each a unique name.
                                            </span>
                                        </li>
                                        <li>
                                            <strong className="text-gray-800">Customize Assets:</strong><br />
                                            <span className="text-gray-600">
                                                Rename each asset for clarity (e.g., "Metro Advertorial – August").<br />
                                                Set or confirm the start date for each asset.
                                            </span>
                                        </li>
                                        <li>
                                            <strong className="text-gray-800">Review Your Timeline:</strong><br />
                                            <span className="text-gray-600">
                                                Remove any asset you don't need.<br />
                                                Check the timeline to ensure all assets are scheduled as planned.
                                            </span>
                                        </li>
                                        <li>
                                            <strong className="text-gray-800">Adjust Your Timeline if Needed:</strong><br />
                                            <span className="text-gray-600">
                                                If an asset's timeline can't be completed by the selected start date, you'll see a warning.<br />
                                                – You can either change the go-live date, or<br />
                                                – Manually shorten the durations of individual tasks ("accordion" your timeline) until the schedule fits.
                                            </span>
                                        </li>
                                        <li>
                                            <strong className="text-gray-800">Undo/Redo:</strong><br />
                                            <span className="text-gray-600">
                                                Use Ctrl+Z to undo and Ctrl+Y to redo any changes you make.<br />
                                                You can also use the Undo/Redo buttons in the top-right corner.
                                            </span>
                                        </li>
                                    </ol>
                                    
                                    <div className="border-t pt-4 mt-4">
                                        <button
                                            onClick={() => setShowAllInstructions(false)}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            ← Back to quick start
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Simple Analytics Modal */}
            <SimpleAnalytics
                tasks={timelineTasks}
                isOpen={showAnalytics}
                onClose={() => setShowAnalytics(false)}
            />
        </div>
    );
};

export default TimelineBuilder;