---
provider: manual
pr:
round: 6
round_created_at: 2026-08-02T19:17:05Z
status: pending
file: src/components/map/ExportMapModal.jsx
line: 45
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Export freeze omits boundary snapshot

## Review Comment

`frozenExport` snapshots only `{ settings, elements }`. During capture, `CompositionPreview` still receives live `boundaryResult` / `boundaryLoading` / `boundaryError` / `locationLabels` from `useExportLocationBoundaries({ settings: config, enabled: !isExporting })`.

reviews-003 stopped clearing geometries on disable, but did not freeze boundaries with the composition. An in-flight catalog/geometry completion that lands before `enabled` flips, or a desync between frozen location codes and the last `boundaryResult`, can still paint insets/overlays that do not match the frozen settings html2canvas captures.

Suggested fix: include `{ boundaryResult, locationLabels, boundaryError }` in the click-time freeze (same object as settings/elements), pass those frozen values into `CompositionPreview` while `isExporting`, and keep the hook disabled without mutating the frozen copy. Add a regression: start export with locators loaded → assert preview still uses the frozen geometry through capture.

## Triage

- Decision: `UNREVIEWED`
- Notes:
