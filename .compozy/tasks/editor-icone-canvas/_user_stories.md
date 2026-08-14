# User Stories: Canvas Icon Editor (Map Editor)

Canonical behavior catalog for the point icon drawing editor and per-user icon library. Companion to `_prd.md`; consumed by `_techspec.md` (component mapping) and `_tests.md` (coverage matrix).

## Personas

- **Map author** — Creates and styles points in the Map Editor; needs distinctive symbols beyond the built-in set and reuse of those symbols across points and maps.
- **Field user (mobile)** — Edits maps on a phone/tablet; needs to apply existing custom symbols but does not create new drawings in the MVP.

## Story Index

| ID     | Feature Area        | Persona            | Story                                              |
|--------|---------------------|--------------------|----------------------------------------------------|
| US-001 | Entry & platform    | Map author         | Open drawing editor from StylePanel on desktop     |
| US-002 | Entry & platform    | Field user         | Mobile uses library; cannot open drawing editor    |
| US-003 | Drawing (P0)        | Map author         | Draw with pencil, shapes, color, stroke width      |
| US-004 | Drawing (P0)        | Map author         | Select, move, resize, rotate a single object       |
| US-005 | Apply & library     | Map author         | Confirm saves to library and applies to point      |
| US-006 | Apply & library     | Map author         | Optional name; empty confirm blocked; cancel safe  |
| US-007 | Apply & library     | Map author         | Pick library icon onto another point / map         |
| US-008 | Apply & library     | Map author         | Remove icon from library without clearing points   |
| US-009 | Display             | Map author         | Colored icon on map, panel, legend, and export     |
| US-010 | Built-ins coexistence | Map author       | Built-in icons still work; color tint rules clear  |
| US-011 | Drawing (P1)        | Map author         | Multi-select group transforms                      |
| US-012 | Drawing (P1)        | Map author         | Undo / redo                                        |
| US-013 | Drawing (P1)        | Map author         | Eraser and clear canvas                            |
| US-014 | Drawing (P2)        | Map author         | Triangle shape                                     |

## Entry & platform

### US-001: Open drawing editor from StylePanel (desktop)

**As a** map author, **I want** to open a drawing editor from the point StylePanel, **so that** I can create a custom icon without leaving the point styling flow.

Acceptance criteria:

- AC-1: Given I am creating or editing a point on desktop, when I open StylePanel, then I see a way to open the icon drawing editor and a “Meus ícones” (library) section.
- AC-2: Given I open the editor, when it appears, then the canvas is blank (new drawing) at 256×256 and ready for tools.
- AC-3: Given the editor is open, when I work in it, then built-in icon picking remains available after I close without forcing me to lose the point form context.

Edge cases:

- EC-1: Point not yet saved / new draft point → editor still opens; confirm still attempts library save + apply to the in-progress style (persist rules follow existing point save flow).
- EC-2: Session expired while editor open → confirm fails with auth error; draft drawing is not added to library; point style unchanged until a successful confirm.
- EC-3: User opens editor twice in a row after cancel → each open is a fresh blank canvas.
- EC-4: StylePanel closed while editor open → editor closes as cancel (no library/point change) or blocks close until dismiss — product: treat as cancel/discard.

### US-002: Mobile library only

**As a** field user on mobile, **I want** to apply icons from my library without opening the drawing creator, **so that** I can use custom symbols in the field without a broken touch editor.

Acceptance criteria:

- AC-1: Given I edit a point on mobile, when I view StylePanel, then I can browse/apply library icons and built-in icons.
- AC-2: Given I am on mobile, when I look for “draw icon”, then the drawing editor is unavailable and the UI explains that creating icons requires desktop.

Edge cases:

- EC-1: Narrow desktop window / touch laptop → product treats “desktop” as pointer-capable desktop experience; if the product detects mobile UA / touch-primary layout, drawing entry stays hidden (TechSpec defines detection; behavior matches AC-2).
- EC-2: Empty library on mobile → section shows empty state; built-ins still work.
- EC-3: User rotates device / responds as desktop → availability follows the platform rule consistently for that session layout.

## Drawing (P0)

### US-003: Core drawing tools

**As a** map author, **I want** pencil, rectangle, circle, line, color, and stroke width, **so that** I can compose a simple symbol from scratch.

Acceptance criteria:

- AC-1: Given the editor is open, when I use the pencil, then freehand strokes appear in the current color and stroke width.
- AC-2: Given I choose rectangle, circle, or line, when I draw, then the corresponding shape is added as an object with current color/stroke.
- AC-3: Given I change color or stroke width, when I draw new content, then new strokes/shapes use the updated settings (existing objects keep prior styles unless later edited by selection tooling in scope).

Edge cases:

- EC-1: Stroke width at minimum/maximum → clamped to allowed range; UI reflects the clamped value.
- EC-2: Rapid tool switching mid-gesture → current gesture completes or cancels cleanly; no corrupted half-objects left unselectable.
- EC-3: Draw entirely outside canvas bounds → only content inside the 256×256 artboard is kept for export.
- EC-4: Hostile / extreme color values from UI → only valid colors from the color control are applied.

### US-004: Single-object transform

**As a** map author, **I want** to select, move, resize, and rotate one object, **so that** I can position parts of the icon precisely.

Acceptance criteria:

- AC-1: Given objects exist, when I click an object, then it becomes selected with transform handles.
- AC-2: Given a selected object, when I drag, resize, or rotate, then that object updates on the canvas.
- AC-3: Given nothing is selected, when I click empty canvas, then selection clears.

Edge cases:

- EC-1: Resize to near-zero → object stays selectable or clamps to a minimum size so it is not lost.
- EC-2: Rotate repeatedly → object remains within expected bounds handling (may extend past artboard; export clips to canvas).
- EC-3: Click overlapping objects → topmost (or last-created) object is selected per editor hit-testing; user can still select others by clicking exposed areas.
- EC-4: Delete key with selection (if supported) → selected object removed; if Delete unsupported in P0, document as non-goal until polish — **P0 expects user can remove a mistaken object** via selecting and deleting or an explicit delete control.

## Apply & library

### US-005: Confirm saves to library and applies

**As a** map author, **I want** confirming a drawing to save it to my account library and apply it to the current point, **so that** I both use it now and reuse it later.

Acceptance criteria:

- AC-1: Given a non-empty drawing within size limits, when I confirm, then a PNG with transparent background is stored in my user library and the current point’s custom icon uses that asset.
- AC-2: Given confirm succeeds, when I view the map, then the point shows the new colored icon without waiting for a separate “upload icon” step.
- AC-3: Given confirm succeeds, when I open StylePanel on another point (same account), then the new icon appears under “Meus ícones”.

Edge cases:

- EC-1: Export exceeds ~200 KB → confirm rejected with size-limit message; library and point unchanged.
- EC-2: Network failure mid-confirm → user sees failure; no partial library entry presented as success; point not updated to a broken URL.
- EC-3: Confirm clicked twice quickly → only one library icon is created (idempotent or second attempt no-ops / disabled while in flight).
- EC-4: Offline (if app supports offline map edit) → either queue with clear pending state or reject with offline message; no silent success. Exact offline policy may remain TechSpec + Open Questions; user-visible outcome must not claim success without durable save.
- EC-5: Cross-user: library of user A is not listed for user B.

### US-006: Optional name, empty block, cancel

**As a** map author, **I want** an optional name, protection against empty saves, and safe cancel, **so that** my library stays usable and drafts are not applied by accident.

Acceptance criteria:

- AC-1: Given I confirm, when I provide a name, then the library entry shows that name; when I leave it blank, then the entry still saves with a sensible fallback label (e.g. “Ícone” / dated default).
- AC-2: Given the canvas has no drawable content, when I confirm, then save/apply is blocked with a short message asking me to draw something.
- AC-3: Given I cancel or dismiss the editor without confirming, when I return to StylePanel, then the point style and library are unchanged and the draft is discarded.

Edge cases:

- EC-1: Name with only whitespace → treated as empty; fallback label used.
- EC-2: Very long name → truncated or rejected with message; does not break layout of “Meus ícones”.
- EC-3: Duplicate names allowed → two entries can share a display name; both remain distinguishable in the list (e.g. by preview thumbnail).
- EC-4: Canvas with only fully transparent / zero-alpha content → treated as empty; confirm blocked.

### US-007: Reuse library icon on other points

**As a** map author, **I want** to apply an existing library icon to any point on any of my maps, **so that** I do not redraw the same symbol.

Acceptance criteria:

- AC-1: Given my library has icons, when I select one in StylePanel for a point, then that point uses the icon as its custom icon and shows it on the map.
- AC-2: Given I applied a library icon on map A, when I open map B as the same user, then the same library entries are available.
- AC-3: Given a point uses a library icon, when I save the point, then the custom icon persists after reload.

Edge cases:

- EC-1: Library icon asset missing/broken URL → point shows a clear fallback (broken-icon placeholder or built-in default) without crashing the map.
- EC-2: Apply library icon then switch to a built-in icon → custom icon is cleared/replaced by the built-in; library entry remains.
- EC-3: Clear custom icon control (existing “remove custom”) → point returns to built-in/default icon path; library unchanged.
- EC-4: Large library (100× typical) → list remains scrollable/usable; performance may paginate but all icons remain reachable.

### US-008: Remove from library

**As a** map author, **I want** to remove an icon from my library, **so that** I can discard symbols I no longer want to pick from.

Acceptance criteria:

- AC-1: Given a library icon, when I remove it, then it no longer appears in “Meus ícones”.
- AC-2: Given points already using that icon, when I remove it from the library, then those points **continue** to display the applied custom icon until I change them.
- AC-3: Given I removed an icon, when I open the editor later, then I can still create a new drawing (clean canvas).

Edge cases:

- EC-1: Remove while another tab has StylePanel open → other tab refreshes or next open no longer shows the removed entry.
- EC-2: Remove the icon currently selected on the open point’s library highlight → point keeps its applied `custom_icon_url`; only catalog membership ends.
- EC-3: Unauthorized delete (tampered request for another user’s icon) → rejected; victim library unchanged.
- EC-4: Remove already-removed icon (retry) → idempotent success or harmless “not found”; UI ends consistent with icon absent.

## Display

### US-009: Color-preserving display everywhere

**As a** map author, **I want** my drawn icon’s colors to appear on the map, StylePanel preview, legend, and export, **so that** the printed/shared map matches what I drew.

Acceptance criteria:

- AC-1: Given a point with a library/drawn custom icon, when I view the interactive map, then the marker shows original colors (not a single `icon_color` silhouette).
- AC-2: Given the same point, when I open StylePanel, then the preview matches those colors.
- AC-3: Given the same point, when I view legend and export composition, then the symbol uses the same colored artwork.

Edge cases:

- EC-1: `icon_color` changed while custom colored icon applied → map/legend/export icon colors unchanged; built-in tinting does not apply to this custom icon.
- EC-2: Zoom level changes → icon scales with existing marker sizing rules while preserving artwork colors.
- EC-3: Export at high DPI → icon remains recognizable; transparency preserved (no forced opaque backdrop).

### US-010: Coexistence with built-in icons

**As a** map author, **I want** built-in icons and `icon_color` to keep working when I am not using a drawn icon, **so that** existing workflows are not broken.

Acceptance criteria:

- AC-1: Given no custom library icon on a point, when I pick a built-in icon and color, then map/legend/export behave as before (tinted built-in).
- AC-2: Given a custom library icon is applied, when I pick a built-in instead, then the point uses the built-in and tinting rules again.
- AC-3: Given the old “upload personalizado” file input stub, when this feature ships, then drawing + library fulfill custom icons; generic photo upload for icons remains out of scope and must not be required for this flow.

Edge cases:

- EC-1: Point with legacy `custom_icon_url` set by other means → still renders; if it is a full-color asset, follow color-preserving path; if product cannot distinguish, prefer color-preserving display for URL customs used as icons.
- EC-2: Mixing many built-in and custom points on one map → legend groups remain understandable (custom entries show artwork).

## Drawing (P1)

### US-011: Multi-select group transforms

**As a** map author, **I want** to multi-select objects and move/resize/rotate them together, **so that** I can adjust composite symbols faster.

Acceptance criteria:

- AC-1: Given multiple objects, when I multi-select (marquee and/or shift-click), then all selected objects show as a group selection.
- AC-2: Given a multi-selection, when I move, resize, or rotate, then all selected objects transform together.

Edge cases:

- EC-1: Multi-select with one object → behaves like single select.
- EC-2: Deselect one from group → remaining selection stays active.
- EC-3: Empty marquee → selection unchanged or cleared consistently.

### US-012: Undo / redo

**As a** map author, **I want** undo and redo, **so that** I can recover from mistakes while drawing.

Acceptance criteria:

- AC-1: Given I performed an edit, when I undo, then the canvas returns to the previous state.
- AC-2: Given I undid, when I redo, then the undone change returns.
- AC-3: Given I undo then draw something new, when I try redo, then the old redo branch is cleared.

Edge cases:

- EC-1: Undo at start of history → no-op; control disabled.
- EC-2: Selection-only changes → either not in history or restored without confusing jumps (product preference: do not surprise-clear selection on unrelated undos when avoidable).
- EC-3: Undo after clear canvas → previous content restored.

### US-013: Eraser and clear canvas

**As a** map author, **I want** an eraser and clear canvas, **so that** I can remove strokes or start over without canceling the dialog.

Acceptance criteria:

- AC-1: Given content exists, when I use the eraser, then targeted drawn content is removed.
- AC-2: Given content exists, when I clear the canvas, then all objects/strokes are removed and the canvas is blank.
- AC-3: Given I cleared, when I confirm without new drawing, then confirm is blocked as empty (US-006).

Edge cases:

- EC-1: Eraser on empty canvas → no-op.
- EC-2: Clear then undo (with US-012) → content restored.
- EC-3: Clear does not affect library or point until confirm.

## Drawing (P2)

### US-014: Triangle shape

**As a** map author, **I want** a triangle shape tool, **so that** I can build common symbols without approximating with lines.

Acceptance criteria:

- AC-1: Given the editor (P2), when I select triangle and draw, then a triangle object is created with current color/stroke.
- AC-2: Given a triangle, when I select it, then move/resize/rotate work as for other shapes.

Edge cases:

- EC-1: Degenerate triangle (colinear points / zero area) → clamped or discarded so an invalid object is not left selected.
- EC-2: Triangle available only when P2 ships; P0/P1 builds omit it without breaking other tools.
