---
status: completed
title: "IconCanvasEditor P0 and confirm save/apply"
type: frontend
complexity: high
---

# Task 4: IconCanvasEditor P0 and confirm save/apply

## Overview
Delivers the desktop-only Fabric drawing modal (P0 tools), PNG export validation, and confirm path that uploads to the icon library and applies `custom_icon_url` to the point in one step. This completes the primary create journey once bitmap rendering and the library client exist.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST add Fabric.js dependency and lazy-load `IconCanvasEditor` only when opening “Desenhar ícone”.
2. MUST gate the draw entry with `canUseIconCanvasEditor()` (`pointer: fine` and width ≥ 768); otherwise show desktop-required copy (no editor).
3. MUST provide P0 tools: pencil, rectangle, circle, line, color, stroke width; single-object select/move/resize/rotate; Delete/Backspace and toolbar delete for selection.
4. MUST always open a blank 256×256 canvas; cancel/dismiss discards draft with no library/point mutation; closing StylePanel while open acts as cancel.
5. MUST block confirm when canvas has no drawable content; reject over ~200KB with message; normalize optional name (fallback/`MAX_ICON_NAME_LENGTH`).
6. MUST on successful confirm call `api.icons.create` then set point `custom_icon_url` to returned `url` (save+apply); on auth/network/offline failure MUST NOT apply URL or append library optimistically as success.
7. MUST disable confirm while in-flight to prevent duplicate creates (or use `client_mutation_id`).
8. MUST hide triangle / P1 tools in this P0 slice (covered by the P0 triangle-hidden case in Tests).
9. MUST implement and pass every assigned test case in the Tests section.
</requirements>

## Subtasks
- [x] 4.1 Add `fabric` dependency and `desktopCapability` + `iconExport` helpers with constants
- [x] 4.2 Build `IconCanvasEditor` P0 canvas/tools/selection/delete
- [x] 4.3 Wire StylePanel “Desenhar ícone” entry (gate + lazy modal + remount token)
- [x] 4.4 Implement confirm: validate → upload → updateStyle/library refresh; cancel/offline/401 paths
- [x] 4.5 Ensure empty/oversize confirm UX and in-flight disable
- [x] 4.6 Implement assigned UT/E2E cases (Fabric doubles / RTL as appropriate)

## Implementation Details
Depends on task_02 (visible colored apply) and task_03 (`api.icons` + library section). Follow TechSpec Build Order steps 4–6, ADR-005, ADR-004, ADR-009. Prefer `src/components/map/iconEditor/IconCanvasEditor.jsx` or TechSpec path `IconCanvasEditor.jsx` under map components — stay consistent with imports from StylePanel.

### Relevant Files
- `src/components/map/StylePanel.jsx` — entry point wiring
- `src/api/apiClient.js` — `api.icons.create` from task_03
- `src/lib/offline/connectivity.js` — offline confirm guard
- `package.json` — add `fabric`
- `.compozy/tasks/editor-icone-canvas/_techspec.md` — editor + export contracts
- `adrs/adr-005.md`, `adr-004.md`, `adr-009.md`

### Dependent Files
- `src/lib/icons/desktopCapability.js` — create
- `src/lib/icons/iconExport.js` — create
- `src/lib/icons/constants.js` — create/extend
- `src/components/map/iconEditor/IconCanvasEditor.jsx` (or agreed path) — create
- `tests/js/desktopCapability.test.js`, `iconExport.test.js`, editor RTL tests — create

### Related ADRs
- [ADR-004: Limits and Priority Tiers](adrs/adr-004.md) — P0 scope and limits
- [ADR-005: Fabric.js](adrs/adr-005.md) — canvas engine
- [ADR-009: Desktop gate + online-only library](adrs/adr-009.md) — capability and offline

## Deliverables
- Desktop P0 drawing editor with save+apply to library and point
- Mobile/narrow: no editor entry (library remains from task_03)
- Every test case assigned in the Tests section implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-001, UT-002 — desktop capability gate
- [x] UT-010, UT-011, UT-012, UT-013, UT-014, UT-015, UT-016 — iconExport empty/size/name
- [x] UT-020, UT-021, UT-022 — StylePanel editor entry / remount / mobile hint
- [x] UT-024, UT-025, UT-026, UT-027, UT-028, UT-029, UT-030 — P0 tools and transforms
- [x] UT-031, UT-032, UT-033, UT-034 — auth/network/offline confirm; delete selected
- [x] UT-063 — triangle hidden in P0
- [x] E2E-001, E2E-002, E2E-003, E2E-005, E2E-006, E2E-007, E2E-008, E2E-009, E2E-010 — open/cancel/confirm journeys

## Success Criteria
- Every assigned test case implemented and passing
- Desktop user can draw, confirm, see icon on point/library; empty/oversize/offline/401 fail safely
- Editor never loads Fabric on gated-off viewports via entry hide + lazy import
