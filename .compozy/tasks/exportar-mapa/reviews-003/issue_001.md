---
provider: manual
pr:
round: 3
round_created_at: 2026-08-02T17:42:00Z
status: resolved
file: src/lib/export/useExportLocationBoundaries.js
line: 90
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Export disables boundaries and clears locator geometry

## Review Comment

When PNG export starts, `ExportMapModal` sets `useExportLocationBoundaries({ enabled: open && !ownershipLost && !isExporting })`. As soon as `isExporting` becomes true, the geometries effect takes the `!enabled` branch and **clears** live boundary state:

```js
if (!enabled || normalized.locatorCount === 0) {
  setBoundaryResult(null);
  setBoundaryError(null);
  setBoundaryLoading(false);
  return undefined;
}
```

`CompositionPreview` still receives frozen `settings` / `basemapReadiness`, but continues to use the live (now null) `boundaryResult`. With `locatorCount >= 1`, inset descriptors and main-map overlays rebuild with empty geometries while `previewStatus` can remain `ready` (basemap frozen ready, `boundaryLoading` false). `waitForPreviewReadiness` then captures a composition **without** the Brazil insets/outline/mesh that the owner saw.

This breaks US-010/US-011/US-015 and ADR-010 (“PNG matches the preview”). The freeze introduced for reviews-002 issue_003 stopped option edits, but disabling the boundary hook without snapshotting `boundaryResult` (and labels) undoes location content at capture time.

Also affected: `src/components/map/ExportMapModal.jsx` (`enabled: … && !isExporting`, `boundaryResult={locationBoundaries.boundaryResult}`).

Suggested fix: keep boundary data stable during export — e.g. freeze `{ boundaryResult, locationLabels, boundaryError }` in the same `frozenExportRef` used for settings/basemap, and pass those frozen values into `CompositionPreview`; when `enabled` is false, stop new fetches but **do not** null out an already-loaded `boundaryResult`. Add a regression test that with locators configured, `isExporting=true` still leaves non-null inset geometries / overlay outline on the preview DOM used for capture.

## Triage

- Decision: `valid`
- Root cause: the geometries effect combined `!enabled` with `locatorCount === 0` and cleared `boundaryResult`/`boundaryError` whenever export set `enabled=false`. The municipalities effect did the same for `municipalities`, breaking `locationLabels` during capture.
- Fix approach: split the guard conditions so `locatorCount === 0` (or missing state/muni) still clears stale data, but `!enabled` only stops in-flight fetches (`setBoundaryLoading(false)`) and preserves already-loaded boundary/catalog state. No modal changes required — the hook now keeps data stable while `isExporting` disables it.

## Resolution

- Updated `useExportLocationBoundaries.js` geometries effect: `!enabled` no longer calls `setBoundaryResult(null)` / `setBoundaryError(null)`.
- Updated municipalities effect: `!enabled` returns early without clearing the loaded municipality list (labels stay stable).
- Added regression tests in `tests/js/brazilLocation.test.js` (source contract + `buildPreviewModel` inset/overlay assertions).
