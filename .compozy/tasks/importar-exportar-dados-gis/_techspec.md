# Technical Specification: GIS Data Import and Export

## Executive Summary

This feature adds bidirectional GeoJSON and Shapefile interchange for map elements. **GeoJSON export** runs entirely in the browser from paginated element data (online API or offline IndexedDB). **Shapefile export** runs on the PHP server via GDAL `ogr2ogr`, online only. **Import** parses files client-side (`shpjs`, `proj4`, turf), guides the owner through attribute mapping and validation preview, then writes via a new **batch import endpoint** online or a single `map/import` outbox mutation offline.

Key trade-offs: client-side parsing enables offline import but adds bundle weight; server-side Shapefile export requires GDAL on the host but keeps mobile bundles lean; selection-based export uses a modal element picker rather than changing the map editor interaction model.

## System Architecture

### Component Overview

```
MapEditor (header toolbar)
  ├── GisExportDialog          — export wizard (scope, format, picker, confirm)
  └── GisImportDialog          — import wizard (file, layer, strategy, mapping, validation)

src/lib/gis/
  ├── parseGeoJson.js          — GeoJSON / JSON parse + structural normalize
  ├── parseShapefile.js        — zip extract, layer detect, shpjs parse, DBF decode
  ├── crs.js                   — proj4 defs, detect CRS, reproject to EPSG:4326
  ├── normalizeGeometry.js     — Multi* → simple (ADR-014)
  ├── validateFeatures.js      — vertex/text limits, capacity, invalid reasons
  ├── attributeMapping.js      — alias pre-map, conflict detection, apply mapping
  ├── exportGeoJson.js         — elements → FeatureCollection, triggerDownload
  └── constants.js             — limits, aliases, field name maps

src/api/gisClient.js           — fetchAllElements, exportShp, importBatch

php/lib/Gis/
  ├── ShapefileExportService.php  — query elements, ogr2ogr, zip stream
  └── ElementImportService.php    — batch merge/replace transaction

php/public/elements/
  ├── export-shp.php
  └── import.php
```

**Data flow — export (GeoJSON):** `fetchAllMapElements` → filter by scope/selection → `exportGeoJson.buildFeatureCollection` → `triggerDownload`.

**Data flow — export (Shapefile):** dialog confirm → `POST export-shp.php` → server queries PostGIS → temp GeoJSON per type → `ogr2ogr` → zip stream → `triggerDownload`.

**Data flow — import:** file pick → parse → layer pick (shapefile) → strategy → mapping review → validation summary + map preview → confirm → online: `POST import.php` | offline: `offlineBulkImport` → outbox `map/import` → SyncEngine flush.

**External systems:** GDAL `ogr2ogr` on PHP host (Shapefile export only). No third-party GIS APIs.

## Implementation Design

### Core Interfaces

```javascript
// src/lib/gis/constants.js
export const GIS_IMPORT_MAX_BYTES = 50 * 1024 * 1024;
export const EXPORT_COORD_PRECISION = 6;
export const SHAPEFILE_FIELD_MAP = { name: 'name', description: 'descript', category: 'category', /* style keys truncated to 10 chars */ };
```

```javascript
// src/lib/gis/parseShapefile.js
/** @returns {{ layers: ShpLayerMeta[], features: GeoFeature[], crsNotice: CrsNotice }} */
export async function parseShapefileZip(file, { selectedLayer? }) {}
```

```javascript
// src/lib/gis/validateFeatures.js
/** @returns {ValidationResult} */
export function validateImportFeatures(features, { currentCount, strategy, mapping }) {}
// ValidationResult: { total, valid, invalid, validFeatures[], invalidEntries[{index, reason}], capacitySkipped }
```

```javascript
// src/lib/gis/attributeMapping.js
export function buildDefaultMapping(sourceColumns, sampleRow);
export function detectMappingConflicts(mapping); // returns conflict pairs; blocks advance
export function applyMapping(feature, mapping, elementType);
```

```javascript
// src/api/gisClient.js
export async function fetchAllMapElements(mapId);
export async function exportShapefile({ mapId, scope, elementIds });
export async function importElements({ mapId, strategy, elements, clientMutationId });
```

```php
// php/lib/Gis/ElementImportService.php
function elements_import_batch(array $user, array $input): array;
// Returns: ['imported' => int, 'skipped' => int, 'errors' => array]
```

```php
// php/lib/Gis/ShapefileExportService.php
function elements_export_shapefile(array $user, array $input): void;
// Streams application/zip; throws on validation/authorization errors
```

### Data Models

**Export GeoJSON properties** (one Feature per element, WGS84, 6-decimal precision):

| Property | Source | Notes |
|----------|--------|-------|
| `name` | `map_elements.name` | Empty allowed |
| `description` | `map_elements.description` | Truncated to 5000 on import |
| `category` | `map_elements.element_category` | |
| Style keys | `map_elements.style` JSONB flattened | Point: `icon_name`, `icon_color`, `custom_icon_url`; Line: `color`, `opacity`, `weight`, `dash_style`; Polygon: `border_color`, `border_opacity`, `border_weight`, `border_dash`, `fill_color`, `fill_opacity` |

No server-internal fields (`id`, `version`, `author_id`, timestamps) are exported.

**Shapefile DBF fields:** Same logical fields; names truncated to 10 characters per `SHAPEFILE_FIELD_MAP`. Values truncated to 254 characters with truncation notice in export summary.

**Import element payload** (batch item):

```typescript
interface ImportElementPayload {
  element_type: 'point' | 'line' | 'polygon';
  geojson: GeoJSON.Geometry;       // Point | LineString | Polygon only
  name: string;
  description: string;
  element_category: string;
  style: Record<string, unknown>;
}
```

**Attribute mapping target fields:** `name`, `description`, `category`, `ignore`, plus style property keys. Known aliases (case-insensitive):

| Target | Aliases |
|--------|---------|
| name | name, nome, nm, titulo, title |
| description | description, descricao, desc, obs, observacao |
| category | category, categoria, tipo, type, class |
| style keys | exact style property names |

Unmapped name → generated label `Importado {n}` (1-based index). Duplicate target mapping → **blocked** until resolved.

**Offline outbox mutation** (`map/import`):

```json
{
  "resource_type": "map",
  "op": "import",
  "payload": {
    "map_id": "uuid",
    "strategy": "merge|replace",
    "elements": [ "ImportElementPayload..." ],
    "unsynced_warning_ack": true
  }
}
```

### API Endpoints

#### `POST /php/elements/export-shp.php`

- **Auth:** `require_active_user()` + `assert_map_owner`
- **Body:** `{ "map_id": "uuid", "scope": "whole"|"selection", "element_ids": ["uuid"] }` — `element_ids` required when scope is `selection`
- **Success:** `200`, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="{map-slug}-{date}.zip"`
- **Errors:** `400` validation, `401` unauthenticated, `403` not owner, `404` map not found, `422` zero elements, `500` GDAL failure

#### `POST /php/elements/import.php`

- **Auth:** `require_active_user()` + `assert_map_owner`
- **Body:** `{ "map_id", "strategy": "merge"|"replace", "client_mutation_id", "elements": ImportElementPayload[] }`
- **Success:** `200` `{ "imported": N, "skipped": M, "errors": [{ "index", "reason" }] }`
- **Errors:** `400` validation/empty array, `401`, `403`, `404`, `409` idempotent replay, `422` capacity exceeded (zero imported)
- **Replace semantics:** If `elements` is empty or all invalid server-side → **no deletes** (US-007.EC-1). Otherwise: delete all elements (`photos_delete_for_element` per element), then insert valid elements in one transaction.

#### `GET /php/elements/list.php` (existing, modified client usage)

- Client adds `fetchAllMapElements` looping `page_size=100` until all pages consumed (prerequisite fix).

### UI Components

#### `GisExportDialog` (`src/components/map/gis/GisExportDialog.jsx`)

Steps: `scope` → `format` → (`picker` if selection) → `confirm` → `downloading`.

| Step | Behavior |
|------|----------|
| scope | Radio: whole map / selection |
| format | Radio: GeoJSON / Shapefile (disabled + tooltip when offline) |
| picker | Checklist of elements; select-all; blocked if zero checked |
| confirm | Summary: count, format, layer list (shapefile), truncation warnings |
| downloading | Spinner; GeoJSON instant; Shapefile awaits server |

Blocked states: zero elements (whole), zero selection (selection), Shapefile offline, session expired.

#### `GisImportDialog` (`src/components/map/gis/GisImportDialog.jsx`)

Steps: `file` → `layer` (if multi) → `strategy` → (`destructive` if replace) → `mapping` → `validation` → `importing`.

| Step | Behavior |
|------|----------|
| file | `<input accept=".geojson,.json,.zip">`; 50 MB limit; parse progress |
| layer | Radio list of shapefile layers (skip if single) |
| strategy | merge / replace |
| destructive | AlertDialog: irreversible; mentions unsynced changes if outbox pending |
| mapping | Table: source column, sample, target dropdown; conflict blocks Next |
| validation | Counts, expandable invalid list, Leaflet preview of valid features, CRS notice |
| importing | Progress bar (parse already done; shows write % chunks) |

Post-import toast: `"{imported} elementos importados, {skipped} ignorados"`.

#### Toolbar integration (`MapEditor.jsx`)

Add `GisExportDialog` and `GisImportDialog` entry buttons next to `ExportEntry` and `MemorialDialog`. Visible only when `isAuthenticated && !mapAuthError && isMapOwner`. `data-testid`: `gis-export-entry`, `gis-import-entry`.

### Geometry and CRS

Normalization per ADR-014. CRS detection order:

1. Shapefile `.prj` → `proj4` WKT parse
2. GeoJSON legacy `crs` member
3. Missing → assume EPSG:4326 with warning

Reprojection via `proj4` to EPSG:4326. Post-reprojection bounds check: lat ∈ [-90,90], lon ∈ [-180,180].

### Offline Behavior

| Operation | Online | Offline |
|-----------|--------|---------|
| GeoJSON export | API fetch all elements | IndexedDB `elements` store |
| Shapefile export | Server endpoint | Blocked |
| Import write | `POST import.php` | `offlineBulkImport()` → single outbox `map/import` |
| Partial cache warning | N/A | If prepared map incomplete, warn before export |

`offlineBulkImport` in `src/lib/offline/offlineApi.js`:

1. Replace: remove all local elements for map; enqueue deletes are collapsed into import mutation (server handles atomic replace).
2. Merge: append elements to IDB; enqueue `map/import` with merge strategy.
3. Update React Query cache and element count.

SyncEngine adds handler for `map/import` → calls `import.php`.

### Photo Deletion on Replace

Replace import follows existing element deletion semantics: `photos_delete_for_element()` removes files from storage and DB rows (US-007.EC-4). Offline replace removes local element records; orphaned `photo_blobs` cleaned on next `clearAccountData` or explicit cleanup in `offlineBulkImport`.

### Undo

Bulk import does **not** extend the element undo stack. Replace shows reinforced irreversibility warning. Merge shows informational message that imported elements can only be removed individually.

## Integration Points

| System | Integration | Auth | Error handling |
|--------|-------------|------|----------------|
| PostGIS | `ST_GeomFromGeoJSON`, `ST_AsGeoJSON`, `ST_IsValid` | N/A | 422 with reason per element |
| GDAL ogr2ogr | Temp GeoJSON → Shapefile conversion | N/A | 500 with logged stderr; user retry message |
| IndexedDB | Element read (export), write (import) | `assertAccess` | Storage quota → block with message |
| Sync outbox | `map/import` mutation | Session on flush | Per-element sync errors surfaced in conflict UI |

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|---------------------|-----------------|
| `src/api/apiClient.js` | modified | Add `fetchAllMapElements` pagination | Implement loop |
| `src/page/MapEditor.jsx` | modified | GIS toolbar buttons, pass elements/map | Wire dialogs |
| `src/lib/offline/offlineApi.js` | modified | `offlineBulkImport` | New function |
| `src/lib/sync/SyncEngine.js` | modified | Handle `map/import` | New case in `_applyResource` |
| `php/lib/Elements/ElementService.php` | modified | Extract shared validation for batch | Refactor |
| `php/lib/Gis/*` | new | Export/import services | Create |
| `php/public/elements/*.php` | new | Endpoints | Create |
| `package.json` | modified | Add shpjs, jszip, proj4, turf | `npm install` |
| Server deploy | infra | GDAL required | Document in README |

## Testing Approach

- **Unit:** `src/lib/gis/*` pure functions with fixture files in `tests/fixtures/gis/`
- **Integration:** PHP batch import/export against test DB; JS `gisClient` with mocked `fetch`
- **E2E:** Vitest + Testing Library for dialog flows; `data-testid` hooks on wizard steps
- **Fixtures:** Sample GeoJSON, single/multi-layer shapefile zips, SIRGAS2000 `.prj`, invalid geometries
- See `_tests.md` for full case catalog

## Development Sequencing

### Build Order

1. **Prerequisite: element pagination** — `fetchAllMapElements` in `gisClient.js`; no dependencies
2. **`src/lib/gis/` core** — parse, normalize, validate, mapping (pure functions)
3. **Unit tests for gis lib** — validates parsing/normalization before UI
4. **`GisExportDialog` + `exportGeoJson.js`** — GeoJSON export end-to-end
5. **PHP `ShapefileExportService` + endpoint** — depends on pagination + GDAL
6. **`GisImportDialog` wizard** — depends on gis lib
7. **PHP `ElementImportService` + endpoint** — depends on gis lib payload shape
8. **Offline `offlineBulkImport` + SyncEngine** — depends on import endpoint contract
9. **MapEditor toolbar integration** — depends on both dialogs
10. **E2E tests** — depends on full wiring

### Technical Dependencies

- GDAL/`ogr2ogr` installed on PHP deployment host
- npm packages: `shpjs`, `jszip`, `proj4`, `@turf/length`, `@turf/union`
- Element list pagination fix (blocking for whole-map export of maps >100 elements)

## Monitoring and Observability

| Metric | Source | Alert |
|--------|--------|-------|
| `gis.import.batch.duration_ms` | PHP log | >30s |
| `gis.import.batch.count` | PHP log | — |
| `gis.export.shp.duration_ms` | PHP log | >60s |
| `gis.import.client_parse.error` | client console | spike |
| `gis.import.capacity_skipped` | import response | — |

Structured log fields: `map_id`, `user_id`, `strategy`, `imported`, `skipped`, `scope`, `format`, `layer_count`.

## Technical Considerations

### Key Decisions

| Decision | Rationale | Trade-off | Rejected |
|----------|-----------|-----------|----------|
| Batch import endpoint (ADR-008) | Atomic replace, single round-trip | Large payloads | Sequential CRUD |
| Server Shapefile export (ADR-009) | Lean client, PostGIS source of truth | Requires GDAL | Client shp-write |
| Modal element picker (ADR-010) | No editor refactor | Less visual | Canvas multi-select |
| Client parsing libs (ADR-011) | Offline import | Bundle size | Server parse upload |
| Separate shp per type (ADR-012) | GIS tool compatibility | Multiple files | Block mixed |
| One shapefile layer (ADR-013) | Clean mapping | Repeat imports | Import all layers |
| Longest line + polygon union (ADR-014) | Preserves primary geometry | Union may merge islands | First-part-only |
| 50 MB upload limit | Mobile memory safety | Large files blocked | 100 MB |
| UTF-8 → Latin-1 DBF decode | Modern + legacy BR shapefiles | Ambiguous bytes | User picks encoding |
| Block mapping conflicts | Prevents silent wrong data | Extra user step | Last wins |
| No internal IDs in export | Clean GIS interchange | No native round-trip | Export UUIDs |
| Progress bar import only | Focus UX effort | Export has spinner only | Progress everywhere |

### Known Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| GDAL missing on server | Medium | Startup check; clear error in export dialog |
| Client/server validation drift | Medium | Shared constants; server re-validates all |
| 5,000-element import timeout | Low | Transaction batch insert; PHP `max_execution_time` bump for endpoint |
| MultiPolygon union failure | Medium | Mark invalid; show reason in summary |
| Offline replace loses unsynced edits | Medium | Destructive warning when outbox pending |
| Virtualized picker performance | Low | Windowed list for 5,000 items |

## Architecture Decision Records

- [ADR-001: Import/Export Scope — Map or Selection per Operation](adrs/adr-001.md) — User chooses whole map or selection; empty selection blocks export.
- [ADR-002: Import Strategy — User-Chosen Merge or Replace](adrs/adr-002.md) — Merge or replace per import; replace requires confirmation.
- [ADR-003: Attribute Mapping — Automatic Pre-Mapping with User Review](adrs/adr-003.md) — Alias pre-map with editable review screen.
- [ADR-004: Geometry Normalization and CRS Reprojection](adrs/adr-004.md) — Multi* collapsed; auto-reproject to WGS84.
- [ADR-005: Import Validation — Partial Import with User Confirmation](adrs/adr-005.md) — Validation summary before write; partial import on confirm.
- [ADR-006: Export Content, Formats, and Offline Availability](adrs/adr-006.md) — Attributes + styles; GeoJSON offline; Shapefile online; owner-only.
- [ADR-007: UI Placement — Map Editor Toolbar Actions](adrs/adr-007.md) — Toolbar modal dialogs in map editor.
- [ADR-008: Batch Import API Endpoint](adrs/adr-008.md) — `POST import.php` with transactional replace/merge.
- [ADR-009: Server-Side Shapefile Export Generation](adrs/adr-009.md) — GDAL ogr2ogr on PHP host.
- [ADR-010: Export Selection via Modal Element Picker](adrs/adr-010.md) — Checklist inside export dialog.
- [ADR-011: Client-Side GIS File Parsing Libraries](adrs/adr-011.md) — shpjs, jszip, proj4, turf.
- [ADR-012: Mixed-Geometry Shapefile Export — Separate Files per Type](adrs/adr-012.md) — One shp set per geometry type in zip.
- [ADR-013: Multi-Layer Shapefile Import — User Picks One Layer](adrs/adr-013.md) — Layer selection step before mapping.
- [ADR-014: Multi-Geometry Normalization Algorithms](adrs/adr-014.md) — Longest line part; polygon union.
