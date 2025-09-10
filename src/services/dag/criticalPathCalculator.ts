/**
 * Critical Path Calculator Module for DAG Timeline Calculator
 * Implements Critical Path Method (CPM) algorithms for project scheduling
 * 
 * Following Golden Rule #2: 400 Line Max - Extracted from TimelineCalculatorDAG.ts
 * Following Golden Rule #4: Clear Roles - Single responsibility for CPM calculations
 * Following Golden Rule #1: Safety First - Robust algorithm implementation
 */

import { TaskGraph } from './graphBuilder';

// ============================================
// CPM Calculation Results
// ============================================

export interface CPMResults {
  projectDuration: number;
  criticalPath: string[];
  calculationSuccess: boolean;
  errors: string[];
}

export interface TaskTimingInfo {
  nodeId: string;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  totalFloat: number;
  isCritical: boolean;
}

// ============================================
// Critical Path Calculator Class
// ============================================

export class CriticalPathCalculator {
  /**
   * Perform complete CPM calculation on a task graph
   * 
   * @param graph - The task graph to analyze
   * @returns CPM results with project duration and critical path
   */
  public calculateCriticalPath(graph: TaskGraph): CPMResults {
    try {
      if (!graph.isValid) {
        return {
          projectDuration: 0,
          criticalPath: [],
          calculationSuccess: false,
          errors: graph.errors
        };
      }
      
      // Step 1: Forward Pass - Calculate earliest times
      this.performForwardPass(graph);
      
      // Step 2: Determine project duration
      const projectDuration = this.calculateProjectDuration(graph);
      
      // Step 3: Backward Pass - Calculate latest times
      this.performBackwardPass(graph, projectDuration);
      
      // Step 4: Calculate float and identify critical path
      const criticalPath = this.identifyCriticalPath(graph);
      
      return {
        projectDuration: projectDuration + 1, // Convert from 0-based to actual days
        criticalPath,
        calculationSuccess: true,
        errors: []
      };
      
    } catch (error) {
      return {
        projectDuration: 0,
        criticalPath: [],
        calculationSuccess: false,
        errors: [`CPM calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
  
  /**
   * Step 1: CPM Forward Pass - Calculate earliest start and finish times
   * Works in topological order from tasks with no predecessors
   */
  private performForwardPass(graph: TaskGraph): void {
    // Initialize start nodes
    graph.startNodes.forEach(nodeId => {
      const node = graph.nodes.get(nodeId)!;
      node.earliestStart = 0;
      node.earliestFinish = node.duration - 1; // Duration includes start day
    });
    
    // Process nodes in topological order
    const processed = new Set<string>();
    const queue = [...graph.startNodes];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (processed.has(nodeId)) continue;
      
      const node = graph.nodes.get(nodeId)!;
      
      // Check if all predecessors are processed
      const allPredecessorsReady = node.dependencies.every(dep => 
        processed.has(dep.predecessorId)
      );
      
      if (!allPredecessorsReady) {
        // Put back in queue if predecessors not ready
        queue.push(nodeId);
        continue;
      }
      
      // Calculate earliest start based on all predecessors
      if (node.dependencies.length > 0) {
        let maxEarliestStart = 0;
        
        node.dependencies.forEach(dep => {
          const predecessor = graph.nodes.get(dep.predecessorId)!;
          
          if (dep.type === 'FS') {
            // Finish-to-Start relationship
            const predecessorFinish = predecessor.earliestFinish;
            const earliestStart = predecessorFinish + 1 + dep.lag;
            maxEarliestStart = Math.max(maxEarliestStart, earliestStart);
          }
        });
        
        node.earliestStart = maxEarliestStart;
        node.earliestFinish = node.earliestStart + node.duration - 1;
      }
      
      processed.add(nodeId);
      
      // Add successors to queue
      node.successors.forEach(successorId => {
        if (!processed.has(successorId)) {
          queue.push(successorId);
        }
      });
    }
  }
  
  /**
   * Calculate the total project duration from forward pass results
   */
  private calculateProjectDuration(graph: TaskGraph): number {
    let projectDuration = 0;
    
    graph.endNodes.forEach(nodeId => {
      const node = graph.nodes.get(nodeId)!;
      projectDuration = Math.max(projectDuration, node.earliestFinish);
    });
    
    return projectDuration;
  }
  
  /**
   * Step 2: CPM Backward Pass - Calculate latest start and finish times
   * Works backwards from the project end
   */
  private performBackwardPass(graph: TaskGraph, projectDuration: number): void {
    // Initialize end nodes with latest = earliest (they're on critical path)
    graph.endNodes.forEach(nodeId => {
      const node = graph.nodes.get(nodeId)!;
      node.latestFinish = projectDuration;
      node.latestStart = node.latestFinish - node.duration + 1;
    });
    
    // Process nodes in reverse topological order
    const processed = new Set<string>();
    const queue = [...graph.endNodes];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (processed.has(nodeId)) continue;
      
      const node = graph.nodes.get(nodeId)!;
      
      // Check if all successors are processed
      const allSuccessorsReady = node.successors.every(successorId =>
        processed.has(successorId)
      );
      
      if (!allSuccessorsReady) {
        queue.push(nodeId);
        continue;
      }
      
      // Calculate latest finish based on all successors
      if (node.successors.length > 0) {
        let minLatestFinish = Infinity;
        
        node.successors.forEach(successorId => {
          const successor = graph.nodes.get(successorId)!;
          
          // Find the dependency from successor back to this node
          const dependency = successor.dependencies.find(dep => 
            dep.predecessorId === nodeId
          );
          
          if (dependency && dependency.type === 'FS') {
            const latestFinish = successor.latestStart - 1 - dependency.lag;
            minLatestFinish = Math.min(minLatestFinish, latestFinish);
          }
        });
        
        if (minLatestFinish !== Infinity) {
          node.latestFinish = minLatestFinish;
          node.latestStart = node.latestFinish - node.duration + 1;
        }
      }
      
      processed.add(nodeId);
      
      // Add predecessors to queue
      node.dependencies.forEach(dep => {
        if (!processed.has(dep.predecessorId)) {
          queue.push(dep.predecessorId);
        }
      });
    }
  }
  
  /**
   * Step 3: Calculate total float and identify critical path
   */
  private identifyCriticalPath(graph: TaskGraph): string[] {
    const criticalPath: string[] = [];
    
    graph.nodes.forEach(node => {
      // Total Float = Latest Start - Earliest Start
      node.totalFloat = node.latestStart - node.earliestStart;
      
      // Critical tasks have zero (or near-zero) float
      node.isCritical = Math.abs(node.totalFloat) < 0.001;
      
      if (node.isCritical) {
        criticalPath.push(node.id);
      }
    });
    
    // Sort critical path by earliest start time for logical ordering
    criticalPath.sort((a, b) => {
      const nodeA = graph.nodes.get(a)!;
      const nodeB = graph.nodes.get(b)!;
      return nodeA.earliestStart - nodeB.earliestStart;
    });
    
    return criticalPath;
  }
  
  /**
   * Get detailed timing information for all tasks
   */
  public getTaskTimingInfo(graph: TaskGraph): TaskTimingInfo[] {
    const timingInfo: TaskTimingInfo[] = [];
    
    graph.nodes.forEach((node, nodeId) => {
      timingInfo.push({
        nodeId,
        earliestStart: node.earliestStart,
        earliestFinish: node.earliestFinish,
        latestStart: node.latestStart,
        latestFinish: node.latestFinish,
        totalFloat: node.totalFloat,
        isCritical: node.isCritical
      });
    });
    
    // Sort by earliest start time
    timingInfo.sort((a, b) => a.earliestStart - b.earliestStart);
    
    return timingInfo;
  }
  
  /**
   * Calculate compression opportunities in the schedule
   */
  public getCompressionOpportunities(graph: TaskGraph): {
    tasksWithFloat: TaskTimingInfo[];
    totalFloatAvailable: number;
    maxCompressionPossible: number;
    recommendations: string[];
  } {
    const tasksWithFloat = this.getTaskTimingInfo(graph)
      .filter(task => task.totalFloat > 0);
    
    const totalFloatAvailable = tasksWithFloat.reduce(
      (sum, task) => sum + task.totalFloat, 0
    );
    
    // Maximum compression is limited by the critical path
    const maxCompressionPossible = Math.min(totalFloatAvailable, 
      Math.floor(totalFloatAvailable / tasksWithFloat.length));
    
    const recommendations = this.generateCompressionRecommendations(tasksWithFloat);
    
    return {
      tasksWithFloat,
      totalFloatAvailable,
      maxCompressionPossible,
      recommendations
    };
  }
  
  /**
   * Generate human-readable recommendations for schedule compression
   */
  private generateCompressionRecommendations(tasksWithFloat: TaskTimingInfo[]): string[] {
    const recommendations: string[] = [];
    
    if (tasksWithFloat.length === 0) {
      recommendations.push("No schedule compression possible - all tasks are on the critical path.");
      return recommendations;
    }
    
    // Sort by float amount (most float first)
    const sortedByFloat = [...tasksWithFloat].sort((a, b) => b.totalFloat - a.totalFloat);
    
    if (sortedByFloat.length > 0) {
      const taskWithMostFloat = sortedByFloat[0];
      recommendations.push(
        `Task ${taskWithMostFloat.nodeId} has ${taskWithMostFloat.totalFloat} days of float - good candidate for acceleration.`
      );
    }
    
    if (tasksWithFloat.length > 3) {
      recommendations.push(
        `${tasksWithFloat.length} tasks have schedule flexibility - consider parallel execution or duration reduction.`
      );
    }
    
    return recommendations;
  }
  
  /**
   * Validate CPM calculation results for consistency
   */
  public validateCalculationResults(graph: TaskGraph): {
    valid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let valid = true;
    
    graph.nodes.forEach((node, nodeId) => {
      // Check that earliest finish = earliest start + duration - 1
      if (node.earliestFinish !== node.earliestStart + node.duration - 1) {
        warnings.push(`Task ${nodeId}: Inconsistent earliest times`);
        valid = false;
      }
      
      // Check that latest finish = latest start + duration - 1
      if (node.latestFinish !== node.latestStart + node.duration - 1) {
        warnings.push(`Task ${nodeId}: Inconsistent latest times`);
        valid = false;
      }
      
      // Check that latest >= earliest
      if (node.latestStart < node.earliestStart) {
        warnings.push(`Task ${nodeId}: Latest start before earliest start`);
        valid = false;
      }
      
      // Check critical path logic
      if (node.isCritical && Math.abs(node.totalFloat) > 0.001) {
        warnings.push(`Task ${nodeId}: Marked critical but has float`);
        valid = false;
      }
    });
    
    return { valid, warnings };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create a singleton CriticalPathCalculator instance for reuse
 */
export const criticalPathCalculator = new CriticalPathCalculator();

/**
 * Convenience function to calculate critical path
 */
export const calculateCriticalPath = (graph: TaskGraph): CPMResults => {
  return criticalPathCalculator.calculateCriticalPath(graph);
};

/**
 * Quick function to get project duration from a graph
 */
export const getProjectDuration = (graph: TaskGraph): number => {
  const results = criticalPathCalculator.calculateCriticalPath(graph);
  return results.projectDuration;
};

/**
 * Extract critical path task IDs from calculation results
 */
export const getCriticalPathTasks = (graph: TaskGraph): string[] => {
  const results = criticalPathCalculator.calculateCriticalPath(graph);
  return results.criticalPath;
};