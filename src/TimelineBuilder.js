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

    // Helper function to check if date is weekend
    const isWeekend = (date) => {
        const day = date.getDay();
        return day === 0 || day === 6; // Sunday = 0, Saturday = 6
    };

    // Helper function to get previous working day
    const getPreviousWorkingDay = (date) => {
        let workingDate = new Date(date);
        do {
            workingDate.setDate(workingDate.getDate() - 1);
        } while (isWeekend(workingDate));
        return workingDate;
    };

    // Helper function to get next working day
    const getNextWorkingDay = (date) => {
        let workingDate = new Date(date);
        do {
            workingDate.setDate(workingDate.getDate() + 1);
        } while (isWeekend(workingDate));
        return workingDate;
    };

    // Helper function to subtract working days (backwards calculation)
    const subtractWorkingDays = (endDate, workingDaysToSubtract) => {
        let currentDate = new Date(endDate);
        let remainingDays = workingDaysToSubtract;
        
        // Subtract working days
        while (remainingDays > 0) {
            currentDate.setDate(currentDate.getDate() - 1);
            
            // Only count non-weekend days
            if (!isWeekend(currentDate)) {
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
    let remainingDays = workingDaysToAdd -1;

    while (remainingDays > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (!isWeekend(currentDate)) {
            remainingDays--;
        }
    }

    // Ensure the final day is a working day
    while (isWeekend(currentDate)) {
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
                if (isWeekend(finalTaskEndDate)) {
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

        setTimelineTasks(allTasks);
        setCalculatedStartDates(newCalculatedStartDates);
        setDateErrors(newDateErrors);
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
                if (isWeekend(finalTaskEndDate)) {
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
        setCalculatedStartDates(newCalculatedStartDates);
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
                            <GanttChart tasks={timelineTasks} />
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