/**
 * GanttDependencyVisuals Component
 * Renders visual dependency indicators and overlaps in the Gantt chart
 * 
 * Following Golden Rule #1: Safety First - Feature flag controlled, graceful fallbacks
 * Following Golden Rule #4: Clear Roles - Focused only on visual dependency rendering
 */

import React, { useMemo } from 'react';
import { showTaskOverlaps, showCriticalPath, isDebugMode } from '../config/features';

interface TaskPosition {
  id: string;
  name: string;
  left: number;
  width: number;
  top: number;
  height: number;
  isCritical?: boolean;
  dependencies?: Array<{
    predecessorId: string;
    type: 'FS';
    lag: number;
  }>;
}

interface GanttDependencyVisualsProps {
  tasks: TaskPosition[];
  containerWidth: number;
  containerHeight: number;
  className?: string;
}

const GanttDependencyVisuals = React.memo<GanttDependencyVisualsProps>(({
  tasks,
  containerWidth,
  containerHeight,
  className = ''
}) => {
  const canShowOverlaps = showTaskOverlaps();
  const canShowCriticalPath = showCriticalPath();

  // Calculate dependency lines
  const dependencyLines = useMemo(() => {
    if (!canShowOverlaps) return [];

    const lines: Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      overlapDays: number;
      predecessorName: string;
      successorName: string;
      isOverlap: boolean;
    }> = [];

    tasks.forEach(task => {
      if (!task.dependencies) return;

      task.dependencies.forEach(dep => {
        const predecessorTask = tasks.find(t => t.id === dep.predecessorId);
        if (!predecessorTask) return;

        const overlapDays = Math.abs(dep.lag);
        const isOverlap = dep.lag < 0;

        // Calculate line coordinates
        const x1 = predecessorTask.left + predecessorTask.width; // End of predecessor
        const y1 = predecessorTask.top + predecessorTask.height / 2; // Middle of predecessor
        const x2 = task.left; // Start of successor
        const y2 = task.top + task.height / 2; // Middle of successor

        lines.push({
          id: `${dep.predecessorId}-${task.id}`,
          x1,
          y1,
          x2,
          y2,
          overlapDays,
          predecessorName: predecessorTask.name,
          successorName: task.name,
          isOverlap
        });
      });
    });

    return lines;
  }, [tasks, canShowOverlaps]);

  // Calculate critical path highlighting
  const criticalPathTasks = useMemo(() => {
    if (!canShowCriticalPath) return [];
    return tasks.filter(task => task.isCritical);
  }, [tasks, canShowCriticalPath]);

  // Don't render if features are disabled
  if (!canShowOverlaps && !canShowCriticalPath) {
    return null;
  }

  if (isDebugMode()) {
    console.log('GanttDependencyVisuals render:', {
      taskCount: tasks.length,
      dependencyLines: dependencyLines.length,
      criticalPathTasks: criticalPathTasks.length,
      canShowOverlaps,
      canShowCriticalPath
    });
  }

  return (
    <svg
      className={`absolute inset-0 pointer-events-none ${className}`}
      width={containerWidth}
      height={containerHeight}
      style={{ zIndex: 10 }}
    >
      {/* Definitions for patterns and markers */}
      <defs>
        {/* Arrow marker for dependency lines */}
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#3B82F6" />
        </marker>

        {/* Arrow marker for overlap lines */}
        <marker
          id="overlap-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="#F59E0B" />
        </marker>

        {/* Critical path pattern */}
        <pattern
          id="critical-path-pattern"
          x="0"
          y="0"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <rect width="8" height="8" fill="#FEE2E2" />
          <path d="M0,4 L4,0 M4,8 L8,4" stroke="#EF4444" strokeWidth="1" opacity="0.5" />
        </pattern>
      </defs>

      {/* Critical Path Highlighting */}
      {canShowCriticalPath && criticalPathTasks.map(task => (
        <g key={`critical-${task.id}`}>
          {/* Critical path background highlight */}
          <rect
            x={task.left - 2}
            y={task.top - 2}
            width={task.width + 4}
            height={task.height + 4}
            fill="url(#critical-path-pattern)"
            rx="4"
            opacity="0.6"
          />
          
          {/* Critical path border */}
          <rect
            x={task.left - 2}
            y={task.top - 2}
            width={task.width + 4}
            height={task.height + 4}
            fill="none"
            stroke="#EF4444"
            strokeWidth="2"
            strokeDasharray="4,2"
            rx="4"
            opacity="0.8"
          />
        </g>
      ))}

      {/* Dependency Lines */}
      {canShowOverlaps && dependencyLines.map(line => {
        const isOverlap = line.isOverlap;
        const strokeColor = isOverlap ? '#F59E0B' : '#3B82F6'; // Orange for overlaps, blue for sequential
        const strokeWidth = isOverlap ? 2 : 1;
        const strokeDashArray = isOverlap ? '5,3' : 'none';
        const markerEnd = isOverlap ? 'url(#overlap-arrow)' : 'url(#arrow)';

        return (
          <g key={line.id}>
            {/* Main dependency line */}
            <path
              d={`M ${line.x1} ${line.y1} Q ${line.x1 + (line.x2 - line.x1) / 2} ${line.y1} ${line.x2} ${line.y2}`}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDashArray}
              markerEnd={markerEnd}
              opacity="0.8"
            />

            {/* Overlap indicator */}
            {isOverlap && line.overlapDays > 0 && (
              <>
                {/* Overlap amount label background */}
                <rect
                  x={line.x1 + (line.x2 - line.x1) / 2 - 12}
                  y={line.y1 + (line.y2 - line.y1) / 2 - 8}
                  width="24"
                  height="16"
                  fill="white"
                  stroke={strokeColor}
                  strokeWidth="1"
                  rx="8"
                  opacity="0.9"
                />
                
                {/* Overlap amount text */}
                <text
                  x={line.x1 + (line.x2 - line.x1) / 2}
                  y={line.y1 + (line.y2 - line.y1) / 2 + 3}
                  textAnchor="middle"
                  fontSize="10"
                  fill={strokeColor}
                  fontWeight="bold"
                >
                  {line.overlapDays}d
                </text>
              </>
            )}

            {/* Tooltip area (invisible but captures hover) */}
            <path
              d={`M ${line.x1} ${line.y1} Q ${line.x1 + (line.x2 - line.x1) / 2} ${line.y1} ${line.x2} ${line.y2}`}
              fill="none"
              stroke="transparent"
              strokeWidth="8"
              style={{ pointerEvents: 'all' }}
            >
              <title>
                {isOverlap ? (
                  `${line.successorName} starts ${line.overlapDays} day${line.overlapDays !== 1 ? 's' : ''} before ${line.predecessorName} finishes`
                ) : (
                  `${line.successorName} starts when ${line.predecessorName} finishes`
                )}
              </title>
            </path>
          </g>
        );
      })}

      {/* Legend for dependency visuals */}
      {(canShowOverlaps || canShowCriticalPath) && (
        <g>
          {/* Legend background */}
          <rect
            x={containerWidth - 200}
            y={10}
            width="190"
            height={canShowOverlaps && canShowCriticalPath ? 80 : 50}
            fill="white"
            stroke="#D1D5DB"
            strokeWidth="1"
            rx="4"
            opacity="0.95"
          />
          
          {/* Legend title */}
          <text
            x={containerWidth - 195}
            y={25}
            fontSize="12"
            fontWeight="bold"
            fill="#374151"
          >
            Timeline Features
          </text>

          {/* Critical path legend */}
          {canShowCriticalPath && (
            <g>
              <rect
                x={containerWidth - 190}
                y={35}
                width="12"
                height="8"
                fill="#FEE2E2"
                stroke="#EF4444"
                strokeWidth="1"
                strokeDasharray="2,1"
              />
              <text
                x={containerWidth - 172}
                y={42}
                fontSize="10"
                fill="#374151"
              >
                Critical Path Tasks
              </text>
            </g>
          )}

          {/* Overlap legend */}
          {canShowOverlaps && (
            <g>
              <line
                x1={containerWidth - 190}
                y1={canShowCriticalPath ? 55 : 40}
                x2={containerWidth - 170}
                y2={canShowCriticalPath ? 55 : 40}
                stroke="#F59E0B"
                strokeWidth="2"
                strokeDasharray="3,2"
                markerEnd="url(#overlap-arrow)"
              />
              <text
                x={containerWidth - 165}
                y={canShowCriticalPath ? 58 : 43}
                fontSize="10"
                fill="#374151"
              >
                Task Overlaps
              </text>
            </g>
          )}
        </g>
      )}
    </svg>
  );
});

GanttDependencyVisuals.displayName = 'GanttDependencyVisuals';

export default GanttDependencyVisuals;