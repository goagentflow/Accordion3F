/**
 * ValidationService Unit Tests
 * Tests all validation and sanitization logic
 * Ensures security and data integrity
 */

import { ValidationService, VALIDATION_LIMITS } from '../../services/ValidationService';

describe('ValidationService', () => {
  
  // ============================================
  // Text Sanitization Tests
  // ============================================
  
  describe('sanitizeText', () => {
    it('should remove leading and trailing whitespace', () => {
      expect(ValidationService.sanitizeText('  hello  ')).toBe('hello');
      expect(ValidationService.sanitizeText('\t\ntest\r\n')).toBe('test');
    });

    it('should escape HTML entities to prevent XSS', () => {
      // Script tags are removed completely, not escaped
      expect(ValidationService.sanitizeText('<script>alert("XSS")</script>'))
        .toBe('');
      
      // Ampersands are now allowed for names like "Creative & Posters"
      expect(ValidationService.sanitizeText('Hello & goodbye'))
        .toBe('Hello & goodbye');
      
      expect(ValidationService.sanitizeText('"Quotes" and \'apostrophes\''))
        .toBe('&quot;Quotes&quot; and &#39;apostrophes&#39;');
        
      // Test other dangerous characters are still escaped
      expect(ValidationService.sanitizeText('<div>content</div>'))
        .toBe('&lt;div&gt;content&lt;/div&gt;');
    });

    it('should remove script tags completely', () => {
      const input = 'Before<script>malicious code</script>After';
      const result = ValidationService.sanitizeText(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('should remove inline event handlers', () => {
      const input = '<div onclick="alert(\'XSS\')">Click me</div>';
      const result = ValidationService.sanitizeText(input);
      expect(result).not.toContain('onclick');
    });

    it('should respect max length limit', () => {
      const longText = 'a'.repeat(200);
      const result = ValidationService.sanitizeText(longText, 100);
      expect(result).toHaveLength(100);
    });

    it('should handle non-string inputs safely', () => {
      expect(ValidationService.sanitizeText(null as any)).toBe('');
      expect(ValidationService.sanitizeText(undefined as any)).toBe('');
      expect(ValidationService.sanitizeText(123 as any)).toBe('');
    });
  });

  // ============================================
  // Task Name Validation Tests
  // ============================================
  
  describe('validateTaskName', () => {
    it('should accept valid task names', () => {
      const result = ValidationService.validateTaskName('Deploy to Production');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Deploy to Production');
      expect(result.error).toBeUndefined();
    });

    it('should reject empty task names', () => {
      const result = ValidationService.validateTaskName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Task name is required');
    });

    it('should reject task names that are too long', () => {
      const longName = 'a'.repeat(VALIDATION_LIMITS.MAX_TASK_NAME_LENGTH + 1);
      const result = ValidationService.validateTaskName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than');
      expect(result.sanitized).toHaveLength(VALIDATION_LIMITS.MAX_TASK_NAME_LENGTH);
    });

    it('should sanitize task names with XSS attempts', () => {
      const result = ValidationService.validateTaskName('<script>alert("xss")</script>Task');
      expect(result.valid).toBe(true);
      expect(result.sanitized).not.toContain('<script>');
      expect(result.sanitized).toBe('Task'); // Script tags are completely removed
    });
  });

  // ============================================
  // Asset Name Validation Tests
  // ============================================
  
  describe('validateAssetName', () => {
    it('should accept valid asset names', () => {
      const result = ValidationService.validateAssetName('Web Banner Campaign');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Web Banner Campaign');
    });

    it('should reject empty asset names', () => {
      const result = ValidationService.validateAssetName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Asset name is required');
    });

    it('should enforce max length for asset names', () => {
      const longName = 'a'.repeat(VALIDATION_LIMITS.MAX_ASSET_NAME_LENGTH + 1);
      const result = ValidationService.validateAssetName(longName);
      expect(result.valid).toBe(false);
      expect(result.sanitized).toHaveLength(VALIDATION_LIMITS.MAX_ASSET_NAME_LENGTH);
    });
  });

  // ============================================
  // Duration Validation Tests
  // ============================================
  
  describe('validateDuration', () => {
    it('should accept valid durations', () => {
      const result = ValidationService.validateDuration(5);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(5);
    });

    it('should convert string durations to numbers', () => {
      const result = ValidationService.validateDuration('10');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(10);
    });

    it('should reject durations below minimum', () => {
      const result = ValidationService.validateDuration(0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
      expect(result.value).toBe(VALIDATION_LIMITS.MIN_DURATION);
    });

    it('should reject durations above maximum', () => {
      const result = ValidationService.validateDuration(VALIDATION_LIMITS.MAX_DURATION + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed');
      expect(result.value).toBe(VALIDATION_LIMITS.MAX_DURATION);
    });

    it('should reject non-numeric durations', () => {
      const result = ValidationService.validateDuration('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Duration must be a number');
    });

    it('should handle NaN gracefully', () => {
      const result = ValidationService.validateDuration(NaN);
      expect(result.valid).toBe(false);
      expect(result.value).toBe(VALIDATION_LIMITS.MIN_DURATION);
    });
  });

  // ============================================
  // Date Validation Tests
  // ============================================
  
  describe('validateDate', () => {
    it('should accept valid dates', () => {
      const result = ValidationService.validateDate('2024-12-25');
      expect(result.valid).toBe(true);
      expect(result.value).toBeInstanceOf(Date);
      expect(result.value?.toISOString().split('T')[0]).toBe('2024-12-25');
    });

    it('should accept Date objects', () => {
      const date = new Date('2024-06-15');
      const result = ValidationService.validateDate(date);
      expect(result.valid).toBe(true);
      expect(result.value).toEqual(date);
    });

    it('should reject invalid date formats', () => {
      const result = ValidationService.validateDate('25/12/2024');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid date format');
    });

    it('should reject dates too far in the past', () => {
      const result = ValidationService.validateDate('1960-01-01');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Date is too far in the past');
    });

    it('should reject dates too far in the future', () => {
      const result = ValidationService.validateDate('2150-01-01');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Date is too far in the future');
    });

    it('should reject invalid date strings', () => {
      const result = ValidationService.validateDate('not-a-date');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid date format');
    });
  });

  // ============================================
  // File Validation Tests
  // ============================================
  
  describe('validateFile', () => {
    it('should accept valid Excel files', () => {
      const file = new File(['content'], 'test.xlsx', { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const result = ValidationService.validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject files that are too large', () => {
      const largeContent = new Uint8Array(VALIDATION_LIMITS.MAX_FILE_SIZE + 1);
      const file = new File([largeContent], 'large.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const result = ValidationService.validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('less than');
    });

    it('should reject non-Excel files', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const result = ValidationService.validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an Excel file');
    });

    it('should check MIME type for security', () => {
      const file = new File(['content'], 'test.xlsx', { type: 'text/html' });
      const result = ValidationService.validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid file type');
    });

    it('should handle null file input', () => {
      const result = ValidationService.validateFile(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file selected');
    });
  });

  // ============================================
  // Limit Checking Tests
  // ============================================
  
  describe('checkLimits', () => {
    it('should allow adding items below limit', () => {
      const result = ValidationService.checkLimits('assets', 10);
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject adding items at limit', () => {
      const result = ValidationService.checkLimits('assets', VALIDATION_LIMITS.MAX_ASSETS);
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('Maximum');
      expect(result.error).toContain('reached');
    });

    it('should work for different limit types', () => {
      const taskResult = ValidationService.checkLimits('tasks', VALIDATION_LIMITS.MAX_TASKS);
      expect(taskResult.allowed).toBe(false);

      const customResult = ValidationService.checkLimits('custom_tasks', 50);
      expect(customResult.allowed).toBe(true);
    });
  });

  // ============================================
  // CSV Sanitization Tests
  // ============================================
  
  describe('sanitizeCsvRow', () => {
    it('should sanitize all values in a CSV row', () => {
      const row = {
        'Task Name': '<script>alert("xss")</script>',
        'Duration': '5',
        'Owner': 'client'
      };
      
      const result = ValidationService.sanitizeCsvRow(row);
      expect(result['Task Name']).not.toContain('<script>');
      expect(result['Duration']).toBe('5');
      expect(result['Owner']).toBe('client');
    });

    it('should handle null and undefined values', () => {
      const row = {
        'field1': null,
        'field2': undefined,
        'field3': 'value'
      };
      
      const result = ValidationService.sanitizeCsvRow(row);
      expect(result['field1']).toBe('');
      expect(result['field2']).toBe('');
      expect(result['field3']).toBe('value');
    });

    it('should sanitize both keys and values', () => {
      const row = {
        '<script>key</script>': 'value',
        'normal': '<b>value</b>'
      };
      
      const result = ValidationService.sanitizeCsvRow(row);
      const keys = Object.keys(result);
      expect(keys[0]).not.toContain('<script>');
      expect(result[keys[1]]).toContain('&lt;b&gt;');
    });
  });

  // ============================================
  // Imported State Validation Tests
  // ============================================
  
  describe('validateImportedState', () => {
    it('should accept valid state structure', () => {
      const state = {
        assets: { selected: [] },
        tasks: { timeline: [] },
        dates: {},
        ui: {}
      };
      
      const result = ValidationService.validateImportedState(state);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid state format', () => {
      const result = ValidationService.validateImportedState(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid state format');
    });

    it('should check for required properties', () => {
      const state = {
        assets: {},
        tasks: {}
        // Missing dates and ui
      };
      
      const result = ValidationService.validateImportedState(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required property: dates');
      expect(result.errors).toContain('Missing required property: ui');
    });

    it('should validate array length limits', () => {
      const state = {
        assets: { selected: new Array(VALIDATION_LIMITS.MAX_ASSETS + 1) },
        tasks: { timeline: [] },
        dates: {},
        ui: {}
      };
      
      const result = ValidationService.validateImportedState(state);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Too many assets (max ${VALIDATION_LIMITS.MAX_ASSETS})`);
    });
  });

  // ============================================
  // User Message Creation Tests
  // ============================================
  
  describe('createUserMessage', () => {
    it('should map technical errors to user-friendly messages', () => {
      const error = new Error('QuotaExceededError: Storage full');
      const message = ValidationService.createUserMessage(error);
      expect(message).toBe('Storage space is full. Please clear some data and try again.');
    });

    it('should handle network errors', () => {
      const message = ValidationService.createUserMessage('NetworkError');
      expect(message).toBe('Network connection lost. Please check your connection and try again.');
    });

    it('should provide generic message for unknown errors', () => {
      const message = ValidationService.createUserMessage('Some weird error');
      expect(message).toBe('Something went wrong. Please try again or contact support if the issue persists.');
    });

    it('should handle Error objects and strings', () => {
      const errorObj = new Error('TypeError: Cannot read property');
      const message1 = ValidationService.createUserMessage(errorObj);
      expect(message1).toBe('Unexpected data type. Please refresh and try again.');

      const message2 = ValidationService.createUserMessage('404 Not Found');
      expect(message2).toBe('Resource not found. Please refresh the page.');
    });
  });
});