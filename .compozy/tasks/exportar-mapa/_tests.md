# Test Specification: Map Export Composition (Exportar Mapa)

Canonical test contract for map export preview, options, PNG delivery, legend/layout, basemap, and Brazil location insets. Companion to `_techspec.md`.
Derived from `_user_stories.md` (behavior) and `_techspec.md` (components).

## Strategy

- Frameworks and harnesses: **Vitest** (`tests/js/`) with jsdom, fake `fetch` for IBGE, fixture GeoJSON, mocked `html2canvas`, mocked Capacitor `Filesystem`/`Share`/`Capacitor.isNativePlatform`; **PHPUnit** (`tests/php/`) for `maps_update` export_settings LWW and public DTO stripping. Fakes only at I/O boundaries.
- Execution: `npm test` / `npm run test:unit`; PHPUnit via project PHP test command.
- Conventions: one observable behavior per ID; tag unit classes; never assert success when capture/basemap/boundary failed.

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
| --- | --- | --- | --- | --- |
| US-001 | Open export from editor | UT-001, UT-002 | IT-001 | E2E-001 |
| US-001.EC-1 | Invalid activation params | UT-003 | — | — |
| US-001.EC-2 | Empty map still opens | UT-004 | — | — |
| US-001.EC-3 | Large element count opens | — | IT-002 | — |
| US-001.EC-4 | Session expired on open | — | IT-003 | — |
| US-001.EC-5 | Double open → one instance | UT-005 | — | — |
| US-001.EC-6 | Offline open with cached map | — | IT-004 | — |
| US-001.EC-7 | Reopen after cancel | — | IT-005 | — |
| US-001.EC-8 | Open before map loaded | UT-006 | — | — |
| US-001.EC-9 | Ownership lost while open | — | IT-006 | — |
| US-001.EC-10 | Only current map settings | UT-007 | — | — |
| US-002 | No public/anonymous export | UT-008 | IT-007 | E2E-002 |
| US-002.EC-1 | Crafted export path rejected | — | IT-008 | — |
| US-002.EC-2 | Missing public map | — | IT-009 | — |
| US-002.EC-3 | Repeated unauthorized attempts | — | IT-010 | — |
| US-002.EC-4 | Non-owner authenticated | — | IT-011 | — |
| US-002.EC-5 | Unpublish while viewing | — | IT-012 | — |
| US-002.EC-6 | Network loss on public view | UT-009 | — | — |
| US-002.EC-7 | Retry denied export | — | IT-013 | — |
| US-002.EC-8 | Login without ownership | — | IT-014 | — |
| US-002.EC-9 | Moderated/deleted public map | — | IT-015 | — |
| US-002.EC-10 | High anonymous traffic (no export) | UT-010 | — | — |
| US-003 | Title, author, technical responsible | UT-011, UT-012, UT-013 | — | E2E-003 |
| US-003.EC-1 | Hostile/long text sanitized | UT-014 | — | — |
| US-003.EC-2 | Blank title/author | UT-015 | — | — |
| US-003.EC-3 | Title wrap on paper | UT-016 | — | — |
| US-003.EC-4 | Non-owner cannot edit | — | IT-016 | — |
| US-003.EC-5 | Two devices LWW settings | — | IT-017 | — |
| US-003.EC-6 | App close mid-typing restore | — | IT-018 | — |
| US-003.EC-7 | Clear and re-enter | UT-017 | — | — |
| US-003.EC-8 | Export uses current field values | UT-018 | — | — |
| US-003.EC-9 | Switch maps no metadata leak | UT-019 | — | — |
| US-003.EC-10 | Long author/responsible footer | UT-020 | — | — |
| US-004 | Legend inside/beside/below | UT-021, UT-022, UT-023 | — | E2E-004 |
| US-004.EC-1 | Unknown position → default | UT-024 | — | — |
| US-004.EC-2 | No legend items | UT-025 | — | — |
| US-004.EC-3 | Many items grow composition | UT-026 | — | — |
| US-004.EC-4 | Non-owner | — | IT-019 | — |
| US-004.EC-5 | Rapid position switching | UT-027 | — | — |
| US-004.EC-6 | Render failure mid-switch | UT-028 | — | — |
| US-004.EC-7 | Re-select same position | UT-029 | — | — |
| US-004.EC-8 | Position before items load | UT-030 | — | — |
| US-004.EC-9 | Inside→beside→inside geometry | UT-031 | — | — |
| US-004.EC-10 | Dense legend + appearance | UT-032 | — | — |
| US-005 | Inside drag/resize | UT-033, UT-034, UT-035 | — | E2E-005 |
| US-005.EC-1 | Clamp outside map | UT-036 | — | — |
| US-005.EC-2 | Empty inside legend | UT-037 | — | — |
| US-005.EC-3 | Min/max resize clamp | UT-038 | — | — |
| US-005.EC-4 | Read-only no drag | — | IT-020 | — |
| US-005.EC-5 | Concurrent pointer updates | UT-039 | — | — |
| US-005.EC-6 | Touch cancel mid-drag | UT-040 | — | — |
| US-005.EC-7 | Repeated resize stable | UT-041 | — | — |
| US-005.EC-8 | Drag while leaving inside | UT-042 | — | — |
| US-005.EC-9 | Restore legendRect | UT-043 | — | — |
| US-005.EC-10 | Phone-width manipulable | — | IT-021 | — |
| US-006 | Columns, font, spacing | UT-044, UT-045, UT-046 | — | E2E-006 |
| US-006.EC-1 | Out-of-range clamp | UT-047 | — | — |
| US-006.EC-2 | No items controls visible | UT-048 | — | — |
| US-006.EC-3 | 6 columns long labels | UT-049 | — | — |
| US-006.EC-4 | Non-owner | — | IT-022 | — |
| US-006.EC-5 | Rapid slider | UT-050 | — | — |
| US-006.EC-6 | Render failure extreme settings | UT-051 | — | — |
| US-006.EC-7 | Toggle spacing | UT-052 | — | — |
| US-006.EC-8 | Font + position together | UT-053 | — | — |
| US-006.EC-9 | Persist appearance | UT-054 | — | — |
| US-006.EC-10 | Dozens of items | UT-055 | — | — |
| US-007 | Category/element visibility | UT-056, UT-057, UT-058, UT-059 | — | E2E-007 |
| US-007.EC-1 | Stale element id ignored | UT-060 | — | — |
| US-007.EC-2 | Zero elements list empty | UT-061 | — | — |
| US-007.EC-3 | Hundreds of toggles | UT-062 | — | — |
| US-007.EC-4 | Non-owner | — | IT-023 | — |
| US-007.EC-5 | Toggle during re-render | UT-063 | — | — |
| US-007.EC-6 | Style load failure fallback | UT-064 | — | — |
| US-007.EC-7 | Repeated toggle | UT-065 | — | — |
| US-007.EC-8 | Category-off overrides child on | UT-066 | — | — |
| US-007.EC-9 | Deleted element cleanup | UT-067 | — | — |
| US-007.EC-10 | All hidden blocks export | UT-068 | — | — |
| US-008 | Global tags | UT-069, UT-070, UT-071 | — | E2E-008 |
| US-008.EC-1 | Hostile name as text | UT-072 | — | — |
| US-008.EC-2 | Blank name no tag | UT-073 | — | — |
| US-008.EC-3 | Overlapping tags still render | UT-074 | — | — |
| US-008.EC-4 | Non-owner | — | IT-024 | — |
| US-008.EC-5 | Toggle while pan | UT-075 | — | — |
| US-008.EC-6 | Interrupt preview vs export | UT-076 | — | — |
| US-008.EC-7 | Rapid tag toggle | UT-077 | — | — |
| US-008.EC-8 | Tags before elements load | UT-078 | — | — |
| US-008.EC-9 | Persist showTags | UT-079 | — | — |
| US-008.EC-10 | Long name tags | UT-080 | — | — |
| US-009 | Basemap including offline | UT-081, UT-082, UT-083 | IT-025 | E2E-009 |
| US-009.EC-1 | Unknown basemap → carto | UT-084 | — | — |
| US-009.EC-2 | Empty offline tiles | UT-085 | — | — |
| US-009.EC-3 | Partial offline coverage | UT-086 | — | — |
| US-009.EC-4 | Non-owner | — | IT-026 | — |
| US-009.EC-5 | Rapid basemap switch | UT-087 | — | — |
| US-009.EC-6 | Online tile network failure | UT-088 | — | — |
| US-009.EC-7 | Re-select same basemap | UT-089 | — | — |
| US-009.EC-8 | Export before tiles ready | UT-090 | — | — |
| US-009.EC-9 | Persist basemap | UT-091 | — | — |
| US-009.EC-10 | High DPI satellite progress | — | IT-027 | — |
| US-010 | Locator None/1/2 | UT-092, UT-093, UT-094, UT-095 | IT-028 | E2E-010 |
| US-010.EC-1 | Municipality not in state | UT-096 | — | — |
| US-010.EC-2 | Missing state or municipality | UT-097 | — | — |
| US-010.EC-3 | Detailed boundary simplifies | UT-098 | — | — |
| US-010.EC-4 | Non-owner | — | IT-029 | — |
| US-010.EC-5 | State change clears stale muni | UT-099 | — | — |
| US-010.EC-6 | Boundary fetch fails | UT-100 | — | — |
| US-010.EC-7 | Switch None↔1↔2 | UT-101 | — | — |
| US-010.EC-8 | Municipality before state | UT-102 | — | — |
| US-010.EC-9 | Persisted code missing in catalog | UT-103 | — | — |
| US-010.EC-10 | Searchable municipality list | — | IT-030 | — |
| US-011 | Location style on map/legend | UT-104, UT-105, UT-106, UT-107 | — | E2E-011 |
| US-011.EC-1 | Invalid colors → defaults | UT-108 | — | — |
| US-011.EC-2 | Insets None no orphan overlays | UT-109 | — | — |
| US-011.EC-3 | Mesh at wide zoom usable | UT-110 | — | — |
| US-011.EC-4 | Non-owner | — | IT-031 | — |
| US-011.EC-5 | Color while loading | UT-111 | — | — |
| US-011.EC-6 | Mesh apply failure | UT-112 | — | — |
| US-011.EC-7 | Toggle legend checkboxes | UT-113 | — | — |
| US-011.EC-8 | Legend before selection | UT-114 | — | — |
| US-011.EC-9 | Change municipality updates | UT-115 | — | — |
| US-011.EC-10 | Large-state mesh performance | UT-116 | — | — |
| US-012 | Paper, orientation, DPI | UT-117, UT-118, UT-119 | — | E2E-012 |
| US-012.EC-1 | Unsupported paper/DPI clamp | UT-120 | — | — |
| US-012.EC-2 | Missing DPI → 300 | UT-121 | — | — |
| US-012.EC-3 | Max DPI memory failure | UT-122 | — | — |
| US-012.EC-4 | Non-owner | — | IT-032 | — |
| US-012.EC-5 | DPI change mid-export | UT-123 | — | — |
| US-012.EC-6 | Cancel high DPI | UT-124 | — | — |
| US-012.EC-7 | Re-export same settings | UT-125 | — | — |
| US-012.EC-8 | Orientation + inside legend | UT-126 | — | — |
| US-012.EC-9 | Persist orientation | UT-127 | — | — |
| US-012.EC-10 | Large paper + satellite | — | IT-033 | — |
| US-013 | Live preview | UT-128, UT-129 | — | E2E-013 |
| US-013.EC-1 | Conflicting options coherent | UT-130 | — | — |
| US-013.EC-2 | Loading indicators | UT-131 | — | — |
| US-013.EC-3 | Coalesce rapid changes | UT-132 | — | — |
| US-013.EC-4 | Non-owner no preview | — | IT-034 | — |
| US-013.EC-5 | Overlapping renders | UT-133 | — | — |
| US-013.EC-6 | Render error visible | UT-134 | — | — |
| US-013.EC-7 | Reopen builds from settings | — | IT-035 | — |
| US-013.EC-8 | Options before data ready | UT-135 | — | — |
| US-013.EC-9 | Basemap mid-preview | UT-136 | — | — |
| US-013.EC-10 | Phone-width layout | — | IT-036 | — |
| US-014 | Institutional footer/logo | UT-137, UT-138 | — | E2E-014 |
| US-014.EC-1 | Broken logo → text remains | UT-139 | — | — |
| US-014.EC-2 | Blank responsible still footer | UT-140 | — | — |
| US-014.EC-3 | Narrow width wrap | UT-141 | — | — |
| US-014.EC-4 | N/A permissions | — | — | — |
| US-014.EC-5 | N/A concurrency | — | — | — |
| US-014.EC-6 | Logo fail during export | UT-142 | — | — |
| US-014.EC-7 | Multiple exports consistent | UT-143 | — | — |
| US-014.EC-8 | Metadata updates footer live | UT-144 | — | — |
| US-014.EC-9 | N/A state | — | — | — |
| US-014.EC-10 | High DPI logo | UT-145 | — | — |
| US-015 | PNG export download/share | UT-146, UT-147 | IT-037, IT-038 | E2E-015 |
| US-015.EC-1 | Gates fail → no file | UT-148 | — | — |
| US-015.EC-2 | Preview element missing | UT-149 | — | — |
| US-015.EC-3 | Huge canvas failure | UT-150 | — | — |
| US-015.EC-4 | Session ends mid-export | — | IT-039 | — |
| US-015.EC-5 | Double-click export once | UT-151 | — | — |
| US-015.EC-6 | Dismiss during generation | UT-152 | — | — |
| US-015.EC-7 | Export again after success | UT-153 | — | — |
| US-015.EC-8 | Option change mid-generation | UT-154 | — | — |
| US-015.EC-9 | PDF not offered | UT-155 | — | — |
| US-015.EC-10 | Long generation indicator | UT-156 | — | — |
| US-016 | Per-map persistence | UT-157, UT-158 | IT-040, IT-041 | E2E-016 |
| US-016.EC-1 | Corrupted settings → defaults | UT-159 | — | — |
| US-016.EC-2 | First open defaults | UT-160 | — | — |
| US-016.EC-3 | Many visibility flags load | UT-161 | — | — |
| US-016.EC-4 | Other user no access | — | IT-042 | — |
| US-016.EC-5 | Two-device LWW | — | IT-043 | — |
| US-016.EC-6 | Save fails; session export ok | — | IT-044 | — |
| US-016.EC-7 | Idempotent identical save | — | IT-045 | — |
| US-016.EC-8 | Export before flush restores | — | IT-046 | — |
| US-016.EC-9 | Map deleted settings gone | — | IT-047 | — |
| US-016.EC-10 | Many maps fast open | — | IT-048 | — |
| US-017 | Export gates | UT-162, UT-163, UT-164, UT-165 | — | E2E-017 |
| US-017.EC-1 | Whitespace-only title/author | UT-166 | — | — |
| US-017.EC-2 | Blank responsible ok | UT-167 | — | — |
| US-017.EC-3 | N/A limits | — | — | — |
| US-017.EC-4 | Non-owner never succeeds | — | IT-049 | — |
| US-017.EC-5 | Fix gate then new attempt | UT-168 | — | — |
| US-017.EC-6 | Network ≠ gate | UT-169 | — | — |
| US-017.EC-7 | Repeat blocked export | UT-170 | — | — |
| US-017.EC-8 | Location legend satisfies content | UT-171 | — | — |
| US-017.EC-9 | Insets→None drops locator gate | UT-172 | — | — |
| US-017.EC-10 | Multiple gate messages | UT-173 | — | — |
| ExportSettingsStore | normalize/prune/persist | UT-174–UT-180 | IT-050 | — |
| ExportGates | validateExportGates | UT-162–UT-173 | — | — |
| BrazilBoundaryService | IBGE vs fallback | UT-181–UT-186 | IT-051 | — |
| PngExporter | capture/delivery | UT-146–UT-156 | IT-037, IT-038 | — |
| MapService export_settings | LWW API | — | IT-052, IT-053, IT-054 | — |
| PublicService | strip settings | — | IT-055 | — |
| LegendFrame | clamp/layout | UT-033–UT-043 | — | — |
| CompositionPreview | paper aspect | UT-117–UT-119 | — | — |

Rows marked N/A under Unit/Integration/E2E with empty cells document story edges that need no automated case beyond the parent story coverage (explicit non-applicable product edges).

## Unit Tests

### Export entry / access (TechSpec: MapEditor export entry)

- **UT-001** (happy): Export action handler — given owned map loaded, invoking open sets modal `open === true` with options+preview props.
- **UT-002** (happy): Cancel — given open modal, `onClose` sets `open === false` and does not call `exportCompositionPng`.
- **UT-003** (error): Open with missing `mapId` — does not mount broken modal; editor remains.
- **UT-004** (boundary): Open with `elements=[]` — modal opens; gates still evaluated later.
- **UT-005** (concurrency): Two rapid open calls — single `showExport === true` (idempotent set).
- **UT-006** (ordering): Open while `mapData` null — shows loading/disabled export until map ready (no empty crash).
- **UT-007** (state): Settings loader keyed by `mapId` — switching `mapA`→`mapB` does not keep `mapA.export_settings`.
- **UT-008** (happy): `PublicMapView` / gallery — export composition control absent from render tree.
- **UT-009** (state): Public view offline — still no export control mounted.
- **UT-010** (boundary): Public route helpers — `canOpenExport({ isOwner: false }) === false`.

### Metadata (TechSpec: ExportSettings / CompositionPreview)

- **UT-011** (happy): Title non-empty — preview header text equals trimmed title.
- **UT-012** (happy): Author set — footer includes author line.
- **UT-013** (happy): Technical responsible set — footer includes responsible line; blank omits line.
- **UT-014** (error): Title containing `<script>` — rendered as text content only (no HTML execution).
- **UT-015** (boundary): `validateExportGates` with `title:'   '` — error on title.
- **UT-016** (boundary): Very long title — layout helper wraps within paper width without throwing.
- **UT-017** (state): Clear title then set again — preview shows latest string.
- **UT-018** (ordering): Gate validation reads in-memory settings object at click time (not stale ref).
- **UT-019** (state): `normalizeExportSettings` isolated per map id in store selector.
- **UT-020** (boundary): Extremely long author — footer layout function returns without overlapping logo bounds beyond documented max.

### Legend layout & appearance

- **UT-021** (happy): `legendPosition:'inside'` — layout mode `inside`.
- **UT-022** (happy): `beside` — legend outside map; composition width grows.
- **UT-023** (happy): `below` — legend outside map; composition height grows.
- **UT-024** (error): Raw `'right'` or unknown — normalizes to `beside` or default `inside` for empty settings first-open rule (`{}` → `inside`).
- **UT-025** (boundary): No legend items — legend region empty; gate content rule applies.
- **UT-026** (boundary): 40 legend items + `below` — composition height ≥ map+legend.
- **UT-027** (concurrency): Rapid position updates — final state equals last value.
- **UT-028** (error): Layout throw — exporter does not mark success.
- **UT-029** (idempotency): Setting `below` twice — stable layout metrics.
- **UT-030** (ordering): Position set before elements arrive — layout applies when items exist.
- **UT-031** (state): Leaving `inside` with custom `legendRect` then returning — usable inside frame restored (saved rect or default).
- **UT-032** (boundary): Dense items with columns=6 — grid uses 6 columns.
- **UT-033** (happy): Drag delta inside map — `legendRect` updates within [0,1] clamps.
- **UT-034** (happy): Resize inside — width/height clamp to min/max constants.
- **UT-035** (happy): Position `beside` — drag handlers not active for free map placement.
- **UT-036** (boundary): Drag would set x<0 — clamps to 0.
- **UT-037** (boundary): Empty inside legend — no blocking oversized empty frame (minimal or hidden).
- **UT-038** (boundary): Resize below min — equals min size.
- **UT-039** (concurrency): Two pointer moves — last wins coherent rect.
- **UT-040** (state): Pointer cancel — rect stays last valid.
- **UT-041** (idempotency): Repeated identical resize — same rect.
- **UT-042** (ordering): Mid-drag switch to `below` — ends inside interaction; external layout used.
- **UT-043** (state): Restore `{x:0.1,y:0.2,w:0.3,h:0.4}` — applied when valid.
- **UT-044** (happy): columns=4 — legend grid columns 4.
- **UT-045** (happy): font 14 — legend text style 14px.
- **UT-046** (happy): spacing `wide` — gap tokens match wide map.
- **UT-047** (boundary): columns=99 → 6; font=3 → 8; font=40 → 18.
- **UT-048** (boundary): Empty items — controls remain in settings model.
- **UT-049** (boundary): Long label + 6 columns — swatch still present (no zero-size swatch).
- **UT-050** (concurrency): Rapid font changes — last font wins.
- **UT-051** (error): Capture with absurd DPI after clamp still may throw — success not claimed.
- **UT-052** (state): compact→normal→wide — spacing token tracks selection.
- **UT-053** (ordering): font then position — both reflected in layout snapshot.
- **UT-054** (state): normalize round-trip preserves columns/font/spacing.
- **UT-055** (boundary): 60 items + columns=3 — returns 3-column flow without throw.

### Visibility & tags

- **UT-056** (happy): Hide category `terra` — all `element_category==='terra'` absent from effective visible list and legend.
- **UT-057** (happy): Hide one element id — only that id absent.
- **UT-058** (happy): Re-show element — appears with style.
- **UT-059** (happy): Hiding for export does not mutate source `elements` array identities/content.
- **UT-060** (error): `hiddenElementIds` includes deleted id — `pruneExportSettings` drops it.
- **UT-061** (boundary): No elements — effective list empty.
- **UT-062** (boundary): 300 ids toggle map — `effectiveVisibleElements` completes.
- **UT-063** (concurrency): Last toggle wins in reducer.
- **UT-064** (error): Invalid style JSON — element skipped or safe fallback without throwing whole preview.
- **UT-065** (idempotency): Toggle off-on-off — ends hidden.
- **UT-066** (ordering): Category off then child “on” — child remains hidden until category on.
- **UT-067** (state): Element removed from map — prune removes id from hidden list.
- **UT-068** (boundary): All elements hidden and no location legend — `validateExportGates` content error.
- **UT-069** (happy): `showTags:true` — named visible elements produce tag descriptors.
- **UT-070** (happy): `showTags:false` — no tag descriptors.
- **UT-071** (happy): Hidden element — no tag even if `showTags`.
- **UT-072** (error): Name with HTML — tag text escaped/plain.
- **UT-073** (boundary): Name `''` — no tag entry.
- **UT-074** (boundary): 20 overlapping points — still returns 20 tag entries (no collision engine required).
- **UT-075** (concurrency): Tag toggle last value wins.
- **UT-076** (state): Export snapshot tags match settings captured at export start.
- **UT-077** (idempotency): Rapid toggle ends on last boolean.
- **UT-078** (ordering): Tags enabled before load — tags appear once elements present.
- **UT-079** (state): Persist/restore `showTags:true`.
- **UT-080** (boundary): 500-char name — tag string present, no throw.

### Basemap & scale

- **UT-081** (happy): `basemap:'carto'|'osm'|'satellite'` — tile URL resolver returns Carto/OSM/ArcGIS respectively (not Google).
- **UT-082** (happy): Native + `offline` — uses `getLocalTileUrl` paths.
- **UT-083** (error): Web + `offline` — option disabled / `isOfflineBasemapAvailable()===false`.
- **UT-084** (error): Unknown basemap `'foo'` → `'carto'`.
- **UT-085** (error): Offline selected and `getLocalTileUrl` null for required tiles — readiness `unusable`.
- **UT-086** (boundary): Partial tiles — readiness reports incomplete; export success blocked if policy requires usable basemap.
- **UT-087** (concurrency): Rapid basemap changes — final basemap last selected.
- **UT-088** (error): Tile error event — preview error flag set; exporter refuses success.
- **UT-089** (idempotency): Re-select `osm` — stable URL.
- **UT-090** (ordering): `exportCompositionPng` before ready — waits or throws `ExportCaptureError`, no success.
- **UT-091** (state): Restore `basemap:'satellite'`.
- **UT-092** (happy): `locatorCount:0` — no insets; no state/muni required.
- **UT-093** (happy): count 1 + UF+muni — one inset descriptor state+muni.
- **UT-094** (happy): count 2 — two insets (context + state/muni).
- **UT-095** (error): count 2 missing muni — gate error on municipality.
- **UT-096** (error): muni code not in state list — rejected/cleared.
- **UT-097** (boundary): state set, muni null, count 1 — gate fails.
- **UT-098** (boundary): Oversized polygon fixture — service returns geometry without throw (simplification allowed).
- **UT-099** (state): Change state — municipality cleared if invalid.
- **UT-100** (error): IBGE fail + fallback miss — `BoundaryUnavailableError`.
- **UT-101** (state): None→1→2→None — descriptors match count.
- **UT-102** (ordering): Setting muni before state — muni not kept without valid state.
- **UT-103** (state): Persisted muni absent from catalog — requires reselect (cleared + gate).
- **UT-104** (happy): Selected muni — main map outline style uses `municipalityColor`.
- **UT-105** (happy): `showStateInLegend:true` — legend items include state entry.
- **UT-106** (happy): `showMunicipalMesh:true` — mesh layer flagged on.
- **UT-107** (happy): Color change — legend swatch matches.
- **UT-108** (error): color `'notahex'` → default color.
- **UT-109** (state): `locatorCount:0` — no outline/mesh/location legend orphans.
- **UT-110** (boundary): Mesh request at low zoom — returns without hang (async completes).
- **UT-111** (concurrency): Color set while loading — final color on loaded geom.
- **UT-112** (error): Mesh failure — error flag; export not success.
- **UT-113** (state): Toggle state legend off — entry removed.
- **UT-114** (ordering): Legend flags before selection — entries appear after selection exists.
- **UT-115** (state): New muni code — outline name/geometry update.
- **UT-116** (boundary): Large UF mesh fixture — completes under test timeout.
- **UT-117** (happy): A4 landscape — preview aspect matches A4 landscape ratio (±epsilon).
- **UT-118** (happy): dpi 300 — html2canvas scale factor `300/96`.
- **UT-119** (happy): Restore paper Letter portrait — settings round-trip.
- **UT-120** (boundary): paper `'A2'` → `A4`; dpi 10 → 72; dpi 9999 → 600.
- **UT-121** (boundary): missing dpi → 300.
- **UT-122** (error): html2canvas throws OOM — `ExportCaptureError`; no success toast path.
- **UT-123** (concurrency): In-flight export uses dpi captured at start (closure), not later state.
- **UT-124** (state): Cancel/dismiss mid-export — no success callback.
- **UT-125** (idempotency): Second export invokes capture again.
- **UT-126** (state): Orientation change reclamps inside `legendRect` into new map frame.
- **UT-127** (state): Persist orientation landscape.
- **UT-128** (happy): Option change updates preview model without requiring refresh button (refresh optional/absent).
- **UT-129** (happy): Preview model includes graticule, dynamic scale, north, footer flags.
- **UT-130** (error): Blocked gates — preview may render but exportDisabled true with messages.
- **UT-131** (state): Boundaries loading — `previewStatus:'loading'`.
- **UT-132** (concurrency): Coalesced updates end on latest settings hash.
- **UT-133** (concurrency): Overlapping render generations — only latest committed.
- **UT-134** (error): Render error — `previewStatus:'error'`.
- **UT-135** (ordering): Settings applied when elements arrive.
- **UT-136** (state): Basemap switch updates tile layer key.
- **UT-137** (happy): Footer always includes RealCarto/(R)EAT/FURG lines.
- **UT-138** (happy): Location used — IBGE credit line present; unused — absent.
- **UT-139** (error): Logo image onError — text mark remains.
- **UT-140** (boundary): Empty responsible — institutional block still present.
- **UT-141** (boundary): Narrow width footer — wraps without throw.
- **UT-142** (error): Logo fail at export — documented fallback or fail; never omit all attribution text.
- **UT-143** (idempotency): Two footer snapshots equal for same settings.
- **UT-144** (state): Author change updates footer props live.
- **UT-145** (boundary): High DPI scale — logo element still in composition tree.
- **UT-146** (happy): Gates pass — `exportCompositionPng` called with preview element.
- **UT-147** (happy): Web path — creates download link with `image/png` data URL (mocked).
- **UT-148** (error): Gates fail — exporter not called.
- **UT-149** (error): `previewEl` null — throws/toasts failure.
- **UT-150** (error): canvas too large throw — failure path.
- **UT-151** (concurrency): Second export while `isExporting` — ignored/queued rejection.
- **UT-152** (state): Dismiss sets abort; success suppressed.
- **UT-153** (idempotency): After success, new export allowed.
- **UT-154** (ordering): Capture config frozen at start.
- **UT-155** (state): Format options list equals `['png']` only.
- **UT-156** (state): `isExporting` true until resolve/reject.
- **UT-157** (happy): Save settings then load — deep equal normalized.
- **UT-158** (happy): mapA vs mapB settings isolation.
- **UT-159** (error): corrupted JSON `'not-json'` / wrong types → defaults.
- **UT-160** (boundary): `{}` → defaultExportSettings including `legendPosition:'inside'`, dpi 300.
- **UT-161** (boundary): 500 hidden ids — normalize/prune completes.
- **UT-162** (happy): Non-empty title+author+visible element — gates ok.
- **UT-163** (error): Missing author — blocked.
- **UT-164** (error): locatorCount 1 without state — blocked.
- **UT-165** (error): No visible elements and no legend items — blocked.
- **UT-166** (boundary): whitespace title/author — blocked.
- **UT-167** (happy): empty technicalResponsible — still ok if other gates pass.
- **UT-168** (state): After fixing title, new validation ok.
- **UT-169** (state): Gate result independent of `navigator.onLine`.
- **UT-170** (idempotency): Repeated validate while blocked — same errors.
- **UT-171** (happy): All elements hidden but `showStateInLegend` with selection — content gate passes.
- **UT-172** (state): locatorCount → 0 clears locator requirement even if codes null.
- **UT-173** (boundary): Missing title and locator — errors include both fields.
- **UT-174** (happy): `defaultExportSettings()` matches TechSpec defaults table.
- **UT-175** (happy): Debounce helper fires once after quiet period (fake timers).
- **UT-176** (happy): Flush invokes persist immediately.
- **UT-177** (error): Persist reject — in-memory settings retained for session export.
- **UT-178** (state): Legacy `legendPosition:'right'` → `'beside'`.
- **UT-179** (boundary): Empty arrays hidden* ok.
- **UT-180** (idempotency): normalize(normalize(x)) equals normalize(x).

### BrazilBoundaryService

- **UT-181** (happy): Online mock IBGE success — `source:'ibge'`.
- **UT-182** (happy): Offline flag — uses fallback `source:'fallback'`.
- **UT-183** (error): IBGE 500 then fallback hit — `source:'fallback'`.
- **UT-184** (error): Both fail — throws `BoundaryUnavailableError`.
- **UT-185** (happy): `listMunicipalities('43')` returns only RS codes from fixture.
- **UT-186** (boundary): Timeout IBGE — falls back.

### Dynamic scale

- **UT-187** (happy): Scale calculator at zoom Z meters-per-pixel — label not fixed `3km` when resolution differs.
- **UT-188** (boundary): Extreme zoom — returns finite positive scale length.

## Integration Tests

### Editor / modal / auth

- **IT-001**: MapEditor with owned map — Export button present; click opens `ExportMapModal`.
- **IT-002**: 200 elements fixture — modal opens without crash.
- **IT-003**: API session 401 on map load — export cannot succeed; redirect/deny path.
- **IT-004**: IndexedDB cached map offline — modal opens with mirrored `export_settings`.
- **IT-005**: Cancel then reopen — restored settings from last flush.
- **IT-006**: maps/get 404 while modal open — export actions disabled with message.
- **IT-007**: Gallery/PublicMapView — no Export composition control; GeoJSON export for public remains denied per product rules.
- **IT-008**: Crafted navigate to editor for non-owned id — API deny; no export success.
- **IT-009**: Public missing id — unavailable; no export.
- **IT-010**: Repeated unauthorized update export_settings — 404/403 each time.
- **IT-011**: User B authenticated updating user A map settings — forbidden/not_found.
- **IT-012**: Unpublish during public view — public content unavailable; still no export.
- **IT-013**: Retry denied — remains denied.
- **IT-014**: Login as non-owner from gallery — cannot open that map’s export.
- **IT-015**: Moderated map public — no export.
- **IT-016–IT-024**: Non-owner cannot open modal (shared assertion across metadata/legend/tags/basemap/location/page stories).
- **IT-021**: Narrow viewport — modal scrollable; cancel reachable.
- **IT-025**: Native platform mock + offline tiles present — offline basemap selectable and preview requests local URLs.
- **IT-026**: Non-owner basemap (covered by IT-011 pattern).
- **IT-027**: Export with satellite + dpi 300 — progress/loading shown until mock html2canvas resolves.
- **IT-028**: Boundary service online path wired to inset UI — selecting UF/muni populates insets.
- **IT-029**: Non-owner location (IT-011).
- **IT-030**: Municipality search filters fixture list.
- **IT-031**: Non-owner location style (IT-011).
- **IT-032**: Non-owner page setup (IT-011).
- **IT-033**: Large paper + satellite — long-running capture still shows loading until settle.
- **IT-034**: Non-owner preview (IT-011).
- **IT-035**: Reopen builds preview from server `export_settings`.
- **IT-036**: Mobile layout classes/stack present for options+preview.
- **IT-037**: Web export — mock download invoked with PNG.
- **IT-038**: Native export — Filesystem.writeFile + Share.share invoked with file uri.
- **IT-039**: Auth lost mid-export — failure; no success toast.
- **IT-040**: Debounced update hits `/php/maps/update.php` with only `export_settings`; response `version` unchanged.
- **IT-041**: OfflineStore map record stores `export_settings` after sync/update.
- **IT-042**: Different userId IndexedDB partition — cannot read other user’s settings.
- **IT-043**: Two sequential settings-only updates — last payload persisted (LWW).
- **IT-044**: Persist 500 — user can still call exporter in session with in-memory settings.
- **IT-045**: Identical settings save twice — second succeeds idempotently.
- **IT-046**: Export then unmount before debounce — flush on close persists.
- **IT-047**: Map delete — settings row gone with map (FK cascade).
- **IT-048**: List many maps — opening one export uses that map’s settings only.
- **IT-049**: Non-owner never receives successful PNG path.
- **IT-050**: Client normalize → API → format_map_record round-trip preserves fields.
- **IT-051**: IBGE fetch fail in browser — UI uses fallback and shows fallback indication when online.
- **IT-052**: PHPUnit `maps_update` settings-only without `base_version` succeeds and does not increment version.
- **IT-053**: PHPUnit settings-only by non-owner → 403/404.
- **IT-054**: PHPUnit invalid `export_settings` string → 400 validation_error.
- **IT-055**: PHPUnit public map DTO does not include `export_settings`.

## End-to-End Tests

### Owner composition journey (US-001, US-003, US-013, US-015, US-017)

- **E2E-001**: Owner opens editor → Export → sees options+preview → Cancel → back in editor, no file.
- **E2E-002**: Anonymous gallery map → no export composition control; crafted editor access denied.
- **E2E-003**: Enter title+author (+optional responsible) → preview header/footer update.
- **E2E-004**: Switch legend inside/beside/below → preview arrangement matches; beside/below grow canvas.
- **E2E-005**: Inside legend drag/resize stays in map frame.
- **E2E-006**: Set columns/font/spacing → legend appearance updates live.
- **E2E-007**: Toggle category/element → hidden from preview map and legend; editor map unchanged after close.
- **E2E-008**: Toggle tags → names appear/disappear for visible elements only.
- **E2E-009**: Select Claro/OSM/Satellite → preview tiles change; on native with tiles, Offline works; on web Offline disabled; missing offline tiles block success.
- **E2E-010**: Locator None/1/2 with UF+muni → insets render; incomplete selection blocks export.
- **E2E-011**: Location colors, legend checks, mesh → main map and legend reflect choices.
- **E2E-012**: Change paper/orientation/DPI → preview aspect changes; PNG uses dpi scale.
- **E2E-013**: Change options without refresh button → preview updates; chrome+footer visible.
- **E2E-014**: Footer shows institutional block+logo treatment; IBGE line when location used.
- **E2E-015**: Gates pass → PNG download (web) or share sheet (native); success toast only then; failure paths no success.
- **E2E-016**: Configure, close, reopen same map → settings restored; other map isolated.
- **E2E-017**: Blank title/author, incomplete locator, empty content → export blocked with visible messages; fixing allows PNG.

## Notes

- Dynamic scale unit cases **UT-187–UT-188** support US-013/ADR-010 chrome requirements.
- Prefer component tests with mocked Leaflet where full map init is heavy; boundary fixtures live under `tests/js/fixtures/geo/`.
