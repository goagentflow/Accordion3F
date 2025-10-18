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
    const parseCSV = (url: string) =>
      new Promise<any[]>((resolve, reject) => {
        Papa.parse(url, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (Array.isArray(results?.data)) resolve(results.data as any[]);
            else reject(new Error('CSV parsed but returned no data array'));
          },
          error: reject
        });
      });

    const loadCSV = async () => {
      // Single-source of truth: only load the new CSV asset
      const candidates = [
        process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/Group_Asset_Task_Timev.2 Inc You_Weekend.csv` : null,
        '/Group_Asset_Task_Timev.2 Inc You_Weekend.csv',
        `${window.location.origin}/Group_Asset_Task_Timev.2 Inc You_Weekend.csv`
      ].filter(Boolean) as string[];

      for (const url of candidates) {
        try {
          const parsedData = await parseCSV(url);
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
          return; // success
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.log(`[CatalogInitializer] CSV load failed for ${url}, trying next...`);
          }
        }
      }
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[CatalogInitializer] All CSV load attempts failed');
      }
    };

    loadCSV();
    // Only on mount
  }, [dispatch, setCsvRows]);

  return null;
};

export default CatalogInitializer;
