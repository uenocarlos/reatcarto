---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: src/lib/AuthContext.jsx
line: 75
severity: critical
author: claude-code
provider_ref:
---

# Issue 002: Outbox flush only runs during logout

## Review Comment

`SyncEngine.flush()` is invoked only from `orchestrateLogout` via `AuthContext.logout`. Login does not flush. `onConnectivityChange` in `src/lib/offline/connectivity.js` is never wired. `MapEditor` and `DashBoard` refresh pending counts / conflicts but never call `flush` when the device comes back online.

Offline creates/updates/deletes therefore sit in IndexedDB indefinitely until the user logs out (or discards). That breaks US-009–US-011 / TechSpec sync expectations: users can believe work will sync on reconnect when it will not.

Suggested fix: start a flush after successful login, subscribe to `onConnectivityChange` (and optionally visibility/focus) to flush when online, and trigger flush when entering the editor/dashboard with pending outbox. Surface progress and per-item failures in the UI.

Also affected: `src/lib/offline/connectivity.js`, `src/page/MapEditor.jsx`, `src/page/DashBoard.jsx`.

## Triage

- Decision: `valid`
- Root cause: `AuthContext` only invoked `SyncEngine.flush()` inside `orchestrateLogout`. No auto-flush ran after login/session restore or when connectivity returned, so pending outbox rows stayed in IndexedDB until logout.
- Fix (this batch, `AuthContext.jsx` only):
  - Added `flushOutbox` that runs `SyncEngine.flush()` and tracks progress via `syncState` (`flushing`, `progress`, `lastResult`, `error`).
  - Auto-flush on authenticated session (`useEffect` on `isAuthenticated` + `user.id`) covering login and `checkUserAuth` restore.
  - Subscribed to `onConnectivityChange` to flush when the device comes back online.
  - Subscribed to `visibilitychange` to flush when the tab/app regains focus while online.
  - Exported `flushOutbox` and `syncState` on the auth context for UI consumers.
  - Added `tests/js/authContextSync.test.js` covering offline skip, in-progress guard, and successful delegation.
- Remaining follow-up (out of batch scope): `MapEditor` / `DashBoard` can call `flushOutbox` on mount and bind `syncState` for visible progress badges; connectivity helper itself required no code change.
