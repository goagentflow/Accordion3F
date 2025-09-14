/**
 * TimelineBuilder Component - Main orchestrator
 * Refactored to use the new state management architecture
 * Clean separation of concerns with hooks and services
 */

import React, { useEffect, useState, useRef } from 'react';
import Papa from 'papaparse';

// Components
import AssetSelector from './components/AssetSelector';
import CampaignSetup from './components/CampaignSetup';
import GanttChart from './components/GanttChart';
// Removed analytics/optimization components to simplify UI

// Hooks
import { useTimeline, TimelineActions } from './hooks/useTimeline';
import { useAssets, useTasks, useDates, useUI } from './hooks/useTimelineSelectors';

// Services
import {
  buildAssetTimeline,
  createTasksFromCsv,
  calculateWorkingDaysNeeded,
  getEarliestStartDate
} from './services/TimelineCalculator';
import { exportToExcel } from './services/ExcelExporter';
import { importFromExcel, validateExcelFile, getImportPreview } from './services/ExcelImporter';

// Types
import { 
  CsvRow,
  TimelineTask
} from './types/timeline.types';

const TimelineBuilder: React.FC = () => {
  // ============================================
  // State Management via Hooks
  // ============================================
  
  const { dispatch, undo, redo, canUndo, canRedo, isHydrating } = useTimeline();
  const { assets, addAsset, removeAsset, renameAsset, setAssetStartDate } = useAssets();
  const { tasks, addCustomTask, updateTaskDuration, renameTask } = useTasks();
  const { dates, setGlobalLiveDate, toggleUseGlobalDate } = useDates();
  const { ui, setClientCampaignName } = useUI();

  // Local UI state (not part of global state)
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  // UI: collapsible left column
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  
  // Excel import/export state
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analytics/optimization state variables removed to simplify UI

  // ============================================
  // Load CSV Data on Mount
  // ============================================
  
  useEffect(() => {
    Papa.parse(`${window.location.origin}/Group_Asset_Task_Time.csv`, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data as CsvRow[];
        setCsvData(parsedData);
        
        // Extract unique asset types from CSV
        const assetTypes = [...new Set(parsedData.map(row => row['Asset Type']))].filter(type => type);
        
        // Load CSV data into state
        dispatch(TimelineActions.loadCsvData(parsedData, assetTypes));
        
        // Process CSV into task bank for each selected asset
        assets.selected.forEach(asset => {
          const assetTasks = createTasksFromCsv(parsedData, asset);
          dispatch(TimelineActions.updateTaskBank(assetTasks));
        });

        // CSV parsed and initial bank seeded
        setCatalogReady(true);
      },
      error: (error) => {
        console.error("Error parsing CSV file:", error);
        // Avoid blocking UI; downstream handles empty bank safely
        setCatalogReady(true);
      }
    });
  }, [dispatch, assets.selected]);

  // ============================================
  // Fetch Bank Holidays
  // ============================================
  
  useEffect(() => {
    fetch('https://www.gov.uk/bank-holidays.json')
      .then(response => response.json())
      .then(data => {
        const events = data['england-and-wales'].events;
        const now = new Date();
        const tenYearsFromNow = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
        
        const holidayDates = events
          .map((event: any) => event.date)
          .filter((dateStr: string) => {
            const date = new Date(dateStr);
            return date >= now && date <= tenYearsFromNow;
          });
        
        dispatch(TimelineActions.setBankHolidays(holidayDates));
      })
      .catch(() => {
        dispatch(TimelineActions.setBankHolidays([]));
      });
  }, [dispatch]);

  // ============================================
  // Calculate Timeline when Dependencies Change
  // ============================================
  
  useEffect(() => {
    if (!catalogReady) return; // wait for catalog
    // Avoid clearing the timeline during transitions (e.g., recovery/hydration)
    // Only recompute when we actually have selected assets; otherwise, preserve
    // existing timeline until an explicit clear/reset occurs.
    if (assets.selected.length === 0) {
      return;
    }

    const allTimelineTasks: TimelineTask[] = [];
    
    // Build timeline for each selected asset, ordered by catalog (Select Assets list)
    const catalog = Array.isArray(assets.available) ? assets.available : [];
    const norm = (s: string) => (s || '').toLowerCase().trim();
    const indexOfType = (t: string) => {
      const i = catalog.findIndex(x => norm(x) === norm(t));
      return i === -1 ? Number.POSITIVE_INFINITY : i;
    };
    const ordered = [...assets.selected].sort((a, b) => {
      const ai = indexOfType(a.type);
      const bi = indexOfType(b.type);
      if (ai !== bi) return ai - bi;
      return norm(a.name).localeCompare(norm(b.name));
    });

    ordered.forEach(asset => {
      // Prefer instanceBase tasks (from imported editable plan) if present; they already include dependencies
      let rawTasks = (tasks as any).instanceBase && (tasks as any).instanceBase[asset.id]
        ? (tasks as any).instanceBase[asset.id]
        : (tasks.bank[asset.id] || []);
      const liveDate = dates.useGlobalDate 
        ? dates.globalLiveDate 
        : asset.startDate;
      
      if (!liveDate) return;
      
      // Apply per-instance duration overrides before scheduling (Bug fix: task name collision)
      // Per-instance overrides have priority over name-based overrides
      if (tasks.instanceDurations) {
        rawTasks = (rawTasks as any[]).map((task: any) => {
          if (task.id && tasks.instanceDurations[task.id] !== undefined) {
            return { ...task, duration: tasks.instanceDurations[task.id] };
          }
          return task;
        });
      }
      
      const assetTimeline = buildAssetTimeline(
        rawTasks as any,
        liveDate,
        assets.taskDurations[asset.type],
        dates.bankHolidays
      );
      
      allTimelineTasks.push(...assetTimeline);
    });

    // Update timeline in state
    dispatch(TimelineActions.updateTimeline(allTimelineTasks));

    // Calculate date conflicts
    const calculatedStartDates: Record<string, string> = {};
    ordered.forEach(asset => {
      const assetTasks = allTimelineTasks.filter(t => t.assetId === asset.id);
      if (assetTasks.length > 0) {
        const earliestStart = getEarliestStartDate(assetTasks);
        if (earliestStart) {
          calculatedStartDates[asset.id] = earliestStart;
        }
      }
    });

    // TODO: Find conflicts and update UI state when date error actions are implemented
    // const conflicts = findDateConflicts(assets.selected, calculatedStartDates);
    
  }, [
    assets.selected,
    tasks.bank,
    (tasks as any).instanceBase,
    dates,
    assets.taskDurations,
    tasks.instanceDurations,
    dispatch
  ]);

  // ============================================
  // Event Handlers
  // ============================================
  
  const handleAddAsset = (assetType: string) => {
    addAsset(assetType);
  };

  const handleRemoveAsset = (assetId: string) => {
    removeAsset(assetId);
  };

  const handleRenameAsset = (assetId: string, newName: string) => {
    renameAsset(assetId, newName);
  };

  const handleAssetStartDateChange = (assetId: string, date: string) => {
    setAssetStartDate(assetId, date);
  };

  const handleGlobalLiveDateChange = (date: string) => {
    setGlobalLiveDate(date);
  };

  const handleToggleUseGlobalDate = (useGlobal: boolean) => {
    if (useGlobal !== dates.useGlobalDate) {
      toggleUseGlobalDate();
    }
  };

  const handleTaskDurationChange = (taskId: string, newDuration: number) => {
    const task = tasks.timeline.find(t => t.id === taskId);
    if (!task) return;
    
    const asset = assets.selected.find(a => a.id === task.assetId);
    if (!asset) return;
    
    updateTaskDuration(taskId, asset.type, task.name, newDuration);
  };

  const handleTaskNameChange = (taskId: string, newName: string) => {
    renameTask(taskId, newName);
  };

  const handleAddCustomTask = (params: {
    name: string;
    duration: number;
    owner: 'c' | 'm' | 'a' | 'l';
    assetType: string;
    insertAfterTaskId?: string;
  }) => {
    addCustomTask(
      params.name,
      params.duration,
      params.owner,
      params.assetType,
      params.insertAfterTaskId
    );
  };

  const handleSaveTaskDurations = (assetId: string, durations: Record<string, number>) => {
    const asset = assets.selected.find(a => a.id === assetId);
    if (!asset) return;
    
    // Update all task durations for this asset type
    Object.entries(durations).forEach(([taskName, duration]) => {
      // Note: We need a better way to handle bulk duration updates
      updateTaskDuration('', asset.type, taskName, duration);
    });
  };

  // ============================================
  // Excel Import/Export Handlers  
  // ============================================

  const handleExportExcel = async () => {
    if (tasks.timeline.length === 0) {
      setImportError('No timeline to export. Please add some assets first.');
      return;
    }

    setIsExporting(true);
    setImportError(null);

    try {
      // Calculate date columns for export
      const minDate = tasks.timeline.reduce((min, task) => {
        const taskDate = new Date(task.start);
        return min < taskDate ? min : taskDate;
      }, new Date(tasks.timeline[0].start));
      
      const maxDate = tasks.timeline.reduce((max, task) => {
        const taskDate = new Date(task.end);
        return max > taskDate ? max : taskDate;
      }, new Date(tasks.timeline[0].end));

      // Add padding
      minDate.setDate(minDate.getDate() - 2);
      maxDate.setDate(maxDate.getDate() + 5);

      const dateColumns = [];
      const current = new Date(minDate);
      while (current <= maxDate) {
        dateColumns.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      await exportToExcel(tasks.timeline, dateColumns, dates.bankHolidays, minDate, maxDate, {
        clientCampaignName: ui.clientCampaignName || ''
      });
    } catch (error) {
      console.error('Export error:', error);
      setImportError('Failed to export timeline. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setIsImporting(true);

    try {
      if (!validateExcelFile(file)) {
        throw new Error('Please select a valid Excel file (.xlsx or .xls).');
      }

      const preview = await getImportPreview(file);
      if (!preview.success) {
        throw new Error(preview.error || 'Failed to read Excel file.');
      }

      setImportPreview({ file, preview });
      setShowImportConfirm(true);
    } catch (error) {
      console.error('Import validation error:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to process Excel file.');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview?.file) return;

    setIsImporting(true);
    setShowImportConfirm(false);

    try {
      const importedData: any = await importFromExcel(importPreview.file);

      // Build instanceBase from imported tasks preserving dependencies and custom flags
      const baseByInstance: Record<string, any[]> = {};
      ((importedData.tasks as any[]) || []).forEach((t: any) => {
        if (!t || !t.assetId) return;
        if (!baseByInstance[t.assetId]) baseByInstance[t.assetId] = [];
        baseByInstance[t.assetId].push({
          id: t.id,
          name: t.name,
          duration: t.duration,
          owner: t.owner || 'm',
          assetId: t.assetId,
          assetType: t.assetType,
          isCustom: !!t.isCustom,
          insertAfterTaskId: t.insertAfterTaskId || undefined,
          dependencies: Array.isArray(t.dependencies) ? t.dependencies.map((d: any) => ({
            predecessorId: d.predecessorId,
            type: 'FS' as const,
            lag: Number(d.lag) || 0
          })) : []
        });
      });

      // Import minimal state required to rebuild the timeline with overlaps preserved
      dispatch(TimelineActions.clearAll());
      dispatch(TimelineActions.importState({
        assets: {
          available: [],
          selected: (importedData.selectedAssets as any[]) || [],
          liveDates: (importedData.assetLiveDates as Record<string, string>) || {},
          taskDurations: {}
        },
        tasks: {
          all: [],
          bank: {},
          byAsset: {},
          instanceBase: baseByInstance,
          instanceDurations: {},
          timeline: [],
          custom: [],
          names: {},
          deps: {}
        },
        dates: {
          globalLiveDate: (importedData.globalLiveDate as string) || '',
          useGlobalDate: (importedData.useGlobalDate as boolean) !== undefined ? Boolean(importedData.useGlobalDate) : true,
          projectStartDate: '',
          bankHolidays: dates.bankHolidays,
          calculatedStartDates: {}
        },
        ui: { freezeImportedTimeline: false, clientCampaignName: importedData.clientCampaignName || '' } as any
      }));

      setImportError(null);
    } catch (error) {
      console.error('Import error:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import timeline.');
    } finally {
      setIsImporting(false);
      setImportPreview(null);
    }
  };

  const handleCancelImport = () => {
    setShowImportConfirm(false);
    setImportPreview(null);
    setImportError(null);
  };

  // ============================================
  // Calculate Working Days Needed
  // ============================================
  
  const workingDaysNeeded = calculateWorkingDaysNeeded(
    assets.selected,
    dates.calculatedStartDates || {},
    ui.dateErrors,
    dates.bankHolidays
  );

  // ============================================
  // Render
  // ============================================
  
  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800">Accordion Timeline Builder</h1>
            <div className="flex items-center space-x-2">
              {/* Excel Import/Export */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                title="Import Timeline from Excel"
              >
                {isImporting ? '⏳ Importing...' : '📥 Import'}
              </button>
              <button
                data-testid="export-excel"
                onClick={handleExportExcel}
                disabled={isExporting || tasks.timeline.length === 0 || !(ui.clientCampaignName && ui.clientCampaignName.trim())}
                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                title="Export Timeline to Excel"
              >
                {isExporting ? '⏳ Exporting...' : '📊 Export'}
              </button>

              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFileSelect}
                data-testid="import-excel-input"
                className="hidden"
              />
              
              {/* Undo/Redo */}
              <button
                onClick={undo}
                disabled={!canUndo}
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                title="Undo (Ctrl+Z)"
              >
                ↩️ Undo
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                title="Redo (Ctrl+Y)"
              >
                ↪️ Redo
              </button>
            </div>
          </div>
          
          {/* Error Messages */}
          {importError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center">
                <span className="text-red-500 mr-2">⚠️</span>
                <span className="text-red-700 text-sm">{importError}</span>
                <button
                  onClick={() => setImportError(null)}
                  className="ml-auto text-red-400 hover:text-red-600 text-lg"
                >
                  ×
                </button>
              </div>
            </div>
          )}
          
          {/* Getting Started Button */}
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowGettingStarted(true)}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              🚀 Getting Started
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6">
        {isHydrating && (
          <div className="text-center text-gray-600 py-6">
            <div className="inline-block animate-pulse px-4 py-2 bg-gray-200 rounded">Restoring your session…</div>
          </div>
        )}
        {!catalogReady && (
          <div className="text-center text-gray-600 py-10">
            <div className="inline-block animate-pulse px-4 py-2 bg-gray-200 rounded">Loading timeline catalog…</div>
          </div>
        )}
        {catalogReady && !isHydrating && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Controls (collapsible) */}
          {leftCollapsed ? (
            <div className="lg:col-span-1 flex">
              <button
                data-testid="expand-left-panel"
                onClick={() => setLeftCollapsed(false)}
                className="w-[50px] py-3 rounded-lg border border-gray-200 bg-white shadow flex flex-col items-center justify-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                title="Expand Campaign Setup"
                aria-expanded="false"
                aria-controls="left-panel"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="text-gray-500"
                >
                  <path
                    d="M22.7 19.3l-6.4-6.4a6 6 0 00-7.6-7.6l3 3a2.5 2.5 0 01-3.5 3.5l-3-3A6 6 0 0013 16.3l6.4 6.4a1 1 0 001.4-1.4z"
                    fill="currentColor"
                  />
                </svg>
                <span className="my-2 text-gray-500 leading-none">›</span>
                <span className="text-[10px] text-gray-600 tracking-wide">Setup</span>
              </button>
            </div>
          ) : (
            <div id="left-panel" className="lg:col-span-1 bg-white p-4 rounded-xl shadow-lg" style={{ minWidth: 380 }}>
              <div className="flex items-center justify-between mb-3 border-b pb-2">
                <h2 className="text-xl font-semibold text-gray-700">Timeline Setup</h2>
                <button
                  data-testid="collapse-left-panel"
                  onClick={() => setLeftCollapsed(true)}
                  className="text-gray-500 hover:text-gray-700 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                  title="Collapse Campaign Setup"
                  aria-expanded="true"
                  aria-controls="left-panel"
                >
                  ‹
                </button>
              </div>
              
              <CampaignSetup 
                {...{
                  clientCampaignName: ui.clientCampaignName || '',
                  onClientCampaignNameChange: setClientCampaignName,
                  globalLiveDate: dates.globalLiveDate,
                  onGlobalLiveDateChange: handleGlobalLiveDateChange,
                  useGlobalDate: dates.useGlobalDate,
                  onUseGlobalDateChange: handleToggleUseGlobalDate,
                  projectStartDate: dates.projectStartDate,
                  dateErrors: ui.dateErrors,
                  bankHolidays: dates.bankHolidays,
                  workingDaysNeeded: workingDaysNeeded
                } as any}
              />
              
              <AssetSelector
                {...{
                  assets: assets.available,
                  selectedAssets: assets.selected,
                  onAddAsset: handleAddAsset,
                  onRemoveAsset: handleRemoveAsset,
                  useGlobalDate: dates.useGlobalDate,
                  globalLiveDate: dates.globalLiveDate,
                  assetLiveDates: assets.liveDates,
                  onAssetLiveDateChange: (assetName: string, date: string) => {
                    dispatch(TimelineActions.setAssetLiveDate(assetName, date));
                  },
                  calculatedStartDates: dates.calculatedStartDates || {},
                  dateErrors: ui.dateErrors,
                  onRenameAsset: handleRenameAsset,
                  onAssetStartDateChange: handleAssetStartDateChange,
                  csvData: csvData,
                  onSaveTaskDurations: handleSaveTaskDurations,
                  isNonWorkingDay: (date: Date) => {
                    const day = date.getDay();
                    const dateStr = date.toISOString().split('T')[0];
                    const isWeekend = day === 0 || day === 6;
                    const isHoliday = dates.bankHolidays.includes(dateStr);
                    return isWeekend || isHoliday;
                  },
                  calculateWorkingDaysBetween: (start: string, end: string) => {
                    if (!start || !end) return 0;
                    const startDate = new Date(start);
                    const endDate = new Date(end);
                    if (startDate >= endDate) return 0;
                    
                    let workingDays = 0;
                    let currentDate = new Date(startDate);
                    
                    while (currentDate < endDate) {
                      const dayOfWeek = currentDate.getDay();
                      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                        workingDays++;
                      }
                      currentDate.setDate(currentDate.getDate() + 1);
                    }
                    
                    return workingDays;
                  }
                } as any}
              />
            </div>
          )}
          
          {/* Right Column: Timeline */}
          <div className={`${leftCollapsed ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white p-6 rounded-xl shadow-lg`} style={{ minWidth: 0, maxWidth: "100%" }}>
            <h2 className="text-xl font-semibold mb-4 border-b pb-3 text-gray-700">Generated Timeline</h2>
            
            {/* Timeline Conflict Warnings */}
            {ui.dateErrors.length > 0 && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <h3 className="text-red-800 font-medium mb-2">⚠️ Timeline Conflicts</h3>
                <p className="text-red-700 text-sm mb-2">
                  The following assets cannot be completed by their live dates:
                </p>
                <ul className="text-red-700 text-sm">
                  {ui.dateErrors.map(assetId => {
                    const asset = assets.selected.find(a => a.id === assetId);
                    return (
                      <li key={assetId} className="ml-4">
                        • {asset?.name || 'Unknown Asset'} (would need to start on {dates.calculatedStartDates?.[assetId] || 'TBD'})
                      </li>
                    );
                  })}
                </ul>
                <p className="text-red-700 text-sm mt-2 font-medium">
                  Manual adjustment of task durations required.
                </p>
              </div>
            )}

            {/* Gantt Chart */}
            {tasks.timeline && tasks.timeline.length > 0 ? (
              <GanttChart 
                {...{
                  tasks: tasks.timeline,
                  bankHolidays: dates.bankHolidays,
                  onTaskDurationChange: handleTaskDurationChange,
                  onTaskNameChange: handleTaskNameChange,
                  workingDaysNeeded: workingDaysNeeded,
                  assetAlerts: [], // This needs proper calculation
                  onAddCustomTask: handleAddCustomTask,
                  selectedAssets: assets.selected
                } as any}
              />
            ) : (
              <div className="text-center text-gray-500 py-10">
                <p className="text-lg">Your timeline will appear here.</p>
                <p className="text-sm">Set a live date and select some assets to begin.</p>
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {/* Import Confirmation Modal */}
      {showImportConfirm && importPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <span className="text-yellow-500 mr-3 text-2xl">⚠️</span>
                <h2 className="text-xl font-bold text-gray-800">Confirm Timeline Import</h2>
              </div>
              
              <div className="space-y-3 mb-6">
                <p className="text-gray-600">
                  This will replace your current timeline with the imported data:
                </p>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  <div><strong>File:</strong> {importPreview.preview.fileName}</div>
                  <div><strong>Tasks:</strong> {importPreview.preview.taskCount}</div>
                  <div><strong>Exported:</strong> {importPreview.preview.exportDate ? new Date(importPreview.preview.exportDate).toLocaleDateString() : 'Unknown'}</div>
                </div>
                <p className="text-red-600 text-sm font-medium">
                  Your current work will be lost unless you export it first.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelImport}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  data-testid="confirm-import"
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                >
                  {isImporting ? 'Importing...' : 'Import Timeline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Getting Started Modal */}
      {showGettingStarted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Getting Started</h2>
                <button
                  onClick={() => {
                    setShowGettingStarted(false);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              {/* Quick Start (5 steps) */}
              <div className="space-y-4">
                <p className="text-gray-600">Build your campaign timeline in 5 simple steps:</p>
                <ol className="list-decimal pl-5 space-y-2 text-gray-700">
                  <li>
                    <span className="font-medium">Name your project (Required):</span>
                    <span className="ml-1 text-gray-600">Add a client or campaign name (e.g., Barclays Autumn Campaign). This is required and appears in your Excel header, sheet tab and filename; export is disabled until it’s set.</span>
                  </li>
                  <li><span className="font-medium">Select your assets (Required):</span> Use the left panel to add the marketing assets you need.</li>
                  <li><span className="font-medium">Set your go-live date(s) (Required):</span> Use a single global date or individual dates per asset.</li>
                  <li><span className="font-medium">Review your timeline:</span> Adjust durations, overlaps and resolve warnings.</li>
                  <li><span className="font-medium">Export to Excel:</span> Save and share your professional timeline.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics/Optimization modals removed to simplify UI */}
    </div>
  );
};

export default TimelineBuilder;
