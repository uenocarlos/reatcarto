# Task Memory: task_03.md

## Objective Snapshot

Preview de composição completo: módulos extraídos em `src/components/map/export/` + helpers em `src/lib/export/`; modal refatorado com preview vivo, visibilidade/tags, basemap ArcGIS/offline nativo, escala dinâmica, rodapé institucional.

## Important Decisions

- Lógica testável em helpers puros; componentes React finos consomem `buildPreviewModel`.
- Offline basemap via `OfflineTileLayer` + `tileManager.getLocalTileUrl`; desabilitado na web via `isOfflineBasemapAvailable`.
- Satélite alinhado ao editor: ArcGIS World Imagery (não Google).
- Logo em `public/logo.png` com fallback textual `(R)EAT` no `onError`.

## Learnings

- Vitest em `node` — testes E2E/IT desta task usam source-scan + helpers puros (padrão task_02).
- `LOGO_PATH` constante em `institutionalFooter.js` aponta para `/logo.png`.

## Files / Surfaces

- `src/lib/export/compositionMetadata.js`, `legendLayout.js`, `exportTags.js`, `basemapResolver.js`, `paperFrame.js`, `dynamicScale.js`, `previewModel.js`, `institutionalFooter.js`, `elementStyle.js`, `exportVisibility.js`
- `src/components/map/export/*` (CompositionPreview, LegendFrame, PreviewMap, GraticuleOverlay, OfflineTileLayer, InstitutionalFooter, ExportVisibilityPanel)
- `src/components/map/ExportMapModal.jsx` (refatorado)
- `public/logo.png`
- `tests/js/exportPreview.test.js` (127 casos UT/IT/E2E atribuídos)

## Errors / Corrections

- IT-025/E2E-014: asserts de source-scan ajustados para `OfflineTileLayer.jsx` e `LOGO_PATH` (não strings literais no modal).

## Ready for Next Run

- task_04: slots de location inset no `CompositionPreview`; crédito IBGE completo no rodapé.
- task_05: capturar DOM `#composition-preview` via `pngExporter`.
