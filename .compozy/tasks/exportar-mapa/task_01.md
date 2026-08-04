---
status: completed
title: "Export core library: assets, session, geo loader, and generate pipeline"
type: frontend
complexity: high
---

# Task 1: Export core library: assets, session, geo loader, and generate pipeline

## Overview
Delivers the pure client-side foundation for map export: institutional branding assets, ephemeral session factories and reducers, Brazilian boundary loading against static `public/geo/`, and the PNG/PDF generation pipeline (`html-to-image` + `jspdf`). Later UI tasks consume this contract without server print APIs and without persisting layout templates.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST introduce static branding assets under `public/export/` (REAT logo and north arrow) and fixed institutional footer copy in a non-editable module (paths and strings align with ADR-004).
2. MUST implement `createEditorExportSnapshot`, `createDefaultExportSession`, session reducers/setters that keep format switches from wiping paper/orientation/DPI/legend options, and independent states per open (no module-level singleton leaking options).
3. MUST clamp DPI to 72–600, reject non-numeric DPI while retaining previous valid value, default DPI 300, paper defaults A4 landscape, format default `png`.
4. MUST enforce non-empty trimmed title for download via `assertExportTitle` with stable code `empty_title` (ADR-011); filenames MUST sanitize path separators and end with `.png` or `.pdf`.
5. MUST map editor basemap keys `branco` | `osm` | `satelite` (unknown → `branco` fallback) and share tile URL intent with `LeafletMap` basemap table.
6. MUST provide `buildLegendItems` from visible elements + optional location sources; empty inputs return `[]` without throw; support legend metrics/columns 1–6 and font/spacing bounds from the TechSpec data model.
7. MUST implement `loadGeoBoundaries` against the real repo layout (`/geo/ufs.geojson`, per-UF `/geo/municipios/*.geojson`, and available context assets), normalize properties, cache successful loads in-module, and surface load failures without marking cache successful.
8. MUST add `html-to-image` dependency and implement `generateExport` that settles/probes tiles, captures composition, produces PNG or PDF via `jspdf`, downloads via object URL + anchor, supports AbortSignal (`aborted`), and maps failures to stable codes (`tiles` | `memory` | `capture` | `validation`).
9. MUST provide pure helpers for preview debounce/flush (ADR-010) and graphic scale labels at mid and extreme zooms (no NaN).
10. MUST NOT introduce PHP export endpoints, server-side layout tables, or persisted `export_settings` for this version (ADR-003; diverge from any prior HEAD persistence).
11. MUST implement and pass every assigned test case in `## Tests` under `tests/js/` with Vitest fakes only at fetch/download/`html-to-image`/`jspdf` boundaries.
</requirements>

## Subtasks
- [x] 1.1 Ship `public/export/` logo and north assets (migrate/copy from product logos such as `public/logo.png` / `public/norte.png` as needed) and wire public path constants
- [x] 1.2 Implement branding module with fixed REAT/FURG footer lines and logo path `/export/logoreat.png` (or constant equal to that path)
- [x] 1.3 Implement paper/DPI constants and pure session factory + setters (defaults, inheritance snapshot, format retention, legend metrics)
- [x] 1.4 Implement title gate, filename builder, basemap key map, legend item builder
- [x] 1.5 Implement preview debounce/flush helpers and scale label helpers
- [x] 1.6 Implement geo boundary loader + UF municipality filter + selection validators against existing `public/geo` layout
- [x] 1.7 Add `html-to-image`; implement injectable `generateExport` (PNG, PDF, abort, error codes, single download path)
- [x] 1.8 Add Vitest suites for all assigned UT IDs; ensure `tests/js/setup.js` exists when missing
- [x] 1.9 Document/export public module surface used by composition UI (no React shell in this task)

## Implementation Details
Follow TechSpec **Core Interfaces**, **Data Models**, **Development Sequencing** steps 1–3, and ADRs listed below. Prefer pure modules under `src/lib/export/*` matching existing JSDoc style in `src/lib/`. Align geo property normalization with fixtures under `public/geo` (real paths: `ufs.geojson` + `municipios/{UF}.geojson` — not fictional monolithic `municipalities.geojson` unless an adapter renames internally). If restoring fragments from Git HEAD export modules, rewrite them to ephemeral session + `html-to-image` + PDF; do not reintroduce `export_settings` persistence.

### Relevant Files
- `package.json` — add `html-to-image`; already has `jspdf` and unused/legacy `html2canvas`
- `vitest.config.js` — Vitest include `tests/js/**/*.test.{js,ts}`, alias `@`
- `src/components/map/LeafletMap.jsx` — `BASEMAP_URLS` keys/URLs to mirror in basemap map helpers
- `public/geo/ufs.geojson`, `public/geo/municipios/*.geojson`, `public/geo/meta.json` — boundary data sources
- `public/logo.png`, `public/norte.png`, `public/borda.png` — existing brand/cartography bitmaps
- `.idea/printJs.php` — legacy parity reference for footer strings, defaults, capture intent
- `.compozy/tasks/exportar-mapa/_techspec.md` — interfaces and sequencing
- `.compozy/tasks/exportar-mapa/_tests.md` — full UT definitions

### Dependent Files
- `public/export/logoreat.png` — create (institutional logo for capture)
- `public/export/north.png` — create (north graphic for chrome consumers)
- `src/lib/export/branding.js` (or equivalent) — fixed institutional strings + asset paths
- `src/lib/export/session.js` (or split: defaults, clamp, title, basemap, legend metrics) — ephemeral state API
- `src/lib/export/legendItems.js` — `buildLegendItems`
- `src/lib/export/previewSync.js` — debounce + flush
- `src/lib/export/geoBoundaries.js` — load/cache/filter/validate
- `src/lib/export/scale.js` — scale label helper
- `src/lib/export/generateExport.js` — capture/download pipeline
- `tests/js/setup.js` — ensure present for Vitest
- `tests/js/**/*export*.test.js` (or named per module) — assigned unit tests
- Module surface imported later by `src/components/map/export/*` (task_02/03)

### Related ADRs
- [ADR-003: Ephemeral export session configuration](adrs/adr-003.md) — no server print templates
- [ADR-004: Fixed REAT/FURG institutional branding on exports](adrs/adr-004.md) — footer + logo constants
- [ADR-008: Client-side capture with html-to-image and jsPDF](adrs/adr-008.md) — generation pipeline
- [ADR-009: Static Brazilian admin boundaries under public/geo](adrs/adr-009.md) — geo hosting
- [ADR-010: Debounced live preview](adrs/adr-010.md) — pure debounce helpers
- [ADR-011: Non-empty title required for download](adrs/adr-011.md) — title validation

## Deliverables
- Installable pure export library modules with documented imports
- Static brand assets under `public/export/`
- Working `generateExport` testable with injectable I/O fakes
- Geo loader using on-disk `public/geo` layout with session cache
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-001, UT-002, UT-006, UT-014, UT-016, UT-017 — session factory defaults, blank title inheritance, basemap/hiddenIds copy, snapshot element freeze, independent open states
- [x] UT-003, UT-004, UT-005, UT-045 — title/authorship flow, empty_title gate, special chars + sanitized filenames
- [x] UT-007, UT-008, UT-009, UT-013 — DPI clamp/non-numeric, format switch retention, long title formatting helper
- [x] UT-010, UT-011, UT-012 — preview debounce schedule, flush, last-write-wins columns
- [x] UT-015 — basemap key mapping + unknown fallback
- [x] UT-020, UT-021, UT-022, UT-023, UT-024, UT-025, UT-026 — legend builder empty/huge/point/hide/columns/font/spacing/metrics
- [x] UT-030, UT-031 — institutional footer lines + logo path; credits empty still keep institutional lines
- [x] UT-050, UT-051, UT-052, UT-053, UT-054, UT-055 — geo load/cache, UF filter, 404, selection rules, dual same-UF allowed, locationCount→0
- [x] UT-060, UT-061 — scale helpers mid/extreme zoom
- [x] UT-040, UT-041, UT-042, UT-043, UT-044 — generateExport tiles timeout, memory mapping, PNG, PDF, abort

## Success Criteria
- Every assigned test case implemented and passing
- No new PHP export endpoints or server layout persistence
- Public constants resolve logo to product export branding path
- Pure modules importable without React tree or Leaflet map constructors
- `npm test` / `vitest run` covers new suites without failing assigned UTs
