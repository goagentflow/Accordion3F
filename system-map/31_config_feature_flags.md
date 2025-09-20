Date: 2025-09-20

Legend: Boxes show repo paths; arrows label protocols/events.

# Config, Env Vars, Feature Flags

Key config files
- `package.json` — CRA scripts (`start`, `build`, `test`, `test:unit`, `test:e2e`, `test:all`).
- `playwright.config.ts` — E2E server auto-start.
- `netlify.toml` — Deploy config (static hosting).
- `tsconfig.json` — TS settings used by tooling and some TS files.

Environment variables
- CRA convention (`REACT_APP_*`) not observed in source. `process.env.NODE_ENV` used in `src/config/features.ts`.

Feature flags — `src/config/features.ts`
- Storage: localStorage key `timeline_feature_flags` (disabled in production builds; prod uses defaults only).
- Defaults (conservative):
  - `USE_DAG_CALCULATOR`: true
  - `ENABLE_TASK_OVERLAPS`: false
  - `SHOW_CRITICAL_PATH`: false
  - `ENABLE_DEPENDENCY_UI`: false
  - `DEBUG_TIMELINE_CALCULATIONS`: dev-only (true when `NODE_ENV==='development'`)
  - `ALLOW_WEEKEND_LIVE_DATE`: true
- Dev-only debug interface: `window.timelineFeatureFlags` exposing enable/disable/toggle/reset helpers (removed in production builds).

Other runtime config
- Autosave management: `src/services/AutoSaveManager.ts` (uses localStorage; keys and retention strategy live in code).

TODO
- Confirm autosave storage keys and retention policy. Suspected owner: state/persistence maintainer.

