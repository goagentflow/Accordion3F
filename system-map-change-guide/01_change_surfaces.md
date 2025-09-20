Date: 2025-09-20

Legend: Rows map user-visible features → control points with upstream inputs and downstream effects. Paths include line ranges for primary control points where available.

# Change Surfaces

| Feature/Screen | Controlling modules, hooks, selectors | Upstream inputs | Downstream effects | Primary control points |
|---|---|---|---|---|
| App boot & error boundary | `src/index.js` renders `src/v2/TimelineBuilderV2.tsx` inside `src/components/ErrorBoundary.tsx` | DOM (`#root`) | Initial provider mount; error capture | `src/index.js` (1–40) |
| Getting Started/V2 shell | `src/v2/TimelineBuilderV2.tsx` (composes provider + v2 views) | None (composition) | Provides context to children | `src/v2/TimelineBuilderV2.tsx` (TODO – confirm composition lines) |
| Orchestrated scheduling | `src/v2/Orchestrator.tsx` orchestrates timeline builds via effects | Selected assets/dates via selectors; feature flags; bank holidays; imported timelines | Dispatches `TimelineActions.updateTimeline`, sets calculated starts and conflicts | `src/v2/Orchestrator.tsx` (1–20 imports/context), (16–32 ordered selection), (33–198 main build effect), (184–186 updateTimeline), (160–163 dropped-deps warn) |
| Gantt chart rendering | `src/components/GanttChart.js`, `src/components/GanttTaskRow.js`, `src/components/GanttDependencyVisuals.tsx` | Timeline tasks from selectors | Paint Gantt rows, bars, dependency visuals | `src/components/GanttChart.js` (21–120), `src/components/GanttTaskRow.js` (37–116), `src/components/GanttDependencyVisuals.tsx` (approx. 1–200) |
| Gantt interactions (drag/resize/move) | `src/hooks/useGanttDrag.ts` used by Gantt | Mouse events, bank holidays | Calls `onTaskMove`/`onTaskDurationChange` → actions/reducers → orchestrator rebuild | `src/hooks/useGanttDrag.ts` (49–69 mousedown), (71–118 mousemove), (120–139 mouseup), (141–151 listeners) |
| Keyboard shortcuts | `src/hooks/useKeyboardShortcuts.ts` | Keydown events | Executes actions and logs (debug) | `src/hooks/useKeyboardShortcuts.ts` (73–124 handleKeyDown), (169–200 register/init) |
| Feature flags (dev UI) | `src/config/features.ts` + dev `window.timelineFeatureFlags` | localStorage; `NODE_ENV` | Enables DAG/overlaps/UI/critical/debug; strips in prod | `src/config/features.ts` (DEFAULT_FLAGS ~ 28–55), (isEnabled/enable/disable/toggle ~ 95–167), (dev interface ~ 246–end) |
| Sequential vs DAG selection | `src/services/TimelineCalculator.ts` (factory) | `useDAGCalculator()` | Calls `buildAssetTimelineDAG` or sequential | `src/services/TimelineCalculator.ts` (42–80) |
| DAG/CPM scheduling | `src/services/TimelineCalculatorDAG.ts`, `src/services/dag/*.ts` | Tasks with dependencies; project start/live date | Assigns dates; critical path; overlaps/lag | `src/services/TimelineCalculatorDAG.ts` (45–139 core), `src/services/dag/dateAssigner.ts` (321–413, 474–480 durations), `src/services/dag/criticalPathCalculator.ts` (232–253 path) |
| Date helpers & offsets | `src/utils/dateHelpers.ts` | Date inputs; bank holidays | Compute working-day math across app | `subtractWorkingDays` (149–186), `addWorkingDays` (195–237), `calculateWorkingDaysBetween` (246–274), `getPreviousWorkingDay` (31–55), `getNextWorkingDay` (116–140) |
| Validation | `src/services/ValidationService.ts` | User input; file metadata | Sanitise names; clamp durations; validate dates/files | `src/services/ValidationService.ts` (sanitizeText 18–43, validateTaskName 61–97, validateDuration ~ 120+), limits at top (7–19) |
| Import Excel | `src/services/ExcelImporter.js` | File upload | State restoration payload; instanceBase; tasks/deps | `src/services/ExcelImporter.js` (1–40, 49–76 parsing, 98–116 validation) |
| Export Excel | `src/services/ExcelExporter.js` | Current state/timeline | Generates `.xlsx` file | `src/services/ExcelExporter.js` (TODO – writer setup lines) |
| Autosave & recovery | `src/services/AutoSaveManager.ts` | Timeline state; debounce | localStorage save; status callbacks | `src/services/AutoSaveManager.ts` (56–88 saveState), (104–121 loadState), (128–137 clearState) |
| Dependency overlay & indicators | `src/components/DragDropDependencyOverlay.tsx`, `src/components/TaskDependencyIndicator.tsx` | Tasks.deps; hover/selection | Visual cues for dependencies | `src/components/DragDropDependencyOverlay.tsx` (25–123), `src/components/TaskDependencyIndicator.tsx` (30–178) |

Notes
- Line ranges are approximate where file content is UI-heavy; control points reflect component roots and main render logic.
