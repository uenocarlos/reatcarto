# TechSpec: Account Access and PostGIS Map Persistence

## Executive Summary

This design reconnects the existing React/Vite/Capacitor client to an evolved procedural PHP + PostgreSQL/PostGIS backend. Cookie-based PHP sessions authenticate every private and mutating operation. A versioned, normalized schema replaces the inconsistent `social`/localStorage split. Field photos live on the server filesystem with authorized delivery routes. Offline field work uses an account-bound IndexedDB cache and mutation outbox with optimistic `version` + `client_mutation_id` concurrency; true conflicts present both snapshots for explicit user choice.

Primary trade-offs: keep PHP instead of rewriting the API; prefer filesystem media over object storage; accept multi-device sessions with global revocation on credential and lifecycle events; free email/username only after hard account deletion. Terms of Use and Privacy Policy document content remain product/legal inputs; the system stores version identifiers and acceptance timestamps against configurable current versions.

## System Architecture

### Component Overview

| Component | Boundary | Responsibility |
|-----------|----------|----------------|
| **React App** (`src/`) | Browser / Capacitor WebView | UI for auth, workspace, Leaflet editor, gallery, admin; React Query cache |
| **API Facade** (`src/api/apiClient.js`) | Client I/O | `api.auth`, `api.entities.*`, `api.media`, `api.sync`, `api.public`, `api.admin` over `fetch` + credentials |
| **AuthContext / ProtectedRoute** | Client session gate | Session hydrate via `me`, route guards, return-to deep links |
| **OfflineStore** (`src/lib/offline/`) | IndexedDB | Prepared-map cache, outbox, conflict records, logout cleanup |
| **SyncEngine** (`src/lib/sync/`) | Client | Flush outbox, apply server results, surface conflicts |
| **PHP Bootstrap** (`php/config.php`, `php/bootstrap.php`) | Server shared | Env config, PDO, session cookie flags, JSON helpers, auth guards |
| **Auth & Account API** (`php/auth/`, account endpoints) | HTTP | Register, verify, login, recovery, profile, delete account |
| **Maps & Elements API** | HTTP | CRUD with ownership and version checks |
| **Photos API** | HTTP + filesystem | Upload, delete, authorized byte serving |
| **Sync API** | HTTP | Batch apply mutations idempotently; return conflicts |
| **Public API** | HTTP | Gallery search and published map/element/photo reads |
| **Admin API** | HTTP | Account status, moderation, audited private intervention |
| **Mailer** (`php/mail/`) | SMTP | Verification, recovery, admin-action notifications |
| **Migrations CLI** (`php/bin/migrate.php`) | Ops | Apply SQL migrations |
| **Admin Seed CLI** (`php/bin/seed_admin.php`) | Ops | Create first admin from env when none exists |
| **PostgreSQL + PostGIS** | Data | Authoritative users, maps, geometries, photos metadata, tokens, audit |

```text
[Leaflet UI] → [api facade] → [PHP endpoints] → [PostGIS]
       ↓              ↑
 [OfflineStore] ← [SyncEngine]
       ↓
  [SMTP mailer] ← auth/admin events
```

External interactions: SMTP for mail; OSM/Carto/Esri tile providers remain client-side (unchanged); Capacitor Camera/Geolocation/Filesystem for capture and offline tiles.

## Implementation Design

### Core Interfaces

Primary client contracts (JavaScript). Server mirrors the same JSON shapes.

```js
/** @typedef {'field'|'admin'} Role */
/** @typedef {'pending_verification'|'active'|'deactivated'|'deleted'} AccountStatus */
/** @typedef {'pending'|'synced'|'failed'|'conflicted'} OutboxStatus */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} username
 * @property {string} email
 * @property {string} full_name
 * @property {string} organization
 * @property {string} job_title
 * @property {string} phone
 * @property {Role} role
 * @property {AccountStatus} status
 * @property {boolean} email_verified
 * @property {string|null} pending_email
 */

/**
 * @typedef {Object} MapRecord
 * @property {string} id
 * @property {string} public_id
 * @property {string} owner_id
 * @property {string} name
 * @property {string} description
 * @property {number} center_lat
 * @property {number} center_lng
 * @property {number} zoom
 * @property {boolean} is_published
 * @property {string|null} moderated_at
 * @property {string|null} moderation_reason
 * @property {number} version
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} MapElement
 * @property {string} id
 * @property {string} map_id
 * @property {'point'|'line'|'polygon'} element_type
 * @property {object|string} geojson
 * @property {string} name
 * @property {string} description
 * @property {string} element_category
 * @property {object|string} style
 * @property {string} author_id
 * @property {number} version
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} SyncMutation
 * @property {string} client_mutation_id
 * @property {'map'|'element'|'photo'} resource_type
 * @property {'create'|'update'|'delete'|'publish'|'unpublish'} op
 * @property {string|null} resource_id
 * @property {number|null} base_version
 * @property {object} payload
 */

/**
 * @typedef {Object} SyncConflict
 * @property {string} client_mutation_id
 * @property {object} local_snapshot
 * @property {object} remote_snapshot
 * @property {'update_update'|'update_delete'|'delete_update'} kind
 */
```

```js
// src/api/apiClient.js — target surface (credentials: 'include')
export const api = {
  auth: {
    register(input) {},
    verifyEmail(token) {},
    resendVerification(email) {},
    login(identifier, password) {},
    logout() {},
    me() {},
    requestPasswordReset(email) {},
    resetPassword(token, password, confirmation) {},
    updateProfile(patch) {},
    changeUsername(username) {},
    changeEmail(email) {},
    changePassword(currentPassword, newPassword, confirmation) {},
    deleteAccount({ password, confirmPhrase }) {},
  },
  entities: {
    Map: { list, filter, create, update, delete, publish, unpublish, prepareOffline },
    MapElement: { list, filter, create, update, delete },
  },
  media: { upload(elementId, file, clientMutationId), delete(photoId, baseVersion, clientMutationId), url(photoId) },
  sync: { push(mutations), resolveConflict(clientMutationId, choice, baseVersion) },
  public: { listMaps({ q, page, pageSize }), getMap(publicId), listElements(publicId), getPhoto(photoId) },
  admin: {
    listUsers({ q, page }), setUserStatus(userId, status, reason),
    moderateMap(mapId, reason),
    getPrivateMap(mapId, reason), mutatePrivateElement(input, reason),
    listAudit({ q, page }),
  },
};
```

Error envelope (all PHP JSON errors):

```json
{ "success": false, "error": { "code": "forbidden", "message": "…", "fields": {} } }
```

Common codes: `validation_error`, `unauthenticated`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `account_pending`, `account_deactivated`, `payload_too_large`.

### Data Models

#### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| username | CITEXT UNIQUE | among non-deleted; freed after hard delete |
| email | CITEXT UNIQUE | trusted address when verified |
| password_hash | TEXT | `password_hash` / `password_verify` |
| full_name, organization, job_title, phone | TEXT | length-validated |
| role | TEXT CHECK (`field`\|`admin`) | |
| status | TEXT | `pending_verification`\|`active`\|`deactivated` |
| email_verified_at | TIMESTAMPTZ NULL | |
| pending_email | CITEXT NULL | awaiting verification |
| terms_version, privacy_version | TEXT | accepted at registration |
| consent_accepted_at | TIMESTAMPTZ | |
| created_at, updated_at | TIMESTAMPTZ | |

Deleted accounts are removed (hard delete); no `deleted` row retained for uniqueness. Audit may retain historical actor/target UUIDs without PII.

#### `maps`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| public_id | UUID UNIQUE | stable public route key; allocated at create |
| owner_id | UUID FK → users ON DELETE CASCADE | |
| name, description | TEXT | |
| center_lat, center_lng, zoom | DOUBLE/INT | defaults −32.035, −52.1, 13 |
| is_published | BOOLEAN DEFAULT false | |
| moderated_at | TIMESTAMPTZ NULL | |
| moderation_reason | TEXT NULL | |
| version | INT NOT NULL DEFAULT 1 | |
| created_at, updated_at | TIMESTAMPTZ | |

#### `map_elements`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| map_id | UUID FK → maps ON DELETE CASCADE | |
| element_type | TEXT | point\|line\|polygon |
| geom | geometry(Geometry,4326) | from GeoJSON; reject invalid |
| name, description, element_category | TEXT | |
| style | JSONB | |
| author_id | UUID FK → users | |
| version | INT | |
| created_at, updated_at | TIMESTAMPTZ | |
| GIST(geom) | index | |

#### `photos`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| element_id | UUID FK → map_elements ON DELETE CASCADE | |
| storage_key | TEXT | server-relative path under uploads root |
| content_type | TEXT | image/jpeg\|png\|webp |
| byte_size | INT | |
| version | INT | |
| created_at | TIMESTAMPTZ | |

#### Auth tokens

`email_verification_tokens`, `email_change_tokens`, `password_reset_tokens`: hashed token, user_id, expires_at, used_at, purpose-specific payload (e.g. pending email).

#### `client_mutations`

| Column | Type | Notes |
|--------|------|-------|
| client_mutation_id | UUID PK | idempotency key |
| user_id | UUID | |
| resource_type, resource_id | TEXT/UUID | |
| result_json | JSONB | last accepted result |
| created_at | TIMESTAMPTZ | |

#### `sessions_registry`

Maps PHP session ids to `user_id` for global invalidation on password reset/change, deactivation, and deletion.

#### `audit_events`

Immutable append-only: id, actor_id, actor_role, action, target_type, target_id, reason, before_json, after_json, created_at. No UPDATE/DELETE via product APIs.

#### Operational limits (canonical)

| Limit | Value |
|-------|-------|
| Password length | 8–128 |
| Username | 3–32, `[a-zA-Z0-9._-]` |
| Maps per user | 100 |
| Elements per map | 5 000 |
| Photos per element | 10 |
| Photo size | 5 MB |
| Photo types | JPEG, PNG, WebP |
| Vertices per line/polygon | 10 000 |
| Verification / reset token TTL | 24 hours, single use |
| Auth rate limit | 10 attempts / 15 min per IP+identifier |
| Registration / resend / recovery rate limits | bounded similarly; generic responses where required |

Terms/privacy current versions: `TERMS_VERSION` and `PRIVACY_VERSION` env/config constants; document bodies are external content.

### API Endpoints

All private routes require a valid session unless noted. JSON request/response unless multipart upload.

#### Auth & account

| Method | Path | Description |
|--------|------|-------------|
| POST | `/php/auth/register.php` | Create pending user; send verification mail |
| POST | `/php/auth/verify.php` | Consume verification token → active+verified |
| POST | `/php/auth/resend_verification.php` | Rate-limited resend; generic OK |
| POST | `/php/auth/login.php` | Identifier (email\|username) + password → session |
| POST | `/php/auth/logout.php` | Destroy current session |
| GET | `/php/auth/me.php` | Current user or 401 |
| POST | `/php/auth/password_forgot.php` | Always generic success |
| POST | `/php/auth/password_reset.php` | Token + new password; invalidate all sessions |
| PATCH | `/php/auth/profile.php` | Professional fields |
| POST | `/php/auth/change_username.php` | Uniqueness validated |
| POST | `/php/auth/change_email.php` | Sets pending_email; send verify |
| POST | `/php/auth/change_password.php` | Requires current password; global session revoke |
| POST | `/php/auth/delete_account.php` | Password + confirm phrase; hard delete |

#### Maps & elements

| Method | Path | Description |
|--------|------|-------------|
| GET | `/php/maps/list.php` | Owned maps (search/pagination) |
| GET | `/php/maps/get.php?id=` | Owned or admin-with-reason |
| POST | `/php/maps/create.php` | Private map; allocate `public_id` |
| PATCH | `/php/maps/update.php` | Rename/details; `base_version` + `client_mutation_id` |
| DELETE | `/php/maps/delete.php` | Cascade elements/photos; idempotent |
| POST | `/php/maps/publish.php` | Owner publish |
| POST | `/php/maps/unpublish.php` | Owner unpublish |
| GET | `/php/elements/list.php?map_id=` | Owned map elements as GeoJSON props |
| POST | `/php/elements/create.php` | Validate geometry; version 1 |
| PATCH | `/php/elements/update.php` | Version check |
| DELETE | `/php/elements/delete.php` | Cascade photos |

#### Photos & sync

| Method | Path | Description |
|--------|------|-------------|
| POST | `/php/photos/upload.php` | multipart; element ownership |
| DELETE | `/php/photos/delete.php` | Versioned delete |
| GET | `/php/photos/get.php?id=` | Bytes if owner or public-eligible |
| POST | `/php/sync/push.php` | Batch `SyncMutation[]` → results/conflicts |
| POST | `/php/sync/resolve.php` | User conflict choice → authoritative write |

#### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/php/public/maps.php` | Published, non-moderated, owner active; `q`, page |
| GET | `/php/public/map.php?public_id=` | Recheck publication on every request |
| GET | `/php/public/elements.php?public_id=` | Read-only elements |
| GET | `/php/public/photo.php?id=` | Read-only if map currently public |

#### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/php/admin/users.php` | Search accounts |
| POST | `/php/admin/user_status.php` | activate/deactivate + reason; audit + notify |
| POST | `/php/admin/moderate_map.php` | Hide public map + reason; audit + notify |
| POST | `/php/admin/private_access.php` | View private map; reason required; audit |
| POST | `/php/admin/private_mutate.php` | Edit/delete map/element; reason; audit before/after; notify |
| GET | `/php/admin/audit.php` | Search immutable audit |

#### Ops CLIs

| Command | Description |
|---------|-------------|
| `php php/bin/migrate.php` | Apply pending SQL migrations |
| `php php/bin/seed_admin.php` | Create first admin from env if none exists |

Status codes: 200/201 success; 400 validation; 401 unauthenticated; 403 forbidden/account state; 404 not found (no private leak); 409 conflict (version); 429 rate limited; 500 unexpected.

## Integration Points

### SMTP

- Purpose: verification, email-change verification, password recovery, admin-action owner notifications.
- Auth: SMTP credentials from env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`).
- Errors: enqueue failure logged; user-facing flows still return safe generic success where enumeration must be avoided; resend remains available under rate limits.
- Dev: Mailpit/Mailhog-compatible SMTP.

### Tile providers / Capacitor

- Unchanged client integrations; offline tiles stay on Capacitor Filesystem via existing `tileManager.js`.
- Not authoritative for map feature data.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|---------------------|-----------------|
| `src/App.jsx` | modified | Auth bypass `isAuthenticated = true` | Wire real auth gate |
| `src/lib/AuthContext.jsx` | modified | Mock user / missing methods | Full session API |
| `src/components/ProtectedRoute.jsx` | modified | Broken `checkUserAuth` | Align with AuthContext |
| `src/page/Login.jsx` | modified | Login-only | Registration, recovery links |
| `src/page/DashBoard.jsx` | modified | Local maps only | Server list + badges + gallery link |
| `src/page/MapEditor.jsx` | modified | Local CRUD; export still owner-only | Server + offline queue; hide export on public |
| `src/api/apiClient.js` | modified | localStorage mock | Real HTTP + sync hooks |
| `src/lib/offline/*` | new | IndexedDB store | Implement |
| `src/lib/sync/*` | new | Outbox engine | Implement |
| Public gallery pages | new | Anonymous routes | `/gallery`, `/gallery/:publicId` |
| Admin pages | new | Role-gated | `/admin/...` |
| Profile / settings | new | Credentials & deletion | Routes + forms |
| `php/*.php` legacy | modified/deprecated | Inconsistent schema/auth | Replace with modular endpoints |
| `php/config.php` + migrations | new | Env + schema | Required before feature APIs |
| `package.json` | modified | Add vitest, idb | DevDeps + scripts |
| Composer/PHPUnit | new | Backend tests | Introduce |
| Vite proxy | modified | `/php` proxy | Dev DX |

## Testing Approach

- **Vitest**: unit tests for validators, Offline outbox, sync conflict reducers, API client error mapping; jsdom component tests for auth gates where useful. Fake `fetch` and IndexedDB.
- **PHPUnit**: HTTP/API contract tests against ephemeral PostGIS; fixtures seed users/maps; assert ownership isolation, publication filters, version conflicts, cascades.
- **E2E smoke (optional later)**: Playwright for register→verify→create→publish→anonymous view; not blocking for initial task decomposition.
- Concrete cases: `_tests.md`.

## Development Sequencing

### Build Order

1. **Env + PHP bootstrap + migrations** — users/maps/elements/photos/tokens/audit/sessions_registry; PostGIS extension.
2. **Admin seed CLI** — first admin.
3. **Auth endpoints + mailer** — register/verify/login/logout/me/recovery/profile/password.
4. **Reactivate client auth** — AuthContext, ProtectedRoute, Login/Register/Recovery UI; remove App bypass.
5. **Maps & elements CRUD APIs** — ownership, GeoJSON round-trip, versions, idempotency table.
6. **Swap `api.entities.*` to HTTP** — Dashboard + MapEditor online path.
7. **Photos upload/serve** — filesystem + limits.
8. **IndexedDB OfflineStore + SyncEngine + sync API** — prepare offline, outbox, conflicts, logout cleanup.
9. **Publish/unpublish + public gallery/routes** — anonymous read-only.
10. **Admin APIs + UI** — status, moderation, private intervention, audit.
11. **Account deletion** — hard delete cascades + session wipe + client clear.
12. **Vitest + PHPUnit suites** from `_tests.md` assigned tasks.

### Technical Dependencies

- PostgreSQL with PostGIS enabled.
- Writable uploads directory and SMTP reachability (or Mailpit in dev).
- Capacitor cookie/WebView verification on Android for session auth.
- Product/legal supply of Terms and Privacy text matching `TERMS_VERSION` / `PRIVACY_VERSION`.

## Monitoring and Observability

| Signal | Purpose |
|--------|---------|
| `auth.login_failure`, `auth.rate_limited` | Abuse / lockout tuning |
| `auth.verification_sent`, `mail.send_failure` | Delivery health |
| `sync.push_total`, `sync.conflict_total`, `sync.fail_total` | Field sync quality |
| `maps.publish`, `maps.moderate` | Moderation ops |
| `admin.private_access`, `admin.mutate` | Privileged action volume |
| `account.delete_started/completed` | Privacy erasure |
| `http.request` with route, status, user_id hash, latency | API SLOs |

Structured PHP logs: `request_id`, `route`, `user_id`, `code`, `duration_ms`. Alert on mail failure rate, 5xx spike, and sync failure ratio. Never log raw passwords or full reset tokens.

## Technical Considerations

### Key Decisions

| Decision | Rationale | Trade-offs | Rejected |
|----------|-----------|------------|----------|
| Evolve procedural PHP | Matches PRD and existing PostGIS/session code | Less framework structure | Laravel/Node rewrite; split auth service |
| Cookie PHP sessions | Existing pattern; revocable | CORS/WebView care | JWT-only; bearer-in-localStorage |
| Normalized PostGIS schema + migrations | Fixes broken contracts; enables sync/audit | Cutover effort | Patch `social` JSON in place |
| Filesystem photos | Simple ops for current scale | Backup dual domain | S3; BYTEA |
| IndexedDB outbox + version conflicts | PRD offline + no LWW | Conflict UI cost | localStorage; CRDT |
| SMTP env mailer | Provider-agnostic | Self-managed deliverability | HTTP-only SaaS SDK |
| Free identity after delete | Re-enrollment without restoring data | Audit refers to dead UUIDs | Permanent tombstones |
| Admin seed CLI | No self-elevation | Ops env discipline | First-user-is-admin |
| Multi-session + global revoke on credential events | Field multi-device + security | Session registry needed | Single-session only |
| `public_id` UUID routes | Stable, non-enumerable titles | Less pretty URLs | Slugs; internal numeric ids |
| Vitest + PHPUnit | Covers client outbox and API contracts | Tooling introduciton | E2E-first; PHP-only |

### Known Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Capacitor cookie session breakage | Medium | Early Android smoke; document WebView cookie settings |
| Sync delete vs offline recreate | Medium | Deletion conflicts; never silent recreate |
| Upload orphans / path traversal | Medium | UUID filenames; reconcile job; authz on every GET |
| Enumeration via timing on recovery | Low–Medium | Constant responses; rate limits; uniform work |
| Large map offline quota | Medium | Prepare-time size estimate; quota errors before loss |
| Admin overreach | Medium | Mandatory reason, immutable audit, owner email notify |
| Terms content not ready | Certain until legal | Ship version constants; block registration copy until texts exist |

## Architecture Decision Records

### Product (from PRD)

- [ADR-001: Open Account Registration and Verified Identity](adrs/adr-001.md) — Open registration, verified email, dual-identifier login, self-service recovery.
- [ADR-002: Private Ownership with Anonymous Public Maps](adrs/adr-002.md) — Private by default; owner-published anonymous read-only gallery.
- [ADR-003: Account-Bound Offline Editing and Explicit Conflict Resolution](adrs/adr-003.md) — Offline edits, explicit conflicts, safe logout.
- [ADR-004: Administrative Access with Auditing and Owner Notification](adrs/adr-004.md) — Broad admin powers with audit and notification.
- [ADR-005: Durable Geospatial Records and Complete Account Deletion](adrs/adr-005.md) — PostGIS authority and complete deletion.

### Technical (this TechSpec)

- [ADR-006: Evolve Procedural PHP as Authoritative Backend](adrs/adr-006.md) — Keep and harden PHP instead of rewriting.
- [ADR-007: Cookie-Based PHP Sessions and Multi-Device Policy](adrs/adr-007.md) — Secure cookies; multi-session; global revoke on credential/lifecycle events.
- [ADR-008: Versioned Normalized PostgreSQL/PostGIS Schema](adrs/adr-008.md) — Migrations, normalized tables, SRID 4326, version columns.
- [ADR-009: Filesystem Photo Storage with Controlled URLs](adrs/adr-009.md) — Disk binaries + `photos` metadata and authorized GETs.
- [ADR-010: IndexedDB Outbox with Optimistic Conflict Snapshots](adrs/adr-010.md) — Account-bound offline cache/outbox; two-snapshot conflicts.
- [ADR-011: Admin Bootstrap Seed and Identity Reuse After Deletion](adrs/adr-011.md) — Env seed for first admin; free identifiers after hard delete.
- [ADR-012: Vitest and PHPUnit Test Strategy](adrs/adr-012.md) — Client and API test runners; optional E2E smoke later.

## Story → Component Mapping

| Stories | Technical components |
|---------|---------------------|
| US-001–US-002 | Auth API, mailer, Login/Register UI, token tables |
| US-003–US-005 | Session auth, profile endpoints, AuthContext, settings UI |
| US-006–US-008 | Maps/elements/photos APIs, MapEditor, Dashboard, filesystem media |
| US-009–US-011 | OfflineStore, SyncEngine, sync API, logout flow |
| US-012–US-014 | Publish APIs, public routes, gallery pages, read-only map view |
| US-015–US-017 | Admin API, audit_events, admin UI, notifications |
| US-018 | delete_account API, cascades, client wipe, identity reuse |
