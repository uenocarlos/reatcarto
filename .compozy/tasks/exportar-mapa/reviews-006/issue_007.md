---
provider: manual
pr:
round: 6
round_created_at: 2026-08-02T19:17:05Z
status: pending
file: src/api/apiClient.js
line: 214
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: IndexedDB export_settings mirror errors swallowed

## Review Comment

reviews-005 issue_004 wired `upsertPreparedMap` after settings-only updates, but failures are fully swallowed:

```js
try {
  await storeForUser().upsertPreparedMap({
    id,
    export_settings: normalized.export_settings,
  });
} catch {
  /* offline store unavailable without authenticated user */
}
```

This hides real IndexedDB/quota/mirror failures behind the same path as “no authenticated user,” so ADR-007 / US-016 offline reopen can still restore stale composition with no signal after a successful server PATCH. Distinct from “mirror never called”: the call exists, but silent catch defeats observability and recovery.

Suggested fix: distinguish “no user / store unavailable” from unexpected errors; log/report the latter (and optionally surface via the same persist-failure UI as issue_004). Add a test where `upsertPreparedMap` rejects and the failure is observable (callback/metric), not only when the map is unprepared (no-op success).

## Triage

- Decision: `UNREVIEWED`
- Notes:
