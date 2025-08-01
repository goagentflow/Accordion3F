import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx'; // Import the new library

const GanttChart = ({ tasks, bankHolidays = [], onTaskDurationChange = () => {}, workingDaysNeeded = null }) => {
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [originalDuration, setOriginalDuration] = useState(0);
  const containerRef = useRef(null);

  // --- CONFIGURATION ---
  const DAY_COLUMN_WIDTH = 48;
  const ROW_HEIGHT = 80;
  const HEADER_HEIGHT = 50;
  const TASK_NAME_WIDTH = 320;

  // Helper functions to check non-working days
  const isBankHoliday = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return bankHolidays.includes(dateStr);
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  };

  const getColumnBackground = (date) => {
    if (isBankHoliday(date)) return 'bg-red-50';
    if (isWeekend(date)) return 'bg-gray-50';
    return 'bg-white';
  };

  // Helper function to count working days between two dates
  const countWorkingDays = (startDate, endDate) => {
    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      if (!isBankHoliday(current) && !isWeekend(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  // Helper function to add working days to a date
  const addWorkingDays = (startDate, workingDaysToAdd) => {
    if (workingDaysToAdd <= 0) {
      return new Date(startDate);
    }
    let currentDate = new Date(startDate);
    let remainingDays = workingDaysToAdd - 1;
    
    while (remainingDays > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (!isBankHoliday(currentDate) && !isWeekend(currentDate)) {
        remainingDays--;
      }
    }
    
    // Ensure the final day is a working day
    while (isBankHoliday(currentDate) || isWeekend(currentDate)) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return currentDate;
  };

  // Mouse event handlers for drag functionality
  const handleMouseDown = (e, taskId, taskStart, taskEnd) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isRightEdge = e.clientX > rect.right - 15; // 15px from right edge
    
    if (isRightEdge) {
      setIsDragging(true);
      setDraggedTaskId(taskId);
      setDragStartX(e.clientX);
      
      const startDate = new Date(taskStart);
      const endDate = new Date(taskEnd);
      const duration = countWorkingDays(startDate, endDate);
      setOriginalDuration(duration);
      
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !draggedTaskId) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaDays = Math.round(deltaX / DAY_COLUMN_WIDTH);
    
    // Find the task being dragged
    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task) return;
    
    const newDuration = Math.max(1, originalDuration + deltaDays); // Minimum 1 day
    
    // Calculate new end date based on working days
    const startDate = new Date(task.start);
    const newEndDate = addWorkingDays(startDate, newDuration);
    
    // Call the callback to update the task
    onTaskDurationChange(draggedTaskId, newDuration, newEndDate.toISOString().split('T')[0]);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedTaskId(null);
    setDragStartX(0);
    setOriginalDuration(0);
  };

  const handleMouseMoveOverTask = (e) => {
    if (!isDragging) {
      const rect = e.currentTarget.getBoundingClientRect();
      const isRightEdge = e.clientX > rect.right - 15;
      if (isRightEdge) {
        e.currentTarget.style.cursor = 'ew-resize';
      } else {
        e.currentTarget.style.cursor = 'pointer';
      }
    }
  };

  const handleMouseLeave = (e) => {
    if (!isDragging) {
      e.currentTarget.style.cursor = 'pointer';
    }
  };

  // Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, draggedTaskId, dragStartX, originalDuration]);

  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10">
        <p className="text-lg">Your timeline will appear here.</p>
        <p className="text-sm">Set a start date and select some assets to begin.</p>
      </div>
    );
  }

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

  const exportToExcel = () => {
    // 1. Create the header row for the Excel sheet
    const header = ['Task Name', ...dateColumns.map(d => d.toLocaleDateString())];
    
    // 2. Create a data row for each task
    const data = tasks.map(task => {
      const taskRow = Array(header.length).fill(''); // Create an empty row
      taskRow[0] = task.name; // Set the task name in the first column

      const taskStart = new Date(task.start);
      const taskEnd = new Date(task.end);

      // 3. Place a marker ('X') in the date columns where the task is active
      dateColumns.forEach((date, index) => {
        if (date >= taskStart && date <= taskEnd) {
          taskRow[index + 1] = 'X'; // +1 to account for the 'Task Name' column
        }
      });
      return taskRow;
    });

    // 4. Combine header and data into a single array for the worksheet
    const worksheetData = [header, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // 5. Set column widths for better readability
    const columnWidths = [
      { wch: 60 }, // Task Name column
      ...dateColumns.map(() => ({ wch: 12 })) // Date columns
    ];
    worksheet['!cols'] = columnWidths;
    
    // 6. Create the workbook and trigger the download
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timeline');
    XLSX.writeFile(workbook, `timeline_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

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
      {/* ... (The Gantt chart display JSX remains the same) ... */}
      <div className="overflow-auto border border-gray-300 rounded-lg" style={{ maxHeight: '75vh' }}>
        <div className="relative min-w-max">
          {/* HEADER ROW */}
          <div className="flex" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
            {/* Top-left cell: sticky both top and left */}
            <div
              className="p-3 border-b border-r border-gray-300 font-semibold text-gray-700 bg-white flex items-center"
              style={{
                width: `${TASK_NAME_WIDTH}px`,
                minWidth: `${TASK_NAME_WIDTH}px`,
                position: 'sticky',
                left: 0,
                top: 0,
                zIndex: 40,
                background: 'white',
              }}
            >
              Task Name
            </div>
            {/* Date headers: sticky top only */}
            {dateColumns.map((date, index) => {
              // Array of day abbreviations, starting with Sunday
              const dayAbbr = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];
              // Get the day abbreviation for this date
              const day = dayAbbr[date.getDay()];
              // Get the day of the month (number)
              const dayOfMonth = date.getDate();
              // Get the month abbreviation (e.g., Aug)
              const month = date.toLocaleString('en', { month: 'short' });
              // Format: M 4 Aug, Tu 5 Aug, etc.
              const formatted = `${day} ${dayOfMonth} ${month}`;
              return (
                <div
                  key={index}
                  className={`p-1 text-xs text-center border-b border-r border-gray-200 flex flex-col justify-center ${getColumnBackground(date)}`}
                  style={{
                    width: `${DAY_COLUMN_WIDTH}px`,
                    minWidth: `${DAY_COLUMN_WIDTH}px`,
                    position: 'sticky',
                    top: 0,
                    zIndex: 30,
                    background: 'white',
                  }}
                >
                  {/* Show the formatted date with day abbreviation */}
                  <div className="font-medium">
                    {formatted}
                    {isBankHoliday(date) && (
                      <span className="ml-1 text-red-500" title="Bank Holiday">🏦</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {/* TASK ROWS */}
          {tasks.map((task) => {
            const taskStart = new Date(task.start);
            const taskEnd = new Date(task.end);
            const startOffsetDays = Math.floor((taskStart - minDate) / (1000 * 60 * 60 * 24));
            const durationDays = Math.ceil((taskEnd - taskStart) / (1000 * 60 * 60 * 24)) + 1;
            const durationText = durationDays;
            return (
              <div key={task.id} className="group flex" style={{ height: `${ROW_HEIGHT}px` }}>
                {/* Task name column: sticky left only */}
                <div
                  className="p-3 border-b border-r border-gray-300 font-semibold text-gray-700 bg-white flex items-center"
                  style={{
                    width: `${TASK_NAME_WIDTH}px`,
                    minWidth: `${TASK_NAME_WIDTH}px`,
                    position: 'sticky',
                    left: 0,
                    zIndex: 20,
                    background: 'white',
                  }}
                >
                  <div className="font-medium text-gray-800 text-sm leading-tight whitespace-normal">{task.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{durationText} day{durationText !== 1 ? 's' : ''}</div>
                </div>
                {/* Gantt bars and grid */}
                <div className="relative border-b border-gray-200" style={{ width: `${dateColumns.length * DAY_COLUMN_WIDTH}px` }}>
                  <div className="flex h-full">
                    {dateColumns.map((date, colIndex) => (
                      <div 
                        key={colIndex} 
                        className={`border-r border-gray-200 ${getColumnBackground(date)}`}
                        style={{ width: `${DAY_COLUMN_WIDTH}px`, minWidth: `${DAY_COLUMN_WIDTH}px` }} 
                      />
                    ))}
                  </div>
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-10 bg-blue-500 rounded shadow-sm flex items-center justify-start px-2 cursor-pointer transition-all ${
                      isDragging && draggedTaskId === task.id ? 'ring-2 ring-blue-300 ring-opacity-50 shadow-lg' : ''
                    }`}
                    style={{
                      left: `${startOffsetDays * DAY_COLUMN_WIDTH}px`,
                      width: `${durationDays * DAY_COLUMN_WIDTH}px`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, task.id, task.start, task.end)}
                    onMouseMove={handleMouseMoveOverTask}
                    onMouseLeave={handleMouseLeave}
                  >
                    <span className="text-white text-xs font-medium truncate">{task.name}</span>
                    {/* Drag handle indicator */}
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-blue-600 rounded-r opacity-0 hover:opacity-100 transition-opacity cursor-ew-resize">
                      <div className="absolute right-1 top-1/2 transform -translate-y-1/2 text-white text-xs">⋮</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Working Days Indicator (always visible when there are issues) */}
      {workingDaysNeeded && workingDaysNeeded.needed > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-red-300 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="text-base font-semibold text-gray-800 mb-2">
            ⚠️ Timeline Alert
          </div>
          <div className="text-lg font-bold text-red-600 mb-2">
            {workingDaysNeeded.needed} day{workingDaysNeeded.needed !== 1 ? 's' : ''} need to be saved
          </div>
          <div className="text-sm text-gray-600">
            Adjust task durations to start on time
          </div>
        </div>
      )}

      {/* Floating Working Days Indicator (shown while dragging) */}
      {isDragging && workingDaysNeeded && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-w-xs">
          <div className="text-sm font-medium text-gray-700 mb-1">
            Timeline Status
          </div>
          <div className={`text-sm ${
            workingDaysNeeded.needed > 0
              ? 'text-red-600'
              : workingDaysNeeded.needed < 0
              ? 'text-green-600'
              : 'text-blue-600'
          }`}>
            {workingDaysNeeded.needed > 0 ? (
              <span>⚠️ {workingDaysNeeded.needed} day{workingDaysNeeded.needed !== 1 ? 's' : ''} need to be saved</span>
            ) : workingDaysNeeded.needed < 0 ? (
              <span>✅ {Math.abs(workingDaysNeeded.needed)} day{Math.abs(workingDaysNeeded.needed) !== 1 ? 's' : ''} to spare</span>
            ) : (
              <span>🎯 You're on target</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Available: {workingDaysNeeded.available} | Allocated: {workingDaysNeeded.allocated}
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="mt-6 p-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Export Timeline</h4>
        <div className="flex space-x-3">
          <button 
            onClick={exportToExcel} // UPDATED BUTTON
            className="px-4 py-2 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
          >
            📊 Export to Excel
          </button>
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors"
          >
            🖨️ Print Timeline
          </button>
        </div>
      </div>
    </div>
  );
};

export default GanttChart;