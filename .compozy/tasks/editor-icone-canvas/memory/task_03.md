# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Deliver `api.icons` client + StylePanel “Meus ícones” list/apply/remove with online guards and built-in/clear-custom URL reset.

## Important Decisions

- Extracted testable helpers in `stylePanelIconHelpers.js` and `IconLibraryList.jsx` per `_tests.md` UT-023/041/042/043.
- Added `desktopCapability.js` early (task_04 will wire “Desenhar”); E2E-004 asserts no Desenhar button + library visible on mobile gate.
- Removed generic upload stub; library section replaces it; applied-custom preview + clear control retained.

## Learnings

- StylePanel renders desktop + mobile surfaces simultaneously in jsdom — tests must use `getAllByText` / row-scoped queries.

## Files / Surfaces

- `src/api/apiClient.js` — `api.icons.{list,create,remove,url}` with offline guards
- `src/lib/icons/{constants,desktopCapability,stylePanelIconHelpers}.js`
- `src/components/map/{StylePanel,IconLibraryList}.jsx`
- `tests/js/{apiIcons.test.js,stylePanelIconLibrary.test.jsx}`

## Errors / Corrections

- Fixed missing `api` import in StylePanel (pre-existing bug surfaced when wiring library).
- Pre-existing suite failure: `exportE2E.test.jsx` E2E-008 (`L.DomEvent.on`) unrelated to this task.

## Ready for Next Run

- task_04: wire `canUseIconCanvasEditor()` “Desenhar ícone” button + `IconCanvasEditor` using `api.icons.create`.
