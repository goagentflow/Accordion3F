import { useEffect } from 'react';
import { useAssets, useDates, useTasks, useUI } from '../hooks/useTimelineSelectors';
import { useTimeline } from '../hooks/useTimeline';
import { TimelineActions } from '../actions/timelineActions';
import { buildAssetTimeline, getEarliestStartDate, findDateConflicts } from '../services/TimelineCalculator';

// Orchestrates timeline build + warnings based on selected assets and dates
export const Orchestrator: React.FC = () => {
  const { assets } = useAssets();
  const { dates } = useDates();
  const { tasks } = useTasks();
  const { ui } = useUI();
  const { dispatch } = useTimeline();

  useEffect(() => {
    // Only build when assets selected and we have either global or per-asset live dates
    if (!assets.selected || assets.selected.length === 0) return;

    // If timeline is frozen by an import, don't rebuild; only compute derived warnings
    if (ui && (ui as any).freezeImportedTimeline) {
      const startDates: Record<string, string> = {};
      assets.selected.forEach(asset => {
        const mine = (tasks.timeline as any[]).filter(t => t.assetId === asset.id);
        const earliest = getEarliestStartDate(mine as any);
        if (earliest) startDates[asset.id] = earliest;
      });
      dispatch(TimelineActions.setCalculatedStartDates(startDates));
      const conflicts = findDateConflicts(assets.selected as any, startDates);
      dispatch(TimelineActions.setDateErrors(conflicts));
      return;
    }

    // If catalog hasn't populated byAsset yet but we already have an imported timeline,
    // avoid overwriting it. Update calculatedStartDates/dateErrors from the existing timeline.
    const byAssetEmpty = !tasks.byAsset || Object.keys(tasks.byAsset).length === 0;
    const hasImportedTimeline = Array.isArray(tasks.timeline) && tasks.timeline.length > 0;
    if (byAssetEmpty && hasImportedTimeline) {
      const startDates: Record<string, string> = {};
      assets.selected.forEach(asset => {
        const mine = (tasks.timeline as any[]).filter(t => t.assetId === asset.id);
        const earliest = getEarliestStartDate(mine as any);
        if (earliest) startDates[asset.id] = earliest;
      });
      dispatch(TimelineActions.setCalculatedStartDates(startDates));
      const conflicts = findDateConflicts(assets.selected as any, startDates);
      dispatch(TimelineActions.setDateErrors(conflicts));
      return; // keep imported timeline intact until catalog is ready
    }

    const allTimeline: any[] = [];
    assets.selected.forEach(asset => {
      const instanceBase = (tasks as any).instanceBase && (tasks as any).instanceBase[asset.id];
      const base = (instanceBase && instanceBase.length > 0)
        ? instanceBase
        : ((tasks.byAsset && tasks.byAsset[asset.type]) || []);
      // Robust live date resolution: if global is enabled but empty, fall back to per-asset start date
      const resolvedGlobal = dates.globalLiveDate && dates.globalLiveDate.trim() !== '' ? dates.globalLiveDate : undefined;
      const live = dates.useGlobalDate ? (resolvedGlobal || asset.startDate) : asset.startDate;
      if (!live || base.length === 0) return;
      // Clone raw tasks for this asset instance
      const raw = base.map((t: any, idx: number) => ({
        ...t,
        id: `${asset.id}-template-${idx}`,
        assetId: asset.id,
        assetType: asset.type
      }));

      // Build allowed id set and sanitize dependencies from tasks.deps
      const allowedIds = new Set(raw.map((r: any) => r.id));
      const depsMap: Record<string, Array<{ predecessorId: string; type: 'FS'; lag: number }>> = (tasks.deps as any) || {};
      let dropped = 0;
      const sanitize = (succId: string) => {
        const list = depsMap[succId] || [];
        if (!list || list.length === 0) return [] as any[];
        const filtered = list.filter(d => allowedIds.has(d.predecessorId) && d.predecessorId !== succId);
        dropped += (list.length - filtered.length);
        // Ensure FS type and negative lag for overlaps
        return filtered.map(d => ({ predecessorId: d.predecessorId, type: 'FS' as const, lag: d.lag }));
      };

      raw.forEach((r: any) => {
        r.dependencies = sanitize(r.id);
      });

      // When using instanceBase (imported editable plan), custom tasks are already embedded.
      if (!(instanceBase && instanceBase.length > 0)) {
        const customForAsset = (tasks.bank && (tasks.bank as any)[asset.id]) || [];
        customForAsset
          .filter((t: any) => t && t.isCustom)
          .forEach((custom: any) => {
            const ct = {
              id: custom.id,
              name: custom.name,
              duration: custom.duration,
              owner: custom.owner,
              assetId: asset.id,
              assetType: asset.type,
              isCustom: true,
              dependencies: sanitize(custom.id)
            } as any;
            if (custom.insertAfterTaskId) {
              const idx = raw.findIndex((r: any) => r.id === custom.insertAfterTaskId);
              const insertIndex = idx !== -1 ? idx + 1 : raw.length;
              raw.splice(insertIndex, 0, ct);
            } else {
              raw.push(ct);
            }
          });
      }

      if (dropped > 0 && process.env.NODE_ENV !== 'production') {
        // Dev-friendly warning to help catch mapping issues without breaking timeline
        // eslint-disable-next-line no-console
        console.warn(`[Orchestrator] Dropped ${dropped} invalid dependency reference(s) for asset "${asset.name || asset.type}" during DAG injection.`);
      }

      // Apply per-instance duration overrides before scheduling (Bug fix: task name collision)
      // Per-instance overrides have priority over name-based overrides
      if (tasks.instanceDurations) {
        raw.forEach((task: any) => {
          if (task.id && tasks.instanceDurations[task.id] !== undefined) {
            task.duration = tasks.instanceDurations[task.id];
          }
        });
      }

      let timeline = buildAssetTimeline(raw as any, live, assets.taskDurations[asset.type] || {}, dates.bankHolidays || []);
      // Apply task name overrides (renameTask) if present
      if (tasks.names) {
        timeline = timeline.map((t: any) => ({
          ...t,
          name: tasks.names[t.id] ? tasks.names[t.id] : t.name
        }));
      }
      allTimeline.push(...timeline);
    });

    dispatch(TimelineActions.updateTimeline(allTimeline as any));
  }, [
    assets.selected,
    assets.taskDurations,
    dates.useGlobalDate,
    dates.globalLiveDate,
    dates.bankHolidays,
    tasks.bank,
    tasks.byAsset,
    tasks.names,
    tasks.instanceDurations,
    tasks.deps,
    tasks.custom,
    dispatch
  ]);

  // Secondary effect: always recompute derived warnings from the current timeline
  // This guarantees that after any operation that changes the rendered timeline
  // (including custom task additions), the earliest starts and dateErrors are fresh.
  useEffect(() => {
    if (!Array.isArray(tasks.timeline) || tasks.timeline.length === 0) return;
    if (!assets.selected || assets.selected.length === 0) return;

    const startDates: Record<string, string> = {};
    assets.selected.forEach(asset => {
      const mine = (tasks.timeline as any[]).filter(t => t.assetId === asset.id);
      const earliest = getEarliestStartDate(mine as any);
      if (earliest) startDates[asset.id] = earliest;
    });
    dispatch(TimelineActions.setCalculatedStartDates(startDates));
    const conflicts = findDateConflicts(assets.selected as any, startDates);
    dispatch(TimelineActions.setDateErrors(conflicts));
  }, [tasks.timeline, assets.selected, dispatch]);

  return null;
};

export default Orchestrator;
