---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T18:01:05Z
status: resolved
file: src/components/map/ExportMapModal.jsx
line: 45
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Frozen basemap readiness hides live tile failures

## Review Comment

`frozenExportRef` snapshots `basemapReadiness` at export start, and `handleBasemapReadinessChange` ignores further tile updates while `isExporting`. `CompositionPreview` then keeps `data-preview-status="ready"` from that snapshot even if Leaflet unloads/reloads tiles during `html2canvas`, so PNG delivery can succeed with a blank or partial basemap — violating the PRD/ADR-010 rule that unusable basemap capture must not report success.

The inverse race is also possible: a `tileunload` between `setIsExporting(true)` and the freeze commit can snapshot `loading`, after which live `ready` updates are ignored and `waitForPreviewReadiness` times out spuriously.

Suggested fix: freeze settings/elements only; keep basemap readiness live through capture (or re-evaluate tile readiness inside `waitForPreviewReadiness` / right before html2canvas). Do not treat a frozen readiness snapshot as authoritative for success.

## Triage

- Decision: `valid`
- Root cause: `frozenExportRef` included `basemapReadiness`, and `handleBasemapReadinessChange` short-circuited while `isExporting`, so `CompositionPreview` could keep a stale `data-preview-status="ready"` during html2canvas even after tiles failed or unloaded.
- Fix: Freeze only `settings` and `elements` in `frozenExportRef`; pass live `basemapReadiness` to `CompositionPreview` and allow tile callbacks to update state throughout export so `waitForPreviewReadiness` observes real tile lifecycle.
- Verification: Added `export preview — live basemap readiness during export (review issue_001)` tests; full JS test suite run via `npm test`.
