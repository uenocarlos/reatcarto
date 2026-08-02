---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T19:07:59Z
status: resolved
file: php/login.php
line: 16
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: Legacy PHP endpoints ship hardcoded DB password

## Review Comment

Several pre-feature PHP scripts under `php/` still contain a hardcoded PostgreSQL password (`cma352425`) and connect to a fixed database (`carlos`). Representative files: `php/login.php`, `php/criar_mapa.php`, `php/listar_mapas.php`, `php/listar_elementos.php`, `php/salvar_elementos.php`, `php/get_mapa.php`, `php/deletar_mapa.php`, `php/deletar_elemento.php`.

This is a credential leak in the deployable web root. Even if the new modular APIs under `php/auth/`, `php/maps/`, etc. are the intended surface, these scripts remain reachable when the PHP built-in server or Apache/Nginx serves the `php/` directory. Several of them also reflect any `HTTP_Origin` with `Access-Control-Allow-Credentials: true` (e.g. `php/login.php` lines 4–5), reintroducing the credentialed CORS misconfiguration already fixed for the new stack in round 1.

Suggested fix:

1. Delete the legacy scripts from the web-served tree, or move them behind a non-deployed archive outside `php/`.
2. Never commit database passwords; use env-based config only (as `php/config.php` already does for the new stack).
3. Add a smoke check or deploy deny-list so `/php/login.php` and siblings are not served in production.

## Triage

- Decision: `valid`
- Root cause: `php/login.php` is a pre-feature script still served from the web root. It hardcodes PostgreSQL credentials (`cma352425`), connects to a fixed legacy database (`carlos`), and reflects any `HTTP_Origin` with `Access-Control-Allow-Credentials: true` — a credential leak plus credentialed CORS bypass already fixed for the modular stack in round 1.
- Fix approach: Remove `php/login.php` from the deployable tree. The client already uses `php/auth/login.php` with env-backed config (`php/config.php`) and allowlisted CORS (`php/lib/Auth/Cors.php`). Add a PHPUnit smoke test so the legacy root login script cannot be reintroduced with hardcoded credentials.
- Scope note: Other legacy root scripts (`criar_mapa.php`, etc.) still contain the same password pattern but are out of this batch; only `php/login.php` was in scope.
