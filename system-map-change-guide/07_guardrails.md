Date: 2025-09-20

# Guardrails & Rollout

- Feature flags approach
  - Location: `src/config/features.ts`
  - Storage: localStorage in development; production uses defaults only
  - Dev-only debug: `window.timelineFeatureFlags` with enable/disable/toggle/reset helpers
  - Key flags: `USE_DAG_CALCULATOR`, `ENABLE_TASK_OVERLAPS`, `SHOW_CRITICAL_PATH`, `ENABLE_DEPENDENCY_UI`, `DEBUG_TIMELINE_CALCULATIONS`, `ALLOW_WEEKEND_LIVE_DATE`

- Rollout checklist
  - Start with `USE_DAG_CALCULATOR=false` in defaults when risky; enable locally with `window.timelineFeatureFlags.enable('USE_DAG_CALCULATOR')`
  - Dev verification with `DEBUG_TIMELINE_CALCULATIONS=true` (logs strategy and stats)
  - Internal QA: enable flags via dev console; run `npm run test:all`
  - Canary: ship with flag default off; enable per environment via localStorage (dev-only) or code default change guarded behind a release
  - All users: switch default to true; keep rollback method (emergencyRollback) available during bake-in

- Suggested logs (debug mode)
  - Calculator selection: in `TimelineCalculator.ts` (63–70) logs `{ useDAGFeatureFlag, hasDependencies, taskCount, selectedCalculator }`
  - Orchestrator build: log asset loop counts, dropped dependency refs (160)
  - DAG stats: `TimelineCalculatorDAG.ts` logs critical path length (around 242)
  - Sample payload: `{ assetId, tasksCount, overlapsCount, bankHolidays: n, flagSet: window.timelineFeatureFlags.status() }`

