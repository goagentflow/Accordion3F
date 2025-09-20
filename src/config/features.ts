/**
 * Feature Flag Configuration
 * Controls experimental and new features for safe rollout
 * 
 * Following Golden Rule #1: Safety First - All new features behind flags
 * Following Golden Rule #6: PM-Friendly - Never lose work, safe rollback
 */

// ============================================
// Feature Flag Types
// ============================================

export interface FeatureFlags {
  USE_DAG_CALCULATOR: boolean;
  ENABLE_TASK_OVERLAPS: boolean;
  SHOW_CRITICAL_PATH: boolean;
  ENABLE_DEPENDENCY_UI: boolean;
  DEBUG_TIMELINE_CALCULATIONS: boolean;
  ALLOW_WEEKEND_LIVE_DATE: boolean;
  STRICT_OVERLAP_CALC?: boolean; // If true, compute overlaps without +1 inclusion
}

// ============================================
// Default Feature Configuration
// ============================================

/**
 * Default feature flags - CONSERVATIVE DEFAULTS
 * New features are OFF by default for maximum safety
 */
const DEFAULT_FLAGS: FeatureFlags = {
  // DAG Calculator - ON for drag-to-move functionality
  USE_DAG_CALCULATOR: true,
  
  // Task Overlapping UI - OFF to keep interface clean
  ENABLE_TASK_OVERLAPS: false,
  
  // Critical Path Visualization - OFF by default
  SHOW_CRITICAL_PATH: false,
  
  // Dependency Management UI - OFF by default (drag-to-move provides UI)
  ENABLE_DEPENDENCY_UI: false,
  
  // Debug Mode - ON in development only
  DEBUG_TIMELINE_CALCULATIONS: process.env.NODE_ENV === 'development',

  // Allow the final live task to land on weekend/holiday (anchor to chosen live date)
  ALLOW_WEEKEND_LIVE_DATE: true,

  // Overlap calculation mode (off by default for backwards compatibility)
  STRICT_OVERLAP_CALC: false,
};

// ============================================
// Feature Flag Manager
// ============================================

class FeatureFlagManager {
  private flags: FeatureFlags;

  constructor() {
    this.flags = this.loadFlags();
  }

  /**
   * Load feature flags from localStorage with fallback to defaults
   * Allows runtime configuration changes without code deployment
   */
  private loadFlags(): FeatureFlags {
    // Production: never load or mutate from localStorage
    if (process.env.NODE_ENV === 'production') {
      return DEFAULT_FLAGS;
    }
    // Development: allow local overrides
    try {
      const stored = localStorage.getItem('timeline_feature_flags');
      if (stored) {
        return { ...DEFAULT_FLAGS, ...JSON.parse(stored) } as FeatureFlags;
      }
    } catch (_err) {
      // Silent fallback
    }
    return DEFAULT_FLAGS;
  }

  /**
   * Save current flags to localStorage
   */
  private saveFlags(): void {
    try {
      localStorage.setItem('timeline_feature_flags', JSON.stringify(this.flags));
    } catch (error) {
      console.warn('Failed to save feature flags to localStorage:', error);
    }
  }

  /**
   * Check if a feature is enabled
   */
  public isEnabled(flag: keyof FeatureFlags): boolean {
    return this.flags[flag] === true;
  }

  /**
   * Enable a feature flag
   */
  public enable(flag: keyof FeatureFlags): void {
    this.flags[flag] = true;
    this.saveFlags();
    
    if (this.isEnabled('DEBUG_TIMELINE_CALCULATIONS')) {
      console.log(`Feature flag enabled: ${flag}`);
    }
  }

  /**
   * Disable a feature flag
   */
  public disable(flag: keyof FeatureFlags): void {
    this.flags[flag] = false;
    this.saveFlags();
    
    if (this.isEnabled('DEBUG_TIMELINE_CALCULATIONS')) {
      console.log(`Feature flag disabled: ${flag}`);
    }
  }

  /**
   * Toggle a feature flag
   */
  public toggle(flag: keyof FeatureFlags): boolean {
    this.flags[flag] = !this.flags[flag];
    this.saveFlags();
    
    if (this.isEnabled('DEBUG_TIMELINE_CALCULATIONS')) {
      console.log(`Feature flag toggled: ${flag} = ${this.flags[flag]}`);
    }
    
    return this.flags[flag];
  }

  /**
   * Get all current flag states
   */
  public getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Reset all flags to defaults
   */
  public resetToDefaults(): void {
    this.flags = { ...DEFAULT_FLAGS };
    this.saveFlags();
    
    if (this.isEnabled('DEBUG_TIMELINE_CALCULATIONS')) {
      // eslint-disable-next-line no-console
      console.log('Feature flags reset to defaults');
    }
  }

  /**
   * Safe feature rollback - disable all experimental features
   */
  public emergencyRollback(): void {
    this.flags = {
      USE_DAG_CALCULATOR: false,
      ENABLE_TASK_OVERLAPS: false,
      SHOW_CRITICAL_PATH: false,
      ENABLE_DEPENDENCY_UI: false,
      DEBUG_TIMELINE_CALCULATIONS: false,
      ALLOW_WEEKEND_LIVE_DATE: false,
    };
    this.saveFlags();
    
    console.warn('EMERGENCY ROLLBACK: All experimental features disabled');
  }
}

// ============================================
// Global Feature Flag Instance
// ============================================

export const featureFlags = new FeatureFlagManager();

// ============================================
// Convenience Functions
// ============================================

/**
 * Quick check if DAG calculator should be used
 */
export const useDAGCalculator = (): boolean => {
  return featureFlags.isEnabled('USE_DAG_CALCULATOR');
};

/**
 * Quick check if task overlapping UI should be shown
 */
export const showTaskOverlaps = (): boolean => {
  return featureFlags.isEnabled('ENABLE_TASK_OVERLAPS') && 
         featureFlags.isEnabled('USE_DAG_CALCULATOR');
};

/**
 * Quick check if critical path should be highlighted
 */
export const showCriticalPath = (): boolean => {
  return featureFlags.isEnabled('SHOW_CRITICAL_PATH') && 
         featureFlags.isEnabled('USE_DAG_CALCULATOR');
};

/**
 * Quick check if dependency management UI should be available
 */
export const enableDependencyUI = (): boolean => {
  return featureFlags.isEnabled('ENABLE_DEPENDENCY_UI') && 
         featureFlags.isEnabled('USE_DAG_CALCULATOR');
};

/**
 * Quick check if debug logging should be active
 */
export const isDebugMode = (): boolean => {
  return featureFlags.isEnabled('DEBUG_TIMELINE_CALCULATIONS');
};

/**
 * Allow weekend anchoring for go-live date (final task may fall on weekend)
 */
export const allowWeekendLiveDate = (): boolean => {
  return featureFlags.isEnabled('ALLOW_WEEKEND_LIVE_DATE');
};

/**
 * Strict overlap calculation (no inclusive +1 day on drag-created overlaps)
 */
export const useStrictOverlapCalc = (): boolean => {
  // Optional chaining for legacy persisted flags
  return (featureFlags as any).isEnabled('STRICT_OVERLAP_CALC');
};

// ============================================
// Development Helpers
// ============================================

/**
 * Enable DAG calculator with all related features for testing
 * ONLY use during development/testing
 */
export const enableDAGFeatureSet = (): void => {
  featureFlags.enable('USE_DAG_CALCULATOR');
  featureFlags.enable('ENABLE_TASK_OVERLAPS');
  featureFlags.enable('SHOW_CRITICAL_PATH');
  featureFlags.enable('ENABLE_DEPENDENCY_UI');
  featureFlags.enable('DEBUG_TIMELINE_CALCULATIONS');
  
  console.log('DAG feature set enabled for testing');
};

/**
 * Quick way to enable just the calculator for testing
 */
export const enableDAGCalculatorOnly = (): void => {
  featureFlags.enable('USE_DAG_CALCULATOR');
  featureFlags.enable('DEBUG_TIMELINE_CALCULATIONS');
  
  console.log('DAG calculator enabled (UI features still disabled)');
};

// ============================================
// Development-Only Debug Interface
// ============================================

/**
 * SECURITY NOTE: This debug interface is ONLY available in development
 * It is automatically stripped from production builds via NODE_ENV check
 * 
 * Following Golden Rule #1: Safety First - No production security risks
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Create debug interface only in development environment
  const createDebugInterface = () => {
    return {
      manager: featureFlags,
      enable: (flag: keyof FeatureFlags) => featureFlags.enable(flag),
      disable: (flag: keyof FeatureFlags) => featureFlags.disable(flag),
      toggle: (flag: keyof FeatureFlags) => featureFlags.toggle(flag),
      status: () => featureFlags.getAllFlags(),
      reset: () => featureFlags.resetToDefaults(),
      emergencyRollback: () => featureFlags.emergencyRollback(),
      enableDAGFeatureSet,
      enableDAGCalculatorOnly,
      
      // Add explicit warnings
      _WARNING: 'This debug interface is for development only',
      _SECURITY_NOTE: 'Automatically removed in production builds'
    };
  };

  // Only attach to window in development
  (window as any).timelineFeatureFlags = createDebugInterface();
  
  // eslint-disable-next-line no-console
  console.log('🔧 Development feature flags available at window.timelineFeatureFlags');
  console.warn('⚠️  This debug interface will be automatically removed in production builds');
} else {
  // Production environment - ensure no global access
  if (typeof window !== 'undefined' && (window as any).timelineFeatureFlags) {
    console.warn('⚠️  Removing feature flag debug interface in production environment');
    delete (window as any).timelineFeatureFlags;
  }
}
