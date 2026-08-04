---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: src/lib/sync/SyncEngine.js
line: 258
severity: high
author: claude-code
provider_ref:
---

# Issue 008: checkRemoteDeletes is never invoked

## Review Comment

`SyncEngine.checkRemoteDeletes` correctly walks prepared maps, treats map 404/`not_found` as quarantine candidates, and exposes `quarantineMap` — but there is **no caller** under `src/` (grep shows only the method definition). `AuthContext` flushes the outbox on login/online/visibility, yet never reconciles deleted remote maps.

Prepared maps therefore remain `status: 'ready'` after owner delete on another device, account intervention, or cascade. Offline / re-open continues to present full element caches; mutations then fail or recreate against missing maps.

**Suggested fix:** Call `engine.checkRemoteDeletes((id) => api.entities.Map.filter({ id }))` after successful flush, on login hydrate, and on visibility online (batch carefully). UI on `DashBoard`/`MapEditor` should surface quarantined maps as unavailable (US-009 “unavailable rather than incomplete”).

## Triage

- Decision: `UNREVIEWED`
- Notes:
