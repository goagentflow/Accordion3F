Date: 2025-09-20

# UI Layout & Copy

- Files to touch first
  - `src/v2/GettingStarted.tsx` (copy), `src/components/GanttLegend.js`, `src/components/TimelineDisplay.js`
  - Styling: `src/index.css`

- What can break
  - Keyboard/drag affordances if DOM structure of Gantt rows changes
  - Tests relying on text selectors

- Tests to run or add
  - Run: `npm run test:unit` and E2E: `playwright test` for basic flows
  - Add: snapshot-like text assertions in E2E for changed labels

- Flags to use for a safe rollout
  - None required; layout changes not feature-gated. For risky UI toggles, consider temporary flag in `src/config/features.ts`

- Telemetry or log lines to verify
  - Use `console.log` only in development. For keyboard help overlay, see `useKeyboardShortcuts.ts` (logs in debug mode)

