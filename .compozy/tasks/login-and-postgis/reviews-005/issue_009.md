---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: src/api/apiClient.js
line: 268
severity: high
author: claude-code
provider_ref:
---

# Issue 009: Online CRUD does not mirror prepared OfflineStore

## Review Comment

Offline branches call `offlineCreateElement` / `offlineUpdateElement` / `offlineDeleteElement`, but online branches of `MapElement.create/update/delete` and `Map.delete/update/publish` only talk to PHP. A map already prepared for offline is never updated when the user works online later.

Consequences when connectivity drops:

- Elements deleted online still appear offline
- Elements/maps created or edited online are missing offline
- Publish flags and versions drift until a full re-prepare

This is distinct from `prepareMap` purge: even a first prepare after online work is optional for the user — everyday online editing must keep the account-bound cache coherent if preparation already happened.

**Suggested fix:** After successful online mutate, if `isMapPrepared(mapId)`, apply the same IDB mirror (`upsertElement` / `removeElement` / `upsertPreparedMap` / photo meta). On map delete, clear prepared state for that map.

## Triage

- Decision: `UNREVIEWED`
- Notes:
