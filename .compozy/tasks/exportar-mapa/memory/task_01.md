# Task Memory: task_01.md

## Objective Snapshot

Delivered pure client-side export foundation: branding assets, session API, geo loader, preview debounce, scale helpers, and `generateExport` pipeline.

## Important Decisions

- Geo paths follow repo layout (`/geo/ufs.geojson`, `/geo/municipios/{id}.geojson`) over TechSpec fictional monolithic names.
- `assertExportTitle` returns `{ ok, code }` object; `generateExport` maps empty title to `validation` code before capture.
- Legend font px out-of-range values clamp to 8–18 (UT-025).
- `mapCaptureError` maps memory/allocation errors to `memory`, others to `capture`.
- Session `elements` shallow-cloned per element at open for UT-016 freeze semantics.

## Learnings

- UF GeoJSON uses `sigla`/`nome`/`id`; municipio files use `id`/`nome`/`uf`.
- Institutional footer REAT string is `(R)EAT` in printJs copy, not bare `REAT`.

## Files / Surfaces

- `public/export/logoreat.png`, `public/export/north.png`
- `src/lib/export/*` (branding, constants, session, legendItems, previewSync, geoBoundaries, scale, generateExport, index)
- `tests/js/setup.js`, `tests/js/export*.test.js`, `tests/js/generateExport.test.js`
- `package.json` (+ `html-to-image`)

## Errors / Corrections

- UT-016 failed until elements were cloned per-object in session factory.
- UT-030 test adjusted to match `(R)EAT` institutional string.

## Ready for Next Run

- task_02/03 should import from `@/lib/export` index; no module-level session singleton exists.
- Geo cache reset via `resetGeoBoundariesCache()` in tests only.
