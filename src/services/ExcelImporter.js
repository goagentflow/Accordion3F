import * as ExcelJS from 'exceljs';

/**
 * Import timeline data from Excel file with _DATA tab validation
 * @param {File} file - Excel file to import
 * @returns {Promise<Object>} - Parsed timeline data for state restoration
 */
export const importFromExcel = async (file) => {
  // Validate file type
  if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
    throw new Error('Invalid file format. Please select an Excel file (.xlsx or .xls).');
  }

  const workbook = new ExcelJS.Workbook();
  
  try {
    // Read the Excel file
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
  } catch (error) {
    throw new Error('Failed to read Excel file. The file may be corrupted or in an unsupported format.');
  }

  // Look for the data worksheet
  let dataWorksheet = null;
  const possibleDataSheetNames = ['DO_NOT_EDIT_DATA', '_DATA', 'Data'];
  
  for (const sheetName of possibleDataSheetNames) {
    dataWorksheet = workbook.getWorksheet(sheetName);
    if (dataWorksheet) break;
  }

  if (!dataWorksheet) {
    throw new Error('Timeline data not found. This Excel file was not exported from the Timeline Builder or the data tab has been deleted.');
  }

  // Get the JSON data from the worksheet
  let jsonData = null;
  
  // Check cell A3 first (new format with warning), then A1 (old format)
  const cell = dataWorksheet.getCell('A3').value || dataWorksheet.getCell('A1').value;
  
  if (!cell) {
    throw new Error('Timeline data is missing or empty. The data may have been accidentally deleted.');
  }

  try {
    jsonData = typeof cell === 'string' ? JSON.parse(cell) : cell;
  } catch (error) {
    throw new Error('Timeline data is corrupted and cannot be read. Please use the original exported file.');
  }

  // Validate the imported data structure
  if (!jsonData || typeof jsonData !== 'object') {
    throw new Error('Timeline data format is invalid.');
  }

  if (!jsonData.version) {
    throw new Error('Timeline data version is missing. This may not be a valid timeline export.');
  }

  if (!jsonData.timeline || !Array.isArray(jsonData.timeline)) {
    throw new Error('Timeline tasks data is missing or invalid.');
  }

  // Validate that we have actual timeline data
  if (jsonData.timeline.length === 0) {
    throw new Error('No timeline data found in the Excel file.');
  }

  const importedData = transformImportedJson(jsonData);

  // Additional validation on the transformed data
  const validTasks = importedData.tasks.filter(task => 
    task.name && task.start && task.end
  );

  if (validTasks.length === 0) {
    throw new Error('No valid timeline tasks found in the imported data.');
  }

  if (validTasks.length < importedData.tasks.length) {
    console.warn(`${importedData.tasks.length - validTasks.length} tasks were skipped due to missing required data.`);
  }

  return {
    ...importedData,
    tasks: validTasks,
    importedAt: new Date().toISOString(),
    originalFileName: file.name
  };
};

/**
 * Pure transformation helper: turn JSON metadata from the DO_NOT_EDIT_DATA sheet
 * back into the structure the app expects. Exported for unit testing to avoid
 * coupling tests to binary XLSX parsing in Jest.
 */
export const transformImportedJson = (jsonData) => {
  const importedData = {
    version: jsonData.version,
    exportDate: jsonData.exportDate,
    taskCount: jsonData.taskCount,
    tasks: (jsonData.timeline || []).map(task => ({
      ...task,
      start: task.startDate || task.start,
      end: task.endDate || task.end
    })),
    selectedAssets: jsonData.selectedAssets || [],
    globalLiveDate: jsonData.globalLiveDate || '',
    assetLiveDates: jsonData.assetLiveDates || {},
    useGlobalDate: jsonData.useGlobalDate !== undefined ? jsonData.useGlobalDate : true,
    customTasks: jsonData.customTasks || [],
    assetTaskDurations: jsonData.assetTaskDurations || {},
    customTaskNames: jsonData.customTaskNames || {},
    clientCampaignName: jsonData.clientCampaignName || ''
  };
  return importedData;
};

/**
 * Validate if a file can be imported
 * @param {File} file - File to validate
 * @returns {boolean} - Whether file is valid for import
 */
export const validateExcelFile = (file) => {
  if (!file) return false;
  
  const validExtensions = ['.xlsx', '.xls'];
  const fileName = file.name.toLowerCase();
  
  return validExtensions.some(ext => fileName.endsWith(ext));
};

/**
 * Get import preview information without full parsing
 * @param {File} file - Excel file to preview
 * @returns {Promise<{success: boolean, taskCount?: number, exportDate?: string, version?: string, fileName: string, error?: string}>} - Basic info about the import
 */
export const getImportPreview = async (file) => {
  try {
    const data = await importFromExcel(file);
    return {
      success: true,
      taskCount: data.tasks.length,
      exportDate: data.exportDate,
      version: data.version,
      fileName: file.name
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      fileName: file.name
    };
  }
};
