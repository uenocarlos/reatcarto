---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: src/lib/offline/logoutFlow.js
line: 83
severity: medium
author: claude-code
provider_ref:
---

# Issue 010: Logout wipes offline data before server session ends

## Review Comment

`orchestrateLogout` calls `clearAccountData()` before `serverLogoutFn()`. If the server logout fails with a network/`ApiError` whose `status !== 401`, the error is rethrown. `AuthContext.logout` then never clears `user` / `isAuthenticated`, but IndexedDB private cache is already gone while the HttpOnly session cookie may still be valid.

The user is left half-logged-out: server session alive, local offline workspace destroyed, React still authenticated until a full reload/`me` failure.

Suggested fix: prefer server logout first when online; treat network/5xx logout failures as soft success for local auth teardown after wipe; or clear React auth state even when `serverLogoutFn` throws after `clearAccountData`.

## Triage

- Decision: `valid`
- Root cause: `clearAccountData()` ran before `serverLogoutFn()`, so a non-401 server logout failure left IndexedDB wiped while `AuthContext.logout` rethrew and kept React auth state.
- Fix: when online, call `serverLogoutFn()` first; only call `clearAccountData()` after server logout succeeds or returns 401 (expired session). Non-401 failures now rethrow before any local wipe, preserving offline cache and auth consistency.
- Verification: added `UT-099b` asserting network logout failure preserves prepared maps; existing `UT-099` still passes (401 clears after server attempt).
