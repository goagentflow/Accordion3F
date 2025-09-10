/**
 * DAG Calculator – Fallback behavior when dependency predecessor is missing
 * Ensures a node with an invalid dependency is scheduled sequentially
 * after the previous task in the same asset (not as a start node).
 */

import { buildAssetTimeline } from '../../services/TimelineCalculator';
import { Task } from '../../types/timeline.types';

describe('DAG: custom-task dependency fallback', () => {
  it('schedules custom task after previous when predecessorId is invalid', () => {
    const assetId = 'asset-1';
    const liveDate = '2024-12-20';

    // T1 and T2 form a concurrent pair via negative lag
    // Custom C is inserted after T2 but its dependency references a nonexistent predecessorId
    const tasks: Task[] = [
      {
        id: 't1',
        name: 'T1',
        duration: 5,
        owner: 'm',
        assetId,
        assetType: 'Test',
        isCustom: false
      },
      {
        id: 't2',
        name: 'T2',
        duration: 3,
        owner: 'm',
        assetId,
        assetType: 'Test',
        isCustom: false,
        dependencies: [
          { predecessorId: 't1', type: 'FS', lag: -2 } // overlap: start 2 days before T1 finishes
        ]
      },
      {
        id: 'c1',
        name: 'Custom C',
        duration: 2,
        owner: 'm',
        assetId,
        assetType: 'Test',
        isCustom: true,
        // Invalid predecessor reference (e.g., stale ID from prior timeline rebuild)
        dependencies: [
          { predecessorId: 'nonexistent-id', type: 'FS', lag: 0 }
        ]
      }
    ];

    const timeline = buildAssetTimeline(tasks, liveDate, {}, []);

    // Extract the three tasks with assigned dates
    const t1 = timeline.find(t => t.id === 't1')!;
    const t2 = timeline.find(t => t.id === 't2')!;
    const c1 = timeline.find(t => t.id === 'c1')!;

    expect(t1).toBeDefined();
    expect(t2).toBeDefined();
    expect(c1).toBeDefined();

    // Verify that C is not starting at the project start (i.e. not day 0)
    // and instead follows t2 sequentially (end of t2 <= start of c1)
    const t2End = new Date(t2.end).getTime();
    const c1Start = new Date(c1.start).getTime();
    expect(c1Start).toBeGreaterThanOrEqual(t2End);
  });
});

