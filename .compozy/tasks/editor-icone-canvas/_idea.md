# Idea: Editor de ícone no canvas (Map Editor)

Source: `prompts/prd-editor-icone-canvas.md`

## Summary

Allow Map Editor users to open a drawing editor while creating/editing a point, draw an icon from scratch (object-based tools), export a transparent PNG, and apply it as the point’s `custom_icon_url` for map, panel, legend, and export.

## Explicit non-goals (separate features)

- Generic image upload for custom icons
- Automatic background removal from photos

## Stated MVP tools

Pencil, eraser, basic shapes (rect, circle, line; triangle if cheap), color, stroke width, select/move/resize/rotate, multi-select group transforms, undo/redo, clear canvas, transparent PNG export/apply.

## Stated priorities

- P0: open editor, draw (pencil + shapes + color + stroke), export PNG, apply to point, see on map; single-object select/move/resize/rotate
- P1: multi-select group transforms; undo/redo; eraser + clear
- P2: triangle + UX polish

## Open product decisions called out in the prompt

- Colored drawing: preserve original colors on map (`<img>`) vs silhouette/mask recolorable via `icon_color` (initial preference: preserve colors)
- Desktop-complete MVP vs limited mobile
- Canvas dimensions and max exported PNG size
- Persistence aligned to existing media/upload patterns
