import React, { useMemo } from 'react';
import DatePicker from 'react-datepicker';
import { isSundayOnlyAsset } from './ganttUtils';

const AssetInstanceEditor = ({
  asset,
  csvData,
  useGlobalDate,
  dateErrors = [],
  sundayDateErrors = [],
  onRenameAsset = () => {},
  onAssetStartDateChange = () => {},
  onRemoveAsset = () => {},
  onSaveTaskDurations = () => {},
  getWorkingDaysToSave = () => 0,
  isNonWorkingDay = () => false,
}) => {
  // Check if this asset has a date conflict
  const hasConflict = dateErrors.includes(asset.id);
  // Check if this asset has a Sunday validation error
  const hasSundayError = sundayDateErrors.includes(asset.id);

  // Add a warning if go-live date is a non-working day
  // BUT don't warn about Sundays for Sunday-only assets (they SHOULD be on Sunday)
  const goLiveDateIsNonWorking = asset.startDate && isNonWorkingDay && isNonWorkingDay(new Date(asset.startDate)) &&
    !(isSundayOnlyAsset(asset.type) && new Date(asset.startDate).getDay() === 0);

  // Get the list of tasks for this asset type from csvData (no duration editing here)
  const assetTasks = csvData.filter(row => row['Asset Type'] === asset.type);

  // Calculate working days to save for this asset (from shared selectors)
  const workingDaysToSave = getWorkingDaysToSave(asset.id);

  // Helpers to compute draft remaining days without committing changes
  const subtractWorkingDays = (date, days) => {
    if (!date || isNaN(date.getTime())) return new Date();
    let d = new Date(date);
    let remaining = Math.max(0, days);
    let guard = 0;
    while (remaining > 0 && guard < 5000) {
      d.setDate(d.getDate() - 1);
      if (!isNonWorkingDay || !isNonWorkingDay(new Date(d))) {
        remaining--;
      }
      guard++;
    }
    // Ensure we land on a working day
    guard = 0;
    while (isNonWorkingDay && isNonWorkingDay(new Date(d)) && guard < 100) {
      d.setDate(d.getDate() - 1);
      guard++;
    }
    return d;
  };

  const workingDaysBetween = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (s >= e) return 0;
    let wd = 0;
    const cur = new Date(s);
    let guard = 0;
    while (cur < e && guard < 10000) {
      if (!isNonWorkingDay || !isNonWorkingDay(new Date(cur))) {
        wd++;
      }
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
    return wd;
  };

  // No local draft duration editing; all duration changes happen in the Gantt
  const draftDaysToSave = useMemo(() => workingDaysToSave, [workingDaysToSave]);

  // Check if asset name has been customized (different from the default type name)
  const isCustomName = asset.name !== asset.type;

  return (
    <div className="border rounded p-3 mb-4 bg-gray-50" style={{ minWidth: 320 }} data-testid={`asset-${asset.id}`}>
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
            data-testid={`asset-name-input-${asset.id}`}
          />
          <div className="text-xs text-gray-500 mt-1">
            💡 Click to edit - this name will appear in your timeline
          </div>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-600 mb-1">Go-Live Date</label>
          <DatePicker
            selected={asset.startDate ? new Date(asset.startDate) : null}
            onChange={date => onAssetStartDateChange(asset.id, date ? date.toISOString().split('T')[0] : '')}
            dateFormat="yyyy-MM-dd"
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
            disabled={useGlobalDate}
            data-testid={`asset-live-date-${asset.id}`}
            placeholderText="Select date"
            filterDate={isSundayOnlyAsset(asset.type) ? date => date.getDay() === 0 : undefined}
          />
        </div>
      </div>
      {goLiveDateIsNonWorking && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 rounded p-2 mb-2 text-xs">
          ⚠️ {isSundayOnlyAsset(asset.type) && asset.startDate && new Date(asset.startDate).getDay() === 6 
            ? 'This asset requires Sunday, not Saturday.' 
            : 'The selected go-live date is a weekend or bank holiday. Consider choosing a working day.'
          }
        </div>
      )}
      {/* Sunday validation error for supplement assets */}
      {hasSundayError && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded p-3 mb-2 text-xs">
          <div className="flex items-start">
            <span className="text-red-500 mr-2 text-lg">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold mb-1">Sunday Go-Live Required</p>
              <p className="mb-2">
                Print Supplements must go live on a Sunday, but you're using a global date that falls on a {' '}
                {new Date(asset.startDate || '').toLocaleDateString('en-GB', { weekday: 'long' })}.
              </p>
              <p className="text-xs font-medium">
                Switch to individual dates and select a Sunday for this asset.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* If there is a conflict, show the warning and options */}
      {hasConflict && (
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
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent('focus-asset-in-gantt', { detail: { assetId: asset.id } }));
              } catch {}
            }}
          >
            Adjust task durations in the Gantt chart
          </button>
        </div>
      )}
      <button
        className="px-2 py-1 bg-red-500 text-white rounded text-xs mt-2 w-full"
        onClick={() => onRemoveAsset(asset.id)}
        data-testid={`remove-asset-${asset.id}`}
      >
        Remove
      </button>
    </div>
  );
};

export default AssetInstanceEditor;
