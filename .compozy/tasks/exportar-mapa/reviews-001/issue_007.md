---
provider: manual
pr:
round: 1
round_created_at: 2026-08-02T17:04:39Z
status: resolved
file: tests/js/exportPreview.test.js
line: 519
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: Offline readiness tests miss OfflineTileLayer contract

## Review Comment

UT-085 / UT-086 / UT-090 assert `evaluateBasemapReadiness` against hand-built `{ requiredTiles: [...] }` objects. They never exercise `OfflineTileLayer`’s actual `onReadinessChange` payloads (`{ ready: true }`, missing-tile `{ requiredTiles: [null] }`, no success list) nor the ExportMapModal → CompositionPreview wiring of `basemapReadiness` into `data-preview-status`.

That leaves the broken Offline → capture path (issues 001–002) green in CI. Several entry/modal checks are also source-string scans (`readFileSync` + `toContain`), which cannot catch runtime prop wiring bugs.

Suggested fix: add a focused unit/integration test that feeds OfflineTileLayer’s real callback shapes into `evaluateBasemapReadiness` / `buildPreviewModel`, and assert CompositionPreview/`exportCompositionPng` readiness when `basemapReadiness` updates. Prefer behavior assertions over JSX source scans for readiness.

## Triage

- Decision: `valid`
- Root cause: UT-085/UT-086/UT-090 exercised `evaluateBasemapReadiness` and `buildPreviewModel` with hand-built `{ requiredTiles: [...] }` objects instead of payloads produced by `buildOfflineReadinessPayload` (the shape `OfflineTileLayer.onReadinessChange` actually emits). UT-090 also used a loose `toContain` assertion that could pass without verifying `previewStatus`. No test linked offline readiness to `data-preview-status` / `waitForPreviewReadiness` behavior used by `exportCompositionPng`.
- Fix: Refactored UT-085/086/090 to use `buildOfflineReadinessPayload` via a shared `buildOfflinePreviewModel` helper. Added UT-090a (full OfflineTileLayer lifecycle → `previewStatus`), UT-090b (legacy `{ ready: true }` regression guard), and UT-090c (`buildPreviewModel.previewStatus` gates `waitForPreviewReadiness` for loading/ready/error). Added `exportBlockedByPreviewStatus` helper mirroring ExportMapModal's readiness gate without source scans.
