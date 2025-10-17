import React from 'react';
import * as XLSX from 'xlsx';
import { Calendar, Download, AlertTriangle, Clock, CheckCircle, FileText } from 'lucide-react';
import GanttChart from './GanttChart';

const TimelineDisplay = ({ timeline, selectedAssets, formatDate }) => {

  const exportToExcel = () => {
    if (!timeline) return;

    // 1. Create the detailed timeline worksheet
    const timelineSheetData = timeline.items.map(item => ({
      Category: item.category,
      'Asset Type': item.assetType,
      Task: item.task,
      'Start Date': item.startDate,
      'End Date': item.endDate,
      'Duration (Days)': item.duration,
      'Original Duration': item.originalDuration,
      Compressed: item.compressed ? 'Yes' : 'No',
      Priority: item.priority.charAt(0).toUpperCase() + item.priority.slice(1)
    }));
    const timelineWorksheet = XLSX.utils.json_to_sheet(timelineSheetData);
    // Set date format for date columns
    const dateCols = [3, 4]; // D and E columns (0-indexed)
    timelineWorksheet['!cols'] = [
        { wch: 20 }, { wch: 25 }, { wch: 40 }, { wch: 15 },
        { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }
    ];
    // This part requires a bit more advanced usage to set cell formats,
    // but the basics are handled by Excel interpreting the Date objects.

    // 2. Create a summary sheet
    const summaryData = [{
      'Project Start Date': formatDate(timeline.startDate),
      'Projected End Date': formatDate(timeline.endDate),
      'Total Duration (Days)': timeline.totalDuration,
      'Conflicts': timeline.conflicts.map(c => c.message).join('; ') || 'None'
    }];
    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    summaryWorksheet['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 50 }];


    // 3. Create the workbook and add the sheets
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Summary");
    XLSX.utils.book_append_sheet(workbook, timelineWorksheet, "Detailed Timeline");

    // 4. Trigger the download
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    XLSX.writeFile(workbook, `campaign_timeline_${dateStr}.xlsx`);
  };

  if (!timeline) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Timeline Generated</h3>
        <p className="text-gray-600">Configure your project settings and select assets to generate a timeline.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
        {/* ... The JSX for the Header, Export Button, Conflicts, and Summary cards ... */}
        {/* This can be copied directly from the original file's "Right Panel" section */}

        {/* The New Gantt Chart Component */}
        <GanttChart items={timeline.items} assets={selectedAssets} />

        {/* The Detailed Task List (same as before) */}
        {/* ... The JSX for the "Timeline Items by Asset" section ... */}
    </div>
  );
};
// NOTE: You need to copy the full JSX for the summary cards and detailed list
// from your original file into the sections marked with comments above.

export default TimelineDisplay;