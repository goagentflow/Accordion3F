/**
 * DragDropDependencyOverlay Component
 * Provides visual feedback during drag-and-drop dependency creation
 * 
 * Following Golden Rule #2: 400 Line Max - Focused on drag/drop visual feedback
 * Following Golden Rule #4: Clear Roles - Only handles drag/drop UI overlay
 */

import React from 'react';

interface DragLineCoordinates {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DragDropDependencyOverlayProps {
  isVisible: boolean;
  coordinates: DragLineCoordinates | null;
  sourceTaskName: string | null;
  className?: string;
}

const DragDropDependencyOverlay = React.memo<DragDropDependencyOverlayProps>(({
  isVisible,
  coordinates,
  sourceTaskName,
  className = ''
}) => {
  if (!isVisible || !coordinates) {
    return null;
  }

  // Calculate line properties
  const deltaX = coordinates.x2 - coordinates.x1;
  const deltaY = coordinates.y2 - coordinates.y1;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  // Position the line at the start point
  const lineStyle: React.CSSProperties = {
    position: 'fixed',
    left: coordinates.x1,
    top: coordinates.y1,
    width: length,
    height: 2,
    backgroundColor: '#3B82F6',
    transformOrigin: '0 50%',
    transform: `rotate(${angle}deg)`,
    zIndex: 9999,
    pointerEvents: 'none',
    boxShadow: '0 0 4px rgba(59, 130, 246, 0.5)'
  };

  // Arrow head at the end
  const arrowStyle: React.CSSProperties = {
    position: 'fixed',
    left: coordinates.x2 - 6,
    top: coordinates.y2 - 6,
    width: 0,
    height: 0,
    borderLeft: '6px solid #3B82F6',
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    transform: `rotate(${angle}deg)`,
    zIndex: 9999,
    pointerEvents: 'none',
    filter: 'drop-shadow(0 0 2px rgba(59, 130, 246, 0.5))'
  };

  // Tooltip showing source task
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    left: coordinates.x1,
    top: coordinates.y1 - 35,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    zIndex: 10000,
    pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    whiteSpace: 'nowrap'
  };

  return (
    <div className={`drag-drop-overlay ${className}`}>
      {/* Drag line */}
      <div style={lineStyle} />
      
      {/* Arrow head */}
      <div style={arrowStyle} />
      
      {/* Source task tooltip */}
      {sourceTaskName && (
        <div style={tooltipStyle}>
          Creating dependency from: {sourceTaskName}
        </div>
      )}
      
      {/* Instructions tooltip at cursor */}
      <div
        style={{
          position: 'fixed',
          left: coordinates.x2 + 10,
          top: coordinates.y2 + 10,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '11px',
          zIndex: 10000,
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)'
        }}
      >
        Drop on target task to create dependency
      </div>
    </div>
  );
});

DragDropDependencyOverlay.displayName = 'DragDropDependencyOverlay';

export default DragDropDependencyOverlay;