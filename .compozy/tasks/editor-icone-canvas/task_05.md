---
status: completed
title: "IconCanvasEditor P1 multi-select/history and P2 triangle"
type: frontend
complexity: medium
---

# Task 5: IconCanvasEditor P1 multi-select/history and P2 triangle

## Overview
Extends the Fabric icon editor with P1 multi-select group transforms, undo/redo, eraser, and clear canvas, plus the P2 triangle tool. Builds only on the P0 editor from task_04 without changing the library API contract.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST support multi-select (marquee and/or shift-click) with group move/resize/rotate.
2. MUST implement undo/redo via Fabric JSON snapshots on gesture completion; new edit after undo clears redo branch; empty undo stack is a no-op.
3. MUST add eraser and clear-canvas; clear does not call `api.icons.*`; empty canvas after clear still blocks confirm.
4. MUST add triangle shape tool (P2) with non-degenerate geometry handling.
5. MUST enable triangle entry only when P2 is shipped (remove P0 hide from task_04).
6. SHOULD keep selection-only changes out of history when avoidable (per the selection-history policy case in Tests).
7. MUST implement and pass every assigned test case in the Tests section.
</requirements>

## Subtasks
- [x] 5.1 Add multi-select + group transform behavior
- [x] 5.2 Add undo/redo snapshot stack and toolbar/shortcuts
- [x] 5.3 Add eraser tool and clear canvas action
- [x] 5.4 Add triangle tool with degenerate guard
- [x] 5.5 Expose P1/P2 controls in editor chrome
- [x] 5.6 Implement assigned UT/E2E cases

## Implementation Details
Modify the IconCanvasEditor introduced in task_04. Follow TechSpec P1/P2 sections and ADR-004 priority tiers. Prefer Fabric `ActiveSelection` for multi-select and mouse-up history commits (ADR-005).

### Relevant Files
- `src/components/map/iconEditor/IconCanvasEditor.jsx` (or path from task_04) — extend
- `src/lib/icons/iconExport.js` — emptiness still applies after clear
- `.compozy/tasks/editor-icone-canvas/_techspec.md` — P1/P2 behavior
- `adrs/adr-004.md`, `adrs/adr-005.md`

### Dependent Files
- StylePanel — only if tool visibility flags need parent props (prefer keep inside editor)
- `tests/js/` — P1/P2 editor tests

### Related ADRs
- [ADR-004: Limits and Priority Tiers](adrs/adr-004.md) — P1/P2 scope
- [ADR-005: Fabric.js](adrs/adr-005.md) — history/snapshot approach

## Deliverables
- P1 multi-select, undo/redo, eraser, clear in the icon editor
- P2 triangle tool
- Every test case assigned in the Tests section implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-050, UT-051, UT-052, UT-053 — multi-select behaviors
- [x] UT-054, UT-055, UT-056, UT-057 — undo/redo and clear interaction
- [x] UT-058, UT-059, UT-060 — eraser, empty eraser, clear does not hit API
- [x] UT-061, UT-062 — triangle create and degenerate handling
- [x] E2E-015, E2E-016 — P1 tools journey; P2 triangle journey

## Success Criteria
- Every assigned test case implemented and passing
- P1 tools usable on desktop editor without regressing P0 confirm/export
- Triangle available and safe against zero-area shapes
