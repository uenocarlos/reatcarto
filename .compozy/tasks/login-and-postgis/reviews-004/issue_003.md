---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: php/lib/Sync/SyncService.php
line: 401
severity: high
author: claude-code
provider_ref:
---

# Issue 003: sync_resolve has no photo conflict branch

## Review Comment

`sync_apply_photo` can persist a conflict for `photos_delete` (409 → `sync_conflict_store`), but `sync_resolve` only handles `element` and `map`. For `resource_type === 'photo'`:

- `choice=remote` falls through to `Cannot resolve remote choice`
- `choice=local` falls through to `Unsupported resolve target`

Offline photo deletes that conflict with a remote change become permanently stuck in the outbox/conflict store. This is the same class of gap previously fixed for map/element resolve paths.

Suggested fix: add a `photo` branch — remote returns the current owned snapshot (or deleted state) and marks the mutation synced; local delete re-applies via `photos_delete(..., true)` (trusted resolve force). Cover with a PHPUnit resolve test for photo delete conflicts.

## Triage

- Decision: `VALID`
- Root cause: `sync_resolve()` (line 347) has explicit `if ($resourceType === 'element' ...)` and `if ($resourceType === 'map' ...)` branches for both `choice === 'remote'` and `choice === 'local'`, but no `'photo'` branch. Any stored conflict with `resource_type === 'photo'` hits the fallback `auth_fail` at line 401 (remote) or line 490 (local).
- Fix approach: Add a `photo` branch for `choice=remote` that looks up the photo by `resource_id`, asserts owner, returns the current snapshot via `format_photo_record` (or `deleted:true` if 404), and marks synced. For `choice=local` + `op === 'delete'` call `photos_delete($user, $applyInput, true)`. For other ops, apply via trusted force path as appropriate. Update sync_resolve helper appropriately.
