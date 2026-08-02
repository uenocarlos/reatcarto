---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: php/lib/Maps/MapService.php
line: 258
severity: high
author: claude-code
provider_ref:
---

# Issue 008: Updates without base_version allow silent LWW

## Review Comment

`maps_update` only compares optimistic versions when `base_version !== null`. If the client omits `base_version`, the update always applies and increments `version` — last-write-wins with no conflict. The same pattern exists in `elements_update` (`php/lib/Elements/ElementService.php` ~247) and deletes that only conflict when `base_version` is sent.

TechSpec requires optimistic `version` concurrency so concurrent edits surface as conflicts rather than silent overwrite. Online client paths usually send `base_version`, but sync resolve, malformed clients, or direct API calls can omit it and bypass the contract.

Suggested fix: require `base_version` on update/delete (400 `validation_error` when missing), except for explicit `force_version` paths used by conflict resolution and admin mutate. Align Element and Photo delete/update the same way.

Also affected: `php/lib/Elements/ElementService.php`, `php/lib/Photos/PhotoService.php`.

## Triage

- Decision: `valid`
- Root cause: `maps_update` and `maps_delete` treated a missing `base_version` as "skip optimistic check", allowing silent last-write-wins overwrites and deletes without version validation.
- Fix: Require `base_version` on both mutators unless `force_version` is set (admin/conflict-resolution bypass). When `base_version` is present and mismatched, return 409 conflict. Added regression tests in `MapsCrudTest.php` and updated existing map CRUD tests to pass `base_version`.
- Out of scope: Element and Photo services share the same pattern but are tracked in separate review issues; only `MapService.php` was in this batch scope.
