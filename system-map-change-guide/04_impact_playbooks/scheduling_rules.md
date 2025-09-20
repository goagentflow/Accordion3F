Date: 2025-09-20

# Scheduling Rules

- Files to touch first
  - Factory & sequential: `src/services/TimelineCalculator.ts` (42–80, 91–120)
  - DAG: `src/services/TimelineCalculatorDAG.ts` (45–139), `src/services/dag/dateAssigner.ts` (321–413, 474–480), `src/services/dag/criticalPathCalculator.ts` (232–253)
  - Orchestration: `src/v2/Orchestrator.tsx` (33–198)
  - Date maths: `src/utils/dateHelpers.ts`

- What can break
  - Global timeline consistency (blast radius: high)
  - Import compatibility (`instanceBase` semantics)
  - Overlaps and lags handling

- Tests to run or add
  - Run unit: DAG, TimelineCalculator, Excel transforms; E2E: `tier1-timeline-accuracy.spec.ts`, manipulation suites
  - Add: flag-off regression tests asserting sequential parity; weekend anchor behaviour

- Flags to use for a safe rollout
  - `USE_DAG_CALCULATOR`, `ENABLE_TASK_OVERLAPS`, `SHOW_CRITICAL_PATH`, `ENABLE_DEPENDENCY_UI`
  - Rollout: enable in dev → internal QA → canary users → all

- Telemetry or log lines to verify
  - Enable `DEBUG_TIMELINE_CALCULATIONS`; confirm calculator selection and critical path stats in logs

