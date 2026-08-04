---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: php/lib/Maps/MapService.php
line: 675
severity: medium
author: claude-code
provider_ref:
---

# Issue 011: publish/unpublish skip base_version optimistic concurrency

## Review Comment

`maps_update` / `maps_delete` require `base_version` and return 409 on mismatch. `maps_publish` and `maps_unpublish` always apply `version = version + 1` with no base check. Two devices (or an offline publish op racing an online rename) can flip public visibility via silent last-write-wins — the same OCC gap previously closed for map content mutations.

Suggested fix: require `base_version` (400 if absent, 409 if mismatch) on publish/unpublish; allow a trusted `$forceVersion` bypass only for `sync_resolve` / admin paths. Wire `base_version` through client publish/unpublish and sync payload.

## Triage

- Decision: `VALID`
- Root cause: `maps_publish()` (MapService line 328) and `maps_unpublish()` (line 400) accept `$input`, fetch the map, assert owner, and run UPDATE `version = version + 1` without validating `base_version`. Only `maps_update` and `maps_delete` currently enforce OCC. Publish/unpublish are semantically mutations that can race with rename/offline-republish.
- Fix approach:
  1. Add optional `bool $forceVersion = false` parameter to both `maps_publish` and `maps_unpublish`.
  2. When `!$forceVersion`, require `$baseVersion = $input['base_version'] ?? null` to be non-null (400 if absent) and match `(int)$map['version']` (409 conflict if not).
  3. In `sync_apply_map` for ops `publish`/`unpublish`, forward `$baseVersion` properly and rely on `sync_resolve` path using `forceVersion = true` (the same pattern used for `maps_update` and `maps_delete`).
  4. Update client `api.entities.Map.publish` / `Map.unpublish` in `apiClient.js` to accept `baseVersion` and include it in body; wire it through the UI call sites.
