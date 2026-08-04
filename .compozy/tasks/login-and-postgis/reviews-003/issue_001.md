---
provider: manual
pr:
round: 3
round_created_at: 2026-08-02T21:15:18Z
status: resolved
file: php/salvar_elementos.php
line: 16
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: Remaining legacy PHP scripts still hardcode DB password

## Review Comment

Round 2 issue 001 removed `php/login.php`, but seven pre-feature scripts remain in the deployable `php/` tree with the hardcoded PostgreSQL password `cma352425`, fixed database `carlos`, and credentialed CORS that reflects arbitrary `HTTP_ORIGIN` (or `*`). Affected files:

- `php/salvar_elementos.php`
- `php/criar_mapa.php`
- `php/listar_mapas.php`
- `php/listar_elementos.php`
- `php/get_mapa.php`
- `php/deletar_mapa.php`
- `php/deletar_elemento.php`

These endpoints are reachable whenever the PHP server serves `php/`, have no ownership/auth checks matching the new stack, and reintroduce the credential leak plus CORS misconfiguration already fixed for modular APIs. `tests/php/Security/LegacyLoginEndpointTest.php` only guards against reintroduction of `php/login.php`, so the siblings stay unprotected.

Suggested fix: delete or move all remaining legacy root scripts out of the web-served tree, and extend the smoke test to assert none of these filenames (or the hardcoded password pattern) exist under `php/*.php`.

## Triage

- Decision: `valid`
- Root cause: `php/salvar_elementos.php` is a pre-feature script still served from the web root. It hardcodes PostgreSQL credentials (`cma352425`), connects to a fixed legacy database (`carlos`), reflects any `HTTP_ORIGIN` with `Access-Control-Allow-Credentials: true`, and has no auth/ownership checks. The client already uses `php/elements/create.php` with env-backed config and allowlisted CORS.
- Fix approach: Remove `php/salvar_elementos.php` from the deployable tree (same remediation as round 2 for `php/login.php`). Extend `tests/php/Security/LegacyLoginEndpointTest.php` with smoke tests so the legacy script cannot be reintroduced with hardcoded credentials.
- Scope note: Six sibling legacy root scripts (`criar_mapa.php`, `listar_mapas.php`, etc.) still contain the same password pattern but are out of this batch.

## Resolution

- Removed `php/salvar_elementos.php` from the web-served tree.
- Added `testLegacyRootSalvarElementosScriptIsNotDeployed` and `testNoHardcodedLegacyDbPasswordInSalvarElementos` to `tests/php/Security/LegacyLoginEndpointTest.php`.
- Verification: `vendor\bin\phpunit tests\php\Security\LegacyLoginEndpointTest.php` (4/4, exit 0); `npm run lint`, `npm run typecheck`, `npm test` (405/405), `npm run build` (exit 0). Full `composer test` fails with pre-existing environment error (`citext` type missing in PostgreSQL test DB) unrelated to this batch.
