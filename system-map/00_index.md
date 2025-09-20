Date: 2025-09-20

Legend: Boxes show repo paths; arrows label protocols/events.

# System Map — Accordion 3F (bird’s-eye)

What lives where
- Web app: `src/index.js` boots `src/v2/TimelineBuilderV2.tsx` inside `src/components/ErrorBoundary.tsx`.
- State/core: `src/hooks/useTimeline.tsx` (context/provider), `src/reducers/*.ts` (reducers), `src/actions/timelineActions.ts` (action creators), `src/hooks/useTimelineSelectors.tsx` (selectors).
- Scheduling logic: `src/services/TimelineCalculator.ts` (factory), `src/services/TimelineCalculatorDAG.ts` + `src/services/dag/*.ts` (DAG/CPM), `src/utils/dateHelpers.ts` (working days), validation in `src/services/*Validation*.ts`.
- UI: Gantt and controls in `src/components/*`, v2 flow under `src/v2/*` (notably `Orchestrator.tsx`, `CatalogContext.tsx`, `GettingStarted.tsx`).
- Import/Export: `src/services/ExcelImporter.js`, `src/services/ExcelExporter.js`.
- Feature flags/config: `src/config/features.ts` (localStorage-backed; dev-only debug window.timelineFeatureFlags). Build/runtime via CRA scripts in `package.json`, deploy hints in `netlify.toml`.

How data generally moves
- UI events (drag, keyboard, inputs) → dispatch via `TimelineActions` → reducers in `src/reducers/*` mutate state → selector hooks feed components.
- `src/v2/Orchestrator.tsx` watches selected assets/dates → chooses calculator via `src/config/features.ts` → computes timelines with `TimelineCalculator(DAG|Sequential)` → writes `tasks.timeline` and related warnings.
- Persistence: localStorage (flags; autosave in `src/services/AutoSaveManager.ts`). Import/export uses in-browser Excel read/write.

Where decisions tend to live
- Calculator selection and scheduling rules: `src/services/TimelineCalculator.ts`, `src/services/TimelineCalculatorDAG.ts`, `src/services/dag/*.ts`.
- Business rules (working days/holidays): `src/utils/dateHelpers.ts`.
- Validation/guardrails: `src/services/ValidationService.ts`, `src/services/DependencyValidationEnhanced.ts`.
- UI enablement: `src/config/features.ts`.

Top risks when changing the UI
- Gantt interactions (`src/components/Gantt*.js|.tsx`) are tightly coupled to drag/keyboard hooks; regressions can break manipulation and autosave.
- Orchestrator side-effects (rebuilds) can unintentionally reset timelines if `freezeImportedTimeline` isn’t respected.
- Changing date helpers or feature flags can alter schedule math globally.

Safest places for copy/layout tweaks
- Presentational components with minimal logic: `src/components/GanttLegend.js`, `src/components/TimelineDisplay.js`, labels in `src/v2/GettingStarted.tsx`.

Files in this folder
- 01_c4_context.mmd — Context diagram
- 02_c4_container.mmd — Container diagram
- 03_c4_component.mmd — Component diagram (main app)
- 10_dependency_graph.svg — Import graph (placeholder with generation instructions)
- 11_entry_points.md — Entry points and owners
- 20_runtime_surface.md — Routes/APIs/events/queues
- 30_api_contract.md — API/Excel schema summary
- 31_config_feature_flags.md — Config, env, flags
- 40_erd.mmd — ER model (logical)
- 50_decision_points.md — Rules/auth/pricing/scoring loci
- 60_adrs.md — ADRs if present

Change Guide (practical how‑to)
- system-map-change-guide/01_change_surfaces.md — Features → control points map
- system-map-change-guide/02_module_responsibility_matrix.md — Module roles and contracts
- system-map-change-guide/03_invariants_and_rules.md — Business rules with tests
- system-map-change-guide/04_impact_playbooks/ — Area-specific playbooks
- system-map-change-guide/05_test_topology.md — Test inventory and gaps
- system-map-change-guide/06_dependency_heatmap.svg — Heatmap overlay
- system-map-change-guide/07_guardrails.md — Flags/rollout checklist
- system-map-change-guide/08_glossary.md — Domain terms

How to change X safely
- Scheduling logic: see `04_impact_playbooks/scheduling_rules.md`; toggle via flags in `src/config/features.ts`.
- Task labels/names: see `04_impact_playbooks/task_naming_and_labels.md`; validate via `ValidationService.test.ts`.
- Date maths: see `04_impact_playbooks/date_helpers_and_offsets.md`; run TimelineCalculator unit tests.
- Excel I/O: see `04_impact_playbooks/excel_import_export.md`; run Excel transform unit + roundtrip E2E.
- UI copy/layout: see `04_impact_playbooks/ui_layout_copy.md`; run manipulation E2E to catch regressions.

TODO
- Owners for areas/modules. Suggested: product owner to assign maintainers for v2 Orchestrator and DAG services.
- Dependency graph regeneration
- Commands (from repo root):
- `npm run map:deps` → writes `system-map/10_dependency_graph.svg`
- `npm run map:heatmap` → writes `system-map-change-guide/06_dependency_heatmap.svg`
