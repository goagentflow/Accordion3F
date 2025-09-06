/**
 * TimelineBuilderV2 - New Architecture Entry Point
 * Replaces the 2,380-line TimelineBuilder.js with clean component architecture
 * 
 * CRITICAL: This is the new timeline builder that fixes manipulation bugs
 * through proper state management and component separation
 */

import React from 'react';
import { TimelineContainer } from './components/timeline/TimelineContainer';
import './TimelineBuilder.css'; // Reuse existing styles

// ============================================
// Main Timeline Builder V2 Component
// ============================================

export interface TimelineBuilderV2Props {
  className?: string;
  style?: React.CSSProperties;
}

export function TimelineBuilderV2({ 
  className = 'timeline-builder-v2', 
  style 
}: TimelineBuilderV2Props): JSX.Element {
  
  console.log('[TimelineBuilderV2] Rendering with new architecture');
  
  return (
    <div className={className} style={style}>
      <header className="timeline-header">
        <h1>Timeline Builder</h1>
        <div className="version-badge">V2 - Enhanced Architecture</div>
      </header>
      
      <main className="timeline-main">
        <TimelineContainer />
      </main>
      
      <footer className="timeline-footer">
        <small>Timeline Builder V2 - State Management Refactored</small>
      </footer>
    </div>
  );
}

export default TimelineBuilderV2;