# Task Memory: task_05.md

## Objective Snapshot

Exportação PNG fiel ao preview via `pngExporter` + `exportController`; gates antes da captura; web download / native Share; toasts progresso/sucesso/falha; guards concorrência/abort.

## Important Decisions

- Orquestração em `exportController.js` (gates, isExporting, frozen config, abort); captura/entrega em `pngExporter.js`.
- Share cancel: `activityType` ausente → `cancelled`, sem toast de sucesso.
- Readiness: poll `data-preview-status` no preview root até `ready` (timeout 15s).

## Learnings

- Testes UT-154 verificam settings congelados via argumento passado ao mock `exportPng`.
- `waitForPreviewReadiness` com fake timers exige `expect().rejects` registrado antes de `advanceTimersByTimeAsync`.

## Files / Surfaces

- `src/lib/export/pngExporter.js` — novo
- `src/lib/export/exportController.js` — novo
- `src/page/MapEditor.jsx` — refatorado handleExport
- `src/components/map/ExportMapModal.jsx` — isExporting UI
- `tests/js/exportPng.test.js` — UT-146–156, IT-037–039, E2E-015/017

## Errors / Corrections

- UT-154 timeout: removido setTimeout dentro do mock; verificação via `exportPng.mock.calls`.
- Unhandled rejection readiness test: attach rejection handler antes de avançar timers.

## Ready for Next Run

- task_05 concluída; composição export entrega PNG operacional.
