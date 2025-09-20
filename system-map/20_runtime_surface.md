Date: 2025-09-20

Legend: Boxes show repo paths; arrows label protocols/events.

# Runtime Surface

Web routes/pages
- Single-page app (no `react-router` detected). Entry is `src/index.js`.

APIs / GraphQL
- None in repo. No Express/Fastify/Hono/Apollo/OpenAPI/Swagger found. The app runs fully in-browser.

Browser storage/events
- localStorage keys:
  - `timeline_feature_flags` (managed by `src/config/features.ts`).
  - Autosave state (see `src/services/AutoSaveManager.ts`).
- Events:
  - Keyboard shortcuts: `src/hooks/useKeyboardShortcuts.ts`.
  - Drag/drop for Gantt: `src/hooks/useGanttDrag.ts`, plus component handlers in `src/components/Gantt*.js|.tsx`.
  - Before unload: `src/hooks/useBeforeUnload.ts` (ensure state/autosave persistence).

External I/O
- Excel import/export: `src/services/ExcelImporter.js`, `src/services/ExcelExporter.js` (file upload/download using ExcelJS).

Schedulers / background jobs / queues
- None. Orchestration happens in React effects within `src/v2/Orchestrator.tsx`.

