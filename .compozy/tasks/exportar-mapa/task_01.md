---
status: completed
title: Contrato e persistência de export_settings
type: backend
complexity: medium
---

# Task 1: Contrato e persistência de export_settings

## Overview
Entrega o contrato de dados e a camada de normalização/validação para as preferências de composição por mapa: coluna `maps.export_settings`, escrita LWW sem bump de `version`, strip em payloads públicos, mirror IndexedDB e o módulo cliente `exportSettings` (defaults, normalize, prune, gates). Sem este slice, as demais tasks não têm onde hidratar nem persistir opções.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST add `maps.export_settings JSONB NOT NULL DEFAULT '{}'::jsonb` via a new migration after `005_auth_rate_limits.sql`.
2. MUST include `export_settings` in `format_map_record` and accept settings-only updates on the existing maps update path without requiring `base_version` and without incrementing `version`.
3. MUST enforce ownership on settings writes via the existing assert-owner path; non-owners MUST receive 403/404.
4. MUST reject non-object `export_settings` with the existing `validation_error` shape (400).
5. MUST strip `export_settings` from public map DTOs in `PublicService` so private composition prefs do not leak.
6. MUST implement `defaultExportSettings`, `normalizeExportSettings`, `pruneExportSettings`, `validateExportGates`, and `effectiveVisibleElements` per TechSpec typedefs and defaults table (including legacy `right` → `beside` and `{}` → `legendPosition: 'inside'`).
7. MUST mirror `export_settings` on cached maps in IndexedDB through the existing normalize/prepare map path so offline reopen restores settings.
8. SHOULD keep settings-only updates free of geometry conflict UI (silent LWW per ADR-007).
9. MUST retain in-memory settings usability for the session when a persist call fails (covered by unit/integration cases).
</requirements>

## Subtasks
- [x] 1.1 Add Postgres migration for `export_settings` JSONB on `maps`
- [x] 1.2 Extend `format_map_record` / get/list responses to expose `export_settings`
- [x] 1.3 Implement settings-only LWW update branch (no version bump; ownership required)
- [x] 1.4 Strip `export_settings` from public DTOs
- [x] 1.5 Create `src/lib/export/exportSettings.js` with defaults, normalize, prune, gates, and visibility helpers
- [x] 1.6 Wire IndexedDB / `normalizeMap` / offline prepare path to store and restore `export_settings`
- [x] 1.7 Add PHPUnit coverage for LWW, auth denials, validation, and public strip
- [x] 1.8 Add Vitest coverage for normalize/gates/prune/debounce helpers and client↔API round-trip

## Implementation Details
Follow TechSpec sections Core Interfaces, Data Models, and API Endpoints. Next migration file should be `php/migrations/006_*.sql`. Client module lives under new `src/lib/export/`. Debounce/flush helpers may live beside settings (used by task_02 wiring).

### Relevant Files
- `php/lib/Maps/MapService.php` — `format_map_record`, `maps_update`, ownership asserts
- `php/maps/update.php` — HTTP entry for map updates
- `php/lib/Public/PublicService.php` — public DTO formatting to strip settings
- `php/migrations/002_users_and_maps.sql` — base `maps` schema
- `php/migrations/005_auth_rate_limits.sql` — latest migration before this change
- `src/api/apiClient.js` — `normalizeMap` and `api.entities.Map.update`
- `src/lib/offline/OfflineStore.js` — IndexedDB prepared maps cache
- `src/lib/offline/offlineApi.js` — offline get/list/prepare map flows
- `tests/php/Maps/MapsCrudTest.php` — existing maps CRUD PHPUnit patterns
- `tests/php/MapsTestCase.php` — PHP test base
- `tests/js/maps.test.js` — Vitest API contract patterns
- `tests/js/offline.test.js` — OfflineStore / prepareOfflineMap patterns

### Dependent Files
- `php/lib/Sync/SyncService.php` — may call `maps_update`; confirm settings-only behavior remains safe
- `php/lib/Admin/AdminService.php` — reuses `maps_update`; ensure admin path does not regress
- `src/page/MapEditor.jsx` — will consume `export_settings` in task_02 (do not wire UI here beyond API/lib)

### Related ADRs
- [ADR-004: Live Preview and Per-Map Persistence of Export Settings](adrs/adr-004.md) — per-map persistence product rule
- [ADR-007: Server-Backed export_settings with IndexedDB Mirror](adrs/adr-007.md) — JSONB + LWW + IndexedDB
- [ADR-006: Layer Visibility, Tags, and Export Gates](adrs/adr-006.md) — gate semantics implemented in `validateExportGates`

## Deliverables
- Migration applying `export_settings` column with safe default `{}`
- MapService format + settings-only update + PublicService strip
- `src/lib/export/exportSettings.js` (and any small debounce helper colocated)
- IndexedDB mirror of `export_settings` on cached maps
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-157, UT-158, UT-159, UT-160, UT-161 — persist/load isolation, corruption → defaults, first-open defaults, large visibility arrays
- [x] UT-162, UT-163, UT-164, UT-165, UT-166, UT-167, UT-168, UT-169, UT-170, UT-171, UT-172, UT-173 — `validateExportGates` happy/error/boundary/state cases
- [x] UT-174, UT-175, UT-176, UT-177, UT-178, UT-179, UT-180 — defaults table, debounce/flush helpers, persist reject keeps memory, legacy `right`→`beside`, idempotent normalize
- [x] IT-040, IT-041, IT-042, IT-043, IT-044, IT-045 — debounced/settings-only update, IndexedDB mirror, user partition, LWW, persist 500 still session-usable, idempotent save
- [x] IT-047, IT-050 — map delete removes settings with map; client normalize → API → `format_map_record` round-trip
- [x] IT-052, IT-053, IT-054, IT-055 — PHPUnit settings-only without `base_version`, non-owner denied, invalid type 400, public DTO omits `export_settings`

## Success Criteria
- Every assigned test case implemented and passing
- Settings-only owner update leaves `version` unchanged
- Public payloads never include `export_settings`
- `normalizeExportSettings({})` matches TechSpec defaults including `legendPosition: 'inside'` and `dpi: 300`
- Offline cached map reopen exposes mirrored `export_settings`
