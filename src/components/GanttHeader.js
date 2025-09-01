import React from 'react';
import { GANTT_CONFIG, getColumnBackground, isBankHoliday } from './ganttUtils';

const GanttHeader = React.memo(({ dateColumns, bankHolidays }) => {
  // Array of day abbreviations
  const dayAbbr = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];

  return (
    <div className="flex" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
      {/* Top-left cell: Task Name header */}
      <div
        className="p-3 border-b border-r border-gray-300 font-semibold text-gray-700 bg-white flex items-center"
        style={{
          width: `${GANTT_CONFIG.TASK_NAME_WIDTH}px`,
          minWidth: `${GANTT_CONFIG.TASK_NAME_WIDTH}px`,
          position: 'sticky',
          left: 0,
          top: 0,
          zIndex: 40,
          background: 'white',
        }}
      >
        Task Name
      </div>
      
      {/* Date headers */}
      {dateColumns.map((date, index) => {
        const day = dayAbbr[date.getDay()];
        const dayOfMonth = date.getDate();
        const month = date.toLocaleString('en', { month: 'short' });
        const formatted = `${day} ${dayOfMonth} ${month}`;
        
        return (
          <div
            key={index}
            className={`p-1 text-xs text-center border-b border-r border-gray-200 flex flex-col justify-center ${getColumnBackground(date, bankHolidays)}`}
            style={{
              width: `${GANTT_CONFIG.DAY_COLUMN_WIDTH}px`,
              minWidth: `${GANTT_CONFIG.DAY_COLUMN_WIDTH}px`,
              position: 'sticky',
              top: 0,
              zIndex: 30,
              background: 'white',
            }}
          >
            <div className="font-medium">
              {formatted}
              {isBankHoliday(date, bankHolidays) && (
                <span className="ml-1 text-red-500" title="Bank Holiday">🏦</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render when dateColumns or bankHolidays change
  return (
    prevProps.dateColumns.length === nextProps.dateColumns.length &&
    prevProps.bankHolidays.length === nextProps.bankHolidays.length &&
    prevProps.dateColumns[0]?.getTime() === nextProps.dateColumns[0]?.getTime() &&
    prevProps.dateColumns[prevProps.dateColumns.length - 1]?.getTime() === 
      nextProps.dateColumns[nextProps.dateColumns.length - 1]?.getTime()
  );
});

GanttHeader.displayName = 'GanttHeader';

export default GanttHeader;