---
provider: manual
pr:
round: 3
round_created_at: 2026-08-02T17:42:00Z
status: resolved
file: src/lib/export/useExportLocationBoundaries.js
line: 42
severity: high
author: claude-code
provider_ref:
---

# Issue 002: State catalog load clears persisted municipality

## Review Comment

The states-catalog effect in `useExportLocationBoundaries` reconciles persisted location codes against **both** state and municipality lists as soon as `listStates()` resolves:

```js
const reconciled = reconcileLocationSettings(normalized, result.items, municipalities);
```

That effect’s dependency array is only `[enabled]`, so on modal open `municipalities` is still `[]`. `reconcileLocationSettings` treats any municipality code absent from the (empty) list as stale and sets `municipalityCode` to `null`, then `onSettingsChange` persists that wipe into session settings (and the debounced server mirror).

Result: reopening export for a map that already had UF + município saved (US-016 / US-010) can silently drop the municipality, re-arm locator gates, and force the owner to re-select before export. UT-103 only covers reconcile with an explicit non-empty catalog missing the code — it does not cover “empty municipalities while states just loaded.”

Suggested fix: do not reconcile municipality membership until the municipalities catalog for the current UF has loaded (or pass `municipalities` only when `catalogLoading` for munis is done). Alternatively, skip municipality clearing when the municipalities list is empty/`undefined` (“unknown,” not “absent”). Re-run reconcile after `listMunicipalities` completes. Add a unit/integration test: hydrate settings with `stateCode`+`municipalityCode`, mount the hook, assert municipality is not cleared solely because munis have not arrived yet.

## Triage

- Decision: `valid`
- Root cause: the states-catalog effect called `reconcileLocationSettings(normalized, result.items, municipalities)` while `municipalities` was still `[]` (deps `[enabled]` only). `reconcileLocationSettings` treats any code absent from the list as stale, so persisted `municipalityCode` was cleared and persisted via `onSettingsChange` before `listMunicipalities` completed.
- Fix approach: reconcile state membership only when states load; preserve persisted `municipalityCode` until the municipalities catalog for the current UF arrives. The existing municipalities effect already clears invalid codes after `listMunicipalities` resolves.

## Resolution

- Updated `useExportLocationBoundaries.js` states effect to run state-only reconcile (pass `municipalityCode: null` into reconcile, then restore persisted municipality when state remains valid).
- Added regression tests in `tests/js/brazilLocation.test.js` (state-only reconcile behavior + source contract).
