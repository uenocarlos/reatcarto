---
provider: manual
pr:
round: 3
round_created_at: 2026-08-02T21:15:18Z
status: resolved
file: tests/php/Public/PublishPublicTest.php
line: 330
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: UT-127, IT-056, IT-067 still missing vs _tests.md

## Review Comment

Round 1 issue 011 fixed hollow UT-135/UT-155 stubs but recorded UT-127, IT-056, and IT-067 as still absent and out of that batch. They remain unimplemented: `PublishPublicTest.php` jumps from `testIt055…` to `testIt057…` (no IT-056), has UT-126/UT-128 but no UT-127, and has IT-062 dense-geometry pagination but no IT-067. No matching IDs appear under `tests/js` for the public-inspect contract either (the only `UT-127` string in the suite is an unrelated export-preview case).

Per `_tests.md` / task_05:

- **UT-127**: public inspect network failure distinguishes retryable unavailable from 404 deleted.
- **IT-056**: many concurrent publishes — each map once; visibility owner-specific.
- **IT-067**: 100× elements — viewport/progressive public list remains usable.

Task 05 still marks these complete, so contract behaviors stay unverified.

Suggested fix: add PHPUnit (and client coverage if needed) that assert the contracted behaviors and name the tests with the IDs so suite search matches `_tests.md`.

## Triage

- Decision: `valid`
- Notes:
  - Confirmed: `PublishPublicTest.php` skipped UT-127 (between UT-126/UT-128), IT-056 (between IT-055/IT-057), and IT-067 (only IT-062 with 60 elements existed). Task 05 marked these complete without matching test method names or contracted behaviors.
  - **UT-127:** Server must return definitive `not_found` 404 on deleted/unpublished maps so clients can distinguish from retryable `network_error` (status 0). Added PHP assertions on map/elements GET after delete and unpublish.
  - **IT-056:** Added multi-owner publish fixture verifying each published map appears once in gallery, private maps excluded, and deactivated owner maps hidden while other owners remain visible.
  - **IT-067:** Added 100-element public elements list pagination test with non-overlapping pages and geojson on each row for viewport use.

## Resolution

- Added `testUt127DeletedMap404DistinctFromUnavailable`, `testIt056ManyConcurrentPublishesEachMapOnceOwnerSpecific`, and `testIt067HundredElementsPublicListUsable` to `tests/php/Public/PublishPublicTest.php`.
- Verification: `php -l tests/php/Public/PublishPublicTest.php` (OK). `npm run lint`, `npm run typecheck`, `npm test` (405/405, exit 0). `composer test` / targeted PHPUnit cannot complete in this environment due to pre-existing PostgreSQL test DB infra (`citext` missing after `PostgisTestCase::resetDatabase()` — same failure documented in reviews-003 issues 001–003; unrelated to this batch).
