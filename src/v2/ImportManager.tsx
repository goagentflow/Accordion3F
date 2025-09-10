import React, { useCallback, useRef, useState } from 'react';
import { useTimeline } from '../hooks/useTimeline';
import { TimelineActions } from '../actions/timelineActions';
import { getImportPreview, importFromExcel } from '../services/ExcelImporter';
import { useCatalog } from './CatalogContext';

const ImportManager: React.FC = () => {
  const { dispatch } = useTimeline();
  const { csvRows } = useCatalog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<{ success: boolean; taskCount?: number; exportDate?: string; version?: string; fileName: string; error?: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const triggerImport = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    try {
      const p = await getImportPreview(file);
      setPreview(p);
      setSelectedFile(file);
      setIsOpen(true);
    } finally {
      // allow re-selecting same file
      e.target.value = '';
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      const data: any = await importFromExcel(selectedFile);
      dispatch(TimelineActions.clearAll());
      dispatch(TimelineActions.importState({
        assets: {
          available: [],
          selected: (data.selectedAssets as any[]) || [],
          liveDates: (data.assetLiveDates as Record<string,string>) || {},
          taskDurations: {}
        },
        tasks: {
          all: [],
          bank: {},
          byAsset: {},
          instanceDurations: {},
          timeline: (data.tasks as any[]) || [],
          custom: (data.customTasks as any[]) || [],
          names: (data.customTaskNames as Record<string,string>) || {},
          deps: {}
        },
        dates: {
          globalLiveDate: (data.globalLiveDate as string) || '',
          useGlobalDate: (data.useGlobalDate as boolean) !== undefined ? Boolean(data.useGlobalDate) : true,
          projectStartDate: '',
          bankHolidays: [],
          calculatedStartDates: {}
        },
        ui: { freezeImportedTimeline: true } as any
      }));

      // Re-seed catalog after import so AssetSelector lists all assets
      if (Array.isArray(csvRows) && csvRows.length > 0) {
        const uniqueAssets = [...new Set(csvRows.map((r: any) => r['Asset Type']))].filter(Boolean);
        dispatch(TimelineActions.loadCsvData(csvRows as any[], uniqueAssets as any[]));
        // Rebuild unified task bank grouped by canonical CSV asset type
        const allTasks = (csvRows as any[])
          .filter(row => row['Asset Type'] && row['Task'])
          .map((row: any, idx: number) => ({
            id: `catalog-${idx}`,
            name: row['Task'],
            duration: parseInt(row['Duration (Days)'], 10) || 1,
            owner: row['owner'] || 'm',
            assetId: '',
            assetType: row['Asset Type'],
            isCustom: false
          }));
        dispatch(TimelineActions.updateTaskBank(allTasks as any));
      }
      setIsOpen(false);
      setPreview(null);
      setSelectedFile(null);
    } catch (err) {
      setPreview(prev => prev ? { ...prev, success: false, error: (err as Error).message } : prev);
    } finally {
      setIsImporting(false);
    }
  }, [dispatch, selectedFile]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    setPreview(null);
    setSelectedFile(null);
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={triggerImport}
        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        title="Import Timeline from Excel"
      >
        📥 Import
      </button>

      {isOpen && preview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <span className="text-yellow-500 mr-3 text-2xl">⚠️</span>
                <h2 className="text-xl font-bold text-gray-800">Confirm Timeline Import</h2>
              </div>
              <div className="space-y-3 mb-6 text-sm text-gray-700">
                {!preview.success && preview.error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">{preview.error}</div>
                )}
                <p>This will replace your current timeline with the imported data:</p>
                <div className="bg-gray-50 p-3 rounded">
                  <div><strong>File:</strong> {preview.fileName}</div>
                  {preview.success && (
                    <>
                      <div><strong>Tasks:</strong> {preview.taskCount}</div>
                      <div><strong>Exported:</strong> {preview.exportDate ? new Date(preview.exportDate).toLocaleDateString() : 'Unknown'}</div>
                      <div><strong>Version:</strong> {preview.version || 'Unknown'}</div>
                    </>
                  )}
                </div>
                <p className="text-red-600 font-medium">Your current work will be lost unless you export it first.</p>
              </div>
              <div className="flex space-x-3">
                <button onClick={handleCancel} className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Cancel</button>
                <button
                  onClick={handleConfirm}
                  disabled={isImporting || !preview.success}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                >
                  {isImporting ? 'Importing...' : 'Import Timeline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportManager;
