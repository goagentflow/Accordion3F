Date: 2025-09-20

# Date Helpers & Offsets

- Files to touch first
  - `src/utils/dateHelpers.ts` (see key functions)
  - Consumers: calculators and `useGanttDrag.ts`

- What can break
  - Off-by-one errors in durations; weekend/holiday snapping
  - Performance (loops have safeguards; keep them)

- Tests to run or add
  - Run: `TimelineCalculator.test.ts` working days contexts
  - Add: direct unit tests for `getCPMDateOffset` and edge cases (min/max guards)

- Flags to use for a safe rollout
  - None directly; validate via `DEBUG_TIMELINE_CALCULATIONS`

- Telemetry or log lines to verify
  - Temporary logs in helper callers; keep helpers pure and silent

