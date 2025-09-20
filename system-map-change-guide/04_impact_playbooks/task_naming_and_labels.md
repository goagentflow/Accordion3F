Date: 2025-09-20

# Task Naming & Labels

- Files to touch first
  - `src/services/ValidationService.ts` (sanitise/validate names)
  - `src/actions/timelineActions.ts` (renameTask), reducers in `src/reducers/*.ts` (name updates)
  - Display: `src/components/GanttTaskRow.js`, `src/components/TimelineDisplay.js`

- What can break
  - XSS sanitisation regressions; overly aggressive truncation
  - Name-based duration overrides vs per-instance overrides (see `Orchestrator.tsx` 175–183)

- Tests to run or add
  - Run: `src/__tests__/unit/ValidationService.test.ts`
  - Add: unit ensuring rename flows prefer per-instance id over name collisions

- Flags to use for a safe rollout
  - Use `DEBUG_TIMELINE_CALCULATIONS` to trace renames through orchestrator

- Telemetry or log lines to verify
  - Add debug logs around rename reducers and orchestrator name override mapping

