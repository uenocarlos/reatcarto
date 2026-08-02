---
status: completed
title: "Private online maps, elements, and photos"
type: backend
complexity: high
---

# Task 3: Private online maps, elements, and photos

## Overview
Replaces localStorage map persistence with ownership-scoped PostGIS CRUD for maps and elements plus filesystem photo storage, and wires Dashboard/MapEditor to real HTTP while online. Offline queuing and public gallery flows are out of scope here except for private photo authorization foundations.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST implement `php/maps/*` list/get/create/update/delete with owner isolation, private-by-default maps, allocated `public_id`, and `version` + `client_mutation_id` idempotency via `client_mutations`.
2. MUST implement `php/elements/*` create/update/delete/list with GeoJSON ↔ PostGIS SRID 4326, reject invalid geometry, cascade photo cleanup on element delete.
3. MUST implement `php/photos/upload|delete|get` with JPEG/PNG/WebP, 5 MB / 10-per-element limits, UUID filenames under uploads root, and deny anonymous private photo reads.
4. MUST swap `api.entities.Map` / `MapElement` and add `api.media` to real `fetch` + credentials; stop using `reatcarto_local_*` localStorage as authority.
5. MUST update Dashboard and MapEditor React Query flows for server lists, empty states, and element CRUD; StylePanel must use `api.media` (not missing `api.integrations`).
6. MUST enforce verified-active ownership on every mutator; non-owner/private IDs return 404/403 without leaking bodies.
7. MUST respect operational limits (100 maps/user, 5000 elements/map, vertex caps) with explicit errors — no silent truncation.
8. MUST implement and pass every assigned test case in `## Tests` (offline outbox and public photo gallery cases belong to later tasks).
</requirements>

## Subtasks
- [x] 3.1 Implement maps CRUD PHP with ownership, public_id, versioning, idempotency
- [x] 3.2 Implement elements CRUD with GeoJSON codec and validation
- [x] 3.3 Implement photos upload/delete/authorized get on filesystem
- [x] 3.4 Wire apiClient entities + media to HTTP; remove localStorage authority for maps/elements
- [x] 3.5 Update DashBoard for server-backed list/search/create/rename/delete + empty CTA
- [x] 3.6 Update MapEditor online element CRUD with version fields
- [x] 3.7 Migrate StylePanel photo attach/preview/remove to api.media with progress/errors
- [x] 3.8 Implement assigned UT/IT/E2E cases for online US-006–US-008 plus geo/photo shared cases

## Implementation Details
Follow TechSpec maps/elements/photos endpoints, limits table, ADR-005, ADR-008, ADR-009. Deprecate legacy root PHP map/element scripts for client use. Leave publish/unpublish and public routes to task_05; leave OfflineStore enqueue paths to task_04 even if stubs are needed for compile.

### Relevant Files
- `src/api/apiClient.js` — localStorage entities to replace
- `src/page/DashBoard.jsx` — React Query maps workspace
- `src/page/MapEditor.jsx` — element CRUD mutations
- `src/components/map/StylePanel.jsx` — broken UploadFile stub → media API
- `src/components/map/LeafletMap.jsx` — GeoJSON consumer
- `php/criar_mapa.php`, `listar_mapas.php`, `get_mapa.php`, `deletar_mapa.php` — legacy maps
- `php/listar_elementos.php`, `salvar_elementos.php`, `deletar_elemento.php` — legacy `social` table
- `.compozy/tasks/login-and-postgis/_techspec.md` — maps/elements/photos contracts
- `.compozy/tasks/login-and-postgis/adrs/adr-009.md` — filesystem photos

### Dependent Files
- `php/maps/list.php`, `get.php`, `create.php`, `update.php`, `delete.php` — create
- `php/elements/list.php`, `create.php`, `update.php`, `delete.php` — create
- `php/photos/upload.php`, `delete.php`, `get.php` — create
- `uploads/` — create writable root
- `src/api/apiClient.js`, `src/page/DashBoard.jsx`, `src/page/MapEditor.jsx`, `src/components/map/StylePanel.jsx` — modify
- `tests/php/` maps/elements/photos contract tests — create

### Related ADRs
- [ADR-002: Private Ownership with Anonymous Public Maps](adrs/adr-002.md) — private default ownership
- [ADR-005: Durable Geospatial Records and Complete Account Deletion](adrs/adr-005.md) — PostGIS authority
- [ADR-008: Versioned Normalized PostgreSQL/PostGIS Schema](adrs/adr-008.md) — version columns, SRID 4326
- [ADR-009: Filesystem Photo Storage with Controlled URLs](adrs/adr-009.md) — disk binaries + authz GET

## Deliverables
- Owner-only online map/element/photo CRUD against PostGIS + filesystem
- Dashboard and MapEditor operating without localStorage authority
- StylePanel uploads via media API with limit feedback
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-047, UT-048, UT-049, UT-050, UT-051, UT-052, UT-053 — map create/list/get/rename/delete, isolation, validation, limits (online)
- [x] UT-055, UT-056, UT-057, UT-058, UT-059, UT-060, UT-061, UT-063 — element GeoJSON CRUD, ownership, invalid geom, vertex limits, client ordering
- [x] UT-064, UT-065, UT-067, UT-068, UT-069 — photo upload/delete, type/size/count rejection (private path)
- [x] UT-162, UT-163 — GeoJSON/PostGIS validation and round-trip
- [x] UT-171 — private photo GET denied to anonymous
- [x] IT-027, IT-028, IT-029, IT-030, IT-031, IT-032 — map authz, concurrency, idempotency, pagination
- [x] IT-033, IT-034, IT-035, IT-036, IT-037 — element authz, version conflicts, idempotency, delete conflicts, scale
- [x] IT-039, IT-040, IT-041, IT-042, IT-043 — photo conflicts, partial upload, idempotency, orphan prevention, progressive load
- [x] E2E-006, E2E-007 — create/manage maps; capture/edit/delete elements online

## Success Criteria
- Every assigned test case implemented and passing
- Knowing another user's map/element/photo id never returns private content
- Invalid geometry and oversized photos are rejected before becoming authoritative
- Dashboard empty workspace offers create CTA; MapEditor persists to server while online
