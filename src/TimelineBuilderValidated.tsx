/**
 * TimelineBuilder Component - With Integrated Validation
 * Enhanced version with complete UI validation feedback
 * Follows Golden Rules: Safety First, PM-Friendly
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import Papa from 'papaparse';

// Components
import AssetSelectorValidated from './components/AssetSelectorValidated';
import CampaignSetup from './components/CampaignSetup';
import GanttChart from './components/GanttChart';
import ValidationToasts from './components/ValidationToasts';
import ValidationWarning from './components/ValidationWarning';
import ErrorBoundary from './components/ErrorBoundary';

// Hooks
import { 
  useTimeline,
  useAssets,
  useTasks,
  useDates,
  useUI,
  TimelineActions
} from './hooks/useTimeline';
import { useValidation } from './contexts/ValidationContext';

// Services
import {
  createTasksFromCsv
} from './services/TimelineCalculator';
import { ValidationService } from './services/ValidationService';

// Types
import { 
  CsvRow
} from './types/timeline.types';

const TimelineBuilderValidated: React.FC = () => {
  // ============================================
  // State Management via Hooks
  // ============================================
  
  const { dispatch, undo, redo, canUndo, canRedo } = useTimeline();
  const { assets, addAsset, removeAsset, renameAsset, setAssetStartDate } = useAssets();
  const { tasks, addCustomTask, updateTaskDuration, renameTask } = useTasks();
  const { dates, setGlobalLiveDate, toggleUseGlobalDate, setBankHolidays } = useDates();
  const { ui } = useUI();
  
  // Validation context
  const { 
    showToast, 
    checkLimitWarning, 
    canAddAsset, 
    canAddTask,
    setFieldError,
    clearFieldError
  } = useValidation();

  // Local UI state - will be added as needed

  // ============================================
  // Check Limits on State Changes
  // ============================================
  
  useEffect(() => {
    // Check asset limits
    checkLimitWarning('assets', assets.selected.length);
    
    // Check task limits
    const totalTasks = tasks.timeline.length;
    checkLimitWarning('tasks', totalTasks);
    
    // Check custom task limits
    checkLimitWarning('custom_tasks', tasks.custom.length);
  }, [assets.selected.length, tasks.timeline.length, tasks.custom.length, checkLimitWarning]);

  // ============================================
  // Validated Action Handlers
  // ============================================
  
  const handleAddAsset = useCallback((assetType: string, name?: string) => {
    // Check if we can add more assets
    if (!canAddAsset(assets.selected.length)) {
      return;
    }
    
    // Validate asset name
    const validation = ValidationService.validateAssetName(name || assetType);
    if (!validation.valid) {
      showToast(validation.error || 'Invalid asset name', 'error');
      return;
    }
    
    // Add the asset with sanitized name
    addAsset(assetType, validation.sanitized);
    showToast(`Asset "${validation.sanitized}" added successfully`, 'success');
  }, [assets.selected.length, canAddAsset, addAsset, dates.globalLiveDate, showToast]);

  const handleRenameAsset = useCallback((assetId: string, newName: string) => {
    // Validate new name
    const validation = ValidationService.validateAssetName(newName);
    if (!validation.valid) {
      setFieldError(`asset-name-${assetId}`, validation.error || 'Invalid name');
      return;
    }
    
    clearFieldError(`asset-name-${assetId}`);
    renameAsset(assetId, validation.sanitized);
    showToast('Asset renamed successfully', 'success');
  }, [renameAsset, setFieldError, clearFieldError, showToast]);

  const handleUpdateTaskDuration = useCallback((taskId: string, assetType: string, taskName: string, duration: number | string) => {
    // Validate duration
    const validation = ValidationService.validateDuration(duration);
    if (!validation.valid) {
      setFieldError(`task-duration-${taskId}`, validation.error || 'Invalid duration');
      showToast(validation.error || 'Invalid duration', 'error');
      return;
    }
    
    clearFieldError(`task-duration-${taskId}`);
    updateTaskDuration(taskId, assetType, taskName, validation.value);
  }, [updateTaskDuration, setFieldError, clearFieldError, showToast]);

  const handleAddCustomTask = useCallback((
    name: string,
    duration: number | string,
    owner: 'c' | 'm' | 'a' | 'l',
    assetType: string,
    insertAfterTaskId?: string
  ) => {
    // Check if we can add more custom tasks
    if (!canAddTask(tasks.custom.length)) {
      return;
    }
    
    // Validate task name
    const nameValidation = ValidationService.validateTaskName(name);
    if (!nameValidation.valid) {
      setFieldError('custom-task-name', nameValidation.error || 'Invalid task name');
      return;
    }
    
    // Validate duration
    const durationValidation = ValidationService.validateDuration(duration);
    if (!durationValidation.valid) {
      setFieldError('custom-task-duration', durationValidation.error || 'Invalid duration');
      return;
    }
    
    // Clear errors and add task
    clearFieldError('custom-task-name');
    clearFieldError('custom-task-duration');
    addCustomTask(
      nameValidation.sanitized,
      durationValidation.value,
      owner,
      assetType,
      insertAfterTaskId
    );
    showToast(`Custom task "${nameValidation.sanitized}" added successfully`, 'success');
  }, [tasks.custom.length, canAddTask, addCustomTask, setFieldError, clearFieldError, showToast]);

  const handleSetGlobalLiveDate = useCallback((date: string) => {
    // Validate date
    const validation = ValidationService.validateDate(date);
    if (!validation.valid) {
      setFieldError('global-live-date', validation.error || 'Invalid date');
      showToast(validation.error || 'Invalid date', 'error');
      return;
    }
    
    clearFieldError('global-live-date');
    const formattedDate = validation.value?.toISOString().split('T')[0] || '';
    setGlobalLiveDate(formattedDate);
    showToast('Global live date updated', 'success');
  }, [setGlobalLiveDate, setFieldError, clearFieldError, showToast]);

  const handleSetAssetStartDate = useCallback((assetId: string, date: string) => {
    // Validate date
    const validation = ValidationService.validateDate(date);
    if (!validation.valid) {
      setFieldError(`asset-date-${assetId}`, validation.error || 'Invalid date');
      return;
    }
    
    clearFieldError(`asset-date-${assetId}`);
    const formattedDate = validation.value?.toISOString().split('T')[0] || '';
    setAssetStartDate(assetId, formattedDate);
  }, [setAssetStartDate, setFieldError, clearFieldError]);

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
        
        // Sanitize CSV data
        const sanitizedData = parsedData.map(row => 
          ValidationService.sanitizeCsvRow(row)
        );
        
        // CSV data is stored in global state via loadCsvData action
        
        // Extract unique asset types from CSV
        const assetTypes = [...new Set(sanitizedData.map(row => row['Asset Type']))].filter(type => type);
        
        // Load CSV data into state
        dispatch(TimelineActions.loadCsvData(sanitizedData, assetTypes));
        
        // Process CSV into task bank for each selected asset
        assets.selected.forEach(asset => {
          const assetTasks = createTasksFromCsv(sanitizedData as unknown as CsvRow[], asset);
          dispatch(TimelineActions.updateTaskBank(assetTasks));
        });
      },
      error: (error) => {
        console.error("Error parsing CSV file:", error);
        showToast('Failed to load task data. Please refresh the page.', 'error');
      }
    });
  }, [dispatch, assets.selected, showToast]);

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
        
        const holidays = events
          .filter((event: any) => {
            const eventDate = new Date(event.date);
            return eventDate >= now && eventDate <= tenYearsFromNow;
          })
          .map((event: any) => event.date);
        
        setBankHolidays(holidays);
      })
      .catch(error => {
        console.error('Failed to fetch bank holidays:', error);
        showToast('Could not load bank holidays. Dates may not account for UK holidays.', 'warning');
      });
  }, [setBankHolidays, showToast]);

  // ============================================
  // Build Timeline on State Changes (Memoized for Performance)
  // ============================================
  
  // Memoize expensive timeline calculation
  const computedTimeline = useMemo(() => {
    if (assets.selected.length > 0 && dates.globalLiveDate) {
      try {
        // Note: buildAssetTimeline needs to be redesigned for the new architecture
        return [];
      } catch (error) {
        console.error('Error building timeline:', error);
        return [];
      }
    }
    return [];
  }, [
    assets.selected,
    tasks.bank,
    tasks.custom,
    dates.globalLiveDate,
    dates.useGlobalDate,
    dates.bankHolidays
  ]);

  // Update timeline and check for conflicts when computed timeline changes
  useEffect(() => {
    if (computedTimeline.length > 0) {
      dispatch(TimelineActions.updateTimeline(computedTimeline));
      
      // TODO: Re-implement date conflict checking with proper function signature
      // const conflicts = findDateConflicts(computedTimeline);
      // if (conflicts.length > 0) {
      //   dispatch(TimelineActions.setDateErrors(conflicts));
      //   showToast('Warning: Some tasks have overlapping dates', 'warning');
      // }
    }
  }, [computedTimeline, dispatch, showToast]);

  // ============================================
  // Render
  // ============================================

  return (
    <ErrorBoundary>
      <div className="timeline-builder min-h-screen bg-gray-50">
        {/* Toast Notifications */}
        <ValidationToasts />
        
        {/* Main Content */}
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Timeline Builder</h1>
            <p className="mt-2 text-gray-600">Build and manage your project timeline</p>
          </header>

          {/* Warnings for approaching limits */}
          <ValidationWarning />

          {/* Campaign Setup Section */}
          <section className="mb-8">
            <CampaignSetup
              {...{
                globalLiveDate: dates.globalLiveDate,
                useGlobalDate: dates.useGlobalDate,
                onSetGlobalLiveDate: handleSetGlobalLiveDate,
                onToggleUseGlobalDate: toggleUseGlobalDate,
                showInfoBox: ui.showInfoBox
              } as any}
            />
          </section>

          {/* Asset Selector Section */}
          <section className="mb-8">
            <AssetSelectorValidated
              availableAssets={assets.available}
              selectedAssets={assets.selected}
              onAddAsset={handleAddAsset}
              onRemoveAsset={removeAsset}
              onRenameAsset={handleRenameAsset}
              onSetAssetStartDate={handleSetAssetStartDate}
              useGlobalDate={dates.useGlobalDate}
            />
          </section>

          {/* Gantt Chart Section */}
          {assets.selected.length > 0 && dates.globalLiveDate && (
            <section className="mb-8">
              <GanttChart
                {...{
                  tasks: tasks.timeline,
                  onUpdateTaskDuration: handleUpdateTaskDuration,
                  onAddCustomTask: handleAddCustomTask,
                  onRenameTask: renameTask,
                  projectStartDate: dates.projectStartDate,
                  bankHolidays: dates.bankHolidays
                } as any}
              />
            </section>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`px-4 py-2 rounded-md transition-colors ${
                canUndo
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Undo
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`px-4 py-2 rounded-md transition-colors ${
                canRedo
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Redo
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default TimelineBuilderValidated;