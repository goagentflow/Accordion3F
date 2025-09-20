Date: 2025-09-20

# Glossary

- Asset: A deliverable instance (e.g., “Banner A”) — `src/types/timeline.types.ts` Asset
- Task: Work item with duration and owner; may depend on other tasks — `src/types/timeline.types.ts` Task
- TimelineTask: Task with computed `start`/`end`/`progress` and optional DAG fields — `src/types/timeline.types.ts`
- DAG: Directed acyclic graph of task dependencies for scheduling overlaps/lags — `src/services/dag/*`
- Critical Path: Longest path through DAG determining project duration — `src/services/dag/criticalPathCalculator.ts`
- Lag: Offset on FS dependency; negative lag denotes overlap — `src/services/dag/dateAssigner.ts`
- FS: Finish-to-Start dependency type used in this app — `src/types/timeline.types.ts`
- Instance Base: Per-asset template of tasks/deps imported from Excel — `src/v2/Orchestrator.tsx`
- Freeze Imported Timeline: UI state preventing rebuild after import — `src/v2/Orchestrator.tsx`
- Working Day: Weekdays excluding bank holidays — `src/utils/dateHelpers.ts`
- Bank Holidays: Configurable list of non-working days — `src/hooks/useTimelineSelectors.tsx` (dates.bankHolidays)

