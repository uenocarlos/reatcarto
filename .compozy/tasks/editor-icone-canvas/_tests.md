# Test Specification: Canvas Icon Editor and User Icon Library

Canonical test contract for the canvas icon editor and user icon library. Companion to `_techspec.md`.
Derived from `_user_stories.md` (behavior) and `_techspec.md` (components).

## Strategy

- Frameworks: Vitest + jsdom + Testing Library (`tests/js/**/*.test.js`); PHP endpoint cases run against local PHP server when available (`IT-*` HTTP), otherwise the same assertions are expressed as service-level PHPUnit-style cases if/when a PHP harness exists — implementers must still satisfy each IT ID.
- Fakes only at I/O: `apiFetch`, `matchMedia`, Fabric canvas double for pure export helpers; real `createColoredIcon` HTML assertions in unit tests.
- Execution: `npm test` / `vitest run` for UT/E2E(RTL); IT icons API via curl/script or PHP test runner documented in the task.
- Conventions: one behavior per ID; tag unit class in the case line.

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|--------|----------|------|-------------|-----|
| US-001 | Open editor from StylePanel (desktop) | UT-020 | — | E2E-001 |
| US-001.EC-1 | Draft/new point can open editor | — | — | E2E-001 |
| US-001.EC-2 | Auth failure on confirm | UT-031 | IT-004 | E2E-002 |
| US-001.EC-3 | Re-open after cancel = blank | UT-021 | — | E2E-001 |
| US-001.EC-4 | Close StylePanel cancels editor | — | — | E2E-003 |
| US-002 | Mobile: library yes, editor no | UT-001, UT-022 | — | E2E-004 |
| US-002.EC-1 | pointer/width gate | UT-001, UT-002 | — | — |
| US-002.EC-2 | Empty library on mobile | UT-023 | — | E2E-004 |
| US-002.EC-3 | Layout change re-evaluates gate | UT-002 | — | — |
| US-003 | Pencil, shapes, color, stroke | UT-024 | — | E2E-005 |
| US-003.EC-1 | Stroke width clamp | UT-025 | — | — |
| US-003.EC-2 | Tool switch mid-gesture | UT-026 | — | — |
| US-003.EC-3 | Clip to artboard on export | UT-010 | — | — |
| US-003.EC-4 | Only palette colors | UT-027 | — | — |
| US-004 | Select/move/resize/rotate | UT-028 | — | E2E-005 |
| US-004.EC-1 | Min resize clamp | UT-029 | — | — |
| US-004.EC-2 | Rotate + export clip | UT-010 | — | — |
| US-004.EC-3 | Overlap hit-test topmost | UT-030 | — | — |
| US-004.EC-4 | Delete selected object | UT-032 | — | E2E-005 |
| US-005 | Confirm save+apply | UT-011 | IT-001 | E2E-006 |
| US-005.EC-1 | >200KB rejected | UT-012 | IT-002 | E2E-007 |
| US-005.EC-2 | Network failure no partial apply | UT-033 | IT-003 | E2E-002 |
| US-005.EC-3 | Double confirm idempotent | — | IT-005 | E2E-008 |
| US-005.EC-4 | Offline confirm fails clearly | UT-034 | — | E2E-009 |
| US-005.EC-5 | Cross-user list isolation | — | IT-006 | — |
| US-006 | Name / empty / cancel | UT-013, UT-014 | IT-007 | E2E-010 |
| US-006.EC-1 | Whitespace name → fallback | UT-015 | IT-007 | — |
| US-006.EC-2 | Long name truncated/rejected | UT-016 | IT-008 | — |
| US-006.EC-3 | Duplicate names allowed | — | IT-009 | — |
| US-006.EC-4 | Transparent-only = empty | UT-014 | — | — |
| US-007 | Reuse on other points/maps | — | IT-010 | E2E-011 |
| US-007.EC-1 | Broken URL fallback | UT-040 | — | — |
| US-007.EC-2 | Built-in clears custom_icon_url | UT-041 | — | E2E-012 |
| US-007.EC-3 | Clear custom control | UT-042 | — | E2E-012 |
| US-007.EC-4 | Large library scrollable | UT-043 | IT-011 | — |
| US-008 | Soft-remove from library | — | IT-012 | E2E-013 |
| US-008.EC-1 | Other tab refresh absent | — | IT-013 | — |
| US-008.EC-2 | Point keeps URL after hide | — | IT-012 | E2E-013 |
| US-008.EC-3 | Non-owner remove forbidden | — | IT-014 | — |
| US-008.EC-4 | Remove twice idempotent | — | IT-015 | — |
| US-009 | Color on map/panel/legend/export | UT-040, UT-044, UT-045 | — | E2E-014 |
| US-009.EC-1 | icon_color ignored for custom | UT-044 | — | — |
| US-009.EC-2 | Zoom scales bitmap | UT-046 | — | — |
| US-009.EC-3 | Export keeps transparency | UT-045 | — | — |
| US-010 | Built-in coexistence | UT-047 | — | E2E-012 |
| US-010.EC-1 | Legacy custom_icon_url color path | UT-048 | — | — |
| US-010.EC-2 | Mixed legend grouping | UT-049 | — | — |
| US-011 | Multi-select group transforms | UT-050 | — | E2E-015 |
| US-011.EC-1 | Multi with one object | UT-051 | — | — |
| US-011.EC-2 | Deselect one from group | UT-052 | — | — |
| US-011.EC-3 | Empty marquee | UT-053 | — | — |
| US-012 | Undo/redo | UT-054 | — | E2E-015 |
| US-012.EC-1 | Undo at start no-op | UT-055 | — | — |
| US-012.EC-2 | Selection-only history policy | UT-056 | — | — |
| US-012.EC-3 | Undo after clear | UT-057 | — | — |
| US-013 | Eraser + clear | UT-058 | — | E2E-015 |
| US-013.EC-1 | Eraser on empty | UT-059 | — | — |
| US-013.EC-2 | Clear then undo | UT-057 | — | — |
| US-013.EC-3 | Clear does not mutate library | UT-060 | — | — |
| US-014 | Triangle tool | UT-061 | — | E2E-016 |
| US-014.EC-1 | Degenerate triangle | UT-062 | — | — |
| US-014.EC-2 | Absent in P0 build | UT-063 | — | — |
| desktopCapability | Gate helper | UT-001–UT-002 | — | — |
| iconExport | Empty/size/PNG | UT-010–UT-016 | — | — |
| createColoredIcon | Bitmap vs mask | UT-040–UT-048 | — | — |
| api.icons | Client wrappers | UT-070–UT-072 | — | — |
| IconService upload | PNG/size/auth | — | IT-001–IT-002, IT-004 | — |
| IconService ACL GET | Owner/ref/deny | — | IT-016–IT-018 | — |
| IconService public | Public ref only | — | IT-019–IT-020 | — |
| IconService remove | Soft-hide | — | IT-012, IT-014–IT-015 | — |
| IconService list | Owner isolation | — | IT-006, IT-011 | — |

## Unit Tests

### `canUseIconCanvasEditor` (TechSpec: Core Interfaces)

- **UT-001** (happy): `pointer: fine` true and `innerWidth` 1024 → returns `true`.
- **UT-002** (boundary): `pointer: fine` true and `innerWidth` 767 → returns `false`; coarse pointer and width 1200 → `false`.

### `iconExport` (TechSpec: Core Interfaces)

- **UT-010** (happy): canvas with one opaque stroke → `exportIconPngBlob` resolves to `image/png` Blob with `size ≤ 200*1024` and logical 256×256 export.
- **UT-011** (happy): valid blob path used by confirm helper returns success metadata `{ blob, byteSize }`.
- **UT-012** (error): stub canvas whose PNG would be `200*1024+1` bytes → throws/rejects with size-limit code/message.
- **UT-013** (happy): optional name `"Farol"` normalized to `"Farol"`.
- **UT-014** (error): `canvasHasDrawableContent` false for empty canvas and for objects with zero visible alpha → confirm guard blocks.
- **UT-015** (boundary): name `"   "` → fallback `"Ícone"`.
- **UT-016** (boundary): name length 101 → truncated to 100 or rejected with validation error (match TechSpec `MAX_ICON_NAME_LENGTH` implementation choice; assert one consistent behavior).

### StylePanel / editor wiring helpers

- **UT-020** (happy): when `canUseIconCanvasEditor` true, draw affordance flag `showIconEditorEntry` is true.
- **UT-021** (state): editor open token increments on each open after cancel so Fabric remounts blank.
- **UT-022** (state): when gate false, `showIconEditorEntry` false and mobile hint string present.
- **UT-023** (empty): library array `[]` → empty-state flag true.
- **UT-024** (happy): tool reducer accepts `pencil|rect|circle|line` and stroke/color updates for *new* objects only.
- **UT-025** (boundary): stroke width below min clamps to min; above max clamps to max.
- **UT-026** (ordering): switching tool while `isDrawing` completes or cancels gesture without leaving `isDrawing` stuck true.
- **UT-027** (happy): color setter ignores non-hex input and keeps previous valid color.
- **UT-028** (happy): select object id then apply translate/scale/rotate mutates that object props.
- **UT-029** (boundary): resize toward 0 clamps to configured minimum object size > 0.
- **UT-030** (happy): hit-test overlapping stack returns topmost object id.
- **UT-031** (error): confirm handler maps 401 from `api.icons.create` to auth error toast path and does not call `updateStyle` with new URL.
- **UT-032** (happy): deleteSelected removes selected object; with none selected is no-op.
- **UT-033** (error): `api.icons.create` network reject → style unchanged; library list not optimistically appended.
- **UT-034** (error): connectivity offline → confirm returns offline error without calling `api.icons.create`.

### `createColoredIcon` / legend symbol (TechSpec: ADR-007)

- **UT-040** (happy): `createColoredIcon('#f00', 'pin', '/php/icons/get.php?id=abc')` HTML includes `<img` with that `src` and does **not** include `mask-image`.
- **UT-041** (happy): StylePanel built-in select helper yields `{ icon_name: 'circle', custom_icon_url: '' }`.
- **UT-042** (happy): clear-custom helper yields `custom_icon_url: ''` preserving `icon_name`.
- **UT-043** (scale): library list renderer accepts 200 items without throwing (smoke).
- **UT-044** (happy): bitmap branch ignores color argument (HTML has no `background-color` mask tint for the artwork).
- **UT-045** (happy): legend symbol builder for custom URL uses img/bitmap class, not mask class.
- **UT-046** (boundary): with `zoom` 9 vs 16, bitmap icon sizes follow `iconSizeForZoom` (14 vs 32).
- **UT-047** (happy): `createColoredIcon('#0f0', 'pin', '')` uses SVG path (no `<img`).
- **UT-048** (happy): `createColoredIcon('#0f0', 'pin', 'https://cdn.example/x.png')` uses `<img` (legacy custom URL color path).
- **UT-049** (happy): `identityOf` / legend grouping includes `custom_icon_url` so two customs with different URLs do not collapse.

### P1 / P2 editor

- **UT-050** (happy): multi-select two ids then group translate moves both.
- **UT-051** (boundary): multi-select of one id behaves as single selection.
- **UT-052** (state): removing one id from selection leaves the other selected.
- **UT-053** (state): empty marquee clears or preserves selection per implemented rule (assert documented constant).
- **UT-054** (happy): draw → undo restores prior JSON snapshot; redo restores draw.
- **UT-055** (boundary): undo with empty stack no-ops; undoDisabled true.
- **UT-056** (state): selection-only change does not push history (or pushes without clearing unrelated content — assert chosen policy).
- **UT-057** (happy): clear canvas then undo restores objects.
- **UT-058** (happy): eraser removes targeted object/stroke; clear removes all.
- **UT-059** (happy): eraser on empty canvas no-ops.
- **UT-060** (state): clear does not call `api.icons.*`.
- **UT-061** (happy): triangle tool adds a triangle object.
- **UT-062** (error): degenerate triangle discarded or clamped to non-zero area.
- **UT-063** (state): P0 feature flag hides triangle tool entry.

### `api.icons` client

- **UT-070** (happy): `api.icons.url('x')` returns `/php/icons/get.php?id=x`.
- **UT-071** (happy): `create` builds FormData with `file` and optional `name`.
- **UT-072** (error): `remove` surfaces forbidden errors from `apiFetch`.

## Integration Tests

### Icons API

- **IT-001**: Authenticated `POST /php/icons/upload.php` with valid ≤200KB PNG and name `Farol` → 201 body includes `icon.id`, `icon.url` matching `/php/icons/get.php?id=…`, row visible in `GET /php/icons/list.php`.
- **IT-002**: Upload PNG of `200*1024+1` bytes → `payload_too_large` (or equivalent 413/400 code used by photos pattern); list unchanged.
- **IT-003**: Simulate storage failure after validation (fault injection or unwritable dir) → non-2xx; no list entry; no `custom_icon_url` client apply (client IT with mock).
- **IT-004**: Upload without session → 401/403; no row.
- **IT-005**: Two uploads with same `client_mutation_id` → one row; second returns cached icon id.
- **IT-006**: User A list does not include User B icons.
- **IT-007**: Upload with whitespace name → stored name `Ícone` (or server fallback equal to client constant).
- **IT-008**: Upload with name length 101 → 400 validation or truncated stored length ≤100.
- **IT-009**: Two uploads with identical name `Farol` → both listed.
- **IT-010**: After upload, PATCH element style `custom_icon_url` to icon url; reload element → URL persists.
- **IT-011**: Insert 100 icons for user; list returns all visible (pagination if implemented must still allow full fetch).
- **IT-012**: Soft-remove icon → absent from list; `GET` still 200 for owner; element retaining URL still loads image bytes.
- **IT-013**: After remove, second list call from fresh session omits icon (stand-in for other tab).
- **IT-014**: User B `POST remove` on User A icon → forbidden; A list unchanged.
- **IT-015**: Owner removes twice → both succeed or second not_found without resurrecting visibility.
- **IT-016**: Owner `GET /php/icons/get.php?id=` → 200 `image/png`.
- **IT-017**: Other user without referencing element → 403/404 on GET.
- **IT-018**: Other user who can read a map element referencing the icon → 200 on GET.
- **IT-019**: `GET /php/public/icon.php?id=` without public reference → 403/404.
- **IT-020**: Publicly visible element references icon → `public/icon.php` returns 200.

## End-to-End Tests

### Desktop create flow (US-001, US-003, US-004, US-005)

- **E2E-001**: Desktop StylePanel → open Desenhar → blank 256 canvas → cancel → reopen blank; point form still open.
- **E2E-002**: Draw content → confirm while API returns 401 → error shown; `custom_icon_url` empty; library unchanged.
- **E2E-003**: Open editor → unmount/close StylePanel → no library upload fired.
- **E2E-005**: Draw pencil + rect → select → move → Delete removes object → confirm disabled until new ink if emptied.
- **E2E-006**: Draw → confirm success → point preview/map mock shows img custom URL; “Meus ícones” shows new thumb.
- **E2E-007**: Oversized export path → message; style/library unchanged.
- **E2E-008**: Double-click confirm → single create call (button disabled in flight).
- **E2E-009**: Offline flag → confirm shows offline message; no create call.
- **E2E-010**: Empty confirm blocked; cancel after draw leaves style unchanged.

### Mobile / reuse / remove / display (US-002, US-007–US-010)

- **E2E-004**: Gate false → no Desenhar button; library section visible (empty or with mocks).
- **E2E-011**: Pick library icon on point → `custom_icon_url` set; open second point → same library entries available.
- **E2E-012**: With custom applied, pick built-in → `custom_icon_url` cleared; library still lists icon; tint path used in preview.
- **E2E-013**: Remove from library → absent from list; point that had URL still shows custom preview URL.
- **E2E-014**: Point with custom URL → marker HTML from `createColoredIcon` contains `<img`; legend symbol bitmap.

### P1 / P2 (US-011–US-014)

- **E2E-015**: Multi-select + undo + eraser + clear available when P1 enabled; clear then empty confirm blocked.
- **E2E-016**: P2 build shows triangle; drawing creates triangle object.
