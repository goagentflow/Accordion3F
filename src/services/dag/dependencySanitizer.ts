/**
 * Dependency Sanitizer for DAG Graph Builder
 * Normalizes and validates dependency lists for a task.
 */

import { Task } from '../../types/timeline.types';
import type { TaskDependency } from './graphBuilder';

/**
 * Remove invalid dependencies and enforce minimal invariants.
 * - No null/undefined entries
 * - No self-dependencies
 * - Predecessor must exist in the current task set (idSet)
 */
export function sanitizeDependencies(
  task: Task,
  rawDeps: TaskDependency[] | undefined,
  idSet: Set<string>
): TaskDependency[] {
  if (!rawDeps || rawDeps.length === 0) return [];

  return rawDeps
    .filter(Boolean)
    .filter(dep => !!dep.predecessorId)
    .filter(dep => dep.predecessorId !== task.id)
    .filter(dep => idSet.has(dep.predecessorId))
    .map(dep => ({
      predecessorId: dep.predecessorId,
      type: (dep.type as any) === 'SS' || (dep.type as any) === 'FF' ? (dep.type as any) : 'FS',
      lag: dep.lag ?? 0
    }));
}
