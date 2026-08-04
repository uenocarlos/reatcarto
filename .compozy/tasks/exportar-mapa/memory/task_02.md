# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Delivered export composition surface under `src/components/map/export/*` with dedicated Leaflet main map, chrome, legend modes, 0–2 location insets, institutional footer, and capture-ready `CompositionPreview` root.

## Important Decisions

- Map chrome (scale/north/graticule/frame) lives in DOM overlays on `ExportMainMap`; labels toggle only affects element label markers.
- `ExportLocationInsets` loads metadata via `loadGeoBoundaries` and fetches raw GeoJSON for rendering; test-only `geoFeaturesOverride` bypasses network.
- Vitest aliases `leaflet`/`react-leaflet` to lightweight stubs; stable `useMap` singleton prevents render loops in jsdom.

## Learnings

- jsdom returns zero-sized bounding rects — legend drag/resize uses fallback host dimensions (1000×800) for metric math in tests and headless environments.
- RTL `cleanup()` in setup is required when tests mount multiple compositions sequentially.

## Files / Surfaces

- `src/components/map/export/CompositionPreview.jsx` — capture root + export readiness helpers
- `src/components/map/export/ExportMainMap.jsx`, `MapChrome.jsx`, `DecorativeFrame.jsx`, `ExportElementLayers.jsx`, `exportMapUtils.js`
- `src/components/map/export/ExportLegend.jsx`, `ExportLocationInsets.jsx`, `InstitutionalFooter.jsx`, `exportComposition.css`
- `tests/js/exportComposition.test.jsx` — IT-018…041
- `tests/js/mocks/leafletStub.js`, `reactLeafletStub.jsx`
- `vitest.config.js`, `tests/js/setup.js`, `package.json` (Testing Library + jsdom devDeps)

## Errors / Corrections

- Initial `useMap` mock returned new object each render → infinite loop/OOM; fixed with singleton stub.
- Missing RTL cleanup caused duplicate test ids across IT cases.

## Ready for Next Run

- task_03 should mount `CompositionPreview` from `ExportMapShell`, wire session state/callbacks, and pass `compositionEl` from `data-testid="export-composition-root"` into `generateExport`.
