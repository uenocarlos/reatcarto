---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T18:01:05Z
status: resolved
file: src/lib/export/brazilBoundaries.js
line: 238
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: SA context always fallback but may report IBGE source

## Review Comment

For `locatorCount === 2`, SA context is loaded via `resolveWithFallback(() => loadSaContext())`, but `loadSaContext()` ignores the preferred source and always reads `/geo/sa-brazil-context.geojson`. When the device is online and other layers succeed from IBGE, `usedFallback` can remain `false` and the result reports `source: 'ibge'` even though the SA inset came from the static bundle.

That breaks ADR-009 conditional IBGE/fallback attribution and can hide the fallback warning in the footer/options UI.

Suggested fix: either implement a real IBGE SA-context loader, or force `usedFallback = true` (and/or `source: 'fallback'`) whenever SA context is served from `public/geo/`.

## Triage

- Decision: `valid`
- Root cause: `loadSaContext()` has no IBGE endpoint (per ADR-009 the SA inset is always static), yet it was wired through `resolveWithFallback` with a loader that ignores the source argument. Online IBGE success for state/municipality left `usedFallback` false while SA context still came from `public/geo/`.
- Fix: load SA context outside `resolveWithFallback`, document that it is always static, and set `usedFallback = true` whenever the SA inset is requested. Added `UT-186a` to assert online IBGE + `locatorCount: 2` reports `usedFallback: true` and `source: 'fallback'`.
