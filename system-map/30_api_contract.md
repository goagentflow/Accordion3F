Date: 2025-09-20

Legend: Boxes show repo paths; arrows label protocols/events.

# API / Data Contracts

OpenAPI / GraphQL
- None present. No server-side API; app operates client-side.

Excel data (import/export)
- Importer: `src/services/ExcelImporter.js`
- Exporter: `src/services/ExcelExporter.js`
- Shapes inferred by code and types in `src/types/timeline.types.ts`:
  - Asset: `{ id: string; type: string; name: string; startDate: string }`
  - Task: `{ id, name, duration, owner ('c'|'m'|'a'|'l'), assetId, assetType, isCustom, dependencies? }`
  - TimelineTask extends Task: `{ start: ISO, end: ISO, progress, isCritical?, totalFloat? }`

Notes
- Column mappings and sheet names should be confirmed in `ExcelImporter.js`/`ExcelExporter.js`. If a formal schema is needed, propose documenting expected columns per sheet in a follow-up ADR.

TODO
- Document exact sheet/column mapping and sample files. Suspected owner: scheduling/import-export maintainer.

