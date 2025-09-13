/**
 * Regression: metadata transform must preserve overlaps (dependencies with negative lag)
 * This avoids depending on ExcelJS parsing in Jest by testing the pure transform.
 */

import { transformImportedJson } from '../../services/ExcelImporter';
import {
  buildAssetTimelineSequential,
  buildAssetTimeline,
  getEarliestStartDate,
  getLatestEndDate
} from '../../services/TimelineCalculator';

function spanDays(startISO: string, endISO: string): number {
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  return Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

describe('Excel transform preserves dependency overlaps', () => {
  it('keeps negative-lag FS dependency and compresses schedule', () => {
    const assetId = 'asset-1';
    const json = {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      taskCount: 2,
      timeline: [
        { id: 'A', name: 'Predecessor', duration: 2, owner: 'm', assetId, assetType: 'Banner', startDate: '', endDate: '' },
        { id: 'B', name: 'Successor', duration: 2, owner: 'm', assetId, assetType: 'Banner', startDate: '', endDate: '', dependencies: [{ predecessorId: 'A', type: 'FS', lag: -1 }] }
      ],
      selectedAssets: [{ id: assetId, type: 'Banner', name: 'Banner', startDate: '2025-09-20' }],
      globalLiveDate: '2025-09-20',
      assetLiveDates: {},
      useGlobalDate: true,
      customTasks: [],
      assetTaskDurations: {},
      customTaskNames: {}
    };

    const imported = transformImportedJson(json);
    // Dependency should be present on task B
    const b = imported.tasks.find((t: any) => t.id === 'B');
    expect(b).toBeTruthy();
    expect(b!.dependencies[0]).toMatchObject({ predecessorId: 'A', type: 'FS', lag: -1 });

    const live = imported.globalLiveDate as string;
    const seq = buildAssetTimelineSequential(imported.tasks.map((t: any) => ({ ...t, dependencies: [] })) as any, live);
    const dag = buildAssetTimeline(imported.tasks as any, live);

    // Assert actual overlap exists in DAG result for tasks A and B
    const dagA = dag.find((t: any) => t.id === 'A')!;
    const dagB = dag.find((t: any) => t.id === 'B')!;
    expect(dagA).toBeTruthy();
    expect(dagB).toBeTruthy();
    expect(new Date(dagB.start).getTime()).toBeLessThan(new Date(dagA.end).getTime());
  });
});
