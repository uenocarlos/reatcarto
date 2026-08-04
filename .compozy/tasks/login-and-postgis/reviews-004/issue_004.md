---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: php/lib/Auth/AuthService.php
line: 622
severity: high
author: claude-code
provider_ref:
---

# Issue 004: Last admin can hard-delete own account

## Review Comment

`admin_set_user_status` blocks self-deactivation and deactivating the last active administrator. `auth_delete_account` has no equivalent guard: after password + phrase validation it calls `delete_user_and_data($userId)` unconditionally.

The sole active admin can permanently delete their own account and leave the system with zero administrators until `php/bin/seed_admin.php` is re-run with env credentials. That is an operational lockout path the deactivation guards were meant to prevent.

Suggested fix: before delete, if the user is an admin and `COUNT(*)` of other active admins is zero, reject with `validation_error` (mirror the wording/structure used in `AdminService`). Add a PHPUnit case covering the last-admin self-delete rejection.

## Triage

- Decision: `VALID`
- Root cause: `auth_delete_account()` (AuthService line 594) validates password + confirmation phrase and calls `delete_user_and_data()` without checking whether the user is the sole active admin. `admin_set_user_status()` (in AdminService) has both the self-block and the last-admin-count check, so deactivation is guarded while permanent deletion (a stronger action) is not.
- Fix approach: After password validation in `auth_delete_account`, check if the user's role is `admin`. If so, run a `COUNT(*)` of users where `role = 'admin' AND status = 'active' AND id != :selfId`. If the count is 0, reject via `auth_fail('validation_error', ..., 400, ...)` with a message mirroring `AdminService`'s wording. Place this check right before invoking `delete_user_and_data`.
