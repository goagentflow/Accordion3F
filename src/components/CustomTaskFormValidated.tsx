/**
 * CustomTaskFormValidated Component
 * Form for adding custom tasks with complete validation
 * Provides real-time feedback on all inputs
 */

import React, { useState, useCallback } from 'react';
import ValidatedInput from './ValidatedInput';
import { useValidation } from '../contexts/ValidationContext';
import { VALIDATION_LIMITS } from '../services/ValidationService';

interface CustomTaskFormValidatedProps {
  assetType: string;
  onAddTask: (
    name: string,
    duration: number,
    owner: 'c' | 'm' | 'a' | 'l',
    assetType: string,
    insertAfterTaskId?: string
  ) => void;
  onCancel: () => void;
  customTaskCount: number;
  insertAfterTaskId?: string;
}

const CustomTaskFormValidated = React.memo<CustomTaskFormValidatedProps>(({
  assetType,
  onAddTask,
  onCancel,
  customTaskCount,
  insertAfterTaskId
}) => {
  const { isFormValid, showToast, clearAllErrors } = useValidation();
  
  // Form state
  const [taskName, setTaskName] = useState('');
  const [duration, setDuration] = useState<number>(1);
  const [owner, setOwner] = useState<'c' | 'm' | 'a' | 'l'>('c');
  const [nameValid, setNameValid] = useState(true);
  const [durationValid, setDurationValid] = useState(true);

  // Check if at custom task limit
  const isAtLimit = customTaskCount >= VALIDATION_LIMITS.MAX_CUSTOM_TASKS;
  const nearLimit = customTaskCount >= VALIDATION_LIMITS.MAX_CUSTOM_TASKS - 10;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    // Check limit first
    if (isAtLimit) {
      showToast(`Maximum custom task limit (${VALIDATION_LIMITS.MAX_CUSTOM_TASKS}) reached`, 'error');
      return;
    }

    // Check if form is valid
    if (!isFormValid(['custom-task-name', 'custom-task-duration'])) {
      showToast('Please fix the errors before submitting', 'error');
      return;
    }

    // Additional validation check
    if (!taskName.trim()) {
      showToast('Task name is required', 'error');
      return;
    }

    if (!nameValid || !durationValid) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    // Submit the task
    onAddTask(taskName, duration, owner, assetType, insertAfterTaskId);
    
    // Reset form
    setTaskName('');
    setDuration(1);
    setOwner('c');
    clearAllErrors();
    showToast('Custom task added successfully', 'success');
  }, [
    taskName,
    duration,
    owner,
    assetType,
    insertAfterTaskId,
    isAtLimit,
    nameValid,
    durationValid,
    isFormValid,
    onAddTask,
    showToast,
    clearAllErrors
  ]);

  const handleCancel = useCallback(() => {
    clearAllErrors();
    onCancel();
  }, [clearAllErrors, onCancel]);

  return (
    <form onSubmit={handleSubmit} className="custom-task-form bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Add Custom Task
        {assetType && (
          <span className="ml-2 text-sm font-normal text-gray-600">
            for {assetType}
          </span>
        )}
      </h3>

      {/* Warning when approaching limit */}
      {nearLimit && !isAtLimit && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ Approaching custom task limit. You can add {VALIDATION_LIMITS.MAX_CUSTOM_TASKS - customTaskCount} more tasks.
          </p>
        </div>
      )}

      {/* Task Name Input */}
      <div className="mb-4">
        <ValidatedInput
          id="custom-task-name"
          value={taskName}
          onChange={(value, isValid) => {
            if (typeof value === 'string') {
              setTaskName(value);
              setNameValid(isValid);
            }
          }}
          validationType="task"
          label="Task Name"
          placeholder="Enter task name..."
          required
          disabled={isAtLimit}
          autoFocus
        />
        <p className="text-xs text-gray-500 mt-1">
          Maximum {VALIDATION_LIMITS.MAX_TASK_NAME_LENGTH} characters
        </p>
      </div>

      {/* Duration Input */}
      <div className="mb-4">
        <ValidatedInput
          id="custom-task-duration"
          value={duration}
          onChange={(value, isValid) => {
            setDuration(typeof value === 'number' ? value : parseInt(String(value)) || 1);
            setDurationValid(isValid);
          }}
          validationType="duration"
          label="Duration (days)"
          type="number"
          min={VALIDATION_LIMITS.MIN_DURATION}
          max={VALIDATION_LIMITS.MAX_DURATION}
          required
          disabled={isAtLimit}
        />
        <p className="text-xs text-gray-500 mt-1">
          Between {VALIDATION_LIMITS.MIN_DURATION} and {VALIDATION_LIMITS.MAX_DURATION} days
        </p>
      </div>

      {/* Owner Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Owner <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'c', label: 'Client', color: 'blue' },
            { value: 'm', label: 'Mail+', color: 'green' },
            { value: 'a', label: 'Agency', color: 'purple' },
            { value: 'l', label: 'Legal', color: 'red' }
          ].map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setOwner(option.value as 'c' | 'm' | 'a' | 'l')}
              disabled={isAtLimit}
              className={`px-4 py-2 rounded-md border-2 transition-all ${
                owner === option.value
                  ? `border-${option.color}-500 bg-${option.color}-50 text-${option.color}-700 font-medium`
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              } ${isAtLimit ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Position Info */}
      {insertAfterTaskId && (
        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            ℹ️ This task will be inserted after the selected task
          </p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isAtLimit || !taskName || !nameValid || !durationValid}
          className={`px-6 py-2 rounded-md font-medium transition-colors ${
            isAtLimit || !taskName || !nameValid || !durationValid
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isAtLimit ? 'Limit Reached' : 'Add Task'}
        </button>
      </div>
    </form>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo - only re-render when form-relevant props change
  
  return (
    prevProps.assetType === nextProps.assetType &&
    prevProps.customTaskCount === nextProps.customTaskCount &&
    prevProps.insertAfterTaskId === nextProps.insertAfterTaskId
    // Function props (onAddTask, onCancel) assumed to be memoized via useCallback
  );
});

CustomTaskFormValidated.displayName = 'CustomTaskFormValidated';

export default CustomTaskFormValidated;