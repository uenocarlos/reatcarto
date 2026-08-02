# Task Memory: task_04.md

## Objective Snapshot

Localização Brasil no preview export: `BrazilBoundaryService` (IBGE + fallback `public/geo/`), UI None/1/2, insets, overlays, legenda location, crédito IBGE condicional.

## Important Decisions

- Contrato público: `getLocatorGeometries` (TechSpec); loaders internos sem fallback silencioso — `resolveWithFallback` centraliza `source`/`usedFallback`.
- Gate municipality exigido quando `locatorCount >= 1` (alinhado UT-097 e req task).
- Crédito IBGE quando seleção UF+muni completa ou flags de legenda/malha ativas com seleção (ADR-009).

## Learnings

- Malhas IBGE v3 para UFs falharam no script inicial; bundle `ufs.geojson` gerado via bbox sintético + catálogo Localidades (script `scripts/generate-geo-fallback.mjs`).
- Race em `resolveWithFallback` paralelo exigiu fallback por chamada, não flag `source` compartilhada.

## Files / Surfaces

- `src/lib/export/brazilBoundaries.js`, `locationPreview.js`, `useExportLocationBoundaries.js`, `geoJsonLeaflet.js`
- `public/geo/` (27 UFs + municipios + sa-brazil-context + meta)
- `src/components/map/export/LocationOptionsPanel.jsx`, `LocationInsets.jsx`, `LocationOverlays.jsx`
- `ExportMapModal.jsx`, `CompositionPreview.jsx`, `PreviewMap.jsx`, `InstitutionalFooter.jsx`
- `tests/js/brazilLocation.test.js`, `tests/js/fixtures/geo/`

## Errors / Corrections

- `ufs.geojson` vazio na 1ª geração → regerado com bbox.
- Lint hooks condicionais em `LocationOverlays` → hooks antes do early return.

## Ready for Next Run

- task_05: `pngExporter` deve aguardar `boundaryLoading`/ausência de `boundaryError` antes da captura quando insets > 0.
