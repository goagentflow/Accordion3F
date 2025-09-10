import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'react-datepicker/dist/react-datepicker.css';
import TimelineBuilderV2 from './v2/TimelineBuilderV2';
import ErrorBoundary from './components/ErrorBoundary';

// Simple, clean initialization
function initApp() {
  let container = document.getElementById('root');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);
  }
  
  const root = createRoot(container);
  
  // Render V2 (includes its own provider internally)
  root.render(
    <ErrorBoundary>
      <TimelineBuilderV2 />
    </ErrorBoundary>
  );
}

// Wait for DOM and initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
