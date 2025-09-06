/**
 * TimelineRenderer - Pure Presentation and Layout ONLY
 * Single Responsibility: UI rendering and layout
 * 
 * CRITICAL: This component handles ONLY UI rendering, NO business logic
 * All state access is through context, ensuring consistency
 */

import React from 'react';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { TimelineControls } from './TimelineControls';
import { GanttChart } from './GanttChart';
import { DataManager } from './DataManager';

// Import existing components that will be integrated
import TimelineCompressionMetrics from '../TimelineCompressionMetrics';
import SimpleAnalytics from '../SimpleAnalytics';
import RecoveryPrompt from '../RecoveryPrompt';
import SaveIndicator from '../SaveIndicator';

// ============================================
// Loading and Error Components
// ============================================

function HydrationLoader(): JSX.Element {
  return (
    <div className="timeline-loading">
      <div className="loading-spinner">Loading your timeline...</div>
      <p>Restoring your work from previous session</p>
    </div>
  );
}

function HydrationError({ error }: { error: string }): JSX.Element {
  return (
    <div className="timeline-error">
      <h3>Timeline Loading Error</h3>
      <p>There was a problem loading your saved timeline:</p>
      <code>{error}</code>
      <button onClick={() => window.location.reload()}>
        Try Again
      </button>
    </div>
  );
}

function EmptyTimeline(): JSX.Element {
  return (
    <div className="timeline-empty">
      <h2>Welcome to Timeline Builder</h2>
      <p>Get started by adding your first asset or importing a CSV file.</p>
    </div>
  );
}

// ============================================
// Main Renderer Component
// ============================================

export function TimelineRenderer(): JSX.Element {
  const { state, isHydrating, hydrationError } = useTimelineContext();
  
  console.log('[TimelineRenderer] Rendering with state:', {
    status: state.status,
    isHydrating,
    hasAssets: state.assets.selected.length > 0,
    hasTimelineTasks: state.tasks.timeline.length > 0
  });
  
  // ============================================
  // Hydration State Handling
  // ============================================
  
  if (isHydrating) {
    return <HydrationLoader />;
  }
  
  if (hydrationError) {
    return <HydrationError error={hydrationError} />;
  }
  
  if (state.status === 'loading') {
    return <HydrationLoader />;
  }
  
  if (state.status === 'error') {
    return <HydrationError error="Timeline is in an error state" />;
  }
  
  // ============================================
  // Main Timeline Interface
  // ============================================
  
  const hasTimeline = state.assets.selected.length > 0 || state.tasks.timeline.length > 0;
  
  return (
    <div className="timeline-renderer">
      
      {/* Recovery and Save Indicators */}
      <div className="timeline-status">
        <RecoveryPrompt />
        <SaveIndicator />
      </div>
      
      {/* Main Controls */}
      <TimelineControls />
      
      {/* Data Management (Import/Export) */}
      <DataManager />
      
      {/* Main Timeline Content */}
      {hasTimeline ? (
        <div className="timeline-content">
          
          {/* Timeline Metrics */}
          <div className="timeline-metrics">
            <TimelineCompressionMetrics />
            {state.ui.showInfoBox && (
              <SimpleAnalytics />
            )}
          </div>
          
          {/* Main Gantt Chart */}
          <div className="timeline-chart">
            <GanttChart />
          </div>
          
        </div>
      ) : (
        <EmptyTimeline />
      )}
      
      {/* Debug Information (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="timeline-debug" style={{ fontSize: '12px', padding: '10px', background: '#f5f5f5', marginTop: '20px' }}>
          <h4>Debug Info</h4>
          <pre>{JSON.stringify({
            status: state.status,
            assets: state.assets.selected.length,
            timelineTasks: state.tasks.timeline.length,
            customTasks: state.tasks.custom.length,
            globalLiveDate: state.dates.globalLiveDate,
            useGlobalDate: state.dates.useGlobalDate,
            showInfoBox: state.ui.showInfoBox
          }, null, 2)}</pre>
        </div>
      )}
      
    </div>
  );
}

export default TimelineRenderer;