import * as ExcelJS from 'exceljs';
import { safeToISOString, isBankHoliday, isWeekend, getOwnerFromTask, getOwnerDescription, countWorkingDays, isFinalLiveTask } from '../components/ganttUtils';

/**
 * Export timeline tasks to Excel with professional formatting matching pre-refactored design
 * @param {Array} tasks - Array of timeline tasks to export
 * @param {Array} dateColumns - Array of date columns for the timeline
 * @param {Array} bankHolidays - Array of bank holiday date strings
 * @param {Date} minDate - Minimum date for timeline
 * @param {Date} maxDate - Maximum date for timeline
 */
export const exportToExcel = async (tasks, dateColumns, bankHolidays, minDate, maxDate, applicationState = {}) => {
  const workbook = new ExcelJS.Workbook();
  // Excel-safe string helper: strip control chars Excel can't store in sharedStrings
  const excelSafe = (val) => {
    if (val == null) return '';
    const s = String(val);
    // Remove ASCII control characters except tab (\x09), LF (\x0A), CR (\x0D)
    return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  };
  const safeRow = (arr) => arr.map(v => (typeof v === 'string' ? excelSafe(v) : v));
  // Prepare sheet name from client/campaign name (Excel cap 31 chars, restricted chars)
  const rawName = (applicationState.clientCampaignName || '').toString().trim();
  const safeSheetName = rawName
    ? rawName.replace(/[\\\/:\*\?\[\]]/g, ' ').slice(0, 31).trim() || 'Timeline'
    : 'Timeline';
  const worksheet = workbook.addWorksheet(safeSheetName);

  // Define colors for different owners (matching pre-refactored colors)
  const colorMap = {
    'm': { fill: '4F81BD', border: '2E5984' }, // MMM Action - Dark blue
    'c': { fill: 'F79646', border: 'E67E22' }, // Client Action - Dark orange
    'a': { fill: '9B59B6', border: '8E44AD' }, // Agency Action - Dark purple
    'l': { fill: '82B366', border: '27AE60' }  // Live Date - Dark green
  };

  const getOwnerColor = (owner) => {
    return colorMap[owner] || colorMap['m'];
  };

  let currentRow = 1;

  // 1. Add professional header with company branding
  const headerRow1 = worksheet.addRow(safeRow(['Mail METRO MEDIA']));
  headerRow1.getCell(1).font = { bold: true, size: 18, color: { argb: 'FF2E75B6' } };
  headerRow1.getCell(1).alignment = { horizontal: 'left' };
  currentRow++;

  const headerRow2 = worksheet.addRow(['']);
  currentRow++;

  // Display the exact project name provided
  const projectName = rawName || 'Project';
  const headerRow3 = worksheet.addRow(safeRow(['Project:', projectName]));
  headerRow3.getCell(1).font = { bold: true, size: 12 };
  currentRow++;

  const liveDate = maxDate.toLocaleDateString();
  const headerRow5 = worksheet.addRow(safeRow(['Live Date:', liveDate]));
  headerRow5.getCell(1).font = { bold: true, size: 12 };
  currentRow++;

  const headerRow6 = worksheet.addRow(safeRow(['Generated:', new Date().toLocaleDateString()]));
  headerRow6.getCell(1).font = { bold: true, size: 12 };
  currentRow++;

  const headerRow7 = worksheet.addRow(safeRow(['Total Tasks:', tasks.length]));
  headerRow7.getCell(1).font = { bold: true, size: 12 };
  currentRow++;

  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
  const headerRow8 = worksheet.addRow(safeRow(['Project Duration:', `${totalDays} days`]));
  headerRow8.getCell(1).font = { bold: true, size: 12 };
  currentRow++;

  const headerRow9 = worksheet.addRow(['']); // Empty row for spacing
  currentRow++;

  // 2. Add dynamic legend based on actual tasks
  const legendRow1 = worksheet.addRow(safeRow(['Legend:']));
  legendRow1.getCell(1).font = { bold: true, size: 14 };
  currentRow++;

  // Get unique owners from actual tasks
  const usedOwners = [...new Set(tasks.map(task => getOwnerFromTask(task)))];

  // Add legend rows only for owners that are actually used
  usedOwners.forEach((owner, index) => {
    const legendRow = worksheet.addRow(safeRow([getOwnerDescription(owner)]));
    const colorCell = legendRow.getCell(1);
    const colors = getOwnerColor(owner);
    colorCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + colors.fill } };
    colorCell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    };
    colorCell.font = { color: { argb: 'FFFFFFFF' } };
    currentRow++;
  });

  const legendRow6 = worksheet.addRow(['']); // Empty row for spacing
  currentRow++;

  // Store the timeline start row for asset headers
  const timelineStartRow = currentRow;

  // 3. Add timeline header rows (three-row header like the screenshot)
  const dayHeader = ['Task Name'];
  const dateHeader = [''];
  const monthHeader = [''];

  dateColumns.forEach(date => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = date.getDate();
    const monthName = date.toLocaleDateString('en-US', { month: 'short' });

    dayHeader.push(dayName);
    dateHeader.push(dayNumber.toString());
    monthHeader.push(monthName);
  });

  const dayHeaderRow = worksheet.addRow(dayHeader);
  const dateHeaderRow = worksheet.addRow(dateHeader);
  const monthHeaderRow = worksheet.addRow(monthHeader);
  currentRow += 3;

  // Style all header rows
  [dayHeaderRow, dateHeaderRow, monthHeaderRow].forEach(headerRow => {
    headerRow.height = 20; // Compact header rows
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  // 4. Group tasks by asset (prefer assetId/name; fallback to assetType)
  const groupedTasks = {};
  const selectedAssets = (applicationState.selectedAssets || []).reduce((acc, a) => {
    acc[a.id] = a;
    return acc;
  }, {});

  tasks.forEach(task => {
    const groupKey = task.assetId || task.assetType || 'Other';
    if (!groupedTasks[groupKey]) groupedTasks[groupKey] = [];
    groupedTasks[groupKey].push(task);
  });

  Object.keys(groupedTasks).forEach(groupKey => {
    const assetTasks = groupedTasks[groupKey];
    const asset = selectedAssets[groupKey];
    const headerLabel = asset?.name || assetTasks[0]?.assetType || 'Asset';

    const assetHeaderRow = worksheet.addRow(safeRow([headerLabel]));
    assetHeaderRow.height = 25;
    const assetHeaderCell = assetHeaderRow.getCell(1);
    assetHeaderCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    assetHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
    assetHeaderCell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    };
    assetHeaderCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // Merge the header cell across all date columns
    worksheet.mergeCells(assetHeaderRow.number, 1, assetHeaderRow.number, dateColumns.length + 1);
    currentRow++;

    // Add tasks for this asset
    assetTasks.forEach(task => {
      const taskRow = worksheet.addRow([]);
      taskRow.height = 20; // Compact row height

      // Set task name in first column (remove asset prefix for cleaner display)
      const taskNameCell = taskRow.getCell(1);
      const taskNameParts = task.name.split(': ');
      const cleanTaskName = taskNameParts.length > 1 ? taskNameParts[1] : task.name;
      taskNameCell.value = excelSafe(cleanTaskName);
      taskNameCell.font = { size: 10 };
      taskNameCell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
      taskNameCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      // Get colors for this task
      const owner = getOwnerFromTask(task);
      const colors = isFinalLiveTask(task) ? getOwnerColor('l') : getOwnerColor(owner);

      // Fill timeline cells for this task
      // Normalize comparisons to date-only to avoid timezone drift
      const taskStartISO = safeToISOString(new Date(task.start));
      const taskEndISO = safeToISOString(new Date(task.end));

      dateColumns.forEach((date, index) => {
        const cell = taskRow.getCell(index + 2);

        // Compare by ISO YYYY-MM-DD strings to avoid TZ issues
        const colISO = safeToISOString(date);
        if (colISO >= taskStartISO && colISO <= taskEndISO) {
          // Check if this is a final task (live tasks)
          const isFinalTask = isFinalLiveTask(task);

          // Final tasks always show in color, regular tasks only on working days
          if (isFinalTask || (!isWeekend(date) && !isBankHoliday(date, bankHolidays))) {
            // Task is active - show in proper color
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF' + colors.fill }
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF' + colors.border } },
              bottom: { style: 'thin', color: { argb: 'FF' + colors.border } },
              left: { style: 'thin', color: { argb: 'FF' + colors.border } },
              right: { style: 'thin', color: { argb: 'FF' + colors.border } }
            };
          } else {
            // Weekend or holiday within task period - show as non-working day
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
            cell.border = {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            };
          }
        } else {
          // Outside task period
          if (isWeekend(date) || isBankHoliday(date, bankHolidays)) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
          }
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          };
        }

        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      currentRow++;
    });

    // Add a small gap after each asset group
    const gapRow = worksheet.addRow(['']);
    gapRow.height = 5;
    currentRow++;
  });

  // 5. Set column widths
  worksheet.getColumn(1).width = 80; // Wide task name column
  dateColumns.forEach((_, index) => {
    worksheet.getColumn(index + 2).width = 6; // Narrow date columns
  });

  // 6. Add summary section at the bottom
  const summaryRow1 = worksheet.addRow(['']);
  const summaryRow2 = worksheet.addRow(['Summary']);
  const summaryRow3 = worksheet.addRow(['Earliest Start:', minDate.toLocaleDateString()]);
  const summaryRow4 = worksheet.addRow(['Latest End:', maxDate.toLocaleDateString()]);
  const summaryRow5 = worksheet.addRow(['Total Working Days:', dateColumns.filter(date => !isWeekend(date) && !isBankHoliday(date, bankHolidays)).length]);

  // Style summary
  summaryRow2.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF2E75B6' } };

  // Add metadata worksheet with clear warnings
  const metaSheet = workbook.addWorksheet('DO_NOT_EDIT_DATA');
  // Make it visible for testing - change back to 'hidden' later
  // metaSheet.state = 'hidden';

  // Add prominent warning message
  const warningCell = metaSheet.getCell('A1');
  warningCell.value = 'WARNING: DO NOT OVERWRITE, DO NOT DELETE, DO NOT EDIT - This data is required for timeline import. Modifying this data will prevent the timeline from being imported correctly.';
  warningCell.font = { bold: true, color: { argb: 'FFFF0000' }, size: 12 };
  warningCell.alignment = { wrapText: true };
  
  // Set column width for warning visibility
  metaSheet.getColumn(1).width = 100;
  metaSheet.getRow(1).height = 60;

  // Add empty row for separation
  metaSheet.getCell('A2').value = '';

  // Store complete timeline data for reimport
  const metadata = {
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    taskCount: tasks.length,
    timeline: tasks.map(t => ({
      ...t,
      startDate: t.start,
      endDate: t.end
    })),
    // Application state for full restoration
    selectedAssets: applicationState.selectedAssets || [],
    globalLiveDate: applicationState.globalLiveDate || maxDate.toISOString().split('T')[0],
    assetLiveDates: applicationState.assetLiveDates || {},
    useGlobalDate: applicationState.useGlobalDate !== undefined ? applicationState.useGlobalDate : true,
    customTasks: applicationState.customTasks || [],
    assetTaskDurations: applicationState.assetTaskDurations || {},
    customTaskNames: applicationState.customTaskNames || {},
    clientCampaignName: rawName || ''
  };

  // Write metadata JSON; if very large, compress to avoid sharedStrings repairs
  const jsonPlain = JSON.stringify(metadata);
  const writeMeta = async () => {
    try {
      // Deterministic: always chunk when exceeding 30,000 characters
      if (jsonPlain.length > 30000) {
        const CHUNK_SIZE = 30000;
        const parts = [];
        for (let i = 0; i < jsonPlain.length; i += CHUNK_SIZE) parts.push(jsonPlain.slice(i, i + CHUNK_SIZE));
        metaSheet.getCell('A2').value = `_META_CHUNKS:${parts.length}`;
        parts.forEach((s, idx) => metaSheet.getCell(3 + idx, 1).value = s);
      } else {
        metaSheet.getCell('A3').value = jsonPlain;
      }
    } catch {
      // Last resort: write plain JSON (Excel may repair on open for extremely large files)
      metaSheet.getCell('A3').value = jsonPlain;
    }
  };
  await writeMeta();

  // Generate and download the file
  try {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Build filename: "<name> project timeline.xlsx"
    const safeFileBase = (rawName || 'project').replace(/[^a-z0-9\-\_\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    a.download = `${safeFileBase || 'project'} project timeline.xlsx`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  } catch (err) {
    // Surface any unexpected export failure to the user
    console.error('Excel export failed:', err);
    alert('Failed to export Excel file. Please try again.');
  }
};
