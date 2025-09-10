/**
 * Date calculation utilities for timeline management
 * All pure functions for working day calculations and date manipulations
 */

/**
 * Check if a date is a non-working day (weekend or bank holiday)
 * @param date - The date to check
 * @param bankHolidays - Array of bank holiday dates in YYYY-MM-DD format
 * @returns true if the date is a weekend or bank holiday
 */
export const isNonWorkingDay = (
  date: Date | null | undefined,
  bankHolidays: string[] = []
): boolean => {
  if (!date || isNaN(date.getTime())) {
    return true; // Treat invalid dates as non-working days
  }
  
  const day = date.getDay();
  const yyyy_mm_dd = date.toISOString().split('T')[0];
  return day === 0 || day === 6 || bankHolidays.includes(yyyy_mm_dd);
};

/**
 * Get the previous working day from a given date
 * @param date - The starting date
 * @param bankHolidays - Array of bank holiday dates
 * @returns The previous working day
 */
export const getPreviousWorkingDay = (
  date: Date | null | undefined,
  bankHolidays: string[] = []
): Date => {
  if (!date || isNaN(date.getTime())) {
    return new Date();
  }
  
  let workingDate = new Date(date);
  let iterations = 0;
  const maxIterations = 1000; // Prevent infinite loops
  
  do {
    workingDate.setDate(workingDate.getDate() - 1);
    iterations++;
    
    // Check if date has become invalid (before 1970)
    if (workingDate.getFullYear() < 1970 || iterations >= maxIterations) {
      console.warn('getPreviousWorkingDay exceeded maximum iterations or went too far back');
      return new Date('1970-01-01');
    }
  } while (isNonWorkingDay(workingDate, bankHolidays));
  
  return workingDate;
};

/**
 * Map CPM day offset (0-indexed) to calendar date
 * @param projectStartDate - The project start date (working day)
 * @param dayOffset - 0-indexed offset (0 = project start date)
 * @param bankHolidays - Array of bank holiday dates
 * @returns The calendar date for the given CPM day
 */
export const getCPMDateOffset = (
  projectStartDate: Date | null | undefined,
  dayOffset: number,
  bankHolidays: string[] = []
): Date => {
  if (!projectStartDate || isNaN(projectStartDate.getTime())) {
    return new Date();
  }
  
  // Start with project start date (ensure it's a working day)
  let currentDate = new Date(projectStartDate);
  if (isNonWorkingDay(currentDate, bankHolidays)) {
    currentDate = getNextWorkingDay(currentDate, bankHolidays);
  }
  
  // If offset is 0, return the start date
  if (dayOffset === 0) {
    return currentDate;
  }
  
  // Add working days for positive offset
  let remainingDays = dayOffset;
  let iterations = 0;
  const maxIterations = 10000;
  
  while (remainingDays > 0 && iterations < maxIterations) {
    currentDate.setDate(currentDate.getDate() + 1);
    iterations++;
    
    if (!isNonWorkingDay(currentDate, bankHolidays)) {
      remainingDays--;
    }
    
    if (currentDate.getFullYear() > 2100) {
      console.warn('CPM date calculation went too far forward');
      break;
    }
  }
  
  if (iterations >= maxIterations) {
    console.warn('CPM date calculation exceeded maximum iterations');
  }
  
  return currentDate;
};

/**
 * Get the next working day from a given date
 * @param date - The starting date
 * @param bankHolidays - Array of bank holiday dates
 * @returns The next working day
 */
export const getNextWorkingDay = (
  date: Date | null | undefined,
  bankHolidays: string[] = []
): Date => {
  if (!date || isNaN(date.getTime())) {
    return new Date();
  }
  
  let workingDate = new Date(date);
  let iterations = 0;
  const maxIterations = 1000; // Prevent infinite loops
  
  do {
    workingDate.setDate(workingDate.getDate() + 1);
    iterations++;
    
    // Check if date has become too far in the future
    if (workingDate.getFullYear() > 2100 || iterations >= maxIterations) {
      console.warn('getNextWorkingDay exceeded maximum iterations or went too far forward');
      return new Date('2100-12-31');
    }
  } while (isNonWorkingDay(workingDate, bankHolidays));
  
  return workingDate;
};

/**
 * Subtract working days from a date (backwards calculation)
 * @param endDate - The ending date
 * @param workingDaysToSubtract - Number of working days to subtract
 * @param bankHolidays - Array of bank holiday dates
 * @returns The calculated start date
 */
export const subtractWorkingDays = (
  endDate: Date | null | undefined,
  workingDaysToSubtract: number,
  bankHolidays: string[] = []
): Date => {
  if (!endDate || isNaN(endDate.getTime()) || workingDaysToSubtract <= 0) {
    return new Date(endDate || new Date());
  }
  
  let currentDate = new Date(endDate);
  let remainingDays = workingDaysToSubtract;
  let iterations = 0;
  const maxIterations = 10000; // Prevent infinite loops
  
  // Subtract working days
  while (remainingDays > 0 && iterations < maxIterations) {
    currentDate.setDate(currentDate.getDate() - 1);
    iterations++;
    
    // Check if date has become invalid (before 1970)
    if (currentDate.getFullYear() < 1970) {
      console.warn('Date calculation went too far back, stopping at 1970-01-01');
      return new Date('1970-01-01');
    }
    
    // Only count working days
    if (!isNonWorkingDay(currentDate, bankHolidays)) {
      remainingDays--;
    }
  }
  
  if (iterations >= maxIterations) {
    console.warn('subtractWorkingDays exceeded maximum iterations, returning original date');
    return new Date(endDate);
  }
  
  return currentDate;
};

/**
 * Add working days to a date (forward calculation)
 * @param startDate - The starting date
 * @param workingDaysToAdd - Number of working days to add
 * @param bankHolidays - Array of bank holiday dates
 * @returns The calculated end date
 */
export const addWorkingDays = (
  startDate: Date | null | undefined,
  workingDaysToAdd: number,
  bankHolidays: string[] = []
): Date => {
  if (!startDate || isNaN(startDate.getTime()) || workingDaysToAdd <= 0) {
    return new Date(startDate || new Date());
  }
  
  let currentDate = new Date(startDate);
  let remainingDays = workingDaysToAdd - 1; // -1 because start date counts
  let iterations = 0;
  const maxIterations = 10000; // Prevent infinite loops
  
  while (remainingDays > 0 && iterations < maxIterations) {
    currentDate.setDate(currentDate.getDate() + 1);
    iterations++;
    
    // Check if date has become too far in the future
    if (currentDate.getFullYear() > 2100) {
      console.warn('Date calculation went too far forward, stopping at 2100-12-31');
      return new Date('2100-12-31');
    }
    
    if (!isNonWorkingDay(currentDate, bankHolidays)) {
      remainingDays--;
    }
  }
  
  if (iterations >= maxIterations) {
    console.warn('addWorkingDays exceeded maximum iterations, returning original date');
    return new Date(startDate);
  }
  
  // Ensure the final day is a working day
  iterations = 0;
  while (isNonWorkingDay(currentDate, bankHolidays) && iterations < 100) {
    currentDate.setDate(currentDate.getDate() + 1);
    iterations++;
  }
  
  return currentDate;
};

/**
 * Calculate the number of working days between two dates
 * @param startDate - The start date
 * @param endDate - The end date
 * @param bankHolidays - Array of bank holiday dates
 * @returns Number of working days between the dates
 */
export const calculateWorkingDaysBetween = (
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  bankHolidays: string[] = []
): number => {
  if (!startDate || !endDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (start >= end) return 0;
  
  let workingDays = 0;
  let currentDate = new Date(start);
  
  while (currentDate < end) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Count if not weekend (0 = Sunday, 6 = Saturday) and not bank holiday
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !bankHolidays.includes(dateStr)) {
      workingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return workingDays;
};

/**
 * Convert a date to ISO string format (YYYY-MM-DD)
 * @param date - The date to convert
 * @returns ISO date string or today's date if invalid
 */
export const safeToISOString = (date: Date | null | undefined): string => {
  if (!date || isNaN(date.getTime())) {
    console.warn('Invalid date detected, using today\'s date as fallback');
    return new Date().toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
};

/**
 * Format a date for display
 * @param dateString - The date string to format
 * @returns Formatted date string
 */
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'N/A';
  
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Check if a date string represents today
 * @param dateString - The date string to check
 * @returns true if the date is today
 */
export const isToday = (dateString: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(dateString);
  checkDate.setHours(0, 0, 0, 0);
  
  return today.getTime() === checkDate.getTime();
};

/**
 * Check if a date is in the past
 * @param dateString - The date string to check
 * @returns true if the date is before today
 */
export const isInPast = (dateString: string): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(dateString);
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate < today;
};

/**
 * Get a date object set to start of day (00:00:00)
 * @param date - The date to normalize
 * @returns Date set to start of day
 */
export const startOfDay = (date: Date | string): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Validate if a date string is valid
 * @param dateString - The date string to validate
 * @returns true if the date is valid
 */
export const isValidDate = (dateString: string | null | undefined): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};