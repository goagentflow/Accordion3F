import { computeOverlapDays } from '../../utils/overlap';
import { featureFlags } from '../../config/features';

describe('computeOverlapDays flag behaviour', () => {
  const bankHolidays: string[] = [];
  const start = '2024-12-10'; // Tue
  const end = '2024-12-12';   // Thu

  afterEach(() => {
    // Reset to defaults
    featureFlags.resetToDefaults();
  });

  it('legacy mode (default) includes +1 day', () => {
    // ensure strict is disabled
    featureFlags.disable('STRICT_OVERLAP_CALC' as any);
    const overlap = computeOverlapDays(start, end, bankHolidays);
    expect(overlap).toBe(3); // 10,11 +1 inclusive
  });

  it('strict mode computes exact working days between', () => {
    featureFlags.enable('STRICT_OVERLAP_CALC' as any);
    const overlap = computeOverlapDays(start, end, bankHolidays);
    expect(overlap).toBe(2); // 10,11 only
  });
});

