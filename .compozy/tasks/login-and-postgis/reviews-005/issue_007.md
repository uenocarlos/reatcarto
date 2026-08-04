---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: src/lib/offline/offlineApi.js
line: 162
severity: high
author: claude-code
provider_ref:
---

# Issue 007: Offline element delete removes cache before sync

## Review Comment

`offlineDeleteElement` enqueues a delete mutation then immediately calls `store.removeElement(id)`:

```js
await store.enqueue({ op: 'delete', resource_id: id, ... });
await store.removeElement(id);
```

If push fails, stays `failed` (and is never retried — see related outbox issue), or resolves as a conflict, the element is already gone from IDB while still authoritative on the server. There is no restore path from `remote_snapshot` on failure. The user loses the ability to compare versions or re-attempt delete against known geometry.

**Suggested fix:** Soft-mark locally (`_pendingDelete: true` / hide in UI) without `removeElement` until the outbox row is `synced`. On fail or conflict, keep the element and surface remote state. Only purge after successful apply or explicit remote-choice delete.

## Triage

- Decision: `UNREVIEWED`
- Notes:
