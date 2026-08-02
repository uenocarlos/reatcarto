---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T17:26:20Z
status: resolved
file: src/components/map/export/OfflineTileLayer.jsx
line: 33
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Offline tile async can corrupt readiness after unload

## Review Comment

`OfflineTileLayer` stores per-tile readiness in a `Map` and deletes keys on `tileunload`, but `getLocalTileUrl` / `img.onload` / `img.onerror` callbacks are not cancelled or generation-gated:

1. Tile A for key `z:x:y` starts (`undefined` → loading).
2. Leaflet unloads A → key deleted; readiness recomputed.
3. A new tile B reuses the same key and sets `undefined` again.
4. A’s late resolve writes `url` or `null` into B’s key.

A late `null` marks the visible tile unusable incorrectly; a late success can mark B ready before its own image loads. Either path desynchronizes `buildOfflineReadinessPayload` / `evaluateBasemapReadiness` from the tiles actually on screen — regressing the offline gate fixed in reviews-001 under pan/zoom churn.

Suggested fix: bind each async chain to a request token or abort flag cleared on unload/unmount; ignore callbacks when `tileEntries.get(key)` is missing or the token mismatches; clear `onload`/`onerror` on unload.

## Triage

- Decision: `valid`
- Root cause: `getLocalTileUrl`, `img.onload` e `img.onerror` continuavam executando após `tileunload` apagar a chave do `Map`. Quando Leaflet reutilizava `z:x:y` para um tile novo, callbacks tardios do tile anterior podiam gravar `null` ou URL no slot do tile visível, desincronizando `buildOfflineReadinessPayload` / `evaluateBasemapReadiness`.
- Fix: token de requisição por chave (`tileRequestTokens` + `requestId`); callbacks ignorados quando o token não coincide; `onload`/`onerror` limpos em `tileunload`; handlers registrados antes de `tile.src` para evitar corrida com cache.
- Tests: UT-090f (contrato de geração + assert de source) garante que callbacks obsoletos não marcam tile reutilizado como `null`/`ready` indevidamente.
