import React, { useState, memo } from 'react';
import TaskDependencyIndicator from './TaskDependencyIndicator';
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
  onDeleteTask,
  onMouseDown,
  isDragging,
  draggedTaskId,
  // Dependency drag-drop props
  onDependencyDragStart,
  onDependencyDragEnd,
  isDependencyDragEnabled = false,
  dragState = { isDragging: false, sourceTaskId: null },
  getDropValidation = () => ({ isValid: false }),
  // Visual drag props
  dragMode = null,
  moveDaysDelta = 0,
  resolveTaskLabel = null,
  onViewTask = null,
  onRemoveSameDayLink = null
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(task.name);
  const [showDeleteTip, setShowDeleteTip] = useState(false);
  const [showUnlinkTip, setShowUnlinkTip] = useState(false);

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
  
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (typeof onDeleteTask === 'function') {
      onDeleteTask(task.id, task.assetId);
    }
  };

  const owner = getOwnerFromTask(task);
  const ownerDescription = getOwnerDescription(owner);
  const ownerColorClasses = getOwnerColorClasses(owner);
  const taskPosition = calculateTaskPosition(task, minDate);
  const visualOffsetPx = (isDragging && draggedTaskId === task.id && dragMode === 'move')
    ? moveDaysDelta * GANTT_CONFIG.DAY_COLUMN_WIDTH
    : 0;

  const isTaskBeingDragged = isDragging && draggedTaskId === task.id;

  // Drag-drop dependency handlers
  const handleDependencyDragStart = (e) => {
    if (!isDependencyDragEnabled || !onDependencyDragStart) return;
    
    const taskInfo = {
      id: task.id,
      name: task.name,
      assetId: task.assetId || task.id,
      duration: task.duration
    };
    
    onDependencyDragStart(taskInfo, e);
  };

  const handleDependencyDragEnd = () => {
    if (!isDependencyDragEnabled || !onDependencyDragEnd || !dragState.isDragging) return;
    
    const taskInfo = {
      id: task.id,
      name: task.name,
      assetId: task.assetId || task.id,
      duration: task.duration
    };
    
    onDependencyDragEnd(taskInfo);
  };

  // Check if this task is a valid drop target
  const dropValidation = getDropValidation(task.id);
  const isValidDropTarget = dragState.isDragging && 
    dragState.sourceTaskId !== task.id && 
    dropValidation.isValid;
  const isInvalidDropTarget = dragState.isDragging && 
    dragState.sourceTaskId !== task.id && 
    !dropValidation.isValid;

  return (
    <div className="flex" style={{ height: `${GANTT_CONFIG.ROW_HEIGHT}px` }} data-task-id={task.id}>
      {/* Task name cell */}
      <div
        className={`border-b border-r border-gray-200 flex flex-col justify-center px-3 bg-white ${
          isValidDropTarget ? 'ring-2 ring-green-400 bg-green-50' :
          isInvalidDropTarget ? 'ring-2 ring-red-400 bg-red-50' : ''
        }`}
        style={{
          width: `${GANTT_CONFIG.TASK_NAME_WIDTH}px`,
          minWidth: `${GANTT_CONFIG.TASK_NAME_WIDTH}px`,
          position: 'sticky',
          left: 0,
          zIndex: 20
        }}
        onMouseUp={handleDependencyDragEnd}
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
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{task.name}</span>
              {task.assetPrefix && (
                <span className="text-xs text-gray-500">({task.assetPrefix})</span>
              )}
              {task.isCustom && (
                <span className="text-xs text-gray-600">(Cu)</span>
              )}
              {task.isLiveTask && (
                <span className="text-xs text-green-600">📍 Live</span>
              )}
              
              {/* Dependency Indicator */}
              <TaskDependencyIndicator
                taskId={task.id}
                taskName={task.name}
                dependencies={task.dependencies}
                isCritical={task.isCritical}
                totalFloat={task.totalFloat}
                size="small"
                showLabels={false}
                resolveTaskLabel={resolveTaskLabel || undefined}
                onViewTask={onViewTask || undefined}
              />
              {/* Unlink for any overlap (SS/FF any lag, FS with negative lag) */}
              {Array.isArray(task.dependencies) && task.dependencies.some(d => (d && ((d.type === 'SS' || d.type === 'FF') || (d.type === 'FS' && Number(d.lag) < 0)))) && typeof onRemoveSameDayLink === 'function' && (
                <span className="relative inline-flex items-center">
                  <button
                    className="text-gray-400 hover:text-red-600 p-1 transition-colors transition-transform duration-150 motion-reduce:transform-none hover:scale-110"
                    aria-label="Remove link"
                    onMouseEnter={() => setShowUnlinkTip(true)}
                    onMouseLeave={() => setShowUnlinkTip(false)}
                    onClick={(e) => {
                      e.stopPropagation();
                      const dep = task.dependencies.find(d => d && ((d.type === 'SS' || d.type === 'FF') || (d.type === 'FS' && Number(d.lag) < 0)));
                      if (dep) onRemoveSameDayLink(task.id, dep.predecessorId, dep.type);
                    }}
                  >
                    ❌
                  </button>
                  {showUnlinkTip && (
                    <div
                      role="tooltip"
                      className="absolute z-30 -top-8 left-0 whitespace-nowrap bg-red-600 text-white text-xs px-2 py-1 rounded shadow"
                    >
                      Remove link (unlink) — return to template order
                    </div>
                  )}
                </span>
              )}
              
              {/* Dependency drag handle */}
              {isDependencyDragEnabled && (
                <button
                  className="text-gray-400 hover:text-blue-600 p-1 transition-colors"
                  title="Drag to create dependency"
                  onMouseDown={handleDependencyDragStart}
                >
                  🔗
                </button>
              )}
            </div>
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
              <span className="relative inline-flex items-center">
                {/* Delete button - enlarged hit area, immediate tooltip on hover */}
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  onMouseEnter={() => setShowDeleteTip(true)}
                  onMouseLeave={() => setShowDeleteTip(false)}
                  className="inline-flex items-center p-2 -m-1 text-gray-400 hover:text-red-600 focus:outline-none rounded transition-transform duration-150 motion-reduce:transform-none hover:scale-110"
                  aria-label="Delete task"
                >
                  {/* Dustbin icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M9 3h6a1 1 0 0 1 1 1v1h4v2H4V5h4V4a1 1 0 0 1 1-1zm1 0v1h4V3h-4zM7 9h2v10H7V9zm8 0h2v10h-2V9zM11 9h2v10h-2V9zM6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7z"/>
                  </svg>
                </button>
                {showDeleteTip && (
                  <div
                    role="tooltip"
                    className="absolute z-30 -top-7 left-0 whitespace-nowrap bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow"
                  >
                    Deleting this task will remove it from the Gantt chart.
                  </div>
                )}
              </span>
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

        {/* Task bar with separate drag zones */}
        <div
          className={`absolute ${ownerColorClasses} ${isTaskBeingDragged ? 'opacity-50' : ''} 
            text-white text-xs flex items-center justify-center rounded shadow-sm border 
            hover:shadow-md transition-shadow relative overflow-hidden`}
          style={{
            left: `${taskPosition.left + visualOffsetPx}px`,
            width: `${taskPosition.width}px`,
            top: '20px',
            height: '40px',
            zIndex: 10
          }}
        >
          {/* Center move handle - drag to reposition task */}
          <div
            className="absolute left-0 right-2 top-0 bottom-0 cursor-move hover:bg-black hover:bg-opacity-10 transition-colors flex items-center justify-center"
            title="Drag to reposition task (change start date)"
            onMouseDown={(e) => onMouseDown(e, task.id, task.start, task.end, 'move')}
          >
            <span className="truncate px-2 font-medium">
              {task.duration} {task.duration === 1 ? 'day' : 'days'}
            </span>
          </div>
          
          {/* Right resize handle - drag to adjust duration */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-black hover:bg-opacity-20 transition-colors"
            title="Drag to adjust duration"
            onMouseDown={(e) => onMouseDown(e, task.id, task.start, task.end, 'resize-right')}
          />
        </div>
      </div>
    </div>
  );
});

GanttTaskRow.displayName = 'GanttTaskRow';

export default GanttTaskRow;
