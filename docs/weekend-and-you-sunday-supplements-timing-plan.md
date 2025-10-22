# Weekend and You Sunday Supplements Timing Plan

## Context and Challenge

- Client requirement: For Sunday supplements (Weekend and You), ensure two business‑critical anchors relative to the issue date (Saturday for Weekend, Sunday for You):
  - Client Sign‑off on the Tuesday two weeks before issue.
  - Repro (Send to Press) on the Wednesday in the week before issue.
- Current data model: CSV encodes generic durations/owners with a Sunday go‑live, but does not encode weekday anchors. As a result, Sign‑off and Repro float based on durations and working‑day math, and will not reliably land on Tuesday/Wednesday, nor guarantee the intended lead‑time.
- Goal: Enforce weekday anchors safely without complicating the CSV or breaking other assets.

## Goals and Success Criteria

- Enforce two weekday anchors for the two Sunday Supplement asset types:
  - Sign‑off → Tuesday, two weeks before Sunday.
  - Repro → Wednesday, one week before Sunday.
- Keep baseline CPM schedule unless anchors are feasible (no forced bad timelines).
- Snap anchors to the prior working day when they fall on bank holidays and re‑validate constraints.
- Show at most one concise banner per affected asset explaining adjustments or infeasibility.
- No impact on non‑supplement assets; behavior gated by a feature flag.

## Scope

- Assets: "Weekend Saturday Supplement Full Page" (Saturday go-live) and "You Sunday Supplement Full Page" (Sunday go-live).
- Target tasks: "Client Confirms Sign off" (Sign‑off) and "Repro and Printing" (Send to Press). The task is named "Repro and Printing" in data/UI to represent the full printing process; use "Repro and Printing (Send to Press)" in explanatory copy if needed.
- Feature flag: `ENABLE_SUPPLEMENT_ANCHORS` (default: false), enabling safe rollout and rollback.

## Technical Approach (High‑Level)

- Post‑processing anchoring after CPM/sequential calculation (keep calculators clean).
- Feasibility‑first: Evaluate anchors against the baseline timeline before applying any changes.
- No forced moves: If infeasible, leave the baseline as‑is and present a single banner with clear guidance.
- Snap + re‑validate: If Tuesday/Wednesday is a holiday, snap to the previous working day and re‑validate order and gaps.
- Single banner per asset with graduated severity (INFO/NOTICE/WARNING/ERROR).
- Telemetry for production monitoring of anchor application and holiday snaps.
- No CSV schema changes. Limited, asset‑specific logic behind a feature flag.

## Detailed Design

### Feature Flag

- `ENABLE_SUPPLEMENT_ANCHORS` in the feature flags module; exposed in dev debug interface for toggling.

### Asset Scope & Task Identification

- Apply only when asset type ∈ {Weekend Saturday Supplement Full Page (Saturday), You Sunday Supplement Full Page (Sunday)}.
- Required task names in the timeline: "Client Confirms Sign off" and "Repro and Printing". If either is missing, skip anchoring.

### Anchor Target Calculation

- Inputs: `liveDate: Date`, `bankHolidays: string[]`.
- Targets:
  - Sign‑off target = Tuesday of week (live week − 2).
  - Repro target = Wednesday of week (live week − 1).
- Snap policy: If a target falls on a holiday/weekend, snap to the prior working day using bank‑holiday aware helpers.

### Feasibility Check (Run After CPM; No Mutation)

- Compute snapped ends for both anchors; derive each task’s start by subtracting its duration in working days.
- Validate local ordering and durations:
  - All predecessors of Sign‑off must finish on or before Sign‑off start.
  - Sign‑off end ≤ Repro start; Repro end ≤ Live end.
  - No zero/negative compression for immediate neighbors (if applying anchors would force an adjacent task to ≤ 0 days, it is infeasible).
- Minimum gap semantics:
  - Use weekday anchoring as the primary rule.
  - If the business requires a numeric minimum for Repro (e.g., at least 10 calendar days before issue), validate calendar days and include working‑day count in messages. Recommend: calendar days for PM clarity.
- Output:
  - `possible: boolean` with `reason` when false.
  - `effects`: `signOffSnapped`, `reproSnapped`, `gapCalendarDays`, `gapWorkingDays`, `compressionNeeded`.

### Apply Anchors (Post‑Processing)

- If feasible, set Sign‑off end to snapped Tuesday (or prior working day) and recompute its start by working‑day duration. Repeat for Repro with Wednesday.
- Do not propagate complex ripple effects. If order breaks or immediate neighbors require impossible compression, abort and keep the baseline timeline with an ERROR banner.
- Re‑validate the local segment (predecessors → Sign‑off → Repro → Live) after adjustment.

### Warnings Model (One Banner per Asset)

- Severity:
  - INFO: Anchors applied as requested.
  - NOTICE: Anchors applied but snapped due to holidays (e.g., “Sign‑off moved to Friday; 16 days before issue due to consecutive holidays”).
  - WARNING: Anchors applied but minimum gap is below recommended threshold (if numeric rule enabled).
  - ERROR: Anchors cannot be applied (e.g., would require zero/negative duration on immediate predecessor/successor or insufficient time).
- Message guidance:
  - Include both calendar and working days when discussing gaps (e.g., “10 calendar days (7 working days) before live”).
  - Avoid multiple messages; consolidate into a single banner.

### Integration Points

- Timeline factory: After building the baseline (DAG or sequential), if the flag is on and the asset is in scope:
  1) Calculate targets; 2) Run feasibility; 3) If infeasible, store ERROR banner and return baseline; 4) If feasible, apply anchors, compute banner (INFO/NOTICE/WARNING), return anchored timeline.
- Warnings plumbing: Add a small state slice mapping `assetId -> { severity, message }` and render a single banner in the existing conflicts panel (V1/V2) per affected asset.
- Telemetry (if available): For each asset compute event fields:
  - `supplement_anchor_applied` (boolean)
  - `signOffSnapped` (boolean), `reproSnapped` (boolean)
  - `gapPreserved` (boolean; for numeric Repro rule)
  - `compressionNeeded` (number of days)

## Edge Cases

- Double holiday cascade (e.g., Tuesday + Monday): Snap left to the previous working day (often Friday). Accept the drift and raise NOTICE while preserving a valid order.
- Missing tasks: If either Sign‑off or Repro is missing for the asset, skip anchoring; dev‑only console note; no user banner.
- Live date not on required day: Existing day-of-week validation handles this; anchoring is only designed for the correct day (Saturday for Weekend, Sunday for You).
- Month/year boundaries and DST week: Covered by date utilities and tests; include boundary scenarios in unit tests.

## Testing Plan

- Unit tests (targeted):
  - Normal Sunday (no holidays): Anchors exact Tue/Wed; INFO.
  - Sunday after Christmas: Tue = bank holiday, snap to Mon; NOTICE and correct drift.
  - First Sunday of month/year boundary: Weekday targeting and ordering correct.
  - Minimal time available: Feasible with non‑negative durations; INFO or WARNING depending on numeric Repro gap rule.
  - Insufficient time: Infeasible → ERROR; baseline unchanged.
  - Double holiday (Tue + Mon): Snap to Friday; NOTICE; verify gaps.
- E2E (one per asset): Select supplement, set Sunday live, verify anchored dates appear in Gantt, and a single banner when snapping/limits occur.

## Rollout Plan

- Behind feature flag; OFF by default in production.
- Enable in staging; QA using test scenarios; monitor telemetry (applied%, snap rate, infeasible rate).
- Enable in production once stable; retain flag for fast rollback.

## Risks and Mitigations

- Ambiguity on “10 days” minimum: Treat as calendar days (PM‑friendly); include working‑day counts in messages; confirm with stakeholders.
- User confusion around printing duration: Task renamed to "Repro and Printing" (9 days) to clearly represent the full printing process; Issue Date reduced to 1 day to represent the actual publication date.
- Over‑constraint/CPM conflicts: Feasibility‑first with no forced moves prevents invalid timelines.
- Regression risk: Isolated, flagged, asset‑scoped; covered by targeted unit and E2E tests.

## Open Decisions (Stakeholder Sign‑off)

1) Numeric “10‑day before” rule for Repro: Enforce as calendar‑day minimum in addition to the Wednesday anchor? Severity when violated (WARNING vs ERROR)?
2) Double‑holiday drift acceptance: Confirm NOTICE policy for snapping beyond the exact weekday anchor.
3) Banner wording: Confirm inclusion of both calendar and working‑day counts in messages; confirm use of "Repro and Printing (Send to Press)" in explanatory copy.

## Golden Rules Compliance (Internal)

- Safety First: Feasibility check prevents impossible timelines; no forced moves.
- 400 Line Max: Estimated 180–230 LOC across feasibility, post‑processor, warnings, and tests.
- DRY/Clear Roles: Anchoring owned by a post‑processing module; reusable date helpers.
- State Flow: Apply anchors in one place after timeline calculation.
- PM‑Friendly: Single banner, predictable weekday anchors, minimal surface area.
- Testing: Targeted unit + one E2E scenario per asset.

## Appendix: Example Banner Copy

- INFO: "Sunday Supplement anchors applied: Sign‑off on Tuesday two weeks before issue; Repro and Printing on Wednesday the week before."
- NOTICE: “Anchors adjusted due to holidays: Sign‑off moved to Friday (16 calendar days before issue).”
- WARNING: “Repro anchor set, but gap is 9 calendar days (6 working days); recommended minimum is 10 calendar days.”
- ERROR: “Cannot apply weekday anchors: would require ‘Final Amended and Subbed layout…’ to complete in 0 days (short by 3 working days). Baseline timeline preserved.”

