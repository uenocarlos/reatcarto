---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: php/photos/get.php
line: 15
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Private photo GET skips session registry checks

## Review Comment

`php/photos/get.php` authenticates owners via `current_user_id()` + `fetch_user_by_id()` and then `photo_can_read()`, which grants access whenever the cookie user id matches `owner_id`. It never calls `require_valid_session()`, so it skips `sessions_registry` validation and account-status checks used by every other private endpoint.

After password change, global session revocation, or deactivation, a stale PHP session cookie can still stream private photo bytes. ADR-007 requires credential and lifecycle events to invalidate sessions effectively; this route bypasses that gate. Anonymous public eligibility is separate and correctly handled by `map_is_public_eligible`.

Suggested fix: for the owner path, resolve the user through `require_valid_session()` (or an equivalent that checks registry + non-deactivated status) before serving private bytes; keep anonymous access only via public eligibility / `photos_serve_public`.

## Triage

- Decision: `VALID`
- Root cause: `php/photos/get.php` calls `current_user_id()` (which reads raw session) and `fetch_user_by_id()`, but never invokes `require_valid_session()`. This skips the `sessions_registry` presence check and `status !== 'deactivated'` guard that all other authenticated endpoints use.
- Fix approach: If `$userId !== null`, use `require_valid_session()` instead of `current_user_id()` + manual `fetch_user_by_id()`; that helper already validates registry presence, checks account status, and returns the user row. The anonymous/public path (null user) continues through `photos_serve`'s `map_is_public_eligible` check unchanged.
