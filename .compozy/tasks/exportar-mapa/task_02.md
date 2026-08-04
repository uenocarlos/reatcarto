---
status: completed
title: "Export composition surface: main map, chrome, legend, and location insets"
type: frontend
complexity: high
---

# Task 2: Export composition surface: main map, chrome, legend, and location insets

## Overview
Delivers the dedicated Leaflet/DOM composition surface that the export shell mounts for WYSIWYG preview and capture: main export map with cartographic chrome, legend layout modes, zero-to-two location insets with regional styling, and fixed institutional footer. It isolates editor map state (ADR-007) and consumes task_01 libraries for session shapes, branding, geo data, and legend items.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST render a dedicated export main map (`react-leaflet` MapContainer or equivalent) separate from the editor map; layers come from export session elements/hiddenIds/basemap (same tile URL set as editor).
2. MUST paint cartographic chrome always on the main export map composition: graphic scale, north indicator (asset), graticule, decorative frame; labels toggle MUST compose with chrome without removing scale/north/graticule.
3. MUST implement legend regions for positions `inside` | `right` | `bottom` driven by `buildLegendItems`; inside supports drag/resize metrics from session; right supports width adjustment; numeric controls MUST update the same metrics state.
4. MUST support locationCount 0|1|2 inset maps with UF/municipality selection props, independent dual same-UF insets, municipal mesh and state-on-legend styling, state/município color props, and clean teardown when count returns to 0.
5. MUST surface geo load failure states for consumers when boundaries fail; incomplete political geometry MUST NOT be rendered as complete without error indication.
6. MUST render fixed institutional footer DOM (logo + fixed lines from branding module); user credit lines are additive only.
7. MUST expose a stable composition root DOM (capture-ready) whose regions include title/credit slots, main map, legend (when items), insets, and footer.
8. MUST keep composition components presentational regarding persistence — no server writes, no module-level session singleton beyond props/state passed from parent shell (built in task_03).
9. SHOULD share element styling patterns with editor (`style` JSON, point/line/polygon symbols) for visual legend and map parity.
10. MUST implement and pass every assigned integration test case in `## Tests` with Leaflet constructors faked or shallow-mounted as needed.
</requirements>

## Subtasks
- [x] 2.1 Build `ExportMainMap` (dedicated Leaflet) with basemap tiles and element layers from session props
- [x] 2.2 Add map chrome overlays: scale, north, graticule, decorative CSS frame
- [x] 2.3 Implement labels toggle on export main map without removing chrome
- [x] 2.4 Implement `ExportLegend` layouts (inside/right/bottom) + drag and numeric metric updates
- [x] 2.5 Implement location insets UI/maps (0–2) + mesh/colors + selection-driven fit/highlight
- [x] 2.6 Hook geo load/error presentation around insets without silently faking complete borders
- [x] 2.7 Implement institutional footer component using branding assets from task_01
- [x] 2.8 Assemble composition root/preview component binding regions for later shell capture
- [x] 2.9 Implement assigned IT cases with fake Leaflet/geo as required

## Implementation Details
Follow TechSpec component boundaries (`ExportMainMap`, `ExportLegend`, `ExportLocationInsets`, `DecorativeFrame`, `MapChrome`) and sequencing steps 5–7. Prefer package under `src/components/map/export/*` using existing map UI primitives (Dialog not required here). Reuse basemap URL constants from editor resolution helpers delivered in task_01. Location data loads via task_01 `loadGeoBoundaries` — prefer loading when insets enabled for payload cost. Prior HEAD files (`PreviewMap.jsx`, `LegendFrame.jsx`, `LocationInsets.jsx`, etc.) may inform structure but MUST satisfy this TechSpec (no PNG-only/html2canvas assumptions in composition surface itself).

### Relevant Files
- `src/components/map/LeafletMap.jsx` — basemap URLs, element rendering patterns (Marker/Polyline/Polygon), style helpers
- `src/components/map/iconSvgs.jsx` / related icon helpers — point symbol parity if used by editor
- `src/lib/export/*` — session types, `buildLegendItems`, geo loader, branding, scale helpers (task_01)
- `public/export/*`, `public/borda.png`, `public/norte.png` — chrome/frame assets
- `public/geo/**` — inset boundary data
- `.idea/printJs.php` — inset/legend interaction parity reference
- `.compozy/tasks/exportar-mapa/_techspec.md` — component table and layout model

### Dependent Files
- `src/components/map/export/ExportMainMap.jsx` (name may match existing PreviewMap rename) — create/port
- `src/components/map/export/MapChrome.jsx` / graticule/scale overlays — create/port
- `src/components/map/export/DecorativeFrame` CSS/component — create/port
- `src/components/map/export/ExportLegend.jsx` — create/port
- `src/components/map/export/ExportLocationInsets.jsx` + selection panels/overlays — create/port
- `src/components/map/export/InstitutionalFooter.jsx` — create/port
- `src/components/map/export/CompositionPreview.jsx` — capture root — create/port
- `tests/js/exportComposition*.test.jsx` (or RTL files) — assigned ITs

### Related ADRs
- [ADR-001: Full feature parity with legacy printJs export window](adrs/adr-001.md) — chrome/legend/insets capability baseline
- [ADR-004: Fixed REAT/FURG institutional branding on exports](adrs/adr-004.md) — footer UI
- [ADR-007: Dedicated Leaflet instances for export composition](adrs/adr-007.md) — separate maps
- [ADR-009: Static Brazilian admin boundaries under public/geo](adrs/adr-009.md) — inset data

## Deliverables
- Mountable composition components (main map, legend modes, 0–2 insets, footer, chrome)
- Capture-ready composition DOM root for shell generation
- Integration tests for legend, insets, chrome presence
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] IT-018 — legend `bottom` placement; hide all thematic layers empties legend without crash
- [x] IT-019 — numeric legend width + simulated drag metrics stick in component store/props path
- [x] IT-030 — locationCount 2 shows two insets; 0 hides them
- [x] IT-031 — geo load fail surfaces error; with locationCount 0 composition still allows export intent
- [x] IT-032 — incomplete UF selection prompts/blocks per product rule when locationCount requires it
- [x] IT-033 — high-vertex mesh fixture mounts without uncaught throw
- [x] IT-040 — scale, north, graticule, frame present; labels toggle does not remove them
- [x] IT-041 — portrait composition keeps chrome inside composition root geometry/class contract

## Success Criteria
- Every assigned test case implemented and passing
- Export map is a dedicated Leaflet instance (not a live capture of editor MapContainer)
- Legend modes and inset counts match session props without server I/O
- Institutional footer always renders logo + fixed lines from branding module
- Composition root is addressable for html-to-image capture in task_03
