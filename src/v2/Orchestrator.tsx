import { useEffect, useMemo } from 'react';
import { useAssets, useDates, useTasks, useUI } from '../hooks/useTimelineSelectors';
import { useTimeline } from '../hooks/useTimeline';
import { TimelineActions } from '../actions/timelineActions';
import { buildAssetTimeline, buildAssetTimelineSequential, getEarliestStartDate, findDateConflicts } from '../services/TimelineCalculator';

// Orchestrates timeline build + warnings based on selected assets and dates
export const Orchestrator: React.FC = () => {
  const { assets } = useAssets();
  const { dates } = useDates();
  const { tasks } = useTasks();
  const { ui } = useUI();
  const { dispatch } = useTimeline();

  // Catalog-ordered selected assets (stable across renders)
  const orderedSelected = useMemo(() => {
    const catalog = Array.isArray(assets.available) ? (assets.available as any[]) : [];
    const norm = (s: string) => (s || '').toLowerCase().trim();
    const indexOfType = (t: string) => {
      const i = catalog.findIndex((x: any) => norm(x) === norm(t));
      return i === -1 ? Number.POSITIVE_INFINITY : i;
    };
    const arr = [...(assets.selected || [])];
    arr.sort((a: any, b: any) => {
      const ai = indexOfType(a.type);
      const bi = indexOfType(b.type);
      if (ai !== bi) return ai - bi;
      return norm(a.name).localeCompare(norm(b.name));
    });
    return arr;
  }, [assets.selected, assets.available]);

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
    const warnings: string[] = [];
    orderedSelected.forEach((asset: any) => {
      const instanceBase = (tasks as any).instanceBase && (tasks as any).instanceBase[asset.id];
      const base = (instanceBase && instanceBase.length > 0)
        ? instanceBase
        : ((tasks.byAsset && tasks.byAsset[asset.type]) || []);
      // Robust live date resolution: if global is enabled but empty, fall back to per-asset start date
      const resolvedGlobal = dates.globalLiveDate && dates.globalLiveDate.trim() !== '' ? dates.globalLiveDate : undefined;
      const live = dates.useGlobalDate ? (resolvedGlobal || asset.startDate) : asset.startDate;
      if (!live || base.length === 0) return;
      // Clone raw tasks for this asset instance and build baseId -> remappedId map
      const idMap = new Map<string, string>();
      const raw = base.map((t: any, idx: number) => {
        const remappedId = `${asset.id}-template-${idx}`;
        if (t && t.id) idMap.set(t.id, remappedId);
        return {
          ...t,
          id: remappedId,
          assetId: asset.id,
          assetType: asset.type
        };
      });

      // Build allowed id set and sanitize dependencies
      const allowedIds = new Set(raw.map((r: any) => r.id));
      const depsMap: Record<string, Array<{ predecessorId: string; type: 'FS'|'SS'|'FF'; lag: number }>> = (tasks.deps as any) || {};
      let dropped = 0;
      const sanitizeFromGlobal = (succId: string) => {
        const list = depsMap[succId] || [];
        if (!list || list.length === 0) return [] as any[];
        const filtered = list.filter(d => allowedIds.has(d.predecessorId) && d.predecessorId !== succId);
        dropped += (list.length - filtered.length);
        // Preserve dependency type and lag (default FS)
        return filtered.map(d => ({ predecessorId: d.predecessorId, type: (d as any).type || 'FS', lag: d.lag }));
      };

      raw.forEach((r: any, idx: number) => {
        // Prefer instanceBase dependencies when present; remap base ids to current raw ids
        const baseDeps = Array.isArray(base[idx]?.dependencies) ? base[idx].dependencies : [];
        const remappedBaseDeps = baseDeps.map((d: any) => ({
          predecessorId: idMap.get(d.predecessorId) || d.predecessorId,
          type: (d && (d.type === 'SS' || d.type === 'FF')) ? d.type : 'FS',
          lag: Number(d.lag) || 0
        }));
        const fromGlobal = sanitizeFromGlobal(r.id);
        const candidate = (remappedBaseDeps && remappedBaseDeps.length > 0) ? remappedBaseDeps : fromGlobal;
        r.dependencies = (candidate || []).filter((d: any) => allowedIds.has(d.predecessorId) && d.predecessorId !== r.id);
      });

      // Enforce within-asset sequential guard when using instanceBase
      // Do NOT add an FS(0) edge if there is already ANY dependency from prev to curr (SS/FF/FS)
      if (instanceBase && instanceBase.length > 0) {
        for (let i = 1; i < raw.length; i++) {
          const prev = raw[i - 1];
          const curr = raw[i];
          const depsAny: Array<{ predecessorId: string; type: 'FS' | 'SS' | 'FF'; lag: number }> = Array.isArray(curr.dependencies)
            ? (curr.dependencies as Array<{ predecessorId: string; type: 'FS' | 'SS' | 'FF'; lag: number }>)
            : [];
          const alreadyLinked = depsAny.some(d => d && d.predecessorId === prev.id);
          if (!alreadyLinked) depsAny.push({ predecessorId: prev.id, type: 'FS', lag: 0 });
          curr.dependencies = depsAny as any;
        }
      }

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
              dependencies: sanitizeFromGlobal(custom.id)
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

      let timeline: any[] = [];
      try {
        timeline = buildAssetTimeline(raw as any, live, assets.taskDurations[asset.type] || {}, dates.bankHolidays || []);
        const hadDagFailure = (!timeline || timeline.length === 0) && raw.length > 0;
        if (hadDagFailure) {
          // Graceful fallback to sequential calculator
          const seq = buildAssetTimelineSequential(raw as any, live, assets.taskDurations[asset.type] || {}, dates.bankHolidays || []);
          if (seq && seq.length > 0) {
            timeline = seq as any;
            warnings.push(`Advanced scheduling failed for "${asset.name || asset.type}". Showing safe timeline.`);
          } else {
            // Last resort: show last good timeline if available
            const lastGood = (tasks as any).lastGoodByAsset && (tasks as any).lastGoodByAsset[asset.id];
            if (Array.isArray(lastGood) && lastGood.length > 0) {
              timeline = lastGood as any;
              warnings.push(`Showing last known good timeline for "${asset.name || asset.type}".`);
            } else {
              // Nothing to show for this asset; log in dev
              if (process.env.NODE_ENV !== 'production') {
                // eslint-disable-next-line no-console
                console.warn('[Orchestrator] No timeline available after fallback for asset', asset);
              }
              timeline = [] as any;
            }
          }
        }
      } catch (error) {
        // Calculator threw; attempt last-good, then empty with warning
        const lastGood = (tasks as any).lastGoodByAsset && (tasks as any).lastGoodByAsset[asset.id];
        if (Array.isArray(lastGood) && lastGood.length > 0) {
          timeline = lastGood as any;
          warnings.push(`Calculation error for "${asset.name || asset.type}". Showing last known good timeline.`);
        } else {
          timeline = [] as any;
          warnings.push(`Calculation error for "${asset.name || asset.type}". Timeline unavailable for this asset.`);
        }
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('[Orchestrator] Calculator error', error);
        }
      }

      // Apply task name overrides (renameTask) if present
      if (tasks.names) {
        timeline = timeline.map((t: any) => ({
          ...t,
          name: tasks.names[t.id] ? tasks.names[t.id] : t.name
        }));
      }

      // Update last good cache when we have a non-empty computed timeline for this asset
      if (Array.isArray(timeline) && timeline.length > 0) {
        const perAsset = (timeline as any[]).filter(t => t.assetId === asset.id);
        if (perAsset.length > 0) {
          dispatch(TimelineActions.setLastGoodByAsset(asset.id, perAsset as any));
        }
      }
      allTimeline.push(...timeline);
    });

    dispatch(TimelineActions.updateTimeline(allTimeline as any));

    // Set/clear calculation warning banner
    if (warnings.length > 0) {
      dispatch(TimelineActions.setCalcWarning(warnings.join(' ')));
    } else if (ui && (ui as any).calcWarning) {
      dispatch(TimelineActions.setCalcWarning(null));
    }
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
    dispatch,
    orderedSelected
  ]);

  // Secondary effect: always recompute derived warnings from the current timeline
  // This guarantees that after any operation that changes the rendered timeline
  // (including custom task additions), the earliest starts and dateErrors are fresh.
  useEffect(() => {
    if (!Array.isArray(tasks.timeline) || tasks.timeline.length === 0) return;
    if (!assets.selected || assets.selected.length === 0) return;

    const startDates: Record<string, string> = {};
    orderedSelected.forEach((asset: any) => {
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
