---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: php/lib/Sync/SyncService.php
line: 264
severity: high
author: claude-code
provider_ref:
---

# Issue 004: sync_resolve remote choice skips ownership checks

## Review Comment

When `choice === 'remote'`, `sync_resolve` loads a map or element by id and returns the full serialized record (including GeoJSON and photo metadata) without `assert_map_owner` / `assert_element_owner`.

Any authenticated active user who knows (or guesses) another user's resource UUID can POST `/php/sync/resolve.php` and read private map/element data. Other private CRUD paths correctly enforce ownership; this path does not.

Suggested fix: after fetch, assert ownership (return `not_found` for non-owners, matching the rest of the API). Prefer resolving from the stored conflict / `client_mutations` row for that user rather than trusting arbitrary `resource_id` in the body.

## Triage

- Decision: `valid`
- Root cause: `sync_resolve` with `choice === 'remote'` fetched maps/elements by arbitrary `resource_id` from the request body without calling `assert_map_owner` / `assert_element_owner`, allowing any authenticated user to read another user's private GeoJSON and photo metadata.
- Fix: After fetch, call `assert_map_owner($user, $map)` and `assert_element_owner($user, $element, true)` so non-owners receive `not_found` (404), consistent with private read paths like `maps_get`.
- Verification: Added `tests/php/Sync/SyncResolveTest.php` with owner success and cross-user denial cases; ran full pipeline (`composer test`, `npm run lint`, `npm run typecheck`, `npm test`).
