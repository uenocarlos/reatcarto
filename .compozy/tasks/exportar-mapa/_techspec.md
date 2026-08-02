# Technical Specification: Map Export Composition (Exportar Mapa)

## Executive Summary

This design completes the existing owner-only export composition screen by wiring a discoverable Export action in `MapEditor`, finishing live preview controls (legend layout, layer/tag visibility, Brazil locators, paper frame), and delivering PNG-only output via the current `html2canvas` + Capacitor Share/Filesystem path. Export settings persist as `maps.export_settings` JSONB with an IndexedDB mirror, last-write-wins, and no geometry conflict UI. Brazil boundaries load from the latest IBGE Malhas/Localidades APIs when online and from `public/geo/` when offline or the API fails. Offline basemap uses Capacitor `offline_tiles` through `tileManager` and is disabled on web.

Primary trade-offs: online/offline boundary geometry may differ slightly; web cannot select Offline tiles; multi-device export-option edits overwrite silently; html2canvas remains CORS-sensitive, mitigated by aligning satellite to ArcGIS like the editor.

## System Architecture

### Component Overview

```
MapEditor (owner route)
  └─ Export entry → ExportMapModal
        ├─ ExportSettingsStore (normalize / debounce persist)
        ├─ ExportGates (validation)
        ├─ CompositionPreview (paper frame + chrome)
        │     ├─ PreviewMap (Leaflet + basemap + elements + tags + location overlays)
        │     ├─ LegendFrame (inside drag/resize | beside | below)
        │     ├─ LocationInsets (0/1/2)
        │     └─ InstitutionalFooter (+ optional IBGE line)
        ├─ BrazilBoundaryService (IBGE → fallback public/geo)
        └─ PngExporter (html2canvas → download | Share)
php MapService ←── maps.export_settings JSONB (LWW, no version bump when settings-only)
IndexedDB map cache mirrors export_settings for offline reopen
```

| Component | Responsibility |
| --- | --- |
| **MapEditor export entry** | Show Export only for authenticated owner editing `/editor/:mapId`; open single modal instance; pass map id, elements, current `export_settings`. |
| **ExportMapModal** | Options UI + live preview; remove PDF choice and mandatory refresh; cancel without file. |
| **ExportSettingsStore** | Defaults, clamp/normalize, prune stale ids, debounce save + flush on close/export. |
| **ExportGates** | Block export when title/author blank, locator incomplete, or no visible content/legend item. |
| **CompositionPreview** | Paper aspect frame; title header; map+legend layout growth; always-on graticule/scale/north; footer/logo. |
| **PreviewMap** | Leaflet preview; basemaps; filtered elements; tags; municipality outline/mesh; dynamic scale. |
| **LegendFrame** | Columns/font/spacing; inside clamp drag/resize; beside/below external layout. |
| **LocationInsets** | None / 1 (state+muni) / 2 (SA context + state+muni). |
| **BrazilBoundaryService** | IBGE online; `public/geo/` fallback; searchable UF/municipality lists. |
| **PngExporter** | Wait for tiles/boundaries; html2canvas; web download / native share; progress toasts. |
| **MapService (PHP)** | Persist/read `export_settings`; ownership checks; settings-only update without `version` bump. |

Data flow: load map → hydrate settings → user edits update React state + live preview → debounced PATCH settings → Export runs gates → capture preview DOM → deliver PNG. Public gallery routes never mount this modal.

## Implementation Design

### Core Interfaces

Primary settings type (JavaScript; project language):

```js
/** @typedef {'inside'|'beside'|'below'} LegendPosition */
/** @typedef {'compact'|'normal'|'wide'} LegendSpacing */
/** @typedef {'carto'|'osm'|'satellite'|'offline'} ExportBasemap */
/** @typedef {0|1|2} LocatorCount */

/**
 * @typedef {Object} ExportSettings
 * @property {string} title
 * @property {string} author
 * @property {string} technicalResponsible
 * @property {LegendPosition} legendPosition
 * @property {{x:number,y:number,w:number,h:number}|null} legendRect  // inside only; normalized 0–1 of map frame
 * @property {number} legendColumns          // 1–6
 * @property {number} legendFontSizePx       // 8–18
 * @property {LegendSpacing} legendSpacing
 * @property {string[]} hiddenCategoryIds
 * @property {string[]} hiddenElementIds
 * @property {boolean} showTags
 * @property {ExportBasemap} basemap
 * @property {LocatorCount} locatorCount
 * @property {string|null} stateCode         // IBGE UF code
 * @property {string|null} municipalityCode  // IBGE municipality code
 * @property {string} stateColor
 * @property {string} municipalityColor
 * @property {boolean} showStateInLegend
 * @property {boolean} showMunicipalityInLegend
 * @property {boolean} showMunicipalMesh
 * @property {'A4'|'A3'|'Letter'} paperSize
 * @property {'landscape'|'portrait'} orientation
 * @property {number} dpi                    // default 300; clamp 72–600
 */
```

```js
// src/lib/export/exportSettings.js
export function defaultExportSettings() { /* ... */ }
export function normalizeExportSettings(raw) { /* clamp, migrate legacy right→beside */ }
export function pruneExportSettings(settings, elements) { /* drop stale ids */ }
export function validateExportGates(settings, visibleElements, legendItems) {
  // returns { ok: boolean, errors: { field: string }[] }
}
export function effectiveVisibleElements(elements, settings) { /* category ∩ element */ }
```

```js
// src/lib/export/brazilBoundaries.js
export async function listStates() { /* ibge | fallback */ }
export async function listMunicipalities(stateCode) { /* ... */ }
export async function getLocatorGeometries({ stateCode, municipalityCode, locatorCount }) {
  // throws BoundaryUnavailableError when neither source works
}
```

```js
// src/lib/export/pngExporter.js
export async function exportCompositionPng({ previewEl, settings, fileBaseName }) {
  // waits for readiness; html2canvas; download or Share; throws ExportCaptureError
}
```

```php
// php/lib/Maps/MapService.php (additions)
function maps_update_export_settings(array $user, string $mapId, $settings): array;
// ownership required; JSON validate; UPDATE export_settings only; no version bump
```

Error conventions: client toasts use Portuguese product copy; API validation failures return existing `validation_error` / `forbidden` / `not_found` shapes; boundary/tile failures stay client-side with explicit messages (no false success).

### Data Models

**Postgres migration** (new file under `php/migrations/`):

```sql
ALTER TABLE maps
  ADD COLUMN IF NOT EXISTS export_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
```

**Defaults (first open / empty `{}`)** after `normalizeExportSettings`:

| Field | Default |
| --- | --- |
| title, author, technicalResponsible | `''` |
| legendPosition | `inside` |
| legendRect | null → centered default frame inside map |
| legendColumns | `2` |
| legendFontSizePx | `12` |
| legendSpacing | `normal` |
| hidden* | `[]` |
| showTags | `false` |
| basemap | `carto` |
| locatorCount | `0` |
| state/municipality codes | `null` |
| stateColor / municipalityColor | documented hex defaults (e.g. `#1D4ED8` / `#DC2626`) |
| showStateInLegend / showMunicipalityInLegend / showMunicipalMesh | `false` |
| paperSize | `A4` |
| orientation | `landscape` |
| dpi | `300` |

**Legend items for gates**: visible drawn elements that contribute a legend row, plus enabled location legend entries (state/municipality/mesh as configured).

**Static fallback assets**: `public/geo/` — e.g. `ufs.geojson`, `municipios/{UF}.geojson` (simplified), `sa-brazil-context.geojson`, plus a small `meta.json` with reference malha label.

### API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/php/maps/get.php` (existing) | Response `map` includes `export_settings` object. |
| GET | `/php/maps/list.php` (existing) | Each map includes `export_settings` (may be `{}`). |
| POST | `/php/maps/update.php` (existing) | If body contains only `id` + `export_settings` (optional `client_mutation_id`): owner-only LWW write, **no** `base_version` required, **no** `version` increment. If mixed with name/center/zoom/description: existing version rules apply to those fields; `export_settings` still applied LWW in the same request when present. |
| Public map routes | unchanged | Must **not** expose private editor export UI; `export_settings` may be omitted from public payloads to avoid leaking unused private composition prefs (preferred: strip in `PublicService`). |

Request (`settings-only` update):

```json
{ "id": "<map-uuid>", "export_settings": { "...": "..." } }
```

Response: `{ "success": true, "map": { ..., "export_settings": { ... }, "version": <unchanged> } }`

Failure: 401/403/404 per existing auth; 400 if `export_settings` is not an object.

IBGE HTTP APIs are called **from the browser** (no PHP proxy required in this design). If CORS blocks production, add a thin authenticated PHP proxy in a follow-up task without changing the service interface.

## Integration Points

| System | Purpose | Auth | Errors / retry |
| --- | --- | --- | --- |
| **IBGE Localidades** | UF and municipality names/codes | None (public) | Timeout → fallback catalog; surface warning if using fallback while online. |
| **IBGE Malhas Digitais** | Latest state/municipality polygons | None (public) | Timeout/4xx/5xx → `public/geo/`; if both fail and insets > 0 → block export. |
| **Carto / OSM / ArcGIS tiles** | Online basemaps | None | Tile error → visible incomplete preview; export waits then fails if unusable. |
| **Capacitor Filesystem `offline_tiles`** | Offline basemap | Device | Missing tile → Offline unusable message; no success toast. |
| **Capacitor Share** | Native PNG delivery | Device | Share cancel ≠ success claim; generation failure toasts error. |

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
| --- | --- | --- | --- |
| `src/page/MapEditor.jsx` | modified | Add Export button; pass settings; PNG-only handler | Wire `setShowExport(true)`; trim PDF branch |
| `src/components/map/ExportMapModal.jsx` | modified | Complete controls + live layout | Major UI/logic completion |
| `src/components/map/export/*` | new | Preview pieces, legend, insets, footer | Extract for testability |
| `src/lib/export/*` | new | Settings, gates, boundaries, pngExporter | Unit-test core |
| `src/lib/tileManager.js` | modified | Expose tile URLs for Leaflet offline layer | Low risk |
| `src/lib/offline/OfflineStore` / map cache | modified | Persist `export_settings` on cached maps | Align normalizeMap |
| `php/migrations/*` | new | `export_settings` column | Migrate |
| `php/lib/Maps/MapService.php` | modified | format + LWW settings update | Medium |
| `php/lib/Public/PublicService.php` | modified | Strip `export_settings` from public DTOs | Low |
| `public/geo/*` | new | Fallback boundary bundle | Asset pipeline |
| `src/page/PublicMapView.jsx` / Gallery | unchanged (verify) | No export control | Regression check |
| `jspdf` usage in composition path | deprecated for this feature | PDF Non-Goal | Remove from modal UI |

## Testing Approach

- **Frameworks**: Vitest for client units/integrations (`tests/js/`); PHPUnit for MapService settings persistence (`tests/php/`). Fake `fetch` for IBGE; fixture GeoJSON under test fixtures; mock Capacitor Filesystem/Share; stub `html2canvas`.
- **Unit**: normalize/gates/visibility/legend clamp/boundary source selection/paper pixel math.
- **Integration**: maps update LWW path; IndexedDB mirror; modal open with restored settings; public payload stripping.
- **E2E / journey**: owner opens export → configures → PNG path; anonymous cannot export; gate blocking. Prefer Vitest + jsdom/component tests where full Playwright is not yet standard in-repo; mark true browser E2E IDs for later harness if needed.
- Concrete cases: `_tests.md`.

## Development Sequencing

### Build Order

1. Migration + `format_map_record` / settings-only update + public strip — enables persistence.
2. `exportSettings` normalize/defaults/gates/prune + IndexedDB mirror fields.
3. MapEditor Export entry + modal open/close; remove PDF from composition UI.
4. Live preview: paper frame, legend positions (inside drag/resize, beside/below growth), appearance controls.
5. Export visibility overlay + tags (independent of editor).
6. Basemaps: ArcGIS satellite; offline Leaflet layer via `tileManager`; disable Offline on web.
7. Dynamic scale; ensure graticule/north always on; footer + `logo.png` + conditional IBGE line.
8. `BrazilBoundaryService` + `public/geo/` fallback + inset UI (0/1/2) + main-map outline/mesh/legend.
9. `PngExporter` readiness gates + html2canvas delivery; wire toasts.
10. Debounced persistence + flush; polish mobile scroll layout.

### Technical Dependencies

- Capacitor app build to verify Offline tiles and Share.
- Ship initial `public/geo/` fallback covering all UFs before marking locator stories done.
- Confirm IBGE endpoints reachable from the deployed web origin (or schedule proxy).

## Monitoring and Observability

- Client: toast + `console.error` on capture/boundary/tile failures (no PII); optional count of fallback-vs-IBGE source in debug builds.
- Server: existing auth failure logging on map update; no new PII in `export_settings` beyond user-entered title/author/responsible.
- Alerting: not required beyond existing API error rates; watch for oversized `export_settings` payloads if visibility arrays grow unbounded.

## Technical Considerations

### Key Decisions

| Decision | Rationale | Trade-off | Rejected |
| --- | --- | --- | --- |
| `export_settings` JSONB + IndexedDB | Cross-device + offline reopen | Silent LWW | Device-only / localStorage |
| Independent export visibility | No editor side effects | Duplicate filter path | Mirror while modal open |
| IBGE online, `public/geo/` offline | Fresh + field-capable | Geometry drift | Bundle-only / PostGIS |
| Native-only Offline basemap | Matches `tileManager` | No web Offline | `/tiles` static |
| ArcGIS satellite | Free, editor-aligned, capture-friendly | Imagery differs from old Google URL | Google tiles |
| html2canvas DOM capture | Preview ≡ PNG | CORS/memory limits | leaflet-image split |
| Default legend `inside` | User choice | May cover features until moved | below / beside |
| Dynamic scale | Cartographic honesty | Slightly more preview work | Fixed 0–3km |
| Paper aspect preview × DPI | Matches US-012 | Variable PNG dimensions with legend growth | DPI-only scale |
| Debounce + flush persist | US-016 without Save button | Extra writes | Save-only / close-only |
| IBGE footer when location used | Attribution | Extra footer line | Always / never |

### Known Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| html2canvas tainted canvas | Medium | useCORS; ArcGIS/Carto/OSM; fail loudly |
| IBGE CORS or downtime | Medium | Timeout + `public/geo/` fallback |
| High DPI OOM on phones | Medium | Cap DPI UX; catch and toast |
| Fallback bundle size | Medium | Simplify + UF-chunked municipios |
| Settings-only update abused without auth | Low | Reuse `assert_map_owner` |
| Offline tiles incomplete for view | High in field | Explicit unusable Offline messaging |

## Architecture Decision Records

- [ADR-001: Single Composition Flow for Field and Report Use](adrs/adr-001.md) — One export flow for field and report.
- [ADR-002: Brazil-First Location Maps with Official Administrative Boundaries](adrs/adr-002.md) — None/1/2 Brazil insets.
- [ADR-003: Owner-Only PNG Export from the Map Editor](adrs/adr-003.md) — Owner-only PNG; no public export.
- [ADR-004: Live Preview and Per-Map Persistence of Export Settings](adrs/adr-004.md) — Live preview; per-map persistence.
- [ADR-005: Legend Placement and Growing Composition Canvas](adrs/adr-005.md) — Inside / beside / below growth.
- [ADR-006: Layer Visibility, Tags, and Export Gates](adrs/adr-006.md) — Visibility, tags, gates, chrome, basemaps, footer.
- [ADR-007: Server-Backed export_settings with IndexedDB Mirror](adrs/adr-007.md) — JSONB + LWW + debounce persist.
- [ADR-008: Independent Export Visibility Overlay](adrs/adr-008.md) — Export visibility ≠ editor visibility.
- [ADR-009: IBGE Online Boundaries with Static Fallback](adrs/adr-009.md) — IBGE + `public/geo/` + conditional credit.
- [ADR-010: Composition Capture Stack and Cartographic Defaults](adrs/adr-010.md) — html2canvas, ArcGIS, native offline tiles, paper frame, dynamic scale, default inside legend.
