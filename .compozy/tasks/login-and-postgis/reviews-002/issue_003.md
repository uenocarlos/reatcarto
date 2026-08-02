---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T19:07:59Z
status: resolved
file: php/lib/Maps/MapService.php
line: 539
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Client can send force_version to skip concurrency

## Review Comment

`maps_update` and `elements_update` honor `force_version` from the request body (`!empty($input['force_version'])`). Owner-facing endpoints (`php/maps/update.php`, `php/elements/update.php`) pass `read_json_body()` straight through, so any authenticated owner can PATCH `{ "force_version": true, ... }` and bypass optimistic version checks entirely — re-enabling silent LWW that `base_version` was meant to prevent.

`force_version` is appropriate for server-controlled paths (admin private mutate, verified conflict resolve), not as a client-trusted flag on ordinary CRUD.

Suggested fix:

1. Strip / ignore `force_version` from public owner API inputs.
2. Set the flag only inside trusted server callers (`admin_mutate_*`, `sync_resolve` after conflict validation).
3. Add a regression test that a direct `maps_update` / `elements_update` with client `force_version: true` and stale/missing `base_version` is rejected.

Also affected: `php/lib/Elements/ElementService.php` (~248).

## Triage

- Decision: `valid`
- Notes: Confirmado em `maps_update` (L539) e `maps_delete` (L750): `$forceVersion = !empty($input['force_version'])` confia no corpo JSON do cliente. Endpoints owner (`php/maps/update.php`, `php/maps/delete.php`) repassam `read_json_body()` sem filtrar, permitindo bypass de `base_version`.
- Root cause: flag de controle interno exposta como campo de input público.
- Fix aplicado: terceiro parâmetro `bool $forceVersion = false` em `maps_update`/`maps_delete`; `$input['force_version']` ignorado. Callers confiáveis (`AdminService::admin_mutate_update_map`, `SyncService::sync_resolve`) passam `true` explicitamente. Testes de regressão em `MapsCrudTest`.
- Fora do escopo deste batch: `ElementService.php` (~248, ~340) permanece com o mesmo padrão vulnerável; requer issue separada.
