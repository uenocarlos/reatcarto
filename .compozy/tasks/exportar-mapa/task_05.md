---
status: completed
title: Exportação PNG e entrega web/nativa
type: frontend
complexity: high
---

# Task 5: Exportação PNG e entrega web/nativa

## Overview
Fecha o fluxo com geração PNG fiel ao preview: readiness (tiles/boundaries), captura `html2canvas`, download no web ou Share/Filesystem no Capacitor, feedback de progresso/sucesso/falha, e aplicação dos export gates na ação de exportar. Sem este slice a composição não entrega o artefato operacional.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST implement `exportCompositionPng({ previewEl, settings, fileBaseName })` that waits for preview readiness then captures with `html2canvas` (`useCORS`, scale `dpi/96`).
2. MUST run `validateExportGates` before capture; on failure MUST NOT call the exporter and MUST show field guidance (no file).
3. MUST deliver PNG only: web download via PNG data URL/blob link; native via Capacitor Filesystem write + Share sheet.
4. MUST show progress while generating; success toast/message ONLY when download started or share sheet presented with a generated file; Share cancel MUST NOT claim success.
5. MUST treat missing `previewEl`, OOM/huge canvas, tile/boundary unreadiness, and capture errors as `ExportCaptureError` (or equivalent) with visible failure — never silent success.
6. MUST ignore/queue-reject concurrent double export while `isExporting`; freeze capture config at start.
7. MUST suppress success if modal dismissed/aborted mid-generation.
8. MUST keep format options list equal to `['png']` only.
9. SHOULD keep mobile options+preview usable with Cancel reachable during long generation.
10. MUST reuse existing toast patterns (`sonner`) and align with current Capacitor Share/Filesystem usage in `MapEditor`.
</requirements>

## Subtasks
- [x] 5.1 Create `src/lib/export/pngExporter.js` with readiness wait, html2canvas capture, and platform delivery
- [x] 5.2 Wire Export action to gates → exporter; surface multi-field gate messages
- [x] 5.3 Implement web download path and native Filesystem+Share path with correct success semantics
- [x] 5.4 Add progress / success / failure toasts; long-running indicator until settle
- [x] 5.5 Guard double-click, dismiss-during-generation, mid-export option changes (frozen config)
- [x] 5.6 Remove remaining PDF generation from composition export handler if still present
- [x] 5.7 Implement assigned Vitest cases with mocked html2canvas and Capacitor plugins
- [x] 5.8 Cover E2E journeys for successful PNG and blocked gates

## Implementation Details
Lift and finish the existing `handleExport` pipeline in `MapEditor.jsx` into `pngExporter.js` per TechSpec. Mock boundaries: stub `html2canvas`, Capacitor `Filesystem`/`Share`/`Capacitor.isNativePlatform`. Readiness must consider basemap tiles (task_03) and boundary loads when insets > 0 (task_04). Reference ADR-010 for capture stack.

### Relevant Files
- `src/lib/export/pngExporter.js` — new exporter module (create)
- `src/page/MapEditor.jsx` — current `handleExport` html2canvas + Share/download (refactor to call exporter)
- `src/components/map/ExportMapModal.jsx` — export button, `isExporting`, gate messages, preview ref
- `src/lib/export/exportSettings.js` — `validateExportGates`
- `src/lib/export/brazilBoundaries.js` — readiness/errors when locators requested
- `package.json` — `html2canvas`, Capacitor deps already present
- `tests/js/` — new `export*.test.js` following existing Vitest patterns

### Dependent Files
- Composition preview DOM from task_03 — capture target
- Location inset readiness from task_04 — block success when boundaries unusable

### Related ADRs
- [ADR-003: Owner-Only PNG Export from the Map Editor](adrs/adr-003.md) — PNG-only delivery
- [ADR-006: Layer Visibility, Tags, and Export Gates](adrs/adr-006.md) — gates before file
- [ADR-010: Composition Capture Stack and Cartographic Defaults](adrs/adr-010.md) — html2canvas stack and failure loudness

## Deliverables
- `pngExporter` with web and native delivery paths
- Gate-blocked export with clear messages and no file
- Progress and success/failure feedback matching platform semantics
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-146, UT-147, UT-148, UT-149, UT-150, UT-151, UT-152, UT-153, UT-154, UT-155, UT-156 — exporter call, web download, gate block, missing preview, OOM, concurrency, dismiss, re-export, frozen config, PNG-only formats, `isExporting` lifecycle
- [x] IT-037, IT-038, IT-039 — web mock download PNG; native Filesystem+Share; auth lost mid-export no success
- [x] E2E-015, E2E-017 — successful PNG download/share with success only on completion; gate blocking then fix-and-export

## Success Criteria
- Every assigned test case implemented and passing
- Failing gates never produce a file or success toast
- Web success implies PNG download invoked; native success implies Share presented with generated file
- PDF is not offered or generated on the composition path
- Capture failures surface error feedback without claiming success
