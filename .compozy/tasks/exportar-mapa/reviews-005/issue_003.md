---
provider: manual
pr:
round: 5
round_created_at: 2026-08-02T18:41:38Z
status: resolved
file: src/page/MapEditor.jsx
line: 417
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Freeze starts only after await flush

## Review Comment

`ExportMapModal.handleExportClick` snapshots settings into `frozenExport` and calls `onExport`, but preview freeze is gated on `isExporting`:

```js
const previewSettings = isExporting && frozenExport ? frozenExport.settings : config;
```

`MapEditor.handleExport` awaited `exportSettingsStore.flush()` **before** `setIsExporting(true)`. During that await:

- `optionsDisabled` remains false (controls stay editable)
- `CompositionPreview` still binds live `config` / `elements`
- `html2canvas` later captures that live DOM, while `attemptExport` uses the click-time `config` (and post-flush live `elements`) for gates/DPI/filename

US-015.EC-8 / reviews-002–004 freeze work is undermined: the owner can change basemap, legend, visibility, or title during flush, producing a PNG that does not match the gated configuration, or a success toast for a composition the gates never validated.

Suggested fix: set `isExporting` (or an `isExportPending` flag that freezes preview + disables options) synchronously on click, **before** `flush()`. Prefer freezing settings/elements once in the click handler / controller and passing that same snapshot to both preview props and `attemptExport` (do not re-read live `elements` after await). Keep `flush()` best-effort in parallel or after the freeze is applied.

## Triage

- Decision: `valid`
- Root cause: `MapEditor.handleExport` deferred `setIsExporting(true)` until after `await exportSettingsStore.flush()`, so the modal's `isExporting` prop stayed false during flush and preview/options remained live despite `frozenExport` being set in the modal click handler. `attemptExport` also read live `elements` after the await, diverging from the click-time snapshot used for settings/DOM gates.
- Fix: Move `setIsExporting(true)` and `const frozenElements = elements` to run synchronously after permission checks and before `flush()`. Pass `frozenElements` to `attemptExport` instead of live `elements`. Added source-order regression test in `tests/js/exportPng.test.js`.
