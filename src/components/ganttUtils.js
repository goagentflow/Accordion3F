// Gantt Chart Utility Functions

// Configuration constants
export const GANTT_CONFIG = {
  DAY_COLUMN_WIDTH: 48,
  ROW_HEIGHT: 80,
  HEADER_HEIGHT: 50,
  TASK_NAME_WIDTH: 320
};

// Helper function to safely convert date to ISO string
export const safeToISOString = (date) => {
  if (!date || isNaN(date.getTime())) {
    console.warn('Invalid date detected in GanttChart:', date);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Check if date is a bank holiday
export const isBankHoliday = (date, bankHolidays = []) => {
  const dateStr = safeToISOString(date);
  return bankHolidays.includes(dateStr);
};

// Check if date is weekend
export const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

// Get column background class based on date type
export const getColumnBackground = (date, bankHolidays = []) => {
  if (isBankHoliday(date, bankHolidays)) return 'bg-red-50';
  if (isWeekend(date)) return 'bg-gray-50';
  return 'bg-white';
};

// Count working days between two dates
export const countWorkingDays = (startDate, endDate, bankHolidays = []) => {
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return 0;
  }
  
  let count = 0;
  let current = new Date(startDate);
  
  while (current <= endDate) {
    if (!isWeekend(current) && !isBankHoliday(current, bankHolidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
};

// Add working days to a date
export const addWorkingDays = (startDate, workingDaysToAdd, bankHolidays = []) => {
  if (!startDate || isNaN(startDate.getTime())) {
    return new Date();
  }
  
  const result = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < workingDaysToAdd) {
    result.setDate(result.getDate() + 1);
    
    if (!isWeekend(result) && !isBankHoliday(result, bankHolidays)) {
      daysAdded++;
    }
    
    if (result.getFullYear() > startDate.getFullYear() + 2) {
      console.error('addWorkingDays exceeded safety limit');
      break;
    }
  }
  
  return result;
};

// Get the next working day on/after a given date

// Get owner from task
export const getOwnerFromTask = (task) => {
  if (!task) return 'm';
  
  if (task.owner) {
    // First check if it's already a direct code from CSV
    if (['c', 'm', 'a', 'l'].includes(task.owner)) {
      return task.owner;
    }
    
    // Fallback to text parsing for backward compatibility
    const ownerLower = task.owner.toLowerCase();
    if (ownerLower.includes('client') && ownerLower.includes('agency')) return 'ca';
    if (ownerLower.includes('client') && ownerLower.includes('mmm')) return 'ca';
    if (ownerLower.includes('client')) return 'c';
    if (ownerLower.includes('agency')) return 'a';
    if (ownerLower.includes('mmm')) return 'm';
    return 'm';
  }
  
  return 'm';
};

// Get owner description
export const getOwnerDescription = (owner) => {
  switch(owner) {
    case 'c': return 'Client';
    case 'm': return 'MMM';
    case 'a': return 'Client/Agency';
    case 'l': return 'Live Date';
    case 'ca': return 'Client/Agency';
    default: return 'MMM';
  }
};

// Get owner color classes
export const getOwnerColorClasses = (owner) => {
  switch(owner) {
    case 'c': return 'bg-orange-500 border-orange-600';
    case 'm': return 'bg-blue-500 border-blue-600';
    case 'a': return 'bg-purple-500 border-purple-600';
    case 'l': return 'bg-green-500 border-green-600';
    case 'ca': return 'bg-purple-500 border-purple-600';
    default: return 'bg-blue-500 border-blue-600';
  }
};

// Get owner color classes (dark version)
export const getOwnerColorClassesDark = (owner) => {
  switch(owner) {
    case 'c': return 'bg-orange-600 border-orange-700';
    case 'm': return 'bg-blue-600 border-blue-700';
    case 'a': return 'bg-purple-600 border-purple-700';
    case 'l': return 'bg-green-600 border-green-700';
    case 'ca': return 'bg-purple-600 border-purple-700';
    default: return 'bg-blue-600 border-blue-700';
  }
};

// Generate date columns for timeline
export const generateDateColumns = (minDate, maxDate) => {
  const columns = [];
  const current = new Date(minDate);
  
  while (current <= maxDate) {
    columns.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return columns;
};

// Calculate task position and width
export const calculateTaskPosition = (task, minDate) => {
  // Create Date objects from the date strings
  const startDate = new Date(task.start);
  const endDate = new Date(task.end);

  // Ensure dates are valid before doing math
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { left: 0, width: 0 };
  }

  const startOffset = Math.floor((startDate - minDate) / (1000 * 60 * 60 * 24));
  const endOffset = Math.floor((endDate - minDate) / (1000 * 60 * 60 * 24));
  const spanDays = endOffset - startOffset + 1;

  return {
    left: startOffset * GANTT_CONFIG.DAY_COLUMN_WIDTH,
    width: spanDays * GANTT_CONFIG.DAY_COLUMN_WIDTH,
  };
};

// Check if asset type requires Sunday-only go-live dates
export const isSundayOnlyAsset = (assetType) => {
  const sundayOnlyAssets = [
    'Print - Supplements Full Page',
    'Weekend Sunday Supplement Full Page',
    'You Sunday Supplement Full Page'
  ];
  return sundayOnlyAssets.includes(assetType);
};

// Detect if a task should be treated as the final live task
// Centralized helper to avoid scattered heuristics
export const isFinalLiveTask = (task) => {
  if (!task) return false;
  if (task.isLiveTask) return true;
  if (task.owner === 'l') return true;
  const name = (task.name || '').toLowerCase();
  return /\blive\b|issue date|send date|go-?live/.test(name);
};
