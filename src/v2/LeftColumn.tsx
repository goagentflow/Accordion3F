import React from 'react';
import { useTimeline } from '../hooks/useTimeline';
import { useAssets, useDates, useUI } from '../hooks/useTimelineSelectors';
import { TimelineActions } from '../actions/timelineActions';
import CampaignSetup from '../components/CampaignSetup';
import AssetSelector from '../components/AssetSelector';
import { calculateWorkingDaysNeeded } from '../services/TimelineCalculator';
import { isSundayOnlyAsset, isSaturdayOnlyAsset } from '../components/ganttUtils';
import { useCatalog } from './CatalogContext';
import { safeToISOString } from '../utils/dateHelpers';

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

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg space-y-5" data-testid="v2-left-column">
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
            const dayOfWeek = new Date(live).getDay();
            return (isSundayOnlyAsset(a.type) && dayOfWeek !== 0) ||
                   (isSaturdayOnlyAsset(a.type) && dayOfWeek !== 6);
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
            const dateStr = safeToISOString(date);
            const isWeekend = day === 0 || day === 6;
            const isHoliday = dates.bankHolidays.includes(dateStr);
            return isWeekend || isHoliday;
          },
          calculateWorkingDaysBetween: (start: string, end: string) => {
            if (!start || !end) return 0;
            const s = new Date(start);
            const e = new Date(end);
            let wd = 0;
            const cur = new Date(s);
            while (cur < e) {
              const dow = cur.getDay();
              const iso = safeToISOString(cur);
              if (dow !== 0 && dow !== 6 && !(dates.bankHolidays || []).includes(iso)) wd++;
              cur.setDate(cur.getDate() + 1);
            }
            return wd;
          }
        } as any}
      />
    </div>
  );
};

export default LeftColumn;

