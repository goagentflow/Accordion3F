Date: 2025-09-20

# Test Topology

- Unit tests (Jest)
  - Scheduling: `src/__tests__/unit/TimelineCalculator.test.ts`
  - DAG behaviours: `src/__tests__/unit/dag-custom-dependency-fallback.test.ts`, `src/__tests__/unit/dag-fs-guard.test.ts`
  - Import transforms: `src/__tests__/unit/ExcelImportTransform.test.ts`, `ExcelConcurrencyTransform.test.ts`
  - Undo/redo: `src/__tests__/unit/endToEndUndoRedoProof.test.ts`, `undoRedoBulkOperations.test.ts`
  - State reducers: `src/__tests__/unit/timelineReducer*.test.ts`, `stateAdapters.dependencies.test.ts`
  - Validation: `src/__tests__/unit/ValidationService.test.ts`

- E2E tests (Playwright)
  - Manipulation/gantt interactions: `src/__tests__/e2e/manipulation-*.spec.ts`, `tier1-undo-redo-integrity.spec.ts`
  - Accuracy/edge cases: `tier1-timeline-accuracy.spec.ts`, `edge-cases.spec.ts`, `debug-*.spec.ts`
  - Persistence/overlaps/refresh: `persistence-overlap-refresh.spec.ts`, `excel-roundtrip*.spec.ts`

- Mapping tests to rules
  - Working-day rules: unit TimelineCalculator tests; E2E accuracy suite
  - Overlaps/lag: Excel transform tests; manipulation E2E
  - Freeze behaviour: persistence-overlap-refresh E2E
  - Undo history constraints: endToEndUndoRedoProof unit
  - Validation/XSS: ValidationService unit

- Gaps (TODO)
  - Weekend anchoring flag behaviour test
  - Autosave no-op-on-unchanged-state unit
  - Critical path visual correctness (component-level test or screenshot-based E2E)

