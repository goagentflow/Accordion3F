Date: 2025-09-20

Legend: Boxes show repo paths; arrows label protocols/events.

# Decision Points

Calculator selection & scheduling
- `src/services/TimelineCalculator.ts` — Factory chooses DAG vs Sequential via `src/config/features.ts`.
- `src/services/TimelineCalculatorDAG.ts` + `src/services/dag/*.ts` — Graph build, date assignment, critical path; where overlap/lag rules are applied.
- `src/utils/dateHelpers.ts` — Working days, bank holidays, previous/next working day calculations.

Validation & guards
- `src/services/ValidationService.ts` — General timeline and input validation.
- `src/services/DependencyValidationEnhanced.ts` / `src/services/DependencyValidator.ts` — Dependency integrity and conflict detection.

State transitions & invariants
- `src/reducers/*.ts` — Core rules for how actions mutate assets, tasks, dates, and UI slices.
- `src/v2/Orchestrator.tsx` — Side-effect policy: rebuild conditions, honoring `freezeImportedTimeline` to avoid destructive recalcs after import.

Feature gating
- `src/config/features.ts` — Enables/disables: DAG mode, overlaps, critical path, dependency UI, debug, weekend live date anchoring.

Auth/pricing/scoring
- None present.

TODO
- Document explicit overlap/lag limits and any constraints enforced during DAG scheduling. Suspected owner: scheduling rules owner.

