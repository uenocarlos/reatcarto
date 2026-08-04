---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: src/lib/offline/OfflineStore.js
line: 161
severity: high
author: claude-code
provider_ref:
---

# Issue 007: Outbox collapse drops offline element create on re-edit

## Review Comment

`offlineUpdateElement` calls `collapseOutboxForResource` then enqueues a new `update`. Collapse keeps only the chronologically last pending row (or a delete) and deletes the others. Sequence:

1. Offline create → outbox `[create]`
2. First edit → collapse keeps create, enqueue update → `[create, update]`
3. Second edit → collapse keeps the latest update and **deletes the create** → `[update]` only

Flush then sends an `update` against a local UUID that never existed on the server → permanent field failure. Creates must be preserved or folded into a single effective create with the latest payload while the resource is still local-only.

Suggested fix: if any pending row is `create`, collapse into one `create` with the newest payload (and drop superseded updates), or refuse to delete the create row when collapsing. Add a Vitest case for create→edit→edit→flush.

## Triage

- Decision: `VALID`
- Root cause: `OfflineStore.collapseOutboxForResource()` (line 161) selects the final row as either: a `delete` (if any present), otherwise `pending[pending.length - 1]` (the newest). It does not distinguish `create` — when the newest pending row is an `update` applied after a `create`, collapse deletes the `create` row. The resource is still client-side-only (server id never assigned), so the remaining `update` on flush targets a non-existent server row.
- Fix approach: In `collapseOutboxForResource`, if `pending` contains a row with `op === 'create'` and none with `op === 'delete'`, treat the create as special: fold all subsequent update payloads into the create payload (last write wins per field), keep the create as the single surviving row (op=create, merged payload, same `client_mutation_id`), and delete superseded updates/deletes. If a delete exists alongside create, keep only the delete (server never sees the create). If create is not present, behavior stays unchanged.
