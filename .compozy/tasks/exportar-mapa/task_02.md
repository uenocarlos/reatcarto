---
status: completed
title: Entrada no editor, shell do modal e sync client
type: frontend
complexity: medium
---

# Task 2: Entrada no editor, shell do modal e sync client

## Overview
Torna a composição de exportação descoberta e segura: botão Export no `MapEditor` do dono, abertura/fechamento de uma única instância do modal, remoção de PDF da UI de composição, hidratação a partir de `export_settings` e persistência debounced com flush no close/export. Também garante que rotas públicas e não-donos nunca montam o fluxo de composição.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST expose a visible Export action in the map editor header for the authenticated owner of `/editor/:mapId`.
2. MUST open a single `ExportMapModal` instance (`showExport` idempotent); Cancel/dismiss MUST return to the editor without calling PNG generation.
3. MUST remove PDF as an output choice from the composition UI (PNG-only per ADR-003).
4. MUST hydrate modal state from the current map's `export_settings` (normalized) and MUST NOT leak settings across `mapId` switches.
5. MUST debounce persist of settings via settings-only map update and MUST flush pending saves on modal close and before/on export attempt.
6. MUST keep Export disabled or show clear loading when `mapData` is not ready; missing `mapId` MUST NOT mount a broken modal.
7. MUST ensure `PublicMapView`, Gallery, and non-owner paths never offer this composition export control; crafted access MUST remain denied.
8. SHOULD surface session/ownership loss while modal is open by disabling export actions with a clear message.
9. MUST rely on task_01 helpers (`normalizeExportSettings`, gates module) rather than reimplementing defaults/gates.
</requirements>

## Subtasks
- [x] 2.1 Add Export control in `MapEditor` header and wire `setShowExport(true)`
- [x] 2.2 Ensure single-instance open/cancel behavior and no PNG call on dismiss
- [x] 2.3 Remove PDF branch/UI from composition export path in modal and handler wiring
- [x] 2.4 Hydrate settings from map payload; isolate store/state by `mapId`
- [x] 2.5 Wire debounced PATCH + flush on close/export using task_01 helpers
- [x] 2.6 Guard open-before-load, empty elements still open, and ownership-lost while open
- [x] 2.7 Verify public/gallery/non-owner surfaces have no composition export control
- [x] 2.8 Implement assigned Vitest component/integration cases for entry, auth, and reopen restore

## Implementation Details
`MapEditor.jsx` already imports `ExportMapModal` and holds `showExport`, but never sets it true; GeoJSON export remains separate. Composition `handleExport` still contains jsPDF — strip from this feature path (PNG delivery completion is task_05; this task removes PDF choice and keeps shell wiring compatible). Reference TechSpec Component Overview and Build Order steps 3 and 10 (persist flush).

### Relevant Files
- `src/page/MapEditor.jsx` — `showExport`, modal mount, header actions, `handleExport` / GeoJSON sibling
- `src/components/map/ExportMapModal.jsx` — existing modal shell (options + preview columns)
- `src/lib/export/exportSettings.js` — normalize/gates/debounce from task_01
- `src/api/apiClient.js` — `api.entities.Map.update` / get for hydrate
- `src/page/PublicMapView.jsx` — confirm no export composition control
- `src/page/Gallery.jsx` — confirm no export composition control
- `src/components/ui/dialog.jsx` — Dialog primitives used by modal
- `tests/js/public.test.js` — public surface regression patterns
- `tests/js/maps.test.js` — maps API client test patterns

### Dependent Files
- `src/components/map/export/*` — may be extracted later in task_03; keep shell stable for that split
- `src/lib/offline/OfflineStore.js` — reopen offline with mirrored settings (IT-004)

### Related ADRs
- [ADR-001: Single Composition Flow for Field and Report Use](adrs/adr-001.md) — one export flow
- [ADR-003: Owner-Only PNG Export from the Map Editor](adrs/adr-003.md) — owner-only; PNG-only UI
- [ADR-004: Live Preview and Per-Map Persistence of Export Settings](adrs/adr-004.md) — hydrate + persist
- [ADR-007: Server-Backed export_settings with IndexedDB Mirror](adrs/adr-007.md) — debounce/flush client wiring

## Deliverables
- Discoverable Export button for owners in the editor
- Modal open/cancel with PNG-only format list and hydrated settings
- Debounced settings sync + flush on close
- Public/non-owner denial verified
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-001, UT-002, UT-003, UT-004, UT-005, UT-006, UT-007 — open/cancel, invalid mapId, empty elements, double-open, load gating, mapId isolation
- [x] UT-008, UT-009, UT-010 — public/gallery absence of control; `canOpenExport` false for non-owner
- [x] IT-001, IT-002, IT-003, IT-004, IT-005, IT-006 — editor button, large element open, session 401, offlineDB offline open, cancel/reopen restore, ownership lost while open
- [x] IT-007, IT-008, IT-009, IT-010, IT-011, IT-012, IT-013, IT-014, IT-015 — public/anonymous/crafted/non-owner/unpublish/retry/login-without-ownership/moderated denials
- [x] IT-016, IT-017, IT-018, IT-019, IT-020, IT-022, IT-023, IT-024 — non-owner cannot edit metadata/legend/tags (shared modal access assertion)
- [x] IT-026, IT-029, IT-031, IT-032, IT-034 — non-owner cannot change basemap/location/page/preview (shared denial)
- [x] IT-035, IT-046, IT-048, IT-049 — reopen from server settings; flush on unmount; many maps isolation; non-owner never successful PNG path
- [x] E2E-001, E2E-002, E2E-016 — owner open/cancel journey; anonymous no export; per-map restore isolation

## Success Criteria
- Every assigned test case implemented and passing
- Owner can open export from the editor; cancel produces no file
- Format options exposed by composition UI equal `['png']` only at the shell level (full exporter tests in task_05)
- Settings for map A never appear when opening export for map B
- Public routes mount zero composition export controls
