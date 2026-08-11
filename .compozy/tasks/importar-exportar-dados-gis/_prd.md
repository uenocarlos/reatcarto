# Product Requirements Document: GIS Data Import and Export

## Overview

ReatCarto stores map elements as PostGIS geometries with structured attributes and styles. Field workers and office analysts currently create and edit data only within the application. They cannot bring external GIS files into their maps or extract map data for use in QGIS, ArcGIS, or other desktop tools.

This feature adds bidirectional interchange of map element data through **GeoJSON** and **Shapefile** formats. Map owners can export elements (whole map or selection) and import external files (with merge or replace strategies), including attribute mapping review and validation summaries. GeoJSON works offline; Shapefile export requires connectivity. Only the map owner may perform these operations.

Primary persona: **map owner** (field worker or office analyst) who needs reliable data interchange without GIS preprocessing expertise.

## Goals

- Allow map owners to download their map elements as GeoJSON or Shapefile for use in external GIS software.
- Allow map owners to upload GeoJSON or Shapefile data into an open map, choosing to add or replace existing elements.
- Preserve element attributes (name, description, category) and style properties in exported files and on import.
- Support whole-map and selected-element scope for every import and export operation.
- Enable GeoJSON export and both-format import while offline, with sync when connectivity returns.
- Block Shapefile export when offline, with a clear message.
- Prevent non-owners (anonymous visitors, administrators) from importing or exporting GIS files through this feature.
- Surface CRS detection, reprojection notices, and validation summaries so users make informed decisions before modifying map data.

## User Stories

- `US-001`–`US-005`: GeoJSON and Shapefile export (whole map, selection, offline GeoJSON).
- `US-006`–`US-011`: GeoJSON and Shapefile import (merge, replace, mapping review, validation, offline).
- `US-012`: Owner-only access control.
- `US-013`–`US-014`: Geometry normalization and CRS reprojection.

[Full user stories](_user_stories.md)

## Core Features

### Export data (toolbar action)

- "Export data" in the map editor toolbar opens a modal dialog.
- The owner chooses **scope**: whole map or selected elements.
- The owner chooses **format**: GeoJSON or Shapefile.
- If scope is "selection" and no elements are selected, export is blocked with guidance to select elements on the map.
- If format is Shapefile and the device is offline, export is blocked with a connectivity message.
- If the map has zero elements (whole-map scope), export is blocked.
- GeoJSON export produces a single `FeatureCollection` file with WGS84 coordinates, one feature per element, and properties for name, description, category, and style fields.
- Shapefile export produces a `.zip` containing `.shp`, `.shx`, `.dbf`, and `.prj` (EPSG:4326), available only when online.
- Downloaded file name includes the map name and date.
- Mixed geometry types in one export are handled as separate layers or files within the zip (TechSpec defines exact packaging).

### Import data (toolbar action)

- "Import data" in the map editor toolbar opens a modal dialog.
- The owner uploads a `.geojson`, `.json`, or `.zip` Shapefile archive (individual component file upload is a TechSpec detail).
- The owner chooses **strategy**: add (merge with existing elements) or replace (remove all existing elements first).
- Replace strategy requires an explicit destructive confirmation warning. If the user cancels, no changes occur.
- Parsed features pass through geometry normalization (Multi* → single Point/LineString/Polygon) and CRS reprojection to WGS84.
- The owner reviews **attribute mapping**: source columns pre-mapped by known aliases, editable before confirm.
- The owner reviews a **validation summary**: total, valid, and invalid feature counts with reasons; optional map preview of valid features.
- The owner confirms to proceed. Only valid features are written. Zero valid features blocks import entirely.
- Merge strategy respects the 5,000-element-per-map limit; excess features are skipped and reported.
- Offline import writes to local storage and queues sync mutations.

### Attribute and style interchange

- Export serializes element `name`, `description`, `element_category`, and `style` JSONB properties as flat attribute fields.
- Import maps source fields to element attributes via the review screen. Unmapped fields are ignored. Unknown source fields default to ignore unless the user assigns them.
- Name defaults to a generated label when no source field maps to name.
- Shapefile DBF constraints apply on export: 10-character field name truncation, 254-character value truncation with user-visible notice when truncation occurs.

### Geometry and CRS handling

- All stored and exported geometries use EPSG:4326.
- Import reprojects from detected source CRS (`.prj`, GeoJSON CRS hint) to WGS84. Missing CRS assumes WGS84 with a warning.
- MultiPoint, MultiLineString, MultiPolygon, and GeometryCollection are normalized to supported simple types per ADR-004.
- Geometries failing normalization, vertex limit (10,000 per line/polygon), or PostGIS validity check are excluded from import and listed in the validation summary.

## Business Rules

### Ownership and access

- Only the authenticated owner of the currently open map may import or export GIS data.
- Published map visibility does not grant GIS file download to anonymous users.
- Administrator private-map intervention tools remain separate; this feature does not extend GIS export to admins.

### Element limits

- Maximum 5,000 elements per map (`ELEMENTS_PER_MAP`). Merge import cannot exceed this; excess valid features are skipped.
- Maximum 10,000 vertices per line or polygon element (`MAX_VERTICES`). Features exceeding this are invalid.
- Maximum 5,000 characters for text fields (`MAX_TEXT_LENGTH`). Longer source values are truncated with summary notice.

### Import strategies

- **Add (merge)**: Creates new elements alongside existing ones. Does not modify or delete existing elements.
- **Replace**: Deletes all existing elements in the map, then creates elements from valid imported features. Irreversible without a separate undo mechanism.
- Replace with zero valid features does not delete existing elements.

### Export scope

- **Whole map**: All elements in the map are exported.
- **Selection**: Only currently selected elements are exported. Empty selection blocks export.

### Offline behavior

- GeoJSON export: allowed from local IndexedDB data.
- Shapefile export: blocked offline.
- GeoJSON and Shapefile import: allowed offline; mutations sync when online.
- Export and import reflect current local state, including unsynced changes.

### Format rules

- Accepted import formats: `.geojson`, `.json` (GeoJSON content), `.zip` (Shapefile archive).
- Export formats: `.geojson` (always), `.zip` Shapefile (online only).
- Photos are never included in GIS file interchange.
- Export does not include server-internal fields (id, version, author_id, timestamps) unless TechSpec adds optional metadata fields for round-trip workflows.

### Validation and confirmation gates

- Import requires passing through mapping review and validation summary; no silent writes.
- Replace requires destructive confirmation after strategy selection.
- Partial import requires explicit confirmation showing valid vs invalid counts.

## User Experience

### Primary flows

**Export flow**

1. Owner opens map in editor.
2. Clicks "Export data" in toolbar.
3. Chooses scope (whole map or selection).
4. Chooses format (GeoJSON or Shapefile).
5. If selection scope with no selection → blocked with guidance.
6. If Shapefile offline → blocked with connectivity message.
7. Confirms → file downloads.

**Import flow**

1. Owner opens map in editor.
2. Clicks "Import data" in toolbar.
3. Selects file from device.
4. Chooses strategy (add or replace).
5. If replace → confirms destructive warning.
6. Reviews attribute mapping (adjusts pre-mapped fields).
7. Reviews validation summary and map preview.
8. Confirms → valid features written; summary toast with final counts.

### UI placement

- Both actions live in the map editor toolbar alongside existing cartographic export (PDF/PNG) and memorial actions.
- Multi-step flows use modal dialogs with back navigation between steps.
- Mapping review shows source column name, sample value, and target field dropdown.
- Validation summary uses prominent counts and expandable detail for invalid features.

### Discoverability

- Toolbar button labels: "Import data" / "Export data" (localized labels follow product i18n conventions).
- Tooltips briefly describe supported formats.

### Accessibility

- Modal dialogs are keyboard-navigable and screen-reader labeled.
- Validation errors use `role="alert"`.
- File upload has an accessible label and format hint.

## High-Level Technical Constraints

- Must integrate with existing `map_elements` PostGIS storage (EPSG:4326, `ST_GeomFromGeoJSON` / `ST_AsGeoJSON`).
- Must reuse existing element validation (`geojson_validate_for_element`, `ST_IsValid`, vertex limits).
- Must integrate with offline store and sync outbox for offline import and GeoJSON export.
- Must not break existing cartographic PDF/PNG export (`exportar-mapa` task remains separate).
- Shapefile field name 10-character and value 254-character limits are external constraints that the product surfaces to users when truncation occurs.
- Import file size limit to be defined in TechSpec to protect client and server resources.
- Owner authorization must match existing map ownership checks.

## Non-Goals (Out of Scope)

- GIS import/export for anonymous public map viewers.
- Administrator GIS bulk export of arbitrary user maps through this feature.
- Photo or raster attachment in GIS files.
- KML, KMZ, GeoPackage, GeoParquet, or CSV interchange.
- Import/export of cartographic composition settings (PDF layout, legend, scale bar).
- Automatic scheduled or API-triggered exports.
- Real-time collaborative import (multi-user simultaneous edit).
- Geometry repair (`ST_MakeValid`) beyond normalization rules in ADR-004.
- Public open-data download portal for published maps.
- Import into multiple maps in one operation.
- Account-level export (all maps of a user in one file).

## Architecture Decision Records

- [ADR-001: Import/Export Scope — Map or Selection per Operation](adrs/adr-001.md) — User chooses whole map or selection each operation; empty selection blocks export.
- [ADR-002: Import Strategy — User-Chosen Merge or Replace](adrs/adr-002.md) — User chooses add or replace per import; replace requires destructive confirmation.
- [ADR-003: Attribute Mapping — Automatic Pre-Mapping with User Review](adrs/adr-003.md) — Known field aliases pre-map; user reviews and adjusts before import.
- [ADR-004: Geometry Normalization and CRS Reprojection](adrs/adr-004.md) — Multi* collapsed to simple types; auto-reproject to WGS84 with CRS notice.
- [ADR-005: Import Validation — Partial Import with User Confirmation](adrs/adr-005.md) — Validation summary with valid/invalid counts; user confirms partial import.
- [ADR-006: Export Content, Formats, and Offline Availability](adrs/adr-006.md) — Attributes + styles exported; GeoJSON offline; Shapefile online; owner-only access.
- [ADR-007: UI Placement — Map Editor Toolbar Actions](adrs/adr-007.md) — Import/export via toolbar modal dialogs in the map editor.

## Open Questions

- **Mixed geometry Shapefile export**: Single zip with separate shapefiles per geometry type vs one multi-type handling — deferred to TechSpec (US-003.EC-3).
- **Multi-layer Shapefile import**: Import all layers vs user picks one layer — deferred to TechSpec (US-008.AC-2).
- **Photo fate on replace import**: Whether photos of deleted elements are orphaned or cascade-deleted — align with existing element deletion behavior in TechSpec (US-007.EC-4).
- **Import file size limit**: Maximum upload size for client parsing — to be set in TechSpec based on target devices.
- **Bulk import undo**: Whether the editor undo stack covers bulk import — if not, destructive replace warning must state irreversibility explicitly.
- **Shapefile encoding defaults**: Default DBF character encoding for Brazilian Portuguese attribute values — TechSpec to specify (US-008.EC-3).
