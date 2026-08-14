# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Color bitmap rendering for non-empty `custom_icon_url` in map markers, export layers, and legend — completed.

## Important Decisions

- Bifurcation keyed solely on trimmed non-empty `customUrl` argument; `icon_name` path/http/*.svg mask branch runs only when `customUrl` is empty (ADR-007).
- Bitmap markers use center anchor `[half, half]`; built-in mask/SVG paths keep prior pin-bottom anchors.
- Legend: `export-legend__symbol--point-bitmap` + `<img>` for customs; `--point-icon` mask class reserved for `icon_name` SVG paths.

## Learnings

- Vitest JSX tests must use `.test.jsx` extension; `.test.js` with JSX fails Rollup parse.
- `layerGrouping.identityOf` already included `custom_icon_url` in key — UT-049 needed test only, no code change.

## Files / Surfaces

- `src/components/map/pointIcon.js` — bitmap vs mask/SVG bifurcation, onerror fallback
- `src/components/map/export/ExportLegend.jsx` — bitmap legend branch
- `src/components/map/export/exportComposition.css` — `--point-bitmap` styles
- `tests/js/pointIconBitmap.test.jsx` — UT-040–049
- `tests/js/exportE2E.test.jsx` — E2E-014

## Errors / Corrections

- Initial test file named `.test.js` with JSX → renamed to `.test.jsx`.

## Ready for Next Run

- task_03 (StylePanel library) and task_04 (Fabric editor) can rely on bitmap rendering being live for any applied `custom_icon_url`.
