/**
 * ValidationWarning Component
 * Displays warning messages when approaching limits
 */

import React from 'react';
import { useValidation } from '../contexts/ValidationContext';

const ValidationWarning: React.FC = () => {
  const { warnings } = useValidation();

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {warnings.map((warning, index) => (
        <div
          key={`${warning.type}-${index}`}
          className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md"
        >
          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">
              {warning.message}
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              {warning.current} / {warning.limit} used
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-24">
            <div className="bg-yellow-200 rounded-full h-2">
              <div 
                className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((warning.current / warning.limit) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ValidationWarning;