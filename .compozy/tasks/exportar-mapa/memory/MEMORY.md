# Workflow Memory

## Current State

- task_01 concluída: contrato `export_settings` (migration JSONB, LWW MapService, strip público, `exportSettings.js`, mirror IndexedDB).
- task_05 concluída: `pngExporter` + `exportController`; captura html2canvas, gates, web/native delivery, toasts.
- task_03 concluída: preview vivo completo extraído em `src/components/map/export/` + helpers testáveis em `src/lib/export/`.
- task_02 concluída: botão Export, modal PNG-only, persist debounced + flush, gates owner-only.

## Shared Decisions

- Composição export: PNG-only na UI (ADR-003/010); GeoJSON export permanece separado no header.
- Persistência: debounce ~500ms via `createDebouncedExportSettingsPersist`; flush no close e antes do export.
- Preview: basemap satélite = ArcGIS (alinhado `LeafletMap`); offline nativo via `tileManager.getLocalTileUrl`; desabilitado na web.
- Preview módulos: `CompositionPreview` + `buildPreviewModel` como contrato para task_05 captura html2canvas.

## Shared Learnings

- Testes de UI entry/preview usam módulos puros + source-scan porque vitest está em ambiente `node` sem RTL.
- Logo institucional: `public/logo.png` + fallback textual no `onError`.

## Open Risks

- Leaflet preview pesado — helpers puros cobrem contrato; testes de componente completos precisariam jsdom.

## Handoffs

- task_04 concluída: IBGE+fallback, UI None/1/2, LocationInsets, overlays, crédito IBGE condicional.
- Export PNG: `exportCompositionPng` aguarda `data-preview-status=ready`; `createExportController` congela settings no início.
