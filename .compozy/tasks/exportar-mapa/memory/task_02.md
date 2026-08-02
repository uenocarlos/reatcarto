# Task Memory: task_02.md

## Objective Snapshot

Entrada no editor (botão Export), shell do modal PNG-only, hidratação/persistência debounced de `export_settings`, gates owner-only.

## Important Decisions

- Store por `mapId` via `createExportSettingsStore`; recriado quando `mapId` muda no MapEditor.
- Hidratação ocorre ao abrir modal (`showExport`), não a cada render de `mapData`.
- `canOpenExport` / `createExportEntryState` extraídos para testes sem RTL.
- jsPDF removido do path de composição no MapEditor; modal expõe apenas `EXPORT_FORMATS = ['png']`.

## Learnings

- Vitest roda em `node` sem `@testing-library`; testes de entry usam source-scan + módulos puros + IndexedDB fake.
- `prepareOfflineMap` espelha `export_settings` bruto; normalização ocorre no hydrate do store.

## Files / Surfaces

- `src/lib/export/exportGates.js` (novo)
- `src/lib/export/exportEntryState.js` (novo)
- `src/lib/export/exportSettingsStore.js` (novo)
- `src/page/MapEditor.jsx`
- `src/components/map/ExportMapModal.jsx`
- `tests/js/exportEntry.test.js` (novo)

## Errors / Corrections

- UT-002: teste não deve invocar `onExport` manualmente após cancel — apenas verificar que spy não foi chamado.

## Ready for Next Run

- task_03 pode extrair preview para `src/components/map/export/*`; shell do modal já recebe `settings` controlados e `onSettingsChange`.
- task_05 completa entrega PNG via `pngExporter`; handler atual ainda usa html2canvas inline.
