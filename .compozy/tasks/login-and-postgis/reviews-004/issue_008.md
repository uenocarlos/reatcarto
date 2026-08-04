---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: src/lib/AuthContext.jsx
line: 191
severity: high
author: claude-code
provider_ref:
---

# Issue 008: confirmLogoutDiscard wipes cache before server logout

## Review Comment

Reviews-001 issue 010 fixed `orchestrateLogout` to end the server session before clearing offline data. The Dashboard "Descartar e sair" path uses `confirmLogoutDiscard`, which still:

1. `await clearOfflineAccount()`
2. then `api.auth.logout()`
3. and only then clears React auth state

If logout returns 5xx/network error (non-401), the error is rethrown: the session cookie remains valid, React still shows the user as authenticated, and IndexedDB private maps/photos are already destroyed.

Suggested fix: route discard confirmation through `logout({ discardConfirmed: true })` / `orchestrateLogout` so server logout (when online) precedes cache wipe and React state stays consistent.

## Triage

- Decision: `VALID`
- Root cause: `confirmLogoutDiscard()` (AuthContext line 191) does not use `orchestrateLogout`. It unconditionally clears the offline store first, then calls server logout. Review-001 issue 010 fixed this exact ordering for the normal logout path, but the discard-branch codepath was left behind.
- Fix approach: Replace the body of `confirmLogoutDiscard()` with a call to `logout({ discardConfirmed: true })`, which already delegates to `orchestrateLogout` with `discardConfirmed` set. `orchestrateLogout` handles online → server logout first → offline clear last (with discard semantics when confirmed), offline-only → skip server call, and 401-tolerant cleanup. Ensure the return value from `logout()` is properly forwarded so callers still receive `{ success: true, discarded: true }` (or whatever orchestrateLogout produces when discard was confirmed — normalize if needed).
