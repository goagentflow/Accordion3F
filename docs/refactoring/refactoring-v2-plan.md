# Timeline Builder Refactor (V2) – Plan

Status: In Progress (Phase 1)
Owner: Tech Lead (TBD)
Last updated: 2025-09-07

## Purpose
Deliver a stable, PM‑friendly Timeline Builder that fixes V1’s reliability issues (timeline disappearing after edits/save/refresh) by completing the V2 architecture and matching V1’s UI/UX parity.

## Objectives
- Replace 28+ scattered state updates with a single reducer + context (predictable, immutable updates).
- Eliminate “disappearing timeline” via deterministic hydration and visibility rules.
- Achieve UI/UX parity with V1 so users don’t relearn the tool.
- Maintain performance and add guardrails for manipulation stability.

## Non‑Goals
- Re‑introducing removed analytics/optimization overlays in this phase.
- New features unrelated to manipulation/recovery reliability.

## Golden Rules Alignment
- Rule #1 Safety: No data loss, no crashes; explicit hydration lifecycle and error handling.
- Rule #2 400‑line max: Small, focused files/components; no monoliths.
- Rule #3 DRY: Single source of truth for calculations and state shapes.
- Rule #4 Clear roles: Containers orchestrate, components present, services calculate.
- Rule #5 One‑way state: Actions → Reducers → State → UI; no mutation.
- Rule #6 PM‑friendly: Clear feedback, visible status, recoverable flows.

---

## Phased Plan

### Phase 0 — Foundations (Layout + Shell)
Status: In Progress
Owner: Frontend Lead (TBD)
Target: T+2 days

Tasks:
- [ ] Replace HTML shell with standard CRA template (doctype, viewport, #root)
- [ ] Ensure exactly one `TimelineProvider` (remove duplicates)
- [ ] Align DOM so `.timeline-main` is the grid parent of controls/content
- [ ] Verify Tailwind compilation; apply `@apply` rules; remove dev placeholders
- [ ] Hide debug panels behind dev flag

- Fix HTML shell: standard CRA template, `<meta viewport>`, `<div id="root"></div>`.
- Single provider: exactly one `TimelineProvider` to avoid double hydration.
- Grid alignment: `.timeline-main` is the grid; left “controls” and right “content” are direct children.
- Styling system: one approach (Tailwind) compiled and applied; hide dev placeholders.

Acceptance criteria:
- Two-column desktop layout (controls left, chart right); no narrowed “mobile sliver”.
- No dev/debug blocks in main UI.

### Phase 1 — Feature Parity (Left Column)
Status: In Progress
Owner: Frontend Lead (TBD)
Target: T+3 days

Tasks:
- [x] Add V2 shell with left/right columns using existing components
- [x] Wire `AssetSelector` to context (available/selected/start)
- [x] Wire `CampaignSetup` to context (global date/toggle)
- [x] Expose Undo/Redo controls in left column
- [x] Amber banner in `CampaignSetup` when go‑live is a non‑working day (weekend/holiday)
- [x] Ensure controls are visible above the fold on desktop (spacing compaction)
- [x] Move Undo/Redo to header to match V1
- [x] Initialize catalog in V2 (list assets without search)
- [x] Add Excel Export/Import (round‑trip) controls to V2 header (with confirm replace)
- [x] Reintroduce "Getting Started" instructions in V2
 - [ ] Orchestrator parity: build timeline + warnings
  - [x] Fetch bank holidays (once)
  - [x] Build raw tasks per selected asset from catalog (include custom tasks)
  - [x] Run calculator (DAG/sequential flag)
  - [x] Dispatch UPDATE_TIMELINE, SET_CALCULATED_START_DATES
  - [x] Compute/show date warnings (insufficient time, Sunday‑only)

Acceptance criteria:
- All controls visible without scrolling; labels and behavior mirror V1.

### Phase 2 — Status + Persistence (Top Status Bar)
Status: Completed
- Save indicator: visible “Saving/Saved” states with clear copy; non‑blocking placement.
- Recovery prompt: appears on restore; accept/reject behaves correctly; copy human‑readable.

Acceptance criteria:
- Save → refresh → recover renders the same timeline reliably.
- Status copy is concise and non‑technical; placement does not obscure controls.

### Phase 3 — Chart Parity (Right Column)
Status: Completed
- Conflicts banner above chart (from `ui.dateErrors`).
- Working-days-needed cards via `GanttAssetAlerts`.
- Gantt structure and scroll consistent with V1.

Acceptance criteria:
- With assets + live date, task count and basic look/feel match V1.

### Phase 4 — Reliability (Crash/Disappear Fixes)
Status: Completed
Owner: Frontend + Platform (TBD)
Target: T+3 days

- Tasks:
- [x] Ensure single `TimelineProvider` wraps app entry
- [x] Prevent transient clears (do not blank timeline on momentary empty selections)
- [x] Weekend go‑live anchoring for final task in DAG (feature‑flagged)
- [x] Deterministic hydration flow (recover → import → wait for catalog → recompute once → ready)
- [x] Catalog readiness gate (CSV/local catalog loaded or fallback snapshot) before recompute/render
- [x] Gate autosave during hydration/recovery; resume with debounce after ready
- [x] Fix visibility guards to avoid false "empty" during transitions
- [x] Bounded undo/redo history; no reference leakage (enforced at 50)
- [ ] (Optional) Add schema version/migration for persisted state

- Hydration lifecycle: `isHydrating` gate; single recompute post-hydration; gate autosave until ready.
- Visibility condition: derived from valid `assets.selected` or `tasks.timeline`, never stale.
- State versioning/migration for persisted storage; refuse to render with partial state.
- Reducer invariants: immutability; no side effects in reducers.

Acceptance criteria:
- No “disappearing timeline” after edits or save/refresh across flows: fresh, manual save, auto-save recovery.

### Phase 5 — Drag/Manipulation Stability
- Drag queueing/coalescing bounded; cancel superseded drags; idempotent updates.
- Invariants: property-based/unit tests (no negative durations, valid date ranges, successful corrections).
- User feedback for rejected drags; never silent fail.

Acceptance criteria:
- Repeated drag/correction patterns are reliable; failure rate near zero; no material memory growth over long sessions.

### Phase 6 — Visual Parity + Polish
- Typography/spacing consistent; primary/secondary button hierarchy.
- Empty state: concise guidance (no debug JSON).

Acceptance criteria:
- Side-by-side screenshots V1 vs V2 show functionally equivalent placement/clarity for core controls.

### Phase 7 — Rollout + Safety
- Feature-flagged rollout; pilot group; collect non-PII logs around hydration/drag outcomes in dev.
- Visual regression: Playwright screenshot baseline for main view.

Acceptance criteria:
- Pilot confirms stability; no critical regressions; flag enabled broadly.

---

## Deliverables per Phase
- Code changes (scoped to phase), updated docs, and tests.
- E2E smokes (save/recover, drag/correct, multi-asset switching) per phase.
- Screenshot baseline for main view from Phase 6 onward.

## Risks & Mitigations
- Styling regression: Align DOM to grid; enable Tailwind; visual baseline tests.
- Persistence schema drift: Versioned storage + migration; parity tests (fresh vs recovered state).
- Double providers: Enforce single provider pattern in code review.
- Event backlog latency: Bounded drag queues; coalescing; cancel superseded events.

## Backout Plan
- Keep V1 as default while V2 is behind a flag.
- Phase-by-phase toggles allow partial enablement and quick rollback.

## Tracking & Status

- 0 Foundations: In Progress
- 1 Feature Parity (Left): In Progress
- 2 Status + Persistence: Completed
- 3 Chart Parity (Right): Completed
- 4 Reliability (Crashes): Completed
- 5 Manipulation Stability: Pending
- 6 Visual Parity + Polish: Pending
- 7 Rollout + Safety: Pending

Progress updates will be reflected here and in the team’s task tracker. Each phase must meet its acceptance criteria and pass unit/E2E smoke before moving on.

## Notes
- V2 stays disabled by default until Phases 0–4 are green.
- Link: docs/refactoring/GOLDEN-RULES.md for rule references during code review.
