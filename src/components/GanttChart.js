import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import GanttHeader from './GanttHeader';
import GanttLegend from './GanttLegend';
import GanttTaskRow from './GanttTaskRow';
import AssetGroupSection from './AssetGroupSection';
import GanttAddTaskModal from './GanttAddTaskModal';
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
import useGanttDrag from '../hooks/useGanttDrag';
import { calculateWorkingDaysBetween } from '../utils/dateHelpers';


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
  addDependency = null,
  onExportExcel = null,
  onDeleteTask = () => {},
  resolveTaskLabel = null,
  onViewTask = null,
  onRemoveSameDayLink = null
}) => {
  // Drag state moved into hook (Golden Rule #2)
  const { isDragging, draggedTaskId, dragMode, moveDaysDelta, handleMouseDown } = useGanttDrag({
    tasks,
    bankHolidays,
    onTaskMove,
    onTaskDurationChange
  });
  
  // Modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  
  // Dependency functionality is now passed as prop (addDependency)
  // This allows graceful fallback when TimelineProvider is not available
  
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);

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

  // True, unpadded summary derived from current tasks (source of truth)
  const { actualStart, actualEnd, totalWorkingDays } = useMemo(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { actualStart: null, actualEnd: null, totalWorkingDays: 0 };
    }
    const starts = [];
    const ends = [];
    for (const t of tasks) {
      if (t && t.start) {
        const s = new Date(t.start);
        if (!isNaN(s.getTime())) starts.push(s);
      }
      if (t && t.end) {
        const e = new Date(t.end);
        if (!isNaN(e.getTime())) ends.push(e);
      }
    }
    if (starts.length === 0 || ends.length === 0) {
      return { actualStart: null, actualEnd: null, totalWorkingDays: 0 };
    }
    const actualStart = new Date(Math.min(...starts.map(d => d.getTime())));
    const actualEnd = new Date(Math.max(...ends.map(d => d.getTime())));

    // Inclusive working days between start and end
    const endPlusOne = new Date(actualEnd);
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    const totalWorkingDays = calculateWorkingDaysBetween(actualStart, endPlusOne, bankHolidays);

    return { actualStart, actualEnd, totalWorkingDays };
  }, [tasks, bankHolidays]);

  // Group tasks by asset for clearer visual separation
  const assetGroups = useMemo(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return [];
    const groups = [];
    let current = null;
    tasks.forEach((t) => {
      const groupKey = t.assetId || t.assetType || 'unknown';
      if (!current || current.key !== groupKey) {
        // Prefer asset name from selectedAssets when available; fallback to assetType
        const asset = Array.isArray(selectedAssets)
          ? selectedAssets.find(a => a.id === groupKey)
          : null;
        current = {
          key: groupKey,
          label: asset?.name || t.assetType || 'Asset',
          tasks: []
        };
        groups.push(current);
      }
      current.tasks.push(t);
    });
    return groups;
  }, [tasks, selectedAssets]);

  // Drag handlers moved into useGanttDrag

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

  // Memoized Excel export handler (prefers container-provided handler)
  const handleExportToExcel = useCallback(async () => {
    if (onExportExcel) {
      await onExportExcel();
      return;
    }
    // Fallback for legacy usage
    const applicationState = { selectedAssets };
    await exportToExcel(tasks, dateColumns, bankHolidays, minDate, maxDate, applicationState);
  }, [onExportExcel, tasks, dateColumns, bankHolidays, minDate, maxDate, selectedAssets]);

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
  const dragState = {
    isDragging: !!isDragging && dragMode === 'move',
    sourceTaskId: draggedTaskId || null,
    sourceTaskName: (tasks.find(t => t.id === draggedTaskId) || {}).name || ''
  };
  const isDragDropEnabled = false;
  const handleTaskDragStart = useCallback(() => {}, []);
  const handleTaskDragEnd = useCallback(() => {}, []);
  const handleDependencyMouseMove = useCallback(() => {}, []);
  const handleDependencyMouseUp = useCallback(() => {}, []);
  const getDragLineCoordinates = useCallback(() => ({ x1: 0, y1: 0, x2: 0, y2: 0 }), []);
  const getDropValidation = useCallback((targetTaskId) => {
    if (!dragState.isDragging || !dragState.sourceTaskId) return { isValid: false, reason: '' };
    if (targetTaskId === dragState.sourceTaskId) return { isValid: false, reason: 'Same task' };
    const src = tasks.find(t => t.id === dragState.sourceTaskId);
    const tgt = tasks.find(t => t.id === targetTaskId);
    if (!src || !tgt) return { isValid: false, reason: '' };
    if ((src.assetId || src.assetType) !== (tgt.assetId || tgt.assetType)) return { isValid: false, reason: 'Cross-asset' };
    return { isValid: true, reason: '' };
  }, [dragState.isDragging, dragState.sourceTaskId, tasks]);

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
      const moveOffset = (isDragging && dragMode === 'move' && draggedTaskId === task.id) ? (moveDaysDelta * GANTT_CONFIG.DAY_COLUMN_WIDTH) : 0;
      
      return {
        id: task.id,
        name: task.name,
        left: LEFT_COLUMN_WIDTH + (daysDiff * GANTT_CONFIG.DAY_COLUMN_WIDTH) + moveOffset,
        width: duration * GANTT_CONFIG.DAY_COLUMN_WIDTH,
        top: HEADER_HEIGHT + (index * TASK_HEIGHT),
        height: TASK_HEIGHT - 10, // Subtract margin
        isCritical: task.isCritical || false,
        dependencies: task.dependencies || []
      };
    }).filter(Boolean); // Remove null entries
  }, [tasks, minDate, isDragging, dragMode, draggedTaskId, moveDaysDelta]);

  // Drag event listeners handled by useGanttDrag

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

  // Listen for requests to focus a specific asset's tasks from the left panel
  useEffect(() => {
    const handler = (e) => {
      try {
        const assetId = e?.detail?.assetId;
        if (!assetId) return;
        const el = document.querySelector(`[data-asset-id="${assetId}"]`);
        if (!el) return;

        // Find nearest scrollable ancestor; fall back to window
        const getScrollable = (node) => {
          let cur = node;
          while (cur && cur.parentElement) {
            cur = cur.parentElement;
            const style = cur && window.getComputedStyle(cur);
            if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
              return cur;
            }
          }
          return window;
        };

        const scroller = getScrollable(el);
        const OFFSET = 140; // same offset used in conflicts card
        if (scroller === window) {
          const rect = el.getBoundingClientRect();
          const y = rect.top + window.pageYOffset;
          window.scrollTo({ top: Math.max(0, y - OFFSET), behavior: 'smooth' });
        } else {
          const container = scroller;
          const containerRect = container.getBoundingClientRect();
          const targetRect = el.getBoundingClientRect();
          const delta = (targetRect.top - containerRect.top) - OFFSET;
          container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' });
        }

        // Brief highlight pulse on the asset section
        try {
          el.classList.add('ring-2', 'ring-yellow-400');
          setTimeout(() => el.classList.remove('ring-2', 'ring-yellow-400'), 1200);
        } catch {}
      } catch {}
    };
    window.addEventListener('focus-asset-in-gantt', handler);
    return () => window.removeEventListener('focus-asset-in-gantt', handler);
  }, []);

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
              {tasks.length} tasks • {totalWorkingDays} working days • {actualStart ? actualStart.toLocaleDateString() : '—'} to {actualEnd ? actualEnd.toLocaleDateString() : '—'}
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


      {/* Main Gantt Chart */}
      <div ref={scrollContainerRef} className="overflow-auto border border-gray-300 rounded-lg" style={{ maxHeight: '75vh' }}>
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
            {assetGroups.map((group, index) => (
            <AssetGroupSection
              key={`${group.key}-${index}`}
              group={group}
              dateColumns={dateColumns}
              minDate={minDate}
              bankHolidays={bankHolidays}
              onTaskDurationChange={onTaskDurationChange}
              onTaskNameChange={onTaskNameChange}
              onDeleteTask={onDeleteTask}
              onMouseDown={handleMouseDown}
              isDragging={isDragging}
              draggedTaskId={draggedTaskId}
              onDependencyDragStart={handleTaskDragStart}
              onDependencyDragEnd={handleTaskDragEnd}
                isDragDropEnabled={isDragDropEnabled}
                dragState={dragState}
                getDropValidation={getDropValidation}
                dragMode={dragMode}
                moveDaysDelta={moveDaysDelta}
                resolveTaskLabel={resolveTaskLabel}
                onViewTask={onViewTask}
                onRemoveSameDayLink={onRemoveSameDayLink}
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
