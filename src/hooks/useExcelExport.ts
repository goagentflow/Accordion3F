import { useCallback } from 'react';
import { useTimeline } from './useTimeline';
import { useAssets, useDates, useTasks } from './useTimelineSelectors';
import { exportToExcel } from '../services/ExcelExporter';

/**
 * useExcelExport
 * Shared export handler using current timeline state.
 * Ensures all export buttons use identical logic and payload.
 */
export const useExcelExport = () => {
  const { state } = useTimeline();
  const { tasks } = useTasks();
  const { assets } = useAssets();
  const { dates } = useDates();

  const exportTimeline = useCallback(async () => {
    const timeline = tasks.timeline || [];
    if (timeline.length === 0) return;
    const allDates = timeline.flatMap(t => [new Date(t.start), new Date(t.end)]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    // Build date columns
    const dayMs = 24 * 60 * 60 * 1000;
    const cols: Date[] = [];
    for (let t = new Date(minDate.getTime()); t.getTime() <= maxDate.getTime(); t = new Date(t.getTime() + dayMs)) {
      cols.push(new Date(t));
    }

    await exportToExcel(
      timeline,
      cols,
      dates.bankHolidays || [],
      minDate,
      maxDate,
      {
        selectedAssets: assets.selected,
        globalLiveDate: dates.globalLiveDate,
        assetLiveDates: assets.liveDates,
        useGlobalDate: dates.useGlobalDate,
        customTasks: state.tasks.custom,
        assetTaskDurations: assets.taskDurations,
        customTaskNames: state.tasks.names
      }
    );
  }, [tasks.timeline, dates.bankHolidays, dates.globalLiveDate, dates.useGlobalDate, assets.selected, assets.liveDates, assets.taskDurations, state.tasks.custom, state.tasks.names]);

  return { exportTimeline };
};

export default useExcelExport;

