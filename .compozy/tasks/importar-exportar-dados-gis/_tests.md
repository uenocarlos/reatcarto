# Test Specification: GIS Data Import and Export

Canonical test contract for GIS import/export. Companion to `_techspec.md`.
Derived from `_user_stories.md` (behavior) and `_techspec.md` (components).

## Strategy

- **Frameworks:** Vitest for JS unit/integration; Vitest + Testing Library for component/E2E UI tests; PHPUnit for PHP services
- **Fixtures:** `tests/fixtures/gis/` — sample `.geojson`, `.zip` shapefiles (single/multi-layer, SIRGAS2000 `.prj`, Latin-1 DBF, invalid geometries, empty collections
- **Fakes:** Mock `fetch` at `gisClient` boundary; mock `OfflineStore` at `offlineBulkImport` boundary; use test DB transactions for PHP integration
- **Execution:** `npm run test:unit` for JS; `vendor/bin/phpunit tests/php/Gis/` for PHP
- **Conventions:** Table-driven where inputs are parameterized; `data-testid` for wizard step assertions

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|--------|----------|------|-------------|-----|
| US-001 | Export whole map GeoJSON | UT-020–UT-024 | IT-010 | E2E-001 |
| US-001.EC-1 | 5000 elements export | UT-024 | IT-010 | — |
| US-001.EC-2 | Empty name export | UT-022 | — | — |
| US-001.EC-3 | Special chars in style | UT-023 | — | — |
| US-001.EC-4 | Double export | — | — | E2E-002 |
| US-001.EC-5 | Session expires mid-export | — | IT-011 | E2E-003 |
| US-001.EC-6 | Non-owner export blocked | — | IT-012 | E2E-004 |
| US-002 | Export selected GeoJSON | UT-025 | IT-013 | E2E-005 |
| US-002.EC-1 | Invalid geometry omitted | UT-026 | — | — |
| US-002.EC-2 | Selection changes at confirm | — | — | E2E-006 |
| US-002.EC-3 | Select all equals whole map | UT-025 | — | E2E-007 |
| US-002.EC-4 | Hidden element in picker | UT-027 | — | — |
| US-003 | Export whole map Shapefile | UT-040–UT-043 | IT-020 | E2E-010 |
| US-003.EC-1 | DBF field truncation | UT-041 | IT-020 | — |
| US-003.EC-2 | Points only shapefile | UT-042 | IT-021 | — |
| US-003.EC-3 | Mixed geometry separate shp | UT-043 | IT-022 | E2E-011 |
| US-003.EC-4 | Server error no corrupt zip | — | IT-023 | E2E-012 |
| US-003.EC-5 | Large map export progress | — | IT-024 | — |
| US-004 | Export selected Shapefile | UT-044 | IT-025 | E2E-013 |
| US-004.EC-1 | Single element shapefile | UT-044 | IT-025 | — |
| US-004.EC-2 | Mixed types in selection | UT-043 | IT-022 | — |
| US-004.EC-3 | Connection lost mid-download | — | IT-026 | E2E-014 |
| US-005 | GeoJSON export offline | UT-020 | IT-030 | E2E-020 |
| US-005.EC-1 | Unsynced changes in export | UT-028 | IT-030 | E2E-021 |
| US-005.EC-2 | Partial cache warning | UT-029 | IT-031 | E2E-022 |
| US-005.EC-3 | Storage full on export | UT-030 | — | — |
| US-006 | Import GeoJSON merge | UT-050–UT-055 | IT-040 | E2E-030 |
| US-006.EC-1 | Single Feature not Collection | UT-050 | — | — |
| US-006.EC-2 | Bare geometry wrapped | UT-051 | — | — |
| US-006.EC-3 | Invalid JSON blocked | UT-052 | — | E2E-031 |
| US-006.EC-4 | Empty FeatureCollection | UT-053 | — | E2E-032 |
| US-006.EC-5 | Duplicate geometries separate | UT-054 | IT-040 | — |
| US-006.EC-6 | Cancel at mapping | — | — | E2E-033 |
| US-006.EC-7 | Offline merge import | UT-055 | IT-041 | E2E-034 |
| US-007 | Import GeoJSON replace | UT-056 | IT-042 | E2E-040 |
| US-007.EC-1 | Replace zero valid blocked | UT-057 | IT-043 | E2E-041 |
| US-007.EC-2 | Replace warns unsynced | — | IT-044 | E2E-042 |
| US-007.EC-3 | Replace no undo | — | — | E2E-043 |
| US-007.EC-4 | Photos cascade on replace | — | IT-045 | — |
| US-008 | Import Shapefile | UT-060–UT-066 | IT-050 | E2E-050 |
| US-008.EC-1 | Zip without shp blocked | UT-061 | — | E2E-051 |
| US-008.EC-2 | Corrupt shp blocked | UT-062 | — | — |
| US-008.EC-3 | DBF encoding fallback | UT-063 | — | — |
| US-008.EC-4 | File size limit 50MB | UT-064 | — | E2E-052 |
| US-008.EC-5 | Zip only no loose shp | UT-065 | — | E2E-053 |
| US-009 | Attribute mapping review | UT-070–UT-075 | IT-060 | E2E-060 |
| US-009.EC-1 | Geometry-only mapping | UT-070 | — | — |
| US-009.EC-2 | Duplicate target blocked | UT-071 | — | E2E-061 |
| US-009.EC-3 | Text truncation warning | UT-072 | — | — |
| US-009.EC-4 | Invalid style value default | UT-073 | — | — |
| US-010 | Validation summary | UT-080–UT-085 | IT-070 | E2E-070 |
| US-010.EC-1 | All invalid blocked | UT-081 | IT-071 | E2E-071 |
| US-010.EC-2 | Vertex limit invalid | UT-082 | — | — |
| US-010.EC-3 | Decline at summary | — | — | E2E-072 |
| US-010.EC-4 | Post-import toast counts | — | IT-072 | E2E-073 |
| US-011 | Offline import sync | UT-055 | IT-041, IT-080 | E2E-080 |
| US-011.EC-1 | Sync conflict on element | — | IT-081 | — |
| US-011.EC-2 | Storage quota blocked | UT-086 | — | — |
| US-011.EC-3 | Server rejects on sync | — | IT-082 | — |
| US-012 | Owner-only access | — | IT-090 | E2E-090 |
| US-012.EC-1 | Session expired reauth | — | IT-091 | E2E-091 |
| US-012.EC-2 | Direct API no ownership | — | IT-092 | — |
| US-012.EC-3 | Shared link no export | — | — | E2E-092 |
| US-013 | Normalize Multi* | UT-001–UT-008 | IT-001 | E2E-100 |
| US-013.EC-1 | Disjoint MultiPolygon union | UT-005 | — | — |
| US-013.EC-2 | GeometryCollection first part | UT-006 | — | — |
| US-013.EC-3 | ST_IsValid fail after normalize | UT-007 | IT-002 | — |
| US-014 | CRS reprojection | UT-010–UT-015 | IT-003 | E2E-101 |
| US-014.EC-1 | Malformed prj warning | UT-011 | — | — |
| US-014.EC-2 | GeoJSON legacy crs | UT-012 | — | — |
| US-014.EC-3 | Projected coords no prj | UT-013 | — | — |
| US-014.EC-4 | Out of range after reproject | UT-014 | — | — |
| fetchAllMapElements | Paginated element fetch | UT-090 | IT-005 | — |
| exportGeoJson | FeatureCollection builder | UT-020–UT-024 | — | — |
| gisClient.exportShapefile | SHP download client | UT-045 | IT-020 | — |
| gisClient.importElements | Batch import client | UT-058 | IT-040 | — |
| ElementImportService | PHP batch import | UT-100–UT-108 | IT-040–IT-045 | — |
| ShapefileExportService | PHP shp zip | UT-110–UT-115 | IT-020–IT-026 | — |
| offlineBulkImport | Offline write path | UT-055, UT-086 | IT-041 | — |
| SyncEngine map/import | Outbox flush | — | IT-080 | — |
| GisExportDialog | Export wizard UI | UT-120–UT-125 | — | E2E-001–E2E-014 |
| GisImportDialog | Import wizard UI | UT-130–UT-138 | — | E2E-030–E2E-073 |

## Unit Tests

### normalizeGeometry.js (TechSpec: Geometry and CRS)

- **UT-001** (happy): `normalizeGeometry` — given `MultiPoint` with 3 coordinates, returns `Point` with first coordinate.
- **UT-002** (happy): `normalizeGeometry` — given `MultiLineString` with parts lengths [10, 50, 30], returns `LineString` of the 50-unit part.
- **UT-003** (boundary): `normalizeGeometry` — given `MultiLineString` with two equal-length parts, returns first part.
- **UT-004** (happy): `normalizeGeometry` — given adjacent `MultiPolygon` with 2 parts, returns single `Polygon` via union.
- **UT-005** (boundary): `normalizeGeometry` — given disjoint `MultiPolygon` islands, union produces single polygon; flags `detailLossWarning: true`.
- **UT-006** (happy): `normalizeGeometry` — given `GeometryCollection` with Point then LineString, returns `Point`; reports 1 skipped part.
- **UT-007** (error): `normalizeGeometry` — given `MultiPolygon` where union throws, returns `null` with reason `union_failed`.
- **UT-008** (error): `normalizeGeometry` — given `GeometryCollection` with only unsupported types, returns `null` with reason `unsupported_type`.

### crs.js (TechSpec: Geometry and CRS)

- **UT-010** (happy): `detectAndReproject` — given SIRGAS2000 `.prj` WKT and UTM coordinates, returns WGS84 coords and `crsNotice: { detected: 'EPSG:4674', reprojected: true }`.
- **UT-011** (error): `detectAndReproject` — given malformed WKT string, assumes EPSG:4326 with `crsNotice: { assumed: true, warning: 'malformed_prj' }`.
- **UT-012** (happy): `detectAndReproject` — given GeoJSON with legacy `crs.properties.name` EPSG:31983, reprojects to WGS84.
- **UT-013** (boundary): `detectAndReproject` — given projected-looking coords with no CRS metadata, assumes WGS84 with warning.
- **UT-014** (error): `detectAndReproject` — given coords that reproject to lat=95, returns `invalid: true, reason: 'out_of_bounds'`.
- **UT-015** (happy): `detectAndReproject` — given already WGS84 coords, returns unchanged with `reprojected: false`.

### parseGeoJson.js (TechSpec: parseGeoJson)

- **UT-050** (happy): `parseGeoJsonFile` — given single `Feature` object, returns array of 1 feature.
- **UT-051** (happy): `parseGeoJsonFile` — given bare `Polygon` geometry, wraps as feature with generated name placeholder.
- **UT-052** (error): `parseGeoJsonFile` — given `{ "foo": 1 }`, throws `GisParseError` code `invalid_geojson`.
- **UT-053** (error): `parseGeoJsonFile` — given `FeatureCollection` with `features: []`, throws code `no_features`.

### parseShapefile.js (TechSpec: parseShapefile)

- **UT-060** (happy): `parseShapefileZip` — given zip with `roads.shp/.dbf/.shx/.prj`, returns layer list with 1 entry and features array.
- **UT-061** (error): `parseShapefileZip` — given zip with only `.txt`, throws code `no_shapefile`.
- **UT-062** (error): `parseShapefileZip` — given zip with truncated corrupt `.shp`, throws code `corrupt_shapefile`.
- **UT-063** (boundary): `parseShapefileZip` — given Latin-1 DBF with `ã` bytes, decodes correctly after UTF-8 attempt fails.
- **UT-064** (boundary): `parseShapefileZip` — given file of 51_000_000 bytes, throws code `file_too_large` before parsing.
- **UT-065** (error): `parseShapefileZip` — given loose `.shp` file (not zip), throws code `unsupported_format`.
- **UT-066** (happy): `parseShapefileZip` — given multi-layer zip with `roads.shp` and `parcels.shp`, returns 2 layers; with `selectedLayer: 'parcels'`, returns only parcels features.

### validateFeatures.js (TechSpec: validateFeatures)

- **UT-054** (happy): `validateImportFeatures` — given 2 identical Point features, both marked valid (no dedup).
- **UT-055** (happy): `validateImportFeatures` — given merge strategy, `currentCount=4999`, 2 valid features, returns 1 valid + 1 `capacity_skipped`.
- **UT-056** (happy): `validateImportFeatures` — given replace strategy, `currentCount=100`, 50 valid features, all 50 valid.
- **UT-057** (error): `validateImportFeatures` — given replace strategy, 0 valid features, returns `valid: 0` and `blocked: true`.
- **UT-080** (happy): `validateImportFeatures` — given 5 features (3 valid, 2 invalid), returns counts `{ total:5, valid:3, invalid:2 }` with categorized reasons.
- **UT-081** (error): `validateImportFeatures` — given 3 invalid features, returns `valid: 0, blocked: true`.
- **UT-082** (error): `validateImportFeatures` — given LineString with 10001 vertices post-normalize, marks invalid reason `vertex_limit`.
- **UT-085** (happy): `validateImportFeatures` — given valid features, returns `previewGeoJson` FeatureCollection for map overlay.
- **UT-086** (error): `validateImportFeatures` — given `navigator.storage.estimate` quota exceeded mock, throws `storage_quota_exceeded`.

### attributeMapping.js (TechSpec: attributeMapping)

- **UT-070** (happy): `buildDefaultMapping` — given columns `['nome','desc']`, maps `nome→name`, `desc→description`.
- **UT-071** (error): `detectMappingConflicts` — given two columns mapped to `name`, returns conflict pair; `canAdvance: false`.
- **UT-072** (boundary): `applyMapping` — given description value of 6000 chars, truncates to 5000 and sets `truncated: true`.
- **UT-073** (error): `applyMapping` — given `opacity: 'abc'` for line style, uses default 100 and flags `style_defaulted`.
- **UT-074** (happy): `applyMapping` — given column mapped to `ignore`, field omitted from element payload.
- **UT-075** (happy): `applyMapping` — given no name mapping, generates `Importado 1`.

### exportGeoJson.js (TechSpec: exportGeoJson)

- **UT-020** (happy): `buildFeatureCollection` — given 3 elements (point, line, polygon), returns FeatureCollection with 3 features in WGS84.
- **UT-021** (happy): `buildFeatureCollection` — given element with `element_category: 'agua'`, properties include `category: 'agua'`.
- **UT-022** (boundary): `buildFeatureCollection` — given element with empty name, properties.name is `''`.
- **UT-023** (happy): `buildFeatureCollection` — given style with unicode and quotes, JSON.stringify produces valid file content.
- **UT-024** (boundary): `buildFeatureCollection` — given 5000 elements, returns 5000 features without truncation.
- **UT-025** (happy): `buildFeatureCollection` — given `elementIds` filter with 2 of 5 elements, returns 2 features.
- **UT-026** (error): `buildFeatureCollection` — given element with unparseable stored geojson, omits feature and returns `warnings: [{ id, reason: 'invalid_geometry' }]`.
- **UT-027** (happy): `buildFeatureCollection` — given element in picker list regardless of map visibility state, exports if id in selection.
- **UT-028** (happy): `buildFeatureCollection` — given locally modified unsynced element from IDB, exports local geometry.
- **UT-029** (happy): `buildFeatureCollection` — given `preparedMapIncomplete: true` flag, returns features plus `incompleteWarning: true`.
- **UT-030** (error): `exportGeoJsonToFile` — given `URL.createObjectURL` throws quota error, propagates `storage_error`.

### Shapefile field mapping (TechSpec: Data Models)

- **UT-041** (boundary): `truncateShpFieldNames` — given `description` and `border_color`, returns `descript` and `border_col` (≤10 chars).
- **UT-042** (happy): `truncateShpValues` — given 300-char string, truncates to 254 and sets `truncated: true`.

### gisClient.js (TechSpec: gisClient)

- **UT-090** (happy): `fetchAllMapElements` — given API returning 250 elements across 3 pages (100+100+50), returns all 250.
- **UT-045** (happy): `exportShapefile` — given valid params, calls `POST /php/elements/export-shp.php` with credentials and returns Blob.
- **UT-058** (happy): `importElements` — given 10 element payloads, POSTs to `/php/elements/import.php` with `client_mutation_id`.

### GisExportDialog (TechSpec: UI)

- **UT-120** (happy): scope step — selecting `whole` + `GeoJSON` enables Confirm when elements > 0.
- **UT-121** (error): scope step — `whole` with 0 elements disables Confirm and shows `no-elements-message`.
- **UT-122** (error): format step — when `isOnline()=false`, Shapefile radio disabled with tooltip `shapefile-requires-connection`.
- **UT-123** (error): picker step — zero checked elements disables Confirm.
- **UT-124** (happy): confirm step — mixed geometry Shapefile shows layer list `points, lines, polygons`.
- **UT-125** (happy): confirm step — triggers `exportGeoJsonToFile` with slugified filename containing date.

### GisImportDialog (TechSpec: UI)

- **UT-130** (happy): file step — accepts `.geojson` and begins parse.
- **UT-131** (happy): layer step — skipped when single-layer zip.
- **UT-132** (happy): destructive step — replace strategy shows AlertDialog with `irreversible-warning`.
- **UT-133** (error): mapping step — conflict present disables Next button.
- **UT-134** (happy): validation step — renders `role="alert"` for zero valid features.
- **UT-135** (happy): importing step — shows Progress bar with percent during batch write.
- **UT-136** (error): file step — 51MB file shows `file-too-large` alert before parse.
- **UT-137** (happy): cancel at mapping — calls `onClose` without API call.
- **UT-138** (happy): post-import — toast shows `imported` and `skipped` counts.

### ElementImportService.php (TechSpec: PHP batch import)

- **UT-100** (happy): `elements_import_batch` merge — given 5 valid elements on map with 10 existing, inserts 5 and returns `imported: 5`.
- **UT-101** (happy): `elements_import_batch` replace — given 3 valid elements on map with 10 existing, deletes 10 (with photos), inserts 3.
- **UT-102** (error): `elements_import_batch` replace — given 0 valid elements, returns `imported: 0` and does NOT delete existing.
- **UT-103** (boundary): `elements_import_batch` merge — given `current=4998` and 5 valid, imports 2 and returns `skipped: 3` capacity.
- **UT-104** (error): `elements_import_batch` — given non-owner user, throws 403.
- **UT-105** (error): `elements_import_batch` — given invalid geojson failing `ST_IsValid`, returns element in `errors` array.
- **UT-106** (error): `elements_import_batch` — given duplicate `client_mutation_id`, returns 409 idempotent response.
- **UT-107** (happy): `elements_import_batch` — given MultiPolygon-normalized-as-polygon server-side input as simple Polygon, accepts insert.
- **UT-108** (idempotency): `elements_import_batch` — replaying same `client_mutation_id` returns original summary without double insert.

### ShapefileExportService.php (TechSpec: PHP export)

- **UT-110** (happy): `elements_export_shapefile` whole — given map with 5 points, streams zip containing `{slug}-points.shp/.shx/.dbf/.prj`.
- **UT-111** (happy): `elements_export_shapefile` selection — given 2 element ids of 10, zip contains only 2 features.
- **UT-112** (error): `elements_export_shapefile` — given non-owner, returns 403.
- **UT-113** (error): `elements_export_shapefile` — given 0 elements in scope, returns 422.
- **UT-114** (happy): `elements_export_shapefile` — given mixed types, zip contains 3 shapefile sets.
- **UT-115** (error): `elements_export_shapefile` — given ogr2ogr failure mock, returns 500 without partial zip body.

## Integration Tests

### Client parse → validate pipeline (TechSpec: gis lib boundary)

- **IT-001**: `parseShapefileZip` → `normalizeGeometry` → `validateImportFeatures` — setup SIRGAS2000 fixture zip; expect valid count > 0 and WGS84 coordinates.
- **IT-002**: same pipeline with self-intersecting polygon fixture; expect feature in `invalid` with server-mirrored reason.
- **IT-003**: `parseShapefileZip` with legacy crs GeoJSON-equivalent fixture; expect `crsNotice.reprojected: true`.

### Element pagination (TechSpec: fetchAllMapElements)

- **IT-005**: `fetchAllMapElements` with mocked paginated API (350 elements); expect single array length 350.

### GeoJSON export (US-001, US-002)

- **IT-010**: `fetchAllMapElements` → `buildFeatureCollection` → `exportGeoJsonToFile` — setup 150-element map mock; expect downloaded blob type `application/geo+json`.
- **IT-011**: export with expired session mock (401 on fetch); expect error surfaced, no download triggered.
- **IT-012**: `exportShapefile` as non-owner mock (403); expect error message, no blob.
- **IT-013**: selection export with 3 of 10 ids; expect FeatureCollection length 3.

### Shapefile export (US-003, US-004)

- **IT-020**: `POST export-shp.php` with test DB map (10 elements mixed); expect zip with valid shp/dbf/prj per ADR-012.
- **IT-021**: export map with points only; expect zip with single `-points` layer.
- **IT-022**: export mixed geometry; expect 3 shapefile sets in zip.
- **IT-023**: mock ogr2ogr failure; expect HTTP 500 and empty/corrupt body not offered.
- **IT-024**: export 1000-element map; expect response within timeout threshold (configurable, e.g. 30s).
- **IT-025**: selection export 1 element; expect zip with 1 DBF record.
- **IT-026**: simulate connection drop mid-stream; client rejects incomplete blob.

### Batch import (US-006, US-007)

- **IT-040**: `importElements` merge with 20 features on map with 5 existing; expect DB count 25.
- **IT-041**: `offlineBulkImport` merge → outbox entry → SyncEngine flush → `import.php`; expect server count matches.
- **IT-042**: replace with 15 features on map with 50 existing; expect DB count 15, old ids gone.
- **IT-043**: replace with all-invalid payload; expect DB count unchanged at 50.
- **IT-044**: replace with pending outbox mutations; dialog shows unsynced warning (component integration).
- **IT-045**: replace on map whose elements have photos; expect `photos` table rows deleted for old elements.

### Attribute mapping + import (US-009)

- **IT-060**: full pipeline with `nome` column fixture; expect imported element `name` equals DBF value.

### Validation summary (US-010)

- **IT-070**: import 10 features (7 valid, 3 invalid); confirm partial; expect 7 rows in `map_elements`.
- **IT-071**: all-invalid file; expect wizard blocks confirm, 0 DB changes.
- **IT-072**: post-import toast integration; expect toast text matches `{imported}/{skipped}`.

### Offline sync (US-011)

- **IT-080**: enqueue `map/import` replace offline → go online → flush; expect server elements match local.
- **IT-081**: import offline then conflicting server edit; expect conflict modal on sync (existing flow).
- **IT-082**: server rejects one element on sync (422 in batch errors); expect failed mutation surfaced.

### Access control (US-012)

- **IT-090**: owner sees `gis-export-entry` and `gis-import-entry` in MapEditor; anonymous PublicMap does not render buttons.
- **IT-091**: expired session on import confirm; expect 401 and re-auth prompt.
- **IT-092**: `POST import.php` without ownership; expect 403 JSON `{ code: 'forbidden' }`.

## End-to-End Tests

### Export GeoJSON (US-001, US-002, US-005)

- **E2E-001**: MapEditor → click `gis-export-entry` → whole map → GeoJSON → confirm → expect download filename matching `{map-name}-\d{4}-\d{2}-\d{2}\.geojson`.
- **E2E-002**: trigger export twice quickly → expect 2 download calls without error.
- **E2E-003**: mock 401 mid-wizard → expect auth error alert, no successful download.
- **E2E-004**: render MapEditor as non-owner → `gis-export-entry` not in document.
- **E2E-005**: selection scope → pick 2 elements in picker → GeoJSON → expect FeatureCollection with 2 features.
- **E2E-006**: open picker, change selection, confirm → export count matches final selection.
- **E2E-007**: select all in picker → export matches whole-map feature count.
- **E2E-020**: offline mode mock → GeoJSON export succeeds from IDB data.
- **E2E-021**: offline with unsynced edit → exported file contains edited geometry.
- **E2E-022**: partial cache mock → wizard shows incomplete data warning before export.

### Export Shapefile (US-003, US-004)

- **E2E-010**: online → whole map → Shapefile → confirm → expect `.zip` download.
- **E2E-011**: mixed geometry map → confirm step lists multiple layers before download.
- **E2E-012**: server 500 mock → expect error message, no success toast.
- **E2E-013**: selection scope → 1 element → Shapefile → expect zip with 1 record.
- **E2E-014**: network abort mock mid-download → expect network error message.

### Import GeoJSON (US-006, US-007, US-009, US-010)

- **E2E-030**: upload valid GeoJSON → merge → mapping → validation → confirm → expect element count increases.
- **E2E-031**: upload invalid JSON → expect parse error at file step.
- **E2E-032**: upload empty FeatureCollection → expect blocked with no-features message.
- **E2E-033**: cancel at mapping step → expect element count unchanged.
- **E2E-034**: offline merge import → expect local IDB count increases and outbox pending.
- **E2E-040**: replace flow → confirm destructive → import → expect only imported elements remain.
- **E2E-041**: replace with all-invalid file → expect blocked, original elements remain.
- **E2E-042**: replace with pending outbox → destructive dialog mentions unsynced changes.
- **E2E-043**: after replace → undo shortcut → expect no bulk restore (count stays replaced).
- **E2E-050**: upload shapefile zip → pick layer → merge → full wizard → expect elements created.
- **E2E-051**: upload zip without shp → expect invalid archive error.
- **E2E-052**: upload 51MB file → expect size limit error.
- **E2E-053**: attempt loose .shp upload → expect unsupported format message.
- **E2E-060**: mapping screen shows `nome` pre-mapped to name; change to ignore → imported element has generated name.
- **E2E-061**: map two columns to name → expect Next disabled until conflict resolved.
- **E2E-070**: file with valid+invalid features → summary shows counts → confirm → partial import.
- **E2E-071**: all-invalid file → confirm disabled, `role="alert"` visible.
- **E2E-072**: decline at validation summary → no DB/IDB changes.
- **E2E-073**: successful import → toast shows imported and skipped counts.

### Offline sync (US-011)

- **E2E-080**: offline import → go online → sync → refresh map shows imported elements.

### Access control (US-012)

- **E2E-090**: owner editor shows import/export buttons; public view does not.
- **E2E-091**: session expired at import confirm → re-auth required message.
- **E2E-092**: shared public map link without auth → no GIS buttons.

### Geometry and CRS (US-013, US-014)

- **E2E-100**: import MultiPolygon fixture → expect single polygon element on map.
- **E2E-101**: import SIRGAS2000 shapefile → validation step shows CRS notice and features at correct location in preview.
