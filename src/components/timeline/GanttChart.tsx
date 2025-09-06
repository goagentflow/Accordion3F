/**
 * GanttChart - SVG Timeline Rendering and Drag Operations ONLY
 * Single Responsibility: SVG rendering and drag handling
 * 
 * CRITICAL: This component fixes the manipulation bugs by using
 * proper drag event handling with queuing and state consistency
 */

import React, { useRef, useCallback } from 'react';
import { useTimelineTasks, useTimelineActions } from '../../contexts/TimelineContext';
import { useSVGDragOperations } from '../../hooks/useDragOperations';

// Import existing Gantt chart component that we'll enhance
import OriginalGanttChart from '../GanttChart';

// ============================================
// Enhanced SVG Task Bar Component
// ============================================

interface TaskBarProps {
  task: any; // Using any for now - will be properly typed
  svgElement: SVGElement;
}

function EnhancedTaskBar({ task, svgElement }: TaskBarProps): JSX.Element {
  const { handleSVGDragStart, isDragging, currentTaskId } = useSVGDragOperations();
  
  // Calculate task bar position and dimensions
  const x = 100; // Placeholder - real implementation would calculate from dates
  const y = 50 * parseInt(task.id.split('-').pop() || '0');
  const width = task.duration * 48; // ~48px per day
  const height = 40;
  
  const isCurrentlyDragging = isDragging && currentTaskId === task.id;
  
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    console.log(`[GanttChart] Starting drag for task: ${task.id}`);
    handleSVGDragStart(task.id, svgElement)(event);
  }, [task.id, svgElement, handleSVGDragStart]);
  
  return (
    <g className={`task-bar ${isCurrentlyDragging ? 'dragging' : ''}`}>
      {/* Main task bar rectangle */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isCurrentlyDragging ? '#007bff' : '#28a745'}
        stroke="#333"
        strokeWidth="1"
        rx="4"
        ry="4"
        onMouseDown={handleMouseDown}
        data-testid={`task-bar-${task.id}`}
        data-task-id={task.id}
        data-drag-handle="true"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
      
      {/* Task label */}
      <text
        x={x + 10}
        y={y + height / 2 + 5}
        fill="white"
        fontSize="12"
        fontWeight="bold"
        pointerEvents="none"
        data-testid={`task-label-${task.id}`}
      >
        {task.name}
      </text>
      
      {/* Drag indicators (small circles at edges) */}
      <circle
        cx={x + 5}
        cy={y + height / 2}
        r="3"
        fill="rgba(255,255,255,0.7)"
        pointerEvents="none"
      />
      <circle
        cx={x + width - 5}
        cy={y + height / 2}
        r="3"
        fill="rgba(255,255,255,0.7)"
        pointerEvents="none"
      />
      
      {/* Visual feedback during drag */}
      {isCurrentlyDragging && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          fill="none"
          stroke="#007bff"
          strokeWidth="2"
          strokeDasharray="5,5"
          rx="6"
          ry="6"
          pointerEvents="none"
        />
      )}
    </g>
  );
}

// ============================================
// Timeline Grid Component
// ============================================

function TimelineGrid(): JSX.Element {
  // Placeholder grid implementation
  const days = 30;
  const dayWidth = 48;
  
  return (
    <g className="timeline-grid">
      {/* Vertical grid lines for days */}
      {Array.from({ length: days }, (_, i) => (
        <line
          key={`grid-${i}`}
          x1={100 + i * dayWidth}
          y1={0}
          x2={100 + i * dayWidth}
          y2={400}
          stroke="#e0e0e0"
          strokeWidth="1"
        />
      ))}
      
      {/* Horizontal grid lines for tasks */}
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={`row-${i}`}
          x1={0}
          y1={i * 50}
          x2={100 + days * dayWidth}
          y2={i * 50}
          stroke="#f0f0f0"
          strokeWidth="1"
        />
      ))}
    </g>
  );
}

// ============================================
// Main Gantt Chart Component
// ============================================

export function GanttChart(): JSX.Element {
  const tasks = useTimelineTasks();
  const svgRef = useRef<SVGSVGElement>(null);
  
  console.log('[GanttChart] Rendering with tasks:', tasks.timeline.length);
  
  // If no timeline tasks, show the original component for now
  if (tasks.timeline.length === 0) {
    return <OriginalGanttChart />;
  }
  
  return (
    <div className="gantt-chart-container">
      <h3>Project Gantt Chart</h3>
      
      <div className="gantt-scroll-container" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <svg
          ref={svgRef}
          className="gantt-chart-svg"
          width={2000}
          height={Math.max(400, tasks.timeline.length * 50 + 100)}
          viewBox={`0 0 2000 ${Math.max(400, tasks.timeline.length * 50 + 100)}`}
          style={{
            border: '1px solid #ccc',
            background: 'white',
            userSelect: 'none'
          }}
        >
          {/* Background grid */}
          <TimelineGrid />
          
          {/* Task bars */}
          {tasks.timeline.map((task) => (
            svgRef.current && (
              <EnhancedTaskBar
                key={task.id}
                task={task}
                svgElement={svgRef.current}
              />
            )
          ))}
          
          {/* Timeline axis labels */}
          <g className="timeline-axis">
            <text x={50} y={20} fill="#333" fontSize="14" fontWeight="bold">
              Tasks
            </text>
            <text x={150} y={20} fill="#333" fontSize="14" fontWeight="bold">
              Timeline (Days)
            </text>
          </g>
          
        </svg>
      </div>
      
      {/* Chart Legend */}
      <div className="gantt-legend" style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        <div>💡 <strong>Tip:</strong> Click and drag task bars to adjust timing</div>
        <div>🎯 Each square represents approximately one day</div>
      </div>
      
    </div>
  );
}

export default GanttChart;