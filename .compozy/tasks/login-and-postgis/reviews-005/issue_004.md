---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: src/lib/sync/SyncEngine.js
line: 56
severity: high
author: claude-code
provider_ref:
---

# Issue 004: Failed outbox rows are never retried on flush

## Review Comment

`OfflineStore.getPendingOutbox()` includes `PENDING`, `CONFLICTED`, and `FAILED`, and logout treats `FAILED` as unsynced work. However `getReadyMutations()` only selects `PENDING`:

```js
for (const row of pending.filter((r) => r.status === OUTBOX_STATUS.PENDING)) {
```

After a transient failure (network glitch mid-photo upload, temporary 5xx, remapped dependency race), `flush` marks the row `failed` and every subsequent `AuthContext` flush ignores it. The user is stuck until discard-on-logout. Spec requires retries that do not duplicate accepted work (US-010) — not a dead letter with no path back to `pending`.

**Suggested fix:** At the start of each `flush()`, reset eligible `FAILED` rows to `PENDING` (optionally with backoff / attempt count), or include `FAILED` in `getReadyMutations` while keeping `CONFLICTED` out until explicit resolve. Surface a manual “Retry failed” control if product wants user confirmation.

## Triage

- Decision: `UNREVIEWED`
- Notes:
