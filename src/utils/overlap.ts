import { calculateWorkingDaysBetween } from './dateHelpers';
import { isDebugMode, useStrictOverlapCalc } from '../config/features';

/**
 * Compute overlap days for a drag-created FS dependency.
 * - Strict mode: exact working days between start and predecessor end
 * - Legacy mode: inclusive (+1) for backward-compatible visual behavior
 */
export function computeOverlapDays(newStartISO: string | Date, predecessorEndISO: string | Date, bankHolidays: string[] = []): number {
  const newStart = new Date(newStartISO as any);
  const predEnd = new Date(predecessorEndISO as any);
  const strict = useStrictOverlapCalc();
  const base = calculateWorkingDaysBetween(newStart, predEnd, bankHolidays);
  const overlap = strict ? base : base + 1;
  if (isDebugMode()) {
    // eslint-disable-next-line no-console
    console.log('[overlap] calc', { strict, base, overlap, newStart: newStart.toISOString().split('T')[0], predEnd: predEnd.toISOString().split('T')[0] });
  }
  return Math.max(0, overlap);
}

