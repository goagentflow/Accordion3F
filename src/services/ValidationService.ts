/**
 * ValidationService
 * Provides comprehensive input validation and sanitization
 * Prevents XSS attacks, SQL injection, and ensures data integrity
 */

// Constants for validation limits
export const VALIDATION_LIMITS = {
  MAX_TASK_NAME_LENGTH: 200,
  MAX_ASSET_NAME_LENGTH: 100,
  MIN_DURATION: 1,
  MAX_DURATION: 365,
  MIN_DATE: new Date('1970-01-01'),
  MAX_DATE: new Date('2100-12-31'),
  MAX_TASKS: 500,
  MAX_ASSETS: 50,
  MAX_CUSTOM_TASKS: 100,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_FILE_EXTENSIONS: ['.xlsx', '.xls'],
  MAX_UNDO_HISTORY: 50
};

// HTML entities that need escaping
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

export class ValidationService {
  /**
   * Sanitize text input to prevent XSS attacks
   */
  static sanitizeText(input: string, maxLength?: number): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove leading/trailing whitespace
    let sanitized = input.trim();

    // First remove dangerous patterns before encoding
    // Remove any script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove any inline event handlers (before HTML encoding)
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, ''); // Also catch unquoted handlers

    // Now escape HTML entities (allow forward slashes and ampersands so names like Video/Edits and Creative & Posters render correctly)
    sanitized = sanitized.replace(/[<>"'`=]/g, (char) => HTML_ENTITIES[char] || char);

    // Apply length limit if specified
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Validate task name
   */
  static validateTaskName(name: string): { valid: boolean; error?: string; sanitized: string } {
    // First check length before sanitization truncates it
    const tooLong = name && name.length > VALIDATION_LIMITS.MAX_TASK_NAME_LENGTH;
    
    // Now sanitize (which may truncate)
    const sanitized = this.sanitizeText(name, VALIDATION_LIMITS.MAX_TASK_NAME_LENGTH);

    if (!sanitized || sanitized.length === 0) {
      return { 
        valid: false, 
        error: 'Task name is required',
        sanitized 
      };
    }

    if (tooLong) {
      return { 
        valid: false, 
        error: `Task name must be less than ${VALIDATION_LIMITS.MAX_TASK_NAME_LENGTH} characters`,
        sanitized
      };
    }

    return { valid: true, sanitized };
  }

  /**
   * Validate asset name
   */
  static validateAssetName(name: string): { valid: boolean; error?: string; sanitized: string } {
    // First check length before sanitization truncates it
    const tooLong = name && name.length > VALIDATION_LIMITS.MAX_ASSET_NAME_LENGTH;
    
    // Now sanitize (which may truncate)
    const sanitized = this.sanitizeText(name, VALIDATION_LIMITS.MAX_ASSET_NAME_LENGTH);

    if (!sanitized || sanitized.length === 0) {
      return { 
        valid: false, 
        error: 'Asset name is required',
        sanitized 
      };
    }

    if (tooLong) {
      return { 
        valid: false, 
        error: `Asset name must be less than ${VALIDATION_LIMITS.MAX_ASSET_NAME_LENGTH} characters`,
        sanitized
      };
    }

    return { valid: true, sanitized };
  }

  /**
   * Validate task duration
   */
  static validateDuration(duration: number | string): { valid: boolean; error?: string; value: number } {
    const numValue = typeof duration === 'string' ? parseInt(duration, 10) : duration;

    if (isNaN(numValue)) {
      return { 
        valid: false, 
        error: 'Duration must be a number',
        value: VALIDATION_LIMITS.MIN_DURATION 
      };
    }

    if (numValue < VALIDATION_LIMITS.MIN_DURATION) {
      return { 
        valid: false, 
        error: `Duration must be at least ${VALIDATION_LIMITS.MIN_DURATION} day`,
        value: VALIDATION_LIMITS.MIN_DURATION 
      };
    }

    if (numValue > VALIDATION_LIMITS.MAX_DURATION) {
      return { 
        valid: false, 
        error: `Duration cannot exceed ${VALIDATION_LIMITS.MAX_DURATION} days`,
        value: VALIDATION_LIMITS.MAX_DURATION 
      };
    }

    return { valid: true, value: numValue };
  }

  /**
   * Validate date input
   */
  static validateDate(date: string | Date): { valid: boolean; error?: string; value: Date | null } {
    let dateObj: Date;

    if (typeof date === 'string') {
      // Check for common date format patterns to prevent injection
      if (!/^\d{4}-\d{2}-\d{2}/.test(date)) {
        return { 
          valid: false, 
          error: 'Invalid date format',
          value: null 
        };
      }
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }

    if (isNaN(dateObj.getTime())) {
      return { 
        valid: false, 
        error: 'Invalid date',
        value: null 
      };
    }

    if (dateObj < VALIDATION_LIMITS.MIN_DATE) {
      return { 
        valid: false, 
        error: 'Date is too far in the past',
        value: null 
      };
    }

    if (dateObj > VALIDATION_LIMITS.MAX_DATE) {
      return { 
        valid: false, 
        error: 'Date is too far in the future',
        value: null 
      };
    }

    return { valid: true, value: dateObj };
  }

  /**
   * Validate file upload
   */
  static validateFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { 
        valid: false, 
        error: 'No file selected' 
      };
    }

    // Check file size
    if (file.size > VALIDATION_LIMITS.MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: `File size must be less than ${VALIDATION_LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB` 
      };
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const hasValidExtension = VALIDATION_LIMITS.ALLOWED_FILE_EXTENSIONS.some(
      ext => fileName.endsWith(ext)
    );

    if (!hasValidExtension) {
      return { 
        valid: false, 
        error: `File must be an Excel file (${VALIDATION_LIMITS.ALLOWED_FILE_EXTENSIONS.join(', ')})` 
      };
    }

    // Additional MIME type check for security
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (!validMimeTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: 'Invalid file type' 
      };
    }

    return { valid: true };
  }

  /**
   * Check if adding more items would exceed limits
   */
  static checkLimits(
    type: 'tasks' | 'assets' | 'custom_tasks',
    currentCount: number
  ): { allowed: boolean; error?: string } {
    const limits = {
      tasks: VALIDATION_LIMITS.MAX_TASKS,
      assets: VALIDATION_LIMITS.MAX_ASSETS,
      custom_tasks: VALIDATION_LIMITS.MAX_CUSTOM_TASKS
    };

    const limit = limits[type];
    
    if (currentCount >= limit) {
      return { 
        allowed: false, 
        error: `Maximum ${type.replace('_', ' ')} limit (${limit}) reached` 
      };
    }

    return { allowed: true };
  }

  /**
   * Sanitize CSV data
   */
  static sanitizeCsvRow(row: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(row)) {
      // Sanitize both keys and values
      const sanitizedKey = this.sanitizeText(key, 50);
      const sanitizedValue = this.sanitizeText(String(value || ''), 500);
      sanitized[sanitizedKey] = sanitizedValue;
    }
    
    return sanitized;
  }

  /**
   * Validate state for import
   */
  static validateImportedState(state: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if it's an object
    if (typeof state !== 'object' || state === null) {
      errors.push('Invalid state format');
      return { valid: false, errors };
    }

    // Check required properties
    const requiredProps = ['assets', 'tasks', 'dates', 'ui'];
    for (const prop of requiredProps) {
      if (!(prop in state)) {
        errors.push(`Missing required property: ${prop}`);
      }
    }

    // Validate array lengths
    if (state.assets?.selected?.length > VALIDATION_LIMITS.MAX_ASSETS) {
      errors.push(`Too many assets (max ${VALIDATION_LIMITS.MAX_ASSETS})`);
    }

    if (state.tasks?.timeline?.length > VALIDATION_LIMITS.MAX_TASKS) {
      errors.push(`Too many tasks (max ${VALIDATION_LIMITS.MAX_TASKS})`);
    }

    return { 
      valid: errors.length === 0, 
      errors 
    };
  }

  /**
   * Create safe error message for users
   */
  static createUserMessage(error: Error | string): string {
    const errorStr = error instanceof Error ? error.message : String(error);
    
    // Map technical errors to user-friendly messages
    const errorMap: Record<string, string> = {
      'QuotaExceededError': 'Storage space is full. Please clear some data and try again.',
      'NetworkError': 'Network connection lost. Please check your connection and try again.',
      'SyntaxError': 'Invalid data format. Please check your input and try again.',
      'TypeError': 'Unexpected data type. Please refresh and try again.',
      'RangeError': 'Value is out of acceptable range. Please check your input.',
      'ECONNREFUSED': 'Could not connect to server. Please try again later.',
      '404': 'Resource not found. Please refresh the page.',
      '500': 'Server error. Please try again later.',
      'timeout': 'Operation took too long. Please try again.'
    };

    // Check if we have a user-friendly version
    for (const [key, message] of Object.entries(errorMap)) {
      if (errorStr.includes(key)) {
        return message;
      }
    }

    // Generic message if no match
    return 'Something went wrong. Please try again or contact support if the issue persists.';
  }
}
