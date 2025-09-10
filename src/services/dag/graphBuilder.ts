/**
 * Graph Builder Module for DAG Calculator
 * Handles construction of dependency graphs from task lists
 * 
 * Following Golden Rule #2: 400 Line Max - Extracted from TimelineCalculatorDAG.ts
 * Following Golden Rule #4: Clear Roles - Single responsibility for graph construction
 * Following Golden Rule #1: Safety First - Comprehensive validation and error handling
 */

import { Task } from '../../types/timeline.types';
import { dependencyValidator } from '../DependencyValidator';
import { sanitizeDependencies } from './dependencySanitizer';

// ============================================
// Types and Interfaces
// ============================================

export interface TaskDependency {
  predecessorId: string;
  type: 'FS';  // Start with Finish-Start only
  lag: number; // Negative = overlap days (e.g., -2 = overlap by 2 days)
}

export interface TaskNode {
  id: string;
  task: Task;
  duration: number;
  dependencies: TaskDependency[];
  
  // CPM calculation fields (initialized to 0, calculated later)
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  totalFloat: number;
  isCritical: boolean;
  
  // Graph traversal relationships
  successors: string[];
}

export interface TaskGraph {
  nodes: Map<string, TaskNode>;
  startNodes: string[];
  endNodes: string[];
  isValid: boolean;
  errors: string[];
}

// ============================================
// Graph Builder Class
// ============================================

export class GraphBuilder {
  /**
   * Build a directed acyclic graph from tasks and their dependencies
   * 
   * @param rawTasks - Array of tasks with optional dependencies
   * @param customDurations - Override durations for specific tasks
   * @returns TaskGraph object with nodes and validation results
   */
  public buildTaskGraph(
    rawTasks: Task[],
    customDurations: Record<string, number> = {}
  ): TaskGraph {
    const nodes = new Map<string, TaskNode>();
    
    try {
      // Step 1: Create all nodes
      this.createTaskNodes(rawTasks, customDurations, nodes);
      
      // Step 2: Build successor relationships
      this.buildSuccessorRelationships(nodes);
      
      // Step 3: Validate the graph
      const validation = this.validateGraph(rawTasks, customDurations);
      
      // Step 4: Identify start and end nodes
      const startNodes = this.findStartNodes(nodes);
      const endNodes = this.findEndNodes(nodes);
      
      return {
        nodes,
        startNodes,
        endNodes,
        isValid: validation.valid,
        errors: validation.valid ? [] : [validation.error, ...(validation.warnings || [])].filter(Boolean) as string[]
      };
      
    } catch (error) {
      return {
        nodes: new Map(),
        startNodes: [],
        endNodes: [],
        isValid: false,
        errors: [`Graph construction failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
  
  /**
   * Create TaskNode objects for all tasks
   */
  private createTaskNodes(
    rawTasks: Task[],
    customDurations: Record<string, number>,
    nodes: Map<string, TaskNode>
  ): void {
    // Build a fast lookup for valid IDs within this batch
    const idSet = new Set<string>(rawTasks.map(t => t.id));
    // Group tasks by asset to ensure sequential execution within each asset
    const tasksByAsset = new Map<string, Task[]>();
    
    rawTasks.forEach(task => {
      const assetId = task.assetId || 'default';
      if (!tasksByAsset.has(assetId)) {
        tasksByAsset.set(assetId, []);
      }
      tasksByAsset.get(assetId)!.push(task);
    });
    
    // Create nodes with automatic sequential dependencies within each asset
    rawTasks.forEach(task => {
      const duration = customDurations[task.name] !== undefined 
        ? customDurations[task.name] 
        : (task.duration || 1);
      
      let dependencies = sanitizeDependencies(task, task.dependencies, idSet);

      // CRITICAL FIX: Add sequential dependencies within the same asset
      // if no explicit dependencies exist
      if (dependencies.length === 0) {
        const assetId = task.assetId || 'default';
        const assetTasks = tasksByAsset.get(assetId) || [];
        
        // DEBUG: Log asset tasks order
        console.log(`[DEBUG] Asset ${assetId} tasks:`, assetTasks.map(t => `${t.id}-${t.name}`));
        
        // Find the previous task in the same asset (by order in the array)
        const taskIndex = assetTasks.findIndex(t => t.id === task.id);
        console.log(`[DEBUG] Task ${task.id}-${task.name} at index ${taskIndex}`);
        
        if (taskIndex > 0) {
          const previousTask = assetTasks[taskIndex - 1];
          dependencies = [{
            predecessorId: previousTask.id,
            type: 'FS' as const,
            lag: 0
          }];
          console.log(`[DEBUG] Added dependency: ${task.id} depends on ${previousTask.id}`);
        } else {
          console.log(`[DEBUG] Task ${task.id} is start node (no dependency)`);
        }
      }
      
      const node: TaskNode = {
        id: task.id,
        task,
        duration,
        dependencies,
        
        // CPM fields initialized to 0
        earliestStart: 0,
        earliestFinish: 0,
        latestStart: 0,
        latestFinish: 0,
        totalFloat: 0,
        isCritical: false,
        
        // Graph relationships
        successors: []
      };
      
      nodes.set(task.id, node);
    });
  }
  
  /**
   * Build successor relationships between nodes based on dependencies
   */
  private buildSuccessorRelationships(nodes: Map<string, TaskNode>): void {
    nodes.forEach(node => {
      node.dependencies.forEach(dep => {
        const predecessor = nodes.get(dep.predecessorId);
        if (predecessor) {
          // Add this node as a successor to its predecessor
          if (!predecessor.successors.includes(node.id)) {
            predecessor.successors.push(node.id);
          }
        }
      });
    });
  }
  
  /**
   * Validate the entire task graph for common issues
   */
  private validateGraph(
    rawTasks: Task[],
    customDurations: Record<string, number>
  ) {
    return dependencyValidator.validateTaskGraph(rawTasks, customDurations);
  }
  
  /**
   * Find all start nodes (nodes with no dependencies)
   */
  private findStartNodes(nodes: Map<string, TaskNode>): string[] {
    const startNodes: string[] = [];
    
    nodes.forEach((node, nodeId) => {
      if (node.dependencies.length === 0) {
        startNodes.push(nodeId);
      }
    });
    
    return startNodes;
  }
  
  /**
   * Find all end nodes (nodes with no successors)
   */
  private findEndNodes(nodes: Map<string, TaskNode>): string[] {
    const endNodes: string[] = [];
    
    nodes.forEach((node, nodeId) => {
      if (node.successors.length === 0) {
        endNodes.push(nodeId);
      }
    });
    
    return endNodes;
  }
  
  /**
   * Get detailed information about the graph structure for debugging
   */
  public getGraphAnalysis(graph: TaskGraph): {
    nodeCount: number;
    dependencyCount: number;
    startNodeCount: number;
    endNodeCount: number;
    maxDepth: number;
    hasCycles: boolean;
  } {
    let dependencyCount = 0;
    let maxDepth = 0;
    
    graph.nodes.forEach(node => {
      dependencyCount += node.dependencies.length;
      
      // Calculate approximate depth (could be more sophisticated)
      const depth = this.calculateNodeDepth(node.id, graph.nodes, new Set());
      maxDepth = Math.max(maxDepth, depth);
    });
    
    return {
      nodeCount: graph.nodes.size,
      dependencyCount,
      startNodeCount: graph.startNodes.length,
      endNodeCount: graph.endNodes.length,
      maxDepth,
      hasCycles: !graph.isValid && graph.errors.some(error => error.includes('circular'))
    };
  }
  
  /**
   * Calculate approximate depth of a node in the graph
   */
  private calculateNodeDepth(
    nodeId: string,
    nodes: Map<string, TaskNode>,
    visited: Set<string>
  ): number {
    if (visited.has(nodeId)) {
      return 0; // Avoid infinite recursion in case of cycles
    }
    
    visited.add(nodeId);
    const node = nodes.get(nodeId);
    if (!node) return 0;
    
    if (node.dependencies.length === 0) {
      return 0; // Start node has depth 0
    }
    
    let maxPredecessorDepth = 0;
    node.dependencies.forEach(dep => {
      const predecessorDepth = this.calculateNodeDepth(dep.predecessorId, nodes, new Set(visited));
      maxPredecessorDepth = Math.max(maxPredecessorDepth, predecessorDepth);
    });
    
    return maxPredecessorDepth + 1;
  }
  
  /**
   * Create a visual representation of the graph for debugging
   */
  public generateGraphSummary(graph: TaskGraph): string {
    const analysis = this.getGraphAnalysis(graph);
    
    return `
Task Graph Summary:
- Nodes: ${analysis.nodeCount}
- Dependencies: ${analysis.dependencyCount}
- Start Nodes: ${analysis.startNodeCount} (${graph.startNodes.join(', ')})
- End Nodes: ${analysis.endNodeCount} (${graph.endNodes.join(', ')})
- Max Depth: ${analysis.maxDepth}
- Valid: ${graph.isValid}
- Errors: ${graph.errors.join('; ') || 'None'}
    `.trim();
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create a singleton GraphBuilder instance for reuse
 */
export const graphBuilder = new GraphBuilder();

/**
 * Convenience function to build a graph from tasks
 */
export const buildTaskGraph = (
  rawTasks: Task[],
  customDurations: Record<string, number> = {}
): TaskGraph => {
  return graphBuilder.buildTaskGraph(rawTasks, customDurations);
};

/**
 * Quick function to check if tasks have dependencies
 */
export const hasDependencies = (rawTasks: Task[]): boolean => {
  return rawTasks.some(task => task.dependencies && task.dependencies.length > 0);
};

/**
 * Extract dependency information for debugging
 */
export const extractDependencyInfo = (rawTasks: Task[]): {
  tasksWithDependencies: number;
  totalDependencies: number;
  dependencyTypes: Record<string, number>;
} => {
  let tasksWithDependencies = 0;
  let totalDependencies = 0;
  const dependencyTypes: Record<string, number> = {};
  
  rawTasks.forEach(task => {
    if (task.dependencies && task.dependencies.length > 0) {
      tasksWithDependencies++;
      totalDependencies += task.dependencies.length;
      
      task.dependencies.forEach(dep => {
        dependencyTypes[dep.type] = (dependencyTypes[dep.type] || 0) + 1;
      });
    }
  });
  
  return {
    tasksWithDependencies,
    totalDependencies,
    dependencyTypes
  };
};
