/**
 * DataManager - CSV/Excel Data Processing ONLY
 * Single Responsibility: Data import/export operations
 * 
 * CRITICAL: This component handles ONLY data processing, NO UI rendering
 * All state changes flow through context dispatch
 */

import React, { useRef, useState, useCallback } from 'react';
import Papa from 'papaparse';
import { useTimelineContext, useTimelineActions } from '../../contexts/TimelineContext';
import { ActionType } from '../../types/timeline.types';

// Import existing data handling utilities
import { exportToExcel } from '../../services/ExcelExporter';
import { importFromExcel, validateExcelFile, getImportPreview } from '../../services/ExcelImporter';

// ============================================
// CSV Import Component
// ============================================

function CSVImportSection(): JSX.Element {
  const { dispatch } = useTimelineActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  const handleCSVUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setImportError(null);
    
    console.log('[DataManager] Starting CSV import:', file.name);
    
    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log('[DataManager] CSV parsed:', {
            rows: results.data.length,
            errors: results.errors.length
          });
          
          if (results.errors.length > 0) {
            setImportError(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`);
            setIsImporting(false);
            return;
          }
          
          // Extract unique asset types
          const uniqueAssets = [...new Set(
            results.data.map((row: any) => row['Asset Type']).filter(Boolean)
          )];
          
          // Dispatch CSV data to context
          dispatch({
            type: ActionType.LOAD_CSV_DATA,
            payload: {
              csvData: results.data,
              uniqueAssets
            }
          });
          
          setIsImporting(false);
          console.log('[DataManager] CSV import complete:', {
            uniqueAssets: uniqueAssets.length,
            totalRows: results.data.length
          });
        },
        error: (error) => {
          console.error('[DataManager] CSV parsing error:', error);
          setImportError(`CSV parsing failed: ${error.message}`);
          setIsImporting(false);
        }
      });
      
    } catch (error) {
      console.error('[DataManager] CSV import error:', error);
      setImportError(`Import failed: ${error.message}`);
      setIsImporting(false);
    }
  }, [dispatch]);
  
  return (
    <div className="csv-import-section">
      <h4>CSV Import</h4>
      
      <div className="csv-import-controls">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleCSVUpload}
          disabled={isImporting}
          data-testid="csv-file-input"
          style={{ display: 'none' }}
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="btn btn-primary"
          data-testid="csv-import-button"
        >
          {isImporting ? 'Importing...' : 'Import CSV'}
        </button>
      </div>
      
      {importError && (
        <div className="import-error" style={{ color: 'red', marginTop: '10px' }}>
          <strong>Import Error:</strong> {importError}
        </div>
      )}
      
      <div className="csv-format-info" style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
        <strong>Expected CSV format:</strong>
        <br />Asset Type, Task, Duration (Days), owner
      </div>
    </div>
  );
}

// ============================================
// Excel Export Component
// ============================================

function ExcelExportSection(): JSX.Element {
  const { state } = useTimelineContext();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  
  const handleExcelExport = useCallback(async () => {
    if (state.tasks.timeline.length === 0) {
      setExportError('No timeline data to export');
      return;
    }
    
    setIsExporting(true);
    setExportError(null);
    
    console.log('[DataManager] Starting Excel export:', {
      timelineTasks: state.tasks.timeline.length,
      assets: state.assets.selected.length
    });
    
    try {
      await exportToExcel(state);
      console.log('[DataManager] Excel export complete');
      setIsExporting(false);
      
    } catch (error) {
      console.error('[DataManager] Excel export error:', error);
      setExportError(`Export failed: ${error.message}`);
      setIsExporting(false);
    }
  }, [state]);
  
  return (
    <div className="excel-export-section">
      <h4>Excel Export</h4>
      
      <div className="excel-export-controls">
        <button
          onClick={handleExcelExport}
          disabled={isExporting || state.tasks.timeline.length === 0}
          className="btn btn-success"
          data-testid="excel-export-button"
        >
          {isExporting ? 'Exporting...' : 'Export to Excel'}
        </button>
      </div>
      
      {exportError && (
        <div className="export-error" style={{ color: 'red', marginTop: '10px' }}>
          <strong>Export Error:</strong> {exportError}
        </div>
      )}
      
      <div className="export-info" style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
        Exports current timeline with all tasks, dates, and durations
      </div>
    </div>
  );
}

// ============================================
// Excel Import Component
// ============================================

function ExcelImportSection(): JSX.Element {
  const { dispatch } = useTimelineActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  
  const handleExcelUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setImportError(null);
    
    console.log('[DataManager] Starting Excel import:', file.name);
    
    try {
      // Validate Excel file
      const validation = await validateExcelFile(file);
      if (!validation.valid) {
        setImportError(`Invalid Excel file: ${validation.error}`);
        setIsImporting(false);
        return;
      }
      
      // Get import preview
      const preview = await getImportPreview(file);
      setImportPreview(preview);
      setShowImportConfirm(true);
      setIsImporting(false);
      
    } catch (error) {
      console.error('[DataManager] Excel import error:', error);
      setImportError(`Import failed: ${error.message}`);
      setIsImporting(false);
    }
  }, []);
  
  const confirmExcelImport = useCallback(async () => {
    if (!importPreview) return;
    
    setIsImporting(true);
    
    try {
      const importedData = await importFromExcel(importPreview.file);
      
      dispatch({
        type: ActionType.IMPORT_TIMELINE,
        payload: { importedData }
      });
      
      console.log('[DataManager] Excel import complete');
      setShowImportConfirm(false);
      setImportPreview(null);
      setIsImporting(false);
      
    } catch (error) {
      console.error('[DataManager] Excel import confirmation error:', error);
      setImportError(`Import failed: ${error.message}`);
      setIsImporting(false);
    }
  }, [importPreview, dispatch]);
  
  return (
    <div className="excel-import-section">
      <h4>Excel Import</h4>
      
      <div className="excel-import-controls">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleExcelUpload}
          disabled={isImporting}
          data-testid="excel-file-input"
          style={{ display: 'none' }}
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="btn btn-primary"
          data-testid="excel-import-button"
        >
          {isImporting ? 'Processing...' : 'Import Excel'}
        </button>
      </div>
      
      {importError && (
        <div className="import-error" style={{ color: 'red', marginTop: '10px' }}>
          <strong>Import Error:</strong> {importError}
        </div>
      )}
      
      {showImportConfirm && importPreview && (
        <div className="import-confirmation" style={{ border: '1px solid #ccc', padding: '10px', marginTop: '10px' }}>
          <h5>Import Preview</h5>
          <p>Found {importPreview.taskCount} tasks in {importPreview.assetCount} assets</p>
          <div className="confirmation-buttons">
            <button
              onClick={confirmExcelImport}
              disabled={isImporting}
              className="btn btn-success"
              data-testid="confirm-excel-import"
            >
              Confirm Import
            </button>
            <button
              onClick={() => {
                setShowImportConfirm(false);
                setImportPreview(null);
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Data Manager Component
// ============================================

export function DataManager(): JSX.Element {
  console.log('[DataManager] Rendering data management interface');
  
  return (
    <div className="data-manager">
      <h3>Data Management</h3>
      
      <div className="data-sections">
        
        {/* CSV Import */}
        <CSVImportSection />
        
        {/* Excel Export */}
        <ExcelExportSection />
        
        {/* Excel Import */}
        <ExcelImportSection />
        
      </div>
      
    </div>
  );
}

export default DataManager;