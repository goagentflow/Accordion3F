import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import GanttHeader from './GanttHeader';
import GanttLegend from './GanttLegend';
import GanttTaskRow from './GanttTaskRow';
import GanttAddTaskModal from './GanttAddTaskModal';
import GanttAssetAlerts from './GanttAssetAlerts';
import { exportToExcel } from '../services/ExcelExporter';
import { 
  GANTT_CONFIG,
  generateDateColumns
} from './ganttUtils';

const GanttChart = ({ 
  tasks, 
  bankHolidays = [], 
  onTaskDurationChange = () => {}, 
  onTaskNameChange = () => {}, 
  workingDaysNeeded = null, 
  assetAlerts = [], 
  onAddCustomTask = () => {}, 
  selectedAssets = [] 
}) => {
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [originalDuration, setOriginalDuration] = useState(0);
  
  // Modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  
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
  const handleMouseDown = useCallback((e, taskId, taskStart, taskEnd) => {
    e.preventDefault();
    const task = tasks.find(t => t.id === taskId);
    if (task && !task.isLiveTask) {
      setIsDragging(true);
      setDraggedTaskId(taskId);
      setDragStartX(e.clientX);
      setOriginalDuration(task.duration);
    }
  }, [tasks]); // Depend on tasks to ensure we have current task data

  const handleMouseMove = useCallback((e) => {
    if (isDragging && draggedTaskId) {
      const deltaX = e.clientX - dragStartX;
      const daysDelta = Math.round(deltaX / GANTT_CONFIG.DAY_COLUMN_WIDTH);
      
      if (daysDelta !== 0) {
        const newDuration = Math.max(1, Math.min(365, originalDuration + daysDelta));
        if (newDuration !== originalDuration) {
          const task = tasks.find(t => t.id === draggedTaskId);
          if (task) {
            onTaskDurationChange(draggedTaskId, newDuration, task.assetType, task.name);
          }
        }
      }
    }
  }, [isDragging, draggedTaskId, dragStartX, originalDuration, tasks, onTaskDurationChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedTaskId(null);
    setDragStartX(0);
    setOriginalDuration(0);
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

  // Setup drag event listeners
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
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center"
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
              />
            ))}
          </div>
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
    </div>
  );
};

export default GanttChart;