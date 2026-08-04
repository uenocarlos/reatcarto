# Task Memory: task_03.md

## Objective Snapshot

- Delivered owner-only export path: `ExportEntry` + ephemeral `ExportMapShell` wired in `MapEditor`.
- All assigned IT/E2E cases (37 new + prior composition tests) passing.

## Important Decisions

- Snapshot captured once on open (`exportSnapshot` state + `exportSessionKey` remount); avoids session reset on parent re-render.
- Export shell session changes never write back to editor `basemap`/`hiddenIds` (isolation ADR-003/006).
- `generateDeps` prop on shell for test I/O injection at capture boundary.
- Dense-legend hint threshold: 80 items or PDF format (`DENSE_LEGEND_THRESHOLD` in `ExportControlsPanel`).

## Learnings

- Radix `Slider`/`ScrollArea` require `ResizeObserver` stub in Vitest setup.
- Dialog overlay blocks pointer events on entry button while open — use `fireEvent` or guard in harness for double-open tests.
- Preview location inset removal requires debounce flush after control changes.

## Files / Surfaces

- `src/components/map/ExportMapShell.jsx`, `ExportEntry.jsx`
- `src/components/map/export/ExportControlsPanel.jsx`, `exportShell.css`
- `src/page/MapEditor.jsx`, `src/components/map/LeafletMap.jsx` (controlled basemap)
- `tests/js/exportShell.test.jsx`, `exportEntry.test.jsx`, `exportAccess.test.jsx`, `exportE2E.test.jsx`, `helpers/exportHarness.jsx`
- `tests/js/setup.js` (ResizeObserver/pointer stubs)

## Errors / Corrections

- Initial CSS import path wrong (`./exportShell.css` vs `@/components/map/export/exportShell.css`).
- IT-050/051/072 needed `await Promise.resolve()` after async export start under fake timers.

## Ready for Next Run

- Feature complete for exportar-mapa PRD workflow; no task_04 in graph.
