---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: src/lib/AuthContext.jsx
line: 90
severity: medium
author: claude-code
provider_ref:
---

# Issue 010: Login/hydrate never rebinds OfflineStore after orphaned meta

## Review Comment

`bindAccount()` runs only inside `prepareMap`, after `assertAccess()`. `checkUserAuth` / `login` call `api.offline.setUserId(...)` but never clear or rebind IndexedDB `meta.currentUserId`.

If a prior session expires without logout, meta remains bound to user A. User B’s login sets the in-memory user id, then every offline access throws `cross_user`, and `prepareOffline` also fails because assert runs before bind. This breaks account isolation recovery required by task_04 / US-011.

Suggested fix: on successful `me()` / login, if bound user ≠ current user, clear the previous account’s offline data (or prompt) and `bindAccount()` for the new user. Clear orphaned meta on 401 auth hydrate failures.

## Triage

- Decision: `VALID`
- Root cause: `checkUserAuth()` (line 83) and `login()` (line 141) invoke `api.offline.setUserId(currentUser.id)` but never call `OfflineStore.bindAccount()` or handle a prior user's stale metadata. `OfflineStore.bindAccount()` is only called from `prepareMap()`. So transitions: user A logs in (setUserId in memory, meta stays null or unchanged), user A does not prepare a map (no bind), session expires. User B logs in: in-memory userId is B's id, meta still A's (or null). Any subsequent `assertAccess` throws cross_user if meta bound to A. `prepareMap` → assertAccess before bindAccount throws.
- Fix approach: After successful auth in both `checkUserAuth()` and `login()`, instantiate the OfflineStore (or equivalent via `storeForUser`), read `getBoundUserId()`. If bound exists and bound ≠ currentUser.id: call `clearAccountData()` for the prior bound user (or a safe equivalent that removes scoped data belonging to the other account) then `bindAccount()` for currentUser. If bound is null: simply call `bindAccount()`. On 401 from `checkUserAuth` (unauthenticated hydration): also clear orphaned meta if any.
