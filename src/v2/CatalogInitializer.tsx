import { useEffect } from 'react';
import Papa from 'papaparse';
import { useTimeline } from '../hooks/useTimeline';
import { TimelineActions } from '../actions/timelineActions';
import { useCatalog } from './CatalogContext';

// Lightweight CSV catalog initializer for V2 parity
// Loads the local CSV and seeds available assets/task bank like V1
export const CatalogInitializer: React.FC = () => {
  const { dispatch } = useTimeline();
  const { setCsvRows } = useCatalog();

  useEffect(() => {
    Papa.parse(`${window.location.origin}/Group_Asset_Task_Time.csv`, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data as any[];
        setCsvRows(parsedData);
        const assetTypes = [...new Set(parsedData.map(row => row['Asset Type']))].filter(Boolean);
        dispatch(TimelineActions.loadCsvData(parsedData, assetTypes));
        // Build a unified task bank grouped by canonical CSV asset type
        const allTasks = parsedData
          .filter(row => row['Asset Type'] && row['Task'])
          .map((row: any, idx: number) => ({
            id: `catalog-${idx}`,
            name: row['Task'],
            duration: parseInt(row['Duration (Days)'], 10) || 1,
            owner: row['owner'] || 'm',
            assetId: '', // assigned per selected asset during orchestration
            assetType: row['Asset Type'], // canonical type key
            isCustom: false
          }));
        dispatch(TimelineActions.updateTaskBank(allTasks as any));
      },
      error: () => {
        // Fail silently; UI remains usable and can import from Excel
      }
    });
    // Only on mount
  }, [dispatch]);

  return null;
};

export default CatalogInitializer;
