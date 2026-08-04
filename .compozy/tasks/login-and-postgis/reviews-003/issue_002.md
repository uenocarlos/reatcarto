---
provider: manual
pr:
round: 3
round_created_at: 2026-08-02T21:15:18Z
status: resolved
file: php/lib/Elements/ElementService.php
line: 248
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Element force_version still trusted from client body

## Review Comment

Round 2 issue 003 fixed maps by moving `force_version` to a PHP parameter on `maps_update` / `maps_delete` and ignoring the request body. The same triage explicitly left `ElementService` out of that batch, and the gap remains:

```php
$forceVersion = !empty($input['force_version']);
```

in both `elements_update` (~248) and `elements_delete` (~340). Owner endpoints `php/elements/update.php` and `php/elements/delete.php` pass `read_json_body()` straight through. Sync push also merges `payload` into `$input` (`sync_apply_mutation`), so an authenticated owner can send `{ "force_version": true }` (or put it in an outbox payload) and bypass optimistic concurrency — silent last-write-wins that TechSpec / ADR-003 forbid.

Trusted callers already set the flag intentionally (`sync_resolve` for element updates, `admin_mutate_update_element`). They should pass a server-side boolean instead.

Suggested fix: mirror maps — add `bool $forceVersion = false` to `elements_update` / `elements_delete`, ignore `$input['force_version']`, update admin/sync callers, and add PHPUnit coverage that a client body `force_version: true` with stale/missing `base_version` is rejected.

## Triage

- Decision: `valid`
- Root cause: `elements_update` e `elements_delete` liam `$forceVersion` de `$input['force_version']`, permitindo bypass de concorrência otimista via body JSON ou payload de sync/outbox — mesmo gap corrigido em maps na review round 2.
- Fix aplicado: terceiro parâmetro `bool $forceVersion = false` em `elements_update`/`elements_delete`; corpo JSON ignorado. Callers confiáveis (`AdminService::admin_mutate_update_element`, `SyncService::sync_resolve` para updates de element) passam `true` explicitamente. Testes de regressão `testClientForceVersionIgnoredOnElementUpdate` e `testClientForceVersionIgnoredOnElementDelete` em `ElementsCrudTest.php` (espelham `MapsCrudTest`).
- Arquivos tocados além do escopo declarado: `AdminService.php` e `SyncService.php` (callers mínimos exigidos pela issue); `ElementsCrudTest.php` (cobertura).
- Verificação: `composer test` executado 3×; 259/273 testes falham com `PDOException: não existe o tipo de dados "citext"` em `MigrationRunner` após `PostgisTestCase::resetDatabase()` — falha pré-existente do ambiente local (`CREATE EXTENSION IF NOT EXISTS citext` não recria tipos após `DROP SCHEMA public CASCADE` quando `pg_extension` ainda registra a extensão). Não relacionado a esta correção. Sintaxe PHP validada (`php -l`) nos arquivos alterados.
