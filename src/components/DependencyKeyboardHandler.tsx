/**
 * DependencyKeyboardHandler Component
 * Integrates keyboard shortcuts with dependency management functionality
 * 
 * Following Golden Rule #2: 400 Line Max - Focused on keyboard integration
 * Following Golden Rule #4: Clear Roles - Bridge between shortcuts and actions
 */

import React, { useEffect, useMemo } from 'react';
import { 
  useKeyboardShortcuts, 
  KeyboardShortcut,
  DEPENDENCY_SHORTCUTS,
  NAVIGATION_SHORTCUTS,
  GENERAL_SHORTCUTS
} from '../hooks/useKeyboardShortcuts';
import { useTimeline } from '../hooks/useTimeline';
import { showTaskOverlaps, isDebugMode } from '../config/features';

interface DependencyKeyboardHandlerProps {
  // Action handlers
  onOpenDependencyPanel?: () => void;
  onCreateDependency?: () => void;
  onOpenBulkOperations?: () => void;
  onOpenTemplates?: () => void;
  onDeleteSelected?: () => void;
  onCloseModal?: () => void;
  onSave?: () => void;
  onFocusSearch?: () => void;
  
  // State
  context?: 'gantt' | 'modal' | 'global';
  isEnabled?: boolean;
  selectedItems?: string[];
  
  // Children (optional render prop for help display)
  children?: (api: { showHelp: () => void; isEnabled: boolean }) => React.ReactNode;
}

const DependencyKeyboardHandler = React.memo<DependencyKeyboardHandlerProps>(({
  onOpenDependencyPanel,
  onCreateDependency,
  onOpenBulkOperations,
  onOpenTemplates,
  onDeleteSelected,
  onCloseModal,
  onSave,
  onFocusSearch,
  context = 'global',
  isEnabled = true,
  selectedItems = [],
  children
}) => {
  const { undo, redo, canUndo, canRedo } = useTimeline();
  
  const canShowOverlaps = showTaskOverlaps();
  const effectiveEnabled = isEnabled && canShowOverlaps;

  // Build dynamic shortcuts based on available actions
  const shortcuts = useMemo((): KeyboardShortcut[] => {
    const dynamicShortcuts: KeyboardShortcut[] = [];

    // Dependency shortcuts
    if (onOpenDependencyPanel) {
      dynamicShortcuts.push({
        ...DEPENDENCY_SHORTCUTS[0], // Ctrl+D
        action: onOpenDependencyPanel
      });
    }

    if (onCreateDependency) {
      dynamicShortcuts.push({
        ...DEPENDENCY_SHORTCUTS[1], // Ctrl+Shift+N
        action: onCreateDependency
      });
    }

    if (onOpenBulkOperations) {
      dynamicShortcuts.push({
        ...DEPENDENCY_SHORTCUTS[2], // Ctrl+Shift+B
        action: onOpenBulkOperations
      });
    }

    if (onOpenTemplates) {
      dynamicShortcuts.push({
        ...DEPENDENCY_SHORTCUTS[3], // Ctrl+Shift+T
        action: onOpenTemplates
      });
    }

    if (onDeleteSelected && selectedItems.length > 0) {
      dynamicShortcuts.push({
        ...DEPENDENCY_SHORTCUTS[4], // Delete
        action: onDeleteSelected,
        description: `Delete ${selectedItems.length} selected dependencies`
      });
    }

    // Navigation shortcuts
    if (canUndo) {
      dynamicShortcuts.push({
        ...NAVIGATION_SHORTCUTS[0], // Ctrl+Z
        action: undo
      });
    }

    if (canRedo) {
      dynamicShortcuts.push(
        {
          ...NAVIGATION_SHORTCUTS[1], // Ctrl+Y
          action: redo
        },
        {
          ...NAVIGATION_SHORTCUTS[2], // Ctrl+Shift+Z
          action: redo
        }
      );
    }

    if (onFocusSearch) {
      dynamicShortcuts.push({
        ...NAVIGATION_SHORTCUTS[3], // Ctrl+F
        action: onFocusSearch
      });
    }

    // General shortcuts
    if (onCloseModal) {
      dynamicShortcuts.push({
        ...GENERAL_SHORTCUTS[1], // Escape
        action: onCloseModal
      });
    }

    if (onSave) {
      dynamicShortcuts.push({
        ...GENERAL_SHORTCUTS[2], // Ctrl+S
        action: (event?: Event) => {
          if (event) {
            event.preventDefault();
          }
          onSave();
        }
      });
    }

    return dynamicShortcuts;
  }, [
    onOpenDependencyPanel,
    onCreateDependency,
    onOpenBulkOperations,
    onOpenTemplates,
    onDeleteSelected,
    onCloseModal,
    onSave,
    onFocusSearch,
    selectedItems.length,
    undo,
    redo,
    canUndo,
    canRedo
  ]);

  // Help shortcut (always available)
  const helpShortcut: KeyboardShortcut = useMemo(() => ({
    ...GENERAL_SHORTCUTS[0], // Shift+?
    action: () => {
      keyboardAPI.showHelp();
    }
  }), []);

  // Initialize keyboard shortcuts
  const keyboardAPI = useKeyboardShortcuts({
    shortcuts: [...shortcuts, helpShortcut],
    isEnabled: effectiveEnabled,
    context
  });

  // Log shortcut registration in debug mode
  useEffect(() => {
    if (isDebugMode()) {
      console.log('DependencyKeyboardHandler initialized:', {
        context,
        isEnabled: effectiveEnabled,
        shortcutsCount: shortcuts.length + 1,
        availableActions: {
          openPanel: !!onOpenDependencyPanel,
          createDependency: !!onCreateDependency,
          bulkOperations: !!onOpenBulkOperations,
          templates: !!onOpenTemplates,
          deleteSelected: !!onDeleteSelected && selectedItems.length > 0,
          undo: canUndo,
          redo: canRedo
        }
      });
    }
  }, [
    context,
    effectiveEnabled,
    shortcuts.length,
    onOpenDependencyPanel,
    onCreateDependency,
    onOpenBulkOperations,
    onOpenTemplates,
    onDeleteSelected,
    selectedItems.length,
    canUndo,
    canRedo
  ]);

  // Provide children with help API if render prop is used
  if (children) {
    return (
      <>
        {children({ 
          showHelp: keyboardAPI.showHelp, 
          isEnabled: effectiveEnabled 
        })}
      </>
    );
  }

  // Default: invisible component that just handles keyboard events
  return null;
});

DependencyKeyboardHandler.displayName = 'DependencyKeyboardHandler';

export default DependencyKeyboardHandler;