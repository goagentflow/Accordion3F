/**
 * TaskDurationInputValidated Component
 * Inline duration editor for Gantt chart tasks with validation
 * Provides immediate feedback on invalid durations
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useValidation } from '../contexts/ValidationContext';
import { ValidationService, VALIDATION_LIMITS } from '../services/ValidationService';

interface TaskDurationInputValidatedProps {
  taskId: string;
  initialDuration: number;
  onUpdate: (duration: number) => void;
  onCancel: () => void;
  taskName: string;
}

const TaskDurationInputValidated: React.FC<TaskDurationInputValidatedProps> = ({
  taskId,
  initialDuration,
  onUpdate,
  onCancel,
  taskName
}) => {
  const { showToast } = useValidation();
  const [duration, setDuration] = useState<string>(String(initialDuration));
  const [error, setError] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = useCallback(() => {
    // Validate duration
    const validation = ValidationService.validateDuration(duration);
    
    if (!validation.valid) {
      setError(validation.error || 'Invalid duration');
      showToast(validation.error || 'Invalid duration', 'error');
      return;
    }

    // Clear error and update
    setError('');
    onUpdate(validation.value);
    showToast(`Duration updated to ${validation.value} days`, 'success');
  }, [duration, onUpdate, showToast]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleSubmit, onCancel]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDuration(value);
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }

    // Provide immediate feedback for obviously invalid values
    if (value && !isNaN(Number(value))) {
      const num = Number(value);
      if (num < VALIDATION_LIMITS.MIN_DURATION) {
        setError(`Minimum ${VALIDATION_LIMITS.MIN_DURATION} day`);
      } else if (num > VALIDATION_LIMITS.MAX_DURATION) {
        setError(`Maximum ${VALIDATION_LIMITS.MAX_DURATION} days`);
      }
    }
  }, [error]);

  const handleBlur = useCallback(() => {
    // If user clicks away, try to save or cancel
    if (duration === String(initialDuration)) {
      onCancel();
    } else {
      handleSubmit();
    }
  }, [duration, initialDuration, handleSubmit, onCancel]);

  return (
    <div className="inline-block">
      <div className="relative">
        <input
          ref={inputRef}
          type="number"
          value={duration}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          min={VALIDATION_LIMITS.MIN_DURATION}
          max={VALIDATION_LIMITS.MAX_DURATION}
          className={`w-20 px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-blue-500 focus:ring-blue-500'
          }`}
          aria-label={`Duration for ${taskName}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${taskId}-error` : undefined}
        />
        
        {/* Validation indicator */}
        {error && (
          <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2">
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Error message tooltip */}
      {error && (
        <div className="absolute z-10 mt-1 p-2 bg-red-50 border border-red-200 rounded-md shadow-lg">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
      
      {/* Helper text */}
      <div className="absolute z-10 mt-1 text-xs text-gray-500 whitespace-nowrap">
        Press Enter to save, Esc to cancel
      </div>
    </div>
  );
};

export default TaskDurationInputValidated;