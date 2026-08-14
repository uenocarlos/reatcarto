---
status: completed
title: "Color bitmap rendering for custom_icon_url"
type: frontend
complexity: medium
---

# Task 2: Color bitmap rendering for custom_icon_url

## Overview
Updates map markers, export layers, and legend symbols so a non-empty `custom_icon_url` renders as a color-preserving bitmap instead of a CSS mask tinted by `icon_color`. This unblocks visual fidelity for library icons independently of the drawing editor UI.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST change `createColoredIcon` so non-empty `customUrl` uses centered `<img>` (contain, transparent) with no `mask-image` and without applying `icon_color` to the artwork.
2. MUST keep mask/SVG tint behavior when `customUrl` is empty (including `icon_name` path/`*.svg` built-ins).
3. MUST use center icon anchor for custom bitmap markers (TechSpec ADR-007 notes).
4. MUST update `ExportLegend` / legend CSS so custom URL symbols use bitmap styling, not mask tint.
5. MUST provide broken-image fallback that does not crash Leaflet when the URL fails.
6. MUST preserve `iconSizeForZoom` sizing for bitmap markers.
7. MUST keep legend grouping identity including `custom_icon_url` so distinct customs do not collapse.
8. MUST implement and pass every assigned test case in the Tests section.
</requirements>

## Subtasks
- [x] 2.1 Bifurcate `createColoredIcon` custom URL → bitmap vs mask/SVG paths
- [x] 2.2 Align export map markers (via shared helper) and verify call sites
- [x] 2.3 Update ExportLegend symbol + `exportComposition.css` for bitmap customs
- [x] 2.4 Add onerror/fallback behavior for broken custom URLs
- [x] 2.5 Extend/add Vitest coverage for UT/E2E IDs assigned here

## Implementation Details
Follow TechSpec **Core Interfaces** (`pointIcon.js` branch), ADR-001, and ADR-007. Primary edit is `src/components/map/pointIcon.js`; legend in `ExportLegend.jsx` and CSS. `LeafletMap.jsx` / `ExportElementLayers.jsx` should keep calling `createColoredIcon` without duplicating mask logic.

### Relevant Files
- `src/components/map/pointIcon.js` — current mask-for-URL implementation
- `src/components/map/export/ExportLegend.jsx` — legend symbol rendering
- `src/components/map/export/exportComposition.css` — mask styles for point icons
- `src/components/map/export/ExportElementLayers.jsx` — uses `createColoredIcon`
- `src/lib/export/layerGrouping.js` — `custom_icon_url` in identity
- `tests/js/pointIconZoom.test.js` — existing size/SVG tests to extend or complement

### Dependent Files
- `src/components/map/LeafletMap.jsx` — verify marker HTML after change
- `tests/js/pointIconBitmap.test.js` (or extended existing) — create/update

### Related ADRs
- [ADR-001: Preserve Original Colors](adrs/adr-001.md) — product color rule
- [ADR-007: Bitmap when custom_icon_url set](adrs/adr-007.md) — render bifurcation

## Deliverables
- Color-preserving custom markers on map and export
- Legend bitmap symbols for customs; built-ins still tint
- Every test case assigned in the Tests section implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-040, UT-044, UT-045, UT-046 — bitmap HTML, ignore color, legend class, zoom sizes
- [x] UT-047, UT-048, UT-049 — built-in SVG path, legacy custom URL img, legend grouping
- [x] E2E-014 — point with custom URL shows img marker and bitmap legend symbol

## Success Criteria
- Every assigned test case implemented and passing
- `custom_icon_url` markers show original artwork colors
- Empty `custom_icon_url` built-ins still use mask/SVG + `icon_color`
