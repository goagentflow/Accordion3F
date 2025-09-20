Date: 2025-09-20

# Excel Import/Export

- Files to touch first
  - Import: `src/services/ExcelImporter.js` (1–116 parsing/validation; rest transforms)
  - Export: `src/services/ExcelExporter.js` (writer and sheet layout)
  - Orchestrator integration: `instanceBase` handling (approx. 110–167)

- What can break
  - Dependency metadata (negative lags) lost or mis-mapped
  - Large metadata chunking/decompression paths
  - Versioning of saved payloads

- Tests to run or add
  - Run: `src/__tests__/unit/ExcelImportTransform.test.ts`, `ExcelConcurrencyTransform.test.ts`, E2E edge-cases
  - Add: roundtrip test asserting deps and dates preserved through export→import

- Flags to use for a safe rollout
  - Use `freezeImportedTimeline` UI toggle during import/regression testing

- Telemetry or log lines to verify
  - Importer: count of tasks skipped/warnings; dropped dependency references (see Orchestrator warn at ~160)
  - Exporter: include metadata `version` and timestamp

