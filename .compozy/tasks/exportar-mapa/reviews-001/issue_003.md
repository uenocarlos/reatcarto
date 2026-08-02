---
provider: manual
pr:
round: 1
round_created_at: 2026-08-02T17:04:39Z
status: resolved
file: src/page/MapEditor.jsx
line: 116
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Export settings reset when elements refresh

## Review Comment

While the export modal is open, this effect re-hydrates from `mapData.export_settings` whenever `elements` (or `mapData`) changes:

```js
useEffect(() => {
  if (!showExport || !mapId || !mapData || !exportSettingsStoreRef.current) return;
  const hydrated = exportSettingsStoreRef.current.hydrate(
    mapId,
    mapData.export_settings,
    elements
  );
  setExportSettings(hydrated);
}, [showExport, mapId, mapData, elements]);
```

`hydrate` replaces in-memory settings with the server/cache snapshot. Element create/update/refetch (common while editing) therefore wipes unsaved modal edits — title, legend, visibility, locators — that live only in the store until the debounced persist lands (and even then `mapData` may lag).

This breaks US-013 live composition and US-016 persistence expectations during an open session.

Suggested fix: hydrate once when the modal opens (or when `mapId` changes), and on `elements` changes only `pruneExportSettings` / `updateSettings` against the current in-memory settings — do not re-apply stale `mapData.export_settings`.

## Triage

- Decision: `valid`
- Root cause: A single `useEffect` depended on `[showExport, mapId, mapData, elements]` and always called `hydrate`, which replaces in-memory settings with the persisted snapshot. Any element refetch or `mapData` update while the modal was open reset unsaved edits.
- Fix: Guard hydration with `exportModalHydratedRef` so it runs once per modal session (or when `mapId` changes). Add a second effect that, while the modal is open, calls `updateSettings({}, elements)` to prune deleted element/category ids without re-reading `mapData.export_settings`.
- Verification: Added IT-001b (store behavior) and IT-001c (MapEditor wiring); full `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
