# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Implemented account-bound IndexedDB OfflineStore, SyncEngine, PHP sync push/resolve, safe logout orchestration, Dashboard/MapEditor offline UI, and ConflictResolutionModal.

## Important Decisions

- Single active account binding via `meta.currentUserId`; cross-user reads throw `cross_user` (ADR-010 account isolation).
- Outbox collapse prefers `delete` over prior pending `update` for same resource (UT-082).
- Logout re-checks remaining unsynced after sync attempt before clearing (fixed stale `unsynced` snapshot bug).
- Photo upload sync remains multipart via `photos/upload.php`; sync push rejects photo create without multipart (photos queue offline with `depends_on`).
- `force_version` flag on element/map update enables local-wins resolve path.

## Learnings

- Vitest needs `fake-indexeddb/auto` setup + explicit DB delete/close in `resetOfflineDbForTests()` between tests.
- PHPUnit test bootstrap must require `SyncService.php` separately from app bootstrap.
- Missing element update via sync returns `conflict` (delete_update), not `failed` — IT-044 expects any non-synced status.

## Files / Surfaces

- `src/lib/offline/*`, `src/lib/sync/SyncEngine.js`, `php/lib/Sync/SyncService.php`, `php/sync/*.php`
- `src/api/apiClient.js`, `src/lib/AuthContext.jsx`, `src/page/DashBoard.jsx`, `src/page/MapEditor.jsx`
- `src/components/map/ConflictResolutionModal.jsx`
- `tests/js/offline.test.js`, `tests/js/sync.test.js`, `tests/php/Sync/SyncPushTest.php`

## Errors / Corrections

- Logout returned `needsDiscardConfirm` after successful sync because initial `unsynced` array was reused — fixed with post-sync re-fetch.
- `collapseOutboxForResource` used last-created row only; delete after edit lost — fixed to prefer delete op.

## Ready for Next Run

- task_05: publish/unpublish + public photo GET (UT-066); offline/sync foundation complete.
