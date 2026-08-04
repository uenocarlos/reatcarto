---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T19:07:59Z
status: resolved
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

- Decision: `valid`
- Root cause: The review snapshot showed the old conditional (`$baseVersion !== null && …`) that skipped optimistic locking when `base_version` was omitted, allowing silent last-write-wins on element update/delete.
- Fix approach: Mirror `maps_update` / `maps_delete` — reject missing `base_version` with 400 `validation_error` unless `force_version` is set; compare versions and return 409 on mismatch.
- Resolution: `elements_update` and `elements_delete` in `php/lib/Elements/ElementService.php` already enforce the contract (lines 247–261 and 355–368), matching `MapService.php`. Regression coverage exists in `tests/php/Elements/ElementsCrudTest.php` (`testIt038UpdateRequiresBaseVersion`, `testIt039DeleteRequiresBaseVersion`). No code changes were required in this batch.
- Out of scope: `photos_delete` in `PhotoService.php` was mentioned in the review comment but is not in this batch's code-file scope; track separately if still open.
- Verification: `npm run lint`, `npm run typecheck`, and `npm test` passed (405/405). `composer test` could not complete in this environment because PostgreSQL lost `citext` after test schema resets (257/269 errors, all `PDOException` during migration setup — pre-existing local DB infra, unrelated to this fix). Prior rounds on a healthy PostGIS test DB report 269/269 pass with the same tests.
