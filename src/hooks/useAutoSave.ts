import { useEffect, useRef, useState, useCallback } from 'react';
import { TimelineState } from '../types/timeline.types';
import { AutoSaveManager } from '../services/AutoSaveManager';
import { useBeforeUnload } from './useBeforeUnload';

interface AutoSaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  message: string;
  isDirty: boolean;
}

export const useAutoSave = (
  state: TimelineState,
  enabled: boolean = true
) => {
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>({
    status: 'idle',
    lastSaved: null,
    message: '',
    isDirty: false
  });

  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const [recoveryPreview, setRecoveryPreview] = useState<any>(null);

  const managerRef = useRef<AutoSaveManager | null>(null);
  const lastActionRef = useRef<string>('');

  // Initialize manager
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new AutoSaveManager();
      
      // Set up status callback
      managerRef.current.onSaveStatusChange((status) => {
        setSaveStatus(prev => ({
          ...prev,
          status,
          lastSaved: status === 'saved' ? new Date() : prev.lastSaved,
          message: getStatusMessage(status),
          isDirty: status === 'saving' ? true : status === 'saved' ? false : prev.isDirty
        }));
      });

      // Check for recoverable session on mount
      if (managerRef.current.hasRecoverableSession()) {
        const preview = managerRef.current.getRecoveryPreview();
        setRecoveryPreview(preview);
        setShowRecoveryPrompt(true);
      }
    }
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!enabled || !managerRef.current) return;

    // Start auto-save
    managerRef.current.startAutoSave(() => state);

    return () => {
      managerRef.current?.stopAutoSave();
    };
  }, [state, enabled]);

  // Track meaningful state changes for debounced save
  // We'll use this more selectively in the action dispatchers
  const triggerSave = useCallback((action: string) => {
    if (!enabled || !managerRef.current) return;
    
    // Mark as dirty immediately when action happens
    setSaveStatus(prev => ({ ...prev, isDirty: true }));
    
    lastActionRef.current = action;
    managerRef.current.debouncedSave(state, { 
      lastAction: action 
    });
  }, [state, enabled]);

  // Manual save function
  const saveNow = useCallback((action?: string) => {
    if (!managerRef.current) return false;
    
    lastActionRef.current = action || 'manual-save';
    return managerRef.current.saveState(state, { 
      lastAction: lastActionRef.current 
    });
  }, [state]);

  // Recover session
  const recoverSession = useCallback(() => {
    if (!managerRef.current) return null;

    const saved = managerRef.current.loadState();
    setShowRecoveryPrompt(false);
    
    if (saved) {
      setSaveStatus({
        status: 'saved',
        lastSaved: new Date(saved.timestamp),
        message: 'Session recovered',
        isDirty: false
      });
      return saved.state;
    }
    
    return null;
  }, []);

  // Discard recovery
  const discardRecovery = useCallback(() => {
    if (!managerRef.current) return;
    
    managerRef.current.clearState();
    setShowRecoveryPrompt(false);
    setRecoveryPreview(null);
  }, []);

  // Clear all saved data
  const clearSavedData = useCallback(() => {
    if (!managerRef.current) return;
    
    managerRef.current.clearState();
    setSaveStatus({
      status: 'idle',
      lastSaved: null,
      message: 'Saved data cleared',
      isDirty: false
    });
  }, []);

  // Track action for better save context
  const trackAction = useCallback((action: string) => {
    lastActionRef.current = action;
  }, []);

  // Use beforeunload hook to warn about unsaved changes
  useBeforeUnload(
    saveStatus.isDirty,
    'You have unsaved changes. Are you sure you want to leave?'
  );

  return {
    saveStatus,
    saveNow,
    triggerSave,
    recoverSession,
    discardRecovery,
    clearSavedData,
    trackAction,
    showRecoveryPrompt,
    recoveryPreview
  };
};

// Helper function for status messages
function getStatusMessage(status: 'idle' | 'saving' | 'saved' | 'error'): string {
  switch (status) {
    case 'saving':
      return 'Saving...';
    case 'saved':
      return 'All changes saved';
    case 'error':
      return 'Failed to save';
    default:
      return '';
  }
}