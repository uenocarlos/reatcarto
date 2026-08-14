# Technical Specification: Canvas Icon Editor and User Icon Library

## Executive Summary

This feature adds a Fabric.js drawing modal (`IconCanvasEditor`) opened from StylePanel on desktop, exports a 256×256 transparent PNG, uploads it into a new account-scoped `user_icons` store via `/php/icons/*`, and sets `style.custom_icon_url` to the returned URL. Soft-hiding removes catalog membership without deleting bytes so existing points keep rendering. When `custom_icon_url` is set, `createColoredIcon` and export legend use a color bitmap (`<img>`) instead of CSS mask tinting. Library mutations are online-only; the editor is gated by `pointer: fine` and viewport width ≥ 768.

Primary trade-offs: Fabric adds bundle weight (mitigated by lazy-load); soft-hide retains disk until a future GC; icon GET performs a reference ACL check similar in spirit to photos but keyed off element `custom_icon_url` references.

## System Architecture

### Component Overview

```
StylePanel.jsx
  ├── canUseIconCanvasEditor()          — desktop gate
  ├── UserIconLibrary (section)         — list / apply / remove / open editor
  └── IconCanvasEditor (lazy modal)     — Fabric canvas, tools, confirm/cancel

src/lib/icons/
  ├── desktopCapability.js
  ├── iconExport.js                     — emptiness, PNG blob, size ≤ 200KB
  └── constants.js                      — 256, 200KB, name length

src/api/apiClient.js → api.icons.{list,create,remove,url}

php/lib/Icons/IconService.php
php/icons/{list,upload,get,remove}.php
php/public/icon.php
php/migrations/008_user_icons.sql

pointIcon.js / ExportLegend.jsx / exportComposition.css
  — custom_icon_url → color bitmap; else mask/SVG as today
```

**Data flow — create & apply:** StylePanel → IconCanvasEditor confirm → `iconExport` validates → `api.icons.create` (multipart PNG) → `updateStyle({ custom_icon_url: icon.url, icon_name: 'pin' /* or keep */ })` with `custom_icon_url` authoritative → preview/save via existing `onPreview`/`onSave`.

**Data flow — reuse:** `api.icons.list` → pick → set `custom_icon_url` → clear not required until built-in selected (built-in clears URL).

**Data flow — display:** Leaflet/`createColoredIcon` and legend read `custom_icon_url` → `<img>` bitmap; GET served by icons API with ACL / public endpoint.

**External systems:** None beyond existing Postgres filesystem uploads and session auth.

## Implementation Design

### Core Interfaces

```javascript
// src/lib/icons/constants.js
export const ICON_CANVAS_SIZE = 256;
export const MAX_ICON_BYTES = 200 * 1024;
export const MAX_ICON_NAME_LENGTH = 100;
export const ICON_NAME_FALLBACK = 'Ícone';
```

```javascript
// src/lib/icons/desktopCapability.js
/** @returns {boolean} */
export function canUseIconCanvasEditor(win = window) {
  return win.matchMedia('(pointer: fine)').matches && win.innerWidth >= 768;
}
```

```javascript
// src/lib/icons/iconExport.js
/** @param {import('fabric').Canvas} canvas */
export function canvasHasDrawableContent(canvas) { /* non-empty objects with visible ink */ }

/** @returns {Promise<Blob>} PNG; throws if empty or > MAX_ICON_BYTES */
export async function exportIconPngBlob(canvas) { /* ... */ }
```

```javascript
// src/api/apiClient.js (api.icons)
list: () => apiFetch('/icons/list.php') // { icons: IconRecord[] }
create: (file, { name, clientMutationId } = {}) => // FormData → { icon }
remove: (id) => apiFetch('/icons/remove.php', { method: 'POST', body: { id } })
url: (id) => `/php/icons/get.php?id=${encodeURIComponent(id)}`
```

```php
// php/lib/Icons/IconService.php (conceptual)
function icons_list(array $user): array;
function icons_upload(array $user, array $files, array $input): array;
function icons_soft_remove(array $user, string $iconId): array;
function icon_can_read(?array $user, array $icon): bool;
function icon_is_publicly_referenced(string $iconId): bool;
function icons_serve(string $iconId, ?array $user): never;
function icons_serve_public(string $iconId): never;
```

```javascript
// pointIcon.js — branch
// if (customUrl) → divIcon with <img src="..." /> (color); else existing mask/SVG paths
```

### Data Models

**Table `user_icons`**

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID NOT NULL | FK users, ON DELETE CASCADE |
| `name` | TEXT NOT NULL | max 100; default fallback applied in service |
| `storage_key` | TEXT NOT NULL | relative path under uploads |
| `content_type` | TEXT NOT NULL | check = `image/png` |
| `byte_size` | INT NOT NULL | ≤ `MAX_ICON_BYTES` |
| `library_hidden_at` | TIMESTAMPTZ NULL | soft-remove timestamp |
| `created_at` | TIMESTAMPTZ | default now() |

Indexes: `(user_id)` where `library_hidden_at IS NULL`; `(id)` PK.

**IconRecord (API JSON)**

```json
{
  "id": "uuid",
  "name": "Ícone",
  "content_type": "image/png",
  "byte_size": 12345,
  "created_at": "ISO-8601",
  "url": "/php/icons/get.php?id=uuid"
}
```

**Point `style` (unchanged keys)**

```json
{ "icon_name": "pin", "icon_color": "#F97316", "custom_icon_url": "/php/icons/get.php?id=..." }
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/php/icons/list.php` | active user | Icons for caller with `library_hidden_at IS NULL` |
| POST | `/php/icons/upload.php` | active user | Multipart `file` (PNG) + optional `name`, `client_mutation_id` → 201 `{ icon }` |
| GET | `/php/icons/get.php?id=` | session optional | Bytes if `icon_can_read` |
| POST | `/php/icons/remove.php` | active user | Body `{ id }` soft-hides; idempotent if already hidden |
| GET | `/php/public/icon.php?id=` | none | Bytes if `icon_is_publicly_referenced` |

**Upload errors:** `validation_error` (not PNG / empty name rules), `payload_too_large` (>200KB), `unauthorized`, offline not applicable server-side.

**Remove errors:** `forbidden` (not owner), `not_found` (unknown id — may still 200 idempotent hide for already hidden owned row).

## Integration Points

- **Session auth / CORS:** Same as photos (`require_active_user`, `credentials: 'include'`).
- **Uploads filesystem:** `UPLOADS_ROOT` / `uploads_root()`; store under `icons/{2hex}/{id}.png` (or shared hashing scheme).
- **Element style persistence:** Existing `MapElement.update` / create; no server-side schema for icon keys inside JSONB.
- **Connectivity:** Reuse `src/lib/offline/connectivity.js` (or equivalent) before library calls.
- **Public maps:** When formatting public elements, rewrite `custom_icon_url` from `/php/icons/get.php?id=` to `/php/public/icon.php?id=` if present (helper shared or inline).

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|---------------------|-----------------|
| `StylePanel.jsx` | modified | Library UI, open editor, clear URL on built-in; stub upload remains non-goal | Wire library + editor; fix built-in click to clear `custom_icon_url` |
| `IconCanvasEditor` (+ Fabric) | new | Drawing UX; lazy chunk | Implement P0; stub P1/P2 behind flags or later tasks |
| `pointIcon.js` | modified | Bitmap branch; anchor center for customs | Update + unit tests |
| `ExportLegend.jsx` / CSS | modified | Color symbol for custom URL | Align with bitmap |
| `ExportElementLayers.jsx` | modified | Inherits `createColoredIcon` | Verify no local mask override |
| `apiClient.js` | modified | `api.icons` | Add namespace |
| `Limits.php` | modified | `MAX_ICON_BYTES`, name length | Add constants |
| `IconService` + endpoints | new | Persistence + ACL | Migration 008+ |
| Public element serializer | modified | Rewrite icon URLs | Locate photo rewrite pattern and mirror |
| OfflineStore | none (MVP) | No icon blobs | Document online-only |
| package.json | modified | `fabric` dependency | Add dependency |

## Testing Approach

- **Unit:** Vitest + jsdom (`tests/js/**`). Fake `matchMedia`, Fabric canvas doubles for export helpers, pure ACL helpers if extracted to testable PHP via integration instead.
- **Integration:** PHP endpoint tests if the repo has PHP test harness; otherwise Vitest against mocked `apiFetch` plus a thin contract suite. Prefer adding PHP integration scripts consistent with existing photo tests if any; else document API cases as IT runnable via HTTP against local `dev:php`.
- **E2E:** Map Editor journeys with Testing Library where feasible (StylePanel + mocked API); full browser E2E optional if project lacks Playwright — use RTL component tests as E2E stand-in labeled E2E in contract when they exercise the public UI surface end-to-end with mocked network.

Concrete cases live in `_tests.md`.

## Development Sequencing

### Build Order

1. Migration `008_user_icons.sql` + `Limits` constants + `IconService` list/upload/get/remove/public — no UI dependency.
2. `api.icons` client + connectivity guards.
3. `pointIcon` / legend bitmap branch + unit tests (unblocks visible apply even with manual URL).
4. `desktopCapability` + `iconExport` helpers + tests.
5. `IconCanvasEditor` P0 (Fabric) lazy modal + StylePanel “Desenhar” / confirm apply.
6. StylePanel “Meus ícones” list/apply/remove + clear `custom_icon_url` on built-in select.
7. Public URL rewrite on public element payloads.
8. P1: multi-select, undo/redo, eraser, clear.
9. P2: triangle tool.

### Technical Dependencies

- npm `fabric` package.
- Writable `UPLOADS_ROOT` as for photos.
- Postgres migration runner.

## Monitoring and Observability

- Log icon upload failures with `user_id`, `byte_size`, error code (no file bytes).
- Log soft-remove and forbidden GET denials at info/warn.
- Metric counters (if available): `icons_upload_total`, `icons_upload_rejected_size`, `icons_get_denied`.
- No PII in logs beyond user id already used elsewhere.

## Technical Considerations

### Key Decisions

- **Fabric.js** — object editor primitives (ADR-005).
- **`user_icons` + soft-hide** — durable library without cascade (ADR-006).
- **`custom_icon_url` ⇒ bitmap** — color fidelity (ADR-007).
- **Owner/reference ACL + public icon endpoint** — share/public maps (ADR-008).
- **Pointer+width gate; online-only library** (ADR-009).

### Known Risks

- Fabric lazy-load failure → show toast; do not leave StylePanel broken.
- ACL reference query cost → add index / normalize `icon_id` in style in a follow-up if slow.
- Hidden icons on disk accumulate → schedule GC when unreferenced (future).
- Built-in selection historically did not clear `custom_icon_url` — must fix or customs stick forever (US-010).

## Architecture Decision Records

### Product (prior)

- [ADR-001: Preserve Original Colors](adrs/adr-001.md)
- [ADR-002: Per-User Icon Library](adrs/adr-002.md)
- [ADR-003: Desktop-Only Editor](adrs/adr-003.md)
- [ADR-004: Limits and Priority Tiers](adrs/adr-004.md)

### Technical

- [ADR-005: Fabric.js](adrs/adr-005.md) — Canvas engine for IconCanvasEditor.
- [ADR-006: user_icons API + soft-remove](adrs/adr-006.md) — Persistence model.
- [ADR-007: Bitmap when custom_icon_url set](adrs/adr-007.md) — Render bifurcation.
- [ADR-008: Icon GET ACL + public endpoint](adrs/adr-008.md) — Authorization.
- [ADR-009: Desktop gate + online-only library](adrs/adr-009.md) — Capability and offline policy.
