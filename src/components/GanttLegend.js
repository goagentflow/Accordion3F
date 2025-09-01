import React, { useState, useEffect } from 'react';

const GanttLegend = React.memo(() => {
  const [isExpanded, setIsExpanded] = useState(() => {
    // Load preference from localStorage, default to expanded on first load
    const saved = localStorage.getItem('gantt-legend-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Save preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('gantt-legend-expanded', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Auto-collapse on mobile screen sizes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) { // sm breakpoint
        setIsExpanded(false);
      }
    };
    
    handleResize(); // Check initial size
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut (L key) for toggling legend
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'l' || event.key === 'L') {
        // Only trigger if not typing in an input field
        if (!['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
          event.preventDefault();
          setIsExpanded(prev => !prev);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleLegend = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* Collapsible Tab Handle */}
      <div 
        className={`fixed top-24 z-20 bg-white border-l border-y border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 ${
          isExpanded ? 'right-40' : 'right-0'
        }`}
        onClick={toggleLegend}
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed'
        }}
      >
        <div className="py-4 px-2 text-xs font-semibold text-gray-600 uppercase tracking-wider flex flex-col items-center justify-center space-y-1">
          <span>{isExpanded ? '>' : '<'}</span>
          <span className="transform rotate-180">Legend</span>
        </div>
        {/* Quick reference dots when collapsed */}
        {!isExpanded && (
          <div className="px-2 pb-3 flex flex-col space-y-1 items-center">
            <div className="w-2 h-2 bg-orange-500 rounded-full" title="Client Action"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full" title="MMM Action"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full" title="Agency Action"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full" title="Live Date"></div>
          </div>
        )}
      </div>

      {/* Main Legend Panel */}
      <div className={`fixed right-0 top-20 z-10 bg-white border-l border-gray-200 shadow-lg w-40 py-3 px-3 transition-transform duration-200 ease-in-out ${
        isExpanded ? 'transform translate-x-0' : 'transform translate-x-full'
      } hidden sm:block`}>
        <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide flex items-center justify-between">
          <span>Legend</span>
          <button 
            onClick={toggleLegend}
            className="text-gray-400 hover:text-gray-600 text-sm"
            title="Close Legend (Press L)"
          >
            &times;
          </button>
        </div>
        <div className="flex flex-col space-y-2 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded flex-shrink-0"></div>
            <span className="text-gray-700">Client Action</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded flex-shrink-0"></div>
            <span className="text-gray-700">MMM Action</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded flex-shrink-0"></div>
            <span className="text-gray-700">Agency Action</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded flex-shrink-0"></div>
            <span className="text-gray-700">Live Date</span>
          </div>
          <div className="flex items-center space-x-2 pt-1 border-t border-gray-200">
            <span className="text-xs text-gray-600 font-medium flex-shrink-0">(Cu)</span>
            <span className="text-gray-700">Custom Task</span>
          </div>
          <div className="pt-2 text-xs text-gray-500 text-center border-t border-gray-100">
            Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">L</kbd> to toggle
          </div>
        </div>
      </div>
    </>
  );
});

GanttLegend.displayName = 'GanttLegend';

export default GanttLegend;