import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import AssetSelector from './components/AssetSelector';
import CampaignSetup from './components/CampaignSetup';
import GanttChart from './components/GanttChart';

const TimelineBuilder = () => {
    // CSV and asset data
    const [csvData, setCsvData] = useState([]);
    const [uniqueAssets, setUniqueAssets] = useState([]);
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

        // Calculate for each selected asset
        selectedAssets.forEach(assetName => {
    // Determine the correct live date without the incorrect fallback
    const liveDate = useGlobalDate ? globalLiveDate : assetLiveDates[assetName];
    
    // If no date is available for this asset, skip it
    if (!liveDate) return;

            // Get tasks for this asset
            const assetTasks = csvData.filter(row => row['Asset Type'] === assetName);
            
            if (assetTasks.length === 0) return;

            // Work backwards through tasks sequentially
            let currentEndDate = new Date(liveDate);
            
            // Process tasks in reverse order (last task ends on live date)
            for (let i = assetTasks.length - 1; i >= 0; i--) {
                const task = assetTasks[i];
                const duration = parseInt(task['Duration (Days)'], 10) || 1;
                
                // Calculate when this task must start
                const taskStartDate = subtractWorkingDays(currentEndDate, duration);
                
                // Next task ends the working day before this task starts
                currentEndDate = new Date(taskStartDate);
                currentEndDate.setDate(currentEndDate.getDate() - 1);
                
                // Ensure end date is a working day
                if (isWeekend(currentEndDate)) {
                    currentEndDate = getPreviousWorkingDay(currentEndDate);
                }
            }
            
            // The project start date is the day after the last calculated end date
            let calculatedStart = new Date(currentEndDate);
            calculatedStart.setDate(calculatedStart.getDate() + 1);
            
            // Ensure start date is a working day
            if (isWeekend(calculatedStart)) {
                calculatedStart = getNextWorkingDay(calculatedStart);
            }
            
            const calculatedStartDate = calculatedStart.toISOString().split('T')[0];
            newCalculatedStartDates[assetName] = calculatedStartDate;
            allStartDates.push(new Date(calculatedStartDate));
            
            // Check if start date is before today
            if (calculatedStart < today) {
                newDateErrors.push(assetName);
            }
        });

        // Find earliest start date across all assets
        if (allStartDates.length > 0) {
            const earliestDate = new Date(Math.min(...allStartDates));
            setProjectStartDate(earliestDate.toISOString().split('T')[0]);
        }

        setCalculatedStartDates(newCalculatedStartDates);
        setDateErrors(newDateErrors);

        // Generate timeline tasks for display
        generateTimelineTasks(newCalculatedStartDates);

    }, [selectedAssets, globalLiveDate, useGlobalDate, assetLiveDates, csvData]);
// This new useEffect pre-populates individual dates when switching from global mode
    useEffect(() => {
        if (!useGlobalDate && globalLiveDate && selectedAssets.length > 0) {
            const newLiveDates = { ...assetLiveDates };
            let updated = false;
            selectedAssets.forEach(asset => {
                // Pre-fill only if the asset doesn't have an individual date set
                if (!newLiveDates[asset]) {
                    newLiveDates[asset] = globalLiveDate;
                    updated = true;
                }
            });
            if (updated) {
                setAssetLiveDates(newLiveDates);
            }
        }
    }, [useGlobalDate, globalLiveDate, selectedAssets, assetLiveDates]);
    // Generate timeline tasks for Gantt chart
    const generateTimelineTasks = (startDates) => {
        if (selectedAssets.length === 0 || Object.keys(startDates).length === 0) {
            setTimelineTasks([]);
            return;
        }

        const allTasks = [];
        let taskIndex = 0;

        selectedAssets.forEach(assetName => {
            const startDate = startDates[assetName];
            if (!startDate) return;

            const assetTasks = csvData.filter(row => row['Asset Type'] === assetName);
            let currentStartDate = new Date(startDate);

            // Ensure project starts on working day
            if (isWeekend(currentStartDate)) {
                currentStartDate = getNextWorkingDay(currentStartDate);
            }

            assetTasks.forEach((taskInfo, idx) => {
                const duration = parseInt(taskInfo['Duration (Days)'], 10) || 1;
                let taskStart, taskEnd;

                if (idx === assetTasks.length - 1) {
                    // Last task: set both start and end to the live date
                    const liveDate = new Date(useGlobalDate ? globalLiveDate : assetLiveDates[assetName]);
                    taskStart = new Date(liveDate);
                    taskEnd = new Date(liveDate);
                } else {
                    taskStart = new Date(currentStartDate);
                    taskEnd = addWorkingDays(taskStart, duration);
                }

                const ganttTask = {
                    id: `task-${taskIndex}`,
                    name: `${taskInfo['Asset Type']}: ${taskInfo['Task']}`,
                    start: taskStart.toISOString().split('T')[0],
                    end: taskEnd.toISOString().split('T')[0],
                    progress: 0,
                };

                allTasks.push(ganttTask);
                taskIndex++;

                // Move to next start date (day after current task ends)
                currentStartDate = new Date(taskEnd);
                currentStartDate.setDate(taskEnd.getDate() + 1);

                // Ensure next start date is working day
                if (isWeekend(currentStartDate)) {
                    currentStartDate = getNextWorkingDay(currentStartDate);
                }
            });
        });

        setTimelineTasks(allTasks);
    };

    const handleAssetToggle = (asset) => {
        setSelectedAssets(prev => 
            prev.includes(asset) 
                ? prev.filter(a => a !== asset)
                : [...prev, asset]
        );
    };

    const handleAssetLiveDateChange = (assetName, date) => {
        setAssetLiveDates(prev => ({
            ...prev,
            [assetName]: date
        }));
    };

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <header className="bg-white shadow-md">
                <div className="container mx-auto px-6 py-4">
                    <h1 className="text-3xl font-bold text-gray-800">Accordion Timeline Builder</h1>
                </div>
            </header>
            <main className="container mx-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: CONTROLS */}
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
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
    onAssetToggle={handleAssetToggle}
    useGlobalDate={useGlobalDate} // <-- CORRECTED LINE
    globalLiveDate={globalLiveDate || ''}
    assetLiveDates={assetLiveDates || {}}
    onAssetLiveDateChange={handleAssetLiveDateChange}
    calculatedStartDates={calculatedStartDates || {}}
    dateErrors={dateErrors || []}
/>
                    </div>
                    
                    {/* RIGHT COLUMN: TIMELINE */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
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