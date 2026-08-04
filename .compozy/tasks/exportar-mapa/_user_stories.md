# User Stories: Export Map

Canonical behavior catalog for map export composition and download. Companion to `_prd.md`; consumed by `_techspec.md` (component mapping) and `_tests.md` (coverage matrix).

## Personas

- **Map owner** — Authenticated user who owns the map, edits layers and styles in the map editor, and needs a print-ready PNG or PDF for reports, teaching materials, and institutional delivery.
- **Anonymous public visitor** — Views published maps without authentication; must not obtain export capabilities in this version.
- **Non-owner authenticated user** — Logged-in user who opens another owner’s map only if the product already allows (e.g. public route); must not gain private-map export rights.

## Story Index

| ID     | Feature Area              | Persona                 | Story                                              |
|--------|---------------------------|-------------------------|----------------------------------------------------|
| US-001 | Entry & access            | Map owner               | Open export from the map editor                    |
| US-002 | Entry & access            | Anonymous / non-owner   | Export remains unavailable outside owner editor    |
| US-003 | Session & layout chrome   | Map owner               | Compose export layout with live preview            |
| US-004 | Text & branding           | Map owner               | Set title, authorship; fixed institutional footer  |
| US-005 | Format & page quality     | Map owner               | Choose format, paper, orientation, and DPI         |
| US-006 | Legend                    | Map owner               | Position and format the legend                     |
| US-007 | Layers & basemap          | Map owner               | Control layers, labels, and basemap for export     |
| US-008 | Location insets           | Map owner               | Configure location inset maps and regional styles  |
| US-009 | Map chrome                | Map owner               | Export with scale, north, graticule, frame, labels |
| US-010 | Download                  | Map owner               | Export file and recover from failures              |
| US-011 | Responsiveness            | Map owner               | Use full export composition on mobile              |
| US-012 | Session lifecycle         | Map owner               | Close/cancel discards ephemeral export config      |

## Entry & access

### US-001: Open export from the map editor

**As a** map owner, **I want** a clear control in the map editor that opens the export composition experience, **so that** I can produce a shareable layout from the map I already prepared.

Acceptance criteria:

- AC-1: Given I am the authenticated owner editing my map, when I activate the export control, then the export composition UI opens on top of or within the editor flow.
- AC-2: Given I open export, when the composition UI first appears, then the starting viewport matches the editor’s current view, starting layer visibility matches the editor, and basemap matches the editor where an equivalent export basemap exists.
- AC-3: Given the export UI is open, when I view available actions, then I can cancel/close, refresh preview if offered as an explicit action, and start export/download.

Edge cases:

- EC-1: Map has zero drawable elements → export still opens; preview shows basemap/empty map frame; legend is empty or shows only location legend items if chosen.
- EC-2: Map record has blank name → title field starts empty (or blank string); user can type a title before export.
- EC-3: Owner session expires while editor is open before export → export open is blocked or fails with an authentication message consistent with the product; private map content is not exportable without a valid owner session.
- EC-4: Double-activation of open export while already open → second open does not spawn a conflicting second composition that loses unsaved session options without warning; UI remains single session.
- EC-5: Very large element count (100× typical) → open remains responsive; legend/layer lists scroll; export may take longer but UI stays usable with progress later at download time.

### US-002: Export unavailable outside owner editor

**As a** public visitor or non-owner, **I want** the product not to offer map export, **so that** private cartography and print products stay owner-controlled.

Acceptance criteria:

- AC-1: Given I visit a published map as anonymous, when I use the public map UI, then no export/download map composition control is present (or is clearly unavailable).
- AC-2: Given I browse the public gallery, when I open map cards, then no path starts full export composition for that map.
- AC-3: Given a non-owner authenticated user reaches a map they do not own via public means, when they view it read-only, then export composition is not offered.

Edge cases:

- EC-1: Crafted client request attempting export for another user’s map → server and product deny; owner-only rule holds.
- EC-2: Map unpublished while a non-owner had a public link → view unavailable as per existing public rules; export not exposed.
- EC-3: Owner tries export after account deactivation mid-session → denied with authentication/account message.
- EC-4: Deep link to a hypothetical export route without owner session → no successful private export.

## Session & layout chrome

### US-003: Compose export layout with live preview

**As a** map owner, **I want** a WYSIWYG preview that reflects my export settings, **so that** I know what the file will look like before downloading.

Acceptance criteria:

- AC-1: Given export is open, when I change layout-affecting options (legend position, paper orientation when preview honors it, location inset count, title text), then the preview updates to show the composition (live and/or when I request preview refresh).
- AC-2: Given the preview, when I inspect it, then I see title area, main map, legend (when content exists), optional location insets, and institutional footer with logo.
- AC-3: Given “inside map” legend position, when I use drag/resize affordances where printJs provided them, then legend placement/size in the preview updates accordingly.

Edge cases:

- EC-1: Preview update while map tiles still loading → user sees loading state or incomplete basemap; export waits or warns rather than silent garbage.
- EC-2: Rapid successive option changes → UI converges to last selected options without permanent freeze.
- EC-3: Extremely long title → preview wraps or truncates in a readable way without overlapping footer indefinitely.
- EC-4: Legend with hundreds of items → preview scrolls and remains interactable; product may recommend PNG as in printJs guidance.

## Text & branding

### US-004: Title, authorship, fixed institutional footer

**As a** map owner, **I want** to set map title and credit lines while institutional REAT/FURG branding always appears, **so that** maps are both correctly attributed and institutionally recognizable.

Acceptance criteria:

- AC-1: Given export opens, when I inspect text fields, then title defaults to the map name, authorship is empty, and technical-responsible is empty; each is editable.
- AC-2: Given I type authorship and technical-responsible text, when the preview updates, then those lines appear in the credit areas of the composition.
- AC-3: Given any successful export, when I open the file, then fixed institutional footer content and REAT logo appear in the composition as product branding (not removed by clearing authorship fields).

Edge cases:

- EC-1: Empty title on export → allowed or blocked with clear validation; if allowed, composition has empty title region; product must define one consistent rule (default: allow empty title).
- EC-2: Extremely long authorship/technical lines → wrap within footer text region.
- EC-3: Special characters and quotes in title/authorship → export file and preview show them correctly.
- EC-4: User clears all credit fields → institutional footer and logo remain.

## Format & page quality

### US-005: Format, paper, orientation, DPI

**As a** map owner, **I want** to choose PNG or PDF, paper size, orientation, and DPI, **so that** the download matches my print or digital delivery need.

Acceptance criteria:

- AC-1: Given export settings, when I choose PNG or PDF, then the eventual download is of that type.
- AC-2: Given paper selection, when I choose A4, A3, or Letter with landscape or portrait, then export uses that page geometry for PDF (and equivalent frame sizing intent for PNG).
- AC-3: Given DPI input, when value is within 72–600, then export uses that quality; default is 300.
- AC-4: Given PDF choice with dense legend, when UI is shown, then the product surfaces the existing product guidance that PNG is preferred for maps with heavy legend content.

Edge cases:

- EC-1: DPI below 72 or above 600 → rejected or clamped with user-visible correction.
- EC-2: Non-numeric DPI entry → invalid input not applied; prior valid value retained.
- EC-3: A3 at 600 DPI on low-memory device → may fail; user sees failure message and can lower DPI and retry.
- EC-4: Switch format PNG↔PDF after configuring → settings retained across format switch within the session.

## Legend

### US-006: Position and format the legend

**As a** map owner, **I want** to place and format the legend, **so that** symbols remain readable for the paper size I chose.

Acceptance criteria:

- AC-1: Given export, when I select legend position inside, right, or bottom, then preview layout matches the position.
- AC-2: Given formatting controls, when I set columns 1–6, font size 8–18 px, and spacing from very compact through very loose, then legend presentation updates accordingly.
- AC-3: Given right-side legend, when resize-by-edge is available, then I can change legend width relative to the map (printJs parity).
- AC-4: Given layer symbols and names, when legend builds, then items reflect currently included export layers/groups with correct visual symbols.

Edge cases:

- EC-1: All thematic layers hidden and no location legend items → legend empty or hidden without error crash.
- EC-2: Six columns on narrow legend/panel → layout still readable, may reflow.
- EC-3: Font size 8 with very compact spacing and many items → dense but selectable; no uncontrolled overflow that blocks export actions.
- EC-4: Reorder/drag of legend items if offered by parity → order sticks until session end; cancel discards.

## Layers & basemap

### US-007: Control layers, labels, and basemap

**As a** map owner, **I want** to toggle layers and basemap for the export without losing the editor’s preparatory work, **so that** the printed map shows only what I need.

Acceptance criteria:

- AC-1: Given export opens from editor state, when I view layer controls, then visibility matches editor starting state and I can toggle layers for export.
- AC-2: Given I change basemap among OpenStreetMap, Carto light, and satellite, when preview updates, then the main map uses that basemap.
- AC-3: Given “show names on map” is off by default or per inheritance, when I enable it, then element names suitable for labeling appear on the export map preview/export.
- AC-4: Given I cancel export after changing export-only layer toggles, when I return to the editor, then my editor’s pre-export visibility/basemap are not permanently forced to export temporary choices (editor left consistent with pre-open or last intentional editor state).

Edge cases:

- EC-1: Toggle all layers off → empty thematic map permitted; basemap still renders.
- EC-2: Satellite basemap attribution remains reflected in fixed credit lines.
- EC-3: Labels on dense point clusters → labels may overlap; still exportable without crash.
- EC-4: Concurrent edits in another tab while export open → export uses the snapshot/session at open or last refresh; no silent corrupt download; product may export stale editor state for that session.

## Location insets

### US-008: Location inset maps and regional styles

**As a** map owner, **I want** zero, one, or two location inset maps with state/municipality context, **so that** readers can situate the main map in Brazil.

Acceptance criteria:

- AC-1: Given location maps control, when I choose none, one, or two insets, then preview shows the corresponding number of inset maps (or hides them).
- AC-2: Given one or two insets enabled, when I select state and optionally municipality, then insets update to show the selection and main-map context polygon behavior matches printJs intent (highlight region of interest).
- AC-3: Given location layers options, when I enable municipal mesh and/or add state to the legend, then mesh appears on the map and legend items update as specified.
- AC-4: Given color controls for state and municipality, when I change colors, then geometry styling and legend swatches update.

Edge cases:

- EC-1: Geographic data for municipalities unavailable or service error → clear error/empty state; export of main map without insets still possible or blocked with message that insets cannot load (product must not silent-fail incomplete political layers as if complete).
- EC-2: State selected without municipality when municipality is required by selected mode → prompts user to finish selection or proceeds with state-only as per mode rules mirroring printJs.
- EC-3: Two insets with same state → allowed; both show independently.
- EC-4: Municipal mesh with large vertex counts → may slow preview; UI shows progress; no uncaught failure.
- EC-5: Switch from two insets to none → location UI and layers turn off cleanly in preview.

## Map chrome

### US-009: Scale, north, graticule, decorative frame, labels interaction

**As a** map owner, **I want** cartographic chrome on the main export map equivalent to printJs, **so that** the map is orientation- and scale-readable.

Acceptance criteria:

- AC-1: Given export preview and download, when I inspect the main map, then a graphic scale bar is present and consistent with the preview scale.
- AC-2: Given export preview and download, when I inspect the main map, then a north indicator is present.
- AC-3: Given export preview and download, when I inspect the main map, then a graticule is present per printJs default behavior.
- AC-4: Given export composition, when I inspect the presentation, then the decorative frame treatment consistent with product/printJs branding is applied.
- AC-5: Labels toggle (US-007) composes with the above chrome without removing scale/north/graticule.

Edge cases:

- EC-1: Extreme zoom (very far / very close) → scale bar updates to a sensible unit/label set or remains readable.
- EC-2: Portrait vs landscape → chrome remains inside the map frame, not clipped out of composition permanently.
- EC-3: Export at low DPI → chrome remains legible enough for thumbnail use; high DPI remains sharp for print.

## Download

### US-010: Export file and failure recovery

**As a** map owner, **I want** to download the composed map as PNG or PDF with progress feedback, **so that** I receive a usable file or know how to recover.

Acceptance criteria:

- AC-1: Given valid settings, when I confirm export, then a loading state indicates generation is in progress and concurrent double-submit is prevented or safely ignored.
- AC-2: Given successful generation, when complete, then the browser receives a download of the selected format reflecting the last previewed composition.
- AC-3: Given generation failure (memory, capture error, incomplete render timeout), when it fails, then I see an understandable error and can retry after adjusting DPI or simplifying layout.
- AC-4: Given legend-heavy maps, when I choose PDF despite guidance, then export still attempts; success or failure is communicated honestly.

Edge cases:

- EC-1: Cancel/close while generating → generation aborts or result is discarded; no partial UI freeze; editor remains usable.
- EC-2: Retry after success → second file can be generated (action may be repeated).
- EC-3: Network loss mid-tile-load for basemap before capture → fail or wait with message; no successful export implying full basemap if tiles missing without warning.
- EC-4: Very long composition at max DPI → progress remains visible until success or failure.
- EC-5: Filename defaults sensibly from map title/name and format extension.

## Responsiveness

### US-011: Full composition UX on mobile

**As a** map owner on a phone, **I want** every export control reachable and the preview usable, **so that** I can finish export without a desktop.

Acceptance criteria:

- AC-1: Given a narrow viewport, when I open export, then controls stack or scroll and all option groups remain reachable (format, paper, legend, layers, location, colors).
- AC-2: Given mobile, when I update options, then I can still inspect a usable preview (scroll or scaled) before export.
- AC-3: Given mobile, when I export at moderate DPI, then download succeeds under normal conditions or fails with recovery guidance at extreme settings.

Edge cases:

- EC-1: Landscape phone vs portrait phone → both support full control access.
- EC-2: On-screen keyboard covering title field → field remains editable/scrollable into view.
- EC-3: Touch drag for legend resize/position when that interaction is part of parity → works with touch or an equivalent mobile-safe control.
- EC-4: Low-end device OOM at 600 DPI → error recovery (US-010), not silent blank download.

## Session lifecycle

### US-012: Close and cancel discard ephemeral config

**As a** map owner, **I want** export options discarded when I leave the export UI, **so that** each open starts from clean defaults plus current editor map state.

Acceptance criteria:

- AC-1: Given I change DPI, legend position, and insets, when I close/cancel export and reopen, then those options reset to product defaults and map state re-inherits from the editor at the new open time.
- AC-2: Given I export successfully, when I close export (or remain), then no server-side “print layout” is required to remain for reopening with the same options.
- AC-3: Given I only cancel, when returning to editor, then I continue editing the map without forced navigation away from the editor.

Edge cases:

- EC-1: Browser refresh mid-export UI → session options lost; user restarts export after reload (consistent with ephemeral rules).
- EC-2: Navigate away from editor mid-export UI → export UI tears down; options discarded.
- EC-3: Open export, change settings, background the mobile app briefly → session may keep in-memory state while still open; discarding only occurs on close/teardown, not arbitrary hide.
