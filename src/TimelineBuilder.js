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
        const day = date.getDay();
        const yyyy_mm_dd = date.toISOString().split('T')[0];
        return day === 0 || day === 6 || bankHolidays.includes(yyyy_mm_dd);
    };

    // Helper function to get previous working day
    const getPreviousWorkingDay = (date) => {
        let workingDate = new Date(date);
        do {
            workingDate.setDate(workingDate.getDate() - 1);
        } while (isNonWorkingDay(workingDate));
        return workingDate;
    };

    // Helper function to get next working day
    const getNextWorkingDay = (date) => {
        let workingDate = new Date(date);
        do {
            workingDate.setDate(workingDate.getDate() + 1);
        } while (isNonWorkingDay(workingDate));
        return workingDate;
    };

    // Helper function to subtract working days (backwards calculation)
    const subtractWorkingDays = (endDate, workingDaysToSubtract) => {
        let currentDate = new Date(endDate);
        let remainingDays = workingDaysToSubtract;
        // Subtract working days
        while (remainingDays > 0) {
            currentDate.setDate(currentDate.getDate() - 1);
            // Only count non-non-working days
            if (!isNonWorkingDay(currentDate)) {
                remainingDays--;
            }
        }
        return currentDate;
    };

    // Helper function to add working days (forward calculation for display)
    const addWorkingDays = (startDate, workingDaysToAdd) => {
        if (workingDaysToAdd <= 0) {
            return new Date(startDate);
        }
        let currentDate = new Date(startDate);
        let remainingDays = workingDaysToAdd - 1;
        while (remainingDays > 0) {
            currentDate.setDate(currentDate.getDate() + 1);
            if (!isNonWorkingDay(currentDate)) {
                remainingDays--;
            }
        }
        // Ensure the final day is a working day
        while (isNonWorkingDay(currentDate)) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return currentDate;
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

            // Find all tasks for this asset type from the CSV
            const assetTasks = csvData.filter(row => row['Asset Type'] === asset.type);
            if (assetTasks.length === 0) return;

            // Use the asset instance's startDate as the go-live date
            const liveDate = new Date(asset.startDate);
            if (isNaN(liveDate.getTime())) return;

            // We'll build the tasks in reverse (from go-live backwards)
            let currentEndDate = new Date(liveDate);
            const ganttTasks = [];
            let taskIndex = 0;

            // Go-live task (single day)
            const goLiveTaskId = `${asset.id}-go-live`;
            ganttTasks.unshift({
                id: goLiveTaskId,
                name: getTaskName(goLiveTaskId, asset.name, { 'Task': 'Go-Live' }),
                start: liveDate.toISOString().split('T')[0],
                end: liveDate.toISOString().split('T')[0],
                progress: 0,
            });
            taskIndex++;

            // Process all other tasks in reverse order
            for (let i = assetTasks.length - 1; i >= 0; i--) {
                const taskInfo = assetTasks[i];
                // Use custom duration if present, else default from CSV
                // Use asset.type as the key to match CSV task names consistently
                const customDurations = assetTaskDurations[asset.type] || {};
                const duration = customDurations[taskInfo['Task']] !== undefined
                    ? customDurations[taskInfo['Task']]
                    : parseInt(taskInfo['Duration (Days)'], 10) || 1;
                // Subtract working days to get the start date
                const taskStartDate = subtractWorkingDays(currentEndDate, duration);
                // Task ends the working day before currentEndDate
                const taskEndDate = new Date(currentEndDate);
                taskEndDate.setDate(taskEndDate.getDate() - 1);
                // Ensure end date is a working day
                let finalTaskEndDate = new Date(taskEndDate);
                if (isNonWorkingDay(finalTaskEndDate)) {
                    finalTaskEndDate = getPreviousWorkingDay(finalTaskEndDate);
                }
                const taskId = `${asset.id}-task-${taskIndex}`;
                ganttTasks.unshift({
                    id: taskId,
                    name: getTaskName(taskId, asset.name, taskInfo),
                    start: taskStartDate.toISOString().split('T')[0],
                    end: finalTaskEndDate.toISOString().split('T')[0],
                    progress: 0,
                });
                taskIndex++;
                // Update currentEndDate for the next task
                currentEndDate = new Date(taskStartDate);
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

        // Handle custom tasks by integrating them into the timeline
        if (customTasks.length > 0) {
            console.log('Processing custom tasks:', customTasks);
            
            // First, create a simple timeline with all asset tasks
            const assetTimeline = [...allTasks];
            console.log('Initial asset timeline:', assetTimeline);
            
            // Insert custom tasks at their specified positions
            customTasks.forEach(customTask => {
                let insertIndex = 0;
                if (customTask.insertAfterTaskId) {
                    const afterTaskIndex = assetTimeline.findIndex(task => task.id === customTask.insertAfterTaskId);
                    console.log('Looking for insertAfterTaskId:', customTask.insertAfterTaskId, 'found at index:', afterTaskIndex);
                    if (afterTaskIndex !== -1) {
                        insertIndex = afterTaskIndex + 1;
                    }
                }
                
                console.log('Inserting custom task at index:', insertIndex);
                
                // Insert the custom task (without dates for now)
                assetTimeline.splice(insertIndex, 0, {
                    ...customTask,
                    start: '', // Will be calculated below
                    end: ''    // Will be calculated below
                });
            });
            
            console.log('Timeline after inserting custom tasks:', assetTimeline);
            
            // Now rebuild the timeline backwards from go-live to maintain constraints
            const finalTimeline = [];
            
            // Group tasks by asset to maintain the backwards calculation
            const tasksByAsset = {};
            assetTimeline.forEach(task => {
                if (task.isCustom) {
                    // Custom tasks need to be associated with the asset they belong to
                    // Find which asset this custom task belongs to based on insertAfterTaskId
                    let targetAssetId = null;
                    if (task.insertAfterTaskId) {
                        const afterTask = assetTimeline.find(t => t.id === task.insertAfterTaskId);
                        if (afterTask) {
                            targetAssetId = afterTask.id.split('-')[0];
                        }
                    }
                    
                    if (targetAssetId) {
                        if (!tasksByAsset[targetAssetId]) tasksByAsset[targetAssetId] = [];
                        tasksByAsset[targetAssetId].push(task);
                    } else {
                        // Fallback: associate with the first asset
                        const firstAssetId = selectedAssets[0]?.id;
                        if (firstAssetId) {
                            if (!tasksByAsset[firstAssetId]) tasksByAsset[firstAssetId] = [];
                            tasksByAsset[firstAssetId].push(task);
                        }
                    }
                } else {
                    // Asset tasks are grouped by their asset ID
                    const assetId = task.id.split('-')[0];
                    if (!tasksByAsset[assetId]) tasksByAsset[assetId] = [];
                    tasksByAsset[assetId].push(task);
                }
            });
            
            console.log('Tasks grouped by asset:', tasksByAsset);
            
            // Rebuild each asset's timeline backwards from go-live
            selectedAssets.forEach(asset => {
                const assetTasks = tasksByAsset[asset.id] || [];
                if (assetTasks.length === 0) return;
                
                console.log(`Processing asset ${asset.id} with tasks:`, assetTasks);
                
                // Separate go-live task from other tasks
                const goLiveTask = assetTasks.find(task => task.name.includes('Go-Live'));
                const regularTasks = assetTasks.filter(task => !task.name.includes('Go-Live'));
                
                // Build backwards from go-live to calculate dates
                let currentEndDate = new Date(asset.startDate);
                const calculatedTasks = [];
                
                // Calculate dates for regular tasks in reverse order (backwards from go-live)
                for (let i = regularTasks.length - 1; i >= 0; i--) {
                    const task = regularTasks[i];
                    
                    if (task.isCustom) {
                        // Custom task - calculate backwards from current end date
                        const taskStartDate = subtractWorkingDays(currentEndDate, task.duration);
                        const taskEndDate = new Date(currentEndDate);
                        taskEndDate.setDate(taskEndDate.getDate() - 1);
                        
                        // Ensure end date is a working day
                        let finalTaskEndDate = new Date(taskEndDate);
                        if (isNonWorkingDay(finalTaskEndDate)) {
                            finalTaskEndDate = getPreviousWorkingDay(finalTaskEndDate);
                        }
                        
                        calculatedTasks.unshift({
                            ...task,
                            start: taskStartDate.toISOString().split('T')[0],
                            end: finalTaskEndDate.toISOString().split('T')[0]
                        });
                        
                        currentEndDate = new Date(taskStartDate);
                    } else {
                        // Regular asset task
                        const taskInfo = csvData.find(row => 
                            row['Asset Type'] === asset.type && 
                            row['Task'] === task.name.split(': ')[1]
                        );
                        
                        // Use manual duration override if available
                        const customDurations = assetTaskDurations[asset.type] || {};
                        const duration = customDurations[taskInfo?.['Task']] !== undefined
                            ? customDurations[taskInfo['Task']]
                            : parseInt(taskInfo?.['Duration (Days)'], 10) || 1;
                        
                        const taskStartDate = subtractWorkingDays(currentEndDate, duration);
                        const taskEndDate = new Date(currentEndDate);
                        taskEndDate.setDate(taskEndDate.getDate() - 1);
                        
                        // Ensure end date is a working day
                        let finalTaskEndDate = new Date(taskEndDate);
                        if (isNonWorkingDay(finalTaskEndDate)) {
                            finalTaskEndDate = getPreviousWorkingDay(finalTaskEndDate);
                        }
                        
                        calculatedTasks.unshift({
                            ...task,
                            start: taskStartDate.toISOString().split('T')[0],
                            end: finalTaskEndDate.toISOString().split('T')[0]
                        });
                        
                        currentEndDate = new Date(taskStartDate);
                    }
                }
                
                // Add go-live task at the end
                if (goLiveTask) {
                    calculatedTasks.push({
                        ...goLiveTask,
                        start: asset.startDate,
                        end: asset.startDate
                    });
                }
                
                // Add all tasks to final timeline in correct order
                finalTimeline.push(...calculatedTasks);
            });
            
            console.log('Final timeline with custom tasks:', finalTimeline);
            setTimelineTasks(finalTimeline);
            
            // Update calculated start dates and date errors
            const finalDateErrors = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            selectedAssets.forEach(asset => {
                // Get all tasks for this asset (including custom tasks)
                const assetTasks = finalTimeline.filter(task => {
                    // Regular asset tasks
                    if (task.id.startsWith(`${asset.id}-`) && !task.name.includes('Go-Live')) {
                        return true;
                    }
                    // Custom tasks that belong to this asset
                    if (task.isCustom && task.insertAfterTaskId) {
                        const afterTask = finalTimeline.find(t => t.id === task.insertAfterTaskId);
                        if (afterTask && afterTask.id.startsWith(`${asset.id}-`)) {
                            return true;
                        }
                    }
                    return false;
                });
                
                if (assetTasks.length > 0) {
                    // Find the earliest task for this asset
                    const earliestTask = assetTasks.reduce((earliest, task) => {
                        return new Date(task.start) < new Date(earliest.start) ? task : earliest;
                    });
                    
                    // Update calculated start date
                    newCalculatedStartDates[asset.id] = earliestTask.start;
                    
                    // Check if start date is before today
                    if (new Date(earliestTask.start) < today) {
                        finalDateErrors.push(asset.id);
                    }
                }
            });
            
            setCalculatedStartDates(newCalculatedStartDates);
            setDateErrors(finalDateErrors);
            
            // Update the global project start date to reflect the new earliest start date
            const allFinalStartDates = Object.values(newCalculatedStartDates).map(date => new Date(date));
            if (allFinalStartDates.length > 0) {
                const earliestDate = new Date(Math.min(...allFinalStartDates));
                setProjectStartDate(earliestDate.toISOString().split('T')[0]);
            }
        } else {
            setTimelineTasks(allTasks);
            setCalculatedStartDates(newCalculatedStartDates);
            setDateErrors(newDateErrors);
        }
    }, [selectedAssets, globalLiveDate, useGlobalDate, assetLiveDates, csvData, assetTaskDurations, customTaskNames, customTasks]);

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
    // Generate timeline tasks for Gantt chart
    const generateTimelineTasks = (startDates) => {
        if (selectedAssets.length === 0 || Object.keys(startDates).length === 0) {
            setTimelineTasks([]);
            return;
        }

        const allTasks = [];
        let taskIndex = 0;

        selectedAssets.forEach(asset => {
            const assetName = asset.name; // Assuming asset object has a 'name' property
            const assetTasks = csvData.filter(row => row['Asset Type'] === assetName);
            if (assetTasks.length === 0) return;

            // Get the correct live date for this asset
            const liveDate = new Date(useGlobalDate ? globalLiveDate : assetLiveDates[assetName]);
            if (isNaN(liveDate.getTime())) return;

            // We'll build the tasks in reverse (from go-live backwards)
            let currentEndDate = new Date(liveDate);
            const ganttTasks = [];
            let taskIndex = 0;

            // Go-live task (single day)
            ganttTasks.unshift({
                id: `task-${taskIndex}`,
                name: `${assetName}: Go-Live`,
                start: liveDate.toISOString().split('T')[0],
                end: liveDate.toISOString().split('T')[0],
                progress: 0,
            });
            taskIndex++;

            // Process all other tasks in reverse order
            for (let i = assetTasks.length - 1; i >= 0; i--) {
                const taskInfo = assetTasks[i];
                const duration = parseInt(taskInfo['Duration (Days)'], 10) || 1;
                // Subtract working days to get the start date
                const taskStartDate = subtractWorkingDays(currentEndDate, duration);
                // Task ends the working day before currentEndDate
                const taskEndDate = new Date(currentEndDate);
                taskEndDate.setDate(taskEndDate.getDate() - 1);
                // Ensure end date is a working day
                let finalTaskEndDate = new Date(taskEndDate);
                if (isNonWorkingDay(finalTaskEndDate)) {
                    finalTaskEndDate = getPreviousWorkingDay(finalTaskEndDate);
                }
                ganttTasks.unshift({
                    id: `task-${taskIndex}`,
                    name: `${taskInfo['Asset Type']}: ${taskInfo['Task']}`,
                    start: taskStartDate.toISOString().split('T')[0],
                    end: finalTaskEndDate.toISOString().split('T')[0],
                    progress: 0,
                });
                taskIndex++;
                // Update currentEndDate for the next task
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
                if (customTask.insertAfterTaskId) {
                    const afterTaskIndex = allTasks.findIndex(task => task.id === customTask.insertAfterTaskId);
                    if (afterTaskIndex !== -1) {
                        insertIndex = afterTaskIndex + 1;
                    }
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
        executeAction(() => {
            setCustomTaskNames(prev => ({
                ...prev,
                [taskId]: newName
            }));
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
    const handleAddCustomTask = (customTaskData) => {
        const { name, duration, insertAfterTaskId } = customTaskData;
        
        console.log('handleAddCustomTask called with:', customTaskData);
        
        // Create the new custom task
        const newTaskId = `custom-task-${Date.now()}`;
        
        const newTask = {
            id: newTaskId,
            name: `Custom: ${name}`,
            duration: duration,
            insertAfterTaskId: insertAfterTaskId,
            isCustom: true,
            progress: 0
        };
        
        console.log('Created new custom task:', newTask);
        
        // Execute the action and create snapshot with the custom task included
        executeAction(() => {
            // Add to custom tasks - this will trigger the main timeline calculation useEffect
            setCustomTasks(prev => {
                const updated = [...prev, newTask];
                console.log('Updated customTasks:', updated);
                return updated;
            });
            
            // Don't manually insert into timelineTasks here - let the main useEffect handle it
            // This ensures proper timeline recalculation and date adjustments
        }, `Add custom task "${name}"`, newTask);
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
                    {/* Info Box: How to Use This Timeline Builder (moved here, dismissible) */}
                    {showInfoBox && (
                        <div className="relative mb-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900">
                            <button
                                className="absolute top-2 right-2 text-blue-700 hover:text-blue-900 text-lg font-bold focus:outline-none"
                                onClick={() => {
                                    executeAction(() => setShowInfoBox(false), "Hide instructions");
                                }}
                                aria-label="Close instructions"
                            >
                                ×
                            </button>
                            <strong>How to Build Your Campaign Timeline:</strong>
                            <ol className="list-decimal pl-5 mt-2 space-y-1">
                                <li>
                                    <strong>Choose Your Campaign Start Date:</strong><br />
                                    If all assets launch on the same day, set a global start date and check “Use same live date for all assets.”<br />
                                    If assets launch on different days, uncheck the box and set dates individually for each asset.
                                </li>
                                <li>
                                    <strong>Add Assets:</strong><br />
                                    Click “Add” next to each asset type you need.<br />
                                    Need the same asset type more than once? Click “Add” again and give each a unique name.
                                </li>
                                <li>
                                    <strong>Customize Assets:</strong><br />
                                    Rename each asset for clarity (e.g., “Metro Advertorial – August”).<br />
                                    Set or confirm the start date for each asset.
                                </li>
                                <li>
                                    <strong>Review Your Timeline:</strong><br />
                                    Remove any asset you don’t need.<br />
                                    Check the timeline to ensure all assets are scheduled as planned.
                                </li>
                                <li>
                                    <strong>Adjust Your Timeline if Needed:</strong><br />
                                    If an asset’s timeline can’t be completed by the selected start date, you’ll see a warning.<br />
                                    – You can either change the go-live date, or<br />
                                    – Manually shorten the durations of individual tasks (“accordion” your timeline) until the schedule fits.
                                </li>
                                <li>
                                    <strong>Undo/Redo:</strong><br />
                                    Use Ctrl+Z to undo and Ctrl+Y to redo any changes you make.<br />
                                    You can also use the Undo/Redo buttons in the top-right corner.
                                </li>
                            </ol>
                        </div>
                    )}
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
        </div>
    );
};

export default TimelineBuilder;