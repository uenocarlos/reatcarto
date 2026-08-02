---
provider: manual
pr:
round: 1
round_created_at: 2026-08-02T17:04:39Z
status: resolved
file: src/components/map/export/OfflineTileLayer.jsx
line: 42
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Offline basemap never reports ready tiles

## Review Comment

`evaluateBasemapReadiness('offline', …)` only becomes `ready` when `requiredTiles` is a non-empty list of non-null URLs. `OfflineTileLayer` never emits that shape:

- On mount it calls `onReadinessChange({ ready: true })`, which the evaluator ignores (`requiredTiles` stays `[]` → `loading`).
- On missing tiles it emits `{ requiredTiles: [null] }` → `unusable`.
- On successful tile loads it only calls Leaflet `done(null, tile)` and never reports successful URLs.

Result: with Offline selected, `previewStatus` stays `loading` (or flips to `error`/`unusable` on gaps) and `waitForPreviewReadiness` times out — native Offline export (US-009 / ADR-010) cannot succeed.

Also affected: `src/lib/export/basemapResolver.js` (`evaluateBasemapReadiness`).

Suggested fix: after resolving the visible tile set, report e.g. `{ requiredTiles: urls }` where each entry is a local URL or `null`, and only signal success when every required tile has a URL. Align the initial callback with that contract (do not emit a ignored `ready: true`).

## Triage

- Decision: `valid`
- Root cause: `OfflineTileLayer` emitted `{ ready: true }` on mount and never aggregated resolved tile URLs into `requiredTiles`, so `evaluateBasemapReadiness('offline', …)` stayed in `loading` even when tiles loaded successfully.
- Fix: track visible tile entries in a `Map`, emit `buildOfflineReadinessPayload()` on every tile resolve/unload, remove the ignored `{ ready: true }` callback, and add shared payload builder in `basemapResolver.js` (minimal contract helper, testable without Leaflet) with contract test `UT-085a`.
