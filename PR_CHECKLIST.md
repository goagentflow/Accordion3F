Date: 2025-09-20

# PR Checklist

- Feature flag
  - [ ] New/risky behaviour is gated behind a flag in `src/config/features.ts` (defaults safe)
  - [ ] Rollout plan captured in `system-map-change-guide/07_guardrails.md`

- Tests
  - [ ] Unit tests updated/added for rules/invariants (see `system-map-change-guide/03_invariants_and_rules.md`)
  - [ ] E2E updated if user-facing behaviour changes (selectors/text)
  - [ ] `npm run test:all` passes locally

- Telemetry/Logging (dev)
  - [ ] Add debug logs where behaviour changes (guarded by `DEBUG_TIMELINE_CALCULATIONS`)
  - [ ] Include minimal payloads to verify decisions (see guardrails doc)

- Change guide updates
  - [ ] Update `system-map-change-guide/01_change_surfaces.md` if control points moved
  - [ ] Update relevant playbook(s) under `04_impact_playbooks/`

- Dependency graphs (optional for large changes)
  - [ ] Regenerate graphs: `npm run map:deps` and `npm run map:heatmap`

- Links
  - Playbooks: `system-map-change-guide/04_impact_playbooks/`
  - Rules: `system-map-change-guide/03_invariants_and_rules.md`
  - Guardrails: `system-map-change-guide/07_guardrails.md`

