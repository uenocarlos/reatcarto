---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: src/lib/sync/SyncEngine.js
line: 68
severity: high
author: claude-code
provider_ref:
---

# Issue 006: SyncEngine.flush is single-pass for dependency chains

## Review Comment

Even with correct `depends_on`, `flush()` loads ready mutations once, pushes them, applies results, and returns. It never loops to pick up dependents that became ready after the parent synced. Contract coverage (e.g. UT-091) explicitly needs two flush calls for create→photo chains.

`AuthContext.flushOutbox` and logout `syncFn` each invoke `flush` once. After a create syncs, dependent photos stay `pending` until a later online/visibility event. During logout this surfaces as `needsDiscardConfirm` for work that would sync on a second pass, risking discard of valid field photos.

Suggested fix: loop `flush` until no ready mutations remain (with a safe iteration cap), or re-enter while dependents are waiting. Logout should drain the dependency chain before prompting discard.

## Triage

- Decision: `VALID`
- Root cause: `SyncEngine.flush()` (line 68) builds the ready set once at the top, pushes it, applies results, and returns. When an element create → photo create dependency exists, only the element create is ready on pass 1. After it syncs and `_applyResource` runs, the photo mutation is now unblocked but `flush` exits without a second pass. Callers (`flushOutbox`, logout `syncFn`) invoke flush exactly once, so the photo remains pending.
- Fix approach: Add a bounded loop inside `flush()` (e.g., max 10 iterations) that rebuilds the ready set after each pass and continues while new mutations become ready. Each pass must re-query `getReadyMutations()` after processing results and applying resources. Stop the loop when a pass produces zero ready mutations or zero new synced rows, or when the iteration cap is hit to avoid pathological cycles.
