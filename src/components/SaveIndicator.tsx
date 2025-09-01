import React from 'react';

interface SaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  message: string;
}

const SaveIndicator: React.FC<SaveIndicatorProps> = ({ status, lastSaved, message }) => {
  if (status === 'idle') return null;

  const getIcon = () => {
    switch (status) {
      case 'saving':
        return (
          <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'saved':
        return <span className="text-green-500">✓</span>;
      case 'error':
        return <span className="text-red-500">⚠</span>;
      default:
        return null;
    }
  };

  const getTextColor = () => {
    switch (status) {
      case 'saving':
        return 'text-blue-600';
      case 'saved':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTimeAgo = () => {
    if (!lastSaved) return '';
    
    const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center space-x-2 bg-white rounded-lg shadow-md px-3 py-2 transition-all duration-300">
      {getIcon()}
      <span className={`text-sm ${getTextColor()}`}>
        {message}
      </span>
      {status === 'saved' && lastSaved && (
        <span className="text-xs text-gray-500">
          ({getTimeAgo()})
        </span>
      )}
    </div>
  );
};

export default SaveIndicator;