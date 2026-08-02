---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: php/lib/Sync/SyncService.php
line: 174
severity: high
author: claude-code
provider_ref:
---

# Issue 006: Sync push lacks publish and unpublish map ops

## Review Comment

TechSpec `SyncMutation.op` includes `publish` and `unpublish`. `sync_apply_map` only handles `create|update|delete` and rejects other ops as unsupported. Online publish/unpublish exist via `php/maps/publish.php` and `unpublish.php`, but there is no offline/outbox path for publication changes.

Field users who toggle publication offline (or enqueue publish via sync) cannot complete that mutation through the sync contract.

Suggested fix: add `publish` / `unpublish` cases that call `maps_publish` / `maps_unpublish` with `client_mutation_id` and the same confirmation rules (`confirm_empty`, etc.). Wire client enqueue for offline publish if the UI allows it while offline, or document and enforce online-only with a clear UX — but the server sync surface should still match the TechSpec ops list.

## Triage

- Decision: `valid`
- Root cause: `sync_apply_map` only dispatched `create|update|delete`, so TechSpec ops `publish` and `unpublish` returned `Unsupported map operation` even though `maps_publish` / `maps_unpublish` already implement idempotency, ownership checks, and `confirm_empty`.
- Fix: add `publish` / `unpublish` cases in `sync_apply_map` delegating to `maps_publish` / `maps_unpublish` with the merged sync input (includes `client_mutation_id`, `id`, and payload fields such as `confirm_empty`). Mirror the same ops in `sync_resolve` local-choice replay so conflict resolution stays consistent with push.
- Tests: extend `SyncPushTest` with publish/unpublish happy path, empty-map confirmation, and client_mutation_id idempotency.

## Resolution

- `sync_apply_map` now dispatches `publish` / `unpublish` to `maps_publish` / `maps_unpublish` with merged sync input (`client_mutation_id`, `id`, payload fields such as `confirm_empty`).
- `sync_resolve` local-choice replay mirrors the same ops before the generic `maps_update` path.
- Added `SyncPushTest` coverage: `testSyncPushMapPublishAndUnpublish`, `testSyncPushMapPublishEmptyRequiresConfirmEmpty`, `testSyncPushMapPublishEmptyWithConfirmEmpty`, `testSyncPushMapPublishIdempotentByClientMutationId`.
- Verification: `composer test` (243/243 pass), `npm run lint`, `npm run typecheck`, `npm test` (79/79 pass).
