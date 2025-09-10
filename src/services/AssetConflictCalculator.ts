/**
 * AssetConflictCalculator - Service for calculating asset-specific timeline conflicts
 * Following Golden Rule #2: Clean Separation of Concerns
 * Uses bank-holiday aware calculations to align with V2's other conflict surfaces
 */

import { calculateWorkingDaysBetween } from '../utils/dateHelpers';
import type { Asset, TimelineTask } from '../types/timeline.types';

export interface AssetAlert {
  assetId: string;
  assetName: string;
  assetType: string;
  daysNeeded: number;          // Working days that need to be saved
  calculatedEndDate: Date;     // When tasks actually end
  liveDate: Date;              // When asset should go live
  daysOver: number;            // How many working days past live date
  totalDuration: number;       // Total duration of all tasks
}


/**
 * Calculate asset conflicts - which assets need days saved to meet their live dates
 * Mirrors V1's calculateWorkingDaysNeededPerAsset function exactly
 */
export function calculateAssetConflicts(
  selectedAssets: Asset[],
  timeline: TimelineTask[],
  calculatedStartDates: Record<string, string>,
  dateErrors: string[],
  bankHolidays: string[] = [],
  globalLiveDate?: string,
  useGlobalDate?: boolean
): AssetAlert[] {
  if (!selectedAssets?.length || !timeline?.length) {
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const assetAlerts: AssetAlert[] = [];
  
  // Calculate for each asset that has date errors
  selectedAssets.forEach(asset => {
    const calculatedStart = calculatedStartDates[asset.id];
    
    // Only process assets with date errors and calculated start dates
    if (calculatedStart && dateErrors.includes(asset.id)) {
      const startDate = new Date(calculatedStart);
      
      // Calculate working days from required start to today (bank-holiday aware)
      const daysNeeded = calculateWorkingDaysBetween(startDate, today, bankHolidays);
      
      if (daysNeeded > 0) {
        // Find all tasks for this asset to get timeline bounds
        const assetTasks = timeline.filter(t => t.assetId === asset.id);
        
        if (assetTasks.length > 0) {
          // Calculate actual end date of all tasks
          const endDates = assetTasks.map(t => new Date(t.end));
          const calculatedEndDate = new Date(Math.max(...endDates.map(d => d.getTime())));
          
          // Get live date with proper source priority
          let liveDate: Date | null = null;
          
          if (useGlobalDate && globalLiveDate) {
            liveDate = new Date(globalLiveDate);
          } else if (asset.startDate) {
            liveDate = new Date(asset.startDate);
          }
          
          // Skip asset if no valid live date is set
          if (!liveDate) {
            return;
          }
          
          // Calculate days over live date (bank-holiday aware)
          const daysOver = calculateWorkingDaysBetween(liveDate, calculatedEndDate, bankHolidays);
          
          // Calculate total duration
          const totalDuration = assetTasks.reduce((sum, task) => sum + (task.duration || 0), 0);
          
          assetAlerts.push({
            assetId: asset.id,
            assetName: asset.name,
            assetType: asset.type,
            daysNeeded,
            calculatedEndDate,
            liveDate,
            daysOver: Math.max(0, daysOver), // Don't show negative days
            totalDuration
          });
        }
      }
    }
  });
  
  // Sort by urgency (most days needed first)
  return assetAlerts.sort((a, b) => b.daysNeeded - a.daysNeeded);
}