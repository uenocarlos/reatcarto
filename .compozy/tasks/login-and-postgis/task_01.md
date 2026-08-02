---
status: completed
title: "Foundation: bootstrap, PostGIS schema, CLIs, and test harness"
type: infra
complexity: high
---

# Task 1: Foundation: bootstrap, PostGIS schema, CLIs, and test harness

## Overview
Delivers the shared PHP bootstrap, env-driven configuration, versioned PostgreSQL/PostGIS migrations, admin seed CLI, Vite `/php` proxy, and Vitest/PHPUnit harnesses that every later slice depends on. Without this contract the auth and map APIs cannot land on a consistent schema or test runner.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST introduce `php/config.php` and `php/bootstrap.php` loading DB, SMTP, `TERMS_VERSION`, `PRIVACY_VERSION`, uploads root, and secure session cookie flags from env.
2. MUST ship SQL migrations creating `users`, `maps`, `map_elements`, `photos`, auth token tables, `client_mutations`, `sessions_registry`, and `audit_events` with PostGIS `geometry(Geometry,4326)` on elements and GIST index.
3. MUST provide `php/bin/migrate.php` that applies pending migrations idempotently.
4. MUST provide `php/bin/seed_admin.php` that creates the first admin from env only when no admin exists (no-op otherwise).
5. MUST add Vite `server.proxy` for `/php` and document `.env.example` (no hardcoded DB credentials in new code).
6. MUST introduce Composer + PHPUnit and Vitest (`npm test`) skeletons ready for later task suites.
7. SHOULD leave legacy root `php/*.php` in place but unused by new bootstrap paths until later tasks replace them.
8. MUST implement and pass every assigned test case in `## Tests`.
</requirements>

## Subtasks
- [x] 1.1 Add env config and PHP bootstrap (PDO, JSON helpers, session flags, auth guard stubs)
- [x] 1.2 Author and apply versioned SQL migrations for the full normalized schema + PostGIS
- [x] 1.3 Implement `migrate.php` CLI with idempotent re-run behavior
- [x] 1.4 Implement `seed_admin.php` CLI with zero-or-one admin invariant
- [x] 1.5 Add `.env.example`, writable uploads directory convention, and Vite `/php` proxy
- [x] 1.6 Add `composer.json` / PHPUnit config and disposable PostGIS test bootstrap hooks
- [x] 1.7 Add Vitest config, `idb` dependency placeholder, and `npm test` script
- [x] 1.8 Implement assigned CLI unit tests (UT-168–170)

## Implementation Details
Follow TechSpec **Data Models**, **Ops CLIs**, ADR-008, ADR-011, and ADR-012. Replace inline PDO/credentials patterns from legacy `php/login.php` with env-backed bootstrap. Do not implement feature endpoints here beyond what migrate/seed need.

### Relevant Files
- `package.json` — add vitest, idb, `test` script
- `vite.config.js` — add `/php` proxy
- `php/login.php` — legacy session/PDO pattern to supersede
- `php/criar_mapa.php` (and sibling legacy scripts) — schema contrast vs normalized tables
- `.compozy/tasks/login-and-postgis/_techspec.md` — canonical schema and CLI contracts
- `.compozy/tasks/login-and-postgis/adrs/adr-008.md` — normalized PostGIS schema
- `.compozy/tasks/login-and-postgis/adrs/adr-011.md` — admin seed + identity reuse
- `.compozy/tasks/login-and-postgis/adrs/adr-012.md` — Vitest + PHPUnit strategy

### Dependent Files
- `php/config.php` — create
- `php/bootstrap.php` — create
- `php/bin/migrate.php` — create
- `php/bin/seed_admin.php` — create
- `php/migrations/*.sql` — create
- `.env.example` — create
- `composer.json`, `phpunit.xml`, `tests/php/` — create
- `vitest.config.js` — create

### Related ADRs
- [ADR-005: Durable Geospatial Records and Complete Account Deletion](adrs/adr-005.md) — PostGIS as authority
- [ADR-008: Versioned Normalized PostgreSQL/PostGIS Schema](adrs/adr-008.md) — migrations and tables
- [ADR-011: Admin Bootstrap Seed and Identity Reuse After Deletion](adrs/adr-011.md) — seed_admin CLI
- [ADR-012: Vitest and PHPUnit Test Strategy](adrs/adr-012.md) — harness introduction

## Deliverables
- Working migrate + seed_admin CLIs against PostGIS
- Shared bootstrap consumed by later PHP endpoints
- Dev proxy and env example
- Vitest and PHPUnit runners installed and runnable
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-168, UT-169, UT-170 — seed_admin creates admin only when none exists; migrate applies pending SQL idempotently on second run

## Success Criteria
- Every assigned test case implemented and passing
- `php php/bin/migrate.php` succeeds twice without schema drift errors
- `php php/bin/seed_admin.php` creates exactly one admin from env when none exist
- `npm test` and PHPUnit harnesses execute (even if only this task's cases yet)
- Later tasks can `require` bootstrap without inventing config
