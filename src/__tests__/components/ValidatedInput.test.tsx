/**
 * ValidatedInput Component Tests
 * Tests the critical validation UI component
 * Ensures errors display correctly and validation works
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ValidatedInput from '../../components/ValidatedInput';
import { ValidationProvider } from '../../contexts/ValidationContext';

// Helper to render component with ValidationContext
const renderWithValidation = (ui: React.ReactElement) => {
  return render(
    <ValidationProvider>
      {ui}
    </ValidationProvider>
  );
};

describe('ValidatedInput Component', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  // ============================================
  // Basic Rendering Tests
  // ============================================

  describe('Rendering', () => {
    it('should render input with label', () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
          label="Task Name"
          placeholder="Enter task..."
        />
      );

      expect(screen.getByLabelText('Task Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter task...')).toBeInTheDocument();
    });

    it('should show required indicator when required', () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
          label="Task Name"
          required
        />
      );

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
          disabled
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('bg-gray-100');
    });
  });

  // ============================================
  // Validation Error Display Tests
  // ============================================

  describe('Error Display', () => {
    it('should show error with red border when validation fails', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
          label="Task Name"
          required
        />
      );

      const input = screen.getByRole('textbox');
      
      // Focus and blur to trigger validation
      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveClass('border-red-500');
      });
    });

    it('should display error message below input', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
          required
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText('Task name is required')).toBeInTheDocument();
      });
    });

    it('should clear error when user starts typing', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
          required
        />
      );

      const input = screen.getByRole('textbox');
      
      // Trigger error
      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText('Task name is required')).toBeInTheDocument();
      });

      // Start typing to clear error
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: 'New Task' } });

      await waitFor(() => {
        expect(screen.queryByText('Task name is required')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Success Indicator Tests
  // ============================================

  describe('Success Indicator', () => {
    it('should show green checkmark for valid input', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value="Valid Task Name"
          onChange={mockOnChange}
          validationType="task"
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        // Look for success checkmark SVG
        const successIcon = screen.getByRole('textbox').parentElement?.querySelector('.text-green-500');
        expect(successIcon).toBeInTheDocument();
      });
    });

    it('should not show checkmark for empty optional field', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
          required={false}
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        const successIcon = screen.getByRole('textbox').parentElement?.querySelector('.text-green-500');
        expect(successIcon).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Validation Type Tests
  // ============================================

  describe('Validation Types', () => {
    it('should validate asset names correctly', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value={'A'.repeat(101)} // Too long
          onChange={mockOnChange}
          validationType="asset"
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/must be less than/)).toBeInTheDocument();
      });
    });

    it('should validate duration correctly', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value="500" // Too large
          onChange={mockOnChange}
          validationType="duration"
          type="number"
        />
      );

      const input = screen.getByRole('spinbutton');
      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/cannot exceed/)).toBeInTheDocument();
      });
    });

    it('should validate dates correctly', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value="1960-01-01" // Too far in past
          onChange={mockOnChange}
          validationType="date"
          type="date"
        />
      );

      const input = screen.getByDisplayValue('1960-01-01');
      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText(/too far in the past/)).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // onChange Callback Tests
  // ============================================

  describe('onChange Callback', () => {
    it('should call onChange with value and validity', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Task' } });

      expect(mockOnChange).toHaveBeenCalledWith('New Task', true);
    });

    it('should pass false validity for invalid input', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="duration"
          type="number"
        />
      );

      const input = screen.getByRole('spinbutton');
      
      // First touch the field
      fireEvent.focus(input);
      fireEvent.blur(input);
      
      // Then enter invalid value
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '500' } });

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(500, false);
      });
    });
  });

  // ============================================
  // Accessibility Tests
  // ============================================

  describe('Accessibility', () => {
    it('should have proper ARIA attributes when invalid', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
          required
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-describedby', 'test-input-error');
      });
    });

    it('should associate label with input', () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
          label="Task Name"
        />
      );

      const input = screen.getByLabelText('Task Name');
      expect(input).toHaveAttribute('id', 'test-input');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle rapid value changes', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value=""
          onChange={mockOnChange}
          validationType="task"
        />
      );

      const input = screen.getByRole('textbox');
      
      // Simulate rapid typing
      fireEvent.change(input, { target: { value: 'A' } });
      fireEvent.change(input, { target: { value: 'AB' } });
      fireEvent.change(input, { target: { value: 'ABC' } });

      expect(mockOnChange).toHaveBeenCalledTimes(3);
    });

    it('should sanitize XSS attempts', async () => {
      renderWithValidation(
        <ValidatedInput
          id="test-input"
          value="<script>alert('xss')</script>"
          onChange={mockOnChange}
          validationType="task"
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);
      fireEvent.blur(input);

      // Should not have any script tags in the value
      expect(input.value).not.toContain('<script>');
    });
  });
});