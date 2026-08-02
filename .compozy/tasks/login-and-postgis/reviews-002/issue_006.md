---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T19:07:59Z
status: resolved
file: php/lib/Admin/AdminService.php
line: 109
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Admin can deactivate self with no last-admin guard

## Review Comment

`admin_set_user_status` accepts `deactivate` for any target user id with no check that the target is not the acting admin, and no check that at least one other active admin remains. Combined with session revocation on deactivate, an administrator can lock themselves (or the sole admin) out. Recovery then depends entirely on re-running `php/bin/seed_admin.php` with env credentials — fragile for production ops given ADR-011’s “no self-elevation” model.

Suggested fix:

1. Reject deactivation when `target.id === admin.id` (or require a second admin confirmation path).
2. Before deactivating a user with `role = admin`, ensure another active admin exists; otherwise return 400 with a clear code/message.
3. Cover both cases in `AdminApiTest.php`.

## Triage

- Decision: `valid`
- Root cause: `admin_set_user_status` performed deactivation for any target without checking self-deactivation or whether the target is the sole remaining active administrator, then revoked sessions — allowing operational lockout inconsistent with ADR-011.
- Fix: before a non-idempotent deactivate, reject when `target.id === admin.id` and when the target is an active admin with no other active admins in the database; return `validation_error` (400) with explicit field messages.
- Tests: added `testAdminCannotDeactivateSelf` and `testCannotDeactivateLastActiveAdmin` in `AdminApiTest.php`.

## Resolution

- `admin_set_user_status` now rejects non-idempotent deactivation when the target is the acting administrator or when the target is the sole remaining active administrator.
- Added regression tests covering self-deactivation and stale-session last-admin lockout attempts.
- Verification: `composer test` (269/269 pass), `npm run lint`, `npm run typecheck`, `npm test` (405/405 pass).
