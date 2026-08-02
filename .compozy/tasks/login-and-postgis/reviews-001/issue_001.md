---
provider: manual
pr:
round: 1
round_created_at: 2026-07-31T21:41:10Z
status: resolved
file: php/lib/Auth/Cors.php
line: 7
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: CORS reflects any Origin with credentials enabled

## Review Comment

`send_cors_headers()` copies arbitrary `HTTP_ORIGIN` into `Access-Control-Allow-Origin` while always sending `Access-Control-Allow-Credentials: true`. Every auth, map, sync, and admin endpoint calls this helper.

A malicious site can make credentialed cross-origin requests and read responses (including `/php/auth/me.php` and private map payloads) for users who have an active session cookie. Combining reflected origins with credentials is a classic CORS misconfiguration.

Suggested fix: maintain an explicit allowlist (e.g. `APP_BASE_URL` plus Capacitor origins from config). Echo `Access-Control-Allow-Origin` only when the request origin matches; otherwise omit ACAO or reject. Add `Vary: Origin`. Never pair `Allow-Credentials: true` with `*`.

## Triage

- Decision: `valid`
- Root cause: `send_cors_headers()` reflected any `HTTP_ORIGIN` value and always emitted `Access-Control-Allow-Credentials: true`, including the invalid `Access-Control-Allow-Origin: *` fallback when no Origin header was present. Browsers honor reflected origins with credentials, so a malicious site could read authenticated API responses for logged-in users.
- Fix: Build an explicit allowlist from `APP_BASE_URL`, optional comma-separated `CORS_ALLOWED_ORIGINS`, and default Capacitor WebView origins. Echo `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials` only for allowlisted origins; omit both otherwise. Always send `Vary: Origin` and never pair credentials with `*`.
- Verification: Added `tests/php/Auth/CorsTest.php`; ran `composer test` (243 tests, 0 failures), `npm run lint`, `npm run typecheck`, and `npm test` (79 tests, 0 failures).
