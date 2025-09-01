import { useEffect, useRef } from 'react';

/**
 * Hook to warn users about unsaved changes before they leave the page
 * @param isDirty - Whether there are unsaved changes
 * @param message - Optional custom message (browsers often ignore this)
 */
export const useBeforeUnload = (
  isDirty: boolean,
  message: string = 'You have unsaved changes. Are you sure you want to leave?'
) => {
  const savedValueRef = useRef(isDirty);

  useEffect(() => {
    savedValueRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (savedValueRef.current) {
        // Modern browsers require returnValue to be set
        event.returnValue = message;
        // For older browsers
        return message;
      }
    };

    // Add event listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [message]);
};