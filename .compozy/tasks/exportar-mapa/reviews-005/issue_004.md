---
provider: manual
pr:
round: 5
round_created_at: 2026-08-02T18:41:38Z
status: resolved
file: src/page/MapEditor.jsx
line: 110
severity: high
author: claude-code
provider_ref:
---

# Issue 004: export_settings never mirrored to IndexedDB on persist

## Review Comment

ADR-007 / US-016 require an IndexedDB mirror of `export_settings` so offline reopen restores the last known composition. `OfflineStore.upsertPreparedMap` exists and IT-041/IT-043 cover it, but **no production caller** invokes it after settings saves.

`MapEditor` persist only hits the API:

```js
persist: async (settings) => {
  const updated = await api.entities.Map.update(mapId, { export_settings: settings });
  queryClient.setQueryData(['map', mapId], updated);
  return updated;
},
```

`api.entities.Map.update` does not update `prepared_maps`. Offline cache therefore keeps whatever was stored at the last `prepareOffline` / map sync, so field reopen after editing export options online restores stale title/legend/locator settings (or defaults), breaking US-001.EC-6 / US-016 offline restore.

Suggested fix: after a successful settings-only update (and on flush), call `upsertPreparedMap({ id: mapId, export_settings: normalized })` when the map is prepared for offline. Wire it in the persist adapter or `apiClient` so all callers share the mirror. Add an integration test that updates settings then `offlineGetMap` and asserts the mirrored field matches — without relying solely on a direct `upsertPreparedMap` unit call.

## Triage

- Decision: `valid`
- Root cause: `api.entities.Map.update` persisted `export_settings` to the server but never called `OfflineStore.upsertPreparedMap`, so prepared offline maps kept stale settings from the last `prepareOffline`.
- Fix approach: After a successful settings-only `Map.update`, call `storeForUser().upsertPreparedMap({ id, export_settings: normalized.export_settings })` inside `apiClient.js` (centralized mirror for all callers; `MapEditor` persist already routes through `Map.update`, including debounced flush). `upsertPreparedMap` is a no-op when the map is not prepared.
- Verification: Added integration test `mirrors export_settings to IndexedDB after settings-only Map.update` in `tests/js/exportSettings.test.js` — prepares offline cache, updates via `api.entities.Map.update`, asserts `offlineGetMap` reflects normalized settings.
