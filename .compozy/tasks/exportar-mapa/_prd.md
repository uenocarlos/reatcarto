# Product Requirements Document: Map Export Composition (Exportar Mapa)

## Overview

Map owners in ReatCarto can already draw field geometries and style them, but they lack a reliable, discoverable way to produce a branded cartographic PNG for operational sharing and for academic or extension documents. An export composition modal exists in the codebase with partial controls, yet it is not reachable from the editor, several options do not affect the preview, location insets are missing, and legend placement is incomplete.

This feature delivers a single export composition screen where the owner configures metadata, legend layout and appearance, layer and tag visibility, basemap, Brazil location maps, and page setup; sees a live preview that includes institutional footer and logo; and exports a PNG. The same composition serves field delivery and report insertion. Public gallery visitors cannot export.

## Goals

- Allow an authenticated map owner to open a composition screen from the map editor and produce a PNG that matches the live preview.
- Let owners set title and author (required), optional technical responsible, legend position (inside / beside / below), columns (1–6), font size (8–18px), and spacing (compact / normal / wide).
- When the legend is inside the map, allow drag and resize within the map area; when beside or below, grow the composition so the legend does not cover the map.
- Let owners hide categories and individual elements for export without deleting map data, and toggle element name tags with one global switch.
- Let owners choose basemap among Claro (Carto), OSM, Satellite, and Offline tiles.
- Let owners add none, one, or two Brazil locator insets with state/municipality selection, colors, legend participation, optional municipal mesh, and main-map municipality outline.
- Always include graticule, scale bar, north arrow, and the institutional footer/logo block on the composition.
- Persist export settings per map and enforce export gates that prevent unattributed or incomplete locator outputs and empty compositions.
- Keep PDF export and non-Brazil locator catalogs out of this delivery; keep anonymous export impossible.

## User Stories

- `US-001`–`US-002`: open export from the editor; deny export to anonymous/public viewers.
- `US-003`: title, author, and optional technical responsible.
- `US-004`–`US-006`: legend position, inside drag/resize, columns/font/spacing.
- `US-007`–`US-008`: category and element visibility; global name tags.
- `US-009`: basemap selection including offline.
- `US-010`–`US-011`: Brazil location insets and main-map/legend location styling.
- `US-012`–`US-014`: paper/orientation/DPI, live preview, institutional footer and logo.
- `US-015`–`US-017`: PNG export (download/share), per-map persistence, validation gates.

[Full user stories](_user_stories.md)

## Core Features

### Export composition screen

- Reachable only by the authenticated owner from the map editor.
- Split experience: configuration options and a live preview of the full composition.
- Cancel returns to the editor without generating a file.
- Preview updates as options change; a mandatory “Atualizar Preview” step is not required.

### Metadata

- Fields: Title, Author, Technical responsible.
- Title and Author are required to export.
- Technical responsible is optional.
- Title appears in the composition header when set; author and technical responsible appear with the footer block when set.

### Legend position and interaction

- Positions: inside the map, beside the map, or below the map.
- Inside: owner can drag and resize the legend anywhere within the map area; the frame stays clamped inside that area.
- Beside / below: legend sits outside the map frame; the exported composition grows to include map + legend + chrome + footer without covering the map.

### Legend appearance

- Columns: integer from 1 to 6.
- Font size: 8px to 18px.
- Item spacing: compact, normal, or wide.

### Layer control

- Owners toggle visibility by category and by individua l element.
- Hidden items leave both the preview map and the legend.
- Category off hides all child elements until the category is on again.
- Hiding for export does not delete elements from the map document.

### Tags

- One global switch shows or hides names of currently visible elements.
- Blank names produce no label.

### Basemap

- Options: Claro (Carto), OpenStreetMap, Satellite, Offline (tiles folder).
- Offline requires usable tiles for the view; failures are visible and do not report a successful basemap capture when unusable.

### Location maps (Brazil)

- Count: None, 1 map, or 2 maps.
- **1 map**: state extent with municipality highlighted.
- **2 maps**: South America context (Brazil/state) plus state extent with municipality highlighted.
- Owner selects Brazilian state and municipality.
- With 1 or 2 maps, both state and municipality are required before export.
- Main map shows municipality outline; optional municipal mesh on map and legend; optional state and municipality legend entries; independent colors for state and municipality.
- Non-Brazil administrative catalogs are out of scope for this PRD.

### Page setup

- Paper size, orientation, and DPI remain available and affect preview frame and PNG generation.

### Always-on map chrome

- Coordinate graticule, scale bar, and north arrow always appear on the composition in this PRD (no toggles).

### Institutional footer

- Footer includes RealCarto attribution, basemap credits line, (R)EAT / FURG institutional lines, and logo treatment consistent with product branding references.
- Author and technical responsible lines append when provided.

### PNG export

- Only PNG in this PRD.
- Web: download the PNG.
- Native Capacitor: share/save via the platform share flow after generation.
- Progress, success, and failure feedback are visible.

### Per-map persistence

- Export configuration restores when the owner reopens export for the same map.
- Settings do not cross-apply between different maps or users.

## Business Rules

### Permissions

- Only the authenticated owner of the map may open the export composition screen and produce the PNG through this feature.
- Anonymous visitors and non-owners cannot export via this feature, including crafted access attempts.
- This aligns with the existing publication rule that public viewers do not receive export or geographic-download rights.

### Validation and export gates

- Title and Author must be non-empty after trimming whitespace.
- Technical responsible may be empty.
- If location inset count is 1 or 2, both state and municipality must be selected before export.
- Export requires at least one visible drawn element on the map **or** at least one legend item (including enabled location legend entries).
- Failing gates block export and surface clear guidance; they do not produce a file.

### Legend and visibility invariants

- An element or category hidden for export is absent from both map and legend.
- Tags never appear for hidden elements.
- Inside-legend geometry remains within the map frame.
- Beside/below legends must not overlay the map frame.

### Location invariants

- Municipality selection must belong to the selected state.
- Switching inset count to None removes the state/municipality export requirement.
- Location overlays that depend on a selection do not appear as orphan geometries without a valid selection.

### Persistence invariants

- Settings are scoped to one map and its owner.
- Stale element visibility flags for deleted elements are ignored safely.
- Corrupted settings fall back to defaults without crashing.

### Output invariants

- Successful export yields PNG only.
- A success message is shown only when generation completes as intended for the platform (download started or share sheet presented with a generated file).
- Always-on chrome and institutional footer are present on successful compositions.

### Defaults (product-level)

- First open for a map uses documented defaults (TechSpec may refine exact values). Reasonable starting point consistent with current UI: Claro basemap, legend usable default position, legend columns/font in mid-range, spacing normal, tags off, location insets None, DPI 300 unless otherwise specified in TechSpec.

## User Experience

### Personas and goals

- **Map owner**: compose a faithful, attributed map image quickly in the field and polish the same layout for reports.
- **Anonymous visitor**: inspect published maps without gaining export controls.

### Primary flow

1. Owner opens an owned map in the editor and activates Export.
2. Export screen opens with restored settings (or defaults).
3. Owner sets title and author; optionally technical responsible.
4. Owner adjusts legend, layers, tags, basemap, location maps, and page setup while watching the live preview.
5. If gates fail, owner corrects the highlighted issues.
6. Owner exports; web downloads PNG or native share sheet opens.
7. Owner cancels or closes and returns to the editor; settings persist for next time.

### UX considerations

- Controls must remain usable on phone-width screens (scrollable options + preview).
- Live preview must not imply that a blocked export will succeed.
- Location and offline failures must be explicit.
- Inside-legend drag/resize must remain reachable without trapping the user; Cancel stays available.
- Discoverability: export action must be visible in the editor (the feature is incomplete while the control is absent).

## High-Level Technical Constraints

- Must integrate with the existing map editor ownership model and the publication rules that deny public export.
- Composition must capture the preview the owner sees (including basemap tiles, overlays, legend, footer).
- Brazil administrative boundaries require an authoritative boundary source suitable for state/municipality insets and mesh; exact packaging is a TechSpec concern.
- Offline basemap depends on the product’s existing tiles-folder approach; missing tiles must fail visibly.
- Native export should continue to respect Capacitor filesystem/share capabilities where the app already uses them.
- Performance: preview and export must remain usable for typical field maps; very large DPI/paper combinations may fail with clear feedback rather than hang indefinitely.
- Privacy: export settings must not leak across users or into anonymous contexts.

## Non-Goals (Out of Scope)

- PDF export (and any non-PNG raster/vector formats) in this PRD.
- Export for anonymous gallery visitors or non-owners.
- Administrative boundary catalogs outside Brazil.
- Separate Field vs Report layout modes or dual quality export buttons.
- Toggles to hide graticule, scale bar, or north arrow.
- Automatic label collision avoidance for tags.
- Georeferenced world-file sidecars or atlas/batch export.
- Redesign of the live map editor’s basemap control outside the export screen (except as needed to feed export).

## Architecture Decision Records

- [ADR-001: Single Composition Flow for Field and Report Use](adrs/adr-001.md) — One export flow serves field and report contexts.
- [ADR-002: Brazil-First Location Maps with Official Administrative Boundaries](adrs/adr-002.md) — None/1/2 Brazil insets with validated state/municipality selection.
- [ADR-003: Owner-Only PNG Export from the Map Editor](adrs/adr-003.md) — Owner-only PNG; no PDF; no public export.
- [ADR-004: Live Preview and Per-Map Persistence of Export Settings](adrs/adr-004.md) — Live preview; settings persist per map.
- [ADR-005: Legend Placement and Growing Composition Canvas](adrs/adr-005.md) — Inside drag/resize; beside/below grow the canvas.
- [ADR-006: Layer Visibility, Tags, and Export Gates](adrs/adr-006.md) — Category/element toggles, global tags, metadata and content gates, always-on chrome, four basemaps, footer.
- [ADR-007: Server-Backed export_settings with IndexedDB Mirror](adrs/adr-007.md) — JSONB + LWW + debounce persist (TechSpec).
- [ADR-008: Independent Export Visibility Overlay](adrs/adr-008.md) — Export visibility independent of editor (TechSpec).
- [ADR-009: IBGE Online Boundaries with Static Fallback](adrs/adr-009.md) — IBGE online; `public/geo/` fallback; conditional credit (TechSpec).
- [ADR-010: Composition Capture Stack and Cartographic Defaults](adrs/adr-010.md) — html2canvas, ArcGIS, native offline tiles, paper frame, defaults (TechSpec).

## Open Questions

Resolved in `_techspec.md` / ADR-007–010: default legend `inside`; export visibility independent of editor; IBGE Malhas/Localidades online with `public/geo/` fallback and conditional IBGE footer credit; `maps.export_settings` JSONB + IndexedDB mirror with last-write-wins (no geometry conflict UI).
