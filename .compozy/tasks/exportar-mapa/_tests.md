# Test Specification: Export Map

Canonical test contract for map export composition and download. Companion to `_techspec.md`.
Derived from `_user_stories.md` (behavior) and `_techspec.md` (components).

## Strategy

- Frameworks and harnesses: Vitest (`npm test` / `npm run test:unit`); React Testing Library for shell/entry components; pure modules under `src/lib/export/*` without browser map. Fakes only at I/O: `fetch` for geo, `html-to-image` / `jspdf` / download anchor, and Leaflet map constructors where shells mount.
- Execution: `vitest run` discovers `tests/js/**/*.test.{js,ts,jsx,tsx}` (per project Vitest config). PHPUnit not required for this client-only feature.
- Conventions: table-driven cases for clamp/paper; name files after component (`generateExport.test.js`, `ExportMapShell.test.jsx`); one primary assertion flavor per UT ID.

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|--------|----------|------|-------------|-----|
| US-001 | Open export from owner editor | UT-001 | IT-001 | E2E-001 |
| US-001.EC-1 | Zero elements still opens | UT-020 | IT-001 | E2E-001 |
| US-001.EC-2 | Blank map name → empty title field | UT-002 | IT-002 | — |
| US-001.EC-3 | Session expired blocks export open | — | IT-003 | E2E-002 |
| US-001.EC-4 | Double-open keeps single session | — | IT-004 | — |
| US-001.EC-5 | Large element list remains scrollable/responsive at open | — | IT-005 | — |
| US-002 | Export absent outside owner editor | — | IT-020 | E2E-003 |
| US-002.EC-1 | Crafted non-owner data path cannot compose private map | — | IT-021 | — |
| US-002.EC-2 | Unpublished public link / no export | — | IT-020 | E2E-003 |
| US-002.EC-3 | Deactivated account mid-session | — | IT-003 | — |
| US-002.EC-4 | No deep-link export route without owner | — | IT-020 | E2E-003 |
| US-003 | WYSIWYG preview reflects layout options | UT-010, UT-011 | IT-010 | E2E-004 |
| US-003.EC-1 | Tiles still loading → incomplete/loading, not silent garbage export | UT-040 | IT-011 | — |
| US-003.EC-2 | Rapid option changes converge to last values | UT-012 | IT-010 | — |
| US-003.EC-3 | Extremely long title wraps/truncates safely | UT-013 | — | — |
| US-003.EC-4 | Huge legend stays interactable; PNG guidance | UT-021 | IT-012 | — |
| US-004 | Title/authorship editable; fixed institutional footer | UT-003, UT-030 | IT-013 | E2E-004 |
| US-004.EC-1 | Empty title blocks download | UT-004 | IT-014 | — |
| US-004.EC-2 | Long authorship wraps in footer region | UT-031 | — | — |
| US-004.EC-3 | Special characters in title/authorship preserved | UT-005 | IT-015 | — |
| US-004.EC-4 | Cleared credits keep institutional footer + logo | UT-030 | IT-013 | — |
| US-005 | Format, paper, orientation, DPI | UT-006, UT-007, UT-008 | IT-016 | E2E-005 |
| US-005.EC-1 | DPI outside 72–600 clamped | UT-007 | — | — |
| US-005.EC-2 | Non-numeric DPI keeps previous | UT-008 | — | — |
| US-005.EC-3 | Generation failure at extreme DPI surfaces recovery | UT-041 | IT-017 | — |
| US-005.EC-4 | Format switch retains other settings | UT-009 | IT-016 | — |
| US-006 | Legend position and formatting | UT-022, UT-023 | IT-018 | E2E-004 |
| US-006.EC-1 | Empty thematic legend without crash | UT-020 | IT-018 | — |
| US-006.EC-2 | Six columns still layout | UT-024 | — | — |
| US-006.EC-3 | Font 8 + very compact dense | UT-025 | — | — |
| US-006.EC-4 | Legend drag/numeric metrics sticky until session end | UT-026 | IT-019 | — |
| US-007 | Layers, labels, basemap; cancel isolation | UT-014, UT-015 | IT-022, IT-023 | E2E-006 |
| US-007.EC-1 | All thematic layers off still exports basemap | UT-020 | IT-022 | — |
| US-007.EC-2 | Satellite credit still in fixed branding | UT-030 | — | — |
| US-007.EC-3 | Labels overlapping still exportable | — | IT-024 | — |
| US-007.EC-4 | Export uses open-session snapshot of elements | UT-016 | IT-025 | — |
| US-008 | Location insets 0–2 + styles | UT-050, UT-051 | IT-030 | E2E-007 |
| US-008.EC-1 | Geo load failure shows error; main map export without insets | UT-052 | IT-031 | — |
| US-008.EC-2 | Incomplete UF/município selection prompts or state-only rules | UT-053 | IT-032 | — |
| US-008.EC-3 | Two insets same UF allowed | UT-054 | — | — |
| US-008.EC-4 | Large mesh does not throw uncaught | — | IT-033 | — |
| US-008.EC-5 | Switch two→none clears location UI/preview | UT-055 | IT-030 | — |
| US-009 | Scale, north, graticule, frame; labels compose | UT-060 | IT-040 | E2E-004 |
| US-009.EC-1 | Extreme zoom still produces readable scale | UT-061 | — | — |
| US-009.EC-2 | Portrait/landscape chrome stays in frame | — | IT-041 | — |
| US-009.EC-3 | Low vs high DPI chrome present | — | IT-040 | — |
| US-010 | Download, progress, single-flight, recovery | UT-042, UT-043 | IT-050 | E2E-005 |
| US-010.EC-1 | Close during generate aborts/discards | UT-044 | IT-051 | — |
| US-010.EC-2 | Retry after success allowed | — | IT-052 | — |
| US-010.EC-3 | Tile network loss before capture fails/warns | UT-040 | IT-011 | — |
| US-010.EC-4 | Long generate keeps progress until done | — | IT-050 | — |
| US-010.EC-5 | Filename from title + extension | UT-045 | IT-015 | — |
| US-011 | Mobile full control reachability | — | IT-060 | E2E-008 |
| US-011.EC-1 | Landscape and portrait phone layouts | — | IT-060 | — |
| US-011.EC-2 | Keyboard/title field scrollable | — | IT-061 | — |
| US-011.EC-3 | Touch-safe legend metrics (numeric fallback) | UT-026 | IT-019 | — |
| US-011.EC-4 | OOM recovery path | UT-041 | IT-017 | — |
| US-012 | Cancel discards ephemeral config | UT-017 | IT-070 | E2E-006 |
| US-012.EC-1 | Reload drops session options | — | IT-071 | E2E-009 |
| US-012.EC-2 | Navigate away tears down export | — | IT-072 | — |
| US-012.EC-3 | Background while open keeps in-memory state | — | IT-073 | — |
| `createDefaultExportSession` | Defaults + inheritance | UT-001, UT-002, UT-014 | — | — |
| `clampDpi` / DPI input | Bounds + non-numeric | UT-007, UT-008 | — | — |
| `assertExportTitle` | Empty title gate | UT-004 | IT-014 | — |
| `mapEditorBasemapToExport` | Basemap keys | UT-015 | — | — |
| `buildLegendItems` | Legend from layers + location | UT-020–UT-025 | — | — |
| `loadGeoBoundaries` | Fetch, cache, error | UT-050–UT-052 | IT-031 | — |
| `generateExport` | Capture, PDF/PNG, abort, errors | UT-040–UT-045 | IT-050 | — |
| `ExportMapShell` | Lifecycle, debounce, single session | — | IT-001, IT-004, IT-010, IT-070 | — |
| `ExportEntry` / MapEditor | Owner-only control | — | IT-001, IT-020 | E2E-001, E2E-003 |
| Branding footer | Fixed copy + logo | UT-030 | IT-013 | — |
| No PHP export API | Non-goal surface | — | IT-021 | — |

## Unit Tests

### Session factory & inheritance (TechSpec: Core Interfaces / Data Models)

- **UT-001** (happy): `createDefaultExportSession(snapshot)` with mapName `"Estuário"`, basemap `"osm"`, hiddenIds `["e2"]`, center/zoom sample — returns title `"Estuário"`, format `"png"`, paper `"a4"`, orientation `"landscape"`, dpi `300`, legendPosition `"inside"`, locationCount `0`, basemap `"osm"`, hiddenIds containing `e2`.
- **UT-002** (boundary): snapshot mapName `""` — session title is `""` (empty string).
- **UT-014** (happy): snapshot basemap `"satelite"` and three elements IDs — session basemap `"satelite"` and hiddenIds equality with snapshot copy (not shared mutable Set identity if implementation clones).
- **UT-016** (state): session `elements`/legend builder continues to use the snapshot element array even if a later mutated external array would differ (export session holds its own reference or clone at open).
- **UT-017** (state): documenting pure rule — `createDefaultExportSession` called twice with different snapshots yields independent states (no module-level session singleton leaking options between opens).

### Title validation & filename (TechSpec: ADR-011 / generate)

- **UT-003** (happy): session with title and authorship strings flow to branding composition helpers without stripping institutional lines.
- **UT-004** (error): `assertExportTitle("   ")` returns/fails with code `empty_title`; `assertExportTitle("Mapa A")` succeeds.
- **UT-005** (happy): title `"Mapa \"Norte\" & <Sul>"` passes validation and `buildExportFileName(title, "png")` includes sanitized characters without path separators (`/` `\`) and ends with `.png`.
- **UT-045** (happy): `buildExportFileName("My Map", "pdf")` → filename ends with `.pdf` and embeds stable base from title.

### DPI & format retention (TechSpec: Data Models)

- **UT-006** (happy): default dpi from factory is `300`.
- **UT-007** (boundary): `clampDpi(50)` → `72`; `clampDpi(900)` → `600`; `clampDpi(150)` → `150`.
- **UT-008** (error): `clampDpi("abc", { previous: 300 })` retains `300` / reports non-numeric.
- **UT-009** (state): session reducer `setFormat("pdf")` then `setFormat("png")` keeps paper, orientation, dpi, legendPosition unchanged.
- **UT-013** (boundary): `truncateTitleForPreview` or CSS helper keeps long 500-char title from becoming empty string; length after format is bounded or retains wrap marker policy defined in module (assert non-throw + defined string).

### Preview sync helpers (TechSpec: ADR-010)

- **UT-010** (happy): debounce helper schedules one flush after N ms for multiple rapid inputs (fake timers: three updates → one subscriber call with last value).
- **UT-011** (happy): `flushPreviewSync()` invokes pending update immediately under fake timers.
- **UT-012** (ordering): ten rapid `setLegendColumns` updates end with columns `6` as last written value when flush runs.

### Basemap mapping

- **UT-015** (happy): `mapEditorBasemapToExport("branco")` → `"branco"`; `"osm"` → `"osm"`; `"satelite"` → `"satelite"`; unknown → `"branco"` fallback.

### Legend builder

- **UT-020** (happy/boundary): `buildLegendItems({ elements: [], hiddenIds: new Set(), location: null })` → `[]` (no throw).
- **UT-021** (boundary): 200 synthetic point elements visible → length 200; each has `label` and `symbolKind`.
- **UT-022** (happy): one visible point with style color/icon produces one legend item matching name and point kind.
- **UT-023** (happy): hidden element id excluded from items.
- **UT-024** (boundary): layout meta accepts `legendColumns: 6` without throwing (constants allow 1–6).
- **UT-025** (boundary): font px `8` and spacing `"very_compact"` valid; font `7` or `19` rejected/clamped per implemented policy (assert documented clamp or error).
- **UT-026** (state): applying `legendInside` metrics `{ xPct: 10, yPct: 20, wPct: 30, hPct: 40 }` returns same metrics from next state read.

### Branding

- **UT-030** (happy): `INSTITUTIONAL_FOOTER_LINES` includes ReatCarto copyright, basemap credits, REAT nucleus, and FURG strings; logo path is `/export/logoreat.png` (or project constant equal to that public path).
- **UT-031** (boundary): footer text helper does not drop institutional lines when authorship and technicalResponsible are empty strings.

### Geo boundaries

- **UT-050** (happy): `loadGeoBoundaries` with mocked fetch returning one UF and one município — normalized arrays non-empty; second call does not fetch again (cache).
- **UT-051** (happy): filter municipalities by UF `"RS"` returns only that UF's features from fixture.
- **UT-052** (error): fetch 404 → rejects/returns error object; cache not marked successful.
- **UT-053** (boundary): selection validator with `locationCount: 1` and `uf: null` reports incomplete selection.
- **UT-054** (happy): two locations both uf `"RS"` allowed by validator.
- **UT-055** (state): reducer setting `locationCount` from `2` to `0` clears or ignores location entries for preview intent (`locationCount === 0`).

### Map chrome helpers

- **UT-060** (happy): scale label helper at a mid zoom returns a non-empty unit string (m or km).
- **UT-061** (boundary): very low and very high zoom still return finite positive scale candidate lengths (no NaN).

### generateExport

- **UT-040** (error): when tile-ready probe returns incomplete and timeout elapses, `generateExport` throws/rejects with code `tiles`.
- **UT-041** (error): when capture library throws memory-like error, mapped code is `memory` or `capture` (documented mapping).
- **UT-042** (happy): png path calls `toPng`/`toCanvas` once and download helper once with MIME image/png.
- **UT-043** (happy): pdf path constructs jsPDF with orientation `landscape` and format `a4` (or letter/a3 as passed) and calls save/download once.
- **UT-044** (concurrency): with AbortSignal aborted mid-flight, result code `aborted` and no successful download call.

## Integration Tests

### Entry & shell

- **IT-001**: Mount `MapEditor` (or export host test double) with mocked owner map + empty elements; activate Export control; expect `ExportMapShell` visible with preview root and Cancel + Export actions.
- **IT-002**: Map name `""`; open export; title input value is empty.
- **IT-003**: Auth context without valid session (or map query 401/403 pattern used by product); export open blocked or shows authentication message; private elements not rendered into export map.
- **IT-004**: With shell open, second Export activation does not mount a second independent shell (single dialog/session).
- **IT-005**: Fixture of 500 elements; open export; layer/legend list container is present and overflow/scroll class or role allows scrolling (query scrollable region).

### Access boundaries

- **IT-020**: Render `PublicMapView` and `Gallery` fixtures; assert zero controls with accessible name matching export/print map composition (e.g. `/exportar/i`).
- **IT-021**: Assert no client module route register under `/export` that would load private elements without editor owner queries; owner-only data still goes through existing maps/elements client APIs (spy: export shell uses props/snapshot, not anonymous public elements endpoint for private maps).

### Preview & branding

- **IT-010**: Change legend position to `right` and title text; after debounce flush (fake timers), preview DOM reflects right layout class/region and updated title text.
- **IT-011**: Force map tile-ready false; trigger export; expect error UI and no successful download mock call.
- **IT-012**: 80 legend items; shell shows PNG-preference guidance copy when format is PDF (or always shows dense-legend hint when item count exceeds threshold defined in UI).
- **IT-013**: Authorship filled; institutional footer still contains fixed REAT/FURG lines and logo `img` src under `/export/`.
- **IT-014**: Clear title; click Export; assert validation message for empty title; generateExport not called.
- **IT-015**: Title with quotes; successful generate mock receives fileName containing sanitized base and correct extension.
- **IT-016**: Set paper A3, portrait, dpi 150, switch format to PDF; session still has A3/portrait/150; generate receives those options.
- **IT-017**: generateExport mock rejects `memory`; UI shows recovery message mentioning DPI or simplify; Export control re-enabled.

### Legend interaction

- **IT-018**: Select legend `bottom`; preview legend region bottom placement; toggle all layers hidden → legend thematic items empty without crash.
- **IT-019**: Change legend width via numeric control; state reflects new width; drag handler updating metrics (simulated pointer/callback) updates same store.

### Layers & cancel isolation

- **IT-022**: Open with one layer hidden; export layer toggle shows it hidden; turn all off; still can click Export with basemap (generate mock allowed with empty legend).
- **IT-023**: Editor basemap `"osm"`; open export; temporarily set basemap `"satelite"` in session; Cancel; editor controlled basemap remains `"osm"` (spy on editor state).
- **IT-024**: showLabels true with dense points fixture; generateExport still invoked successfully (mock capture resolves).
- **IT-025**: Open export; mutate parent elements list after open; legend still reflects open-time set if design freezes elements at open (assert freeze) or document refresh button resync policy if implemented — this contract freezes open snapshot (TechSpec): legend id set equals open snapshot, not post-mutation.

### Location insets

- **IT-030**: locationCount 2 shows two inset containers; set 0 hides them.
- **IT-031**: `loadGeoBoundaries` fails; UI shows geo error; with locationCount forced 0, Export can still run generate mock.
- **IT-032**: locationCount 1 without UF when required — Export blocked or incomplete selection message (match product rule implemented as prompt-to-finish).
- **IT-033**: large mesh fixture GeoJSON (high vertex count) added to inset map does not throw during mount.

### Map chrome

- **IT-040**: Preview main map region includes scale, north, and graticule elements/layers (role or test ids) and decorative frame class; labels toggle does not remove them.
- **IT-041**: orientation portrait applies portrait composition class/metrics without clipping chrome out of the composition root bounding box helper (getBoundingClientRect checks or class contract).

### Download lifecycle

- **IT-050**: Start export success path; during in-flight `isGenerating` disables Export; second click does not call generate twice; on resolve download once.
- **IT-051**: Abort/close while mock generate pending; expect abort and shell unmount without stuck overlay.
- **IT-052**: After success, Export enabled again; second generate call succeeds.

### Mobile layout

- **IT-060**: Viewport 390×844; all control group headings (textos, formato, papel, legenda, camadas, localização) reachable via scroll/query; then 844×390 landscape likewise.
- **IT-061**: Title input focus; container remains focusable/visible policy (no `display:none` of field).

### Session lifecycle

- **IT-070**: Change dpi to 120 and legend to right; Cancel; reopen; dpi is 300 and legend inside again; inheritance from current editor snapshot reapplied.
- **IT-071**: Simulate full remount of editor route (reload equivalent); no residual session module state from previous open (factory state empty).
- **IT-072**: Unmount MapEditor while shell open → no leftover open=true module flag; generate aborted if in flight.
- **IT-073**: Toggle a “document hidden” simulated event while open; session dpi remains user-changed (discard only on close).

## End-to-End Tests

### Owner export happy path (US-001, US-003, US-004, US-009)

- **E2E-001**: Authenticated owner opens `/editor/:mapId` → activates Exportar → preview shows title defaulting to map name, main map, footer logo → Cancel returns to editor still on same map.
- **E2E-004**: Owner opens export → sets title/authorship → moves legend to right → confirms scale/north/graticule/frame visible in preview → closes.

### Auth & public gates (US-001.EC-3, US-002)

- **E2E-002**: Session invalid/expired while on editor → attempting export surfaces auth failure per product (redirect/login or message) without silent private export.
- **E2E-003**: Anonymous gallery and public map view show no Export composition control; navigating only public routes never opens ExportMapShell.

### Format & download (US-005, US-010)

- **E2E-005**: Owner configures PNG A4 landscape 150 DPI with non-empty title → Export → browser download of `.png` (or test harness download interceptor) → switch PDF → Export → `.pdf` path attempted; progress visible during generation.

### Layers & cancel (US-007, US-012)

- **E2E-006**: Owner hides a layer in editor → opens export (layer starts hidden) → toggles layer visibility inside export only → Cancel → editor visibility matches pre-export editor state → reopen export resets ephemeral options to defaults + fresh inheritance.

### Location insets (US-008)

- **E2E-007**: Owner enables one inset → selects UF (and município if required) → preview shows inset → disables location maps → inset removed → successful PNG export still possible.

### Mobile (US-011)

- **E2E-008**: Narrow viewport owner export: scroll through all control groups, inspect preview, export at 150 DPI succeeds under normal mock tiles.

### Ephemeral lifecycle (US-012.EC-1)

- **E2E-009**: Owner changes export DPI mid-session → full page reload → opens export again → dpi default 300 (not previous custom value).
