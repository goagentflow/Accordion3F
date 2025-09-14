import React from 'react';
import { TimelineProvider, useTimeline } from '../hooks/useTimeline';
import { useAssets, useDates, useUI, useTasks, useAssetConflicts } from '../hooks/useTimelineSelectors';
import { TimelineActions } from '../actions/timelineActions';

// Reuse existing, battle-tested UI components from V1 for parity
import AssetSelector from '../components/AssetSelector';
import CampaignSetup from '../components/CampaignSetup';
import GanttChart from '../components/GanttChart';
import { isSundayOnlyAsset } from '../components/ganttUtils';
import { calculateWorkingDaysNeeded } from '../services/TimelineCalculator';
import CatalogInitializer from './CatalogInitializer';
import BankHolidays from './BankHolidays';
import Orchestrator from './Orchestrator';
import { CatalogProvider, useCatalog } from './CatalogContext';
import { calculateWorkingDaysBetween } from '../utils/dateHelpers';
import GettingStarted from './GettingStarted';
import useExcelExport from '../hooks/useExcelExport';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import ImportManager from './ImportManager';

/**
 * LeftColumn – Parity controls using existing components
 */
const LeftColumn: React.FC = () => {
  const { dispatch } = useTimeline();
  const { assets, addAsset, removeAsset, renameAsset, setAssetStartDate } = useAssets();
  const { dates, setGlobalLiveDate, toggleUseGlobalDate } = useDates();
  const { ui, setClientCampaignName } = useUI() as any;
  const { csvRows } = useCatalog();

  const workingDaysNeeded = calculateWorkingDaysNeeded(
    assets.selected,
    dates.calculatedStartDates || {},
    ui.dateErrors || [],
    dates.bankHolidays || []
  );

  // (moved Sunday-only violations to RightColumn where they are displayed)

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg space-y-5" data-testid="v2-left-column">
      {/* Campaign Setup */}
      <CampaignSetup
        {...{
          clientCampaignName: ui.clientCampaignName || '',
          onClientCampaignNameChange: setClientCampaignName,
          globalLiveDate: dates.globalLiveDate,
          onGlobalLiveDateChange: setGlobalLiveDate,
          useGlobalDate: dates.useGlobalDate,
          onUseGlobalDateChange: (checked: boolean) => {
            if (checked !== dates.useGlobalDate) toggleUseGlobalDate();
          },
          projectStartDate: dates.projectStartDate,
          dateErrors: ui.dateErrors,
          workingDaysNeeded
        } as any}
      />

      {/* Asset Selection */}
      <AssetSelector
        {...{
          assets: assets.available,
          selectedAssets: assets.selected,
          onAddAsset: addAsset,
          onRemoveAsset: removeAsset,
          useGlobalDate: dates.useGlobalDate,
          globalLiveDate: dates.globalLiveDate,
          assetLiveDates: assets.liveDates,
          onAssetLiveDateChange: (assetName: string, date: string) =>
            dispatch(TimelineActions.setAssetLiveDate(assetName, date)),
          calculatedStartDates: dates.calculatedStartDates || {},
          dateErrors: ui.dateErrors,
          sundayDateErrors: (assets.selected || []).filter(a => {
            const live = dates.useGlobalDate ? dates.globalLiveDate : a.startDate;
            if (!live) return false;
            return isSundayOnlyAsset(a.type) && new Date(live).getDay() !== 0;
          }).map(a => a.id),
          onRenameAsset: renameAsset,
          onAssetStartDateChange: setAssetStartDate,
          csvData: csvRows,
          onSaveTaskDurations: (assetId: string, durations: Record<string, number>) => {
            const asset = assets.selected.find(a => a.id === assetId);
            if (!asset) return;
            Object.entries(durations).forEach(([taskName, duration]) => {
              dispatch(TimelineActions.updateTaskDuration('', asset.type, taskName, Number(duration)));
            });
          },
          isNonWorkingDay: (date: Date) => {
            const day = date.getDay();
            const dateStr = date.toISOString().split('T')[0];
            const isWeekend = day === 0 || day === 6;
            const isHoliday = dates.bankHolidays.includes(dateStr);
            return isWeekend || isHoliday;
          },
          calculateWorkingDaysBetween: (start: string, end: string) => {
            // Use bank-holiday aware utility via service
            const s = new Date(start);
            const e = new Date(end);
            // reuse imported calculateWorkingDaysNeeded utilities indirectly — keep consistent signature
            if (!start || !end) return 0;
            // Simple reuse of dateHelpers behavior is outside this file; for now mirror V1 TS behavior here
            let wd = 0;
            const cur = new Date(s);
            while (cur < e) {
              const dow = cur.getDay();
              const iso = cur.toISOString().split('T')[0];
              if (dow !== 0 && dow !== 6 && !(dates.bankHolidays || []).includes(iso)) wd++;
              cur.setDate(cur.getDate() + 1);
            }
            return wd;
          }
        } as any}
      />

      {/* No actions here to match V1 placement (header) */}
    </div>
  );
};

/**
 * RightColumn – Timeline/Gantt using existing component
 */
const RightColumn: React.FC = () => {
  const { tasks } = useTasks();
  const { assets } = useAssets();
  const { dates } = useDates();
  const { ui } = useUI();
  const { dispatch } = useTimeline();
  const { exportTimeline } = useExcelExport();
  const assetConflicts = useAssetConflicts();

  const workingDaysNeeded = calculateWorkingDaysNeeded(
    assets.selected,
    dates.calculatedStartDates || {},
    ui.dateErrors || [],
    dates.bankHolidays || []
  );

  // Base warning on refresh/close when there is unsaved work
  const hasWork = (
    (assets.selected && assets.selected.length > 0) ||
    (tasks.timeline && tasks.timeline.length > 0) ||
    (tasks.custom && tasks.custom.length > 0) ||
    (tasks.names && Object.keys(tasks.names).length > 0) ||
    (tasks.instanceDurations && Object.keys(tasks.instanceDurations).length > 0) ||
    (tasks.deps && Object.keys(tasks.deps as any).length > 0)
  );
  useBeforeUnload(
    !!hasWork,
    'If you close the browser or if you refresh the browser, you will lose your work.'
  );

  // Sunday-only violations for right-panel conflicts
  const sundayViolations = (assets.selected || []).filter((a: any) => {
    const live = dates.useGlobalDate ? dates.globalLiveDate : a.startDate;
    if (!live) return false;
    return isSundayOnlyAsset(a.type) && new Date(live).getDay() !== 0;
  });

  const onTaskDurationChange = (taskId: string, duration: number, a?: any, b?: any) => {
    // Normalize inputs from both sources (row editor vs drag handler)
    let assetType = typeof a === 'string' ? a : undefined;
    let taskName = typeof b === 'string' ? b : undefined;
    if (!assetType || !taskName) {
      const t = (tasks.timeline || []).find((x: any) => x.id === taskId);
      if (t) {
        assetType = t.assetType;
        taskName = t.name;
      }
    }
    if (!assetType || !taskName) return;
    dispatch(TimelineActions.updateTaskDuration(taskId, assetType, taskName, Number(duration)));
  };

  const onTaskNameChange = (taskId: string, newName: string) => {
    dispatch(TimelineActions.renameTask(taskId, newName));
  };

  const onTaskMove = (taskId: string, newStartISO: string) => {
    const task = (tasks.timeline || []).find((t: any) => t.id === taskId);
    if (!task) return;

    const newStart = new Date(newStartISO);

    // Prevent dragging to a non-working day
    const dayOfWeek = newStart.getDay();
    const isHoliday = (dates.bankHolidays || []).includes(newStart.toISOString().split('T')[0]);
    if (dayOfWeek === 0 || dayOfWeek === 6 || isHoliday) {
      // This is a simplification; a real implementation should snap to the next working day.
      // For now, we prevent the move to avoid invalid states.
      console.warn('Cannot drag task to a non-working day. Move cancelled.');
      return; 
    }

    // Check for overlaps with other tasks in the same asset
    const overlappedTask = (tasks.timeline || []).find((t: any) => {
      if (t.id === taskId || t.assetId !== task.assetId) return false;
      const tStart = new Date(t.start);
      const tEnd = new Date(t.end);
      return newStart >= tStart && newStart <= tEnd;
    });

    const existingDeps = ((tasks.deps as any) || {})[taskId] || [];

    if (overlappedTask) {
      // CASE 1: DRAG CREATES AN OVERLAP - MANAGE DEPENDENCY
      const predecessor = overlappedTask;
      const predecessorEnd = new Date(predecessor.end);

      // Correctly calculate overlap days, making it inclusive
      const overlapDays = calculateWorkingDaysBetween(newStart, predecessorEnd, dates.bankHolidays) + 1;

      // If other dependencies exist, remove them. A task can only follow one predecessor via drag-drop.
      existingDeps.forEach((dep: any) => {
        if (dep.predecessorId !== predecessor.id) {
          dispatch(TimelineActions.removeDependency(taskId, dep.predecessorId));
        }
      });

      // Check if a dependency already exists with the overlapped task
      const hasDep = existingDeps.some((d: any) => d.predecessorId === predecessor.id);
      if (hasDep) {
        dispatch(TimelineActions.updateDependency(predecessor.id, taskId, overlapDays));
      } else {
        dispatch(TimelineActions.addDependency(predecessor.id, taskId, overlapDays));
      }

    } else {
      // CASE 2: DRAG TO EMPTY SPACE - MOVE TASK AND CLEAR DEPENDENCIES
      
      // If dependencies exist, remove them, as the task is now independent.
      if (existingDeps.length > 0) {
        existingDeps.forEach((dep: any) => {
          dispatch(TimelineActions.removeDependency(taskId, dep.predecessorId));
        });
      }

      // Dispatch the new action to simply move the task
      dispatch(TimelineActions.moveTask(taskId, newStartISO));
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg" data-testid="v2-right-column">
      {/* Conflicts banner parity with V1 */}
      {(ui.dateErrors && ui.dateErrors.length > 0) || sundayViolations.length > 0 ? (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-red-800 font-medium mb-2">⚠️ Timeline Conflicts</h3>
          <p className="text-red-700 text-sm mb-2">The following assets need attention:</p>
          <ul className="text-red-700 text-sm">
            {(() => {
              const conflictIds = new Set<string>(ui.dateErrors || []);
              const sundayIds = new Set<string>(sundayViolations.map((a: any) => a.id));
              const unionIds = new Set<string>([...Array.from(conflictIds), ...Array.from(sundayIds)]);
              const items = Array.from(unionIds).map((id: string) => {
                const asset = (assets.selected || []).find(a => a.id === id);
                const hasDateConflict = conflictIds.has(id);
                const requiresSunday = sundayIds.has(id);
                const calcStart = dates.calculatedStartDates?.[id];

                if (!asset) return null;

                let message = '';
                if (requiresSunday && hasDateConflict) {
                  message = `${asset.name} — This asset requires a Sunday live date—change the live date so it falls on a Sunday AND it cannot be completed by its current live date${calcStart ? ` (would need to start on ${calcStart})` : ''}.`;
                } else if (requiresSunday) {
                  message = `${asset.name} — This asset requires a Sunday live date—change the live date so it falls on a Sunday.`;
                } else if (hasDateConflict) {
                  message = `${asset.name || 'Unknown Asset'} (would need to start on ${calcStart || 'TBD'})`;
                }
                return (
                  <li key={`conflict-${id}`} className="ml-4">• {message}</li>
                );
              }).filter(Boolean);
              return items as any;
            })()}
          </ul>
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
            onAddCustomTask: ({ name, duration, owner, assetType, insertAfterTaskId }: any) => {
              dispatch(TimelineActions.addCustomTask(name, Number(duration), owner, assetType, insertAfterTaskId));
            }
          } as any}
        />
      ) : (
        <div className="text-center text-gray-500 py-10">
          <p className="text-lg">Your timeline will appear here.</p>
          <p className="text-sm">Set a live date and select some assets to begin.</p>
        </div>
      )}
    </div>
  );
};

// Header actions placed inside provider to safely access context
const HeaderActions: React.FC = () => {
  const { undo, redo, canUndo, canRedo } = useTimeline();
  const { state } = useTimeline();
  const { exportTimeline } = useExcelExport();

  const handleExport = async () => {
    await exportTimeline();
  };

  return (
    <div className="flex gap-2">
      <ImportManager />
      <button
        onClick={handleExport}
        disabled={!state.tasks?.timeline || state.tasks.timeline.length === 0 || !(state.ui?.clientCampaignName && state.ui.clientCampaignName.trim())}
        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
        title="Export Timeline to Excel"
      >
        📊 Export
      </button>
      <button
        onClick={undo}
        disabled={!canUndo}
        className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Undo (Ctrl+Z)"
      >
        ↩️ Undo
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Redo (Ctrl+Y)"
      >
        ↪️ Redo
      </button>
    </div>
  );
};

/**
 * TimelineBuilderV2 – Parity-first shell behind a feature flag
 */
export const TimelineBuilderV2: React.FC = () => {
  return (
    <TimelineProvider>
      <CatalogProvider>
        <div className="bg-gray-100 min-h-screen">
          <header className="bg-white shadow-md">
            <div className="container mx-auto px-6 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-800">Accordion Timeline Builder</h1>
              <HeaderActions />
            </div>
          </header>
          <main className="container mx-auto p-6">
            <CatalogInitializer />
            <BankHolidays />
            <Orchestrator />
            <GettingStarted />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1"><LeftColumn /></div>
              <div className="lg:col-span-2"><RightColumn /></div>
            </div>
          </main>
        </div>
      </CatalogProvider>
    </TimelineProvider>
  );
};

export default TimelineBuilderV2;
