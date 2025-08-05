import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import AssetSelector from './components/AssetSelector';
import CampaignSetup from './components/CampaignSetup';
import GanttChart from './components/GanttChart';

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
    
    // Final timeline for display
    const [timelineTasks, setTimelineTasks] = useState([]);
    const [showInfoBox, setShowInfoBox] = useState(true); // Add state for info box

    // Add state to store custom task durations for each asset instance
    const [assetTaskDurations, setAssetTaskDurations] = useState({}); // { assetId: { taskName: duration, ... } }

    // Task bank: assetId -> raw task objects (CSV only for now)
    const [taskBank, setTaskBank] = useState({}); // { assetId: Task[] }

    // Add state to store custom tasks separately
    const [customTasks, setCustomTasks] = useState([]); // Array of custom task objects

    // Add state to store custom task names
    const [customTaskNames, setCustomTaskNames] = useState({}); // { taskId: customName }

    // Add state to store bank holidays
    const [bankHolidays, setBankHolidays] = useState([]); // Array of YYYY-MM-DD strings

    // State for undo/redo functionality
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isUndoRedoAction, setIsUndoRedoAction] = useState(false);
    
    // State for progressive disclosure
    const [showGettingStarted, setShowGettingStarted] = useState(false);
    const [showAllInstructions, setShowAllInstructions] = useState(false);

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

    // Pure helper: build dated timeline for a single asset
    const buildAssetTimeline = (rawTasks = [], liveDateStr) => {
        if (!liveDateStr || rawTasks.length === 0) return [];
        const liveDate = new Date(liveDateStr);
        if (isNaN(liveDate.getTime())) return [];
        let currentEnd = new Date(liveDate);
        const dated = [];
        for (let i = rawTasks.length - 1; i >= 0; i--) {
            const t = rawTasks[i];
            const dur = t.duration || 1;
            let startDate, endDate;
            if (i === rawTasks.length - 1) {
                startDate = new Date(currentEnd);
                endDate = new Date(currentEnd);
            } else {
                startDate = subtractWorkingDays(currentEnd, dur);
                endDate = new Date(currentEnd);
                endDate.setDate(endDate.getDate() - 1);
                if (isNonWorkingDay(endDate)) {
                    endDate = getPreviousWorkingDay(endDate);
                }
            }
            dated.unshift({
                ...t,
                start: safeToISOString(startDate),
                end: safeToISOString(endDate),
            });
            currentEnd = new Date(startDate);
        }
        return dated;
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

    // Build taskBank whenever selectedAssets or csvData change
    useEffect(() => {
        if (selectedAssets.length === 0 || csvData.length === 0) {
            setTaskBank({});
            return;
        }
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
        setTaskBank(bank);
    }, [selectedAssets, csvData]);

    // Build dated timelineTasks from taskBank + live dates
    useEffect(() => {
        if (Object.keys(taskBank).length === 0) {
            setTimelineTasks([]);
            return;
        }
        const all = [];
        selectedAssets.forEach(asset => {
            const liveDateStr = useGlobalDate ? globalLiveDate : assetLiveDates[asset.name];
            const raw = taskBank[asset.id] || [];
            const dated = buildAssetTimeline(raw, liveDateStr);
            all.push(...dated);
        });
        setTimelineTasks(all);
    }, [taskBank, selectedAssets, globalLiveDate, useGlobalDate, assetLiveDates]);

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

    // Calculate backwards timeline when live dates or assets change
    useEffect(() => {
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
            if (!asset.startDate) return; // Skip if no start date set

            // Get ALL tasks for this asset type from the CSV (no filtering)
            const assetTasks = csvData.filter(row => row['Asset Type'] === asset.type);
            if (assetTasks.length === 0) return;

            // Use the global live date if useGlobalDate is true, otherwise use the asset's individual startDate
            // Respect user's choice even if it's a non-working day
            const liveDate = useGlobalDate 
                ? new Date(globalLiveDate) 
                : new Date(asset.startDate);
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
    }, [selectedAssets, globalLiveDate, useGlobalDate, assetLiveDates, csvData, assetTaskDurations, customTaskNames]);

    // Separate useEffect to handle custom tasks
    useEffect(() => {
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
                        name: customTask.name || `Custom: ${customTask.name}`,
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
    }, [customTasks, selectedAssets, globalLiveDate, useGlobalDate]);

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
    // Helper function to safely convert date to ISO string
    const safeToISOString = (date) => {
        if (!date || isNaN(date.getTime())) {
            console.warn('Invalid date detected:', date);
            return new Date().toISOString().split('T')[0]; // Return today's date as fallback
        }
        return date.toISOString().split('T')[0];
    };

    // Generate timeline tasks for Gantt chart
    const generateTimelineTasks = (startDates) => {
        if (selectedAssets.length === 0 || Object.keys(startDates).length === 0) {
            setTimelineTasks([]);
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
        
        setCalculatedStartDates(newCalculatedStartDates);
        setTimelineTasks(allTasks);
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
    };

    // Remove an asset instance by id
    const handleRemoveAsset = (assetId) => {
        const assetToRemove = selectedAssets.find(asset => asset.id === assetId);
        executeAction(() => {
            setSelectedAssets(prev => prev.filter(asset => asset.id !== assetId));
        }, `Remove ${assetToRemove?.name || 'asset'}`);
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
            
            // If we have a preserved assetType, also update the task's assetType
            if (preservedAssetType) {
                setTimelineTasks(prev => prev.map(task => 
                    task.id === taskId 
                        ? { ...task, assetType: preservedAssetType }
                        : task
                ));
            }
        }, `Rename task to "${newName}"`);
    };

    const handleAssetLiveDateChange = (assetName, date) => {
        executeAction(() => {
            setAssetLiveDates(prev => ({
                ...prev,
                [assetName]: date
            }));
        }, `Change ${assetName} go-live date to ${date}`);
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
            
            // Preserve custom tasks before timeline recalculation
            const currentCustomTasks = timelineTasks.filter(task => task.isCustom);
            setCustomTasks(currentCustomTasks);
        }, `Update task durations for ${assetToUpdate?.name || 'asset'}`);
    };

    // Handler for drag-to-resize task duration
    const handleTaskDurationChange = (taskId, newDuration, newEndDate) => {
        // Find the task being modified
        const taskIndex = timelineTasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return;

        const task = timelineTasks[taskIndex];
        const taskName = task.name.split(': ')[1]; // Get task name after the colon
        const assetName = task.name.split(': ')[0]; // Get asset name before the colon
        
        // Find the asset by name
        const asset = selectedAssets.find(a => a.name === assetName);
        if (!asset) return;
        
        executeAction(() => {
            // Update the assetTaskDurations state to trigger the same recalculation logic
            // that the manual duration editing uses
            // Use asset.type as the key to match CSV task names consistently
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
            name: `Custom: ${name}`,
            duration: duration || 1,
            owner: owner || 'm',
            assetType,
            isCustom: true,
            insertAfterTaskId: insertAfterTaskId || null,
        };

        executeAction(() => {
            setTaskBank(prev => {
                const list = prev[asset.id] ? [...prev[asset.id]] : [];
                let idx = 0;
                if (insertAfterTaskId) {
                    const i = list.findIndex(t => t.id === insertAfterTaskId);
                    if (i !== -1) idx = i + 1;
                }
                list.splice(idx, 0, rawTask);
                return { ...prev, [asset.id]: list };
            });
        }, `Add custom task "${name}"`);
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



    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <header className="bg-white shadow-md">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-800">Accordion Timeline Builder</h1>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={undo}
                                disabled={historyIndex <= 0}
                                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                title="Undo (Ctrl+Z)"
                            >
                                ↩️ Undo
                            </button>
                            <button
                                onClick={redo}
                                disabled={historyIndex >= history.length - 1}
                                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                title="Redo (Ctrl+Y)"
                            >
                                ↪️ Redo
                            </button>
                        </div>
                    </div>
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
                        
                     {/* Error Messages - Temporarily Disabled */}
{/* {dateErrors.length > 0 && (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
        <h3 className="text-red-800 font-medium mb-2">⚠️ Timeline Conflicts</h3>
        <p className="text-red-700 text-sm mb-2">
            The following assets cannot be completed by their live dates:
        </p>
        <ul className="text-red-700 text-sm">
            {dateErrors.map(asset => (
                <li key={asset} className="ml-4">
                    • {asset} (would need to start on {calculatedStartDates[asset]})
                </li>
            ))}
        </ul>
        <p className="text-red-700 text-sm mt-2 font-medium">
            Manual adjustment of task durations required.
        </p>
    </div>
)} */}

                        {timelineTasks && timelineTasks.length > 0 ? (
                            <GanttChart 
                                tasks={timelineTasks}
                                bankHolidays={bankHolidays}
                                onTaskDurationChange={handleTaskDurationChange}
                                onTaskNameChange={handleRenameTask}
                                workingDaysNeeded={calculateWorkingDaysNeeded()}
                                assetAlerts={calculateWorkingDaysNeededPerAsset()}
                                onAddCustomTask={handleAddCustomTask}
                                selectedAssets={selectedAssets}
                            />
                        ) : (
                            <div className="text-center text-gray-500 py-10">
                                <p className="text-lg">Your timeline will appear here.</p>
                                <p className="text-sm">Set a live date and select some assets to begin.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            
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
        </div>
    );
};

export default TimelineBuilder;