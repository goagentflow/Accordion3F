/**
 * Dependency Validation Service
 * Handles all validation logic for task dependencies in the DAG calculator
 * 
 * Separated from TimelineCalculatorDAG.ts to comply with Golden Rule #2 (400-line max)
 * and Golden Rule #4 (Clear roles - one component, one job)
 */

import { Task } from '../types/timeline.types';
import type { DependencyValidationResult, DependencyValidationError } from '../types/timeline.types';

// ============================================
// Types and Interfaces
// ============================================

interface TaskDependency {
  predecessorId: string;
  type: 'FS';
  lag: number;
}

interface TaskNode {
  id: string;
  task: Task;
  duration: number;
  dependencies: TaskDependency[];
  successors: string[];
}

// ============================================
// Dependency Validator Class
// ============================================

export class DependencyValidator {
  private nodes: Map<string, TaskNode> = new Map();

  /**
   * Validate a complete task graph for all types of dependency issues
   */
  public validateTaskGraph(
    tasks: Task[],
    customDurations: Record<string, number> = {}
  ): DependencyValidationResult {
    try {
      // Build nodes map for validation
      this.buildNodesMap(tasks, customDurations);
      
      // Run all validation checks
      const errors: string[] = [];
      
      // Check for circular dependencies
      const circularErrors = this.detectCircularDependencies();
      errors.push(...circularErrors);
      
      // Check for invalid task references
      const referenceErrors = this.validateTaskReferences();
      errors.push(...referenceErrors);
      
      // Check overlap amounts
      const overlapErrors = this.validateOverlapAmounts();
      errors.push(...overlapErrors);
      
      // Check cross-asset dependencies (business rule)
      const assetErrors = this.validateAssetBoundaries();
      errors.push(...assetErrors);
      
      return {
        valid: errors.length === 0,
        error: errors.length > 0 ? errors[0] : undefined,
        warnings: errors.length > 1 ? errors.slice(1) : undefined
      };
      
    } catch (error) {
      return {
        valid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Validate a single dependency before adding it to the graph
   */
  public validateSingleDependency(
    predecessorId: string,
    successorId: string,
    overlapDays: number,
    tasks: Task[],
    customDurations: Record<string, number> = {}
  ): DependencyValidationResult {
    // Check if both tasks exist
    const predecessor = tasks.find(t => t.id === predecessorId);
    const successor = tasks.find(t => t.id === successorId);
    
    if (!predecessor) {
      return { valid: false, error: `Predecessor task ${predecessorId} not found` };
    }
    
    if (!successor) {
      return { valid: false, error: `Successor task ${successorId} not found` };
    }
    
    // Check overlap amount
    const predecessorDuration = customDurations[predecessor.name] ?? predecessor.duration ?? 1;
    
    if (overlapDays < 0) {
      return { valid: false, error: 'Overlap days cannot be negative' };
    }
    
    if (overlapDays >= predecessorDuration) {
      return { 
        valid: false, 
        error: `Overlap (${overlapDays} days) cannot exceed predecessor duration (${predecessorDuration} days)` 
      };
    }
    
    // Check asset boundary (business rule)
    if (predecessor.assetId !== successor.assetId) {
      return { 
        valid: false, 
        error: 'Dependencies cannot cross asset boundaries - tasks must be from the same asset' 
      };
    }
    
    // Check for potential circular dependency
    if (this.wouldCreateCircularDependency(predecessorId, successorId, tasks)) {
      return { 
        valid: false, 
        error: 'This dependency would create a circular relationship' 
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Get detailed validation errors for all tasks in the graph
   */
  public getAllDependencyErrors(
    tasks: Task[],
    customDurations: Record<string, number> = {}
  ): DependencyValidationError[] {
    const errors: DependencyValidationError[] = [];
    
    tasks.forEach(task => {
      if (!task.dependencies) return;
      
      task.dependencies.forEach((dependency, index) => {
        const validation = this.validateSingleDependency(
          dependency.predecessorId,
          task.id,
          Math.abs(dependency.lag), // Convert back to positive for validation
          tasks,
          customDurations
        );
        
        if (!validation.valid) {
          errors.push({
            taskId: task.id,
            dependencyIndex: index,
            error: validation.error || 'Unknown validation error',
            severity: 'error'
          });
        }
      });
    });
    
    return errors;
  }
  
  // ============================================
  // Private Validation Methods
  // ============================================
  
  /**
   * Build internal nodes map from tasks for validation
   */
  private buildNodesMap(tasks: Task[], customDurations: Record<string, number>): void {
    this.nodes.clear();
    
    // Create nodes
    tasks.forEach(task => {
      const duration = customDurations[task.name] !== undefined 
        ? customDurations[task.name] 
        : (task.duration || 1);
      
      const dependencies = task.dependencies || [];
      
      const node: TaskNode = {
        id: task.id,
        task,
        duration,
        dependencies,
        successors: []
      };
      
      this.nodes.set(task.id, node);
    });
    
    // Build successor relationships
    this.nodes.forEach(node => {
      node.dependencies.forEach(dep => {
        const predecessor = this.nodes.get(dep.predecessorId);
        if (predecessor) {
          predecessor.successors.push(node.id);
        }
      });
    });
  }
  
  /**
   * Detect circular dependencies using Depth-First Search
   */
  private detectCircularDependencies(): string[] {
    const errors: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      const node = this.nodes.get(nodeId);
      if (!node) return false;
      
      for (const successorId of node.successors) {
        if (!visited.has(successorId)) {
          if (hasCycle(successorId)) return true;
        } else if (recursionStack.has(successorId)) {
          return true;
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    // Check each unvisited node
    for (const [nodeId] of this.nodes) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          errors.push(`Circular dependency detected in task network starting from task ${nodeId}`);
          break; // One circular dependency report is enough
        }
      }
    }
    
    return errors;
  }
  
  /**
   * Validate that all dependency references point to existing tasks
   */
  private validateTaskReferences(): string[] {
    const errors: string[] = [];
    
    this.nodes.forEach(node => {
      node.dependencies.forEach(dep => {
        if (!this.nodes.has(dep.predecessorId)) {
          errors.push(`Task ${node.id} depends on non-existent task ${dep.predecessorId}`);
        }
      });
    });
    
    return errors;
  }
  
  /**
   * Validate that overlap amounts don't exceed predecessor durations
   */
  private validateOverlapAmounts(): string[] {
    const errors: string[] = [];
    
    this.nodes.forEach(node => {
      node.dependencies.forEach(dep => {
        if (dep.lag < 0) { // Negative lag = overlap
          const predecessor = this.nodes.get(dep.predecessorId);
          if (predecessor) {
            const overlapDays = Math.abs(dep.lag);
            if (overlapDays >= predecessor.duration) {
              const predecessorTask = predecessor.task;
              const successorTask = node.task;
              errors.push(
                `Task "${successorTask.name}" overlap (${overlapDays} days) exceeds predecessor "${predecessorTask.name}" duration (${predecessor.duration} days)`
              );
            }
          }
        }
      });
    });
    
    return errors;
  }
  
  /**
   * Validate that dependencies don't cross asset boundaries (business rule)
   */
  private validateAssetBoundaries(): string[] {
    const errors: string[] = [];
    
    this.nodes.forEach(node => {
      node.dependencies.forEach(dep => {
        const predecessor = this.nodes.get(dep.predecessorId);
        if (predecessor && predecessor.task.assetId !== node.task.assetId) {
          errors.push(
            `Task "${node.task.name}" cannot depend on task "${predecessor.task.name}" from different asset`
          );
        }
      });
    });
    
    return errors;
  }
  
  /**
   * Check if adding a dependency would create a circular relationship
   */
  private wouldCreateCircularDependency(
    predecessorId: string, 
    successorId: string, 
    tasks: Task[]
  ): boolean {
    // Create a temporary task list with the new dependency added
    const tempTasks = tasks.map(task => {
      if (task.id === successorId) {
        return {
          ...task,
          dependencies: [
            ...(task.dependencies || []),
            { predecessorId, type: 'FS' as const, lag: -1 }
          ]
        };
      }
      return task;
    });
    
    // Build temporary graph and check for cycles
    const tempValidator = new DependencyValidator();
    tempValidator.buildNodesMap(tempTasks, {});
    const circularErrors = tempValidator.detectCircularDependencies();
    
    return circularErrors.length > 0;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create a global validator instance for reuse
 */
export const dependencyValidator = new DependencyValidator();

/**
 * Quick validation function for single dependencies
 */
export const validateDependency = (
  predecessorId: string,
  successorId: string,
  overlapDays: number,
  tasks: Task[],
  customDurations: Record<string, number> = {}
): DependencyValidationResult => {
  return dependencyValidator.validateSingleDependency(
    predecessorId, 
    successorId, 
    overlapDays, 
    tasks, 
    customDurations
  );
};

/**
 * Quick validation function for complete task graphs
 */
export const validateTaskGraph = (
  tasks: Task[],
  customDurations: Record<string, number> = {}
): DependencyValidationResult => {
  return dependencyValidator.validateTaskGraph(tasks, customDurations);
};