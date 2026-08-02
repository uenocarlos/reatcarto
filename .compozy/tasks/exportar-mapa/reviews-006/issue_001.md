---
provider: manual
pr:
round: 6
round_created_at: 2026-08-02T19:17:05Z
status: pending
file: src/lib/export/exportSettings.js
line: 314
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Concurrent persist can overwrite newer settings

## Review Comment

`createDebouncedExportSettingsPersist.runPersist` has no in-flight mutex or generation token. A debounced `persist(A)` can still be awaiting while `flush()` (close/export) or a retry starts `persist(B)` for newer `memorySettings`:

```js
async function runPersist() {
  if (!memorySettings) return;
  try {
    await persist(memorySettings);
    lastPersistFailed = false;
```

Common sequence: debounce fires for settings A → user edits to B → export/close `flush()` persists B → slow response for A completes last → server/IndexedDB keep A (LWW), silently dropping B. ADR-007 LWW then preserves the stale write.

Suggested fix: serialize persists (queue or `inFlight` promise chain); capture a generation/`pending` snapshot at start; after `await`, if `memorySettings` changed, persist again before clearing failure state. Add a unit test where overlapping `persist` resolves out of order and the latest settings remain stored.

## Triage

- Decision: `UNREVIEWED`
- Notes:
