---
provider: manual
pr:
round: 6
round_created_at: 2026-08-02T19:17:05Z
status: pending
file: src/lib/export/exportSettingsStore.js
line: 18
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Persist failure API never wired to store/UI

## Review Comment

reviews-005 issue_007 added `onPersistError`, `hasPersistFailure()`, and retry to `createDebouncedExportSettingsPersist`, but production wiring stops there:

- `createExportSettingsStore` constructs the debouncer with only `{ persist, delayMs }` — no `onPersistError`, and does not expose `hasPersistFailure`.
- `MapEditor` persist adapter never toasts/warns on failure; close/export `flush()` catches are empty.

Debounced online save failures remain invisible to the owner (only an optional `console.error` fallback). Users keep editing under a false “saved” assumption while multi-device/offline restore drifts, with no recovery cue. Distinct from 005-007 (swallowed reject inside the helper): the helper now signals, but the store/UI never subscribe.

Suggested fix: accept `onPersistError` in `createExportSettingsStore`, expose `hasPersistFailure`, and in `MapEditor` show a non-blocking toast/banner on failure (no PII). Cover with a store test that a rejected persist invokes the wired callback.

## Triage

- Decision: `UNREVIEWED`
- Notes:
