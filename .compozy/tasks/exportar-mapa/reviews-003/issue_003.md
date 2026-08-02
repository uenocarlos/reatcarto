---
provider: manual
pr:
round: 3
round_created_at: 2026-08-02T17:42:00Z
status: resolved
file: src/components/map/export/OnlineTileLayer.jsx
line: 31
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Online tileload after unload can fake basemap ready

## Review Comment

`OnlineTileLayer` tracks visible tiles in a `Map` and deletes keys on `tileunload`, but `tileload` / `tileerror` handlers always write the key back with no generation/token check:

```js
layer.on('tileload', (e) => {
  const { x, y, z } = e.coords;
  tileEntries.set(tileKey(z, x, y), e.tile?.src || 'loaded');
  emitReadiness();
});
```

After a pan/zoom, Leaflet may fire `tileunload` for the old set before `tileloadstart` for the new set. A late `tileload` for an unloaded tile re-inserts a “loaded” entry. If that happens while the newly required tiles have not yet emitted `tileloadstart` (empty or only ghost entries), `evaluateBasemapReadiness` can return `ready` against a blank or transitional viewport.

This is the online counterpart of the race fixed for offline in reviews-002 issue_006 (`tileRequestTokens` / `isCurrent()`). It undermines the online readiness work from reviews-002 issue_001 and allows US-009.EC-8 / capture gating to pass with an incomplete Claro/OSM/Satellite paint.

Suggested fix: mirror the offline invalidation pattern — per-key request tokens (or ignore `tileload`/`tileerror` unless the key is still present from a matching `tileloadstart`), and/or ignore events whose tile element was already cleared on unload. Add a unit-style test around the readiness reducer or a documented contract test that a load after unload must not mark ready without current `tileloadstart` entries.

## Triage

- Decision: `valid`
- Root cause: `tileload` / `tileerror` regravavam a chave no `Map` sem verificar se o tile ainda correspondia à geração ativa após `tileunload`. Um `tileload` tardio de tile descarregado podia reintroduzir entrada `loaded` enquanto o viewport novo ainda não tinha `tileloadstart`, fazendo `evaluateBasemapReadiness` retornar `ready` indevidamente.
- Fix: espelhar o padrão offline — `tileRequestTokens` + `requestId` por `tileloadstart`, `WeakMap` ligando elemento do tile ao `requestId`, handlers `tileload`/`tileerror` ignorados quando o token não coincide; limpar `onload`/`onerror` em `tileunload`.
- Tests: UT-090g (contrato de geração online + assert de source) garante que `tileload` obsoleto após unload/reuso não marca basemap online como `ready`.
