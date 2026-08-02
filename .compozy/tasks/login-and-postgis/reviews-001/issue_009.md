---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: php/lib/Sync/SyncService.php
line: 314
severity: medium
author: claude-code
provider_ref:
---

# Issue 009: Map local conflict resolve omits force_version

## Review Comment

For `choice === 'local'` on elements, `sync_resolve` sets `force_version = true` before `elements_update`. The map branch calls `maps_update` without `force_version`, so a stale `base_version` yields another 409 conflict loop instead of applying the user's Local choice.

Suggested fix: set `$applyInput['force_version'] = true` on the map local-apply path (mirroring elements), after ownership checks, and ensure the mutation payload is present (see issue 003).

## Triage

- Decision: `valid`
- Root cause: In `sync_resolve`, the element local-apply path sets `$applyInput['force_version'] = true` before `elements_update`, but the map update path called `maps_update` without that flag. With a stale `base_version`, `maps_update` returns 409 and the user's Local choice never applies.
- Fix: Set `$applyInput['force_version'] = true` before `maps_update` in the map local-apply branch, mirroring elements. Added `testLocalChoiceAppliesMapUpdateWithStaleBaseVersion` in `SyncResolveTest.php`.
