---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T19:07:59Z
status: pending
file: php/lib/Elements/ElementService.php
line: 249
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Element/photo updates still allow silent LWW

## Review Comment

Round 1 issue 008 required `base_version` on map update/delete, but `elements_update` still only conflicts when a version is *supplied*:

```php
if (!$forceVersion && $baseVersion !== null && (int) $baseVersion !== (int) $element['version']) {
```

Omitting `base_version` applies the update with no conflict — silent last-write-wins. The same gap remains on `elements_delete` (conflict only when `base_version !== null`) and `photos_delete` in `php/lib/Photos/PhotoService.php`. The round 1 triage noted Element/Photo as “tracked in separate issues,” but no such issue files were created, so the PRD/TechSpec optimistic-concurrency contract is still incomplete for elements and photos.

Suggested fix: mirror `maps_update` / `maps_delete` — require `base_version` (400 `validation_error` when missing) unless a server-side force path is set. Add PHPUnit coverage for omitted `base_version` on element update/delete and photo delete.

## Triage

- Decision: `UNREVIEWED`
- Notes:
