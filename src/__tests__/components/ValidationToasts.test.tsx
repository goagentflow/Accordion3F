/**
 * ValidationToasts Component Tests
 * Tests the toast notification system for validation feedback
 * Ensures proper display, timing, and dismissal of toasts
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ValidationToasts from '../../components/ValidationToasts';
import { ValidationProvider, useValidation } from '../../contexts/ValidationContext';

// Helper component to trigger toasts
const ToastTrigger: React.FC = () => {
  const { showError, showWarning, showSuccess, clearToast } = useValidation();
  
  return (
    <div>
      <button onClick={() => showError('test-error', 'Error message')}>
        Show Error
      </button>
      <button onClick={() => showWarning('test-warning', 'Warning message')}>
        Show Warning
      </button>
      <button onClick={() => showSuccess('test-success', 'Success message')}>
        Show Success
      </button>
      <button onClick={() => clearToast('test-error')}>
        Clear Toast
      </button>
    </div>
  );
};

// Helper to render component with ValidationContext
const renderWithValidation = (ui: React.ReactElement) => {
  return render(
    <ValidationProvider>
      {ui}
      <ValidationToasts />
    </ValidationProvider>
  );
};

describe('ValidationToasts Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ============================================
  // Basic Rendering Tests
  // ============================================

  describe('Rendering', () => {
    it('should render without any toasts initially', () => {
      renderWithValidation(<div />);
      
      const container = document.querySelector('.fixed.bottom-4.right-4');
      expect(container).toBeInTheDocument();
      expect(container?.children).toHaveLength(0);
    });

    it('should render in the correct position', () => {
      renderWithValidation(<div />);
      
      const container = document.querySelector('.fixed.bottom-4.right-4');
      expect(container).toHaveClass('fixed', 'bottom-4', 'right-4', 'z-50');
    });
  });

  // ============================================
  // Toast Display Tests
  // ============================================

  describe('Toast Display', () => {
    it('should display error toast with correct styling', async () => {
      renderWithValidation(<ToastTrigger />);
      
      const errorButton = screen.getByText('Show Error');
      fireEvent.click(errorButton);

      await waitFor(() => {
        const toast = screen.getByText('Error message');
        expect(toast).toBeInTheDocument();
        
        const toastContainer = toast.closest('div[role="alert"]');
        expect(toastContainer).toHaveClass('bg-red-50', 'border-red-200');
      });
    });

    it('should display warning toast with correct styling', async () => {
      renderWithValidation(<ToastTrigger />);
      
      const warningButton = screen.getByText('Show Warning');
      fireEvent.click(warningButton);

      await waitFor(() => {
        const toast = screen.getByText('Warning message');
        expect(toast).toBeInTheDocument();
        
        const toastContainer = toast.closest('div[role="alert"]');
        expect(toastContainer).toHaveClass('bg-yellow-50', 'border-yellow-200');
      });
    });

    it('should display success toast with correct styling', async () => {
      renderWithValidation(<ToastTrigger />);
      
      const successButton = screen.getByText('Show Success');
      fireEvent.click(successButton);

      await waitFor(() => {
        const toast = screen.getByText('Success message');
        expect(toast).toBeInTheDocument();
        
        const toastContainer = toast.closest('div[role="alert"]');
        expect(toastContainer).toHaveClass('bg-green-50', 'border-green-200');
      });
    });

    it('should display appropriate icons for each toast type', async () => {
      renderWithValidation(<ToastTrigger />);
      
      // Error toast
      fireEvent.click(screen.getByText('Show Error'));
      await waitFor(() => {
        const errorIcon = document.querySelector('.text-red-500 svg');
        expect(errorIcon).toBeInTheDocument();
      });

      // Warning toast
      fireEvent.click(screen.getByText('Show Warning'));
      await waitFor(() => {
        const warningIcon = document.querySelector('.text-yellow-500 svg');
        expect(warningIcon).toBeInTheDocument();
      });

      // Success toast
      fireEvent.click(screen.getByText('Show Success'));
      await waitFor(() => {
        const successIcon = document.querySelector('.text-green-500 svg');
        expect(successIcon).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Multiple Toasts Tests
  // ============================================

  describe('Multiple Toasts', () => {
    it('should display multiple toasts simultaneously', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Error'));
      fireEvent.click(screen.getByText('Show Warning'));
      fireEvent.click(screen.getByText('Show Success'));

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
        expect(screen.getByText('Warning message')).toBeInTheDocument();
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });
    });

    it('should stack toasts vertically', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Error'));
      fireEvent.click(screen.getByText('Show Warning'));

      await waitFor(() => {
        const toasts = screen.getAllByRole('alert');
        expect(toasts).toHaveLength(2);
        
        // Check they have spacing between them
        const container = document.querySelector('.fixed.bottom-4.right-4');
        expect(container?.children).toHaveLength(2);
      });
    });

    it('should not duplicate toasts with same ID', async () => {
      renderWithValidation(<ToastTrigger />);
      
      // Click error button twice
      fireEvent.click(screen.getByText('Show Error'));
      fireEvent.click(screen.getByText('Show Error'));

      await waitFor(() => {
        const toasts = screen.getAllByText('Error message');
        expect(toasts).toHaveLength(1); // Should only show one
      });
    });
  });

  // ============================================
  // Auto-Dismiss Tests
  // ============================================

  describe('Auto-Dismiss', () => {
    it('should auto-dismiss success toast after 3 seconds', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Success'));

      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });

      // Fast-forward 3 seconds
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });
    });

    it('should auto-dismiss warning toast after 5 seconds', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Warning'));

      await waitFor(() => {
        expect(screen.getByText('Warning message')).toBeInTheDocument();
      });

      // Fast-forward 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Warning message')).not.toBeInTheDocument();
      });
    });

    it('should keep error toast visible until manually dismissed', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Error'));

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });

      // Fast-forward 10 seconds
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Error should still be visible
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  // ============================================
  // Manual Dismiss Tests
  // ============================================

  describe('Manual Dismiss', () => {
    it('should dismiss toast when close button clicked', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Error'));

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });

      // Find and click close button
      const closeButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Error message')).not.toBeInTheDocument();
      });
    });

    it('should dismiss specific toast via clearToast', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Error'));

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Clear Toast'));

      await waitFor(() => {
        expect(screen.queryByText('Error message')).not.toBeInTheDocument();
      });
    });

    it('should only dismiss targeted toast', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Error'));
      fireEvent.click(screen.getByText('Show Warning'));

      await waitFor(() => {
        expect(screen.getByText('Error message')).toBeInTheDocument();
        expect(screen.getByText('Warning message')).toBeInTheDocument();
      });

      // Clear only the error toast
      fireEvent.click(screen.getByText('Clear Toast'));

      await waitFor(() => {
        expect(screen.queryByText('Error message')).not.toBeInTheDocument();
        expect(screen.getByText('Warning message')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Animation Tests
  // ============================================

  describe('Animations', () => {
    it('should animate toast entry', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Success'));

      await waitFor(() => {
        const toast = screen.getByText('Success message').closest('div[role="alert"]');
        expect(toast).toHaveClass('transform', 'transition-all');
      });
    });

    it('should animate toast exit', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Success'));

      await waitFor(() => {
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });

      // Trigger auto-dismiss
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Toast should animate out
      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Accessibility Tests
  // ============================================

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Error'));

      await waitFor(() => {
        const toast = screen.getByRole('alert');
        expect(toast).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('should have dismissible button with aria-label', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Error'));

      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: /dismiss/i });
        expect(closeButton).toHaveAttribute('aria-label');
      });
    });

    it('should be keyboard accessible', async () => {
      renderWithValidation(<ToastTrigger />);
      
      fireEvent.click(screen.getByText('Show Error'));

      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: /dismiss/i });
        
        // Simulate keyboard interaction
        fireEvent.keyDown(closeButton, { key: 'Enter' });
        
        expect(screen.queryByText('Error message')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty messages gracefully', async () => {
      const TestComponent = () => {
        const { showError } = useValidation();
        return (
          <button onClick={() => showError('empty', '')}>
            Empty Message
          </button>
        );
      };

      renderWithValidation(<TestComponent />);
      
      fireEvent.click(screen.getByText('Empty Message'));

      // Should not crash, might show default message or nothing
      expect(document.querySelector('.fixed.bottom-4.right-4')).toBeInTheDocument();
    });

    it('should handle very long messages', async () => {
      const TestComponent = () => {
        const { showError } = useValidation();
        const longMessage = 'Error '.repeat(100);
        return (
          <button onClick={() => showError('long', longMessage)}>
            Long Message
          </button>
        );
      };

      renderWithValidation(<TestComponent />);
      
      fireEvent.click(screen.getByText('Long Message'));

      await waitFor(() => {
        const toast = screen.getByRole('alert');
        expect(toast).toBeInTheDocument();
        
        // Should have max-width constraint
        expect(toast).toHaveClass('max-w-md');
      });
    });

    it('should handle rapid toast creation', async () => {
      const TestComponent = () => {
        const { showError } = useValidation();
        return (
          <button onClick={() => {
            for (let i = 0; i < 10; i++) {
              showError(`rapid-${i}`, `Message ${i}`);
            }
          }}>
            Rapid Fire
          </button>
        );
      };

      renderWithValidation(<TestComponent />);
      
      fireEvent.click(screen.getByText('Rapid Fire'));

      await waitFor(() => {
        const toasts = screen.getAllByRole('alert');
        expect(toasts.length).toBeGreaterThan(0);
        expect(toasts.length).toBeLessThanOrEqual(10);
      });
    });
  });
});