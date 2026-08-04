---
status: completed
title: "Export shell, MapEditor wiring, access gates, download UX, and mobile"
type: frontend
complexity: critical
---

# Task 3: Export shell, MapEditor wiring, access gates, download UX, and mobile

## Overview
Completes the product path: owner-only export entry in the map editor, ephemeral shell with full control groups and debounced WYSIWYG preview, single-flight PNG/PDF download with progress and recovery, cancel isolation from editor state, public-surface absence of export, and full mobile control reachability. Depends on task_01 pure libraries and task_02 composition components to deliver end-to-end owner journeys.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST lift basemap to controlled (or snapshot-readable) state from `LeafletMap` into `MapEditor` so open inherits viewport, hiddenIds, and basemap (ADR-006).
2. MUST show a single discoverable Export entry only in owner `MapEditor` (`/editor/:mapId`); MUST NOT add export composition controls to `Gallery`, `PublicMapView`, or dashboard surfaces (ADR-002).
3. MUST open `ExportMapShell` once (double-open does not spawn a second independent session); close/cancel discards ephemeral options and remount reopen recomputes defaults + fresh editor snapshot (ADR-003).
4. MUST initialize session via task_01 factories from editor snapshot (map name → title, hiddenIds, basemap, center/zoom, elements freeze at open).
5. MUST provide control groups: texts, format PNG/PDF, paper, orientation, DPI, legend position/format, layers, labels, basemap, location insets (0–2), mesh/colors; dense-legend PNG preference copy when legend is heavy or PDF selected per product rule.
6. MUST debounce preview layout sync with optional explicit refresh (ADR-010); rapid option storms converge to last values.
7. MUST run generation through task_01 `generateExport` with single-flight lock, progress UI, empty-title validation before capture, recoverable errors (memory/tiles), abort on close, retry after success allowed, filename from title + extension.
8. MUST leave editor basemap/hiddenIds unchanged by export-only toggles after Cancel (session isolation).
9. MUST keep auth failure paths consistent with product (expired session blocks private export) without exposing private elements through anonymous public APIs for composition.
10. MUST deliver mobile layout: all control groups reachable at ~390×844 and landscape phone; touch-safe legend metrics (numeric fallback); title field remains operable with on-screen keyboard patterns.
11. MUST implement and pass every assigned IT and E2E case in `## Tests` (Vitest/RTL journey equivalents when Playwright is absent).
</requirements>

## Subtasks
- [x] 3.1 Lift basemap state: `LeafletMap` controlled basemap prop + editor ownership of basemap for snapshot
- [x] 3.2 Build `EditorExportSnapshot` at open and mount single `ExportMapShell`
- [x] 3.3 Implement Export entry control in MapEditor header/chrome (Portuguese product copy)
- [x] 3.4 Implement controls panel wiring all session fields to task_01 setters
- [x] 3.5 Wire composition preview (task_02) with debounced sync + optional refresh action
- [x] 3.6 Implement export/download action: title gate, single-flight, progress, error recovery, abort on close
- [x] 3.7 Enforce cancel discard + reopen inheritance; isolate editor visibility/basemap from export-only edits
- [x] 3.8 Verify Gallery/PublicMapView/dashboard remain free of export entry; no private compose deep-link route
- [x] 3.9 Mobile responsive pass for shell (stack/scroll controls + inspectable preview)
- [x] 3.10 Dense-legend PNG preference guidance copy
- [x] 3.11 Implement assigned integration and E2E-level tests for owner/public journeys

## Implementation Details
Follow TechSpec architecture diagram (`MapEditor` → `ExportEntry` → `ExportMapShell`), ADR-002/003/005/006/008/010/011, and sequencing steps 4 + 8–10. UI system: shadcn/Radix `dialog`, `button`, `input`, `label`, `select`, `radio-group`, `slider`, `scroll-area`, `checkbox` from `src/components/ui/*`; toasts via `sonner` if product errors use them. Data already loaded by editor (`api.entities.Map` / elements) — shell consumes props/snapshot only; do not call public gallery element endpoints for private owner maps. Do **not** restore PHP `export_settings` column flows from prior HEAD; session is client-only.

### Relevant Files
- `src/page/MapEditor.jsx` — header actions, map/elements queries, hiddenIds; add Export entry + shell
- `src/components/map/LeafletMap.jsx` — basemap lift (currently internal state in work tree)
- `src/components/map/ElementLayersPanel.jsx` — basemap radio may need controlled wiring
- `src/page/PublicMapView.jsx`, `src/page/Gallery.jsx`, `src/page/DashBoard.jsx` — must remain export-free
- `src/App.jsx` — route table; no stand-alone private export route
- `src/lib/AuthContext.jsx`, `src/components/ProtectedRoute.jsx` — owner session context
- `src/components/ui/dialog.jsx` and form controls — shell chrome
- `src/components/map/export/*` — composition from task_02
- `src/lib/export/*` — session/generate/geo from task_01
- `.compozy/tasks/exportar-mapa/_user_stories.md` — US-001–US-012 AC

### Dependent Files
- `src/components/map/ExportMapShell.jsx` (or `ExportMapModal.jsx` renamed to TechSpec shell) — create
- `src/components/map/export/ExportControlsPanel.jsx` — create
- `src/components/map/ExportEntry.jsx` (optional extraction) — create if separation helps
- `src/page/MapEditor.jsx` — modify
- `src/components/map/LeafletMap.jsx` — modify (controlled basemap)
- `src/components/map/ElementLayersPanel.jsx` — modify if basemap lift requires
- `tests/js/exportShell*.test.jsx`, `tests/js/exportEntry*.test.jsx`, `tests/js/exportAccess*.test.jsx` — ITs/E2E harnesses

### Related ADRs
- [ADR-002: Owner-only export from the map editor](adrs/adr-002.md) — single entry, no public export
- [ADR-003: Ephemeral export session configuration](adrs/adr-003.md) — discard on close
- [ADR-005: Full mobile parity for export composition UX](adrs/adr-005.md) — phone complete controls
- [ADR-006: Inherit editor map state into export session](adrs/adr-006.md) — viewport/layers/basemap
- [ADR-008: Client-side capture with html-to-image and jsPDF](adrs/adr-008.md) — generate UX single-flight
- [ADR-010: Debounced live preview with optional explicit refresh](adrs/adr-010.md) — shell preview policy
- [ADR-011: Non-empty title required for download](adrs/adr-011.md) — shell validation UX

## Deliverables
- Owner editor export control opening a single ephemeral shell
- Full composition controls + debounced preview + download PNG/PDF with progress/errors
- Editor state isolation on cancel; reopen resets to defaults + fresh inheritance
- No export on public/gallery surfaces
- Mobile-reachable control groups
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

### Entry, shell, auth
- [x] IT-001, IT-002, IT-003, IT-004, IT-005 — open shell empty map, blank title, auth block, single session, large list scroll
- [x] IT-020, IT-021 — public/gallery no export control; no private compose path without owner queries

### Preview, branding, format, generation UX
- [x] IT-010, IT-011, IT-012, IT-013, IT-014, IT-015, IT-016, IT-017 — preview sync, tiles fail, dense PNG hint, footer, empty title, filename, format retention, memory recovery

### Layers / cancel isolation
- [x] IT-022, IT-023, IT-024, IT-025 — layer toggles, cancel keeps editor basemap, labels export mock ok, open-snapshot freeze

### Download lifecycle
- [x] IT-050, IT-051, IT-052 — single-flight, abort on close, retry after success

### Mobile
- [x] IT-060, IT-061 — narrow/landscape control groups; title field operable

### Session lifecycle
- [x] IT-070, IT-071, IT-072, IT-073 — cancel discards, remount clears singleton, unmount aborts, document-hidden keeps in-memory while open

### End-to-end journeys
- [x] E2E-001, E2E-002, E2E-003, E2E-004, E2E-005, E2E-006, E2E-007, E2E-008, E2E-009 — owner open/cancel, auth, public absence, composition chrome, PNG/PDF download, cancel isolation, insets, mobile export, reload resets DPI

## Success Criteria
- Every assigned test case implemented and passing
- Export control exists only for owner editor and opens one shell
- Cancel discards options and does not permanently force export-only editor visibility/basemap
- Download path shows progress, blocks double generate, recovers on failure, requires non-empty title
- Gallery and public map views have zero export composition entry points
- Mobile viewport can reach all control groups and export at moderate DPI under mocked tiles
