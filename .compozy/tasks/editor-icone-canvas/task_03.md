---
status: completed
title: "api.icons client and StylePanel icon library"
type: frontend
complexity: medium
---

# Task 3: api.icons client and StylePanel icon library

## Overview
Adds the browser client for the icons API and the StylePanel “Meus ícones” section so authors can list, apply, and soft-remove library icons (and clear customs when picking built-ins) without yet shipping the Fabric drawing modal.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST add `api.icons.{list,create,remove,url}` in `apiClient.js` per TechSpec (multipart create, POST remove).
2. MUST load the owner library in StylePanel and render “Meus ícones” with apply + remove actions and optional empty state.
3. MUST set `custom_icon_url` to the selected icon `url` on apply (preview via existing `onPreview`/`updateStyle`).
4. MUST clear `custom_icon_url` to `''` when the user picks a built-in icon or uses clear-custom control (fix today’s sticky-URL bug).
5. MUST guard list/remove (and create, when called) with online connectivity checks; offline → explicit error, no fake success.
6. MUST NOT implement the Fabric canvas editor in this task (entry button may be deferred to task_04); library UI MUST still work on mobile.
7. MUST leave generic file-upload stub out of scope (non-goal); drawing flow is task_04.
8. MUST implement and pass every assigned test case in the Tests section.
</requirements>

## Subtasks
- [x] 3.1 Implement `api.icons` wrappers and URL helper
- [x] 3.2 Add shared icon constants consumed by client (name fallback / max length as needed for apply UX)
- [x] 3.3 Build StylePanel “Meus ícones” list UI (thumb, name, apply, remove)
- [x] 3.4 Wire apply → `custom_icon_url`; remove → `api.icons.remove` + refresh list
- [x] 3.5 Fix built-in icon click and clear-custom to reset `custom_icon_url`
- [x] 3.6 Online-only guards for library mutations with user-visible errors
- [x] 3.7 Implement assigned unit/E2E cases with mocked API

## Implementation Details
Depends on task_01 API. Follow TechSpec **api.icons**, ADR-002, ADR-006, ADR-009 (online-only). Touch `StylePanel.jsx` icon section near existing `POINT_ICONS` grid. Reuse `connectivity` helper from offline lib. Do not add Fabric dependency here.

### Relevant Files
- `src/api/apiClient.js` — `api.media` pattern to mirror for `api.icons`
- `src/api/http.js` — `apiFetch` / FormData behavior
- `src/components/map/StylePanel.jsx` — icon picker, stub upload, custom preview
- `src/lib/offline/connectivity.js` — online check
- `.compozy/tasks/editor-icone-canvas/_techspec.md` — client contracts

### Dependent Files
- `src/lib/icons/constants.js` — create if shared constants land here
- `tests/js/` — new tests for api.icons + StylePanel library helpers

### Related ADRs
- [ADR-002: Per-User Icon Library](adrs/adr-002.md) — library UX rules
- [ADR-006: user_icons API + soft-remove](adrs/adr-006.md) — client URL contract
- [ADR-009: Desktop gate + online-only library](adrs/adr-009.md) — online-only mutations

## Deliverables
- Working `api.icons` client
- StylePanel library apply/remove with online guards
- Built-in selection clears custom URL
- Every test case assigned in the Tests section implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-023, UT-041, UT-042, UT-043 — empty library, built-in clears URL, clear custom, large list smoke
- [x] UT-070, UT-071, UT-072 — url helper, FormData create, remove error surfacing
- [x] E2E-004, E2E-011, E2E-012, E2E-013 — mobile/library visible, reuse apply, built-in replace, soft-remove keeps point URL

## Success Criteria
- Every assigned test case implemented and passing
- User can apply and remove library icons from StylePanel when online
- Selecting a built-in clears `custom_icon_url` while leaving the library entry intact
