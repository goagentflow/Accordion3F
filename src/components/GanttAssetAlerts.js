import React, { useState } from 'react';

const GanttAssetAlerts = ({ assetAlerts, workingDaysNeeded }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!assetAlerts || assetAlerts.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold text-red-800">
          ⚠️ Date Conflicts Detected ({assetAlerts.length} {assetAlerts.length === 1 ? 'asset' : 'assets'})
        </h3>
        <button className="text-red-600 hover:text-red-800 transition-colors">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {assetAlerts.map((alert, index) => (
            <div key={index} className="p-3 bg-white rounded border border-red-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-red-700">
                    {alert.assetName}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Tasks end: {alert.calculatedEndDate?.toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Go-live date: {alert.liveDate?.toLocaleDateString()}
                  </p>
                  {/* Removed 'working days after go-live' line per UX request */}
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-500">
                    Total duration: {alert.totalDuration} days
                  </p>
                  <p className="text-gray-500">
                    Working days needed: {alert.daysNeeded}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
            <p className="text-sm text-yellow-800">
              💡 <strong>Tip:</strong> Reduce task durations or move the go-live date later to resolve conflicts.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttAssetAlerts;
