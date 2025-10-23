import React, { useState } from 'react';
import { useTasks, useAssets, useDates, useUI, useAssetConflicts } from '../hooks/useTimelineSelectors';
import { useTimeline } from '../hooks/useTimeline';
import { TimelineActions } from '../actions/timelineActions';
import useExcelExport from '../hooks/useExcelExport';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import { calculateWorkingDaysNeeded } from '../services/TimelineCalculator';
import { isSundayOnlyAsset, isSaturdayOnlyAsset } from '../components/ganttUtils';
import GanttChart from '../components/GanttChart';
import SameDayChooser from '../components/SameDayChooser';
import WeekendSnapModal from '../components/WeekendSnapModal';
import { safeToISOString, getPreviousWorkingDay } from '../utils/dateHelpers';
import { enableDependencyUI, autoApplySameDay } from '../config/features';

const RightColumn: React.FC = () => {
  const { tasks } = useTasks();
  const { assets } = useAssets();
  const { dates } = useDates();
  const { ui } = useUI();
  const { dispatch, undo } = useTimeline();
  const { exportTimeline } = useExcelExport();
  const assetConflicts = useAssetConflicts();
  const [conflictsCollapsed, setConflictsCollapsed] = useState(false);

  const workingDaysNeeded = calculateWorkingDaysNeeded(
    assets.selected,
    dates.calculatedStartDates || {},
    ui.dateErrors || [],
    dates.bankHolidays || []
  );

  const hasWork = (
    (assets.selected && assets.selected.length > 0) ||
    (tasks.timeline && tasks.timeline.length > 0) ||
    (tasks.custom && tasks.custom.length > 0) ||
    (tasks.names && Object.keys(tasks.names).length > 0) ||
    (tasks.instanceDurations && Object.keys(tasks.instanceDurations).length > 0) ||
    (tasks.deps && Object.keys(tasks.deps as any).length > 0)
  );
  useBeforeUnload(!!hasWork, 'If you close the browser or if you refresh the browser, you will lose your work.');

  const sundayViolations = (assets.selected || []).filter((a: any) => {
    const live = dates.useGlobalDate ? dates.globalLiveDate : a.startDate;
    if (!live) return false;
    const dayOfWeek = new Date(live).getDay();
    return (isSundayOnlyAsset(a.type) && dayOfWeek !== 0) ||
           (isSaturdayOnlyAsset(a.type) && dayOfWeek !== 6);
  });

  const onTaskDurationChange = (taskId: string, duration: number, a?: any, b?: any) => {
    let assetType = typeof a === 'string' ? a : undefined;
    let taskName = typeof b === 'string' ? b : undefined;
    if (!assetType || !taskName) {
      const t = (tasks.timeline || []).find((x: any) => x.id === taskId);
      if (t) { assetType = t.assetType; taskName = t.name; }
    }
    if (!assetType || !taskName) return;
    dispatch(TimelineActions.updateTaskDuration(taskId, assetType, taskName, Number(duration)));
  };

  const onTaskNameChange = (taskId: string, newName: string) => {
    dispatch(TimelineActions.renameTask(taskId, newName));
  };

  const [chooser, setChooser] = useState<{ open: boolean; predecessorId: string; successorId: string; suggested: 'SS'|'FF'; } | null>(null);
  const [snap, setSnap] = useState<{ open: boolean; taskId: string; proposed: Date; snapped: Date; } | null>(null);

  const commitMoveOrLink = (taskId: string, startDate: Date) => {
    const task = (tasks.timeline || []).find((t: any) => t.id === taskId);
    if (!task) return;
    const newStart = new Date(startDate);
    const overlappedTask = (tasks.timeline || []).find((t: any) => {
      if (t.id === taskId || t.assetId !== task.assetId) return false;
      const tStart = new Date(t.start);
      const tEnd = new Date(t.end);
      return newStart >= tStart && newStart <= tEnd;
    });
    const existingDeps = ((tasks.deps as any) || {})[taskId] || [];
    if (overlappedTask && enableDependencyUI()) {
      const target = overlappedTask;
      const targetStart = new Date(target.start);
      const isTargetLater = targetStart >= newStart; // dropping onto later bar → FF, earlier → SS
      const suggested: 'SS' | 'FF' = isTargetLater ? 'FF' : 'SS';
      const predecessorId = isTargetLater ? taskId : target.id;
      const successorId = isTargetLater ? target.id : taskId;

      // Auto-apply path (no chooser) to avoid bounce
      if (autoApplySameDay()) {
        // Remove conflicting inbound deps to successor
        const inboundSucc = ((tasks.deps as any) || {})[successorId] || [];
        inboundSucc.forEach((d: any) => { if (d.predecessorId !== predecessorId) dispatch(TimelineActions.removeDependency(successorId, d.predecessorId)); });
        // Remove reverse edge if present
        const inboundPred = ((tasks.deps as any) || {})[predecessorId] || [];
        inboundPred.forEach((d: any) => { if (d.predecessorId === successorId) dispatch(TimelineActions.removeDependency(predecessorId, successorId)); });
        // Add typed dependency with zero lag
        dispatch(TimelineActions.addTypedDependency(predecessorId, successorId, suggested, 0));
        return;
      }

      // Chooser path
      setChooser({ open: true, predecessorId, successorId, suggested });
      return;
    } else if (overlappedTask) {
      const predecessor = overlappedTask;
      const predecessorEnd = new Date(predecessor.end);
      const { computeOverlapDays } = require('../utils/overlap');
      const overlapDays = computeOverlapDays(newStart, predecessorEnd, dates.bankHolidays);
      existingDeps.forEach((dep: any) => { if (dep.predecessorId !== predecessor.id) dispatch(TimelineActions.removeDependency(taskId, dep.predecessorId)); });
      const hasDep = existingDeps.some((d: any) => d.predecessorId === predecessor.id);
      if (hasDep) dispatch(TimelineActions.updateDependency(predecessor.id, taskId, overlapDays));
      else dispatch(TimelineActions.addDependency(predecessor.id, taskId, overlapDays));
    } else {
      if (existingDeps.length > 0) existingDeps.forEach((dep: any) => dispatch(TimelineActions.removeDependency(taskId, dep.predecessorId)));
      dispatch(TimelineActions.moveTask(taskId, safeToISOString(newStart)));
    }
  };

  const onTaskMove = (taskId: string, newStartISO: string) => {
    const task = (tasks.timeline || []).find((t: any) => t.id === taskId);
    if (!task) return;
    const newStart = new Date(newStartISO);
    const dayOfWeek = newStart.getDay();
    const isHoliday = (dates.bankHolidays || []).includes(safeToISOString(newStart));
    const isLive = task.owner === 'l';
    if ((dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) && !isLive) {
      const prev = getPreviousWorkingDay(newStart, dates.bankHolidays || []);
      setSnap({ open: true, taskId, proposed: newStart, snapped: prev });
      return;
    }
    commitMoveOrLink(taskId, newStart);
  };

  const confirmSameDayLink = (depType: 'SS' | 'FF') => {
    if (!chooser) return;
    let { predecessorId, successorId } = chooser;

    // Defensive orientation: ensure predecessor is the earlier task by start date
    const predTask = (tasks.timeline || []).find((t: any) => t.id === predecessorId);
    const succTask = (tasks.timeline || []).find((t: any) => t.id === successorId);
    if (predTask && succTask) {
      const predStart = new Date(predTask.start).getTime();
      const succStart = new Date(succTask.start).getTime();
      if (predStart > succStart) {
        // Swap to enforce earlier → later
        const tmp = predecessorId;
        predecessorId = successorId;
        successorId = tmp;
      }
    }

    // Remove conflicting inbound deps to successor (keep one predecessor)
    const inboundSucc = ((tasks.deps as any) || {})[successorId] || [];
    inboundSucc.forEach((d: any) => {
      if (d.predecessorId !== predecessorId) {
        dispatch(TimelineActions.removeDependency(successorId, d.predecessorId));
      }
    });
    // Also remove any reverse edge successor → predecessor if present to avoid cycles
    const inboundPred = ((tasks.deps as any) || {})[predecessorId] || [];
    inboundPred.forEach((d: any) => {
      if (d.predecessorId === successorId) {
        dispatch(TimelineActions.removeDependency(predecessorId, successorId));
      }
    });

    dispatch(TimelineActions.addTypedDependency(predecessorId, successorId, depType, 0));
    setChooser(null);
  };
  const cancelSameDayLink = () => setChooser(null);

  // Toast state (simple, local)
  const [toast, setToast] = useState<{ type: 'success'|'warning'|'error'; message: string } | null>(null);
  const showToast = (type: 'success'|'warning'|'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg" data-testid="v2-right-column">
      {/* Toast (simple) */}
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg shadow-lg border bg-white flex items-center gap-3"
          data-testid={`toast-${toast.type}`}
        >
          <span className={toast.type === 'success' ? 'text-green-600' : toast.type === 'error' ? 'text-red-600' : 'text-yellow-600'}>
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠' : 'ℹ'}
          </span>
          <span className="text-sm text-gray-800">{toast.message} <button className="underline ml-2" onClick={() => undo()}>Undo</button></span>
        </div>
      )}
      {ui && (ui as any).calcWarning && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center justify-between mb-1"><h3 className="text-yellow-800 font-semibold">Scheduling Notice</h3></div>
          <p className="text-yellow-900 text-sm">{(ui as any).calcWarning}</p>
        </div>
      )}

      {(ui.dateErrors && ui.dateErrors.length > 0) || sundayViolations.length > 0 ? (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-red-800 font-semibold">⚠️ Timeline Conflicts</h3>
            <button onClick={() => setConflictsCollapsed(v => !v)} className="text-red-700 hover:text-red-900 text-sm" aria-expanded={!conflictsCollapsed} aria-controls="timeline-conflicts-body">{conflictsCollapsed ? 'Show details ▾' : 'Hide details ▴'}</button>
          </div>
          {!conflictsCollapsed && (
            <div id="timeline-conflicts-body" className="text-sm text-red-800">
              <ul className="list-none space-y-2">
                {(assets.selected || []).map((asset: any) => {
                  const assetId = asset.id;
                  const assetName = asset.name || 'Unknown Asset';
                  const hasDateConflict = (ui.dateErrors || []).includes(assetId);
                  // Day-of-week requirements
                  const live = dates.useGlobalDate ? dates.globalLiveDate : asset.startDate;
                  const dayOfWeek = live ? new Date(live).getDay() : -1;
                  const requiresSunday = isSundayOnlyAsset(asset.type);
                  const requiresSaturday = isSaturdayOnlyAsset(asset.type);
                  const hasDayViolation = (requiresSunday && dayOfWeek !== 0) || (requiresSaturday && dayOfWeek !== 6);

                  if (!hasDateConflict && !hasDayViolation) return null;

                  // Lookup computed metrics for this asset
                  const conflict = (assetConflicts || []).find(a => a.assetId === assetId);
                  const totalDuration = conflict?.totalDuration;
                  const daysNeeded = conflict?.daysNeeded;

                  const handleFocus = () => {
                    const target = document.querySelector(`[data-asset-id="${assetId}"]`) as HTMLElement | null;
                    if (!target) return;
                    const getScrollable = (node: HTMLElement | null): HTMLElement | Window => {
                      let el: HTMLElement | null = node;
                      while (el && el.parentElement) {
                        el = el.parentElement as HTMLElement;
                        const style = el && window.getComputedStyle(el);
                        if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll')) return el;
                      }
                      return window;
                    };
                    const scroller = getScrollable(target);
                    const OFFSET = 140;
                    if (scroller === window) {
                      const rect = target.getBoundingClientRect();
                      const y = rect.top + window.pageYOffset;
                      window.scrollTo({ top: Math.max(0, y - OFFSET), behavior: 'smooth' });
                    } else {
                      const container = scroller as HTMLElement;
                      const containerRect = container.getBoundingClientRect();
                      const targetRect = target.getBoundingClientRect();
                      const delta = (targetRect.top - containerRect.top) - OFFSET;
                      container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' });
                    }
                    try {
                      target.classList.add('ring-2', 'ring-yellow-400');
                      setTimeout(() => target.classList.remove('ring-2', 'ring-yellow-400'), 1200);
                    } catch {}
                  };

                  return (
                    <li key={`conflict-${assetId}`} className="ml-1 p-2 bg-white border border-red-100 rounded">
                      <div className="text-sm">
                        • <button onClick={handleFocus} className="underline text-red-800 hover:text-red-900 font-medium">
                          {assetName}
                        </button>
                      </div>
                      {requiresSunday && !hasDateConflict ? (
                        <div className="text-xs text-red-700 mt-1">
                          This asset requires a Sunday live date — change the live date so it falls on a Sunday.
                        </div>
                      ) : null}
                      {requiresSaturday && !hasDateConflict ? (
                        <div className="text-xs text-red-700 mt-1">
                          This asset requires a Saturday live date — change the live date so it falls on a Saturday.
                        </div>
                      ) : null}
                      {hasDateConflict ? (
                        <div className="text-xs text-red-700 mt-1">
                          <span className="mr-4">
                            <span className="font-semibold">Total duration:</span> {typeof totalDuration === 'number' ? `${totalDuration} day${totalDuration === 1 ? '' : 's'}` : '—'}
                          </span>
                          <span>
                            <span className="font-semibold">Working days needed:</span> {typeof daysNeeded === 'number' ? daysNeeded : '—'}
                          </span>
                        </div>
                      ) : null}
                    </li>
                  );
                }).filter(Boolean)}
              </ul>
              <p className="text-red-700 text-sm mt-2 font-medium">Adjust task durations in the Gantt chart or change the go‑live date.</p>
            </div>
          )}
        </div>
      ) : null}

      {tasks.timeline && tasks.timeline.length > 0 ? (
        <GanttChart
          {...{
            tasks: tasks.timeline,
            bankHolidays: dates.bankHolidays,
            selectedAssets: assets.selected,
            workingDaysNeeded,
            assetAlerts: assetConflicts,
            onTaskDurationChange,
            onTaskNameChange,
            onTaskMove,
            onExportExcel: exportTimeline,
            onDeleteTask: (taskId: string, assetId: string) => {
              dispatch(TimelineActions.removeTask(taskId, assetId));
              showToast('success', 'Task deleted.');
            },
            onRemoveSameDayLink: (successorId: string, predecessorId: string) => {
              dispatch(TimelineActions.removeDependency(successorId, predecessorId));
              showToast('success', 'Removed same‑day link.');
            },
            resolveTaskLabel: (id: string) => {
              const t = (tasks.timeline || []).find((x: any) => x.id === id);
              if (!t) return `Task ${id}`;
              const display = (tasks.names && (tasks.names as any)[id]) ? (tasks.names as any)[id] : (t.name || 'Task');
              if ((assets.selected || []).length > 1) {
                const asset = (assets.selected || []).find((a: any) => a.id === t.assetId);
                const prefix = asset?.name || t.assetType || '';
                return prefix ? `${prefix}: ${display}` : display;
              }
              return display;
            },
            onViewTask: (id: string) => {
              const el = document.querySelector(`[data-task-id="${id}"]`) as HTMLElement | null;
              const getScrollable = (node: HTMLElement | null): HTMLElement | Window => {
                let cur: HTMLElement | null = node;
                while (cur && cur.parentElement) {
                  cur = cur.parentElement as HTMLElement;
                  const style = cur && window.getComputedStyle(cur);
                  if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll')) return cur;
                }
                return window;
              };
              if (el) {
                const scroller = getScrollable(el);
                const OFFSET = 120;
                if (scroller === window) {
                  const rect = el.getBoundingClientRect();
                  const y = rect.top + window.pageYOffset;
                  window.scrollTo({ top: Math.max(0, y - OFFSET), behavior: 'smooth' });
                } else {
                  const container = scroller as HTMLElement;
                  const containerRect = container.getBoundingClientRect();
                  const targetRect = el.getBoundingClientRect();
                  const delta = (targetRect.top - containerRect.top) - OFFSET;
                  container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' });
                }
                try {
                  el.classList.add('ring-2', 'ring-yellow-400');
                  setTimeout(() => el.classList.remove('ring-2', 'ring-yellow-400'), 1200);
                } catch {}
              }
            },
            onAddCustomTask: ({ name, duration, owner, assetType, insertAfterTaskId }: any) => dispatch(TimelineActions.addCustomTask(name, Number(duration), owner, assetType, insertAfterTaskId))
          } as any}
        />
      ) : (
        <div className="text-center text-gray-500 py-10">
          <p className="text-lg">Your timeline will appear here.</p>
          <p className="text-sm">Set a live date and select some assets to begin.</p>
        </div>
      )}

      <SameDayChooser
        open={!!chooser?.open}
        suggested={chooser?.suggested || 'FF'}
        predecessorName={(tasks.timeline || []).find((t: any) => t.id === chooser?.predecessorId)?.name}
        successorName={(tasks.timeline || []).find((t: any) => t.id === chooser?.successorId)?.name}
        onConfirm={confirmSameDayLink}
        onCancel={cancelSameDayLink}
      />

      <WeekendSnapModal
        open={!!snap?.open}
        targetLabel={(tasks.timeline || []).find((t: any) => t.id === snap?.taskId)?.name || 'task'}
        suggestedDateLabel={snap ? new Date(snap.snapped).toLocaleDateString() : ''}
        onConfirm={() => { if (!snap) return; const { taskId, snapped } = snap; setSnap(null); commitMoveOrLink(taskId, snapped); }}
        onCancel={() => setSnap(null)}
      />
    </div>
  );
};

export default RightColumn;
