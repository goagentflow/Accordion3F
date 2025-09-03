import { TimelineState } from '../types/timeline.types';

// Constants
const STORAGE_KEY = 'accordion_timeline_state';
const STORAGE_VERSION = '1.0.0';
const DEBOUNCE_DELAY = 1000; // 1 second

interface SavedState {
  version: string;
  timestamp: number;
  state: TimelineState;
  metadata: {
    projectName?: string;
    lastAction?: string;
    saveCount: number;
  };
}

export class AutoSaveManager {
  private debounceTimer: NodeJS.Timeout | null = null;
  private saveCount = 0;
  private onSaveCallback?: (status: 'saving' | 'saved' | 'error') => void;
  private lastSavedState: string | null = null;

  constructor() {
    // Check localStorage availability
    this.checkStorageAvailable();
  }

  /**
   * Check if localStorage is available
   */
  private checkStorageAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('LocalStorage not available:', e);
      return false;
    }
  }

  /**
   * Set callback for save status updates
   */
  onSaveStatusChange(callback: (status: 'saving' | 'saved' | 'error') => void) {
    this.onSaveCallback = callback;
  }

  /**
   * Save state to localStorage
   */
  saveState(state: TimelineState, metadata?: { lastAction?: string }): boolean {
    try {
      // Check if state has actually changed
      const stateString = JSON.stringify(state);
      if (stateString === this.lastSavedState) {
        return true; // No need to save, state unchanged
      }

      this.onSaveCallback?.('saving');

      const savedState: SavedState = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        state,
        metadata: {
          lastAction: metadata?.lastAction,
          saveCount: ++this.saveCount
        }
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
      this.lastSavedState = stateString;

      // Notify save complete
      setTimeout(() => {
        this.onSaveCallback?.('saved');
      }, 500);

      return true;
    } catch (error) {
      console.error('Failed to save state:', error);
      this.onSaveCallback?.('error');
      
      // Check if quota exceeded
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.handleQuotaExceeded();
      }
      
      return false;
    }
  }

  /**
   * Load state from localStorage
   */
  loadState(): SavedState | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const parsed = JSON.parse(saved) as SavedState;
      
      // Version check
      if (parsed.version !== STORAGE_VERSION) {
        console.warn('Saved state version mismatch');
        // Could implement migration logic here
      }

      return parsed;
    } catch (error) {
      console.error('Failed to load state:', error);
      return null;
    }
  }

  /**
   * Clear saved state
   */
  clearState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      this.lastSavedState = null;
      this.saveCount = 0;
    } catch (error) {
      console.error('Failed to clear state:', error);
    }
  }

  /**
   * Save immediately without debounce delay
   */
  immediatelySave(state: TimelineState, metadata?: { lastAction?: string }): boolean {
    // Clear any pending debounced save
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    return this.saveState(state, metadata);
  }

  /**
   * Debounced save - saves after a delay with no further calls
   */
  debouncedSave(state: TimelineState, metadata?: { lastAction?: string }): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.saveState(state, metadata);
    }, DEBOUNCE_DELAY);
  }

  /**
   * Get save status information
   */
  getSaveInfo(): { 
    lastSaved: Date | null; 
    saveCount: number;
    storageUsed: number;
  } {
    const saved = this.loadState();
    
    // Calculate approximate storage usage
    let storageUsed = 0;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      storageUsed = data ? new Blob([data]).size : 0;
    } catch (e) {
      // Ignore
    }

    return {
      lastSaved: saved ? new Date(saved.timestamp) : null,
      saveCount: this.saveCount,
      storageUsed
    };
  }

  /**
   * Handle quota exceeded error
   */
  private handleQuotaExceeded(): void {
    // Try to clear old data or compress
    console.warn('LocalStorage quota exceeded. Attempting cleanup...');
    
    // Could implement compression or cleanup of old data
    // For now, just warn the user
    if (this.onSaveCallback) {
      this.onSaveCallback('error');
    }
  }

  /**
   * Check if there's a recoverable session
   */
  hasRecoverableSession(): boolean {
    const saved = this.loadState();
    if (!saved) return false;

    // Check if saved within last 24 hours
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return saved.timestamp > dayAgo;
  }

  /**
   * Get recovery preview
   */
  getRecoveryPreview(): {
    timestamp: Date;
    assetCount: number;
    taskCount: number;
    lastAction?: string;
  } | null {
    const saved = this.loadState();
    if (!saved) return null;

    // Defensive checks for nested structure
    const assets = saved.state.assets || {} as any;
    const tasks = saved.state.tasks || {} as any;
    
    return {
      timestamp: new Date(saved.timestamp),
      assetCount: Array.isArray(assets.selected) ? assets.selected.length : 0,
      taskCount: Array.isArray(tasks.timeline) ? tasks.timeline.length : 0,
      lastAction: saved.metadata?.lastAction
    };
  }
}