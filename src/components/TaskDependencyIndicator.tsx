/**
 * TaskDependencyIndicator Component
 * Shows dependency status and critical path information for individual tasks
 * 
 * Following Golden Rule #2: 400 Line Max - Focused, small component
 * Following Golden Rule #4: Clear Roles - Only displays dependency indicators
 */

import React, { useMemo } from 'react';
import { showTaskOverlaps, showCriticalPath } from '../config/features';

interface TaskDependency {
  predecessorId: string;
  type: 'FS';
  lag: number;
}

interface TaskDependencyIndicatorProps {
  taskId: string;
  taskName: string;
  dependencies?: TaskDependency[];
  isCritical?: boolean;
  totalFloat?: number;
  className?: string;
  size?: 'small' | 'medium';
  showLabels?: boolean;
  predecessorNames?: Record<string, string>; // Map of predecessor IDs to names
}

const TaskDependencyIndicator = React.memo<TaskDependencyIndicatorProps>(({
  taskName,
  dependencies = [],
  isCritical = false,
  totalFloat = 0,
  className = '',
  size = 'medium',
  showLabels = true,
  predecessorNames = {}
}) => {
  const canShowOverlaps = showTaskOverlaps();
  const canShowCriticalPath = showCriticalPath();

  // Calculate indicator data
  const indicatorData = useMemo(() => {
    const hasDependencies = dependencies.length > 0;
    const hasOverlaps = dependencies.some(dep => dep.lag < 0);
    const overlapCount = dependencies.filter(dep => dep.lag < 0).length;
    const maxOverlap = dependencies.reduce((max, dep) => Math.max(max, Math.abs(dep.lag)), 0);

    return {
      hasDependencies,
      hasOverlaps,
      overlapCount,
      maxOverlap,
      dependencyCount: dependencies.length
    };
  }, [dependencies]);

  // Don't render if features are disabled
  if (!canShowOverlaps && !canShowCriticalPath) {
    return null;
  }

  // Don't render if no indicators to show
  if (!indicatorData.hasDependencies && !isCritical && !canShowCriticalPath) {
    return null;
  }

  const sizeClasses = {
    small: 'text-xs',
    medium: 'text-sm'
  };

  return (
    <div className={`flex items-center gap-1 ${sizeClasses[size]} ${className}`}>
      {/* Critical Path Indicator */}
      {canShowCriticalPath && isCritical && (
        <div
          className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full border border-red-200"
          title={`${taskName} is on the critical path - delays here will extend the project timeline`}
        >
          <span className="text-red-600">🔥</span>
          {showLabels && (
            <span className="font-medium">Critical</span>
          )}
        </div>
      )}

      {/* Float Time Indicator */}
      {canShowCriticalPath && !isCritical && totalFloat > 0 && (
        <div
          className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full border border-green-200"
          title={`${taskName} has ${totalFloat} day${totalFloat !== 1 ? 's' : ''} of float time - it can be delayed without affecting the project timeline`}
        >
          <span className="text-green-600">⏰</span>
          {showLabels && (
            <span>{totalFloat}d float</span>
          )}
        </div>
      )}

      {/* Dependency Indicators */}
      {canShowOverlaps && indicatorData.hasDependencies && (
        <>
          {/* Overlap Indicator */}
          {indicatorData.hasOverlaps && (
            <div
              className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full border border-orange-200"
              title={`${taskName} overlaps with ${indicatorData.overlapCount} predecessor task${indicatorData.overlapCount !== 1 ? 's' : ''} (max ${indicatorData.maxOverlap} days)`}
            >
              <span className="text-orange-600">⚡</span>
              {showLabels && (
                <span>
                  {indicatorData.overlapCount} overlap{indicatorData.overlapCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Sequential Dependency Indicator */}
          {!indicatorData.hasOverlaps && (
            <div
              className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200"
              title={`${taskName} depends on ${indicatorData.dependencyCount} predecessor task${indicatorData.dependencyCount !== 1 ? 's' : ''} (sequential)`}
            >
              <span className="text-blue-600">🔗</span>
              {showLabels && (
                <span>
                  {indicatorData.dependencyCount} dependency{indicatorData.dependencyCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Detailed dependency tooltip on hover */}
      {canShowOverlaps && indicatorData.hasDependencies && dependencies.length > 0 && (
        <div className="group relative">
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 p-1"
            title="Show dependency details"
          >
            ℹ️
          </button>
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-800 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
            <div className="font-medium mb-2">{taskName} Dependencies:</div>
            {dependencies.map((dep, index) => {
              const predecessorName = predecessorNames[dep.predecessorId] || `Task ${dep.predecessorId}`;
              const overlapDays = Math.abs(dep.lag);
              const isOverlap = dep.lag < 0;
              
              return (
                <div key={index} className="text-xs mb-1 last:mb-0">
                  {isOverlap ? (
                    <span className="text-orange-300">
                      ⚡ Starts {overlapDays}d before <strong>{predecessorName}</strong> finishes
                    </span>
                  ) : (
                    <span className="text-blue-300">
                      🔗 Starts when <strong>{predecessorName}</strong> finishes
                    </span>
                  )}
                </div>
              );
            })}
            
            {/* Arrow pointing down */}
            <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
          </div>
        </div>
      )}
    </div>
  );
});

TaskDependencyIndicator.displayName = 'TaskDependencyIndicator';

export default TaskDependencyIndicator;