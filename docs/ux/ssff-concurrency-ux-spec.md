# SS/FF Same‑Day Concurrency – Phase 2 UX Spec (v1)

Owner: MMM Timeline
Status: For Review (UX sign‑off required before Phase 3)
Scope: Specify interaction, visuals, keyboard access, errors, export/import, migration, snap rules, performance.

## 1) Overview

- Goal: Allow users to cluster tasks on the same working day anywhere in the plan using SS=0 (start together) or FF=0 (finish together) without breaking DAG properties or weekend rules.
- Primary entry: Drag a task bar onto another bar in the same asset to create a same‑day link via a chooser (Alt/Option remains a shortcut).
- Safety: Weekend rule enforced (only Live can land on weekend). Graceful fallback remains in place.

## 2) Core Interaction Patterns

### 2.1 Create same‑day link
- Drag A onto B (same asset) → open chooser attached to target B.
- Default selection:
  - If A is dropped on a later task (A occurs before B): FF=0 (finish together).
  - If A is dropped on an earlier task (A occurs after B): SS=0 (start together).
- Chooser buttons:
  - “Finish together (FF=0)” – Bars end the same day.
  - “Start together (SS=0)” – Bars start the same day.
- Secondary shortcut: Alt/Option toggles selection while chooser is open.
- Confirm applies dependency; Cancel aborts.

### 2.2 Remove link
- Context menu on link badge or dependency line: “Remove same‑day link”.
- Undo/Redo applicable.

### 2.3 Move (no link)
- Drag A to empty space (date cell), no chooser; performs a move respecting non‑working‑day rules.

## 3) Visuals – 8 Annotated Wireframes (text)

Legend: [A] = dragged task; [B] = target task; [] = button; ( ) = hint; ─ lines approximate position.

1) Idle
```
| Task A: Design         |
| Task B: Final Setup    |   (No overlays; existing dependency badges visible if any: 🔗 0d)
```

2) Drag (valid hover)
```
| Task A: Design  [dragging] ─────────▶ |
| [TARGET] Task B: Final Setup | [Green outline]
 (Pill near cursor: FF=0 or SS=0 • ‘Release to select link type’)
```

3) Drag (invalid hover)
```
| [TARGET] Task X (other asset) | [Red outline]
 (Tooltip: ‘Invalid target: cross‑asset’ or ‘Would create cycle’)
```

4) Drop chooser (attached popover)
```
 ┌ Same‑day link ┐
 │ Finish together (FF=0) [default] │
 │ Start together (SS=0)            │
 │                                  │
 │ Choose how these align on the    │
 │ same working day.                │
 │                                  │
 │ [Confirm]      [Cancel]          │
 │ (Alt toggles)                    │
 └───────────────────────────────────┘ (popover anchored to target bar)
```

5) Success (cluster)
```
| [Task A]====  🔗0d |
| [Task B]====  🔗0d |   (Stacked visually; small badge shows same‑day link; line draws between them)
 (Toast: ‘Linked to Final Setup (FF=0)’)
```

6) Context actions
```
Right‑click on 🔗0d badge → Menu:
  • Remove same‑day link
  • Open details
```

7) Weekend snap modal (non‑live block)
```
Only Live can land on weekends.
Snap to previous working day (Fri 14 Nov)?
[Snap] [Cancel]
```

8) Fallback banner (existing)
```
[⚠] Advanced scheduling failed for “<Asset>”. Showing safe timeline. [Undo last change] [Retry advanced scheduling]
```

## 4) Dependency Chain Semantics

- On confirm, add exactly one directed edge between A and B:
  - FF=0: Edge A→B with FF semantics (finish together).
  - SS=0: Edge A→B with SS semantics (start together).
- Drag‑created inbound edges to B: remove conflicting inbound drag‑created links to keep one inbound predecessor per successor from the drag UI (prevents cycles). Explicit CSV/template constraints remain unless contradictory; if contradictory, chooser displays note and we remove the conflicting inbound link.
- Downstream behavior: No imperative reparenting. CPM recalculation governs schedule. If the new link alters the critical path, auto‑compression occurs due to live‑date anchoring; upstream tasks move forward naturally.

## 5) “No Savings” Behavior

- Link still created (honor user intent); display toast: “Linked (no days saved on the critical path).”
- Status card unchanged; user can remove link as needed.

## 6) Export / Import Specification

- Persist on task objects (already stored in DO_NOT_EDIT_DATA.timeline):
  - `dependencies: [{ predecessorId: string, type: 'FS'|'SS'|'FF', lag: number }]`
- Export:
  - Write dependency `type` verbatim. Include `lag` (integer; negative = overlap).
- Import:
  - Preserve `type` and `lag`. Missing `type` defaults to `FS`. Unknown types ignored (warn in dev);
  - Backward compatible with existing exports (which already serialize dependencies when present).

## 7) Migration Plan

- In‑app state: Do not auto‑convert existing links to SS/FF. Keep current FS+lag semantics.
- Legacy exports: No SS/FF inference. Honor explicit `type` only.
- Feature flags: If SS/FF disabled, degrade at calculation time to equivalent FS scheduling for display (no rewrite on export unless user exports under flag‑on).

## 8) Weekend Snap Logic (Non‑Live)

Algorithm when resulting date is weekend/holiday for any non‑live task:
1. Compute previous working day considering bank holidays (dateHelpers).
2. If snapping would break feasibility (start < predecessor end given constraints), disable Snap with inline reason; require Cancel.
3. For clusters: Evaluate all members; if any cannot snap feasibly, show a list of blocking items; cancel as one unit.
4. Live task exception: Live may land on weekend; non‑live same‑day partners still blocked → show snap modal for those partners only.

## 9) Keyboard Navigation

- Enter link mode: Select a task row, press `L`.
- Target navigation: Arrow keys cycle through tasks in the same asset (skips invalid targets). Screen reader announces validity and reason for invalid.
- Confirm: `Enter` opens chooser; `Tab` to move focus; `Space/Enter` to select; `Esc` cancels. `S` toggles SS/FF inside chooser (Alt/Option also toggles).
- Remove link: Focus badge, press `Delete`, confirm (or use context menu key).

## 10) Error Recovery Flows

- Cycle/Invalid on confirm: Inline red text in chooser; Confirm disabled; no state change.
- DAG failure or timeout after link: Graceful fallback banner; cluster remains with dashed badge style indicating limited scheduling; actions: [Undo last change], [Retry].
- Last‑good recall: Per‑asset cache; used automatically; user can remove the link to recover advanced scheduling.

## 11) Performance Considerations

- Recalc debounce: 150ms debounce for burst edits; queue latest only.
- CPM limits: 1,000 max iterations per pass; 5s time budget per asset (already implemented); fallback on exceed.
- Display:
  - Cluster rendering is O(k) where k = tasks sharing a day; for large k, simplify line rendering (no arrowheads) to reduce DOM.
- Targets:
  - 50 tasks: < 500ms typical; 100 tasks: < 2s typical. Fallback if budgets exceeded.

## 12) Acceptance Criteria

1) Users can create SS=0/FF=0 clusters anywhere via chooser; Alt is optional.
2) 8 visual states occur as specified; keyboard and SR users can complete the flow.
3) Weekend rule enforced; snap modal handles clusters atomically; no partial snap.
4) “No savings” creates the link with clear messaging; no errors.
5) Export/Import round‑trips SS/FF; legacy files unaffected.
6) Errors never hide the timeline; fallback banner appears with actionable options.
7) Undo/Redo works for link changes and moves.

## 13) Open Questions (for Lucy/Stakeholders)

- Default chooser selection: Confirm FF=0 as default when dropping onto later tasks? Any preference to always default FF=0?
- Max cluster size: Do we need a UI cap per asset day to prevent visual clutter (e.g., >10 tasks)?
- Copy tone: Approve final microcopy for toasts and modals.

