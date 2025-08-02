import React, { useState } from 'react';

const AssetInstanceEditor = ({
  asset,
  csvData,
  useGlobalDate,
  dateErrors = [],
  onRenameAsset = () => {},
  onAssetStartDateChange = () => {},
  onRemoveAsset = () => {},
  onSaveTaskDurations = () => {},
  getWorkingDaysToSave = () => 0,
  isNonWorkingDay = () => false,
}) => {
  // Check if this asset has a date conflict
  const hasConflict = dateErrors.includes(asset.id);

  // Local state for duration editor
  const [showDurationEditor, setShowDurationEditor] = useState(false);
  const [editedDurations, setEditedDurations] = useState({});
  const [saveConfirmation, setSaveConfirmation] = useState(false);

  // Add a warning if go-live date is a non-working day
  const goLiveDateIsNonWorking = asset.startDate && isNonWorkingDay && isNonWorkingDay(new Date(asset.startDate));

  // Get the list of tasks for this asset type from csvData
  const assetTasks = csvData.filter(row => row['Asset Type'] === asset.type);

  // Initialize durations if opening the editor
  const openDurationEditor = () => {
    const initialDurations = {};
    assetTasks.forEach(task => {
      initialDurations[task['Task']] = parseInt(task['Duration (Days)'], 10) || 1;
    });
    setEditedDurations(initialDurations);
    setShowDurationEditor(true);
  };

  // Handle duration change
  const handleDurationChange = (taskName, value) => {
    setEditedDurations(prev => ({ ...prev, [taskName]: Math.max(1, parseInt(value) || 1) }));
  };

  // Handle Save
  const handleSaveDurations = () => {
    onSaveTaskDurations(asset.id, editedDurations);
    setShowDurationEditor(false);
    setSaveConfirmation(true);
    
    // Clear confirmation after 3 seconds
    setTimeout(() => {
      setSaveConfirmation(false);
    }, 3000);
  };

  // Calculate working days to save for this asset
  const workingDaysToSave = getWorkingDaysToSave(asset.id);

  // Check if asset name has been customized (different from the default type name)
  const isCustomName = asset.name !== asset.type;

  return (
    <div className="border rounded p-3 mb-4 bg-gray-50" style={{ minWidth: 320 }}>
      <div className="flex items-start mb-2">
        <div className="flex flex-col mr-2 flex-1">
          <div className="flex items-center mb-1">
            <label className="text-xs text-gray-600">Asset Name</label>
            {isCustomName && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1 rounded" title="Custom name">
                ✏️ Custom
              </span>
            )}
          </div>
          <input
            type="text"
            value={asset.name}
            onChange={e => onRenameAsset(asset.id, e.target.value)}
            placeholder="Enter asset name..."
            className="text-sm border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="Click to edit asset name"
          />
          <div className="text-xs text-gray-500 mt-1">
            💡 Click to edit - this name will appear in your timeline
          </div>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Go-Live Date</label>
          <input
            type="date"
            value={asset.startDate}
            onChange={e => onAssetStartDateChange(asset.id, e.target.value)}
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={useGlobalDate}
          />
        </div>
      </div>
      {goLiveDateIsNonWorking && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 rounded p-2 mb-2 text-xs">
          ⚠️ The selected go-live date is a weekend or bank holiday. Consider choosing a working day.
        </div>
      )}
      {/* If there is a conflict, show the warning and options */}
      {hasConflict && !showDurationEditor && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-3 mb-2 text-xs">
          <div className="mb-2 font-semibold">
            ⚠️ This asset's timeline can't be completed by the selected start date.
            {workingDaysToSave > 0 && (
              <span className="block mt-1 font-normal text-red-700">
                You need to save <span className="font-bold">{workingDaysToSave}</span> working day{workingDaysToSave !== 1 ? 's' : ''}.
              </span>
            )}
          </div>
          <button
            className="px-2 py-1 bg-blue-500 text-white rounded text-xs mr-2"
            onClick={() => onAssetStartDateChange(asset.id, '')}
          >
            Change Go-Live Date
          </button>
          <span className="mx-2 text-gray-500">or</span>
          <button
            className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs"
            onClick={openDurationEditor}
          >
            I can't change the go-live date
          </button>
        </div>
      )}
      {/* If user can't change go-live date, show manual duration editor */}
      {hasConflict && showDurationEditor && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-900 rounded p-3 mb-2 text-xs">
          <div className="mb-2 font-semibold">Adjust the task durations below to fit the schedule:</div>
          <table className="w-full mb-2">
            <thead>
              <tr>
                <th className="text-left">Task</th>
                <th className="text-left">Duration (days)</th>
              </tr>
            </thead>
            <tbody>
              {assetTasks.map(task => (
                <tr key={task['Task']}>
                  <td>{task['Task']}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={editedDurations[task['Task']] || 1}
                      onChange={e => handleDurationChange(task['Task'], e.target.value)}
                      className="w-16 px-1 py-0.5 border rounded text-xs"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="px-2 py-1 bg-green-500 text-white rounded text-xs mr-2"
            onClick={handleSaveDurations}
          >
            Save
          </button>
          {saveConfirmation && (
            <span className="text-green-600 text-xs ml-2">✅ Saved successfully!</span>
          )}
          <button
            className="px-2 py-1 bg-gray-300 text-gray-800 rounded text-xs"
            onClick={() => setShowDurationEditor(false)}
          >
            Cancel
          </button>
        </div>
      )}
      <button
        className="px-2 py-1 bg-red-500 text-white rounded text-xs mt-2 w-full"
        onClick={() => onRemoveAsset(asset.id)}
      >
        Remove
      </button>
    </div>
  );
};

export default AssetInstanceEditor;
