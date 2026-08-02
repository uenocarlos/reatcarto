---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T17:26:20Z
status: resolved
file: src/page/MapEditor.jsx
line: 144
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Element prune always schedules export_settings persist

## Review Comment

After the reviews-001 hydrate fix, MapEditor prunes on every `elements` change while the modal is open via:

```js
setExportSettings(exportSettingsStoreRef.current.updateSettings({}, elements));
```

`createExportSettingsStore.updateSettings` always calls `debouncer.setSettings(settings)`, and `createDebouncedExportSettingsPersist.setSettings` always schedules a flush — there is no equality check and no “prune-only” path that skips persist.

So any elements refetch/create/delete while Export is open (and once on open after hydrate) issues a settings-only LWW PATCH even when `hidden*` arrays did not change. That causes unnecessary writes, can overwrite concurrent multi-device edits (ADR-007 LWW), and couples editor geometry traffic to export persistence.

Also affected: `src/lib/export/exportSettingsStore.js`, `src/lib/export/exportSettings.js` (`createDebouncedExportSettingsPersist`).

Suggested fix: add a prune helper that updates memory without scheduling persist, or compare JSON before `setSettings`; only debounce-persist when the pruned settings actually differ from the previous snapshot.

## Triage

- Decision: `valid`
- Root cause: `createExportSettingsStore.updateSettings` always forwarded pruned settings to `debouncer.setSettings`, which schedules a flush even when prune-only calls (empty partial from MapEditor on `elements` refetch) produced identical settings.
- Fix: Added `exportSettingsEqual` in `exportSettings.js` and gated `debouncer.setSettings` in `updateSettings` so persist runs only when pruned/normalized settings actually differ. MapEditor.jsx keeps calling `updateSettings({}, elements)` — no UI change required.
- Notes: Also touched `exportSettingsStore.js` (minimum store-layer fix; batch listed MapEditor as symptom site). Added IT-001d in `exportEntry.test.js`.
