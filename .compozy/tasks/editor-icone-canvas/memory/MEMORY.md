# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- task_01 (backend icons API) completed.
- task_02 (bitmap rendering for `custom_icon_url`) completed — map, export, and legend show color-preserving `<img>` when URL is set.
- task_03 (api.icons client + StylePanel “Meus ícones”) completed.
- task_04 (IconCanvasEditor P0 + confirm save/apply) completed.
- task_05 (IconCanvasEditor P1 multi-select/undo/eraser/clear + P2 triangle) completed.

## Shared Decisions

- Render mode switch: non-empty `style.custom_icon_url` ⇒ color bitmap (`<img>`, no mask, ignore `icon_color`); empty URL ⇒ existing mask tint for `icon_name` paths or Lucide SVG tint.
- Icon library mutations (`api.icons.list/create/remove`) are online-only; offline throws `ApiError` code `offline` with user-visible toast/message in StylePanel.
- Built-in icon pick and clear-custom both set `custom_icon_url: ''`; soft-remove from library does not clear URLs already applied to points.
- Icon name normalization: whitespace → `Ícone`; length > 100 truncates client-side before upload.
- Fabric + `IconCanvasEditor` lazy-loaded only when desktop user opens “Desenhar ícone”; mount token increments on dismiss to remount blank 256×256 canvas.
- P1/P2 editor: undo/redo via Fabric JSON snapshots on gesture completion; selection-only changes excluded from history; empty marquee clears selection; clear canvas is local-only (no `api.icons.*`).

## Shared Learnings

- Frontend tests with JSX must use `.test.jsx` under `tests/js/`.
- StylePanel dual render (desktop + mobile DOM) requires duplicate-safe test queries.
- StylePanel library section queries: “Meus ícones” label sits in inner flex row — use parent container for sibling controls like remove buttons.

## Open Risks

- Broken custom icon URLs hide via `onerror` (marker + legend); no visible placeholder yet if product wants one.

## Handoffs

- editor-icone-canvas workflow complete (tasks 01–05).
