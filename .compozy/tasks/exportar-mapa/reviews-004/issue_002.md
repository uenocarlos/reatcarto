---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T18:01:05Z
status: resolved
file: src/page/MapEditor.jsx
line: 140
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Elements refresh mutates settings during PNG export

## Review Comment

While the export modal is open, this effect always runs on `elements` changes:

```js
setExportSettings(exportSettingsStoreRef.current.updateSettings({}, elements));
```

There is no `isExporting` (or modal-freeze) guard. A React Query refresh or local element edit during PNG generation re-prunes settings, schedules debounced persist, and pushes a new `settings` prop into `ExportMapModal` while capture is in flight.

That undermines the freeze contract (UT-154 / reviews-002/003): live settings and boundary-hook inputs can diverge from the frozen composition, and `handleExportSettingsChange` itself also lacks an `isExporting` early return.

Suggested fix: skip store updates (and optionally persistence) while `isExporting`; gate `handleExportSettingsChange` the same way. Apply prune after export completes if needed.

## Triage

- Decision: `valid`
- Root cause: the `elements` sync effect (lines 140–145) and `handleExportSettingsChange` always call `exportSettingsStoreRef.current.updateSettings(...)`, even while `isExporting` is true. A React Query refresh or style preview during PNG capture re-prunes settings, schedules debounced persist, and pushes new `settings` into `ExportMapModal`, breaking the freeze contract (UT-154).
- Fix approach: add `isExporting` early returns to both paths; include `isExporting` in the elements effect deps so prune runs once export completes and deferred element changes are reconciled.

## Resolution

- Guarded the elements sync effect with `if (isExporting) return` and added `isExporting` to its dependency array so deferred prune runs when export finishes.
- Guarded `handleExportSettingsChange` with the same `isExporting` check.
- Added regression test `MapEditor freezes export settings store while isExporting` in `tests/js/exportPng.test.js`.
