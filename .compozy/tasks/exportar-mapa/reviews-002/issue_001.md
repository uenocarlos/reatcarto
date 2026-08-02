---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T17:26:20Z
status: resolved
file: src/lib/export/basemapResolver.js
line: 71
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Online basemap never waits for tiles before ready

## Review Comment

`evaluateBasemapReadiness` treats every non-offline basemap as immediately `ready` unless `readiness.error` is set:

```js
if (normalized.basemap !== 'offline') {
  return readiness.error ? 'error' : 'ready';
}
```

`PreviewMap` only wires `tileerror` for online `TileLayer` and never reports loading/complete tile state. Combined with `waitForPreviewReadiness` / the Export button gate on `previewStatus === 'ready'`, Claro/OSM/Satellite exports can succeed while tiles are still blank or only partially painted.

This violates ADR-010 (“Wait for required basemap tiles… gate on `tileload`”) and US-009.EC-8 / US-013.EC-2 (export/preview must wait or fail clearly; no false-complete map). Offline is gated correctly after reviews-001; online is not.

Also affected: `src/components/map/export/PreviewMap.jsx` (online TileLayer handlers), `src/lib/export/previewModel.js` (propagates basemapStatus), and tests `UT-088`/`UT-090` which only cover injected `{ error: true }` / offline payloads.

Suggested fix: track online tile load progress (e.g. pending vs loaded vs error via Leaflet `loading`/`load`/`tileerror`, or a short settle after `load`), emit a readiness payload that can be `loading`/`ready`/`error`, and teach `evaluateBasemapReadiness` to honor that for carto/osm/satellite. Extend UT-090 (or add a sibling) so online “export before tiles ready” asserts `previewStatus === 'loading'` until tiles settle.

## Triage

- Decision: `valid`
- Root cause: `evaluateBasemapReadiness` retorna `ready` imediatamente para basemaps online quando `readiness.error` é falsy, ignorando tiles pendentes. `PreviewMap` só emite `{ error: true }` em `tileerror` e nunca reporta progresso de carregamento.
- Fix: adicionar `buildOnlineReadinessPayload` (mesmo contrato de tiles que offline), fazer `evaluateBasemapReadiness` honrar `requiredTiles`/`error` para carto/osm/satellite, e criar `OnlineTileLayer` (eventos Leaflet `tileloadstart`/`tileload`/`tileerror`/`tileunload`) usado por `PreviewMap`. Arquivos além de `basemapResolver.js` são mínimos e necessários para o payload chegar ao modelo.
- Tests: UT-088a (online sem payload → loading) e UT-090d (ciclo loading/ready/error online).
