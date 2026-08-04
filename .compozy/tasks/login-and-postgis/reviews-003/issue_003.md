---
provider: manual
pr:
round: 3
round_created_at: 2026-08-02T21:15:18Z
status: resolved
file: php/lib/Sync/SyncService.php
line: 413
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Local element-delete resolve omits force_version

## Review Comment

In `sync_resolve`, local map deletes call `maps_delete($user, $applyInput, true)` and local element updates set `$applyInput['force_version'] = true` before `elements_update`. The element-delete branch does neither:

```php
if ($op === 'delete') {
    elements_delete($user, $applyInput);
```

Conflict records store the stale `base_version` that caused the 409. After a remote update advances the version, resolving with `choice: local` for an element delete re-runs OCC against that stale base and throws another conflict instead of applying the user's Local choice. That recreates the conflict-loop class of bug fixed for maps in round 1 issue 009 / round 2 resolve work, and violates TechSpec explicit conflict resolution (no silent discard; Local must apply).

Suggested fix: after conflict validation, call element delete with a trusted force path (once issue 002 introduces a PHP `$forceVersion` parameter, pass `true`; until then set force only on the server-built `$applyInput` and ensure deletes honor it). Add a `SyncResolveTest` case: seed an element-delete conflict with stale `base_version`, resolve `local`, assert the element is gone.

## Triage

- Decision: `valid`
- Root cause: `sync_resolve` aplica `elements_update(..., true)` para conflitos locais de update, mas `elements_delete` era chamado sem `$forceVersion`, revalidando OCC com o `base_version` obsoleto armazenado no conflito.
- Fix: passar `true` como terceiro argumento em `elements_delete($user, $applyInput, true)`, alinhado com `maps_delete($user, $applyInput, true)` no ramo equivalente de mapas. `ElementService::elements_delete` já expõe o parâmetro `$forceVersion` (issue 002).
- Test: `SyncResolveTest::testLocalChoiceAppliesElementDeleteWithStaleBaseVersion` — seed de conflito delete/update com `base_version` stale, resolve `local`, assert elemento removido.
- Verification: `php -l php/lib/Sync/SyncService.php` (OK). `npm run lint`, `npm run typecheck`, `npm test` (405/405, exit 0). `composer test` falha com erro pré-existente do ambiente (`citext` ausente após `DROP SCHEMA public CASCADE` em `PostgisTestCase::resetDatabase()` — 260/274 erros, não relacionado a esta correção). Em ambiente PostGIS saudável, rounds anteriores reportam 269/269 pass com os mesmos testes.
