# User Stories: GIS Data Import and Export

Canonical behavior catalog for GeoJSON and Shapefile import/export. Companion to `_prd.md`; consumed by `_techspec.md` (component mapping) and `_tests.md` (coverage matrix).

## Personas

- **Map owner (field worker)** — Verified user who creates and edits maps in the field or office. Needs to bring external GIS data into ReatCarto and export map elements for use in QGIS, ArcGIS, or other tools. Works online and offline.
- **Map owner (office analyst)** — Same persona with emphasis on bulk data interchange, attribute mapping review, and validation summaries before committing imports.

## Story Index

| ID     | Feature Area        | Persona     | Story                                              |
|--------|---------------------|-------------|----------------------------------------------------|
| US-001 | Export              | Map owner   | Export whole map as GeoJSON                        |
| US-002 | Export              | Map owner   | Export selected elements as GeoJSON                  |
| US-003 | Export              | Map owner   | Export whole map as Shapefile (online)             |
| US-004 | Export              | Map owner   | Export selected elements as Shapefile (online)     |
| US-005 | Export              | Map owner   | Export GeoJSON offline from local data             |
| US-006 | Import              | Map owner   | Import GeoJSON with merge strategy                 |
| US-007 | Import              | Map owner   | Import GeoJSON with replace strategy               |
| US-008 | Import              | Map owner   | Import Shapefile                                   |
| US-009 | Import              | Map owner   | Review and adjust attribute mapping before import  |
| US-010 | Import              | Map owner   | Review validation summary and confirm partial import |
| US-011 | Import              | Map owner   | Import data offline and sync later                   |
| US-012 | Access control      | Map owner   | Restrict GIS import/export to map owner              |
| US-013 | Geometry & CRS      | Map owner   | Normalize Multi* geometries on import                |
| US-014 | Geometry & CRS      | Map owner   | Reproject non-WGS84 coordinates on import          |

## Export

### US-001: Export whole map as GeoJSON

**As a** map owner, **I want** to export all elements of my map as a GeoJSON file, **so that** I can open the data in external GIS software.

Acceptance criteria:

- AC-1: Given an open owned map with elements, when the owner clicks "Export data", chooses scope "whole map", format GeoJSON, and confirms, then a `.geojson` file downloads containing a `FeatureCollection` with one `Feature` per visible element.
- AC-2: Given an exported file, when opened in a standard GIS tool, then each feature includes geometry in WGS84 and `properties` with name, description, category, and style fields.
- AC-3: Given a map with zero elements, when the owner attempts whole-map export, then the system blocks the export with a message that the map has no elements to export.

Edge cases:

- EC-1: Map at the 5,000-element limit → all 5,000 features appear in the export without truncation.
- EC-2: Element with empty name → feature exports with an empty or generated name property; export does not fail.
- EC-3: Element with style containing special characters → properties serialize without corrupting the JSON file.
- EC-4: User triggers export twice quickly → two separate downloads occur without error (not idempotent by design; no duplicate prevention needed).
- EC-5: Session expires mid-export → export fails with an authentication message; no partial file is presented as successful.
- EC-6: Non-owner attempts export via direct action → action is not available; no file is produced.

### US-002: Export selected elements as GeoJSON

**As a** map owner, **I want** to export only selected elements as GeoJSON, **so that** I can share a subset of my map data.

Acceptance criteria:

- AC-1: Given selected elements on the map, when the owner chooses scope "selection" and format GeoJSON, then only selected elements appear in the downloaded `FeatureCollection`.
- AC-2: Given no elements selected, when the owner chooses scope "selection", then the system blocks export and instructs the owner to select elements on the map first.
- AC-3: Given a mix of point, line, and polygon elements selected, when export completes, then all selected geometry types are present in the output file.

Edge cases:

- EC-1: One of five selected elements has invalid stored geometry → that element is omitted from export with a warning in the export summary; remaining selected elements export successfully.
- EC-2: Selection changes while export dialog is open → dialog reflects current selection count at confirm time.
- EC-3: Select all elements via UI equivalent to whole map → export contains all elements (same result as US-001).
- EC-4: Element selected but hidden by layer filter → behavior follows current map visibility rules; if hidden elements are excluded from selection, export count matches visible selection only (TechSpec aligns with editor selection model).

### US-003: Export whole map as Shapefile (online)

**As a** map owner, **I want** to export all elements as a Shapefile zip while online, **so that** I can use the data in desktop GIS tools that prefer Shapefile format.

Acceptance criteria:

- AC-1: Given an online connection and an owned map with elements, when the owner chooses whole-map export and format Shapefile, then a `.zip` downloads containing `.shp`, `.shx`, `.dbf`, and `.prj` (WGS84).
- AC-2: Given the exported Shapefile opened in QGIS or ArcGIS, then geometries and attribute fields for name, description, category, and style properties are readable.
- AC-3: Given the device is offline, when the owner selects Shapefile export, then the option is disabled or blocked with a message that Shapefile export requires an internet connection.

Edge cases:

- EC-1: Style field names exceed Shapefile 10-character DBF limit → names are truncated with a documented truncation pattern; values are preserved up to 254 characters.
- EC-2: Map contains only points → valid point Shapefile is produced.
- EC-3: Map contains mixed geometry types → export produces separate shapefiles per geometry type inside the zip, or a single layer per TechSpec decision; user sees which layers are included before download.
- EC-4: Server error during zip generation → user sees an error message; no corrupt zip is offered as successful.
- EC-5: Very large map (thousands of elements) → export completes or shows a progress indicator; if timeout occurs, user sees a retry message.

### US-004: Export selected elements as Shapefile (online)

**As a** map owner, **I want** to export selected elements as a Shapefile while online, **so that** I can share a subset in legacy GIS formats.

Acceptance criteria:

- AC-1: Given selected elements and an online connection, when the owner exports as Shapefile with scope "selection", then the zip contains only selected features.
- AC-2: Given no selection and scope "selection", when the owner attempts Shapefile export, then export is blocked with guidance to select elements first (same rule as US-002.AC-2).

Edge cases:

- EC-1: Single element selected → valid single-feature Shapefile zip downloads.
- EC-2: Selected elements span multiple geometry types → handled per mixed-type rule established in US-003.EC-3.
- EC-3: Connection lost after confirm but before download completes → user sees a network error; no partial zip marked as success.

### US-005: Export GeoJSON offline from local data

**As a** map owner working offline, **I want** to export GeoJSON from locally stored map data, **so that** I can transfer data without waiting for connectivity.

Acceptance criteria:

- AC-1: Given a downloaded offline map with local elements, when the owner exports GeoJSON (whole map or selection per scope rules), then the file is generated from local IndexedDB data without requiring a server call.
- AC-2: Given offline export, when the owner later opens the file on a desktop GIS tool, then geometries and attributes match the local data at export time.
- AC-3: Given offline mode, when the owner attempts Shapefile export, then the option remains unavailable per US-003.AC-3.

Edge cases:

- EC-1: Local data has unsynced changes from a prior edit → export reflects current local state including unsynced changes.
- EC-2: Offline map was never fully downloaded (partial cache) → export uses available local elements; user is warned if data may be incomplete.
- EC-3: Device storage full during file generation → export fails with a storage error message.

## Import

### US-006: Import GeoJSON with merge strategy

**As a** map owner, **I want** to import a GeoJSON file and add its features to my existing map, **so that** I can combine external data with field-collected elements.

Acceptance criteria:

- AC-1: Given an owned map and a valid GeoJSON file, when the owner chooses import, strategy "add", completes mapping review, confirms the validation summary, then new elements are created alongside existing ones.
- AC-2: Given merge import, when the new total would exceed 5,000 elements, then excess features are listed as skipped in the validation summary and only up to the limit are imported.
- AC-3: Given a successful merge import, when the owner views the map, then imported elements appear with mapped name, description, category, and style.

Edge cases:

- EC-1: GeoJSON is a single `Feature` (not a collection) → treated as a one-feature import.
- EC-2: GeoJSON is a bare geometry object → wrapped as a feature with generated name.
- EC-3: File is valid JSON but not valid GeoJSON → import blocked at parse stage with a clear format error.
- EC-4: Empty `FeatureCollection` → import blocked with message that no features were found.
- EC-5: Duplicate geometries in file → each feature creates a separate element (no deduplication).
- EC-6: Import cancelled at mapping review → no elements created or modified.
- EC-7: Offline merge import → elements created locally and queued in sync outbox.

### US-007: Import GeoJSON with replace strategy

**As a** map owner, **I want** to import a GeoJSON file and replace all existing elements, **so that** I can refresh my map from an external source of truth.

Acceptance criteria:

- AC-1: Given an owned map with existing elements, when the owner chooses strategy "replace", then a destructive confirmation warning appears before proceeding.
- AC-2: Given confirmed replace import, when import completes, then all previous elements are removed and only imported features remain.
- AC-3: Given replace cancelled at the destructive confirmation, then no elements are deleted and no import occurs.

Edge cases:

- EC-1: Replace with zero valid features after validation → import blocked; existing elements are not deleted.
- EC-2: Replace on a map with unsynced offline changes → warning mentions unsynced changes will be lost.
- EC-3: Replace then immediate undo (if supported) → behavior defined in TechSpec; if undo not extended to bulk, user is informed replace is irreversible.
- EC-4: Map has photos attached to elements being replaced → photos of deleted elements follow existing deletion semantics (orphaned or deleted per TechSpec alignment with element deletion).

### US-008: Import Shapefile

**As a** map owner, **I want** to import a Shapefile (zip or component files), **so that** I can bring legacy GIS data into my map.

Acceptance criteria:

- AC-1: Given a `.zip` containing `.shp`, `.shx`, and `.dbf`, when the owner uploads it for import, then features are parsed and the standard import flow (strategy, mapping, validation, confirm) proceeds.
- AC-2: Given a zip with multiple shapefile layers, when import proceeds, then the user chooses which layer to import or all layers are imported as separate element batches per TechSpec; user sees layer list before mapping review.
- AC-3: Given a `.shp` without `.dbf`, when uploaded, then import proceeds with geometry only and empty attributes (mapping review shows no source fields).

Edge cases:

- EC-1: Zip contains no `.shp` file → blocked with invalid archive message.
- EC-2: Corrupt `.shp` binary → blocked at parse with error detail.
- EC-3: `.dbf` encoding mismatch (Latin-1 vs UTF-8) → attributes decoded with best effort; unmappable characters shown as replacement or flagged in summary.
- EC-4: Shapefile exceeds reasonable size limit (TechSpec defines) → blocked with size limit message before parsing.
- EC-5: Upload of individual `.shp` + `.dbf` + `.prj` files without zip → supported if TechSpec allows multi-file picker; otherwise user directed to zip files.

### US-009: Review and adjust attribute mapping before import

**As a** map owner, **I want** to review how source fields map to ReatCarto fields before confirming import, **so that** my data lands in the correct attributes.

Acceptance criteria:

- AC-1: Given a parsed file with attribute columns, when the mapping review screen opens, then known field names are pre-mapped (e.g., `nome` → name) and all source columns are listed.
- AC-2: Given the owner changes a mapping and confirms, then imported elements reflect the adjusted mapping.
- AC-3: Given a source column marked "ignore", when import completes, then that column's values do not appear on any element.

Edge cases:

- EC-1: Source file has no attribute columns → mapping review shows geometry-only import with defaults for name.
- EC-2: Two source columns mapped to the same target → last mapping wins or blocked with conflict message (TechSpec picks one; user sees clear outcome).
- EC-3: Source value exceeds `MAX_TEXT_LENGTH` (5,000) → truncated with warning in validation summary.
- EC-4: Source style field contains non-numeric value for numeric style property → default style value used; noted in summary.

### US-010: Review validation summary and confirm partial import

**As a** map owner, **I want** to see how many features are valid before importing, **so that** I understand what will and will not be added to my map.

Acceptance criteria:

- AC-1: Given a parsed file with valid and invalid features, when the validation summary appears, then it shows total, valid, and invalid counts with categorized reasons.
- AC-2: Given the owner confirms a partial import, then only valid features are created; invalid features are skipped.
- AC-3: Given zero valid features, when validation completes, then import is blocked and no map changes occur.
- AC-4: Given a map preview in the summary, when valid features are shown, then their locations are visible overlaid on the current map extent.

Edge cases:

- EC-1: All features invalid → blocked; summary lists all failure reasons.
- EC-2: Valid features exceed vertex limit individually → each counted as invalid with "vertex limit" reason.
- EC-3: Owner declines at summary → no changes to map.
- EC-4: Post-import, owner views an import log or toast with final counts (imported vs skipped).

### US-011: Import data offline and sync later

**As a** map owner working offline, **I want** to import GIS files into my downloaded map, **so that** I can add external data in the field without connectivity.

Acceptance criteria:

- AC-1: Given an offline downloaded map, when the owner imports a GeoJSON or Shapefile, then elements are created in local storage and mutations are queued for sync.
- AC-2: Given connectivity returns, when sync runs, then imported elements appear on the server with correct geometry and attributes.
- AC-3: Given offline replace import, when sync runs, then server-side elements match the replaced local state.

Edge cases:

- EC-1: Sync conflict on an element edited both locally and on server → existing conflict resolution flow applies.
- EC-2: Import queue exceeds device storage → import blocked with storage message.
- EC-3: Server rejects an element on sync (validation failure) → owner sees sync error for that element with reason.

## Access Control

### US-012: Restrict GIS import/export to map owner

**As a** map owner, **I want** only me to import or export GIS data from my maps, **so that** my spatial data interchange remains private and controlled.

Acceptance criteria:

- AC-1: Given the map editor for an owned map, when the owner views the toolbar, then "Import data" and "Export data" actions are visible and functional.
- AC-2: Given a published map viewed by an anonymous visitor, when they view the public map, then GIS import/export actions are not available.
- AC-3: Given an administrator viewing another user's private map, when they access the editor, then GIS import/export actions are not available (admin uses existing intervention tools separately).

Edge cases:

- EC-1: Owner's session expires → actions require re-authentication.
- EC-2: Direct API call to import/export endpoint without ownership → rejected with authorization error.
- EC-3: Shared map link (if any future sharing exists) → no GIS export unless owner is authenticated as owner.

## Geometry and CRS

### US-013: Normalize Multi* geometries on import

**As a** map owner, **I want** MultiPolygon and other complex geometries converted to supported types, **so that** I can import common GIS files without manual preprocessing.

Acceptance criteria:

- AC-1: Given a `MultiPolygon` feature, when import normalizes it, then a single polygon element is created.
- AC-2: Given a `MultiLineString` feature, when import normalizes it, then a single line element is created.
- AC-3: Given a geometry that cannot be normalized, when validation runs, then it appears in the invalid count with a clear reason.

Edge cases:

- EC-1: MultiPolygon with disjoint islands → single polygon element per ADR-004 union/extraction rule; user warned if detail may be lost.
- EC-2: GeometryCollection with multiple types → first convertible geometry used; remainder reported as skipped.
- EC-3: Valid geometry fails `ST_IsValid` after normalization → marked invalid; repair not attempted automatically unless TechSpec adds `ST_MakeValid`.

### US-014: Reproject non-WGS84 coordinates on import

**As a** map owner, **I want** files in other coordinate systems automatically converted to WGS84, **so that** features appear in the correct location on my map.

Acceptance criteria:

- AC-1: Given a Shapefile with a valid `.prj` in SIRGAS 2000 or UTM, when import proceeds, then coordinates are reprojected to WGS84 and the preview shows a CRS notice.
- AC-2: Given a file with no CRS information, when import proceeds, then coordinates are assumed WGS84 and a warning is displayed.
- AC-3: Given reprojected features, when placed on the map, then they align with the expected geographic location within reasonable accuracy.

Edge cases:

- EC-1: Malformed `.prj` file → treated as unknown CRS with WGS84 assumption and warning.
- EC-2: GeoJSON with `crs` member (legacy) → CRS extracted and reprojection applied.
- EC-3: Coordinates in projected units without `.prj` → features appear in wrong location; user can detect via preview and cancel.
- EC-4: Reprojection pushes geometry outside valid lat/lon range → feature marked invalid in summary.
