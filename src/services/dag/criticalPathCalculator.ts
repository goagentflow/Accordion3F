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
  private static readonly MAX_ITERATIONS = 1000;
  private static readonly TIME_BUDGET_MS = 5000;
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
      
      const start = Date.now();
      const deadline = start + CriticalPathCalculator.TIME_BUDGET_MS;
      // Step 1: Forward Pass - Calculate earliest times
      this.performForwardPass(graph, deadline);
      
      // Step 2: Determine project duration
      const projectDuration = this.calculateProjectDuration(graph);
      
      // Step 3: Backward Pass - Calculate latest times
      this.performBackwardPass(graph, projectDuration, deadline);
      
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
  private performForwardPass(graph: TaskGraph, deadlineMs: number): void {
    // Initialize start nodes
    graph.startNodes.forEach(nodeId => {
      const node = graph.nodes.get(nodeId)!;
      node.earliestStart = 0;
      node.earliestFinish = node.duration - 1; // Duration includes start day
    });
    
    // Process nodes in topological order
    const processed = new Set<string>();
    const queue = [...graph.startNodes];
    let iterations = 0;
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (processed.has(nodeId)) continue;
      
      iterations++;
      if (iterations > CriticalPathCalculator.MAX_ITERATIONS) {
        throw new Error('CPM forward pass iteration limit exceeded');
      }
      if (Date.now() > deadlineMs) {
        throw new Error('CPM forward pass timed out');
      }
      
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
      
      // Calculate earliest start based on all predecessors and dependency types
      if (node.dependencies.length > 0) {
        let requiredES = 0; // minimum ES constraint
        let requiredEF = -Infinity; // for FF constraints

        node.dependencies.forEach(dep => {
          const predecessor = graph.nodes.get(dep.predecessorId)!;
          if (!predecessor) return;

          if (dep.type === 'FS') {
            // ES >= pred.EF + 1 + lag
            const cand = predecessor.earliestFinish + 1 + dep.lag;
            requiredES = Math.max(requiredES, cand);
          } else if (dep.type === 'SS') {
            // ES >= pred.ES + lag
            const cand = predecessor.earliestStart + dep.lag;
            requiredES = Math.max(requiredES, cand);
          } else if (dep.type === 'FF') {
            // EF >= pred.EF + lag
            const candEF = predecessor.earliestFinish + dep.lag;
            requiredEF = Math.max(requiredEF, candEF);
          }
        });

        if (requiredEF !== -Infinity) {
          const candFromFF = requiredEF - (node.duration - 1);
          requiredES = Math.max(requiredES, candFromFF);
        }

        node.earliestStart = requiredES;
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
  private performBackwardPass(graph: TaskGraph, projectDuration: number, deadlineMs: number): void {
    // Initialize end nodes with latest = earliest (they're on critical path)
    graph.endNodes.forEach(nodeId => {
      const node = graph.nodes.get(nodeId)!;
      node.latestFinish = projectDuration;
      node.latestStart = node.latestFinish - node.duration + 1;
    });
    
    // Process nodes in reverse topological order
    const processed = new Set<string>();
    const queue = [...graph.endNodes];
    let iterations = 0;
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (processed.has(nodeId)) continue;
      
      iterations++;
      if (iterations > CriticalPathCalculator.MAX_ITERATIONS) {
        throw new Error('CPM backward pass iteration limit exceeded');
      }
      if (Date.now() > deadlineMs) {
        throw new Error('CPM backward pass timed out');
      }
      
      const node = graph.nodes.get(nodeId)!;
      
      // Check if all successors are processed
      const allSuccessorsReady = node.successors.every(successorId =>
        processed.has(successorId)
      );
      
      if (!allSuccessorsReady) {
        queue.push(nodeId);
        continue;
      }
      
      // Calculate latest finish/start based on all successors and dependency types
      if (node.successors.length > 0) {
        let minLF = Infinity;

        node.successors.forEach(successorId => {
          const successor = graph.nodes.get(successorId)!;
          if (!successor) return;

          const dependency = successor.dependencies.find(dep => dep.predecessorId === nodeId);
          if (!dependency) return;

          if (dependency.type === 'FS') {
            // LF <= succ.LS - 1 - lag
            const candLF = successor.latestStart - 1 - dependency.lag;
            minLF = Math.min(minLF, candLF);
          } else if (dependency.type === 'SS') {
            // LS <= succ.LS - lag → LF = LS + dur - 1
            const candLS = successor.latestStart - dependency.lag;
            const candLF = candLS + node.duration - 1;
            minLF = Math.min(minLF, candLF);
          } else if (dependency.type === 'FF') {
            // LF <= succ.LF - lag
            const candLF = successor.latestFinish - dependency.lag;
            minLF = Math.min(minLF, candLF);
          }
        });

        if (minLF !== Infinity) {
          node.latestFinish = minLF;
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
