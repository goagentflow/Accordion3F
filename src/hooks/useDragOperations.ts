/**
 * useDragOperations Hook - Drag Operation Queuing and Management
 * Prevents manipulation bugs through proper event handling and queuing
 * 
 * CRITICAL: This hook fixes the race conditions and state corruption
 * that occur during rapid drag operations by implementing proper queuing
 */

import { useRef, useCallback, useEffect } from 'react';
import { useTimelineActions } from '../contexts/TimelineContext';
import { ActionType } from '../types/timeline.types';

// ============================================
// Drag Operation Types
// ============================================

interface DragOperation {
  taskId: string;
  deltaX: number;
  deltaY: number;
  timestamp: number;
}

interface DragState {
  isDragging: boolean;
  taskId: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// ============================================
// Hook Configuration
// ============================================

interface DragOperationsConfig {
  // Queue processing configuration
  maxQueueSize: number;
  processingInterval: number; // milliseconds
  coalescingWindow: number; // milliseconds to coalesce events
  
  // Drag sensitivity
  minDragDistance: number; // minimum pixels to register as drag
  
  // Performance options
  throttleInterval: number; // throttle mouse move events
}

const DEFAULT_CONFIG: DragOperationsConfig = {
  maxQueueSize: 10,
  processingInterval: 16, // ~60fps
  coalescingWindow: 50,
  minDragDistance: 3,
  throttleInterval: 16 // ~60fps throttling
};

// ============================================
// Main Hook
// ============================================

export function useDragOperations(config: Partial<DragOperationsConfig> = {}) {
  const { dispatch } = useTimelineActions();
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  // ============================================
  // State Management
  // ============================================
  
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    taskId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  });
  
  const operationQueueRef = useRef<DragOperation[]>([]);
  const isProcessingRef = useRef(false);
  const lastProcessedTimestamp = useRef(0);
  const throttleTimestamp = useRef(0);
  
  // ============================================
  // Queue Processing
  // ============================================
  
  const processDragQueue = useCallback(() => {
    if (isProcessingRef.current || operationQueueRef.current.length === 0) {
      return;
    }
    
    isProcessingRef.current = true;
    const currentTime = Date.now();
    
    try {
      // Coalesce operations within the coalescing window
      const coalescedOperations = coalesceDragOperations(
        operationQueueRef.current, 
        fullConfig.coalescingWindow
      );
      
      // Process each coalesced operation
      for (const operation of coalescedOperations) {
        // Only process if enough time has passed since last processing
        if (currentTime - lastProcessedTimestamp.current >= fullConfig.processingInterval) {
          console.log(`[DragOperations] Processing drag: task=${operation.taskId}, delta=(${operation.deltaX}, ${operation.deltaY})`);
          
          dispatch({
            type: ActionType.DRAG_TASK,
            payload: {
              taskId: operation.taskId,
              deltaX: operation.deltaX,
              deltaY: operation.deltaY
            }
          });
          
          lastProcessedTimestamp.current = currentTime;
        }
      }
      
      // Clear processed operations
      operationQueueRef.current = [];
      
    } catch (error) {
      console.error('[DragOperations] Error processing drag queue:', error);
      // Clear queue on error to prevent infinite processing
      operationQueueRef.current = [];
    } finally {
      isProcessingRef.current = false;
    }
  }, [dispatch, fullConfig.processingInterval, fullConfig.coalescingWindow]);
  
  // ============================================
  // Queue Processing Timer
  // ============================================
  
  useEffect(() => {
    const processTimer = setInterval(processDragQueue, fullConfig.processingInterval);
    return () => clearInterval(processTimer);
  }, [processDragQueue, fullConfig.processingInterval]);
  
  // ============================================
  // Drag Event Handlers
  // ============================================
  
  const handleDragStart = useCallback((taskId: string) => {
    return (event: React.MouseEvent | MouseEvent) => {
      console.log(`[DragOperations] Drag started for task: ${taskId}`);
      
      dragStateRef.current = {
        isDragging: true,
        taskId,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY
      };
      
      // Prevent default to avoid text selection during drag
      event.preventDefault();
      
      // Add global mouse move and mouse up handlers
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
    };
  }, []);
  
  const handleDragMove = useCallback((event: MouseEvent) => {
    const currentTime = Date.now();
    
    // Throttle mouse move events for performance
    if (currentTime - throttleTimestamp.current < fullConfig.throttleInterval) {
      return;
    }
    throttleTimestamp.current = currentTime;
    
    const dragState = dragStateRef.current;
    
    if (!dragState.isDragging || !dragState.taskId) {
      return;
    }
    
    const deltaX = event.clientX - dragState.currentX;
    const deltaY = event.clientY - dragState.currentY;
    
    // Check if movement is significant enough
    if (Math.abs(deltaX) < fullConfig.minDragDistance && Math.abs(deltaY) < fullConfig.minDragDistance) {
      return;
    }
    
    // Update current position
    dragState.currentX = event.clientX;
    dragState.currentY = event.clientY;
    
    // Add operation to queue
    const operation: DragOperation = {
      taskId: dragState.taskId,
      deltaX,
      deltaY,
      timestamp: currentTime
    };
    
    // Manage queue size to prevent memory issues
    if (operationQueueRef.current.length >= fullConfig.maxQueueSize) {
      operationQueueRef.current.shift(); // Remove oldest operation
    }
    
    operationQueueRef.current.push(operation);
  }, [fullConfig.minDragDistance, fullConfig.throttleInterval, fullConfig.maxQueueSize]);
  
  const handleDragEnd = useCallback((event: MouseEvent) => {
    const dragState = dragStateRef.current;
    
    if (!dragState.isDragging) {
      return;
    }
    
    console.log(`[DragOperations] Drag ended for task: ${dragState.taskId}`);
    
    // Process any remaining operations immediately
    if (operationQueueRef.current.length > 0) {
      processDragQueue();
    }
    
    // Reset drag state
    dragStateRef.current = {
      isDragging: false,
      taskId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    };
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    
  }, [processDragQueue]);
  
  // ============================================
  // Cleanup on Unmount
  // ============================================
  
  useEffect(() => {
    return () => {
      // Clean up event listeners and clear queue on unmount
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      operationQueueRef.current = [];
      isProcessingRef.current = false;
    };
  }, [handleDragMove, handleDragEnd]);
  
  // ============================================
  // Public Interface
  // ============================================
  
  const isDragging = dragStateRef.current.isDragging;
  const currentTaskId = dragStateRef.current.taskId;
  const queueLength = operationQueueRef.current.length;
  
  return {
    // Event handlers
    handleDragStart,
    
    // State information
    isDragging,
    currentTaskId,
    queueLength,
    
    // Utility functions
    clearQueue: useCallback(() => {
      operationQueueRef.current = [];
    }, []),
    
    // Debug information
    getDebugInfo: useCallback(() => ({
      dragState: dragStateRef.current,
      queueLength: operationQueueRef.current.length,
      isProcessing: isProcessingRef.current,
      config: fullConfig
    }), [fullConfig])
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Coalesce drag operations within a time window
 * Combines multiple small movements into larger movements to reduce state updates
 */
function coalesceDragOperations(operations: DragOperation[], windowMs: number): DragOperation[] {
  if (operations.length === 0) return [];
  
  const coalesced: DragOperation[] = [];
  const grouped = new Map<string, DragOperation[]>();
  
  // Group operations by taskId
  for (const op of operations) {
    if (!grouped.has(op.taskId)) {
      grouped.set(op.taskId, []);
    }
    grouped.get(op.taskId)!.push(op);
  }
  
  // Coalesce operations for each task
  for (const [taskId, taskOps] of grouped.entries()) {
    if (taskOps.length === 1) {
      coalesced.push(taskOps[0]);
      continue;
    }
    
    // Combine operations within the time window
    let currentOp = taskOps[0];
    
    for (let i = 1; i < taskOps.length; i++) {
      const nextOp = taskOps[i];
      
      if (nextOp.timestamp - currentOp.timestamp <= windowMs) {
        // Combine operations
        currentOp = {
          ...currentOp,
          deltaX: currentOp.deltaX + nextOp.deltaX,
          deltaY: currentOp.deltaY + nextOp.deltaY,
          timestamp: nextOp.timestamp // Use latest timestamp
        };
      } else {
        // Time gap too large, finalize current operation and start new one
        coalesced.push(currentOp);
        currentOp = nextOp;
      }
    }
    
    // Add the final operation
    coalesced.push(currentOp);
  }
  
  return coalesced;
}

// ============================================
// SVG-Specific Drag Hook
// ============================================

/**
 * Specialized hook for SVG task bar dragging
 * Handles SVG coordinate systems and provides data-testid integration
 */
export function useSVGDragOperations(config?: Partial<DragOperationsConfig>) {
  const baseDragOperations = useDragOperations(config);
  
  const handleSVGDragStart = useCallback((taskId: string, svgElement: SVGElement) => {
    return (event: React.MouseEvent) => {
      // Add SVG-specific handling
      const rect = svgElement.getBoundingClientRect();
      const svgX = event.clientX - rect.left;
      const svgY = event.clientY - rect.top;
      
      console.log(`[SVGDragOperations] SVG drag started: task=${taskId}, svgCoords=(${svgX}, ${svgY})`);
      
      // Use base drag handler with SVG-adjusted coordinates
      return baseDragOperations.handleDragStart(taskId)(event);
    };
  }, [baseDragOperations.handleDragStart]);
  
  return {
    ...baseDragOperations,
    handleSVGDragStart
  };
}