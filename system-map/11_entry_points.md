Date: 2025-09-20

Legend: Boxes show repo paths; arrows label protocols/events.

# Entry Points and Owners

- src/index.js — CRA entry; creates root and renders `src/v2/TimelineBuilderV2.tsx` inside `src/components/ErrorBoundary.tsx`.
  - Main dependants: `src/v2/TimelineBuilderV2.tsx`, `src/index.css`, `react-datepicker` CSS.
  - Owner: TODO (likely frontend lead)

- src/v2/TimelineBuilderV2.tsx — Main app composition (provider + v2 UI).
  - Main dependants: `src/hooks/useTimeline.tsx` (provider), `src/v2/Orchestrator.tsx`, `src/v2/*` screens/components.
  - Owner: TODO (v2 app maintainer)

- src/v2/Orchestrator.tsx — Core runtime orchestrator.
  - Main dependants: `src/hooks/useTimelineSelectors.tsx`, `src/actions/timelineActions.ts`, `src/services/TimelineCalculator.ts` (+ DAG modules).
  - Owner: TODO (scheduling domain owner)

- playwright.config.ts — E2E harness that auto-starts dev server for tests.
  - Main dependants: `src/__tests__/e2e/*.spec.ts`.
  - Owner: TODO (QA / test owners)

