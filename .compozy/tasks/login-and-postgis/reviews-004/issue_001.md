---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T21:53:24Z
status: resolved
file: php/criar_mapa.php
line: 22
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: Six legacy PHP scripts still hardcode DB password

## Review Comment

Round 3 removed `php/salvar_elementos.php`, but six pre-feature root scripts remain in the web-served `php/` tree with the hardcoded PostgreSQL password, fixed database `carlos`, and (in `criar_mapa.php`) credentialed CORS that reflects arbitrary `HTTP_ORIGIN`. Affected files:

- `php/criar_mapa.php`
- `php/listar_mapas.php`
- `php/listar_elementos.php`
- `php/get_mapa.php`
- `php/deletar_mapa.php`
- `php/deletar_elemento.php`

These endpoints are reachable whenever PHP serves `php/`, use the legacy session key `usuario_id`, and lack the new ownership/auth model. `tests/php/Security/LegacyLoginEndpointTest.php` only asserts absence of `login.php` and `salvar_elementos.php`, so the siblings stay unprotected.

Suggested fix: delete or move all six scripts out of the deployable tree, and extend the smoke test to assert none of these filenames (and no hardcoded legacy password pattern) exist under `php/*.php`.

## Triage

- Decision: `VALID`
- Root cause: Round 3 removed only `salvar_elementos.php` and `login.php`. Six sibling legacy scripts were left in place. All six contain hardcoded DB credentials (password `cma352425`, database `carlos`), use the legacy session key `usuario_id` instead of the new auth/session registry, and `criar_mapa.php` reflects arbitrary `HTTP_ORIGIN` into credentialed CORS headers, enabling CSRF-style cross-origin abuse.
- Fix approach: Delete all six files from the web-served `php/` tree. Extend `LegacyLoginEndpointTest.php` with per-file existence assertions for all six, plus a directory-wide scan of `php/*.php` for the legacy password string `cma352425` so future regressions are caught.
