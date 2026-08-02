---
provider: manual
pr:
round: 3
round_created_at: 2026-08-02T17:42:00Z
status: resolved
file: tests/js/exportPreview.test.js
line: 1126
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Freeze test encodes clearing boundaries during export

## Review Comment

The regression suite for reviews-002 issue_003 (“composition frozen during export”) only source-scans that location fetching is disabled while exporting:

```js
expect(src).toMatch(/enabled:\s*open\s*&&\s*!ownershipLost\s*&&\s*!isExporting/);
```

It never asserts that locator geometries, overlays, or inset descriptors remain present on the capture DOM after `isExporting` flips true. That locks in the incomplete freeze from issue_001 of this round: disabling the hook is treated as success even though `boundaryResult` is cleared and PNG capture can drop Brazil location content.

This is a hollow/mis-specified contract relative to US-010/US-015 (export must match the configured preview, including locators). Source-string checks cannot catch the readiness/geometry regression.

Suggested fix: replace or extend the freeze test with a behavioral assertion — render/build preview model (or mount modal) with a non-null `boundaryResult` and `locatorCount >= 1`, set `isExporting`, and expect inset/overlay geometries (or frozen boundary props) to remain non-null. Keep the options-disabled checks, but do not treat `enabled: … && !isExporting` alone as proof of a frozen composition.

## Triage

- Decision: `valid`
- Root cause: the regression suite for export freeze (`export preview — composition frozen during export`) only source-scanned `enabled: … && !isExporting` and UI freeze markers. It never asserted that locator inset descriptors or main-map overlay outline remain on the capture preview model when export disables the boundary hook — the hollow contract that allowed reviews-003 issue_001 to ship.
- Fix approach: extend the freeze describe block with behavioral `buildPreviewModel` assertions (locatorCount ≥ 1, non-null `boundaryResult`) plus a hook source contract that `!enabled` stops fetches without clearing loaded boundary state. Keep existing options-disabled source checks.

## Resolution

- Added `buildExportFreezePreviewModel` helper and `sampleLocatorBoundary` fixture in `tests/js/exportPreview.test.js`.
- Added behavioral tests: preserved boundary keeps insets/overlay during export freeze; null boundary exposes the regression; hook source contract verifies `!enabled` no longer clears `boundaryResult`.
