/**
 * DAG Calculator – FS guard behavior
 * Verifies a successor with FS(+0) never starts on the predecessor's end date.
 */

import { buildAssetTimeline } from '../../services/TimelineCalculator';
import { Task } from '../../types/timeline.types';

describe('DAG: Finish-to-Start guard', () => {
  it('ensures successor starts strictly after predecessor for FS(+0)', () => {
    const assetId = 'asset-guard-1';
    const liveDate = '2025-01-10'; // Arbitrary live date

    const tasks: Task[] = [
      {
        id: 'pred',
        name: 'Predecessor',
        duration: 3,
        owner: 'm',
        assetId,
        assetType: 'Test',
        isCustom: false
      },
      {
        id: 'succ',
        name: 'Successor',
        duration: 2,
        owner: 'm',
        assetId,
        assetType: 'Test',
        isCustom: false,
        dependencies: [
          { predecessorId: 'pred', type: 'FS', lag: 0 }
        ]
      }
    ];

    const timeline = buildAssetTimeline(tasks, liveDate, {}, []);
    const pred = timeline.find(t => t.id === 'pred')!;
    const succ = timeline.find(t => t.id === 'succ')!;

    expect(pred).toBeDefined();
    expect(succ).toBeDefined();

    const predEnd = new Date(pred.end).getTime();
    const succStart = new Date(succ.start).getTime();

    // Strictly greater: successor may not start on predecessor's end day
    expect(succStart).toBeGreaterThan(predEnd);
  });

  it('adjusts when successor would otherwise land on predecessor end date (edge)', () => {
    const assetId = 'asset-guard-2';
    const liveDate = '2025-01-10';

    // Craft tasks so baseline mapping could place successor too early without guard
    const tasks: Task[] = [
      { id: 'A', name: 'A', duration: 1, owner: 'm', assetId, assetType: 'Test', isCustom: false },
      { id: 'B', name: 'B', duration: 1, owner: 'm', assetId, assetType: 'Test', isCustom: false, dependencies: [ { predecessorId: 'A', type: 'FS', lag: 0 } ] }
    ];

    const timeline = buildAssetTimeline(tasks, liveDate, {}, []);
    const A = timeline.find(t => t.id === 'A')!;
    const B = timeline.find(t => t.id === 'B')!;
    const Aend = new Date(A.end).getTime();
    const Bstart = new Date(B.start).getTime();

    expect(Bstart).toBeGreaterThan(Aend);
  });
});
