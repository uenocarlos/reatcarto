# Workflow Memory

## Current State

- task_01 complete: pure export library under `src/lib/export/` with unit tests.
- task_02 complete: composition components under `src/components/map/export/`.
- task_03 complete: `ExportMapShell` + `MapEditor` wiring; 86 Vitest tests passing.
- Static assets at `public/export/`; geo data at `public/geo/ufs.geojson` + `municipios/{numericUfId}.geojson`.

## Shared Decisions

- Ephemeral session only (ADR-003); no PHP export endpoints or persisted layout templates.
- Basemap keys: `branco` | `osm` | `satelite` (unknown → `branco`); tile URLs mirror `LeafletMap` `BASEMAP_URLS`.
- Download blocked when title trim empty (`empty_title` / `validation` in generate path).

## Shared Learnings

- Geo property normalization: states `{ uf, name, code }`, municipalities `{ code, name, uf }`.
- `html-to-image` + existing `jspdf` for capture; inject deps at I/O boundaries in tests.

## Open Risks

- Full municipio bundle load is per-UF file iteration; large exports may need lazy UF loading in UI.
- Dialog accessibility: Radix warns missing `Description` on export shell — optional polish.

## Handoffs

- Public import surface: `@/lib/export` (`index.js`).
- Logo path constant: `/export/logoreat.png`.
- Composition UI package: `src/components/map/export/CompositionPreview.jsx` (capture root `data-testid="export-composition-root"`).
- Export shell entry: `MapEditor` header `ExportEntry` → `ExportMapShell` (keyed remount per open).
- Vitest stubs for Leaflet live under `tests/js/mocks/` via `vitest.config.js` aliases.
