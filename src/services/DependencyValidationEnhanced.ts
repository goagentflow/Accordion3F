/**
 * Enhanced Dependency Validation Service
 * Provides advanced validation rules and conflict detection for dependencies
 * 
 * Following Golden Rule #2: 400 Line Max - Focused validation service
 * Following Golden Rule #4: Clear Roles - Only handles dependency validation logic
 */

import { isDebugMode } from '../config/features';

export interface TaskInfo {
  id: string;
  name: string;
  duration: number;
  assetId: string;
  dependencies?: DependencyInfo[];
  start?: string;
  end?: string;
}

export interface DependencyInfo {
  predecessorId: string;
  successorId: string;
  type: 'FS';
  lag: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface CircularDependencyPath {
  path: string[];
  description: string;
}

export class DependencyValidationEnhanced {
  private tasks: Map<string, TaskInfo>;
  private dependencies!: Map<string, DependencyInfo[]>;

  constructor(tasks: TaskInfo[]) {
    this.tasks = new Map(tasks.map(task => [task.id, task]));
    this.buildDependencyGraph(tasks);
  }

  private buildDependencyGraph(tasks: TaskInfo[]): void {
    this.dependencies = new Map();
    
    tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies.forEach(dep => {
          const successors = this.dependencies.get(dep.predecessorId) || [];
          successors.push(dep);
          this.dependencies.set(dep.predecessorId, successors);
        });
      }
    });
  }

  /**
   * Comprehensive validation for creating a new dependency
   */
  public validateNewDependency(
    predecessorId: string,
    successorId: string,
    lag: number
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    const basicValidation = this.validateBasicRules(predecessorId, successorId, lag);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);

    // Circular dependency detection
    const circularValidation = this.detectCircularDependency(predecessorId, successorId);
    if (!circularValidation.isValid) {
      errors.push(...circularValidation.errors);
    }

    // Redundant dependency detection
    const redundantValidation = this.detectRedundantDependency(predecessorId, successorId);
    if (redundantValidation.isRedundant) {
      warnings.push(...redundantValidation.warnings);
      suggestions.push(...redundantValidation.suggestions);
    }

    // Timeline impact analysis
    const impactAnalysis = this.analyzeTimelineImpact(predecessorId, successorId, lag);
    warnings.push(...impactAnalysis.warnings);
    suggestions.push(...impactAnalysis.suggestions);

    // Resource conflict detection
    const resourceValidation = this.detectResourceConflicts(predecessorId, successorId, lag);
    warnings.push(...resourceValidation.warnings);

    const severity = errors.length > 0 ? 'high' : 
                    warnings.length > 2 ? 'medium' : 'low';

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      severity
    };
  }

  private validateBasicRules(
    predecessorId: string,
    successorId: string,
    lag: number
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if tasks exist
    const predecessor = this.tasks.get(predecessorId);
    const successor = this.tasks.get(successorId);

    if (!predecessor) {
      errors.push(`Predecessor task '${predecessorId}' not found`);
      return { errors, warnings };
    }

    if (!successor) {
      errors.push(`Successor task '${successorId}' not found`);
      return { errors, warnings };
    }

    // Same task check
    if (predecessorId === successorId) {
      errors.push('Cannot create dependency from task to itself');
      return { errors, warnings };
    }

    // Asset boundary check
    if (predecessor.assetId !== successor.assetId) {
      errors.push(`Dependencies cannot cross asset boundaries (${predecessor.assetId} → ${successor.assetId})`);
    }

    // Lag validation
    if (lag < 0 && Math.abs(lag) >= predecessor.duration) {
      errors.push(`Overlap (${Math.abs(lag)} days) cannot equal or exceed predecessor duration (${predecessor.duration} days)`);
    }

    // Large overlap warning
    if (lag < 0 && Math.abs(lag) > predecessor.duration * 0.8) {
      warnings.push(`Large overlap (${Math.abs(lag)} days) may indicate over-compression`);
    }

    return { errors, warnings };
  }

  private detectCircularDependency(
    predecessorId: string,
    successorId: string
  ): { isValid: boolean; errors: string[] } {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const findPath = (currentId: string, targetId: string, path: string[]): string[] | null => {
      if (currentId === targetId) {
        return [...path, currentId];
      }

      if (visited.has(currentId) || recursionStack.has(currentId)) {
        return null;
      }

      visited.add(currentId);
      recursionStack.add(currentId);

      const successors = this.dependencies.get(currentId) || [];
      for (const dep of successors) {
        const result = findPath(dep.successorId, targetId, [...path, currentId]);
        if (result) {
          recursionStack.delete(currentId);
          return result;
        }
      }

      recursionStack.delete(currentId);
      return null;
    };

    // Check if adding this dependency would create a cycle
    const cyclePath = findPath(successorId, predecessorId, []);
    
    if (cyclePath) {
      const pathDescription = cyclePath.map(id => 
        this.tasks.get(id)?.name || id
      ).join(' → ');

      return {
        isValid: false,
        errors: [`Would create circular dependency: ${pathDescription} → ${this.tasks.get(predecessorId)?.name}`]
      };
    }

    return { isValid: true, errors: [] };
  }

  private detectRedundantDependency(
    predecessorId: string,
    successorId: string
  ): { isRedundant: boolean; warnings: string[]; suggestions: string[] } {
    // Check if there's already an indirect path
    const hasIndirectPath = this.hasPath(predecessorId, successorId, new Set([predecessorId]));
    
    if (hasIndirectPath) {
      const predecessor = this.tasks.get(predecessorId);
      const successor = this.tasks.get(successorId);
      
      return {
        isRedundant: true,
        warnings: [`Indirect dependency path already exists between ${predecessor?.name} and ${successor?.name}`],
        suggestions: ['Consider if this direct dependency is necessary or if it adds meaningful constraint']
      };
    }

    return { isRedundant: false, warnings: [], suggestions: [] };
  }

  private hasPath(fromId: string, toId: string, visited: Set<string>): boolean {
    if (visited.has(toId)) return false;
    
    const successors = this.dependencies.get(fromId) || [];
    for (const dep of successors) {
      if (dep.successorId === toId) return true;
      
      const newVisited = new Set(visited);
      newVisited.add(dep.successorId);
      if (this.hasPath(dep.successorId, toId, newVisited)) return true;
    }

    return false;
  }

  private analyzeTimelineImpact(
    predecessorId: string,
    successorId: string,
    lag: number
  ): { warnings: string[]; suggestions: string[] } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const predecessor = this.tasks.get(predecessorId);
    const successor = this.tasks.get(successorId);

    if (!predecessor || !successor) return { warnings, suggestions };

    // Analyze compression benefit
    if (lag < 0) {
      const compressionDays = Math.abs(lag);
      const compressionPercentage = (compressionDays / predecessor.duration) * 100;

      if (compressionPercentage > 50) {
        warnings.push(`High compression (${compressionPercentage.toFixed(1)}%) may stress project resources`);
        suggestions.push('Consider reducing overlap or adding buffer time for risk management');
      }
    }

    // Analyze task duration mismatch
    const durationRatio = Math.max(predecessor.duration, successor.duration) / 
                         Math.min(predecessor.duration, successor.duration);
    
    if (durationRatio > 3) {
      suggestions.push('Large duration difference between dependent tasks - consider breaking into smaller tasks');
    }

    return { warnings, suggestions };
  }

  private detectResourceConflicts(
    predecessorId: string,
    successorId: string,
    lag: number
  ): { warnings: string[] } {
    const warnings: string[] = [];

    // This is a simplified check - in a real system, you'd check actual resource assignments
    const predecessor = this.tasks.get(predecessorId);
    const successor = this.tasks.get(successorId);

    if (!predecessor || !successor) return { warnings };

    // Check for potential resource conflicts based on task overlap
    if (lag < 0) {
      const overlapDays = Math.abs(lag);
      if (overlapDays > 1) {
        warnings.push(`${overlapDays}-day overlap may create resource conflicts if same team works on both tasks`);
      }
    }

    return { warnings };
  }

  /**
   * Validate multiple dependencies at once
   */
  public validateBulkDependencies(dependencies: Array<{
    predecessorId: string;
    successorId: string;
    lag: number;
  }>): Array<ValidationResult & { dependency: typeof dependencies[0] }> {
    return dependencies.map(dep => ({
      dependency: dep,
      ...this.validateNewDependency(dep.predecessorId, dep.successorId, dep.lag)
    }));
  }

  /**
   * Get optimization suggestions for existing dependencies
   */
  public getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const allDependencies: DependencyInfo[] = [];

    // Collect all dependencies
    this.dependencies.forEach(deps => allDependencies.push(...deps));

    // Analyze patterns
    const overlapCount = allDependencies.filter(dep => dep.lag < 0).length;
    const totalDeps = allDependencies.length;

    if (totalDeps === 0) {
      suggestions.push('No dependencies found - consider adding task relationships to optimize timeline');
    } else if (overlapCount === 0 && totalDeps > 3) {
      suggestions.push('All dependencies are sequential - consider adding overlaps to compress timeline');
    } else if (overlapCount / totalDeps > 0.8) {
      suggestions.push('High percentage of overlapping tasks - ensure resources can handle concurrent work');
    }

    if (isDebugMode()) {
      console.log('Dependency optimization analysis:', {
        totalDependencies: totalDeps,
        overlaps: overlapCount,
        suggestions: suggestions.length
      });
    }

    return suggestions;
  }
}