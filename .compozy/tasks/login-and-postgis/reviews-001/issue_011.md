---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: tests/js/admin.test.js
line: 4
severity: medium
author: claude-code
provider_ref:
---

# Issue 011: Assigned test IDs missing or hollow vs _tests.md

## Review Comment

Task 05 marks UT-127, IT-056, and IT-067 complete, but those IDs do not appear anywhere under `tests/php` or `tests/js`. Contract behaviors (public inspect network vs 404 distinction; concurrent publish visibility; dense public element list usability) are therefore unverified.

Additionally, `tests/js/admin.test.js` implements UT-135 and UT-155 as hollow stubs: a local `Promise.resolve({ success: true })` and a hardcoded Portuguese string match, without exercising admin UI/API or delete-account unsynced-warning wiring. Task 06 claims these cases; they do not assert contracted behavior.

Suggested fix: implement real PHP/Vitest coverage for UT-127, IT-056, and IT-067 per `_tests.md`, and replace UT-135/UT-155 with tests that hit admin response handling and Profile/delete copy + outbox warning paths.

Also missing/hollow references: task_05.md Tests section; `tests/js/admin.test.js`.

## Triage

- Decision: `valid`
- Notes:
  - **UT-135 / UT-155 (in scope):** Confirmed hollow stubs in `tests/js/admin.test.js`. UT-135 used `Promise.resolve({ success: true })` without hitting `api.admin.setUserStatus`; UT-155 matched a hardcoded Portuguese string instead of exercising outbox discard confirmation or delete-account API wiring. Replaced with Vitest tests that mock `fetch`, call `api.admin.setUserStatus` / `api.auth.deleteAccount`, assert success flags stay false until the authoritative response resolves, and assert `orchestrateLogout` returns `needsDiscardConfirm` when unsynced outbox rows exist offline.
  - **UT-127 / IT-056 / IT-067 (valid, out of batch code scope):** These IDs belong in `tests/php` (public inspect network vs 404, concurrent publish, dense public elements) and are still absent from the suite. This batch's `<batch_scope>` limits code edits to `tests/js/admin.test.js` only; PHP coverage for those IDs requires a separate remediation batch.

## Resolution

- Replaced hollow UT-135/UT-155 stubs in `tests/js/admin.test.js` with real client tests against `apiClient` and `logoutFlow`.
- UT-127, IT-056, IT-067 remain open for a PHP-focused review batch.
