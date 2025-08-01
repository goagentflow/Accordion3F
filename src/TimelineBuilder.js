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

    // Add state to store bank holidays
    const [bankHolidays, setBankHolidays] = useState([]); // Array of YYYY-MM-DD strings

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
            ganttTasks.unshift({
                id: `${asset.id}-go-live`,
                name: `${asset.name}: Go-Live`, // Use custom name
                start: liveDate.toISOString().split('T')[0],
                end: liveDate.toISOString().split('T')[0],
                progress: 0,
            });
            taskIndex++;

            // Process all other tasks in reverse order
            for (let i = assetTasks.length - 1; i >= 0; i--) {
                const taskInfo = assetTasks[i];
                // Use custom duration if present, else default from CSV
                const customDurations = assetTaskDurations[asset.id] || {};
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
                ganttTasks.unshift({
                    id: `${asset.id}-task-${taskIndex}`,
                    name: `${asset.name}: ${taskInfo['Task']}`,
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

        // Integrate custom tasks into the main timeline calculation
        const currentCustomTasks = timelineTasks.filter(task => task.isCustom);
        if (currentCustomTasks.length > 0) {
            setCustomTasks(currentCustomTasks);
            
            // Create a unified timeline that includes both asset tasks and custom tasks
            const unifiedTimeline = [...allTasks];
            
            // Sort custom tasks by their original insertion order
            const sortedCustomTasks = [...currentCustomTasks].sort((a, b) => {
                const aIndex = timelineTasks.findIndex(task => task.id === a.id);
                const bIndex = timelineTasks.findIndex(task => task.id === b.id);
                return aIndex - bIndex;
            });
            
            // Insert custom tasks at their correct positions in the unified timeline
            sortedCustomTasks.forEach(customTask => {
                let insertIndex = 0;
                if (customTask.insertAfterTaskId) {
                    const afterTaskIndex = unifiedTimeline.findIndex(task => task.id === customTask.insertAfterTaskId);
                    if (afterTaskIndex !== -1) {
                        insertIndex = afterTaskIndex + 1;
                    }
                }
                
                // Calculate the custom task dates based on the current unified timeline
                let newTaskStartDate;
                if (insertIndex === 0) {
                    // Insert at the beginning
                    newTaskStartDate = new Date(projectStartDate);
                } else {
                    // Insert after another task
                    const previousTask = unifiedTimeline[insertIndex - 1];
                    const previousTaskEnd = new Date(previousTask.end);
                    newTaskStartDate = new Date(previousTaskEnd);
                    newTaskStartDate.setDate(newTaskStartDate.getDate() + 1);
                    
                    // Ensure the start date is a working day
                    while (isNonWorkingDay(newTaskStartDate)) {
                        newTaskStartDate.setDate(newTaskStartDate.getDate() + 1);
                    }
                }
                
                // Calculate the end date based on duration (inclusive)
                let newTaskEndDate = new Date(newTaskStartDate);
                let newTaskRemainingDays = customTask.duration - 1;
                
                while (newTaskRemainingDays > 0) {
                    newTaskEndDate.setDate(newTaskEndDate.getDate() + 1);
                    if (!isNonWorkingDay(newTaskEndDate)) {
                        newTaskRemainingDays--;
                    }
                }
                
                // Create the custom task with recalculated dates
                const newCustomTask = {
                    ...customTask,
                    id: customTask.id,
                    name: customTask.name,
                    duration: customTask.duration,
                    start: newTaskStartDate.toISOString().split('T')[0],
                    end: newTaskEndDate.toISOString().split('T')[0],
                    isCustom: true
                };
                
                // Insert the custom task into the unified timeline
                unifiedTimeline.splice(insertIndex, 0, newCustomTask);
            });
            
            // After inserting custom tasks, rebuild the timeline backwards from go-live
            // This preserves the fixed go-live date and respects manual duration overrides
            const finalTimeline = [];
            
            // Group tasks by asset to maintain the backwards calculation
            const tasksByAsset = {};
            unifiedTimeline.forEach(task => {
                if (task.isCustom) {
                    // Custom tasks will be inserted at their specified positions
                    if (!tasksByAsset.custom) tasksByAsset.custom = [];
                    tasksByAsset.custom.push(task);
                } else {
                    // Asset tasks are grouped by their asset ID
                    const assetId = task.id.split('-')[0];
                    if (!tasksByAsset[assetId]) tasksByAsset[assetId] = [];
                    tasksByAsset[assetId].push(task);
                }
            });
            
            // Rebuild each asset's timeline backwards from go-live
            selectedAssets.forEach(asset => {
                const assetTasks = tasksByAsset[asset.id] || [];
                if (assetTasks.length === 0) return;
                
                // Separate go-live task from other tasks
                const goLiveTask = assetTasks.find(task => task.name.includes('Go-Live'));
                const regularTasks = assetTasks.filter(task => !task.name.includes('Go-Live'));
                
                // Build backwards from go-live to calculate dates
                let currentEndDate = new Date(asset.startDate);
                const calculatedTasks = [];
                
                // Calculate dates for regular tasks in reverse order (backwards from go-live)
                for (let i = regularTasks.length - 1; i >= 0; i--) {
                    const task = regularTasks[i];
                    const taskInfo = csvData.find(row => 
                        row['Asset Type'] === asset.type && 
                        row['Task'] === task.name.split(': ')[1]
                    );
                    
                    // Use manual duration override if available
                    const customDurations = assetTaskDurations[asset.id] || {};
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
            
            // Now rebuild the entire timeline with custom tasks, ALWAYS anchored to the fixed go-live date
            const allTasksSequential = [];
            
            // Process each asset with its custom tasks
            selectedAssets.forEach(asset => {
                const assetTasks = tasksByAsset[asset.id] || [];
                const customTasksForAsset = customTasks.filter(ct => {
                    // Find which asset this custom task belongs to based on insertAfterTaskId
                    if (ct.insertAfterTaskId) {
                        const afterTask = assetTasks.find(task => task.id === ct.insertAfterTaskId);
                        return afterTask !== undefined;
                    }
                    return false;
                });
                
                // Separate go-live task from regular tasks
                const goLiveTask = assetTasks.find(task => task.name.includes('Go-Live'));
                const regularTasks = assetTasks.filter(task => !task.name.includes('Go-Live'));
                
                // Create ordered task list for this asset (including custom tasks)
                const orderedTasks = [];
                
                // Add regular tasks in their original order
                regularTasks.forEach((task, index) => {
                    orderedTasks.push(task);
                    
                    // Insert custom tasks that should go after this task
                    const customTasksAfterThis = customTasksForAsset.filter(ct => 
                        ct.insertAfterTaskId === task.id
                    );
                    orderedTasks.push(...customTasksAfterThis);
                });
                
                // Add go-live task at the end
                if (goLiveTask) {
                    orderedTasks.push(goLiveTask);
                }
                
                // CRITICAL: Always start from the FIXED go-live date
                const fixedGoLiveDate = new Date(asset.startDate);
                let currentEndDate = new Date(fixedGoLiveDate);
                const assetTimeline = [];
                
                // Process tasks in reverse order (backwards from go-live)
                for (let i = orderedTasks.length - 1; i >= 0; i--) {
                    const task = orderedTasks[i];
                    
                    if (task.isCustom) {
                        // Custom task - calculate backwards from current position
                        const taskStartDate = subtractWorkingDays(currentEndDate, task.duration);
                        const taskEndDate = new Date(currentEndDate);
                        taskEndDate.setDate(taskEndDate.getDate() - 1);
                        
                        // Ensure end date is a working day
                        let finalTaskEndDate = new Date(taskEndDate);
                        if (isNonWorkingDay(finalTaskEndDate)) {
                            finalTaskEndDate = getPreviousWorkingDay(finalTaskEndDate);
                        }
                        
                        assetTimeline.unshift({
                            ...task,
                            start: taskStartDate.toISOString().split('T')[0],
                            end: finalTaskEndDate.toISOString().split('T')[0]
                        });
                        
                        currentEndDate = new Date(taskStartDate);
                    } else if (task.name.includes('Go-Live')) {
                        // Go-live task - ALWAYS on the fixed go-live date
                        assetTimeline.unshift({
                            ...task,
                            start: fixedGoLiveDate.toISOString().split('T')[0],
                            end: fixedGoLiveDate.toISOString().split('T')[0]
                        });
                        // Don't update currentEndDate for go-live task
                    } else {
                        // Regular asset task - calculate backwards
                        const taskInfo = csvData.find(row => 
                            row['Asset Type'] === asset.type && 
                            row['Task'] === task.name.split(': ')[1]
                        );
                        
                        // Use manual duration override if available
                        const customDurations = assetTaskDurations[asset.id] || {};
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
                        
                        assetTimeline.unshift({
                            ...task,
                            start: taskStartDate.toISOString().split('T')[0],
                            end: finalTaskEndDate.toISOString().split('T')[0]
                        });
                        
                        currentEndDate = new Date(taskStartDate);
                    }
                }
                
                // Add this asset's timeline to the main timeline
                allTasksSequential.push(...assetTimeline);
            });
            
            // Update the final timeline
            finalTimeline.length = 0;
            finalTimeline.push(...allTasksSequential);
            
            setTimelineTasks(finalTimeline);
            
            // Recalculate dateErrors based on the final timeline
            const finalDateErrors = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            selectedAssets.forEach(asset => {
                const assetTasks = finalTimeline.filter(task => 
                    task.id.startsWith(`${asset.id}-`) && !task.name.includes('Go-Live')
                );
                
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
        } else {
            setTimelineTasks(allTasks);
            setCalculatedStartDates(newCalculatedStartDates);
            setDateErrors(newDateErrors);
        }
    }, [selectedAssets, globalLiveDate, useGlobalDate, assetLiveDates, csvData, assetTaskDurations]);
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
    if (useGlobalDate && globalLiveDate) {
        setSelectedAssets(prev =>
            prev.map(asset =>
                asset.startDate !== globalLiveDate
                    ? { ...asset, startDate: globalLiveDate }
                    : asset
            )
        );
    }
    // Optionally, if unchecked, you could clear the dates or leave as-is
}, [useGlobalDate, globalLiveDate]);

    // Preserve custom tasks whenever timelineTasks changes
    useEffect(() => {
        const currentCustomTasks = timelineTasks.filter(task => task.isCustom);
        if (currentCustomTasks.length > 0) {
            setCustomTasks(currentCustomTasks);
        }
    }, [timelineTasks]);

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
        const newAsset = {
            id: generateAssetId(),
            type: assetType,
            name: assetType, // default name, can be edited later
            startDate: useGlobalDate && globalLiveDate ? globalLiveDate : ''
        };
        setSelectedAssets(prev => [...prev, newAsset]);
    };

    // Remove an asset instance by id
    const handleRemoveAsset = (assetId) => {
        setSelectedAssets(prev => prev.filter(asset => asset.id !== assetId));
    };

    // Handler to rename an asset instance by id
    const handleRenameAsset = (assetId, newName) => {
        setSelectedAssets(prev =>
            prev.map(asset =>
                asset.id === assetId ? { ...asset, name: newName } : asset
            )
        );
    };

    const handleAssetLiveDateChange = (assetName, date) => {
        setAssetLiveDates(prev => ({
            ...prev,
            [assetName]: date
        }));
    };

    const handleAssetStartDateChange = (assetId, newDate) => {
        setSelectedAssets(prev =>
            prev.map(asset =>
                asset.id === assetId ? { ...asset, startDate: newDate } : asset
            )
        );
    };

    // Handler to save custom task durations for an asset
    const handleSaveTaskDurations = (assetId, durations) => {
        setAssetTaskDurations(prev => ({ ...prev, [assetId]: durations }));
        
        // Preserve custom tasks before timeline recalculation
        const currentCustomTasks = timelineTasks.filter(task => task.isCustom);
        setCustomTasks(currentCustomTasks);
    };

    // Handler for drag-to-resize task duration
    const handleTaskDurationChange = (taskId, newDuration, newEndDate) => {
        // Find the task being modified
        const taskIndex = timelineTasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) return;

        // Extract asset ID and task name from the task ID
        const assetId = taskId.split('-task-')[0];
        const taskName = timelineTasks[taskIndex].name.split(': ')[1]; // Get task name after the colon
        
        // Update the assetTaskDurations state to trigger the same recalculation logic
        // that the manual duration editing uses
        setAssetTaskDurations(prev => {
            const currentDurations = prev[assetId] || {};
            return {
                ...prev,
                [assetId]: {
                    ...currentDurations,
                    [taskName]: newDuration
                }
            };
        });
    };

    // Handler for adding custom tasks
    const handleAddCustomTask = (customTaskData) => {
        const { name, duration, insertAfterTaskId } = customTaskData;
        
        // Find the index where to insert the new task
        let insertIndex = 0;
        if (insertAfterTaskId) {
            const afterTaskIndex = timelineTasks.findIndex(task => task.id === insertAfterTaskId);
            if (afterTaskIndex !== -1) {
                insertIndex = afterTaskIndex + 1;
            }
        }
        
        // Calculate how much the project duration will increase
        const goLiveDate = new Date(globalLiveDate);
        const currentProjectEnd = new Date(Math.max(...timelineTasks.map(task => new Date(task.end))));
        
        // Calculate the new project end date by adding the custom task duration
        let newProjectEnd = new Date(currentProjectEnd);
        let remainingDays = duration;
        
        while (remainingDays > 0) {
            newProjectEnd.setDate(newProjectEnd.getDate() + 1);
            if (!isNonWorkingDay(newProjectEnd)) {
                remainingDays--;
            }
        }
        
        // Calculate how many working days the project duration increased
        const durationIncrease = countWorkingDays(currentProjectEnd, newProjectEnd);
        
        // Move the project start date earlier by the duration increase
        const newProjectStartDate = subtractWorkingDays(new Date(projectStartDate), durationIncrease);
        
        // Create the new task
        const newTaskId = `custom-task-${Date.now()}`;
        let newTaskStartDate;
        
        if (insertIndex === 0) {
            // Insert at the beginning - start on the new project start date
            newTaskStartDate = new Date(newProjectStartDate);
        } else {
            // Insert after another task - calculate position relative to new timeline
            const previousTask = timelineTasks[insertIndex - 1];
            const previousTaskEnd = new Date(previousTask.end);
            newTaskStartDate = new Date(previousTaskEnd);
            newTaskStartDate.setDate(newTaskStartDate.getDate() + 1);
            
            // Ensure the start date is a working day
            while (isNonWorkingDay(newTaskStartDate)) {
                newTaskStartDate.setDate(newTaskStartDate.getDate() + 1);
            }
        }
        
        // Calculate the end date based on duration (inclusive)
        let newTaskEndDate = new Date(newTaskStartDate);
        let newTaskRemainingDays = duration - 1; // -1 because we count the start date
        
        while (newTaskRemainingDays > 0) {
            newTaskEndDate.setDate(newTaskEndDate.getDate() + 1);
            if (!isNonWorkingDay(newTaskEndDate)) {
                newTaskRemainingDays--;
            }
        }
        
        const newTask = {
            id: newTaskId,
            name: `Custom: ${name}`,
            start: newTaskStartDate.toISOString().split('T')[0],
            end: newTaskEndDate.toISOString().split('T')[0],
            progress: 0,
            isCustom: true,
            insertAfterTaskId: insertAfterTaskId,
            duration: duration
        };
        
        // Store the custom task separately
        setCustomTasks(prev => [...prev, newTask]);
        
        // Insert the new task into current timeline
        const updatedTasks = [...timelineTasks];
        updatedTasks.splice(insertIndex, 0, newTask);
        
        // Recalculate all task dates to fit within the new timeline
        // Start from the beginning and work forward
        for (let i = 0; i < updatedTasks.length; i++) {
            const currentTask = updatedTasks[i];
            
            if (i === 0) {
                // First task starts on the new project start date
                const taskStart = new Date(newProjectStartDate);
                let taskEnd = new Date(taskStart);
                
                // Calculate task duration inclusively
                const originalStart = new Date(currentTask.start);
                const originalEnd = new Date(currentTask.end);
                let taskDuration = 0;
                const current = new Date(originalStart);
                const end = new Date(originalEnd);
                
                while (current <= end) {
                    if (!isNonWorkingDay(current)) {
                        taskDuration++;
                    }
                    current.setDate(current.getDate() + 1);
                }
                
                // Calculate end date
                let taskRemainingDays = taskDuration - 1;
                while (taskRemainingDays > 0) {
                    taskEnd.setDate(taskEnd.getDate() + 1);
                    if (!isNonWorkingDay(taskEnd)) {
                        taskRemainingDays--;
                    }
                }
                
                updatedTasks[i] = {
                    ...currentTask,
                    start: taskStart.toISOString().split('T')[0],
                    end: taskEnd.toISOString().split('T')[0]
                };
            } else {
                // Subsequent tasks start after the previous task ends
                const previousTask = updatedTasks[i - 1];
                const previousTaskEnd = new Date(previousTask.end);
                let taskStart = new Date(previousTaskEnd);
                taskStart.setDate(taskStart.getDate() + 1);
                
                // Ensure the start date is a working day
                while (isNonWorkingDay(taskStart)) {
                    taskStart.setDate(taskStart.getDate() + 1);
                }
                
                // Calculate task duration inclusively
                const originalStart = new Date(currentTask.start);
                const originalEnd = new Date(currentTask.end);
                let taskDuration = 0;
                const current = new Date(originalStart);
                const end = new Date(originalEnd);
                
                while (current <= end) {
                    if (!isNonWorkingDay(current)) {
                        taskDuration++;
                    }
                    current.setDate(current.getDate() + 1);
                }
                
                // Calculate end date
                let taskEnd = new Date(taskStart);
                let taskRemainingDays = taskDuration - 1;
                while (taskRemainingDays > 0) {
                    taskEnd.setDate(taskEnd.getDate() + 1);
                    if (!isNonWorkingDay(taskEnd)) {
                        taskRemainingDays--;
                    }
                }
                
                updatedTasks[i] = {
                    ...currentTask,
                    start: taskStart.toISOString().split('T')[0],
                    end: taskEnd.toISOString().split('T')[0]
                };
            }
        }
        
        setTimelineTasks(updatedTasks);
        
        // Update project start date
        setProjectStartDate(newProjectStartDate.toISOString().split('T')[0]);
        
        // Recalculate calculated start dates for each asset
        const newCalculatedStartDates = {};
        const assetGroups = {};
        
        // Group tasks by asset ID
        updatedTasks.forEach(task => {
            if (!task.isCustom) { // Only group non-custom tasks
                const assetId = task.id.split('-task-')[0];
                if (!assetGroups[assetId]) {
                    assetGroups[assetId] = [];
                }
                assetGroups[assetId].push(task);
            }
        });
        
        // Find the earliest start date for each asset
        Object.keys(assetGroups).forEach(assetId => {
            const assetTasks = assetGroups[assetId];
            const startDates = assetTasks.map(task => new Date(task.start));
            const earliestDate = new Date(Math.min(...startDates));
            newCalculatedStartDates[assetId] = earliestDate.toISOString().split('T')[0];
        });
        
        setCalculatedStartDates(newCalculatedStartDates);
        
        // Recalculate date errors
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newDateErrors = [];
        
        // Check each selected asset's calculated start date
        selectedAssets.forEach(asset => {
            const calculatedStartDate = newCalculatedStartDates[asset.id];
            if (calculatedStartDate) {
                const startDate = new Date(calculatedStartDate);
                if (startDate < today) {
                    newDateErrors.push(asset.id);
                }
            }
        });
        
        setDateErrors(newDateErrors);
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
                    <h1 className="text-3xl font-bold text-gray-800">Accordion Timeline Builder</h1>
                    {/* Info Box: How to Use This Timeline Builder (moved here, dismissible) */}
                    {showInfoBox && (
                        <div className="relative mb-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900">
                            <button
                                className="absolute top-2 right-2 text-blue-700 hover:text-blue-900 text-lg font-bold focus:outline-none"
                                onClick={() => setShowInfoBox(false)}
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
                            onGlobalLiveDateChange={setGlobalLiveDate}
                            useGlobalDate={useGlobalDate}
                            onUseGlobalDateChange={setUseGlobalDate}
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
                                workingDaysNeeded={calculateWorkingDaysNeeded()}
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