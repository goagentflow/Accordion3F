import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import TimelineBuilder from './TimelineBuilder';
import TimelineBuilderTSX from './TimelineBuilder.tsx';
import { TimelineProvider } from './hooks/useTimeline';
import ErrorBoundary from './components/ErrorBoundary';

// Feature flag - set to true to use new TypeScript version
const USE_NEW_VERSION = false;

// Simple, clean initialization
function initApp() {
  let container = document.getElementById('root');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);
  }
  
  const root = createRoot(container);
  
  // Switch between JS and TSX versions based on flag
  if (USE_NEW_VERSION) {
    // New TypeScript version with Context Providers
    const { ValidationProvider } = require('./contexts/ValidationContext');
    const TimelineBuilderValidated = require('./TimelineBuilderValidated').default;
    
    root.render(
      <ErrorBoundary>
        <TimelineProvider>
          <ValidationProvider>
            <TimelineBuilderValidated />
          </ValidationProvider>
        </TimelineProvider>
      </ErrorBoundary>
    );
  } else {
    // Current working JS version
    root.render(
      <ErrorBoundary>
        <TimelineBuilder />
      </ErrorBoundary>
    );
  }
}

// Wait for DOM and initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}