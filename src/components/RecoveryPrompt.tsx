import React from 'react';

interface RecoveryPromptProps {
  isOpen: boolean;
  preview: {
    timestamp: Date;
    assetCount: number;
    taskCount: number;
    lastAction?: string;
  } | null;
  onRecover: () => void;
  onDiscard: () => void;
}

const RecoveryPrompt: React.FC<RecoveryPromptProps> = ({ 
  isOpen, 
  preview, 
  onRecover, 
  onDiscard 
}) => {
  if (!isOpen || !preview) return null;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-start space-x-3 mb-4">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Recover Previous Session?
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              We found an unsaved session from {formatDate(preview.timestamp)}
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-md p-4 mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Session Details:</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• {preview.assetCount} assets selected</li>
            <li>• {preview.taskCount} tasks in timeline</li>
            {preview.lastAction && (
              <li>• Last action: {preview.lastAction}</li>
            )}
          </ul>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onRecover}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Recover Session
          </button>
          <button
            onClick={onDiscard}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Start Fresh
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-500 text-center">
          Your work is automatically saved every 30 seconds
        </p>
      </div>
    </div>
  );
};

export default RecoveryPrompt;