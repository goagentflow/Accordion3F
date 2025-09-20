Date: 2025-09-20

Legend: Classify each module; state public contract and knowledge boundaries.

# Module Responsibility Matrix

- src/v2/TimelineBuilderV2.tsx
  - Type: Presentational + Composition
  - Public contract: Renders provider + v2 screens (props: n/a)
  - Allowed to know: App layout; provider existence
  - Must not know: Scheduling algorithms; persistence internals

- src/v2/Orchestrator.tsx
  - Type: State + Orchestration
  - Public contract: React component; uses selectors and dispatch; no props
  - Allowed to know: Selectors, actions, calculator factory
  - Must not know: Gantt DOM structure; Excel I/O specifics

- src/hooks/useTimeline.tsx
  - Type: State (Context/Provider)
  - Public contract: Context shape `TimelineContextValue` (see `src/types/timeline.types.ts` 515–536)
  - Allowed to know: Reducers, initial state, persistence wiring
  - Must not know: Scheduling math; UI visuals

- src/hooks/useTimelineSelectors.tsx
  - Type: State (Selectors)
  - Public contract: `useAssets()`, `useDates()`, `useTasks()`, `useUI()`, plus helpers
  - Allowed to know: Context shape
  - Must not know: Calculator internals

- src/services/TimelineCalculator.ts
  - Type: Algorithm (Factory + sequential)
  - Public contract: `buildAssetTimeline(raw, liveDate, durations, bankHolidays)`; helpers (`getEarliestStartDate`, `findDateConflicts`, etc.)
  - Allowed to know: Feature flags, date helpers, DAG entry
  - Must not know: React state, DOM

- src/services/TimelineCalculatorDAG.ts, src/services/dag/*.ts
  - Type: Algorithm (DAG/CPM)
  - Public contract: `buildAssetTimeline(...)` (class method) + exported critical path helpers
  - Allowed to know: Graph representation, date helpers
  - Must not know: UI, persistence

- src/utils/dateHelpers.ts
  - Type: Algorithm (Utility)
  - Public contract: pure date functions (`add/subtractWorkingDays`, `calculateWorkingDaysBetween`, etc.)
  - Allowed to know: Bank holidays array
  - Must not know: React, actions, Excel

- src/services/ValidationService.ts
  - Type: Algorithm (Validation/IO guard)
  - Public contract: `sanitizeText`, `validateTaskName`, `validateAssetName`, `validateDuration`, `validateDate`, `validateFile`
  - Allowed to know: Limits and sanitisation rules
  - Must not know: Rendering, scheduling choices

- src/services/ExcelImporter.js / ExcelExporter.js
  - Type: IO
  - Public contract: `importFromExcel(file)`; `exportToExcel(state)`
  - Allowed to know: Timeline state shapes; sheet formats
  - Must not know: Component internals; DOM (beyond download trigger)

- src/components/Gantt*.js|.tsx
  - Type: Presentational (with interaction wiring)
  - Public contract: Props per component (rows, tasks, callbacks)
  - Allowed to know: Hooks used for interactions
  - Must not know: Scheduling internals beyond callbacks

- src/hooks/useGanttDrag.ts, useKeyboardShortcuts.ts, useBeforeUnload.ts
  - Type: State/IO glue
  - Public contract: Hook return APIs
  - Allowed to know: Event sources; dispatch callbacks
  - Must not know: Graph algorithms, Excel schemas

