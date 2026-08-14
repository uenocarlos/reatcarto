# PRD: Canvas Icon Editor for Map Points

## Overview

Map authors need symbols that the built-in icon catalog cannot express (agency marks, local landmarks, campaign pictograms). Today they can pick ready-made icons; a custom URL field exists and renders on the map, but there is no way to **draw** an icon in-product, and the interactive “personalizado” upload control is a stub. Generic image upload and background removal are intentionally separate efforts.

This feature adds an **object-based drawing editor** in the point StylePanel (desktop), exports a **transparent PNG**, stores it in a **per-user icon library**, and applies it to the point as `custom_icon_url` (or the project’s equivalent). Library icons are reusable across the user’s points and maps. Drawn icons keep their **original colors** on the map, StylePanel preview, legend, and export.

## Goals

- Map authors can open a drawing editor from point create/edit and produce a custom icon without leaving the styling flow.
- Confirming a drawing saves the icon to the user’s library **and** applies it to the current point in one step.
- Authors can reuse library icons on any of their points/maps and remove catalog entries without breaking points that already use those icons.
- Drawn/library icons appear with original colors on interactive map, panel preview, legend, and export.
- Built-in icons and `icon_color` tinting continue to work when no colored custom icon is applied.
- Mobile users can apply library and built-in icons but cannot open the drawing creator in the MVP.
- Empty confirms are blocked; cancel discards drafts; canvas is fixed at 256×256 with ~200 KB max PNG.

## User Stories

Index into the canonical catalog — do not restate stories here:

- **US-001–US-002** — Entry & platform (desktop editor; mobile library-only)
- **US-003–US-004** — P0 drawing tools and single-object transforms
- **US-005–US-008** — Confirm, library save/apply/reuse/remove, naming and cancel
- **US-009–US-010** — Color-preserving display and coexistence with built-ins
- **US-011–US-013** — P1 multi-select, undo/redo, eraser/clear
- **US-014** — P2 triangle

[Full user stories](_user_stories.md)

## Core Features

### 1. Drawing editor (desktop)

Object-based canvas editor opened from StylePanel while creating/editing a point. Always starts blank (new drawing; no scene replay of past icons).

**P0 tools:** pencil (freehand), rectangle, circle, line, color, stroke width; select, move, resize, rotate (single object).

**P1:** multi-select with group move/resize/rotate; undo/redo; eraser; clear canvas.

**P2:** triangle; UX polish.

### 2. Per-user icon library

Account-scoped catalog of drawn icons (“Meus ícones”) available on all maps for that user. Managed only from StylePanel in the MVP (no separate library page).

Actions: apply to current point, remove from library, optional name at save. Confirm in the editor = save to library + apply to current point.

### 3. Apply to point & display

Applied icons use the existing custom-icon slot (`custom_icon_url` inside point `style`). Display must preserve artwork colors on map, preview, legend, and export. `icon_color` does not recolor these assets. Switching back to a built-in clears/replaces the custom application; the library entry remains.

### 4. Platform split

Full editor on desktop only. Mobile: library + built-ins; drawing entry hidden with clear explanation.

## Business Rules

1. **Library ownership:** Each library entry belongs to exactly one user account; it is not visible to other accounts.
2. **Save+apply:** A successful confirm creates a library entry and sets the current point’s custom icon to that asset. Failure does neither (no “success” partial state).
3. **Clean canvas:** Every editor open is a new drawing; there is no editable object-graph reopen of a past icon.
4. **Empty confirm:** Confirm is rejected if the canvas has no drawable content (including only-transparent content).
5. **Cancel:** Dismiss without confirm discards the draft; library and point unchanged.
6. **Limits:** Artboard 256×256 px; export PNG with transparency; max ~200 KB per icon; over-limit confirm rejected with a message.
7. **Optional name:** Blank/whitespace name → system fallback label; duplicate names allowed; long names truncated or rejected without breaking the list UI.
8. **Remove from library:** Removes catalog membership only. Points that already reference the asset keep displaying it until the user changes the point’s icon.
9. **Built-in coexistence:** With no colored custom icon applied, built-in icon + `icon_color` behave as today. Applying a library icon disables tinting for that point’s marker artwork.
10. **Mobile:** Drawing editor must not be available; library apply/remove (where UI exposes remove) and built-ins remain available.
11. **Priorities:** P0 / P1 / P2 as listed under Core Features; P1/P2 must not block P0 acceptance.
12. **Non-cascade:** Clearing custom icon on a point does not delete the library entry.

## User Experience

### Personas

- **Map author (desktop):** Primary creator of symbols; uses StylePanel heavily.
- **Field user (mobile):** Reuses symbols; does not draw in MVP.

### Primary flows

1. **Create & apply:** Edit point → StylePanel → Desenhar ícone → draw → optional name → confirm → see icon on point/map and in “Meus ícones”.
2. **Reuse:** Edit another point (any map) → “Meus ícones” → select → marker updates with same artwork.
3. **Replace with built-in:** Select built-in (or clear custom) → custom application removed; library unchanged.
4. **Catalog hygiene:** Remove from “Meus ícones” → entry gone; existing points still show prior artwork.
5. **Mobile apply:** StylePanel → pick library icon → no draw affordance (or disabled with explanation).

### UX considerations

- Keep discovery next to existing icon grid so authors find “Meus ícones” and “Desenhar” without a new global nav item.
- When a colored custom icon is active, make it obvious that `icon_color` does not tint it.
- Empty and oversize confirms use short, actionable messages.
- Accessibility: editor tools reachable by pointer; keyboard undo (P1) where platform conventions apply; sufficient contrast for tool chrome (not for the artwork itself).

## High-Level Technical Constraints

- Must integrate with existing point styling: `style.icon_name`, `style.icon_color`, `style.custom_icon_url` (JSONB on `map_elements`), StylePanel, Leaflet marker creation, legend grouping, and export composition.
- Persistence must yield a durable URL (or equivalent) suitable for `custom_icon_url`, aligned with the product’s media/upload patterns; library is account-scoped and reusable across maps.
- Color-preserving display is required for library/drawn icons on map, legend, and export (current mask-only path for custom URLs is insufficient for this feature).
- Generic photo upload (`api.media` / photos endpoints) is for element photos, not a substitute product for the icon library — do not overload photo attachments as the user-facing “ícone” catalog.
- No requirement in this PRD to choose a canvas library (Fabric, Konva, etc.); that is TechSpec.
- User-perceived apply should complete within a normal save interaction; failures must be visible.

## Non-Goals (Out of Scope)

- Generic file upload of arbitrary images as custom icons (separate feature; current StylePanel stub stays out of this PRD’s delivery).
- Automatic background removal from photos.
- Re-opening a past drawing as an editable object scene.
- Per-map or organization-shared icon libraries.
- Standalone library management page / Profile library screen.
- Full drawing editor on mobile/tablet in MVP.
- Layers, text tools, image-trace, SVG path import, pressure brushes, and other advanced illustration features not listed in priorities.
- Cascading delete of point icons when removing a library entry.
- Changing the built-in Lucide/`/icons/*.svg` catalog itself.

## Architecture Decision Records

- [ADR-001: Preserve Original Colors for Drawn Icons](adrs/adr-001.md) — Map/legend/export show original artwork colors; `icon_color` does not tint drawn/library icons.
- [ADR-002: Per-User Icon Library Without Editable Scene Replay](adrs/adr-002.md) — Account library, save+apply, clean canvas, StylePanel-only entry, remove without cascade.
- [ADR-003: Full Drawing Editor on Desktop Only](adrs/adr-003.md) — Desktop draws; mobile applies library/built-ins only.
- [ADR-004: Canvas Limits, Empty Confirm, and Priority Tiers](adrs/adr-004.md) — 256×256, ~200 KB PNG, empty/cancel rules, P0/P1/P2 split.

## Open Questions

- **Offline:** If map editing is used offline, should library save queue like photos, or must the user be online to confirm a new icon? Needs a product call when offline sync priorities are set; until then, failed/offline confirm must not report success.
- **Library volume:** No hard count quota in MVP; revisit if storage or StylePanel UX degrades.
- **Legacy `custom_icon_url` values** created outside the library (if any exist in data): treat as color-preserving custom artwork when displayed; optional later migration into “Meus ícones” is not required for MVP.
- **Delete-object in P0:** Stories require removing a mistaken object before confirm; exact control (Delete key vs toolbar) is left to TechSpec/UX as long as AC is met.
