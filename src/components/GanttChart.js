import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import GanttHeader from './GanttHeader';
import GanttLegend from './GanttLegend';
import GanttTaskRow from './GanttTaskRow';
import GanttAddTaskModal from './GanttAddTaskModal';
import GanttAssetAlerts from './GanttAssetAlerts';
import GanttDependencyVisuals from './GanttDependencyVisuals';
import DragDropDependencyOverlay from './DragDropDependencyOverlay';
// import { useDragDropDependency } from '../hooks/useDragDropDependency';
import { exportToExcel } from '../services/ExcelExporter';
// Conditional import for dependency management (only available in new context system)
// import { useDependencies } from '../hooks/useDependencies';
import { 
  GANTT_CONFIG,
  generateDateColumns
} from './ganttUtils';


const GanttChart = ({ 
  tasks, 
  bankHolidays = [], 
  onTaskDurationChange = () => {}, 
  onTaskNameChange = () => {}, 
  onTaskMove = null, // Optional callback for moving tasks (changing start date)
  workingDaysNeeded = null, 
  assetAlerts = [], 
  onAddCustomTask = () => {}, 
  selectedAssets = [],
  isExportDisabled = false,
  // Optional dependency function for move mode (only available with new context system)
  addDependency = null
}) => {
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [originalDuration, setOriginalDuration] = useState(0);
  // New drag mode state for move vs resize
  const [dragMode, setDragMode] = useState(null); // 'resize-left', 'resize-right', 'move'
  const [originalStartDate, setOriginalStartDate] = useState(null);
  
  // Modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  
  // Dependency functionality is now passed as prop (addDependency)
  // This allows graceful fallback when TimelineProvider is not available
  
  const containerRef = useRef(null);

  // Memoized timeline bounds calculation - expensive operation with 150+ tasks
  const { minDate, maxDate, dateColumns, totalDays } = useMemo(() => {
    const dates = tasks.reduce((acc, task) => {
      if (task.start) acc.push(new Date(task.start));
      if (task.end) acc.push(new Date(task.end));
      return acc;
    }, []);

    const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
    
    // Add padding days
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 5);

    const dateColumns = generateDateColumns(minDate, maxDate);
    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    
    return { minDate, maxDate, dateColumns, totalDays };
  }, [tasks]); // Only recalculate when tasks change

  // Memoized drag handlers to prevent recreation on every render
  const handleMouseDown = useCallback((e, taskId, taskStart, taskEnd, mode = 'resize-right') => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    
    const task = tasks.find(t => t.id === taskId);
    if (task && !task.isLiveTask) {
      setIsDragging(true);
      setDraggedTaskId(taskId);
      setDragStartX(e.clientX);
      setOriginalDuration(task.duration);
      setDragMode(mode);
      setOriginalStartDate(new Date(taskStart));
      
      // Different cursor styles for different modes
      if (mode === 'move') {
        document.body.style.cursor = 'move';
      } else if (mode === 'resize-left') {
        document.body.style.cursor = 'w-resize';
      } else {
        document.body.style.cursor = 'e-resize';
      }
    }
  }, [tasks]); // Depend on tasks to ensure we have current task data

  const handleMouseMove = useCallback((e) => {
    if (isDragging && draggedTaskId && dragMode) {
      const deltaX = e.clientX - dragStartX;
      const daysDelta = Math.round(deltaX / GANTT_CONFIG.DAY_COLUMN_WIDTH);
      
      if (daysDelta !== 0) {
        const task = tasks.find(t => t.id === draggedTaskId);
        if (task) {
          if (dragMode === 'move') {
            // Move mode: Reposition task by changing start date (keeping same duration)
            console.log(`[DEBUG] Move mode: shifting task ${task.name} by ${daysDelta} days`);
            
            if (onTaskMove) {
              // Calculate the new start date
              const currentStart = new Date(task.start);
              const newStartDate = new Date(currentStart.getTime() + (daysDelta * 24 * 60 * 60 * 1000));
              
              console.log(`[DEBUG] Current start: ${currentStart.toDateString()}, New start: ${newStartDate.toDateString()}`);
              
              // Call the move callback with the new start date
              onTaskMove(draggedTaskId, newStartDate.toISOString().split('T')[0], task.assetType, task.name);
            } else {
              console.log(`[DEBUG] Move mode disabled - onTaskMove callback not provided`);
            }
            
          } else if (dragMode === 'resize-right') {
            // Right resize mode: Change duration (existing behavior)
            const newDuration = Math.max(1, Math.min(365, originalDuration + daysDelta));
            if (newDuration !== task.duration) {
              // Fix parameter mismatch - need to calculate new end date
              const currentStart = new Date(task.start);
              const newEndDate = new Date(currentStart.getTime() + (newDuration * 24 * 60 * 60 * 1000));
              onTaskDurationChange(draggedTaskId, newDuration, newEndDate.toISOString().split('T')[0]);
            }
          }
        }
      }
    }
  }, [isDragging, draggedTaskId, dragStartX, originalDuration, dragMode, tasks, onTaskDurationChange, onTaskMove]);

  const handleMouseUp = useCallback(() => {
    // Restore cursor
    document.body.style.cursor = 'default';
    
    setIsDragging(false);
    setDraggedTaskId(null);
    setDragStartX(0);
    setOriginalDuration(0);
    setDragMode(null);
    setOriginalStartDate(null);
  }, []); // No dependencies needed for simple state setters

  // Memoized modal handlers to prevent child re-renders
  const handleOpenAddTaskModal = useCallback(() => setShowAddTaskModal(true), []);
  const handleCloseAddTaskModal = useCallback(() => setShowAddTaskModal(false), []);
  
  const handleSubmitCustomTask = useCallback((taskData) => {
    onAddCustomTask({
      name: taskData.name,
      duration: taskData.duration,
      owner: taskData.owner,
      assetType: taskData.assetType,
      insertAfterTaskId: taskData.insertAfter
    });
  }, [onAddCustomTask]);

  // Memoized Excel export handler
  const handleExportToExcel = useCallback(async () => {
    await exportToExcel(tasks, dateColumns, bankHolidays, minDate, maxDate);
  }, [tasks, dateColumns, bankHolidays, minDate, maxDate]);

  // Drag-drop dependency functionality
  const availableTasksForDependency = useMemo(() => 
    tasks.map(task => ({
      id: task.id,
      name: task.name,
      assetId: task.assetId || task.id, // Fallback to ID if no assetId
      duration: task.duration
    })), [tasks]
  );

  // Fallback values for drag-drop dependency functionality without context
  const dragState = { isDragging: false, sourceTaskId: null, sourceTaskName: '' };
  const isDragDropEnabled = false;
  const handleTaskDragStart = useCallback(() => {}, []);
  const handleTaskDragEnd = useCallback(() => {}, []);
  const handleDependencyMouseMove = useCallback(() => {}, []);
  const handleDependencyMouseUp = useCallback(() => {}, []);
  const getDragLineCoordinates = useCallback(() => ({ x1: 0, y1: 0, x2: 0, y2: 0 }), []);
  const getDropValidation = useCallback(() => ({ isValid: false, reason: '' }), []);

  // Calculate task positions for dependency visuals
  const taskPositions = useMemo(() => {
    const TASK_HEIGHT = 50; // Height per task row including margin
    const HEADER_HEIGHT = 80; // Combined height of header and legend
    const LEFT_COLUMN_WIDTH = 350; // Width of the task name column
    
    return tasks.map((task, index) => {
      const taskStart = task.start ? new Date(task.start) : null;
      const taskEnd = task.end ? new Date(task.end) : null;
      
      if (!taskStart || !taskEnd) {
        return null; // Skip tasks without proper dates
      }
      
      const daysDiff = Math.ceil((taskStart - minDate) / (1000 * 60 * 60 * 24));
      const duration = Math.ceil((taskEnd - taskStart) / (1000 * 60 * 60 * 24)) + 1;
      
      return {
        id: task.id,
        name: task.name,
        left: LEFT_COLUMN_WIDTH + (daysDiff * GANTT_CONFIG.DAY_COLUMN_WIDTH),
        width: duration * GANTT_CONFIG.DAY_COLUMN_WIDTH,
        top: HEADER_HEIGHT + (index * TASK_HEIGHT),
        height: TASK_HEIGHT - 10, // Subtract margin
        isCritical: task.isCritical || false,
        dependencies: task.dependencies || []
      };
    }).filter(Boolean); // Remove null entries
  }, [tasks, minDate]);

  // Setup drag event listeners (for duration dragging)
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, draggedTaskId, dragStartX, originalDuration]);

  // Setup dependency drag event listeners
  useEffect(() => {
    if (dragState.sourceTaskId) {
      document.addEventListener('mousemove', handleDependencyMouseMove);
      document.addEventListener('mouseup', handleDependencyMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleDependencyMouseMove);
        document.removeEventListener('mouseup', handleDependencyMouseUp);
      };
    }
  }, [dragState.sourceTaskId, handleDependencyMouseMove, handleDependencyMouseUp]);

  // Empty state
  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10">
        <p className="text-lg">Your timeline will appear here.</p>
        <p className="text-sm">Set a start date and select some assets to begin.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Summary Header */}
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-800">Project Gantt Chart</h3>
            <p className="text-sm text-blue-600">
              {tasks.length} tasks • {totalDays} days total • {minDate.toLocaleDateString()} to {maxDate.toLocaleDateString()}
            </p>
            <p className="text-xs text-blue-500 mt-1">
              💡 Click on any task name to edit it
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleOpenAddTaskModal}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center"
            >
              <span className="mr-2">➕</span>
              Add Task
            </button>
            <button
              onClick={handleExportToExcel}
              disabled={isExportDisabled}
              className={`px-4 py-2 rounded-md transition-colors flex items-center ${
                isExportDisabled 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              title={isExportDisabled ? 'Export disabled due to validation errors. Please fix date conflicts first.' : 'Export to Excel'}
            >
              <span className="mr-2">📊</span>
              Export to Excel
            </button>
          </div>
        </div>
      </div>

      {/* Asset Alerts */}
      <GanttAssetAlerts 
        assetAlerts={assetAlerts} 
        workingDaysNeeded={workingDaysNeeded} 
      />

      {/* Main Gantt Chart */}
      <div className="overflow-auto border border-gray-300 rounded-lg" style={{ maxHeight: '75vh' }}>
        <div className="relative min-w-max">
          {/* Header */}
          <GanttHeader 
            dateColumns={dateColumns} 
            bankHolidays={bankHolidays} 
          />
          
          {/* Legend */}
          <GanttLegend />

          {/* Task Rows */}
          <div ref={containerRef}>
            {tasks.map(task => (
              <GanttTaskRow
                key={task.id}
                task={task}
                dateColumns={dateColumns}
                minDate={minDate}
                bankHolidays={bankHolidays}
                onTaskDurationChange={onTaskDurationChange}
                onTaskNameChange={onTaskNameChange}
                onMouseDown={handleMouseDown}
                isDragging={isDragging}
                draggedTaskId={draggedTaskId}
                // Dependency drag-drop props
                onDependencyDragStart={handleTaskDragStart}
                onDependencyDragEnd={handleTaskDragEnd}
                isDependencyDragEnabled={isDragDropEnabled}
                dragState={dragState}
                getDropValidation={getDropValidation}
              />
            ))}
          </div>

          {/* Dependency Visuals Overlay */}
          <GanttDependencyVisuals
            tasks={taskPositions}
            containerWidth={350 + (dateColumns.length * GANTT_CONFIG.DAY_COLUMN_WIDTH)}
            containerHeight={80 + (tasks.length * 50)}
          />
        </div>
      </div>

      {/* Add Task Modal */}
      <GanttAddTaskModal
        isOpen={showAddTaskModal}
        onClose={handleCloseAddTaskModal}
        onSubmit={handleSubmitCustomTask}
        selectedAssets={selectedAssets}
        tasks={tasks}
      />

      {/* Drag-Drop Dependency Overlay */}
      <DragDropDependencyOverlay
        isVisible={dragState.isDragging}
        coordinates={getDragLineCoordinates()}
        sourceTaskName={dragState.sourceTaskName}
      />
    </div>
  );
};

export default GanttChart;