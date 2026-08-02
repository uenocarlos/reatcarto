---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T18:01:05Z
status: resolved
file: src/lib/export/useExportLocationBoundaries.js
line: 101
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: locatorCount 0 clears geometries while export-disabled

## Review Comment

Reviews-003 stopped clearing `boundaryResult` on the `!enabled` path, but the geometry effect still clears state when `locatorCount === 0` *before* the `!enabled` early return:

```js
if (normalized.locatorCount === 0) {
  setBoundaryResult(null);
  ...
  return undefined;
}
if (!enabled) { ... }
```

Because the hook keeps receiving live `settings` (not frozen) and `MapEditor` can still mutate settings during export (see issue_002), a mid-export `locatorCount → 0` wipe removes insets/overlays from the capture DOM even though fetches are disabled.

Suggested fix: when `!enabled`, preserve existing `boundaryResult` / error state for all locator transitions; only clear when enabled (or clear explicitly on modal close). Preferably also freeze `boundaryResult` in the export snapshot.

## Triage

- Decision: `valid`
- Root cause: reviews-003 split the combined `!enabled || locatorCount === 0` guard but left `locatorCount === 0` as the first branch in the geometries effect. During export (`enabled=false`), live settings can still change (e.g. `locatorCount → 0`), so the hook cleared `boundaryResult` before reaching the `!enabled` early return.
- Fix approach: move the `!enabled` guard to the top of the geometries effect so disabled mode only stops in-flight loading and preserves already-loaded boundary state for all subsequent setting transitions. Keep `locatorCount === 0` clearing when the hook is enabled.

## Resolution

- Reordered guards in `useExportLocationBoundaries.js` geometries effect: `!enabled` now returns early (after `setBoundaryLoading(false)`) before any `locatorCount === 0` or missing state/muni clearing.
- Added source-order regression assertions in `tests/js/exportPreview.test.js` and `tests/js/brazilLocation.test.js` verifying `!enabled` precedes `locatorCount === 0` in the effect that calls `getLocatorGeometries`.
- Verification: `npm run lint`, `npm run typecheck`, `npm run test` (384 passed), `npm run build` — all exit 0.
