import { Component, ErrorInfo, ReactNode } from 'react';
import { ValidationService } from '../services/ValidationService';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * Provides graceful error handling and recovery options
 * Follows Golden Rule #1: Safety First
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate a unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  /**
   * Log error details for debugging
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Store error info in state
    this.setState({
      errorInfo
    });

    // Call optional error handler prop
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to log to an error reporting service
    this.logErrorToService(error, errorInfo);
  }

  /**
   * Log errors to external service (placeholder for real implementation)
   */
  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // This is where you'd send errors to Sentry, LogRocket, etc.
    // For now, just store in localStorage for debugging
    try {
      const errorLog = {
        id: this.state.errorId,
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      // Store last 10 errors in localStorage
      const storedErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      storedErrors.unshift(errorLog);
      if (storedErrors.length > 10) {
        storedErrors.pop();
      }
      localStorage.setItem('app_errors', JSON.stringify(storedErrors));
    } catch (e) {
      // Fail silently if localStorage is full or unavailable
    }
  };

  /**
   * Reset error state and try again
   */
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  /**
   * Reload the entire application
   */
  handleReload = () => {
    window.location.reload();
  };

  /**
   * Download error details for support
   */
  handleDownloadErrorDetails = () => {
    const { error, errorInfo, errorId } = this.state;
    
    const errorDetails = {
      errorId,
      timestamp: new Date().toISOString(),
      error: {
        message: error?.message,
        stack: error?.stack
      },
      componentStack: errorInfo?.componentStack,
      browser: {
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    };

    const blob = new Blob([JSON.stringify(errorDetails, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error_${errorId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default fallback UI
      const userMessage = ValidationService.createUserMessage(
        this.state.error || 'An unexpected error occurred'
      );

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-6">
            {/* Error Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg 
                  className="w-8 h-8 text-red-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h2 className="text-xl font-semibold text-center text-gray-900 mb-2">
              Oops! Something went wrong
            </h2>
            
            <p className="text-center text-gray-600 mb-6">
              {userMessage}
            </p>

            {/* Error ID for support */}
            <div className="bg-gray-50 rounded p-3 mb-6">
              <p className="text-xs text-gray-500 text-center">
                Error ID: {this.state.errorId}
              </p>
            </div>

            {/* Recovery Options */}
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Reload Application
              </button>

              {/* Show details only in development */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Technical Details (Development Only)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-600 overflow-auto max-h-48">
                    <p className="font-semibold">Error:</p>
                    <pre className="whitespace-pre-wrap">{this.state.error?.message}</pre>
                    {this.state.error?.stack && (
                      <>
                        <p className="font-semibold mt-2">Stack:</p>
                        <pre className="whitespace-pre-wrap text-xs">
                          {this.state.error.stack}
                        </pre>
                      </>
                    )}
                  </div>
                </details>
              )}

              {/* Download error details for support */}
              <button
                onClick={this.handleDownloadErrorDetails}
                className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Download Error Details for Support
              </button>
            </div>

            {/* Support Contact */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-center text-gray-500">
                If this problem persists, please contact support with the error ID above
              </p>
            </div>
          </div>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;