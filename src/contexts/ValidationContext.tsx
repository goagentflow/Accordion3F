/**
 * ValidationContext
 * Provides validation state and feedback mechanisms for UI components
 * Ensures users receive immediate, clear feedback on invalid inputs
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ValidationService, VALIDATION_LIMITS } from '../services/ValidationService';

// Types for validation errors and warnings
interface ValidationWarning {
  type: 'assets' | 'tasks' | 'custom_tasks';
  message: string;
  current: number;
  limit: number;
}

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'success' | 'info';
  duration: number;
}

interface ValidationContextType {
  // Error management
  errors: Record<string, string>;
  setFieldError: (field: string, error: string | null) => void;
  clearFieldError: (field: string) => void;
  clearAllErrors: () => void;
  
  // Warning management
  warnings: ValidationWarning[];
  checkLimitWarning: (type: 'assets' | 'tasks' | 'custom_tasks', current: number) => void;
  
  // Toast notifications
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  dismissToast: (id: string) => void;
  
  // Validation helpers
  validateField: (field: string, value: any, validationType: 'asset' | 'task' | 'duration' | 'date') => boolean;
  isFormValid: (fields: string[]) => boolean;
  
  // Limit checking
  canAddAsset: (currentCount: number) => boolean;
  canAddTask: (currentCount: number) => boolean;
  canAddCustomTask: (currentCount: number) => boolean;
}

const ValidationContext = createContext<ValidationContextType | undefined>(undefined);

export function ValidationProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Set or clear a field error
  const setFieldError = useCallback((field: string, error: string | null) => {
    setErrors(prev => {
      if (error === null) {
        const { [field]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [field]: error };
    });
  }, []);

  // Clear a specific field error
  const clearFieldError = useCallback((field: string) => {
    setFieldError(field, null);
  }, [setFieldError]);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Check and set limit warnings
  const checkLimitWarning = useCallback((type: 'assets' | 'tasks' | 'custom_tasks', current: number) => {
    const limits = {
      assets: VALIDATION_LIMITS.MAX_ASSETS,
      tasks: VALIDATION_LIMITS.MAX_TASKS,
      custom_tasks: VALIDATION_LIMITS.MAX_CUSTOM_TASKS
    };

    const limit = limits[type];
    const threshold = Math.floor(limit * 0.8); // Warn at 80% capacity

    setWarnings(prev => {
      // Remove existing warning for this type
      const filtered = prev.filter(w => w.type !== type);

      // Add new warning if approaching limit
      if (current >= threshold && current < limit) {
        return [...filtered, {
          type,
          message: `Approaching ${type.replace('_', ' ')} limit`,
          current,
          limit
        }];
      } else if (current >= limit) {
        return [...filtered, {
          type,
          message: `Maximum ${type.replace('_', ' ')} limit reached`,
          current,
          limit
        }];
      }

      return filtered;
    });
  }, []);

  // Show toast notification
  const showToast = useCallback((message: string, type: Toast['type'] = 'info', duration: number = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, message, type, duration };

    setToasts(prev => [...prev, toast]);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, []);

  // Dismiss a toast
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Validate a field based on type
  const validateField = useCallback((field: string, value: any, validationType: 'asset' | 'task' | 'duration' | 'date'): boolean => {
    let validation: { valid: boolean; error?: string };

    switch (validationType) {
      case 'asset':
        validation = ValidationService.validateAssetName(value);
        break;
      case 'task':
        validation = ValidationService.validateTaskName(value);
        break;
      case 'duration':
        validation = ValidationService.validateDuration(value);
        break;
      case 'date':
        validation = ValidationService.validateDate(value);
        break;
      default:
        validation = { valid: true };
    }

    if (!validation.valid) {
      setFieldError(field, validation.error || 'Invalid input');
      return false;
    }

    clearFieldError(field);
    return true;
  }, [setFieldError, clearFieldError]);

  // Check if form is valid (no errors for specified fields)
  const isFormValid = useCallback((fields: string[]): boolean => {
    return fields.every(field => !errors[field]);
  }, [errors]);

  // Check if can add more items
  const canAddAsset = useCallback((currentCount: number): boolean => {
    const check = ValidationService.checkLimits('assets', currentCount);
    if (!check.allowed) {
      showToast(check.error || 'Cannot add more assets', 'error');
      return false;
    }
    return true;
  }, [showToast]);

  const canAddTask = useCallback((currentCount: number): boolean => {
    const check = ValidationService.checkLimits('tasks', currentCount);
    if (!check.allowed) {
      showToast(check.error || 'Cannot add more tasks', 'error');
      return false;
    }
    return true;
  }, [showToast]);

  const canAddCustomTask = useCallback((currentCount: number): boolean => {
    const check = ValidationService.checkLimits('custom_tasks', currentCount);
    if (!check.allowed) {
      showToast(check.error || 'Cannot add more custom tasks', 'error');
      return false;
    }
    return true;
  }, [showToast]);

  const value: ValidationContextType = {
    errors,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    warnings,
    checkLimitWarning,
    toasts,
    showToast,
    dismissToast,
    validateField,
    isFormValid,
    canAddAsset,
    canAddTask,
    canAddCustomTask
  };

  return (
    <ValidationContext.Provider value={value}>
      {children}
    </ValidationContext.Provider>
  );
}

// Hook to use validation context
export function useValidation() {
  const context = useContext(ValidationContext);
  if (context === undefined) {
    throw new Error('useValidation must be used within a ValidationProvider');
  }
  return context;
}

// Export validation components
export { default as ValidationToasts } from '../components/ValidationToasts';
export { default as ValidationError } from '../components/ValidationError';
export { default as ValidationWarning } from '../components/ValidationWarning';