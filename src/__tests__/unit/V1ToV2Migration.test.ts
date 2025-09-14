/**
 * V1 to V2 Migration Unit Tests
 * 
 * Tests that V1 export data can be imported and rebuilt into equivalent V2 timeline
 * (IDs aside). This ensures backward compatibility during architecture changes.
 * 
 * PRIORITY: Medium - Critical for users with existing V1 exports
 */

import { transformImportedJson } from '../../services/ExcelImporter';
import v1ExportSample from '../fixtures/v1-export-sample.json';

describe('V1 to V2 Migration', () => {
  
  test('transforms V1 export to V2 compatible format', () => {
    const result = transformImportedJson(v1ExportSample);

    // Verify basic structure transformation
    expect(result.version).toBe('1.0'); // Version preserved
    expect(result.tasks).toHaveLength(6);
    expect(result.selectedAssets).toHaveLength(2);

    // Verify all V1 tasks are preserved
    const taskNames = result.tasks.map(t => t.name);
    expect(taskNames).toContain('Content Creation');
    expect(taskNames).toContain('Design Review');
    expect(taskNames).toContain('Production Setup');
    expect(taskNames).toContain('Video Script');
    expect(taskNames).toContain('Video Production');
    expect(taskNames).toContain('Final Review');
  });

  test('preserves all V1 dependencies with correct overlap structure', () => {
    const result = transformImportedJson(v1ExportSample);

    // Find tasks with dependencies
    const tasksWithDeps = result.tasks.filter(t => t.dependencies && t.dependencies.length > 0);
    expect(tasksWithDeps).toHaveLength(4); // 4 tasks have dependencies in V1 sample

    // Verify specific dependency relationships
    const designReview = result.tasks.find(t => t.name === 'Design Review');
    expect(designReview?.dependencies).toEqual([
      { predecessorId: 'v1-task-1', type: 'FS', lag: -2 }
    ]);

    const productionSetup = result.tasks.find(t => t.name === 'Production Setup');
    expect(productionSetup?.dependencies).toEqual([
      { predecessorId: 'v1-task-2', type: 'FS', lag: -1 }
    ]);

    const videoProduction = result.tasks.find(t => t.name === 'Video Production');
    expect(videoProduction?.dependencies).toEqual([
      { predecessorId: 'v1-task-4', type: 'FS', lag: -2 }
    ]);

    // Verify complex dependency (Final Review has 2 predecessors)
    const finalReview = result.tasks.find(t => t.name === 'Final Review');
    expect(finalReview?.dependencies).toHaveLength(2);
    expect(finalReview?.dependencies).toContainEqual(
      { predecessorId: 'v1-task-5', type: 'FS', lag: -1 }
    );
    expect(finalReview?.dependencies).toContainEqual(
      { predecessorId: 'v1-task-3', type: 'FS', lag: -2 }
    );
  });

  test('preserves V1 asset information for V2 state structure', () => {
    const result = transformImportedJson(v1ExportSample);

    // Verify selected assets structure
    expect(result.selectedAssets).toEqual([
      {
        id: 'banner-campaign-1',
        type: 'Banner',
        name: 'Holiday Campaign Banner',
        startDate: '2025-01-01'
      },
      {
        id: 'video-campaign-1',
        type: 'Video', 
        name: 'Holiday Campaign Video',
        startDate: '2025-01-01'
      }
    ]);

    // Verify asset live dates
    expect(result.assetLiveDates).toEqual({
      'banner-campaign-1': '2025-01-18',
      'video-campaign-1': '2025-01-22'
    });

    // Verify global date settings
    expect(result.globalLiveDate).toBe('2025-01-20');
    expect(result.useGlobalDate).toBe(false);
  });

  test('preserves V1 custom tasks and durations for V2', () => {
    const result = transformImportedJson(v1ExportSample);

    // Verify custom tasks
    expect(result.customTasks).toEqual([
      {
        id: 'custom-1',
        name: 'Strategy Meeting',
        duration: 2,
        owner: 'a'
      }
    ]);

    // Verify asset task durations
    expect(result.assetTaskDurations).toEqual({
      'Banner': {
        'Content Creation': 5,
        'Design Review': 3,
        'Production Setup': 4
      },
      'Video': {
        'Video Script': 3,
        'Video Production': 7,
        'Final Review': 2
      }
    });

    // Verify custom task names
    expect(result.customTaskNames).toEqual({
      'Banner': ['Custom Banner Task'],
      'Video': ['Custom Video Task']
    });
  });

  test('handles V1 date format compatibility', () => {
    const result = transformImportedJson(v1ExportSample);

    // Verify date transformation (V1 used startDate/endDate, V2 uses start/end)
    result.tasks.forEach(task => {
      expect(task.start).toBeDefined();
      expect(task.end).toBeDefined();
      expect(typeof task.start).toBe('string');
      expect(typeof task.end).toBe('string');
    });

    // Verify specific date transformations
    const contentCreation = result.tasks.find(t => t.name === 'Content Creation');
    expect(contentCreation?.start).toBe('2025-01-01');
    expect(contentCreation?.end).toBe('2025-01-06');
  });

  test('maintains V1 task ownership and asset relationships', () => {
    const result = transformImportedJson(v1ExportSample);

    // Group tasks by asset to verify relationships
    const bannerTasks = result.tasks.filter(t => t.assetType === 'Banner');
    const videoTasks = result.tasks.filter(t => t.assetType === 'Video');

    expect(bannerTasks).toHaveLength(3);
    expect(videoTasks).toHaveLength(3);

    // Verify owner preservation
    const taskOwners = result.tasks.map(t => ({ name: t.name, owner: t.owner }));
    expect(taskOwners).toContainEqual({ name: 'Content Creation', owner: 'c' });
    expect(taskOwners).toContainEqual({ name: 'Design Review', owner: 'm' });
    expect(taskOwners).toContainEqual({ name: 'Final Review', owner: 'a' });

    // Verify asset relationships
    bannerTasks.forEach(task => {
      expect(task.assetId).toBe('banner-campaign-1');
      expect(task.assetType).toBe('Banner');
    });

    videoTasks.forEach(task => {
      expect(task.assetId).toBe('video-campaign-1');
      expect(task.assetType).toBe('Video');
    });
  });

  test('calculates correct overlap counts for migration validation', () => {
    const result = transformImportedJson(v1ExportSample);

    // Count total overlaps (negative lag dependencies)
    const overlappingDependencies = result.tasks
      .flatMap(t => t.dependencies || [])
      .filter(d => d.lag < 0);

    expect(overlappingDependencies).toHaveLength(5); // 5 overlapping deps in V1 sample

    // Verify overlap lag values are preserved  
    const overlapLags = overlappingDependencies.map(d => d.lag).sort();
    expect(overlapLags.length).toBe(5);
    expect(overlapLags.filter(lag => lag === -2)).toHaveLength(3);
    expect(overlapLags.filter(lag => lag === -1)).toHaveLength(2);
  });

  test('preserves V1 metadata for audit trail', () => {
    const result = transformImportedJson(v1ExportSample);

    // Verify metadata preservation
    expect(result.version).toBe('1.0');
    expect(result.exportDate).toBe('2024-12-15T14:30:00.000Z');
    expect(result.taskCount).toBe(6);

    // Should maintain original structure for compatibility
    expect(result.tasks).toHaveLength(result.taskCount);
  });
});

// Test helper for creating instanceBase from V1 data (simulates ImportManager)
describe('V1 to V2 instanceBase Migration', () => {
  
  test('creates V2 instanceBase structure from V1 timeline data', () => {
    const v1Data = transformImportedJson(v1ExportSample);
    
    // Simulate ImportManager instanceBase creation
    const baseByInstance: Record<string, any[]> = {};
    v1Data.tasks.forEach((t: any) => {
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
        dependencies: Array.isArray(t.dependencies) ? t.dependencies.map((d: any) => ({
          predecessorId: d.predecessorId,
          type: 'FS' as const,
          lag: d.lag
        })) : []
      });
    });

    // Verify instanceBase structure
    expect(Object.keys(baseByInstance)).toEqual(['banner-campaign-1', 'video-campaign-1']);
    expect(baseByInstance['banner-campaign-1']).toHaveLength(3);
    expect(baseByInstance['video-campaign-1']).toHaveLength(3);

    // Verify dependencies are preserved in instanceBase
    const bannerTasks = baseByInstance['banner-campaign-1'];
    const designReviewTask = bannerTasks.find(t => t.name === 'Design Review');
    expect(designReviewTask?.dependencies).toEqual([
      { predecessorId: 'v1-task-1', type: 'FS', lag: -2 }
    ]);

    const videoTasks = baseByInstance['video-campaign-1'];
    const finalReviewTask = videoTasks.find(t => t.name === 'Final Review');
    expect(finalReviewTask?.dependencies).toHaveLength(2);
  });

  test('handles V1 tasks without dependencies in instanceBase', () => {
    const v1Data = transformImportedJson(v1ExportSample);
    
    // Find tasks without dependencies
    const tasksWithoutDeps = v1Data.tasks.filter(t => !t.dependencies || t.dependencies.length === 0);
    expect(tasksWithoutDeps.length).toBeGreaterThan(0);

    // Verify they're handled correctly in instanceBase creation
    const baseByInstance: Record<string, any[]> = {};
    v1Data.tasks.forEach((t: any) => {
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
        dependencies: Array.isArray(t.dependencies) ? t.dependencies : []
      });
    });

    // Verify tasks without dependencies have empty dependency arrays
    const allTasks = Object.values(baseByInstance).flat();
    const tasksWithEmptyDeps = allTasks.filter(t => t.dependencies.length === 0);
    expect(tasksWithEmptyDeps.length).toBe(2); // Content Creation and Video Script
  });
});