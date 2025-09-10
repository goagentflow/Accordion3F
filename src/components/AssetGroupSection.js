import React from 'react';
import GanttTaskRow from './GanttTaskRow';
import { GANTT_CONFIG } from './ganttUtils';

const AssetGroupSection = ({
  group,
  dateColumns,
  minDate,
  bankHolidays,
  onTaskDurationChange,
  onTaskNameChange,
  onMouseDown,
  isDragging,
  draggedTaskId,
  onDependencyDragStart,
  onDependencyDragEnd,
  isDragDropEnabled,
  dragState,
  getDropValidation,
  // Visual drag props
  dragMode,
  moveDaysDelta
}) => {
  return (
    <div className="relative">
      {/* Left color strip spanning the asset group */}
      <div
        aria-hidden
        className="absolute left-0 top-0"
        style={{ width: 4, height: '100%', backgroundColor: '#2E75B6', transform: 'translateX(-4px)' }}
      />

      {/* Asset header (Excel-style section header) */}
      <div className="flex" style={{ height: '28px' }}>
        <div
          className="border-b border-r border-gray-200 flex items-center px-3 bg-blue-50"
          style={{
            width: `${GANTT_CONFIG.TASK_NAME_WIDTH}px`,
            minWidth: `${GANTT_CONFIG.TASK_NAME_WIDTH}px`,
            position: 'sticky',
            left: 0,
            zIndex: 15
          }}
        >
          <span className="text-xs font-semibold text-blue-900">{group.label}</span>
          <span className="ml-2 text-[10px] text-blue-700">• {group.tasks.length} tasks</span>
        </div>
        <div className="flex-1 border-b border-gray-200 bg-blue-50" />
      </div>

      {/* Group tasks */}
      {group.tasks.map(task => (
        <GanttTaskRow
          key={task.id}
          task={task}
          dateColumns={dateColumns}
          minDate={minDate}
          bankHolidays={bankHolidays}
          onTaskDurationChange={onTaskDurationChange}
          onTaskNameChange={onTaskNameChange}
          onMouseDown={onMouseDown}
          isDragging={isDragging}
          draggedTaskId={draggedTaskId}
          // Dependency drag-drop props
          onDependencyDragStart={onDependencyDragStart}
          onDependencyDragEnd={onDependencyDragEnd}
          isDependencyDragEnabled={isDragDropEnabled}
          dragState={dragState}
          getDropValidation={getDropValidation}
          dragMode={dragMode}
          moveDaysDelta={moveDaysDelta}
        />
      ))}

      {/* Separator between asset groups */}
      <div className="h-2 border-b border-gray-200" />
    </div>
  );
};

export default AssetGroupSection;
