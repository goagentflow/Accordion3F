/**
 * useKeyboardShortcuts Hook
 * Provides keyboard shortcuts for power users of dependency management
 * 
 * Following Golden Rule #2: 400 Line Max - Focused keyboard shortcut management
 * Following Golden Rule #4: Clear Roles - Only handles keyboard shortcuts
 */

import { useEffect, useCallback, useRef } from 'react';
import { showTaskOverlaps, isDebugMode } from '../config/features';

export interface KeyboardShortcut {
  key: string;
  modifiers: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean; // Cmd on Mac
  };
  description: string;
  action: () => void;
  category: 'dependency' | 'navigation' | 'general';
  context?: string; // Where the shortcut is active
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  isEnabled?: boolean;
  context?: string; // Current context (e.g., 'gantt', 'modal')
}

export interface KeyboardShortcutAPI {
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (key: string) => void;
  showHelp: () => void;
  isShortcutActive: (key: string) => boolean;
}

export const useKeyboardShortcuts = ({
  shortcuts = [],
  isEnabled = true,
  context = 'global'
}: UseKeyboardShortcutsOptions): KeyboardShortcutAPI => {
  const shortcutsRef = useRef<Map<string, KeyboardShortcut>>(new Map());

  // Build shortcut key from event
  const buildShortcutKey = useCallback((event: KeyboardEvent): string => {
    const parts = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    if (event.metaKey) parts.push('meta');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }, []);

  // Check if shortcut matches
  const matchesShortcut = useCallback((event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
    const eventKey = event.key.toLowerCase();
    const shortcutKey = shortcut.key.toLowerCase();
    
    if (eventKey !== shortcutKey) return false;
    
    const modifiers = shortcut.modifiers;
    if (!!event.ctrlKey !== !!modifiers.ctrl) return false;
    if (!!event.shiftKey !== !!modifiers.shift) return false;
    if (!!event.altKey !== !!modifiers.alt) return false;
    if (!!event.metaKey !== !!modifiers.meta) return false;
    
    return true;
  }, []);

  // Handle keyboard event
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isEnabled) return;

    // Don't handle shortcuts in input fields unless specifically designed for them
    const target = event.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;

    // Build shortcut key for logging
    const shortcutKey = buildShortcutKey(event);

    // Find matching shortcut
    for (const shortcut of shortcutsRef.current.values()) {
      if (matchesShortcut(event, shortcut)) {
        // Check context match
        if (shortcut.context && shortcut.context !== context) {
          continue;
        }

        // Skip if in input field unless shortcut allows it
        if (isInInput && !shortcut.description.includes('(works in inputs)')) {
          continue;
        }

        event.preventDefault();
        event.stopPropagation();
        
        try {
          shortcut.action();
          
          if (isDebugMode()) {
            console.log('Keyboard shortcut executed:', {
              key: shortcutKey,
              description: shortcut.description,
              context: shortcut.context || 'global'
            });
          }
        } catch (error) {
          console.error('Keyboard shortcut error:', error);
        }
        
        return;
      }
    }

    // Log unmatched shortcuts in debug mode
    if (isDebugMode() && (event.ctrlKey || event.metaKey)) {
      console.log('Unmatched shortcut:', shortcutKey);
    }
  }, [isEnabled, context, buildShortcutKey, matchesShortcut]);

  // Show help modal
  const showHelp = useCallback(() => {
    const shortcuts = Array.from(shortcutsRef.current.values());
    const categories = {
      dependency: [] as KeyboardShortcut[],
      navigation: [] as KeyboardShortcut[],
      general: [] as KeyboardShortcut[]
    };

    shortcuts.forEach(shortcut => {
      categories[shortcut.category].push(shortcut);
    });

    // Create help content
    let helpContent = '# Keyboard Shortcuts\n\n';
    
    Object.entries(categories).forEach(([category, shortcuts]) => {
      if (shortcuts.length > 0) {
        helpContent += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
        shortcuts.forEach(shortcut => {
          const keyParts = [];
          if (shortcut.modifiers.ctrl) keyParts.push('Ctrl');
          if (shortcut.modifiers.shift) keyParts.push('Shift');
          if (shortcut.modifiers.alt) keyParts.push('Alt');
          if (shortcut.modifiers.meta) keyParts.push('Cmd');
          keyParts.push(shortcut.key.toUpperCase());
          
          const keyCombo = keyParts.join(' + ');
          helpContent += `- **${keyCombo}**: ${shortcut.description}\n`;
        });
        helpContent += '\n';
      }
    });

    // Display help (in a real app, this would open a modal)
    console.log(helpContent);
    alert(helpContent);
    
    if (isDebugMode()) {
      console.log('Keyboard shortcuts help displayed');
    }
  }, []);

  // Register shortcut
  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    const keyId = `${shortcut.key}-${JSON.stringify(shortcut.modifiers)}`;
    shortcutsRef.current.set(keyId, shortcut);
    
    if (isDebugMode()) {
      console.log('Keyboard shortcut registered:', keyId, shortcut.description);
    }
  }, []);

  // Unregister shortcut
  const unregisterShortcut = useCallback((key: string) => {
    shortcutsRef.current.delete(key);
    
    if (isDebugMode()) {
      console.log('Keyboard shortcut unregistered:', key);
    }
  }, []);

  // Check if shortcut is active
  const isShortcutActive = useCallback((key: string): boolean => {
    return shortcutsRef.current.has(key);
  }, []);

  // Initialize shortcuts
  useEffect(() => {
    shortcuts.forEach(registerShortcut);
    
    return () => {
      shortcutsRef.current.clear();
    };
  }, [shortcuts, registerShortcut]);

  // Set up event listeners
  useEffect(() => {
    if (!isEnabled || !showTaskOverlaps()) return;

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled, handleKeyDown]);

  return {
    registerShortcut,
    unregisterShortcut,
    showHelp,
    isShortcutActive
  };
};

// Predefined shortcut sets for different components
export const DEPENDENCY_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'd',
    modifiers: { ctrl: true },
    description: 'Open dependency management panel',
    action: () => {}, // Will be overridden by component
    category: 'dependency',
    context: 'gantt'
  },
  {
    key: 'n',
    modifiers: { ctrl: true, shift: true },
    description: 'Create new dependency',
    action: () => {},
    category: 'dependency',
    context: 'gantt'
  },
  {
    key: 'b',
    modifiers: { ctrl: true, shift: true },
    description: 'Open bulk operations',
    action: () => {},
    category: 'dependency',
    context: 'gantt'
  },
  {
    key: 't',
    modifiers: { ctrl: true, shift: true },
    description: 'Open dependency templates',
    action: () => {},
    category: 'dependency',
    context: 'gantt'
  },
  {
    key: 'delete',
    modifiers: {},
    description: 'Delete selected dependencies',
    action: () => {},
    category: 'dependency',
    context: 'gantt'
  }
];

export const NAVIGATION_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'z',
    modifiers: { ctrl: true },
    description: 'Undo last action',
    action: () => {},
    category: 'navigation'
  },
  {
    key: 'y',
    modifiers: { ctrl: true },
    description: 'Redo last undone action',
    action: () => {},
    category: 'navigation'
  },
  {
    key: 'z',
    modifiers: { ctrl: true, shift: true },
    description: 'Redo last undone action (alternative)',
    action: () => {},
    category: 'navigation'
  },
  {
    key: 'f',
    modifiers: { ctrl: true },
    description: 'Focus search/filter',
    action: () => {},
    category: 'navigation'
  }
];

export const GENERAL_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: '?',
    modifiers: { shift: true },
    description: 'Show keyboard shortcuts help',
    action: () => {},
    category: 'general'
  },
  {
    key: 'escape',
    modifiers: {},
    description: 'Close current modal/panel',
    action: () => {},
    category: 'general'
  },
  {
    key: 's',
    modifiers: { ctrl: true },
    description: 'Save current state',
    action: () => {},
    category: 'general'
  }
];