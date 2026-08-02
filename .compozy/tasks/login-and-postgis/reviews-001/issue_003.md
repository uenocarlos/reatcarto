---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: src/lib/sync/SyncEngine.js
line: 150
severity: critical
author: claude-code
provider_ref:
---

# Issue 003: Local conflict choice does not reapply local payload

## Review Comment

`SyncEngine.resolveConflict(clientMutationId, choice, baseVersion)` calls `api.sync.resolveConflict` without loading the outbox row or conflict `local_snapshot`. `apiClient` defaults `mutation` to `{}`.

On the server (`php/lib/Sync/SyncService.php` `sync_resolve`), `choice === 'local'` merges an empty payload into `elements_update` / `maps_update`. With `force_version` (elements) or a matching version, the update can succeed while changing nothing — the remote state remains authoritative despite the user choosing Local. That violates ADR-003 / TechSpec explicit conflict resolution (no silent discard of the chosen side).

Suggested fix: load the outbox/conflict record by `client_mutation_id` and pass `{ resource_type, op, resource_id, payload }` (from outbox or `local_snapshot`) in the resolve body. For maps, also set `force_version` on the local-apply path (see related map resolve gap).

Also affected: `src/api/apiClient.js`, `src/page/MapEditor.jsx` (ConflictResolutionModal handler), `php/lib/Sync/SyncService.php`.

## Triage

- Decision: `valid`
- Root cause: `SyncEngine.resolveConflict` forwarded only `(clientMutationId, choice, baseVersion)` to `api.sync.resolveConflict`, so the fourth `mutation` argument defaulted to `{}`. The server therefore received no `resource_type`, `resource_id`, or `payload` for local resolution and applied an empty merge — a silent discard of the user's local choice.
- Fix applied: Added `_buildResolveMutation` in `SyncEngine.js` to load the outbox row by `client_mutation_id` and, for `choice === 'local'`, merge `local_snapshot` from the stored conflict when the outbox payload is empty. `resolveConflict` now passes the built mutation object to the API client.
- Out of scope note: Map local-resolve still lacks `force_version` on the server (`SyncService.php` line 319). Elements already set `force_version = true`. A separate server-side fix may be needed if map conflict resolution with version mismatch is observed; the client-side mutation payload fix is the critical path for this issue.
- Tests: Added UT-087 coverage in `tests/js/offline.test.js` for outbox payload forwarding and `local_snapshot` fallback.

## Resolution

Verified with `npm run lint`, `npm run typecheck`, `npm run test` (73/73 pass), and `npm run build` (exit 0).
