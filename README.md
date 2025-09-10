# Accordion Timeline Builder – Production Notes

## Editable Import (Import → Amend → Export)
- Importing an Excel file now creates a fully editable plan.
- The imported tasks (including custom tasks, names, durations and dependencies) become the per‑asset base used by the scheduler.
- After import you can:
  - Change global/per‑asset go‑live dates (timeline recalculates)
  - Shorten/extend durations and drag to create overlaps
  - Add custom tasks (Insert After) and rename tasks/assets
- Export the updated plan to Excel. Re‑import later to continue. Do not edit the “DO_NOT_EDIT_DATA” sheet in Excel; changing it will prevent regeneration.

## CSV Path (Public Asset) and Sub‑Path Deployments
- The app loads `public/Group_Asset_Task_Time.csv` at start to seed the catalog.
- A robust fallback chain is used:
  1. `${PUBLIC_URL}/Group_Asset_Task_Time.csv` (for sub‑path deployments)
  2. `/Group_Asset_Task_Time.csv` (root path)
  3. `${window.location.origin}/Group_Asset_Task_Time.csv` (legacy fallback)
- For sub‑path deployments (e.g., `/app/`), set `PUBLIC_URL=/app` at build time:
  - `PUBLIC_URL=/app npm run build`

## Saving
- Refreshing/closing the browser will lose in‑page edits; you’ll be warned.
- Use Export to Excel to save a working copy; Import that file to resume work.

## Production Safety
- Debug logging is disabled in production builds; no localStorage clearing.
- Deploy the built `build/` folder behind an SPA‑friendly server (fallback to `/index.html`).

