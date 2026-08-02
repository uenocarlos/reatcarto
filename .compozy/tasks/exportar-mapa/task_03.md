---
status: completed
title: Preview de composição completo
type: frontend
complexity: high
---

# Task 3: Preview de composição completo

## Overview
Completa o preview vivo da composição: frame de papel/DPI, legenda (inside com drag/resize, beside/below com crescimento do canvas), aparência, overlay de visibilidade independente do editor, tags globais, basemaps alinhados (Carto/OSM/ArcGIS; Offline nativo via `tileManager`), chrome sempre ligado (graticule, escala dinâmica, norte) e rodapé institucional com logo. Este slice é o que o dono vê bater com o PNG.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST update the live preview without a mandatory “Atualizar Preview” step when options change.
2. MUST support legend positions `inside` | `beside` | `below`; beside/below MUST grow the composition so the legend does not cover the map; inside MUST support clamped drag/resize via `legendRect` (normalized 0–1).
3. MUST apply legend columns (1–6), font size (8–18px), and spacing (`compact`|`normal`|`wide`) with clamp on out-of-range restored values.
4. MUST filter preview map and legend via export-only `hiddenCategoryIds` / `hiddenElementIds` without mutating source editor elements (ADR-008).
5. MUST provide one global `showTags` switch; tags MUST omit blank names and hidden elements; hostile names MUST render as plain text.
6. MUST resolve basemaps `carto` | `osm` | `satellite` (ArcGIS, not Google) and native-only `offline` via `tileManager.getLocalTileUrl`; Offline MUST be disabled on web; unusable offline MUST surface failure (no false success later).
7. MUST always show graticule, dynamic scale (not fixed 0–3km), and north arrow on the composition.
8. MUST render title in header when set; institutional footer with RealCarto/(R)EAT/FURG lines, author/responsible when set, and logo treatment; broken logo MUST keep text attribution.
9. MUST drive preview aspect from paper size + orientation; DPI MUST feed capture scale math (`dpi/96`) used by later exporter.
10. SHOULD extract preview pieces under `src/components/map/export/` for testability while keeping modal options usable on phone-width (scrollable options + preview).
</requirements>

## Subtasks
- [x] 3.1 Extract/build `CompositionPreview` paper frame driven by paper/orientation/DPI
- [x] 3.2 Implement `LegendFrame` for inside (drag/resize clamp) and beside/below growth layouts
- [x] 3.3 Wire legend appearance controls (columns, font, spacing) to live legend layout
- [x] 3.4 Implement export visibility overlay + category/element toggles independent of editor
- [x] 3.5 Implement global tags on preview for visible named elements
- [x] 3.6 Align basemap URLs to editor (ArcGIS satellite); integrate native offline tiles; disable Offline on web
- [x] 3.7 Replace fixed scale with dynamic scale; keep graticule and north always on
- [x] 3.8 Complete institutional footer + logo asset wiring and live metadata reflection
- [x] 3.9 Remove mandatory refresh no-op; coalesce rapid option updates coherently
- [x] 3.10 Ensure phone-width scrollable options+preview layout
- [x] 3.11 Implement all assigned unit/integration/E2E cases for this slice

## Implementation Details
Start from `ExportMapModal.jsx` (GraticuleOverlay, MapOverlays, PreviewMap already present but incomplete). Align satellite with `LeafletMap.jsx` ArcGIS URL. Use `tileManager.js` for offline. TechSpec defaults and ADR-005/008/010 guide layout and capture-friendly tiles. Logo expected at `public/logo.png` (ensure asset present for footer).

### Relevant Files
- `src/components/map/ExportMapModal.jsx` — current composition UI and preview Leaflet instance
- `src/components/map/LeafletMap.jsx` — authoritative online basemap URLs (Carto/OSM/ArcGIS)
- `src/lib/tileManager.js` — `getLocalTileUrl`, tile helpers for offline
- `src/components/map/iconSvgs.jsx` — point icon rendering for preview elements
- `src/components/map/StylePanel.jsx` — dense control UX reference (Slider/Select/ScrollArea)
- `src/lib/export/exportSettings.js` — settings model and `effectiveVisibleElements`
- `src/page/MapEditor.jsx` — passes elements/settings into modal
- `src/components/ui/switch.jsx`, `src/components/ui/checkbox.jsx`, `src/components/ui/slider.jsx` — controls for tags/visibility/appearance
- `public/logo.png` — institutional logo (add if missing)

### Dependent Files
- `src/components/map/export/*` — new preview modules consumed by modal
- `src/lib/export/pngExporter.js` — task_05 will capture the preview DOM this task owns
- Location inset slots — task_04 will extend composition chrome

### Related ADRs
- [ADR-005: Legend Placement and Growing Composition Canvas](adrs/adr-005.md) — inside/beside/below
- [ADR-006: Layer Visibility, Tags, and Export Gates](adrs/adr-006.md) — visibility, tags, chrome, basemaps, footer
- [ADR-008: Independent Export Visibility Overlay](adrs/adr-008.md) — export visibility ≠ editor
- [ADR-010: Composition Capture Stack and Cartographic Defaults](adrs/adr-010.md) — ArcGIS, paper frame, dynamic scale, default inside legend

## Deliverables
- Live composition preview matching configured legend, layers, tags, basemap, paper, chrome, and footer
- Export visibility that does not mutate editor elements
- Offline basemap selectable only on native with usable tile feedback
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-011, UT-012, UT-013, UT-014, UT-015, UT-016, UT-017, UT-018, UT-019, UT-020 — metadata header/footer rendering and sanitization helpers
- [x] UT-021, UT-022, UT-023, UT-024, UT-025, UT-026, UT-027, UT-028, UT-029, UT-030, UT-031, UT-032, UT-033, UT-034, UT-035, UT-036, UT-037, UT-038, UT-039, UT-040, UT-041, UT-042, UT-043 — legend position modes, growth, inside drag/resize clamps and restore
- [x] UT-044, UT-045, UT-046, UT-047, UT-048, UT-049, UT-050, UT-051, UT-052, UT-053, UT-054, UT-055 — columns/font/spacing clamp and layout
- [x] UT-056, UT-057, UT-058, UT-059, UT-060, UT-061, UT-062, UT-063, UT-064, UT-065, UT-066, UT-067, UT-068 — category/element visibility overlay and prune interactions with gates content rule
- [x] UT-069, UT-070, UT-071, UT-072, UT-073, UT-074, UT-075, UT-076, UT-077, UT-078, UT-079, UT-080 — global tags behavior
- [x] UT-081, UT-082, UT-083, UT-084, UT-085, UT-086, UT-087, UT-088, UT-089, UT-090, UT-091 — basemap URL resolution, web offline disabled, readiness flags
- [x] UT-117, UT-118, UT-119, UT-120, UT-121, UT-122, UT-123, UT-124, UT-125, UT-126, UT-127 — paper/orientation/DPI aspect and scale factor helpers
- [x] UT-128, UT-129, UT-130, UT-131, UT-132, UT-133, UT-134, UT-135, UT-136 — live preview model, loading/error status, coalesced updates
- [x] UT-137, UT-138, UT-139, UT-140, UT-141, UT-142, UT-143, UT-144, UT-145 — institutional footer/logo (location IBGE credit completed in task_04)
- [x] UT-187, UT-188 — dynamic scale calculator
- [x] IT-021, IT-025, IT-027, IT-033, IT-036 — phone-width modal; native offline selectable; satellite+DPI progress; large paper capture loading; mobile layout stack
- [x] E2E-003, E2E-004, E2E-005, E2E-006, E2E-007, E2E-008, E2E-009 — metadata, legend position/drag/appearance, visibility, tags, basemaps
- [x] E2E-012, E2E-013, E2E-014 — paper/DPI, live preview without refresh, footer/logo

## Success Criteria
- Every assigned test case implemented and passing
- Beside/below legends never overlay the map frame; inside rect stays clamped
- Preview basemap satellite uses ArcGIS; Offline unavailable on web
- Scale label is resolution-dependent (not hardcoded 3km)
- Hiding elements for export leaves the editor element array unchanged after modal close
