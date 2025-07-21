import React from 'react';

const GanttChart = ({ tasks }) => {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10">
        <p className="text-lg">Your timeline will appear here.</p>
        <p className="text-sm">Set a start date and select some assets to begin.</p>
      </div>
    );
  }

  // --- CONFIGURATION ---
  const DAY_COLUMN_WIDTH = 48; // 48px per day. Adjust if needed.
  const ROW_HEIGHT = 80; // The height of each task row in pixels.
  const HEADER_HEIGHT = 50; // Height of the date header.
  const TASK_NAME_WIDTH = 320; // Corresponds to Tailwind's w-80.

  // --- DATE CALCULATIONS ---
  const startDates = tasks.map(task => new Date(task.start));
  const endDates = tasks.map(task => new Date(task.end));
  const minDate = new Date(Math.min(...startDates));
  const maxDate = new Date(Math.max(...endDates));
  
  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;

  const dateColumns = Array.from({ length: totalDays }, (_, i) => {
    const date = new Date(minDate);
    date.setDate(minDate.getDate() + i);
    return date;
  });

  return (
    <div className="w-full">
      {/* Summary Header */}
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800">Project Gantt Chart</h3>
        <p className="text-sm text-blue-600">
          {tasks.length} tasks • {totalDays} days total • {minDate.toLocaleDateString()} to {maxDate.toLocaleDateString()}
        </p>
      </div>

      {/* Main Scrollable Container */}
      <div className="overflow-auto border border-gray-300 rounded-lg" style={{ maxHeight: '75vh' }}>
        {/* Grid Container */}
        <div className="relative">
          {/* STICKY HEADER */}
          <div 
            className="flex sticky top-0 z-20 bg-gray-100"
            style={{ height: `${HEADER_HEIGHT}px` }}
          >
            {/* Top-Left Corner Box */}
            <div 
              className="sticky left-0 z-10 p-3 border-b border-r border-gray-300 font-semibold text-gray-700 bg-gray-50 flex items-center" 
              style={{ width: `${TASK_NAME_WIDTH}px`, minWidth: `${TASK_NAME_WIDTH}px` }}
            >
              Task Name
            </div>
            {/* Date Columns Header */}
            {dateColumns.map((date, index) => (
              <div 
                key={index} 
                className="p-1 text-xs text-center border-b border-r border-gray-200 flex flex-col justify-center" 
                style={{ width: `${DAY_COLUMN_WIDTH}px`, minWidth: `${DAY_COLUMN_WIDTH}px` }}
              >
                <div className="font-medium">{date.getDate()}</div>
                <div className="text-gray-500">{date.toLocaleDateString('en', { month: 'short' })}</div>
              </div>
            ))}
          </div>

          {/* TASK ROWS */}
          <div>
            {tasks.map((task) => {
              const taskStart = new Date(task.start);
              const taskEnd = new Date(task.end);
              const startOffsetDays = Math.floor((taskStart - minDate) / (1000 * 60 * 60 * 24));
              const durationDays = Math.ceil((taskEnd - taskStart) / (1000 * 60 * 60 * 24)) + 1;
              const durationText = durationDays;

              return (
                <div key={task.id} className="group flex" style={{ height: `${ROW_HEIGHT}px` }}>
                  {/* Sticky Task Name Column */}
                  <div 
                    className="sticky left-0 z-10 p-3 border-b border-r border-gray-200 bg-white group-hover:bg-gray-50 flex flex-col justify-center" 
                    style={{ width: `${TASK_NAME_WIDTH}px`, minWidth: `${TASK_NAME_WIDTH}px` }}
                  >
                    <div className="font-medium text-gray-800 text-sm leading-tight whitespace-normal">{task.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {durationText} day{durationText !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {/* Timeline section for this row */}
                  <div className="relative border-b border-gray-200" style={{ width: `${dateColumns.length * DAY_COLUMN_WIDTH}px` }}>
                    {/* Background Grid Lines for this row */}
                    <div className="flex h-full">
                      {dateColumns.map((_, colIndex) => (
                        <div key={colIndex} className="border-r border-gray-200" style={{ width: `${DAY_COLUMN_WIDTH}px`, minWidth: `${DAY_COLUMN_WIDTH}px` }} />
                      ))}
                    </div>
                    {/* Task Bar */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 h-10 bg-blue-500 rounded shadow-sm flex items-center justify-start px-2"
                      style={{
                        left: `${startOffsetDays * DAY_COLUMN_WIDTH}px`,
                        width: `${durationDays * DAY_COLUMN_WIDTH}px`,
                      }}
                    >
                      <span className="text-white text-xs font-medium truncate">{task.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
       {/* ... (Export Options can remain the same) ... */}
    </div>
  );
};

export default GanttChart;