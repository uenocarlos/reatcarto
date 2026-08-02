---
status: completed
title: Localização Brasil (IBGE + fallback)
type: frontend
complexity: high
---

# Task 4: Localização Brasil (IBGE + fallback)

## Overview
Entrega mapas de localização Brasil no preview: serviço de limites (IBGE online com fallback `public/geo/`), UI None/1/2 insets com UF/município pesquisáveis, overlays no mapa principal (outline, malha, cores) e entradas de legenda opcionais, com crédito IBGE condicional no rodapé. Completa US-010/US-011 e desbloqueia gates/export quando insets > 0.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST implement `BrazilBoundaryService` (`listStates`, `listMunicipalities`, `getLocatorGeometries`) calling IBGE from the browser with timeout, falling back to `public/geo/` when offline or API fails.
2. MUST ship a fallback bundle under `public/geo/` covering UF catalog, per-UF municipalities (simplified), SA/Brazil context, and `meta.json` reference label.
3. MUST support `locatorCount` 0 | 1 | 2: none; one state+muni inset; two insets (SA context + state+muni).
4. MUST require both state and municipality when count is 1 or 2 before export (gates already in task_01; UI MUST surface incompleteness).
5. MUST clear invalid municipality when state changes; reject municipality not in selected state; clear persisted codes missing from catalog.
6. MUST draw municipality outline on the main preview map with configurable colors; optional municipal mesh; optional state/municipality legend entries.
7. MUST NOT leave orphan location overlays when `locatorCount` is 0.
8. MUST show IBGE credit line in the institutional footer only when location geometry is used; surface fallback indication when online path fell back.
9. MUST throw/surface `BoundaryUnavailableError` when both IBGE and fallback fail for requested insets (block successful export path).
10. SHOULD keep municipality lists searchable/usable for all Brazilian municipalities over time.
</requirements>

## Subtasks
- [x] 4.1 Create `src/lib/export/brazilBoundaries.js` with IBGE + fallback source selection and errors
- [x] 4.2 Add `public/geo/` fallback assets (UFs, municipios by UF, SA context, meta)
- [x] 4.3 Build locator count UI (None/1/2) and searchable UF/municipality selectors
- [x] 4.4 Render `LocationInsets` for 1-map and 2-map layouts in the composition
- [x] 4.5 Apply main-map outline, mesh toggle, colors, and location legend entries
- [x] 4.6 Wire conditional IBGE footer credit and fallback warning when applicable
- [x] 4.7 Ensure gate-facing incompleteness messaging for missing UF/muni when count > 0
- [x] 4.8 Add Vitest fixtures under `tests/js/fixtures/geo/` and assigned IT/E2E coverage

## Implementation Details
Reference TechSpec `brazilBoundaries.js` interfaces, Integration Points (IBGE Localidades/Malhas), and ADR-009. No PHP proxy required in this delivery; if CORS blocks production, document follow-up without changing the service interface. Integrate into composition modules from task_03 (`CompositionPreview` / modal options).

### Relevant Files
- `src/lib/export/brazilBoundaries.js` — new boundary service (create)
- `public/geo/` — new static fallback GeoJSON bundle (create)
- `src/components/map/ExportMapModal.jsx` — options section for location maps
- `src/components/map/export/` — preview slots for insets and overlays (from task_03)
- `src/lib/export/exportSettings.js` — locator fields and gate inputs
- `tests/js/setup.js` — Vitest setup (fake fetch patterns)
- `tests/js/fixtures/geo/` — new GeoJSON fixtures for unit/integration tests

### Dependent Files
- `src/lib/export/pngExporter.js` — task_05 must wait on boundary readiness when insets requested
- Institutional footer component from task_03 — conditional IBGE line

### Related ADRs
- [ADR-002: Brazil-First Location Maps with Official Administrative Boundaries](adrs/adr-002.md) — None/1/2 Brazil insets
- [ADR-009: IBGE Online Boundaries with Static Fallback](adrs/adr-009.md) — IBGE + `public/geo/` + conditional credit
- [ADR-006: Layer Visibility, Tags, and Export Gates](adrs/adr-006.md) — location legend can satisfy content gate

## Deliverables
- Working IBGE-with-fallback boundary service and `public/geo/` bundle
- Locator UI and insets for 0/1/2 maps with main-map styling controls
- Conditional IBGE footer attribution
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-092, UT-093, UT-094, UT-095, UT-096, UT-097, UT-098, UT-099, UT-100, UT-101, UT-102, UT-103 — locator count descriptors, validation, state/muni coherence, boundary errors
- [x] UT-104, UT-105, UT-106, UT-107, UT-108, UT-109, UT-110, UT-111, UT-112, UT-113, UT-114, UT-115, UT-116 — main-map outline/mesh/colors/legend entries and performance boundaries
- [x] UT-181, UT-182, UT-183, UT-184, UT-185, UT-186 — IBGE vs fallback source selection, municipality list scoping, timeout fallback
- [x] IT-028, IT-030, IT-051 — inset UI wired to boundary service; searchable municipalities; online fail → fallback indication
- [x] E2E-010, E2E-011 — locator None/1/2 with UF+muni; location style on map/legend

## Success Criteria
- Every assigned test case implemented and passing
- With insets > 0, incomplete UF/muni blocks export via gates + visible guidance
- IBGE failure with available fallback still renders insets (`source: 'fallback'`)
- Both sources failing yields `BoundaryUnavailableError` (no silent empty insets claimed success)
- Footer IBGE line appears only when location is used
