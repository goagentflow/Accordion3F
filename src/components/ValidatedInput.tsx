/**
 * ValidatedInput Component
 * Wrapper for input fields with built-in validation
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useValidation } from '../contexts/ValidationContext';
import ValidationError from './ValidationError';

interface ValidatedInputProps {
  id: string;
  value: string | number;
  onChange: (value: string | number, isValid: boolean) => void;
  validationType: 'asset' | 'task' | 'duration' | 'date';
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  type?: 'text' | 'number' | 'date';
  min?: number;
  max?: number;
  autoFocus?: boolean;
}

const ValidatedInput: React.FC<ValidatedInputProps> = ({
  id,
  value,
  onChange,
  validationType,
  placeholder = '',
  label,
  required = false,
  className = '',
  disabled = false,
  type = 'text',
  min,
  max,
  autoFocus = false
}) => {
  const { validateField, errors, clearFieldError } = useValidation();
  const [touched, setTouched] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = type === 'number' ? e.target.valueAsNumber : e.target.value;
    setLocalValue(newValue);

    // Validate immediately if field has been touched
    if (touched) {
      const isValid = validateField(id, newValue, validationType);
      onChange(newValue, isValid);
    } else {
      // Just update value without validation on first input
      onChange(newValue, true);
    }
  }, [id, onChange, touched, validateField, validationType, type]);

  const handleBlur = useCallback(() => {
    setTouched(true);
    const isValid = validateField(id, localValue, validationType);
    if (isValid) {
      clearFieldError(id);
    }
  }, [id, localValue, validateField, validationType, clearFieldError]);

  const handleFocus = useCallback(() => {
    // Clear error when user starts typing again
    if (errors[id]) {
      clearFieldError(id);
    }
  }, [id, errors, clearFieldError]);

  const hasError = touched && errors[id];
  const inputClasses = `
    w-full px-3 py-2 border rounded-md
    transition-colors duration-200
    ${hasError 
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
      : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
    }
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
    focus:outline-none focus:ring-2 focus:ring-opacity-50
    ${className}
  `;

  return (
    <div className="mb-4">
      {label && (
        <label 
          htmlFor={id} 
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          id={id}
          type={type}
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClasses}
          min={min}
          max={max}
          autoFocus={autoFocus}
          aria-invalid={hasError ? 'true' : 'false'}
          aria-describedby={hasError ? `${id}-error` : undefined}
        />
        
        {/* Visual indicator for validation state */}
        {touched && !errors[id] && localValue && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      
      <ValidationError error={hasError ? errors[id] : undefined} />
    </div>
  );
};

export default ValidatedInput;