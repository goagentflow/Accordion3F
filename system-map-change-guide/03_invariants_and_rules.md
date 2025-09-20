Date: 2025-09-20

Legend: Business invariants with enforcing code and tests. TODOs include minimal test specs.

# Invariants and Rules

- Working days only (skip weekends/bank holidays)
  - Code: `src/utils/dateHelpers.ts` `calculateWorkingDaysBetween` (246–274), `addWorkingDays` (195–237), `subtractWorkingDays` (149–186)
  - Tests: `src/__tests__/unit/TimelineCalculator.test.ts` “should handle weekends correctly”, “should account for bank holidays”

- Live task anchors to chosen live date (weekend anchoring controlled by flag)
  - Code: `src/config/features.ts` `allowWeekendLiveDate()` (220–228); sequential calc places final task on live date `src/services/TimelineCalculator.ts` (91–120 loop start)
  - Tests: TODO add unit covering weekend anchor when `ALLOW_WEEKEND_LIVE_DATE=true/false`
  - Minimal spec: set live date to Saturday; expect final task end equals that date when flag on, else next working day

- DAG vs Sequential selection via feature flag; safe rollback
  - Code: `src/services/TimelineCalculator.ts` factory (42–80) uses `useDAGCalculator()`; sequential preserved
  - Tests: `src/__tests__/unit/dag-fs-guard.test.ts` (presence indicates DAG guard) and `TimelineCalculator.test.ts` sequential expectations

- Negative lag means overlap (FS with lag<0)
  - Code: DAG assigners respect lag in `src/services/dag/dateAssigner.ts` (321–413, 474–480)
  - Tests: `src/__tests__/unit/ExcelImportTransform.test.ts` preserves negative lags; `ExcelConcurrencyTransform.test.ts` verifies overlaps compress schedule

- Invalid/missing dependency falls back to safe sequence (no orphan starts)
  - Code: `src/v2/Orchestrator.tsx` dependency sanitisation and sequential guard (around 134–167 and 146–167)
  - Tests: `src/__tests__/unit/dag-custom-dependency-fallback.test.ts`

- Freeze imported timeline prevents rebuild destroying imported dates
  - Code: `src/v2/Orchestrator.tsx` freeze branch (33–56) computes warnings only
  - Tests: `src/__tests__/e2e/persistence-overlap-refresh.spec.ts` “freeze flags preserve dependencies during localStorage operations”

- Undo/redo bulk operations are single-step (user-friendly)
  - Code: Reducers handling bulk add/remove dependencies; history integration (reducers under `src/reducers/*.ts`)
  - Tests: `src/__tests__/unit/endToEndUndoRedoProof.test.ts` CRITICAL PROOF cases

- Input validation and sanitisation (names, durations, files)
  - Code: `src/services/ValidationService.ts` (see functions above; limits 7–19)
  - Tests: `src/__tests__/unit/ValidationService.test.ts` covers sanitiseText, validate names, durations, dates, files

- Autosave only writes when state changes; handles quota
  - Code: `src/services/AutoSaveManager.ts` (56–88 saveState change detection; 92–97 quota)
  - Tests: TODO add unit verifying no-op save when JSON string unchanged

- Earliest start and conflict detection for warnings
  - Code: `src/services/TimelineCalculator.ts` `getEarliestStartDate` (212–243), `findDateConflicts` (244–354)
  - Tests: `src/__tests__/unit/TimelineCalculator.test.ts` has earliest start tests

