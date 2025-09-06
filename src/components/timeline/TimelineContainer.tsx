/**
 * TimelineContainer - State Management and Coordination ONLY
 * Single Responsibility: Orchestrate the timeline application
 * 
 * CRITICAL: This component replaces the massive 2,380-line TimelineBuilder.js
 * with clean separation of concerns and <400 line Golden Rule compliance
 */

import React from 'react';
import { TimelineProvider } from '../../contexts/TimelineContext';
import { TimelineRenderer } from './TimelineRenderer';

// ============================================
// Container Props
// ============================================

export interface TimelineContainerProps {
  // Optional configuration props
  className?: string;
  style?: React.CSSProperties;
}

// ============================================
// Main Container Component
// ============================================

export function TimelineContainer({ 
  className = 'timeline-app', 
  style 
}: TimelineContainerProps): JSX.Element {
  
  console.log('[TimelineContainer] Rendering timeline application');
  
  return (
    <div className={className} style={style}>
      <TimelineProvider>
        <TimelineRenderer />
      </TimelineProvider>
    </div>
  );
}

export default TimelineContainer;