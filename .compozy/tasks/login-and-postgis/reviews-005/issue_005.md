---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: src/api/apiClient.js
line: 252
severity: high
author: claude-code
provider_ref:
---

# Issue 005: Online element list ignores offline pending cache

## Review Comment

`api.entities.MapElement.filter` uses IndexedDB only when `!isOnline()`. When connectivity returns, it always GETs `/elements/list.php` and returns server-only data:

```js
const data = await apiFetch(`/elements/list.php?${params}`, { method: 'GET' });
return (data.elements ?? []).map(normalizeElement);
```

Scenario: prepare map → edit offline (creates/updates in outbox + IDB) → network restores before flush finishes (or while flush is still running). The editor loads server elements only; local creations disappear from the UI and local edits show stale geometry names. Data remains in outbox but is invisible, enabling duplicate creates and bad decisions.

PRD offline path (US-009/US-010) requires pending work to stay visible until synchronized.

**Suggested fix:** When the map is prepared (`isMapPrepared`), merge server list with local elements that have `_pending` or outbox creates for that `map_id`, preferring the most recent local snapshot until outbox is clean. Alternatively short-circuit to offline read while `getPendingOutbox()` has mutations for that map.

## Triage

- Decision: `UNREVIEWED`
- Notes:
