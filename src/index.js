import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import TimelineBuilder from './TimelineBuilder';

// Simple, clean initialization
function initApp() {
  let container = document.getElementById('root');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);
  }
  
  const root = createRoot(container);
  root.render(<TimelineBuilder />);
}

// Wait for DOM and initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}