---
status: completed
title: "Publication and anonymous public gallery"
type: frontend
complexity: medium
---

# Task 5: Publication and anonymous public gallery

## Overview
Lets owners publish/unpublish maps and exposes a searchable anonymous gallery with read-only map/element/photo inspection that always rechecks publication state. Completes the public discovery journey without granting edit, export, or download to visitors.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST implement owner `publish.php` / `unpublish.php` with confirmation for empty maps and clear public-exposure warning copy.
2. MUST implement `php/public/maps|map|elements|photo` returning only published, non-moderated maps of active owners; private/unpublished/moderated → 404 without leaks.
3. MUST add anonymous routes `/gallery` and `/gallery/:publicId` without requiring auth.
4. MUST provide read-only public map UI (no edit/export/geo download controls); owner Dashboard shows publish badges and gallery link.
5. MUST recheck publication on every public GET (no stale gallery trust).
6. MUST allow anonymous photo GET only when the owning map is currently public-eligible.
7. MUST implement and pass every assigned test case in `## Tests`, including E2E-008 photo-through-publish flow.
</requirements>

## Subtasks
- [x] 5.1 Implement publish/unpublish endpoints and api.entities.Map.publish/unpublish
- [x] 5.2 Implement public list/search/get/elements/photo PHP endpoints with visibility recheck
- [x] 5.3 Add api.public facade methods
- [x] 5.4 Build Gallery search/browse page with empty and pagination states
- [x] 5.5 Build PublicMapView read-only route reusing Leaflet without owner toolbars
- [x] 5.6 Wire Dashboard publish/unpublish UX, badges, and gallery entry point
- [x] 5.7 Hide export/edit affordances on public surfaces
- [x] 5.8 Implement assigned UT/IT/E2E cases for US-012–US-014 plus public photo cases

## Implementation Details
Follow TechSpec Public API, ADR-002. Moderation fields exist from schema but admin moderation UI/actions are task_06 — public filters must already honor `moderated_at` when set. Photo public eligibility builds on task_03 `photos/get.php` / `public/photo.php`.

### Relevant Files
- `src/App.jsx` — add public routes
- `src/page/DashBoard.jsx` — publish controls and gallery link
- `src/page/MapEditor.jsx`, `src/components/map/ExportMapModal.jsx` — hide on public
- `src/components/map/LeafletMap.jsx` — read-only consumption
- `src/api/apiClient.js` — add public + publish methods
- `.compozy/tasks/login-and-postgis/_techspec.md` — public endpoints
- `.compozy/tasks/login-and-postgis/adrs/adr-002.md`

### Dependent Files
- `php/maps/publish.php`, `unpublish.php` — create
- `php/public/maps.php`, `map.php`, `elements.php`, `photo.php` — create
- `src/page/Gallery.jsx`, `src/page/PublicMapView.jsx` — create
- `src/App.jsx`, `src/page/DashBoard.jsx`, `src/page/MapEditor.jsx`, `src/api/apiClient.js` — modify

### Related ADRs
- [ADR-002: Private Ownership with Anonymous Public Maps](adrs/adr-002.md) — private default; anonymous read-only gallery
- [ADR-009: Filesystem Photo Storage with Controlled URLs](adrs/adr-009.md) — public photo GET rules

## Deliverables
- Owner publish/unpublish with warnings and badges
- Anonymous gallery + public map viewer
- Public APIs that recheck visibility every request
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-066 — public photo GET when map published and not moderated
- [x] UT-106, UT-107, UT-108, UT-109, UT-110, UT-111, UT-112, UT-113 — publish/unpublish defaults, authz, empty confirm, client optimism guard
- [x] UT-114, UT-115, UT-116, UT-117, UT-118, UT-119, UT-120, UT-121 — gallery list/search/empty/XSS-safe q/offline freshness
- [x] UT-122, UT-123, UT-124, UT-125, UT-126, UT-127, UT-128 — public inspect read-only, 404 states, idempotent GET
- [x] IT-038 — photo authz including anonymous read only if public
- [x] IT-051, IT-052, IT-053, IT-054, IT-055, IT-056 — publish permissions, races, idempotency, owner deactivate/delete → public 404
- [x] IT-057, IT-058, IT-059, IT-060, IT-061 — gallery never leaks private; recheck after unpublish; direct public_id; scale
- [x] IT-062, IT-063, IT-064, IT-065, IT-066, IT-067 — dense public geometry, anonymous mutate deny, live owner updates, visibility flips
- [x] IT-094 — public map.php contract checklist
- [x] E2E-008 — attach photo → publish → anonymous photo → remove → 404
- [x] E2E-012, E2E-013, E2E-014 — publish/unpublish, gallery search, read-only inspect

## Success Criteria
- Every assigned test case implemented and passing
- New maps remain private until explicit publish
- Anonymous visitors never receive edit/export/download capabilities
- Unpublish, moderation flag, deletion, or owner deactivation yields public 404 on next access
