---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: php/lib/Auth/AuthService.php
line: 293
severity: medium
author: claude-code
provider_ref:
---

# Issue 012: Login skips password_verify when user is missing

## Review Comment

`auth_login` only calls `password_verify` when `fetch_user_by_identifier` returns a row. A missing identifier fails faster than a wrong password, enabling timing-based username/email enumeration. Recovery paths intentionally return uniform messages; TechSpec risk notes call for uniform work on sensitive auth paths.

Suggested fix: when the user is null, still run `password_verify($password, $dummyBcryptHash)` against a constant valid bcrypt hash before returning the same `unauthenticated` error.

## Triage

- Decision: `valid`
- Notes:
  - Confirmed: `auth_login` used `$user === null || !password_verify(...)`, so PHP short-circuited and skipped `password_verify` when the identifier was missing. That makes missing-user responses faster than wrong-password responses and enables timing-based username/email enumeration despite the generic 401 message.
  - Root cause: boolean short-circuit on a null user before password verification.
  - Fix: introduce `AUTH_DUMMY_BCRYPT_HASH` (constant valid bcrypt) and always call `password_verify` against either the stored hash or the dummy hash before returning `unauthenticated`.

## Resolution

- Added `AUTH_DUMMY_BCRYPT_HASH` and restructured credential checking in `auth_login` so `password_verify` always runs.
- Extended `testUt023WrongPasswordGeneric401` to assert unknown identifiers return the same error code, status, and message as a wrong password (UT-023 contract).
