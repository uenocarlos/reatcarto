# PRD: Export Map

## Overview

Map owners need to turn an interactive ReatCarto map into a **print-ready, cartographically complete deliverable**—with title, credits, legend, scale, orientation cues, optional Brazilian location insets, page size, and quality control—without leaving the authenticated map editor.

Today the React product has no export composition path. The legacy application encoded in `.idea/printJs.php` already delivers that workstation: configure page and legend, preview WYSIWYG, download PNG or PDF using browser-side composition. This PRD re-creates **that same efficiency and functional breadth** inside the current product’s owner editor, UI system, map data, and access model.

**Who:** authenticated map owners preparing institutional, teaching, or project maps.  
**Why:** screenshots of the live editor lack legend layout, paper geometry, DPI, fixed institutional identity, and contextual location maps required for serious cartographic delivery.

## Goals

- Owners can open a full export composition experience from the map editor and download **PNG or PDF** that matches the composed preview.
- The product enforces **owner-only** export; public visitors and non-owners never receive export controls for private or public view-only maps in this version.
- Composition supports **printJs feature parity**: texts, format, paper, orientation, DPI, legend position and formatting, layer toggles, basemaps, location insets (0–2) with state/municipality, municipal mesh and colors, map labels, graphic scale, north arrow, graticule, decorative frame, institutional REAT/FURG footer and logo.
- Opening export **inherits** the editor’s viewport, layer visibility, and basemap so the path from “map ready” to “file ready” stays short.
- Preference state is **session-scoped** (ephemeral): close discards configuration; no saved print templates in this version.
- The composition UX is **complete on mobile and desktop**, with every control reachable on phone.
- Failed high-DPI or capture generation surfaces recoverable errors; successful export produces a downloadable file whose content matches the last previewed composition intent.

## User Stories

Canonical criteria live in the [user story catalog](_user_stories.md). Index by area:

| Range    | Theme |
|----------|--------|
| US-001–US-002 | Entry and access (owner editor; public/non-owner blocked) |
| US-003 | WYSIWYG composition and preview |
| US-004 | Title/authorship vs fixed institutional branding |
| US-005 | Format, paper, orientation, DPI |
| US-006 | Legend position and formatting |
| US-007 | Layers, labels, basemap; cancel isolation from editor |
| US-008 | Location insets, mesh, colors |
| US-009 | Scale, north, graticule, decorative frame |
| US-010 | Download, progress, failure recovery |
| US-011 | Mobile full parity |
| US-012 | Ephemeral session lifecycle |

[Full user stories](_user_stories.md)

## Core Features

### 1. Export entry in the map editor

- A single, discoverable control available only when the authenticated user owns the map under edit.
- Opens a composition workspace (modal or equivalent full-surface flow) without requiring a separate dashboard export path.
- Initial map state inherits editor viewport, layer visibility, and basemap mapping to export basemap options.

### 2. Composition controls (printJs parity)

Groups of options the owner can set before download:

| Group | Behavior |
|-------|----------|
| Texts | Title (default map name); authorship; technical responsible—all editable |
| Format | PNG (default recommendation often for dense legends) or PDF |
| Paper | A4 (default), A3, Letter |
| Orientation | Landscape (default), portrait |
| Quality | DPI 72–600, default 300 |
| Legend position | Inside map (default), right, bottom; width adjust where applicable |
| Legend format | Columns 1–6; font 8–18 px (default 12); spacing very compact…very loose (default normal) |
| Layers | Toggle participation of map layers; drives legend and main map content |
| Display | Optional show names/labels on map |
| Basemap | OpenStreetMap, Carto-style light, satellite |
| Location maps | None, 1, or 2 insets; state and municipality selection as required |
| Location layers | State on legend; municipal mesh on map and legend |
| Colors | State and municipality styling when location features apply |

### 3. Live preview composition

- Preview always includes: title region, main map, legend region (when items exist), optional inset maps, footer region with institutional logo and text.
- Preview reflects legend layout modes, inset count, and credit text edits.
- Drag/resize of legend when legend is “inside” or width-adjust when “right,” matching printJs interactive intent.
- Explicit “update preview” action may exist alongside automatic updates; either way the user can obtain a faithful preview before export.

### 4. Cartographic chrome on the main map

Always part of the export composition (parity with printJs defaults):

- Graphic scale bar
- North indicator
- Graticule
- Decorative frame treatment for institutional presentation
- Optional labels when the owner enables names on the map

### 5. Fixed institutional branding

Every export includes non-optional REAT/FURG institutional footer identity and logo identical in intent to printJs (product copyright/credit lines, basemap credits, research core and university lines). Authors cannot remove this block via the export UI; they only fill per-map credit fields.

### 6. Client-side generation and download

- User triggers export; product shows generation progress and blocks duplicate in-flight generation.
- On success, downloads a file of the chosen format whose visual content matches the composed layout at the chosen DPI and paper intent.
- Same efficiency class as printJs: compose and capture in the user’s browser session for immediate personal download—not a multi-day offline print job, not a public print server queue for this version.
- On failure (memory, timeout, missing tiles/data), clear message and ability to change settings (e.g. lower DPI) and retry.

### 7. Location context (Brazil)

- Insets situate the project map using state and municipality selection.
- Optional municipal mesh and state legend entries.
- Color pickers for regional polygons.
- Product must supply access to the geographic boundaries needed for these features (or equivalent of the legacy municipal data pipeline); incomplete boundary loading is never presented as a completed political basemap without indication.

### 8. Mobile and desktop experience

- Desktop: comfortable dual-pane-style controls + preview where width allows.
- Mobile: stacked/scrollable controls; all groups reachable; preview inspectable; touch-friendly alternatives to desktop-only drag where needed.
- High DPI remains available with honest failure recovery on weak devices.

### 9. Ephemeral session

- Closing/canceling discards export options.
- Reopen starts from defaults + fresh inheritance from current editor state.
- No requirement to persist print layout templates on the server for this version.

## Business Rules

### Access and permissions

1. Only the authenticated **owner** of a map may open export for that map.
2. Export is offered **only in the map editor** for maps the user owns.
3. Public gallery and public map view **do not** expose export composition (aligns with login-and-PostGIS: no public PDF/geo download).
4. Non-owners cannot export maps they do not own, including via forged client calls if any export resource exists.

### Initial values and defaults

| Setting | Default |
|---------|---------|
| Title | Current map `name` |
| Authorship | Empty |
| Technical responsible | Empty |
| Format | PNG selected as ready default; PDF available; dense-legend hint for PDF |
| Paper | A4 |
| Orientation | Landscape |
| DPI | 300; hard bounds 72–600 |
| Legend position | Inside |
| Legend columns | 1 |
| Legend font | 12 px |
| Legend spacing | Normal |
| Location maps | None |
| Map chrome | Scale, north, graticule, decorative frame always on for composition |
| Map labels | Off unless product inherits an editor label state (if none exists, off) |
| Viewport/layers/basemap | Inherited from editor at open |

### Session and state lifecycle

1. Export configuration exists only while the export UI remains open in the client session.
2. Cancel/close discards export configuration.
3. Cancel must not permanently rewrite the editor’s layer visibility or basemap to temporary export-only choices against the owner’s intent to leave the editor as before open.
4. Successful export does not require saving a reusable layout object.
5. Reopen recomputes inheritance from the editor’s **current** state at the new open.

### Legend content

1. Legend items derive from map elements/groups that are included as visible for export, with symbols matching product styling of those groups.
2. Location-related legend entries appear only when those location options are enabled.
3. Empty thematic legend is allowed; export still permitted.

### Format and quality

1. PNG and PDF are the only formats in this version.
2. DPI outside 72–600 is invalid (reject or clamp with feedback).
3. Paper sizes are exactly A4, A3, Letter; orientations landscape and portrait only.
4. Dense legends: product must keep the guidance that PNG is preferred for many legend items; PDF remains available.

### Branding

1. Institutional footer text blocks and REAT logo are mandatory on every successful export composition.
2. Authorship and technical-responsible strings may be blank without removing institutional branding.
3. Branding strings and logo are not user-editable in-export for this version.

### Location insets

1. Allowed counts: 0, 1, or 2 insets.
2. Enabling insets requires selection flows for state and municipality matching printJs capabilities (including two independent selections when two insets are active).
3. Municipal mesh and state-on-legend switches only apply when location features are in play.
4. If regional data cannot load, the product must not present a false complete political overlay; surface load failure.

### Generation

1. Only one generation runs at a time per open session; further clicks wait or no-op with feedback.
2. Download filename is based on map title/name and format extension.
3. Output must include all composition regions intended by current settings (map, legend if items, insets if enabled, footer, title).

### Performance (user-perceived)

1. Opening the UI remains usable for large maps (scroll lists; no freeze as the only outcome).
2. Generation time may grow with DPI and paper; user always sees that work is in progress until success or failure.

## User Experience

### Personas and goals

- **Map owner:** finish a map for class, report, or institutional archive—needs control without learning a separate GIS print suite.
- **Public visitor:** explore published maps only; export is out of scope here.

### Primary flow

1. Owner opens map in editor and arranges content (draw, style, visibility, view).
2. Owner opens **Export map**.
3. Composition loads with inherited map state; title prefilled; preview visible.
4. Owner adjusts paper/quality/legend/layers/insets/labels as needed; reviews preview.
5. Owner exports; waits on progress; receives PNG or PDF.
6. Owner closes export and continues editing or leaves the editor.

### Cancel flow

1. Owner opens export, changes options, cancels.
2. Returns to editor without lost navigation; ephemeral options discarded; editor map not force-stuck on export experiments.

### Failure flow

1. Generation fails (memory, tiles, geo service).
2. Owner reads actionable message (lower DPI, check network, disable mesh, etc.).
3. Owner retries without re-entering the entire editor.

### Discoverability

- Export control lives in the map editor chrome near other map-level actions, labeled unambiguously (export/print language consistent with product locale—Portuguese UI of the product).

### Accessibility and interaction

- All controls keyboard-reachable on desktop.
- Mobile: touch targets for primary actions; alternative to fine drag for legend size where needed.
- Progress and errors announced in a visible status region (and toast if product pattern uses one).

### Visual language

- Composition UI uses the **current product design system** (dialogs, buttons, form controls)—not a pixel clone of Bootstrap printJs chrome—while preserving information architecture and capability of printJs.

## High-Level Technical Constraints

- Must integrate with the existing authenticated **map editor** and owner authorization model (login-and-PostGIS product rules).
- Must operate on current map elements, styles, and basemaps already used in the editor (Leaflet world).
- Generation efficiency goal: **browser-local composition and download**, same capability class as printJs (html2canvas/jsPDF-style pipeline is the historical proof; TechSpec chooses exact tools).
- Location insets require **Brazilian administrative boundary data** availability (states, municipalities) comparable to the legacy municipal GeoJSON pipeline; source and hosting are TechSpec with a hard product requirement that insets work when data services are provisioned.
- Institutional logo asset must ship with the product for offline/online client use during export.
- Security: no export endpoint or client path may allow non-owners to obtain private map composition.
- Public views remain free of export.
- Privacy: composition and download occur for the owner; product does not publish the exported file automatically.

## Non-Goals (Out of Scope)

- Public or anonymous PDF/PNG export of maps.
- Geographic data download (GeoJSON/Shapefile/KML package export).
- Multi-page atlases / atlas generation.
- Server-side print queues, print farm, or ArcGIS-style layout template marketplace.
- Persisted print templates / server-saved export layouts.
- Fully customizable institutional branding or white-label footer in the export UI.
- SVG vector map export or layered PSD for external design suites.
- Georeferenced GeoPDF / world-file companions as a product promise (unless already trivial in implementation—no requirement here).
- Dashboard-only export without editor.
- Export from offline-only tile cache workflows beyond whatever map is already on screen (no separate offline print module).
- Collaborative multi-user co-editing of a print layout.
- Automatic email delivery of exports.

## Architecture Decision Records

- [ADR-001: Full feature parity with legacy printJs export window](adrs/adr-001.md) — Recreate the complete printJs capability surface in this product.
- [ADR-002: Owner-only export from the map editor](adrs/adr-002.md) — Single entry point; no public export.
- [ADR-003: Ephemeral export session configuration](adrs/adr-003.md) — No persisted print layout this version.
- [ADR-004: Fixed REAT/FURG institutional branding on exports](adrs/adr-004.md) — Mandatory footer and logo; editable per-map credits only.
- [ADR-005: Full mobile parity for export composition UX](adrs/adr-005.md) — Phone support with complete controls.
- [ADR-006: Inherit editor map state into export session](adrs/adr-006.md) — Viewport, layers, basemap continuity.

## Open Questions

- Exact hosting and update pipeline for Brazilian state/municipality geometries (legacy `dataservice/get_municipios.php` is not present in the current PHP API surface)—TechSpec must designate source, CRS, and cache policy while meeting inset stories.
- Whether empty title on export is allowed without blocking download (stories allow either; default product rule above permits empty title—confirm during techspec if validation should block empty title for institutional deliveries).
- Precise long-form institutional footer copy and logo asset path in the React packaging tree (must match REAT identity; content sign-off if copy differs slightly from printJs).
- Mapping table between editor basemap identifiers (`branco` / `osm` / `satelite`, etc.) and the three export basemap radios if labels differ.
- Maximum practical DPI guidance by device class (product requires 72–600 range; soft warnings may be added without removing the range).
