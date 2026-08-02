---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T18:01:05Z
status: resolved
file: src/components/map/ExportMapModal.jsx
line: 81
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: previewModel uses live props, not frozen snapshot

## Review Comment

`CompositionPreview` correctly receives `previewSettings` / `previewElements` / `previewBasemapReadiness`, but the modal’s own `buildPreviewModel` call still uses live `config`, `elements`, and `basemapReadiness`. Loading/error copy and `exportDisabled` therefore track a different composition than the DOM being captured.

During export this desync is user-visible (status messages) and makes readiness/gate UI an unreliable signal of what html2canvas will see.

Suggested fix: build the modal `previewModel` from the same frozen inputs passed to `CompositionPreview` (`previewSettings`, `previewElements`, `previewBasemapReadiness`, plus a frozen boundary snapshot if added).

## Triage

- Decision: `valid`
- Root cause: `ExportMapModal` congelava `previewSettings`/`previewElements` para `CompositionPreview`, mas o `useMemo` local de `previewModel` (e `gateResult`) ainda lia `config`/`elements` ao vivo. Durante `isExporting`, mensagens de loading/erro e `exportDisabled` podiam refletir uma composição diferente da capturada pelo html2canvas.
- Fix: alinhar `buildPreviewModel`, `effectiveVisibleElements` e `validateExportGates` aos mesmos `previewSettings`/`previewElements` passados ao preview. `basemapReadiness` permanece ao vivo (ADR/issue_001 — callbacks de tile durante exportação).
- Verification: teste de contrato em `exportPreview.test.js` + pipeline completo (`npm run lint`, `npm run typecheck`, `npm run test`).
