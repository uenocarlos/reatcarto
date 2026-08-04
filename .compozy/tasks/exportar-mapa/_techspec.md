# TechSpec: Export Map

## Executive Summary

This design adds a full cartographic export composition experience to the authenticated **map editor only**, with functional parity to legacy `.idea/printJs.php`. Export runs entirely in the browser: the owner opens an owner-scoped shell that mounts **dedicated Leaflet map instances** (main map + optional location insets), configures layout and quality, reviews a debounced WYSIWYG preview, and downloads **PNG or PDF** via **`html-to-image` + `jspdf`** without a print server or server-side layout store.

Primary trade-offs: higher client memory (especially A3 @ 600 DPI and multi-map tile loads) versus zero backend print infrastructure; static Brazilian admin GeoJSON under `public/geo/` versus dynamic IBGE fetch; temporary npm capture library shift from unused `html2canvas` to `html-to-image`. Access reuses existing owner gates (`ProtectedRoute` + `maps_get`/`elements_list` ownership); public and gallery surfaces receive no export control or private composition path.

## System Architecture

### Component Overview

```text
MapEditor (owner, /editor/:mapId)
  ├─ Export entry control (header)
  ├─ LeafletMap (editor) — snapshot source: viewport, hiddenIds, basemap
  └─ ExportMapShell (Dialog / full-surface, ephemeral session)
        ├─ ExportSessionState (in-memory React state)
        ├─ ExportControlsPanel (texts, format, paper, DPI, legend, layers, basemap, location, colors)
        ├─ ExportPreviewComposition (DOM capture root)
        │     ├─ Title / credit regions
        │     ├─ ExportMainMap (dedicated react-leaflet MapContainer + chrome)
        │     ├─ ExportLegend (inside | right | bottom; drag + numeric size)
        │     ├─ ExportLocationInsets (0–2 Leaflet maps)
        │     └─ ExportInstitutionalFooter (fixed REAT/FURG + logo)
        ├─ GeoBoundaryLoader (fetch /geo/*.geojson, session cache)
        └─ generateExport (html-to-image → PNG | jspdf PDF → <a download>)
```

| Component | Purpose | Boundary |
|-----------|---------|----------|
| `ExportEntry` | Render Export control only in `MapEditor` when map data is owned by the session user | UI only; no public/dashboard paths |
| `ExportMapShell` | Own open/close lifecycle; build defaults + editor snapshot; host controls + preview | Session-scoped state lives here only |
| `exportSession` state module | Reduce/normalize session options (paper, DPI clamp, legend metrics, layer toggles) | Pure TS/JS; no I/O |
| `ExportMainMap` | Dedicated Leaflet map for export; layers from editor elements; basemap URL map; map chrome overlays | Unmounted with shell |
| `ExportLegend` | Build symbol rows from visible export layers + optional location entries | DOM for capture |
| `ExportLocationInsets` | 0–2 inset Leaflet maps + UF/municipality selection UI | Depends on `GeoBoundaryLoader` |
| `GeoBoundaryLoader` | Load/cache static admin boundaries from `public/geo/` | Network I/O boundary |
| `MapChrome` (scale, north, graticule) | Leaflet/DOM overlays on export main map | Export map only |
| `DecorativeFrame` | CSS frame around composition main map region | Composition CSS |
| `generateExport` | Settle tiles → capture composition → download | Browser APIs only |
| Branding assets | Logo/north binary under `public/export/`; fixed footer strings in `branding.js` | Static product identity |

**Data flow**

1. Owner opens Export → `MapEditor` builds `EditorExportSnapshot` from map name, `mapInstance` center/zoom, `hiddenIds`, controlled basemap, and current `elements`.
2. Shell initializes session defaults + snapshot (ADR-006).
3. Option changes update session state; preview sync debounces layout (ADR-010); maps invalidate/redraw as needed.
4. Export action validates title (ADR-011), single-flight locks UI (ADR-008), captures composition, triggers download.
5. Close/cancel unmounts shell and discards session; editor state is not rewritten by export-only toggles.

**External systems**

- Basemap tile providers already used by `LeafletMap` (Carto light, OSM, Esri imagery).
- Static files from the Vite/public host (`/geo/*`, `/export/*`).
- No new PHP export APIs.

## Implementation Design

### Core Interfaces

Language: JavaScript (project primary; JSDoc-typed as needed to match existing frontend style).

```javascript
/** Snapshot taken once when export shell opens */
export function createEditorExportSnapshot(input) {
  // input: { mapName, center, zoom, hiddenIds: Set|string[], basemap, elements }
  // returns: EditorExportSnapshot
}

/** Defaults per PRD + ADR-011 title prefilled from mapName */
export function createDefaultExportSession(snapshot) { /* ExportSessionState */ }

export function clampDpi(value) {
  // non-numeric → { ok:false, previous }; numeric → clamp 72..600
}

export function assertExportTitle(title) {
  // throws / returns { ok:false, code:'empty_title' } if trim empty
}

export function mapEditorBasemapToExport(basemap) {
  // 'branco'|'osm'|'satelite' → export basemap key
}

export async function loadGeoBoundaries({ signal } = {}) {
  // fetch /geo/states.geojson + municipalities.geojson once; cache in module
}

export async function generateExport(options) {
  /*
    options: {
      compositionEl: HTMLElement,
      mapFreezeEls: HTMLElement[],
      format: 'png'|'pdf',
      dpi: number,
      paper: 'a4'|'a3'|'letter',
      orientation: 'landscape'|'portrait',
      fileTitle: string,
      signal?: AbortSignal,
    }
    returns: { fileName, mimeType }
    throws: ExportGenerationError { code: 'aborted'|'capture'|'memory'|'tiles'|'validation' }
  */
}
```

Error convention: generation errors carry stable `code` strings for UI copy mapping; title validation remains a local `empty_title` failure before capture.

### Data Models

**No new server/schema tables.** Session-only client models:

```javascript
// ExportSessionState (ephemeral)
{
  title: string,                // default map.name; required non-empty for download
  authorship: string,           // default ''
  technicalResponsible: string, // default ''
  format: 'png' | 'pdf',        // default 'png'
  paper: 'a4' | 'a3' | 'letter',// default 'a4'
  orientation: 'landscape' | 'portrait', // default 'landscape'
  dpi: number,                  // default 300; clamped 72–600
  legendPosition: 'inside' | 'right' | 'bottom',
  legendColumns: 1..6,
  legendFontPx: 8..18,          // default 12
  legendSpacing: 'very_compact'|'compact'|'normal'|'loose'|'very_loose',
  legendInside: { xPct, yPct, wPct, hPct }, // for drag/resize
  legendRightWidthPct: number,
  hiddenIds: Set<string>,       // export layer visibility (starts from editor)
  showLabels: boolean,          // default false unless product inherits later
  basemap: 'branco' | 'osm' | 'satelite',
  locationCount: 0 | 1 | 2,
  locations: [                  // length === locationCount intent
    { uf: string|null, municipioCode: string|null }
  ],
  showMunicipalMesh: boolean,
  stateOnLegend: boolean,
  stateColor: string,           // default printJs-equivalent #D9E6A4
  municipioColor: string,       // default #E6A4A4
  center: { lat, lng },
  zoom: number,
  isGenerating: boolean,
  generationError: string|null,
  geoLoadError: string|null,
}
```

**Legend item** derived client-side:

```javascript
{ id, label, symbolKind: 'point'|'line'|'polygon'|'region', style, source: 'element'|'location' }
```

**Static geo feature properties** (normalize at load):

```javascript
// states: { uf: string, name: string }
// municipalities: { code: string, name: string, uf: string }
```

**Basemap mapping** (editor key === export key; same tile URLs as `LeafletMap` `BASEMAP_URLS`):

| Editor / export key | Tiles | Export radio label (PT) |
|---------------------|-------|-------------------------|
| `branco` | Carto light | Carto / fundo claro |
| `osm` | OpenStreetMap | OpenStreetMap |
| `satelite` | Esri World Imagery | Satélite |

### API Endpoints

No new authenticated export endpoints. Existing owner data paths remain the only map sources:

| Method | Path | Role |
|--------|------|------|
| GET | `/php/maps/get.php?id=` | Already used by editor; owner-only |
| GET | `/php/elements/list.php?map_id=` | Already used by editor; owner-only |

Static assets (public GET, no map secrets):

| Path | Description |
|------|-------------|
| `/geo/states.geojson` | UF boundaries EPSG:4326 |
| `/geo/municipalities.geojson` | Municipality boundaries |
| `/export/logoreat.png` | Institutional REAT logo |
| `/export/north.png` | North arrow graphic (or SVG equivalent) |

Non-owner clients already cannot load private map or element payloads; UI never mounts export outside owner editor (ADR-002).

## Integration Points

### Tile basemap providers

- Same URLs as `src/components/map/LeafletMap.jsx`.
- Capture uses CORS-capable options in `html-to-image` (equivalent to `useCORS` / avoid taint).
- Failure: generation surfaces actionable error (network / incomplete basemap).

### Static hosting of geo and brand assets

- Deploy includes `public/geo` and `public/export`.
- Export shell handles missing geo with `geoLoadError`; owner can still export with `locationCount = 0`.

### Browser download surface

- Web and Capacitor WebView: temporary object URL + `<a download>` (ADR-008). No Share API in v1.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|----------------------|-----------------|
| `MapEditor.jsx` | modified | Export button; open shell; basemap lift for snapshot; cancel isolation | Add header control + shell mount |
| `LeafletMap.jsx` | modified | Controlled basemap prop from editor for inheritance snapshot | Lift `basemap`/`onBasemapChange` like `hiddenIds` |
| `PublicMapView.jsx` / `Gallery.jsx` / Dashboard cards | none (guard) | Must remain free of export entry | Manual + e2e checks |
| `package.json` | modified | Add `html-to-image`; optional remove unused `html2canvas` | Dependency update |
| `public/geo/*` | new | Admin boundaries assets | Source simplify + commit or generate step |
| `public/export/*` | new | Logo + north asset | Migrate from printJs `img/logoreat.png` etc. |
| `src/components/map/export/*` | new | Shell, controls, preview, legend, insets, chrome | Implement package |
| `src/lib/export/*` | new | session defaults, clamp, generate, geo loader, branding constants | Implement package |
| PHP Map/Element services | none | No export endpoint | — |
| Vitest suite | new | Unit/integration cases under `tests/js/` | Create harness files |

## Testing Approach

- **Frameworks**: Vitest for unit and component/integration tests (`npm test` / `vitest run`) per `package.json`; e2e via browser product tooling if/as the repo adds it later — for this contract, e2e cases document owner journeys as Vitest + Testing Library full-shell tests where map instances are faked at Leaflet I/O, unless a Playwright suite is introduced later.
- **Unit**: pure functions (`clampDpi`, `assertExportTitle`, session defaults, basemap map, legend build, filename sanitize) with no Leaflet.
- **Integration**: Export shell mounts with mocked snapshot and stubbed `html-to-image`/`jspdf`; assert single-flight, validation, cancel discard.
- **E2E / journey**: MapEditor owner path with mocked map API responses; public surfaces assert absence of export control.
- Fakes only at network, tile, and capture I/O boundaries — not inside pure session reducers.
- Full concrete IDs live in `_tests.md`.

## Development Sequencing

### Build Order

1. **Static assets & branding** — `public/export/`, `src/lib/export/branding.js`, paper size constants.
2. **Pure session module** — defaults, clamp, title assert, basemap map, legend item builder (enables early unit tests).
3. **`html-to-image` dependency + `generateExport`** — capture/download pure module with injectable toPng/jsPDF fakes.
4. **Lift basemap in `LeafletMap`/`MapEditor`** — enable reliable snapshot.
5. **`ExportMainMap` + map chrome + decorative frame** — dedicated map without full form.
6. **`ExportLegend` + layout CSS modes** (inside/right/bottom) with drag + numeric controls.
7. **`GeoBoundaryLoader` + insets UI/maps**.
8. **`ExportMapShell` + controls panel + debounced preview sync + progress/errors**.
9. **Wire entry in `MapEditor`**; verify public routes stay clean.
10. **Dense-legend PNG preference copy** + mobile responsive layout pass.
11. **Test suite** as per `_tests.md`.

### Technical Dependencies

- Product tile providers reachable from the client during export.
- Municipal/state GeoJSON available before location inset stories mark complete (ADR-009).
- Institutional logo asset path resolved before branding acceptance (ADR-004).
- `html-to-image` and existing `jspdf` installed.

## Monitoring and Observability

Client-only feature; no server metrics required for generation success.

Recommended lightweight client signals (console structured or future analytics hook — optional, non-blocking):

| Signal | Fields |
|--------|--------|
| `export.open` | mapId |
| `export.generate.start` | format, paper, orientation, dpi, locationCount |
| `export.generate.success` | durationMs, format |
| `export.generate.fail` | code, durationMs |
| `export.geo.fail` | reason |

No pager alerts in v1. Log generation failures without map geometry payload.

## Technical Considerations

### Key Decisions

| Decision | Rationale | Trade-offs | Alternatives rejected |
|----------|-----------|------------|------------------------|
| Dedicated export Leaflet maps | Cancel isolation; chrome freedom | Dual tile loads | Shared editor map; static-only screenshot |
| `html-to-image` + jsPDF | Browser compose/download; user capture choice | Memory risk at high DPI | Server print; html2canvas-only; leaflet-image layout |
| Static `public/geo/` | No PHP geo API; product-owned | Repo weight | CDN IBGE; auth PHP endpoint |
| Debounced live preview + explicit refresh | US-003 without thrash | Slight lag | Fully live; button-only |
| Non-empty title on download | Intentional institutional file names | Extra step when map.name blank | Allow empty; silent fallback |
| DPI clamp 72–600 with feedback | Safe generation bounds | User may not notice silent clamp without toast | Reject-only; validate only on export |
| Drag + numeric legend controls | Mobile + desktop parity | More UI surface | Drag-only; inputs-only on mobile |
| Mixed chrome (Leaflet overlays + CSS frame) | Scale tracks zoom; frame stays layout-simple | Two subsystems | All-plugin or all-HTML |
| Single-flight generation | Avoid concurrent capture races | Second click no-ops | Queue; cancel-and-restart |
| Browser download anchor | printJs class; minimal Capacitor work | WebView download quirks possible later | Filesystem + Share now |
| Brand under `public/export/` + `branding.js` | Stable static URLs and non-editable institutional copy | White-label later needs ADR | Bundle-only imports; editable footer |

### Known Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| OOM / canvas fail at high DPI on phones | Medium | Progress UI; error copy to lower DPI; single-flight |
| Incomplete basemap tiles at capture | Medium | Wait-for-tiles; optional map freeze step; fail visibly |
| Large municipalities.geojson payload | Medium | Simplify polygons offline; load only when insets enabled; optional later split per UF under same root |
| Leaflet + html-to-image pan/shadow artifacts | Medium | Freeze map to static image before composition capture (printJs technique) |
| Basemap attribution line fixed vs active basemap | Low | Keep printJs multi-source credit line in branding (ADR-004 fixed text) |
| Double-open export shell | Low | Single shell `open` boolean; ignore second entry while open |

## Architecture Decision Records

- [ADR-001: Full feature parity with legacy printJs export window](adrs/adr-001.md) — Capability baseline for composition and download.
- [ADR-002: Owner-only export from the map editor](adrs/adr-002.md) — Single owner-editor entry; no public export.
- [ADR-003: Ephemeral export session configuration](adrs/adr-003.md) — No persisted print templates.
- [ADR-004: Fixed REAT/FURG institutional branding on exports](adrs/adr-004.md) — Mandatory footer and logo.
- [ADR-005: Full mobile parity for export composition UX](adrs/adr-005.md) — Complete phone control reachability.
- [ADR-006: Inherit editor map state into export session](adrs/adr-006.md) — Viewport, layers, basemap at open.
- [ADR-007: Dedicated Leaflet instances for export composition](adrs/adr-007.md) — Separate maps; editor isolation.
- [ADR-008: Client-side capture with html-to-image and jsPDF](adrs/adr-008.md) — Browser generate pipeline and single-flight.
- [ADR-009: Static Brazilian admin boundaries under public/geo](adrs/adr-009.md) — Location inset data hosting.
- [ADR-010: Debounced live preview with optional explicit refresh](adrs/adr-010.md) — Preview update policy.
- [ADR-011: Non-empty title required for download](adrs/adr-011.md) — Title validation before generate.
