# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Delivered P0 `IconCanvasEditor` with Fabric lazy-load, desktop gate, PNG export validation, save+apply via `api.icons.create`, and full assigned UT/E2E coverage.

## Important Decisions

- UT-016: long names truncate to `MAX_ICON_NAME_LENGTH` (100), consistent with TechSpec constant.
- Export validation lives in `iconExport.js`; StylePanel confirm uploads pre-validated blob from editor (editor runs `prepareIconExport` before calling `onConfirm`).
- Pure tool/selection logic extracted to `iconEditorModel.js` for testability; confirm error paths in `iconEditorConfirm.js`.
- Editor path: `src/components/map/iconEditor/IconCanvasEditor.jsx`; lazy chunk ~299KB gzip ~91KB.

## Learnings

- StylePanel “Meus ícones” header restructure (flex row with Desenhar button) requires tests to use `closest('div').parentElement` for library section queries.
- Offline E2E must not wait for `api.icons.list` — loadLibrary skips fetch when offline.

## Files / Surfaces

- Added: `iconExport.js`, `iconEditorModel.js`, `iconEditorConfirm.js`, `stylePanelEditorHelpers.js`, `IconCanvasEditor.jsx`
- Extended: `constants.js`, `StylePanel.jsx`, `package.json` (fabric)
- Tests: `desktopCapability.test.js`, `iconExport.test.js`, `iconEditorModel.test.js`, `iconEditorConfirm.test.js`, `stylePanelEditorHelpers.test.js`, `stylePanelIconEditor.test.jsx`, `iconCanvasEditor.test.jsx`
- Minor test fix: `leafletStub.js` DomEvent.on/off for export E2E-008

## Errors / Corrections

- E2E-009 failed when waiting for list mock while offline — fixed test to wait for UI instead.
- E2E-013 broke after library header DOM change — fixed parent selector in existing test.

## Ready for Next Run

- task_05 can unhide triangle/P1 tools and wire undo/multi-select on top of `iconEditorModel` + Fabric modal.
