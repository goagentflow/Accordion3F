import React, { useState, useRef, useEffect } from 'react';
import * as ExcelJS from 'exceljs'; // Import the new library

const GanttChart = ({ tasks, bankHolidays = [], onTaskDurationChange = () => {}, onTaskNameChange = () => {}, workingDaysNeeded = null, assetAlerts = [], onAddCustomTask = () => {}, selectedAssets = [] }) => {
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [originalDuration, setOriginalDuration] = useState(0);
  const containerRef = useRef(null);

  // Task name editing state
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskName, setEditingTaskName] = useState('');

  // Custom task modal state
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(1);
  const [newTaskOwner, setNewTaskOwner] = useState('m'); // Default to MMM
  const [newTaskAssetType, setNewTaskAssetType] = useState(''); // NEW - asset type for custom task
  const [insertAfterTask, setInsertAfterTask] = useState('');

  // Asset alerts state
  const [isAssetAlertsExpanded, setIsAssetAlertsExpanded] = useState(false);

  // --- CONFIGURATION ---

  const DAY_COLUMN_WIDTH = 48;
  const ROW_HEIGHT = 80;
  const HEADER_HEIGHT = 50;
  const TASK_NAME_WIDTH = 320;

  // Helper function to safely convert date to ISO string
  const safeToISOString = (date) => {
    if (!date || isNaN(date.getTime())) {
      console.warn('Invalid date detected in GanttChart:', date);
      return new Date().toISOString().split('T')[0]; // Return today's date as fallback
    }
    return date.toISOString().split('T')[0];
  };

  // Helper functions to check non-working days
  const isBankHoliday = (date) => {
    const dateStr = safeToISOString(date);
    return bankHolidays.includes(dateStr);
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  };

  const getColumnBackground = (date) => {
    if (isBankHoliday(date)) return 'bg-red-50';
    if (isWeekend(date)) return 'bg-gray-50';
    return 'bg-white';
  };

  // Helper function to count working days between two dates
  const countWorkingDays = (startDate, endDate) => {
    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      if (!isBankHoliday(current) && !isWeekend(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  // Helper function to add working days to a date
  const addWorkingDays = (startDate, workingDaysToAdd) => {
    if (workingDaysToAdd <= 0) {
      return new Date(startDate);
    }
    let currentDate = new Date(startDate);
    let remainingDays = workingDaysToAdd - 1;
    
    while (remainingDays > 0) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (!isBankHoliday(currentDate) && !isWeekend(currentDate)) {
        remainingDays--;
      }
    }
    
    // Ensure the final day is a working day
    while (isBankHoliday(currentDate) || isWeekend(currentDate)) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return currentDate;
  };

  // Helper function to get owner from task data
  const getOwnerFromTask = (task) => {
    // Check if task has owner property (from CSV)
    if (task.owner) {
      return task.owner;
    }
    // Fallback: try to determine owner from task name
    const taskName = task.name.toLowerCase();
    if (taskName.includes('live date') || taskName.includes('go-live') || taskName.includes('issue date') || taskName.includes('send date') || taskName.includes('live')) {
      return 'l';
    }
    if (taskName.includes('client feedback') || taskName.includes('client confirms') || taskName.includes('client sign')) {
      return 'c';
    }
    if (taskName.includes('agency') || taskName.includes('publisher') || taskName.includes('editorial')) {
      return 'a';
    }
    // Default to MMM for most tasks
    return 'm';
  };

  // Helper function to get description for owner
  const getOwnerDescription = (owner) => {
    const descriptions = {
      'm': 'MMM Action',
      'c': 'Client Action',
      'a': 'Client/Agency Action',
      'l': 'Live Date'
    };
    return descriptions[owner] || 'Task';
  };

  // Helper function to get CSS color classes for owner
  const getOwnerColorClasses = (owner) => {
    const colorClasses = {
      'm': 'bg-blue-500', // MMM Action - Blue
      'c': 'bg-orange-500', // Client Action - Orange
      'a': 'bg-purple-500', // Client/Agency Action - Purple
      'l': 'bg-green-500'  // Live Date - Green
    };
    return colorClasses[owner] || colorClasses['m']; // Default to MMM if no owner found
  };

  // Helper function to get CSS color classes for owner (darker variant for borders/handles)
  const getOwnerColorClassesDark = (owner) => {
    const colorClasses = {
      'm': 'bg-blue-600', // MMM Action - Darker Blue
      'c': 'bg-orange-600', // Client Action - Darker Orange
      'a': 'bg-purple-600', // Client/Agency Action - Darker Purple
      'l': 'bg-green-600'  // Live Date - Darker Green
    };
    return colorClasses[owner] || colorClasses['m']; // Default to MMM if no owner found
  };

  // --- DATE CALCULATIONS ---
  const startDates = tasks.map(task => {
    const date = new Date(task.start);
    return isNaN(date.getTime()) ? new Date() : date;
  });
  const endDates = tasks.map(task => {
    const date = new Date(task.end);
    return isNaN(date.getTime()) ? new Date() : date;
  });
  
  // Handle case where no valid dates exist
  if (startDates.length === 0 || endDates.length === 0) {
    console.warn('No valid dates found in tasks:', tasks);
    return <div className="text-center text-gray-500 p-8">No valid tasks to display</div>;
  }
  
  const minDate = new Date(Math.min(...startDates));
  const maxDate = new Date(Math.max(...endDates));
  
  // Validate minDate and maxDate
  if (isNaN(minDate.getTime()) || isNaN(maxDate.getTime())) {
    console.warn('Invalid minDate or maxDate calculated:', { minDate, maxDate, startDates, endDates });
    return <div className="text-center text-gray-500 p-8">Error calculating timeline dates</div>;
  }
  
  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
  const dateColumns = Array.from({ length: totalDays }, (_, i) => {
    const date = new Date(minDate);
    date.setDate(minDate.getDate() + i);
    return date;
  });

  // Mouse event handlers for drag functionality
  const handleMouseDown = (e, taskId, taskStart, taskEnd) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isRightEdge = e.clientX > rect.right - 15; // 15px from right edge
    
    if (isRightEdge) {
      setIsDragging(true);
      setDraggedTaskId(taskId);
      setDragStartX(e.clientX);
      
      const startDate = new Date(taskStart);
      const endDate = new Date(taskEnd);
      const duration = countWorkingDays(startDate, endDate);
      setOriginalDuration(duration);
      
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !draggedTaskId) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaDays = Math.round(deltaX / DAY_COLUMN_WIDTH);
    
    // Find the task being dragged
    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task) return;
    
    const newDuration = Math.max(1, originalDuration + deltaDays); // Minimum 1 day
    
    // Calculate new end date based on working days
    const startDate = new Date(task.start);
    const newEndDate = addWorkingDays(startDate, newDuration);
    
    // Call the callback to update the task
    onTaskDurationChange(draggedTaskId, newDuration, safeToISOString(newEndDate));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedTaskId(null);
    setDragStartX(0);
    setOriginalDuration(0);
  };

  const handleMouseMoveOverTask = (e) => {
    if (!isDragging) {
      const rect = e.currentTarget.getBoundingClientRect();
      const isRightEdge = e.clientX > rect.right - 15;
      if (isRightEdge) {
        e.currentTarget.style.cursor = 'ew-resize';
      } else {
        e.currentTarget.style.cursor = 'pointer';
      }
    }
  };

  const handleMouseLeave = (e) => {
    if (!isDragging) {
      e.currentTarget.style.cursor = 'pointer';
    }
  };

  // Task name editing handlers
  const handleTaskNameClick = (taskId, currentName) => {
    setEditingTaskId(taskId);
    setEditingTaskName(currentName);
  };

  const handleTaskNameSave = () => {
    if (editingTaskName.trim()) {
      onTaskNameChange(editingTaskId, editingTaskName.trim());
    }
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const handleTaskNameCancel = () => {
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const handleTaskNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTaskNameSave();
    } else if (e.key === 'Escape') {
      handleTaskNameCancel();
    }
  };

  // Custom task modal handlers
  const handleOpenAddTaskModal = () => {
    setShowAddTaskModal(true);
    setNewTaskName('');
    setNewTaskDuration(1);
    setNewTaskOwner('m'); // Default to MMM
    setNewTaskAssetType(''); // Reset asset type
    setInsertAfterTask('');
  };

  const handleCloseAddTaskModal = () => {
    setShowAddTaskModal(false);
    setNewTaskName('');
    setNewTaskDuration(1);
    setNewTaskOwner('m');
    setNewTaskAssetType(''); // Reset asset type
    setInsertAfterTask('');
  };

  const handleSubmitCustomTask = () => {
    if (!newTaskName.trim() || newTaskDuration < 1 || !newTaskAssetType) {
      return;
    }

    onAddCustomTask({
      name: newTaskName.trim(),
      duration: newTaskDuration,
      owner: newTaskOwner,
      assetType: newTaskAssetType, // Pass the asset type
      insertAfterTaskId: insertAfterTask
    });

    handleCloseAddTaskModal();
  };

  // Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, draggedTaskId, dragStartX, originalDuration]);

  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10">
        <p className="text-lg">Your timeline will appear here.</p>
        <p className="text-sm">Set a start date and select some assets to begin.</p>
      </div>
    );
  }

  const exportToExcel = async () => {
    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Timeline');

    // Define colors for different owners - darker and more vibrant
    const colorMap = {
      'm': { fill: '4F81BD', border: '2E5984' }, // MMM Action - Dark blue
      'c': { fill: 'F79646', border: 'E67E22' }, // Client Action - Dark orange
      'a': { fill: '9B59B6', border: '8E44AD' }, // Client/Agency Action - Dark purple
      'l': { fill: '82B366', border: '27AE60' }  // Live Date - Dark green
    };

    // Helper function to get color for owner
    const getOwnerColor = (owner) => {
      return colorMap[owner] || colorMap['m']; // Default to MMM if no owner found
    };

    

    // 1. Add professional header with client branding
    const headerRow1 = worksheet.addRow(['Mail METRO MEDIA']);
    const headerRow2 = worksheet.addRow(['']);
    const headerRow3 = worksheet.addRow(['Client:', 'Your Client Name']);
    const headerRow4 = worksheet.addRow(['Campaign Name:', '']);
    // Calculate live date from the latest task end date
    const liveDate = maxDate.toLocaleDateString();
    const headerRow5 = worksheet.addRow(['Live Date:', liveDate]);
    const headerRow6 = worksheet.addRow(['Generated:', new Date().toLocaleDateString()]);
    const headerRow7 = worksheet.addRow(['Total Tasks:', tasks.length]);
    const headerRow8 = worksheet.addRow(['Project Duration:', `${totalDays} days`]);
    const headerRow9 = worksheet.addRow(['']); // Empty row for spacing

    // Style header
    headerRow1.getCell(1).font = { bold: true, size: 18, color: { argb: 'FF2E75B6' } };
    headerRow1.getCell(1).alignment = { horizontal: 'left' };
    headerRow3.getCell(1).font = { bold: true, size: 12 };
    headerRow4.getCell(1).font = { bold: true, size: 12 };
    headerRow5.getCell(1).font = { bold: true, size: 12 };

    // 2. Add dynamic legend based on actual tasks
    const legendRow1 = worksheet.addRow(['Legend:']);
    
    // Get unique owners from actual tasks
    const usedOwners = [...new Set(tasks.map(task => getOwnerFromTask(task)))];
    
    // Add legend rows only for owners that are actually used
    usedOwners.forEach((owner, index) => {
      const legendRow = worksheet.addRow([getOwnerDescription(owner)]);
      const colorCell = legendRow.getCell(1);
      colorCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + colorMap[owner].fill } };
      colorCell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    const legendRow6 = worksheet.addRow(['']); // Empty row for spacing

    // Style legend header
    legendRow1.getCell(1).font = { bold: true, size: 14 };

    // 3. Add timeline header rows (three-row header like their format)
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

    // 4. Group tasks by asset type and add them with headers
    const groupedTasks = {};
    
    // Group tasks by asset type
    tasks.forEach(task => {
      // Use explicit assetType property if available, otherwise fall back to name parsing
      const assetType = task.assetType || 'Other';
      if (!groupedTasks[assetType]) {
        groupedTasks[assetType] = [];
      }
      groupedTasks[assetType].push(task);
    });

    // Add tasks grouped by asset type
    Object.keys(groupedTasks).forEach(assetType => {
      const assetTasks = groupedTasks[assetType];
      
      // Add asset type header row
      const assetHeaderRow = worksheet.addRow([assetType]);
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
      
      // Add tasks for this asset type
      assetTasks.forEach(task => {
        const taskRow = worksheet.addRow([]);
        
        // Set row height for compact display
        taskRow.height = 20; // Reduced for more compact rows
        
        // Set task name in first column (remove asset prefix for cleaner display)
        const taskNameCell = taskRow.getCell(1);
        // Extract just the task part after the colon
        const taskNameParts = task.name.split(': ');
        const cleanTaskName = taskNameParts.length > 1 ? taskNameParts[1] : task.name;
        taskNameCell.value = cleanTaskName;
        taskNameCell.font = { size: 12 };
        taskNameCell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
        taskNameCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        // Get colors for this task
        const colors = getOwnerColor(getOwnerFromTask(task));
        
        // Fill timeline cells for this task
        const taskStart = new Date(task.start);
        const taskEnd = new Date(task.end);
        
        dateColumns.forEach((date, index) => {
          const cell = taskRow.getCell(index + 2); // +2 because we have 3 header rows now
          
          if (date >= taskStart && date <= taskEnd) {
            // Check if this is a final task (go-live, live date, etc.)
            const isFinalTask = task.name.toLowerCase().includes('go-live') || 
                               task.name.toLowerCase().includes('live date') ||
                               task.name.toLowerCase().includes('issue date') ||
                               task.name.toLowerCase().includes('send date') ||
                               task.name.toLowerCase().includes('live');
            
            // Final tasks always show in their proper color, regardless of working days
            // Regular tasks only show color on working days
            if (isFinalTask || (!isWeekend(date) && !isBankHoliday(date))) {
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
              // Weekend or holiday within regular task period - show as non-working day
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
            if (isWeekend(date) || isBankHoliday(date)) {
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
      });
      
      // Add a small gap after each asset group
      const gapRow = worksheet.addRow(['']);
      gapRow.height = 5;
    });

    // 5. Set column widths and row heights
    worksheet.getColumn(1).width = 80; // Wider column to avoid text wrapping
    dateColumns.forEach((_, index) => {
      worksheet.getColumn(index + 2).width = 6; // Narrower date columns for better density
    });

    // 6. Add summary section at the bottom
    const summaryRow1 = worksheet.addRow(['']);
    const summaryRow2 = worksheet.addRow(['Summary']);
    const summaryRow3 = worksheet.addRow(['Earliest Start:', minDate.toLocaleDateString()]);
    const summaryRow4 = worksheet.addRow(['Latest End:', maxDate.toLocaleDateString()]);
    const summaryRow5 = worksheet.addRow(['Total Working Days:', dateColumns.filter(date => !isWeekend(date) && !isBankHoliday(date)).length]);

    // Style summary
    summaryRow2.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF2E75B6' } };

    // 7. Add machine-readable data sheet for AI processing
    const dataWorksheet = workbook.addWorksheet('Data');
    
    // Add project metadata
    dataWorksheet.addRow(['Project Metadata']);
    dataWorksheet.addRow(['Generated Date', new Date().toISOString()]);
    dataWorksheet.addRow(['Total Tasks', tasks.length]);
    dataWorksheet.addRow(['Project Start', safeToISOString(minDate)]);
    dataWorksheet.addRow(['Project End', safeToISOString(maxDate)]);
    dataWorksheet.addRow(['Total Days', totalDays]);
    dataWorksheet.addRow(['Working Days', dateColumns.filter(date => !isWeekend(date) && !isBankHoliday(date)).length]);
    dataWorksheet.addRow(['']); // Empty row
    
    // Add tasks data in structured format
    dataWorksheet.addRow(['Tasks Data']);
    dataWorksheet.addRow(['Task ID', 'Task Name', 'Asset Type', 'Owner', 'Start Date', 'End Date', 'Duration (Days)', 'Is Custom', 'Progress']);
    
    tasks.forEach(task => {
      // Use explicit assetType property if available, otherwise fall back to name parsing
      const assetType = task.assetType || 'Other';
      const taskNameParts = task.name.split(': ');
      const cleanTaskName = taskNameParts.length > 1 ? taskNameParts[1] : task.name;
      
      // Calculate duration - for single-day tasks or final tasks (go-live equivalent), use calendar days
      let duration;
      const startDate = new Date(task.start);
      const endDate = new Date(task.end);
      const isSingleDay = startDate.toDateString() === endDate.toDateString();
      const isFinalTask = task.name.toLowerCase().includes('go-live') || 
                         task.name.toLowerCase().includes('live date') ||
                         task.name.toLowerCase().includes('issue date') ||
                         task.name.toLowerCase().includes('send date') ||
                         task.name.toLowerCase().includes('live');
      
      if (isSingleDay || isFinalTask) {
        // For single-day tasks or final tasks (go-live equivalent), use calendar days (1 day)
        duration = 1;
      } else {
        // For multi-day tasks, use working days
        duration = countWorkingDays(startDate, endDate);
      }
      
      dataWorksheet.addRow([
        task.id,
        cleanTaskName,
        assetType,
        getOwnerFromTask(task),
        task.start,
        task.end,
        duration,
        task.isCustom ? 'Yes' : 'No',
        task.progress || 0
      ]);
    });

    // 8. Generate and download the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `professional_timeline_${safeToISOString(new Date())}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };



  return (
    <div className="w-full">
      {/* Summary Header */}
      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-800">Project Gantt Chart</h3>
            <p className="text-sm text-blue-600">
              {tasks.length} tasks • {totalDays} days total • {minDate.toLocaleDateString()} to {maxDate.toLocaleDateString()}
            </p>
            <p className="text-xs text-blue-500 mt-1">
              💡 Click on any task name to edit it
            </p>
          </div>
          <button
            onClick={handleOpenAddTaskModal}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center"
          >
            <span className="mr-2">➕</span>
            Add Task
          </button>
        </div>
      </div>

      {/* Main Scrollable Container */}
      {/* ... (The Gantt chart display JSX remains the same) ... */}
      <div className="overflow-auto border border-gray-300 rounded-lg" style={{ maxHeight: '75vh' }}>
        <div className="relative min-w-max">
          {/* HEADER ROW */}
          <div className="flex" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
            {/* Top-left cell: sticky both top and left */}
            <div
              className="p-3 border-b border-r border-gray-300 font-semibold text-gray-700 bg-white flex items-center"
              style={{
                width: `${TASK_NAME_WIDTH}px`,
                minWidth: `${TASK_NAME_WIDTH}px`,
                position: 'sticky',
                left: 0,
                top: 0,
                zIndex: 40,
                background: 'white',
              }}
            >
              Task Name
            </div>
            {/* Date headers: sticky top only */}
            {dateColumns.map((date, index) => {
              // Array of day abbreviations, starting with Sunday
              const dayAbbr = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];
              // Get the day abbreviation for this date
              const day = dayAbbr[date.getDay()];
              // Get the day of the month (number)
              const dayOfMonth = date.getDate();
              // Get the month abbreviation (e.g., Aug)
              const month = date.toLocaleString('en', { month: 'short' });
              // Format: M 4 Aug, Tu 5 Aug, etc.
              const formatted = `${day} ${dayOfMonth} ${month}`;
              return (
                <div
                  key={index}
                  className={`p-1 text-xs text-center border-b border-r border-gray-200 flex flex-col justify-center ${getColumnBackground(date)}`}
                  style={{
                    width: `${DAY_COLUMN_WIDTH}px`,
                    minWidth: `${DAY_COLUMN_WIDTH}px`,
                    position: 'sticky',
                    top: 0,
                    zIndex: 30,
                    background: 'white',
                  }}
                >
                  {/* Show the formatted date with day abbreviation */}
                  <div className="font-medium">
                    {formatted}
                    {isBankHoliday(date) && (
                      <span className="ml-1 text-red-500" title="Bank Holiday">🏦</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Color Legend */}
          <div className="flex items-center justify-center py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span>Client Action</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>MMM Action</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span>Client/Agency Action</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>Live Date</span>
              </div>
            </div>
          </div>
          
          {/* TASK ROWS */}
          {tasks.map((task) => {
            const taskStart = new Date(task.start);
            const taskEnd = new Date(task.end);
            
            // Handle invalid dates by providing fallbacks
            if (isNaN(taskStart.getTime()) || isNaN(taskEnd.getTime())) {
              console.warn(`Invalid dates for task ${task.id}:`, { start: task.start, end: task.end });
              // Use fallback dates instead of skipping the task
              const fallbackDate = new Date();
              const taskStartFixed = isNaN(taskStart.getTime()) ? fallbackDate : taskStart;
              const taskEndFixed = isNaN(taskEnd.getTime()) ? fallbackDate : taskEnd;
              
              return (
                <div key={task.id} className="group flex" style={{ height: `${ROW_HEIGHT}px` }}>
                  <div className="p-3 border-b border-r border-gray-300 font-semibold text-gray-700 bg-white flex items-center" style={{ width: `${TASK_NAME_WIDTH}px` }}>
                    <div className="text-red-500 text-sm">
                      {task.name} (Invalid dates - please check task configuration)
                    </div>
                  </div>
                </div>
              );
            }
            
            const startOffsetDays = Math.floor((taskStart - minDate) / (1000 * 60 * 60 * 24));
            
            // Calculate duration - for single-day tasks or final tasks (go-live equivalent), use calendar days
            let durationDays;
            const isSingleDay = taskStart.toDateString() === taskEnd.toDateString();
            const isFinalTask = task.name.toLowerCase().includes('go-live') || 
                               task.name.toLowerCase().includes('live date') ||
                               task.name.toLowerCase().includes('issue date') ||
                               task.name.toLowerCase().includes('send date') ||
                               task.name.toLowerCase().includes('live');
            
            if (isSingleDay || isFinalTask) {
              // For single-day tasks or final tasks (go-live equivalent), use calendar days (1 day)
              durationDays = 1;
            } else {
              // For multi-day tasks, use working days
              durationDays = countWorkingDays(taskStart, taskEnd);
            }
            
            const durationText = durationDays;
            
            // Create display name with asset prefix
            const displayName = task.assetType && task.assetType !== 'Other' 
              ? `${task.assetType}: ${task.name}` 
              : task.name;
            
            return (
              <div key={task.id} className="group flex" style={{ height: `${ROW_HEIGHT}px` }}>
                {/* Task name column: sticky left only */}
                <div
                  className="p-3 border-b border-r border-gray-300 font-semibold text-gray-700 bg-white flex items-center"
                  style={{
                    width: `${TASK_NAME_WIDTH}px`,
                    minWidth: `${TASK_NAME_WIDTH}px`,
                    position: 'sticky',
                    left: 0,
                    zIndex: 20,
                    background: 'white',
                  }}
                >
                  <div className="flex flex-col w-full">
                    {editingTaskId === task.id ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          value={editingTaskName}
                          onChange={(e) => setEditingTaskName(e.target.value)}
                          onKeyDown={handleTaskNameKeyDown}
                          onBlur={handleTaskNameSave}
                          className="text-sm border rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={handleTaskNameSave}
                          className="text-xs bg-green-500 text-white px-1 py-1 rounded hover:bg-green-600"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleTaskNameCancel}
                          className="text-xs bg-gray-500 text-white px-1 py-1 rounded hover:bg-gray-600"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="font-medium text-gray-800 text-sm leading-tight whitespace-normal cursor-pointer hover:bg-blue-50 px-1 py-1 rounded"
                        onClick={() => handleTaskNameClick(task.id, task.name)}
                        title="Click to edit task name"
                      >
                        <div className="flex items-center">
                          <span>{displayName}</span>
                          <span className="ml-2 text-xs text-gray-400" title="Click to edit">
                            ✏️
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">{durationText} day{durationText !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                {/* Gantt bars and grid */}
                <div className="relative border-b border-gray-200" style={{ width: `${dateColumns.length * DAY_COLUMN_WIDTH}px` }}>
                  <div className="flex h-full">
                    {dateColumns.map((date, colIndex) => (
                      <div 
                        key={colIndex} 
                        className={`border-r border-gray-200 ${getColumnBackground(date)}`}
                        style={{ width: `${DAY_COLUMN_WIDTH}px`, minWidth: `${DAY_COLUMN_WIDTH}px` }} 
                      />
                    ))}
                  </div>
                  {/* Render task bars for each working day */}
                  {(() => {
                    const bars = [];
                    let currentDate = new Date(taskStart);
                    let workingDaysCounted = 0;
                    
                    // For single-day or final tasks, render on the exact date regardless of working days
                    if (isSingleDay || isFinalTask) {
                      const dayOffset = Math.floor((currentDate - minDate) / (1000 * 60 * 60 * 24));
                      const owner = getOwnerFromTask(task);
                      const ownerColorClasses = getOwnerColorClasses(owner);
                      const ownerColorClassesDark = getOwnerColorClassesDark(owner);

                      bars.push(
                        <div
                          key={`${task.id}-${safeToISOString(currentDate)}`}
                          className={`absolute top-1/2 -translate-y-1/2 h-10 ${ownerColorClasses} rounded shadow-sm flex items-center justify-start px-2 cursor-pointer transition-all ${
                            isDragging && draggedTaskId === task.id ? 'ring-2 ring-opacity-50 shadow-lg' : ''
                          }`}
                          style={{
                            left: `${dayOffset * DAY_COLUMN_WIDTH}px`,
                            width: `${DAY_COLUMN_WIDTH}px`,
                          }}
                          onMouseDown={(e) => handleMouseDown(e, task.id, task.start, task.end)}
                          onMouseMove={handleMouseMoveOverTask}
                          onMouseLeave={handleMouseLeave}
                        >
                          {workingDaysCounted === 0 && (
                            <span className="text-white text-xs font-medium truncate">{task.name}</span>
                          )}
                          {/* Drag handle indicator on the last working day */}
                          {workingDaysCounted === durationDays - 1 && (
                            <div className={`absolute right-0 top-0 bottom-0 w-2 ${ownerColorClassesDark} rounded-r opacity-0 hover:opacity-100 transition-opacity cursor-ew-resize`}>
                              <div className="absolute right-1 top-1/2 transform -translate-y-1/2 text-white text-xs">⋮</div>
                            </div>
                          )}
                        </div>
                      );
                      workingDaysCounted++;
                    } else {
                      while (currentDate <= taskEnd && workingDaysCounted < durationDays) {
                        if (!isBankHoliday(currentDate) && !isWeekend(currentDate)) {
                          const dayOffset = Math.floor((currentDate - minDate) / (1000 * 60 * 60 * 24));
                          const owner = getOwnerFromTask(task);
                          const ownerColorClasses = getOwnerColorClasses(owner);
                          const ownerColorClassesDark = getOwnerColorClassesDark(owner);

                          bars.push(
                            <div
                              key={`${task.id}-${safeToISOString(currentDate)}`}
                              className={`absolute top-1/2 -translate-y-1/2 h-10 ${ownerColorClasses} rounded shadow-sm flex items-center justify-start px-2 cursor-pointer transition-all ${
                                isDragging && draggedTaskId === task.id ? 'ring-2 ring-opacity-50 shadow-lg' : ''
                              }`}
                              style={{
                                left: `${dayOffset * DAY_COLUMN_WIDTH}px`,
                                width: `${DAY_COLUMN_WIDTH}px`,
                              }}
                              onMouseDown={(e) => handleMouseDown(e, task.id, task.start, task.end)}
                              onMouseMove={handleMouseMoveOverTask}
                              onMouseLeave={handleMouseLeave}
                            >
                              {workingDaysCounted === 0 && (
                                <span className="text-white text-xs font-medium truncate">{task.name}</span>
                              )}
                              {/* Drag handle indicator on the last working day */}
                              {workingDaysCounted === durationDays - 1 && (
                                <div className={`absolute right-0 top-0 bottom-0 w-2 ${ownerColorClassesDark} rounded-r opacity-0 hover:opacity-100 transition-opacity cursor-ew-resize`}>
                                  <div className="absolute right-1 top-1/2 transform -translate-y-1/2 text-white text-xs">⋮</div>
                                </div>
                              )}
                            </div>
                          );
                          workingDaysCounted++;
                        }
                        currentDate.setDate(currentDate.getDate() + 1);
                      }
                    }
                    return bars;
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Asset-Level Timeline Alerts */}
      {assetAlerts && assetAlerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-red-300 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-base font-semibold text-gray-800">
              ⚠️ Timeline Alerts ({assetAlerts.length} assets)
            </div>
            <button
              onClick={() => setIsAssetAlertsExpanded(!isAssetAlertsExpanded)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              {isAssetAlertsExpanded ? '▼' : '▶'}
            </button>
          </div>
          
          {isAssetAlertsExpanded ? (
            <div className="space-y-2">
              {assetAlerts.map((alert, index) => (
                <div key={alert.assetId} className={`p-2 rounded border-l-4 ${
                  alert.isCritical ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-800">
                      {alert.assetName}
                    </div>
                    <div className={`text-sm font-bold ${
                      alert.isCritical ? 'text-red-600' : 'text-orange-600'
                    }`}>
                      {alert.daysNeeded} day{alert.daysNeeded !== 1 ? 's' : ''} needed
                    </div>
                  </div>
                  <div className="mt-1">
                    <div className="flex items-center space-x-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            alert.isCritical ? 'bg-red-500' : 'bg-orange-500'
                          }`}
                          style={{ width: `${Math.min(100, (alert.daysNeeded / 10) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {alert.daysNeeded}/10
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-lg font-bold text-red-600 mb-2">
              {workingDaysNeeded.needed} day{workingDaysNeeded.needed !== 1 ? 's' : ''} need to be saved
            </div>
          )}
          
          <div className="text-sm text-gray-600 mt-2">
            {isAssetAlertsExpanded ? 'Click on any asset to focus on its tasks' : 'Click to see details by asset'}
          </div>
        </div>
      )}

      {/* Fallback: Original Timeline Alert for backward compatibility */}
      {(!assetAlerts || assetAlerts.length === 0) && workingDaysNeeded && workingDaysNeeded.needed > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-red-300 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="text-base font-semibold text-gray-800 mb-2">
            ⚠️ Timeline Alert
          </div>
          <div className="text-lg font-bold text-red-600 mb-2">
            {workingDaysNeeded.needed} day{workingDaysNeeded.needed !== 1 ? 's' : ''} need to be saved
          </div>
          <div className="text-sm text-gray-600">
            Adjust task durations to start on time
          </div>
        </div>
      )}

      {/* Floating Working Days Indicator (shown while dragging) */}
      {isDragging && workingDaysNeeded && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-w-xs">
          <div className="text-sm font-medium text-gray-700 mb-1">
            Timeline Status
          </div>
          <div className={`text-sm ${
            workingDaysNeeded.needed > 0
              ? 'text-red-600'
              : workingDaysNeeded.needed < 0
              ? 'text-green-600'
              : 'text-blue-600'
          }`}>
            {workingDaysNeeded.needed > 0 ? (
              <span>⚠️ {workingDaysNeeded.needed} day{workingDaysNeeded.needed !== 1 ? 's' : ''} need to be saved</span>
            ) : workingDaysNeeded.needed < 0 ? (
              <span>✅ {Math.abs(workingDaysNeeded.needed)} day{Math.abs(workingDaysNeeded.needed) !== 1 ? 's' : ''} to spare</span>
            ) : (
              <span>🎯 You're on target</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Available: {workingDaysNeeded.available} | Allocated: {workingDaysNeeded.allocated}
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="mt-6 p-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Export Timeline</h4>
        <div className="flex space-x-3">
          <button 
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
          >
            📊 Export Professional Timeline
          </button>
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors"
          >
            🖨️ Print Timeline
          </button>
        </div>
      </div>

      {/* Add Custom Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Add Custom Task</h3>
              <button
                onClick={handleCloseAddTaskModal}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Name *
                </label>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="e.g., Source talent, Organise translation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (working days) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={newTaskDuration}
                  onChange={(e) => setNewTaskDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner *
                </label>
                <select
                  value={newTaskOwner}
                  onChange={(e) => setNewTaskOwner(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="m">MMM</option>
                  <option value="c">Client</option>
                  <option value="a">Client/Agency</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asset Type *
                </label>
                <select
                  value={newTaskAssetType}
                  onChange={(e) => {
                    setNewTaskAssetType(e.target.value);
                    setInsertAfterTask(''); // Clear the "Insert After" selection when asset type changes
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select an asset type</option>
                  {selectedAssets.map((asset, index) => (
                    <option key={asset.id} value={asset.name}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insert After
                  {!newTaskAssetType && <span className="text-gray-500 text-xs"> (Select asset type first)</span>}
                </label>
                <select
                  value={insertAfterTask}
                  onChange={(e) => setInsertAfterTask(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!newTaskAssetType}
                >
                  <option value="">At the beginning</option>
                  {newTaskAssetType && tasks
                    .filter(task => task.assetType === newTaskAssetType)
                    .map((task, index) => (
                      <option key={task.id} value={task.id}>
                        {task.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleCloseAddTaskModal}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCustomTask}
                disabled={!newTaskName.trim() || !newTaskAssetType}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GanttChart;