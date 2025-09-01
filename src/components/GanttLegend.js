import React from 'react';

const GanttLegend = React.memo(() => {
  return (
    <div className="flex items-center justify-center py-2 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-orange-500 rounded"></div>
          <span>Client Action</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span>MMM Action</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-purple-500 rounded"></div>
          <span>Client/Agency Action</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span>Live Date</span>
        </div>
      </div>
    </div>
  );
});

GanttLegend.displayName = 'GanttLegend';

export default GanttLegend;