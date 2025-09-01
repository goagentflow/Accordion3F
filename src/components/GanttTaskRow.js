import React, { useState, memo } from 'react';
import { 
  GANTT_CONFIG, 
  getColumnBackground, 
  getOwnerFromTask, 
  getOwnerDescription, 
  getOwnerColorClasses,
  calculateTaskPosition 
} from './ganttUtils';

const GanttTaskRow = memo(({ 
  task, 
  dateColumns, 
  minDate, 
  bankHolidays,
  onTaskDurationChange,
  onTaskNameChange,
  onMouseDown,
  isDragging,
  draggedTaskId 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(task.name);

  const handleNameClick = () => {
    setIsEditing(true);
    setEditedName(task.name);
  };

  const handleNameSave = () => {
    if (editedName.trim() && editedName !== task.name) {
      onTaskNameChange(task.id, editedName.trim());
    }
    setIsEditing(false);
  };

  const handleNameCancel = () => {
    setEditedName(task.name);
    setIsEditing(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  const handleDurationChange = (value) => {
    const duration = parseInt(value, 10);
    if (!isNaN(duration) && duration > 0 && duration <= 365) {
      onTaskDurationChange(task.id, duration, task.assetType, task.name);
    }
  };

  const owner = getOwnerFromTask(task);
  const ownerDescription = getOwnerDescription(owner);
  const ownerColorClasses = getOwnerColorClasses(owner);
  const taskPosition = calculateTaskPosition(task, minDate);

  const isTaskBeingDragged = isDragging && draggedTaskId === task.id;

  return (
    <div className="flex" style={{ height: `${GANTT_CONFIG.ROW_HEIGHT}px` }}>
      {/* Task name cell */}
      <div
        className="border-b border-r border-gray-200 flex flex-col justify-center px-3 bg-white"
        style={{
          width: `${GANTT_CONFIG.TASK_NAME_WIDTH}px`,
          minWidth: `${GANTT_CONFIG.TASK_NAME_WIDTH}px`,
          position: 'sticky',
          left: 0,
          zIndex: 20
        }}
      >
        {isEditing ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleNameKeyDown}
            className="px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        ) : (
          <div 
            onClick={handleNameClick}
            className="cursor-pointer hover:text-blue-600 transition-colors"
          >
            <span className="font-medium text-sm">{task.name}</span>
            {task.assetPrefix && (
              <span className="ml-2 text-xs text-gray-500">({task.assetPrefix})</span>
            )}
            {task.isLiveTask && (
              <span className="ml-2 text-xs text-green-600">📍 Live</span>
            )}
          </div>
        )}

        {/* Task metadata */}
        <div className="flex items-center mt-1 text-xs text-gray-500">
          <span className="mr-3">Owner: {ownerDescription}</span>
          {!task.isLiveTask && (
            <>
              <span className="mr-3">Duration:</span>
              <input
                type="number"
                value={task.duration}
                onChange={(e) => handleDurationChange(e.target.value)}
                className="w-12 px-1 py-0.5 border rounded text-center"
                min="1"
                max="365"
              />
              <span className="ml-1">days</span>
            </>
          )}
        </div>
      </div>

      {/* Timeline cells */}
      <div className="relative flex-1">
        {dateColumns.map((date, index) => (
          <div
            key={index}
            className={`absolute top-0 bottom-0 border-b border-r border-gray-100 ${getColumnBackground(date, bankHolidays)}`}
            style={{
              left: `${index * GANTT_CONFIG.DAY_COLUMN_WIDTH}px`,
              width: `${GANTT_CONFIG.DAY_COLUMN_WIDTH}px`
            }}
          />
        ))}

        {/* Task bar */}
        <div
          className={`absolute ${ownerColorClasses} ${isTaskBeingDragged ? 'opacity-50' : ''} 
            text-white text-xs flex items-center justify-center rounded shadow-sm border 
            hover:shadow-md transition-shadow cursor-ew-resize`}
          style={{
            left: `${taskPosition.left}px`,
            width: `${taskPosition.width}px`,
            top: '20px',
            height: '40px',
            zIndex: 10
          }}
          onMouseDown={(e) => onMouseDown(e, task.id, task.start, task.end)}
        >
          <span className="truncate px-2 font-medium">
            {task.duration} {task.duration === 1 ? 'day' : 'days'}
          </span>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Enhanced memo comparison function - only re-render when THIS task's data changes
  // or when drag state specifically relates to this task
  
  // First, check if this is the task being dragged - always re-render in this case
  const wasBeingDragged = prevProps.isDragging && prevProps.draggedTaskId === prevProps.task.id;
  const isBeingDragged = nextProps.isDragging && nextProps.draggedTaskId === nextProps.task.id;
  
  if (wasBeingDragged !== isBeingDragged) {
    return false; // Re-render when drag state changes for this task
  }
  
  // For other tasks, only check if they're affected by the drag operation visually
  if (prevProps.isDragging !== nextProps.isDragging && 
      prevProps.draggedTaskId !== prevProps.task.id && 
      nextProps.draggedTaskId !== nextProps.task.id) {
    return true; // Don't re-render unrelated tasks during drag operations
  }
  
  // Task-specific data comparison - return true if props are equal (skip re-render)
  const taskEqual = (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.duration === nextProps.task.duration &&
    prevProps.task.name === nextProps.task.name &&
    prevProps.task.assetPrefix === nextProps.task.assetPrefix &&
    prevProps.task.isLiveTask === nextProps.task.isLiveTask &&
    prevProps.task.start === nextProps.task.start &&
    prevProps.task.end === nextProps.task.end
  );
  
  // DateColumns comparison - only check length and first/last dates for performance
  const dateColumnsEqual = (
    prevProps.dateColumns.length === nextProps.dateColumns.length &&
    prevProps.dateColumns[0]?.getTime() === nextProps.dateColumns[0]?.getTime() &&
    prevProps.dateColumns[prevProps.dateColumns.length - 1]?.getTime() === 
      nextProps.dateColumns[nextProps.dateColumns.length - 1]?.getTime()
  );
  
  // MinDate comparison
  const minDateEqual = prevProps.minDate.getTime() === nextProps.minDate.getTime();
  
  // BankHolidays comparison - check length only for performance
  const bankHolidaysEqual = prevProps.bankHolidays.length === nextProps.bankHolidays.length;
  
  return taskEqual && dateColumnsEqual && minDateEqual && bankHolidaysEqual;
});

GanttTaskRow.displayName = 'GanttTaskRow';

export default GanttTaskRow;