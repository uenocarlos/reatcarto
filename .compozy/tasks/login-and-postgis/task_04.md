---
status: completed
title: "Offline store, sync engine, and safe logout"
type: frontend
complexity: critical
---

# Task 4: Offline store, sync engine, and safe logout

## Overview
Adds account-bound IndexedDB caching and mutation outbox, server sync with explicit two-snapshot conflict resolution, and logout that never silently discards pending work. Completes the field-offline promise while keeping Capacitor tile offline separate from map feature data.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST implement `src/lib/offline/` OfflineStore (IndexedDB via `idb`) keyed by user id for prepared maps, elements, photos metadata, outbox, and conflict records.
2. MUST implement SyncEngine + `php/sync/push.php` and `resolve.php` applying `SyncMutation[]` with `client_mutation_id` idempotency and returning `SyncConflict` snapshots (never silent LWW).
3. MUST support prepareOffline, offline edit/create/delete as visible pending, unavailable state for non-prepared maps, and quarantine when remote delete is detected.
4. MUST surface per-item synced|failed|conflicted status, progress, and dependent ordering (e.g. photo after element create).
5. MUST implement safe logout: attempt sync when online; require explicit discard confirmation when pending cannot sync; clear all account-bound IndexedDB keys; prevent cross-user cache reads.
6. MUST wire Dashboard/MapEditor badges and conflict UI; `api.sync` and `prepareOffline` on the facade.
7. MUST NOT treat `tileManager.js` / OfflineTileModal as the map-data store — keep tile cache separate.
8. MUST implement and pass every assigned test case in `## Tests`.
</requirements>

## Subtasks
- [x] 4.1 Build OfflineStore schema: cache, outbox, conflicts, account scoping, quota errors
- [x] 4.2 Implement prepareOffline and offline open/edit paths in Dashboard/MapEditor
- [x] 4.3 Implement SyncEngine flush/apply/reduceConflicts + api.sync client methods
- [x] 4.4 Implement php/sync/push and resolve with version checks and idempotency table
- [x] 4.5 Build conflict resolution UI presenting local vs remote snapshots
- [x] 4.6 Implement logout orchestration (sync → confirm discard → clear → session end)
- [x] 4.7 Ensure cross-user isolation and restart recovery of pending outbox
- [x] 4.8 Implement assigned UT/IT/E2E cases for US-009–US-011 plus offline-shared cases from maps/photos

## Implementation Details
Follow TechSpec OfflineStore/SyncEngine, `SyncMutation`/`SyncConflict` typedefs, ADR-003, ADR-010. Online CRUD from task_03 remains source of truth when connected; outbox only authoritative for pending local ops until server ack.

### Relevant Files
- `src/api/apiClient.js` — add sync + prepareOffline; retire remaining local authority assumptions
- `src/lib/AuthContext.jsx` — logout must orchestrate offline clear
- `src/page/MapEditor.jsx`, `src/page/DashBoard.jsx` — offline badges and prepare actions
- `src/lib/tileManager.js`, `src/components/map/OfflineTileModal.jsx` — tiles only; do not merge with OfflineStore
- `capacitor.config.json` — WebView cookie considerations for sync auth
- `.compozy/tasks/login-and-postgis/_techspec.md` — sync API and outbox design
- `.compozy/tasks/login-and-postgis/adrs/adr-003.md`, `adr-010.md`

### Dependent Files
- `src/lib/offline/OfflineStore.js` (and helpers) — create
- `src/lib/sync/SyncEngine.js` (and conflict reducers) — create
- `php/sync/push.php`, `php/sync/resolve.php` — create
- `src/components/map/ConflictResolutionModal.jsx` — create
- `src/api/apiClient.js`, `src/lib/AuthContext.jsx`, `src/page/MapEditor.jsx`, `src/page/DashBoard.jsx` — modify
- OfflineStore/SyncEngine Vitest suites — create

### Related ADRs
- [ADR-003: Account-Bound Offline Editing and Explicit Conflict Resolution](adrs/adr-003.md) — offline edits, conflicts, safe logout
- [ADR-007: Cookie-Based PHP Sessions and Multi-Device Policy](adrs/adr-007.md) — session validity during sync
- [ADR-010: IndexedDB Outbox with Optimistic Conflict Snapshots](adrs/adr-010.md) — outbox + two-snapshot conflicts

## Deliverables
- Account-bound IndexedDB cache and outbox
- Sync push/resolve with explicit conflict choice UI
- Safe logout with sync-or-confirm-discard semantics
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-054, UT-062, UT-070 — offline map/element/photo queue behaviors deferred from online CRUD
- [x] UT-071, UT-072, UT-073, UT-074, UT-075, UT-076, UT-077, UT-078, UT-079, UT-080, UT-081, UT-082, UT-083, UT-084 — prepareOffline, pending edits, unavailable maps, account isolation, quota, recovery
- [x] UT-085, UT-086, UT-087, UT-088, UT-089, UT-090, UT-091 — sync push, conflicts, resolve, idempotency, dependent ordering
- [x] UT-092, UT-093, UT-094, UT-095, UT-096, UT-097, UT-098, UT-099, UT-100, UT-101, UT-102, UT-103, UT-104, UT-105 — logout sync/discard/clear, concurrency, deactivation mid-logout
- [x] UT-164, UT-165 — OfflineStore enqueue and cross-user reject
- [x] UT-166, UT-167 — SyncEngine conflict reduce; api client rate_limited mapping
- [x] IT-044, IT-045, IT-046, IT-047, IT-048, IT-049, IT-050 — batch push progress, authz mid-sync, multi-device, disconnect, replay, delete conflicts, scale
- [x] IT-093 — sync/push endpoint contract checklist
- [x] E2E-009, E2E-010, E2E-011 — offline edit, conflict resolution, safe logout journeys

## Success Criteria
- Every assigned test case implemented and passing
- No silent last-write-wins on true conflicts
- After logout, another account cannot read prior private cache
- Pending operations survive app restart and do not duplicate on retry
