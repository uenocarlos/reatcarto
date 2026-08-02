# User Stories: Map Export Composition (Exportar Mapa)

Canonical behavior catalog for the map export preview and options screen,
PNG delivery, legend/layout controls, basemap and Brazil location insets.
Companion to `_prd.md`; consumed by `_techspec.md` and `_tests.md`.

## Personas

- **Map owner** — an authenticated field or extension user who edits an owned map and needs a branded PNG for field sharing or documents.
- **Anonymous visitor** — a person viewing a published map without ownership; must not gain export rights through this feature.

## Story Index

| ID | Feature Area | Persona | Story |
| --- | --- | --- | --- |
| US-001 | Entry and access | Map owner | Open the export composition screen from the editor |
| US-002 | Entry and access | Anonymous visitor | Cannot export from the public gallery |
| US-003 | Metadata | Map owner | Set title, author, and optional technical responsible |
| US-004 | Legend layout | Map owner | Choose legend position inside, beside, or below the map |
| US-005 | Legend layout | Map owner | Drag and resize an inside legend |
| US-006 | Legend appearance | Map owner | Set legend columns, font size, and item spacing |
| US-007 | Layer control | Map owner | Toggle categories and individual elements for export |
| US-008 | Tags | Map owner | Toggle element name tags globally |
| US-009 | Basemap | Map owner | Choose the export basemap including offline tiles |
| US-010 | Location maps | Map owner | Configure none, one, or two Brazil locator insets |
| US-011 | Location maps | Map owner | Style location layers on the main map and legend |
| US-012 | Page setup | Map owner | Choose paper size, orientation, and DPI |
| US-013 | Preview | Map owner | See a live preview of the full composition |
| US-014 | Footer | Map owner | See institutional footer and logo on the composition |
| US-015 | Export | Map owner | Export the composition as PNG |
| US-016 | Persistence | Map owner | Reopen export with the last settings for that map |
| US-017 | Validation | Map owner | Meet export gates before generating the PNG |

## Entry and access

### US-001: Open the export composition screen from the editor

**As a** map owner, **I want** a clear way to open map export from the editor, **so that** I can compose and download a PNG without leaving my map.

Acceptance criteria:

- AC-1: Given I am authenticated and editing a map I own, when I activate the export action, then the export composition screen opens with options and preview.
- AC-2: Given the export screen is open, when I cancel or dismiss it, then I return to the editor without generating a file.

Edge cases:

- EC-1 (Invalid input): Hostile or unexpected activation parameters → export screen does not open in a broken state; editor remains usable.
- EC-2 (Empty / missing): The map has no elements yet → the screen still opens so I can configure options; export remains subject to US-017 gates.
- EC-3 (Limits): Very large element counts → the screen opens and remains usable, possibly with slower preview updates, without crashing.
- EC-4 (Permissions): My session expires while opening export → I am denied and guided to authenticate; no PNG is produced.
- EC-5 (Concurrency): I trigger open twice quickly → a single export screen instance is shown.
- EC-6 (Interruption): Connectivity drops while opening → the screen still opens for local composition when map data is already loaded; failures are visible if required assets cannot load.
- EC-7 (Repetition): I reopen after cancel → the screen opens again with persisted settings per US-016.
- EC-8 (Ordering): I open export before the map finishes loading → opening waits or shows a clear loading state rather than an empty broken preview.
- EC-9 (State transitions): The map is deleted or ownership lost while the screen is open → export actions are blocked with a clear message.
- EC-10 (Scale): Many maps in the workspace → only the current map’s export screen and settings are used.

### US-002: Cannot export from the public gallery

**As an** anonymous visitor, **I want** the public view to remain read-only regarding export, **so that** owners retain control of branded deliverables.

Acceptance criteria:

- AC-1: Given a published map in the public gallery or public route, when I view it without owning it, then no export composition control is available that produces this PNG feature.
- AC-2: Given I attempt to reach export through a direct or crafted path without ownership, when the product evaluates access, then export is denied without exposing private editor controls.

Edge cases:

- EC-1 (Invalid input): Crafted export URLs or payloads → rejected safely.
- EC-2 (Empty / missing): Unpublished or missing public map → neutral unavailable state; no export.
- EC-3 (Limits): Repeated unauthorized export attempts → remain denied without leaking ownership details.
- EC-4 (Permissions): Another authenticated user who does not own the map → cannot export that map through this feature.
- EC-5 (Concurrency): Owner unpublishes while I view → public content becomes unavailable; export remains unavailable.
- EC-6 (Interruption): Network loss on public view → no export capability appears as a fallback.
- EC-7 (Repetition): Retrying denied export → remains denied.
- EC-8 (Ordering): Login from public view without becoming owner → still no export for maps I do not own.
- EC-9 (State transitions): Moderated or deleted public map → no export.
- EC-10 (Scale): High anonymous traffic → export remains absent and unauthorized attempts stay denied.

## Metadata

### US-003: Set title, author, and optional technical responsible

**As a** map owner, **I want** to enter title, author, and optional technical responsible, **so that** the PNG carries proper attribution.

Acceptance criteria:

- AC-1: Given the export screen, when I enter a title, then the preview shows the title in the composition header area.
- AC-2: Given I enter an author, when the preview updates, then authorship appears with the footer information block.
- AC-3: Given I enter a technical responsible, when the preview updates, then that line appears with the footer block; when I leave it blank, no responsible line is required.
- AC-4: Given title or author is blank, when I attempt to export, then export is blocked per US-017.

Edge cases:

- EC-1 (Invalid input): Extremely long or hostile text → input is constrained or sanitized for safe display; export does not render executable content.
- EC-2 (Empty / missing): Blank title or author → preview may omit those lines but export remains blocked.
- EC-3 (Limits): Maximum practical title length for the chosen paper size → text remains readable or wraps without breaking the layout frame.
- EC-4 (Permissions): Non-owner → cannot edit these fields (screen unavailable).
- EC-5 (Concurrency): Two devices edit settings → last persisted state for the map wins per TechSpec sync rules without corrupting the map geometries.
- EC-6 (Interruption): App closes mid-typing → on restore, last successfully persisted values return (US-016).
- EC-7 (Repetition): Clearing and re-entering fields → preview reflects the latest values.
- EC-8 (Ordering): Export clicked before leaving a field → current field values are what validation uses.
- EC-9 (State transitions): Switching maps → metadata for the other map does not leak into this composition.
- EC-10 (Scale): Very long author/responsible strings → footer remains usable without covering the logo beyond acceptable layout rules.

## Legend layout

### US-004: Choose legend position inside, beside, or below the map

**As a** map owner, **I want** to place the legend inside, beside, or below the map, **so that** I can balance geography visibility and legend readability.

Acceptance criteria:

- AC-1: Given legend items exist, when I choose **inside**, then the legend appears within the map frame in the preview and PNG.
- AC-2: Given I choose **beside**, then the legend sits outside the map frame to the side and the total composition grows to include it.
- AC-3: Given I choose **below**, then the legend sits outside the map frame under the map and the total composition grows to include it.
- AC-4: Given I switch among the three positions, when the preview updates live, then the PNG matches the selected arrangement.

Edge cases:

- EC-1 (Invalid input): Unknown position value in restored settings → falls back to a safe default position and remains usable.
- EC-2 (Empty / missing): No legend items → legend region is absent or empty and US-017 applies.
- EC-3 (Limits): Many legend items beside/below → composition grows; content remains in the exported image.
- EC-4 (Permissions): Non-owner → cannot change position.
- EC-5 (Concurrency): Rapid position switching → preview settles on the latest choice.
- EC-6 (Interruption): Failure mid-render after a switch → user sees an error or retryable state without a silent wrong position in a successful export.
- EC-7 (Repetition): Re-selecting the same position → no layout corruption.
- EC-8 (Ordering): Change position before legend items load → layout applies once items are available.
- EC-9 (State transitions): Moving from inside (with custom size/place) to beside/below → external layout uses the outside placement rules; returning to inside restores a usable inside frame.
- EC-10 (Scale): Dense legends → columns/font/spacing (US-006) remain available to manage crowding.

### US-005: Drag and resize an inside legend

**As a** map owner, **I want** to drag and resize the legend when it is inside the map, **so that** I can keep it from covering important features.

Acceptance criteria:

- AC-1: Given legend position is **inside**, when I drag the legend, then it moves freely within the map area and stays inside that area.
- AC-2: Given legend position is **inside**, when I resize the legend, then its frame updates within allowed bounds inside the map area and the preview reflects it live.
- AC-3: Given legend position is **beside** or **below**, when I view the legend, then drag/resize affordances for free placement inside the map are not the interaction model (external legends follow outside layout).

Edge cases:

- EC-1 (Invalid input): Drag gestures that would place the legend outside the map → legend clamps to the map area.
- EC-2 (Empty / missing): Empty legend while inside → no interactive empty blocker covering the map, or a minimal frame that still respects US-017.
- EC-3 (Limits): Resize below a minimum readable size or above the map area → clamped to documented min/max.
- EC-4 (Permissions): Read-only contexts → no drag/resize (export screen unavailable to non-owners).
- EC-5 (Concurrency): Simultaneous touch and mouse updates → final geometry is coherent.
- EC-6 (Interruption): Touch cancelled mid-drag → legend remains at last valid position.
- EC-7 (Repetition): Double-tap or repeated resize → stable geometry without jumps outside the map.
- EC-8 (Ordering): Drag while switching away from inside → interaction ends cleanly; external layout takes over.
- EC-9 (State transitions): Restored inside position from persistence → appears at last saved place and size when still valid.
- EC-10 (Scale): Small phone screens → legend remains manipulable without trapping the user; cancel remains available.

## Legend appearance

### US-006: Set legend columns, font size, and item spacing

**As a** map owner, **I want** to control legend columns, font size, and spacing, **so that** the legend fits my report or phone-readable layout.

Acceptance criteria:

- AC-1: Given the legend, when I set columns from 1 to 6, then items flow into that column count in preview and PNG.
- AC-2: Given I set font size from 8px to 18px, then legend text uses that size in preview and PNG.
- AC-3: Given I choose spacing compact, normal, or wide, then vertical/horizontal gaps between items match the chosen density.

Edge cases:

- EC-1 (Invalid input): Out-of-range column or font values in restored data → clamped into 1–6 and 8–18.
- EC-2 (Empty / missing): No items → appearance controls remain visible but have no items to layout.
- EC-3 (Limits): 6 columns with long labels → labels remain readable via wrapping or truncation rules that do not clip the swatch meaninglessly.
- EC-4 (Permissions): Non-owner → cannot change appearance.
- EC-5 (Concurrency): Rapid slider changes → preview tracks the latest value.
- EC-6 (Interruption): Render failure at extreme settings → user sees failure feedback; last good export is not claimed successful.
- EC-7 (Repetition): Toggling spacing options → layout remains consistent with the selected option.
- EC-8 (Ordering): Change font before position → both apply together in the live preview.
- EC-9 (State transitions): Persisted appearance restored → matches last saved values.
- EC-10 (Scale): Dozens of legend items → columns and spacing still apply; composition may grow when legend is outside.

## Layer control

### US-007: Toggle categories and individual elements for export

**As a** map owner, **I want** to turn categories and individual elements on or off for the export, **so that** I can hide noise without deleting field data.

Acceptance criteria:

- AC-1: Given elements grouped by category, when I turn a category off, then its elements disappear from the preview map and from the legend.
- AC-2: Given a category is on, when I turn an individual element off, then only that element disappears from map and legend.
- AC-3: Given I turn elements back on, when the preview updates, then they reappear with their styling.
- AC-4: Given these toggles, when I later edit the map in the editor, then the underlying stored elements are not deleted merely by being hidden for export.

Edge cases:

- EC-1 (Invalid input): Toggle references a deleted element id in persisted settings → ignore stale id safely.
- EC-2 (Empty / missing): Map with zero elements → layer list is empty; US-017 may block export unless location legend items qualify.
- EC-3 (Limits): Hundreds of elements → list remains scrollable and toggles remain responsive enough to use.
- EC-4 (Permissions): Non-owner → cannot toggle.
- EC-5 (Concurrency): Toggle while preview re-renders → final visibility matches last user choice.
- EC-6 (Interruption): Failure loading an element style → that element shows a safe fallback or error marker without breaking the whole export screen.
- EC-7 (Repetition): Toggling the same item repeatedly → ends in the last chosen state.
- EC-8 (Ordering): Turn category off then enable a child → category-off keeps children hidden until the category is on again (category master switch).
- EC-9 (State transitions): Element deleted in editor after being toggled off for export → settings clean up without error.
- EC-10 (Scale): All elements off and no location legend items → export blocked per US-017.

## Tags

### US-008: Toggle element name tags globally

**As a** map owner, **I want** one switch for element name tags, **so that** I can label features for the field or hide labels for a cleaner report figure.

Acceptance criteria:

- AC-1: Given visible elements with names, when I enable tags, then their names appear on the preview map.
- AC-2: Given tags are enabled, when I disable tags, then names disappear from the map while geometries remain (if still visible).
- AC-3: Given tags are enabled, when an element is hidden via US-007, then its name tag is not shown.

Edge cases:

- EC-1 (Invalid input): Element name with hostile content → displayed as safe text only.
- EC-2 (Empty / missing): Visible element with blank name → no tag text is shown for that element.
- EC-3 (Limits): Many overlapping tags → tags still render; overlap may occur without crashing (no auto-collision engine required in this PRD).
- EC-4 (Permissions): Non-owner → cannot toggle tags.
- EC-5 (Concurrency): Toggle tags while panning preview → ends in the last tag state.
- EC-6 (Interruption): Preview interrupt → successful export never claims tags that were not in the final preview state.
- EC-7 (Repetition): Rapid toggle → final state matches last action.
- EC-8 (Ordering): Enable tags before elements finish loading → tags appear for visible named elements once loaded.
- EC-9 (State transitions): Persisted tag preference restores on reopen.
- EC-10 (Scale): Large name strings → tags remain on-map without breaking export.

## Basemap

### US-009: Choose the export basemap including offline tiles

**As a** map owner, **I want** to pick Claro, OSM, Satellite, or Offline tiles for the export, **so that** the PNG matches the basemap I need in the field or in a report.

Acceptance criteria:

- AC-1: Given the basemap options, when I select Claro, OSM, or Satellite, then the preview and PNG use that basemap.
- AC-2: Given Offline is selected and offline tiles are available for the view, when I preview/export, then those tiles are used.
- AC-3: Given Offline is selected but required tiles are missing, when I preview or export, then I see a clear failure or incomplete-tiles message and am not told the export succeeded if the basemap is unusable.

Edge cases:

- EC-1 (Invalid input): Unknown basemap in persisted settings → fallback to a safe default (e.g., Claro) with visibility of the active choice.
- EC-2 (Empty / missing): Offline folder empty → Offline cannot produce a successful basemap; user is informed.
- EC-3 (Limits): Partial offline coverage → visible gaps are acceptable if communicated; export success requires a usable capture per product rules in TechSpec.
- EC-4 (Permissions): Non-owner → cannot change basemap for export.
- EC-5 (Concurrency): Switching basemaps quickly → preview settles on the latest selection.
- EC-6 (Interruption): Tile network failure for online basemaps → error feedback; no false success toast.
- EC-7 (Repetition): Re-selecting the same basemap → stable preview.
- EC-8 (Ordering): Export before tiles finish loading → export waits or fails clearly rather than producing a blank basemap claimed as success.
- EC-9 (State transitions): Restored basemap preference applies on reopen.
- EC-10 (Scale): High DPI export with satellite tiles → may take longer; progress feedback remains visible.

## Location maps

### US-010: Configure none, one, or two Brazil locator insets

**As a** map owner, **I want** to add none, one, or two Brazil location insets, **so that** readers can situate the main map.

Acceptance criteria:

- AC-1: Given I choose **None**, when I preview, then no locator insets appear and state/municipality selection is not required for export.
- AC-2: Given I choose **1 map**, when state and municipality are selected, then one inset shows the state with the municipality highlighted.
- AC-3: Given I choose **2 maps**, when state and municipality are selected, then two insets appear: South America context highlighting Brazil/state, and the state with the municipality highlighted.
- AC-4: Given 1 or 2 maps without both state and municipality, when I try to export, then export is blocked with clear guidance (US-017).

Edge cases:

- EC-1 (Invalid input): Municipality not belonging to the selected state → rejected or cleared until a valid pair is chosen.
- EC-2 (Empty / missing): State chosen without municipality (or the reverse) while insets > 0 → export blocked; preview indicates incompleteness.
- EC-3 (Limits): Boundary geometry very detailed → insets still render acceptably for preview/export (simplification allowed in TechSpec).
- EC-4 (Permissions): Non-owner → cannot configure insets.
- EC-5 (Concurrency): Changing state while municipality list loads → stale municipality cannot remain selected incorrectly.
- EC-6 (Interruption): Boundary fetch fails → clear error; export does not succeed with empty insets when insets were requested.
- EC-7 (Repetition): Switching None → 1 → 2 repeatedly → layout remains consistent with the latest choice.
- EC-8 (Ordering): Pick municipality before state → UI requires state first or clears invalid municipality.
- EC-9 (State transitions): Persisted location selection restores; if a municipality code disappears from the catalog → user must reselect.
- EC-10 (Scale): All Brazilian municipalities available over time → selection remains searchable/usable.

### US-011: Style location layers on the main map and legend

**As a** map owner, **I want** to control whether state and municipality appear on the legend and to set their colors, and optionally show municipal mesh on the main map, **so that** location context matches my cartographic needs.

Acceptance criteria:

- AC-1: Given a selected municipality, when the preview updates, then the main map shows the municipality outline using the chosen municipality color.
- AC-2: Given I enable “add state to legend” (or equivalent), when preview updates, then the state appears as a legend entry with its color; when disabled, it does not.
- AC-3: Given I enable municipal mesh on map and legend, when preview updates, then mesh appears on the main map and as appropriate legend content; when disabled, it does not.
- AC-4: Given I change state and municipality colors, when preview updates, then fills/outlines and legend swatches match those colors.

Edge cases:

- EC-1 (Invalid input): Invalid color values in persistence → fallback to defaults.
- EC-2 (Empty / missing): Insets set to None → location styling controls that depend on a selection are hidden or inactive; no orphan location geometries on the main map unless TechSpec defines an independent main-map location mode (default: location overlays require a selected state/municipality).
- EC-3 (Limits): Mesh at continental zoom → remains usable without freezing the UI.
- EC-4 (Permissions): Non-owner → cannot change location styling.
- EC-5 (Concurrency): Color changes while boundaries load → final colors apply to loaded geometries.
- EC-6 (Interruption): Failure applying mesh → error visible; no silent partial success on export.
- EC-7 (Repetition): Toggling legend checkboxes → legend entries appear/disappear accordingly.
- EC-8 (Ordering): Enable legend entries before selecting municipality → entries appear once selection exists.
- EC-9 (State transitions): Changing municipality updates outline, mesh, and legend names.
- EC-10 (Scale): Mesh for large states → performance remains acceptable for interactive preview.

## Page setup

### US-012: Choose paper size, orientation, and DPI

**As a** map owner, **I want** to set paper size, orientation, and DPI, **so that** one PNG works for documents and for sharing at adequate resolution.

Acceptance criteria:

- AC-1: Given paper size and orientation options, when I change them, then the preview frame reflects the new page arrangement live.
- AC-2: Given a DPI choice, when I export, then the generated PNG uses that resolution setting.
- AC-3: Given I change these settings, when I reopen export for the map, then the last values restore (US-016).

Edge cases:

- EC-1 (Invalid input): Unsupported paper/DPI in persistence → clamp or fallback to supported defaults.
- EC-2 (Empty / missing): Missing DPI → use a documented default (existing product default 300 unless TechSpec changes it).
- EC-3 (Limits): Maximum DPI on low-memory devices → failure is reported rather than crashing the app.
- EC-4 (Permissions): Non-owner → cannot change page setup.
- EC-5 (Concurrency): Changing DPI during an in-flight export → in-flight export uses the values captured at start; a new export uses the latest values.
- EC-6 (Interruption): Export cancelled/failing at high DPI → no success toast; partial files are not presented as complete.
- EC-7 (Repetition): Re-export at same settings → produces a new PNG with the same configuration.
- EC-8 (Ordering): Change orientation after placing an inside legend → legend remains valid inside the updated map area or is adjusted safely.
- EC-9 (State transitions): Restored landscape/portrait matches last save.
- EC-10 (Scale): Large paper + high DPI + satellite → longer generation with visible progress.

## Preview

### US-013: See a live preview of the full composition

**As a** map owner, **I want** the preview to update as I change options, **so that** the PNG matches what I see.

Acceptance criteria:

- AC-1: Given any supported option change, when I finish the change, then the preview updates without requiring a mandatory “Atualizar Preview” step.
- AC-2: Given the preview, when I inspect it, then I see map content, legend (as configured), always-on graticule, scale bar, north arrow, title when set, and footer with logo.

Edge cases:

- EC-1 (Invalid input): Conflicting option combinations → preview shows a coherent state and validation messages when export is blocked.
- EC-2 (Empty / missing): Waiting for tiles/boundaries → preview shows loading indicators rather than a falsely complete map.
- EC-3 (Limits): Continuous rapid changes → preview may coalesce updates but ends matching the latest options.
- EC-4 (Permissions): Non-owner → no preview screen.
- EC-5 (Concurrency): Preview render overlaps → no torn UI; latest config wins.
- EC-6 (Interruption): Render error → visible error; export not marked successful.
- EC-7 (Repetition): Reopening the screen → preview builds from persisted settings.
- EC-8 (Ordering): Options change before map data ready → preview completes when data arrives.
- EC-9 (State transitions): Switching basemap mid-preview → final basemap is the selected one.
- EC-10 (Scale): Complex composition → preview remains navigable on phone-width layouts (stacked or scrollable controls acceptable).

## Footer

### US-014: See institutional footer and logo on the composition

**As a** map owner, **I want** the RealCarto / (R)EAT / FURG footer and logo on the PNG, **so that** institutional attribution is consistent.

Acceptance criteria:

- AC-1: Given any successful preview/export, when I view the composition bottom, then the institutional information block and logo treatment are present.
- AC-2: Given author and/or technical responsible values, when present, then they appear in the footer area without removing the institutional lines.

Edge cases:

- EC-1 (Invalid input): Broken logo asset → text attribution remains; user still sees institutional identity in text form.
- EC-2 (Empty / missing): Optional technical responsible blank → institutional block still present.
- EC-3 (Limits): Narrow page width → footer wraps or scales text while remaining readable.
- EC-4 (Permissions): N/A beyond owner-only access to the screen.
- EC-5 (Concurrency): N/A for static footer content.
- EC-6 (Interruption): Logo load failure during export → export fails clearly or proceeds with documented fallback; never silently omits all attribution.
- EC-7 (Repetition): Multiple exports → footer content remains consistent.
- EC-8 (Ordering): Metadata entered after first glance → footer updates live.
- EC-9 (State transitions): N/A.
- EC-10 (Scale): High DPI → logo remains sharp enough for document use.

## Export

### US-015: Export the composition as PNG

**As a** map owner, **I want** to generate a PNG of the composition, **so that** I can insert it into documents or share it from my phone.

Acceptance criteria:

- AC-1: Given all export gates pass (US-017), when I confirm export, then the product generates a PNG of the current preview composition.
- AC-2: Given a web browser session, when export succeeds, then the PNG downloads to the device.
- AC-3: Given a native Capacitor session, when export succeeds, then I can share/save via the platform share flow.
- AC-4: Given export is running, when it completes or fails, then I see clear success or failure feedback.

Edge cases:

- EC-1 (Invalid input): Export triggered while gates fail → blocked with guidance; no file.
- EC-2 (Empty / missing): Preview element unavailable → failure message; no success.
- EC-3 (Limits): Extremely large canvas → failure or progress with possible memory error message; no crash without feedback.
- EC-4 (Permissions): Session ends mid-export → failure; no unauthorized file claim.
- EC-5 (Concurrency): Double-click export → only one generation runs or a second is ignored until the first finishes.
- EC-6 (Interruption): User cancels dismisses modal during generation → generation stops or result is discarded; no surprise success after close without user intent.
- EC-7 (Repetition): Export again after success → a new PNG is produced.
- EC-8 (Ordering): Change an option during generation → in-flight capture uses the configuration taken at start.
- EC-9 (State transitions): PDF is not offered as an output choice in this feature.
- EC-10 (Scale): Long generation → loading indicator remains until success or failure.

## Persistence

### US-016: Reopen export with the last settings for that map

**As a** map owner, **I want** my export settings remembered per map, **so that** I do not rebuild the layout every time.

Acceptance criteria:

- AC-1: Given I configured export options and leave the screen, when I reopen export for the same map, then the previous options are restored.
- AC-2: Given two different owned maps, when I open export on each, then each map restores its own settings without cross-mixing.

Edge cases:

- EC-1 (Invalid input): Corrupted saved settings → fall back to defaults without crashing.
- EC-2 (Empty / missing): First open for a map → documented defaults are used.
- EC-3 (Limits): Settings blob grows with many element visibility flags → still loads; stale element ids ignored.
- EC-4 (Permissions): Another user signing in on the same device → cannot see or apply my map’s export settings for maps they do not own.
- EC-5 (Concurrency): Saving from two devices → TechSpec defines merge/last-write behavior without corrupting map geometries.
- EC-6 (Interruption): Save fails → user can still export in-session; next open may miss the latest values with no silent geometry loss.
- EC-7 (Repetition): Saving identical settings → idempotent.
- EC-8 (Ordering): Export success before persistence flush → next open still aims to restore last known good settings.
- EC-9 (State transitions): Map deleted → settings are removed or become unreachable.
- EC-10 (Scale): Many maps with saved settings → opening one map’s export stays fast enough to use.

## Validation

### US-017: Meet export gates before generating the PNG

**As a** map owner, **I want** clear blocking rules before export, **so that** I do not produce incomplete or unattributed PNGs.

Acceptance criteria:

- AC-1: Given blank title or blank author, when I try to export, then export is blocked and the missing fields are identified.
- AC-2: Given location insets are 1 or 2 and state or municipality is missing, when I try to export, then export is blocked and the preview/options explain what is missing.
- AC-3: Given no visible drawn element on the map and no legend item (including enabled location legend entries), when I try to export, then export is blocked.
- AC-4: Given all gates pass, when I export, then PNG generation proceeds (US-015).

Edge cases:

- EC-1 (Invalid input): Whitespace-only title/author → treated as blank and blocked.
- EC-2 (Empty / missing): Optional technical responsible blank → does not block.
- EC-3 (Limits): N/A beyond other stories’ limits.
- EC-4 (Permissions): Non-owner never reaches a successful export.
- EC-5 (Concurrency): Fixing a gate while a blocked export click is in flight → only a new export attempt after gates pass succeeds.
- EC-6 (Interruption): Network error is separate from gate blocking → gates are local composition rules.
- EC-7 (Repetition): Clicking export while blocked → remains blocked with the same guidance.
- EC-8 (Ordering): Enabling a location legend item while all drawn elements are hidden → can satisfy the “at least one legend item” rule if that entry is present.
- EC-9 (State transitions): Turning insets from 2 to None removes the state/municipality requirement even if selectors are empty.
- EC-10 (Scale): Many failing reasons at once → all applicable gate messages are discoverable (not only the first forever hidden).
