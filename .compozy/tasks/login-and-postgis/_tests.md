# Test Specification: Account Access and PostGIS Map Persistence

Canonical test contract for account access, PostGIS persistence, offline sync, publication, and administration. Companion to `_techspec.md`.
Derived from `_user_stories.md` (behavior) and `_techspec.md` (components).

## Strategy

- Frameworks and harnesses: **Vitest** (client unit/integration with fake `fetch` / IndexedDB); **PHPUnit** API/contract tests against disposable PostgreSQL+PostGIS; SMTP faked at mailer boundary; filesystem uploads in temp dirs.
- Execution: `npm test` (Vitest); `composer test` or `vendor/bin/phpunit` for PHP. Optional Playwright smoke later for journeys already covered by E2E IDs below.
- Conventions: one observable behavior per ID; tag unit classes; table-driven validation suites where natural; never assert on raw SQL error strings leaking to clients.

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
| --- | --- | --- | --- | --- |
| US-001 | Create a professional account | UT-001, UT-002, UT-003, UT-004, UT-005, UT-006, UT-007 |  | E2E-001 |
| US-001.EC-1 | Invalid input | UT-008 | — | — |
| US-001.EC-2 | Empty / missing | UT-009 | — | — |
| US-001.EC-3 | Limits | UT-010 | — | — |
| US-001.EC-4 | Permissions | UT-011 | — | — |
| US-001.EC-5 | Concurrency | — | IT-001 | — |
| US-001.EC-6 | Interruption | UT-012 | — | — |
| US-001.EC-7 | Repetition | — | IT-002 | — |
| US-001.EC-8 | Ordering | — | IT-003 | — |
| US-001.EC-9 | State transitions | — | IT-004 | — |
| US-001.EC-10 | Scale | — | IT-005 | — |
| US-002 | Verify an email address | UT-013, UT-014, UT-015 |  | E2E-002 |
| US-002.EC-1 | Invalid input | UT-016 | — | — |
| US-002.EC-2 | Empty / missing | UT-017 | — | — |
| US-002.EC-3 | Limits | UT-018 | — | — |
| US-002.EC-4 | Permissions | — | IT-006 | — |
| US-002.EC-5 | Concurrency | — | IT-007 | — |
| US-002.EC-6 | Interruption | — | IT-008 | — |
| US-002.EC-7 | Repetition | UT-019 | — | — |
| US-002.EC-8 | Ordering | — | IT-009 | — |
| US-002.EC-9 | State transitions | — | IT-010 | — |
| US-002.EC-10 | Scale | UT-020 | — | — |
| US-003 | Log in with email or username | UT-021, UT-022, UT-023, UT-024, UT-025 |  | E2E-003 |
| US-003.EC-1 | Invalid input | UT-026 | — | — |
| US-003.EC-2 | Empty / missing | UT-027 | — | — |
| US-003.EC-3 | Limits | UT-028 | — | — |
| US-003.EC-4 | Permissions | UT-029 | — | — |
| US-003.EC-5 | Concurrency | — | IT-011 | — |
| US-003.EC-6 | Interruption | UT-030 | — | — |
| US-003.EC-7 | Repetition | UT-031 | — | — |
| US-003.EC-8 | Ordering | — | IT-012 | — |
| US-003.EC-9 | State transitions | — | IT-013 | — |
| US-003.EC-10 | Scale | — | IT-014 | — |
| US-004 | Recover a forgotten password | UT-032, UT-033, UT-034 |  | E2E-004 |
| US-004.EC-1 | Invalid input | UT-035 | — | — |
| US-004.EC-2 | Empty / missing | UT-036 | — | — |
| US-004.EC-3 | Limits | UT-037 | — | — |
| US-004.EC-4 | Permissions | — | IT-015 | — |
| US-004.EC-5 | Concurrency | — | IT-016 | — |
| US-004.EC-6 | Interruption | — | IT-017 | — |
| US-004.EC-7 | Repetition | UT-038 | — | — |
| US-004.EC-8 | Ordering | — | IT-018 | — |
| US-004.EC-9 | State transitions | — | IT-019 | — |
| US-004.EC-10 | Scale | — | IT-020 | — |
| US-005 | Maintain profile and credentials | UT-039, UT-040, UT-041, UT-042 |  | E2E-005 |
| US-005.EC-1 | Invalid input | UT-043 | — | — |
| US-005.EC-2 | Empty / missing | UT-044 | — | — |
| US-005.EC-3 | Limits | UT-045 | — | — |
| US-005.EC-4 | Permissions | — | IT-021 | — |
| US-005.EC-5 | Concurrency | — | IT-022 | — |
| US-005.EC-6 | Interruption | — | IT-023 | — |
| US-005.EC-7 | Repetition | UT-046 | — | — |
| US-005.EC-8 | Ordering | — | IT-024 | — |
| US-005.EC-9 | State transitions | — | IT-025 | — |
| US-005.EC-10 | Scale | — | IT-026 | — |
| US-006 | Create and manage owned maps | UT-047, UT-048, UT-049, UT-050 |  | E2E-006 |
| US-006.EC-1 | Invalid input | UT-051 | — | — |
| US-006.EC-2 | Empty / missing | UT-052 | — | — |
| US-006.EC-3 | Limits | UT-053 | — | — |
| US-006.EC-4 | Permissions | — | IT-027 | — |
| US-006.EC-5 | Concurrency | — | IT-028 | — |
| US-006.EC-6 | Interruption | UT-054 | — | — |
| US-006.EC-7 | Repetition | — | IT-029 | — |
| US-006.EC-8 | Ordering | — | IT-030 | — |
| US-006.EC-9 | State transitions | — | IT-031 | — |
| US-006.EC-10 | Scale | — | IT-032 | — |
| US-007 | Capture and edit geospatial elements | UT-055, UT-056, UT-057, UT-058 |  | E2E-007 |
| US-007.EC-1 | Invalid input | UT-059 | — | — |
| US-007.EC-2 | Empty / missing | UT-060 | — | — |
| US-007.EC-3 | Limits | UT-061 | — | — |
| US-007.EC-4 | Permissions | — | IT-033 | — |
| US-007.EC-5 | Concurrency | — | IT-034 | — |
| US-007.EC-6 | Interruption | UT-062 | — | — |
| US-007.EC-7 | Repetition | — | IT-035 | — |
| US-007.EC-8 | Ordering | UT-063 | — | — |
| US-007.EC-9 | State transitions | — | IT-036 | — |
| US-007.EC-10 | Scale | — | IT-037 | — |
| US-008 | Attach photos to elements | UT-064, UT-065, UT-066 |  | E2E-008 |
| US-008.EC-1 | Invalid input | UT-067 | — | — |
| US-008.EC-2 | Empty / missing | UT-068 | — | — |
| US-008.EC-3 | Limits | UT-069 | — | — |
| US-008.EC-4 | Permissions | — | IT-038 | — |
| US-008.EC-5 | Concurrency | — | IT-039 | — |
| US-008.EC-6 | Interruption | — | IT-040 | — |
| US-008.EC-7 | Repetition | — | IT-041 | — |
| US-008.EC-8 | Ordering | UT-070 | — | — |
| US-008.EC-9 | State transitions | — | IT-042 | — |
| US-008.EC-10 | Scale | — | IT-043 | — |
| US-009 | Work on downloaded maps without connectivity | UT-071, UT-072, UT-073, UT-074 |  | E2E-009 |
| US-009.EC-1 | Invalid input | UT-075 | — | — |
| US-009.EC-2 | Empty / missing | UT-076 | — | — |
| US-009.EC-3 | Limits | UT-077 | — | — |
| US-009.EC-4 | Permissions | UT-078 | — | — |
| US-009.EC-5 | Concurrency | UT-079 | — | — |
| US-009.EC-6 | Interruption | UT-080 | — | — |
| US-009.EC-7 | Repetition | UT-081 | — | — |
| US-009.EC-8 | Ordering | UT-082 | — | — |
| US-009.EC-9 | State transitions | UT-083 | — | — |
| US-009.EC-10 | Scale | UT-084 | — | — |
| US-010 | Synchronize changes and resolve conflicts | UT-085, UT-086, UT-087, UT-088 |  | E2E-010 |
| US-010.EC-1 | Invalid input | UT-089 | — | — |
| US-010.EC-2 | Empty / missing | UT-090 | — | — |
| US-010.EC-3 | Limits | — | IT-044 | — |
| US-010.EC-4 | Permissions | — | IT-045 | — |
| US-010.EC-5 | Concurrency | — | IT-046 | — |
| US-010.EC-6 | Interruption | — | IT-047 | — |
| US-010.EC-7 | Repetition | — | IT-048 | — |
| US-010.EC-8 | Ordering | UT-091 | — | — |
| US-010.EC-9 | State transitions | — | IT-049 | — |
| US-010.EC-10 | Scale | — | IT-050 | — |
| US-011 | Log out without silently losing work | UT-092, UT-093, UT-094, UT-095 |  | E2E-011 |
| US-011.EC-1 | Invalid input | UT-096 | — | — |
| US-011.EC-2 | Empty / missing | UT-097 | — | — |
| US-011.EC-3 | Limits | UT-098 | — | — |
| US-011.EC-4 | Permissions | UT-099 | — | — |
| US-011.EC-5 | Concurrency | UT-100 | — | — |
| US-011.EC-6 | Interruption | UT-101 | — | — |
| US-011.EC-7 | Repetition | UT-102 | — | — |
| US-011.EC-8 | Ordering | UT-103 | — | — |
| US-011.EC-9 | State transitions | UT-104 | — | — |
| US-011.EC-10 | Scale | UT-105 | — | — |
| US-012 | Publish and unpublish an owned map | UT-106, UT-107, UT-108, UT-109 |  | E2E-012 |
| US-012.EC-1 | Invalid input | UT-110 | — | — |
| US-012.EC-2 | Empty / missing | UT-111 | — | — |
| US-012.EC-3 | Limits | UT-112 | — | — |
| US-012.EC-4 | Permissions | — | IT-051 | — |
| US-012.EC-5 | Concurrency | — | IT-052 | — |
| US-012.EC-6 | Interruption | UT-113 | — | — |
| US-012.EC-7 | Repetition | — | IT-053 | — |
| US-012.EC-8 | Ordering | — | IT-054 | — |
| US-012.EC-9 | State transitions | — | IT-055 | — |
| US-012.EC-10 | Scale | — | IT-056 | — |
| US-013 | Discover published maps | UT-114, UT-115, UT-116 |  | E2E-013 |
| US-013.EC-1 | Invalid input | UT-117 | — | — |
| US-013.EC-2 | Empty / missing | UT-118 | — | — |
| US-013.EC-3 | Limits | UT-119 | — | — |
| US-013.EC-4 | Permissions | — | IT-057 | — |
| US-013.EC-5 | Concurrency | — | IT-058 | — |
| US-013.EC-6 | Interruption | UT-120 | — | — |
| US-013.EC-7 | Repetition | UT-121 | — | — |
| US-013.EC-8 | Ordering | — | IT-059 | — |
| US-013.EC-9 | State transitions | — | IT-060 | — |
| US-013.EC-10 | Scale | — | IT-061 | — |
| US-014 | Inspect a published map | UT-122, UT-123, UT-124 |  | E2E-014 |
| US-014.EC-1 | Invalid input | UT-125 | — | — |
| US-014.EC-2 | Empty / missing | UT-126 | — | — |
| US-014.EC-3 | Limits | — | IT-062 | — |
| US-014.EC-4 | Permissions | — | IT-063 | — |
| US-014.EC-5 | Concurrency | — | IT-064 | — |
| US-014.EC-6 | Interruption | UT-127 | — | — |
| US-014.EC-7 | Repetition | UT-128 | — | — |
| US-014.EC-8 | Ordering | — | IT-065 | — |
| US-014.EC-9 | State transitions | — | IT-066 | — |
| US-014.EC-10 | Scale | — | IT-067 | — |
| US-015 | Manage account status | UT-129, UT-130, UT-131, UT-132 |  | E2E-015 |
| US-015.EC-1 | Invalid input | UT-133 | — | — |
| US-015.EC-2 | Empty / missing | UT-134 | — | — |
| US-015.EC-3 | Limits | — | IT-068 | — |
| US-015.EC-4 | Permissions | — | IT-069 | — |
| US-015.EC-5 | Concurrency | — | IT-070 | — |
| US-015.EC-6 | Interruption | UT-135 | — | — |
| US-015.EC-7 | Repetition | UT-136 | — | — |
| US-015.EC-8 | Ordering | — | IT-071 | — |
| US-015.EC-9 | State transitions | UT-137 | — | — |
| US-015.EC-10 | Scale | — | IT-072 | — |
| US-016 | Moderate public maps | UT-138, UT-139, UT-140 |  | E2E-016 |
| US-016.EC-1 | Invalid input | UT-141 | — | — |
| US-016.EC-2 | Empty / missing | UT-142 | — | — |
| US-016.EC-3 | Limits | UT-143 | — | — |
| US-016.EC-4 | Permissions | — | IT-073 | — |
| US-016.EC-5 | Concurrency | — | IT-074 | — |
| US-016.EC-6 | Interruption | — | IT-075 | — |
| US-016.EC-7 | Repetition | UT-144 | — | — |
| US-016.EC-8 | Ordering | — | IT-076 | — |
| US-016.EC-9 | State transitions | — | IT-077 | — |
| US-016.EC-10 | Scale | — | IT-078 | — |
| US-017 | Intervene in private maps with accountability | UT-145, UT-146, UT-147, UT-148 |  | E2E-017 |
| US-017.EC-1 | Invalid input | UT-149 | — | — |
| US-017.EC-2 | Empty / missing | UT-150 | — | — |
| US-017.EC-3 | Limits | UT-151 | — | — |
| US-017.EC-4 | Permissions | — | IT-079 | — |
| US-017.EC-5 | Concurrency | — | IT-080 | — |
| US-017.EC-6 | Interruption | — | IT-081 | — |
| US-017.EC-7 | Repetition | — | IT-082 | — |
| US-017.EC-8 | Ordering | UT-152 | — | — |
| US-017.EC-9 | State transitions | — | IT-083 | — |
| US-017.EC-10 | Scale | — | IT-084 | — |
| US-018 | Permanently delete an account and its data | UT-153, UT-154, UT-155, UT-156 |  | E2E-018 |
| US-018.EC-1 | Invalid input | UT-157 | — | — |
| US-018.EC-2 | Empty / missing | UT-158 | — | — |
| US-018.EC-3 | Limits | — | IT-085 | — |
| US-018.EC-4 | Permissions | — | IT-086 | — |
| US-018.EC-5 | Concurrency | — | IT-087 | — |
| US-018.EC-6 | Interruption | — | IT-088 | — |
| US-018.EC-7 | Repetition | UT-159 | — | — |
| US-018.EC-8 | Ordering | UT-160 | — | — |
| US-018.EC-9 | State transitions | — | IT-089 | — |
| US-018.EC-10 | Scale | — | IT-090 | — |
| Auth guard helper | Session required on mutators | UT-161, UT-162 | — | — |
| GeoJSON/PostGIS codec | SRID 4326 round-trip / reject invalid | UT-163 | — | — |
| OfflineStore | Account-bound outbox | UT-164, UT-165 | — | — |
| SyncEngine | Conflict reduce / API errors | UT-166, UT-167 | — | — |
| seed_admin / migrate CLIs | Bootstrap invariants | UT-168, UT-169, UT-170 | — | — |
| Photo authz + mailer | Private deny / verification mail | UT-171, UT-172 | — | — |

## Unit Tests

### US-001: Create a professional account (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-001** (happy): register() with unique username/email, full profile, matching passwords, and consent versions TERMS_v1/PRIVACY_v1 creates status=pending_verification and enqueues verification mail.
- **UT-002** (error): register() with password!==confirmation returns validation_error on password_confirmation and inserts zero users.
- **UT-003** (error): register() missing consent returns validation_error on consent and inserts zero users.
- **UT-004** (error): register() duplicate username returns fields.username uniqueness error.
- **UT-005** (error): register() duplicate email returns fields.email uniqueness error.
- **UT-006** (boundary): register() username length 2 returns validation_error; length 3 succeeds when other fields valid.
- **UT-007** (state): pending user cannot create map: maps/create.php returns account_pending.
- **UT-008** (error): register() rejects malformed email and hostile full_name without reflecting raw HTML in error message.
- **UT-009** (error): register() with any required field omitted lists each missing field and creates no user.
- **UT-010** (boundary): register() with full_name > max length returns validation_error; 11th registration attempt from same IP within window returns rate_limited.
- **UT-011** (state): authenticated session opening register UI is redirected to workspace (client guard).
- **UT-012** (error): api.auth.register surfaces network failure without storing local pending account as verified.

### US-002: Verify an email address (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-013** (happy): verify.php with valid unused token before expiry sets email_verified_at and status=active.
- **UT-014** (error): verify.php with expired token returns validation_error and leaves status unchanged.
- **UT-015** (happy): resend_verification.php for pending email returns generic success and sends mail when account pending.
- **UT-016** (error): verify.php with tampered token hash returns not_found/invalid and activates nobody.
- **UT-017** (error): verify.php without token returns validation_error.
- **UT-018** (boundary): resend_verification exceeding rate returns rate_limited with retry guidance.
- **UT-019** (idempotency): used token replay returns safe already-used and does not re-send mail.
- **UT-020** (happy): UI reports pending delivery state when resend accepted under backlog (mailer stub records intent).

### US-003: Log in with email or username (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-021** (happy): login with email+password for active verified user sets session and me.php returns user.
- **UT-022** (happy): login with username+password for same user succeeds.
- **UT-023** (error): wrong password returns generic 401 without revealing whether identifier exists.
- **UT-024** (state): correct password for pending user returns account_pending with resend affordance.
- **UT-025** (state): correct password for deactivated user returns account_deactivated.
- **UT-026** (error): hostile identifier string fails safely with generic auth error.
- **UT-027** (error): blank identifier or password blocked with field errors client-side and 400 server-side.
- **UT-028** (boundary): 11th failed login within 15m for same IP+identifier returns rate_limited.
- **UT-029** (state): anonymous attempting maps/create.php gets 401; client preserves return path after login.
- **UT-030** (error): login network failure does not set isAuthenticated.
- **UT-031** (idempotency): double submit after success navigates once (client).

### US-004: Recover a forgotten password (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-032** (happy): password_forgot.php returns identical success body for known and unknown emails.
- **UT-033** (happy): password_reset.php with valid token sets new hash; old password login fails; new succeeds.
- **UT-034** (error): expired/used token reset leaves password unchanged.
- **UT-035** (error): reset with malformed token or too-short password returns validation_error.
- **UT-036** (error): reset missing password fields returns validation_error with no hash change.
- **UT-037** (boundary): excessive forgot requests still return generic success and are rate_limited server-side.
- **UT-038** (idempotency): replay completed reset token fails without changing password again.

### US-005: Maintain profile and credentials (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-039** (happy): profile.php updates full_name/organization/job_title/phone.
- **UT-040** (happy): change_username.php to unique name; login accepts new and rejects old.
- **UT-041** (happy): change_email.php sets pending_email; recovery still uses old until verify.
- **UT-042** (happy): change_password.php with correct current password updates hash and revokes other sessions.
- **UT-043** (error): duplicate username/email or wrong current password returns precise field/code errors.
- **UT-044** (error): clearing required full_name rejected; DB unchanged.
- **UT-045** (boundary): overlong phone rejected; rapid profile patches rate_limited.
- **UT-046** (idempotency): repeat change_email for same pending address does not create duplicate active tokens beyond replace policy.

### US-006: Create and manage owned maps (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-047** (happy): maps/create.php for active user creates private map is_published=false with public_id.
- **UT-048** (happy): owner list/get/rename/delete operate only on owned maps.
- **UT-049** (error): get.php for another user map id returns 404/403 without body contents.
- **UT-050** (happy): empty list returns [] and UI empty-state create CTA.
- **UT-051** (error): create with invalid center/zoom returns validation_error.
- **UT-052** (error): blank name returns validation_error.
- **UT-053** (boundary): 101st map for user returns payload limit error; overlong name rejected.
- **UT-054** (error): offline create queued as pending in OfflineStore without claiming server success.

### US-007: Capture and edit geospatial elements (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-055** (happy): elements/create point/line/polygon with valid GeoJSON SRID4326 persists name/description/category/style/author/timestamps.
- **UT-056** (happy): elements/update changes geom+metadata and increments version.
- **UT-057** (happy): elements/delete removes element and its photos from private and public reads.
- **UT-058** (error): non-owner element mutate returns forbidden.
- **UT-059** (error): self-intersecting or invalid GeoJSON rejected with validation_error before insert.
- **UT-060** (error): missing geometry or name rejected.
- **UT-061** (boundary): polygon with 10001 vertices rejected; metadata over max length rejected.
- **UT-062** (error): interrupted capture keeps outbox pending draft; server has no corrupt row.
- **UT-063** (ordering): save without geometry remains unavailable client-side.

### US-008: Attach photos to elements (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-064** (happy): photos/upload.php attaches JPEG under 5MB; list shows photo id.
- **UT-065** (happy): photos/delete removes bytes and public GET becomes 404.
- **UT-066** (happy): public photo GET works when map published and not moderated.
- **UT-067** (error): upload exe/svg rejected; existing photos unchanged.
- **UT-068** (error): canceled empty upload creates no photo row.
- **UT-069** (boundary): 11th photo or >5MB returns payload_too_large/validation with remaining allowance.
- **UT-070** (ordering): upload queued offline before element sync waits until element id exists or cancels.

### US-009: Work on downloaded maps without connectivity (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-071** (happy): prepareOffline caches map/elements/photos in IndexedDB keyed by user id.
- **UT-072** (happy): offline edit enqueues outbox item status=pending.
- **UT-073** (error): opening non-prepared map offline yields unavailable state not partial data.
- **UT-074** (state): anonymous offline without cache does not claim online freshness.
- **UT-075** (error): offline invalid geometry rejected before outbox enqueue.
- **UT-076** (happy): no prepared maps shows offline empty state.
- **UT-077** (boundary): quota exceeded on prepare warns and does not corrupt existing cache.
- **UT-078** (state): cache for user A inaccessible after logout or when session is user B.
- **UT-079** (concurrency): two devices keep separate pending outboxes for later conflict handling.
- **UT-080** (happy): app restart recovers pending outbox records intact.
- **UT-081** (idempotency): duplicate offline action shares or dedupes client_mutation_id visibly.
- **UT-082** (ordering): queued delete after unsynced edit collapses to intended final local state.
- **UT-083** (state): on reconnect, remotely deleted cached map quarantined for review.
- **UT-084** (boundary): large prepared map open shows progress and remains interactive.

### US-010: Synchronize changes and resolve conflicts (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-085** (happy): sync.push applies valid pending mutations; statuses become synced; UI shows progress.
- **UT-086** (happy): version mismatch returns SyncConflict with local_snapshot and remote_snapshot.
- **UT-087** (happy): resolveConflict choice=local|remote writes winner and clears conflicted.
- **UT-088** (idempotency): replaying already accepted client_mutation_id does not duplicate resources.
- **UT-089** (error): queued op failing current validation marked failed; others continue.
- **UT-090** (happy): empty outbox reports up to date.
- **UT-091** (ordering): dependent photo upload waits for element create prerequisite.

### US-011: Log out without silently losing work (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-092** (happy): logout with empty outbox destroys session and clears IndexedDB account data.
- **UT-093** (happy): logout with pending + online attempts sync then clears on success.
- **UT-094** (state): logout with unsyncable pending requires explicit discard confirmation before clear.
- **UT-095** (state): after logout another account cannot read prior cache.
- **UT-096** (error): corrupt outbox item listed as unsent requiring discard decision.
- **UT-097** (happy): logout with no cache still ends session 200.
- **UT-098** (boundary): large queue shows logout progress and cancel.
- **UT-099** (state): expired session still runs local private data clear after pending handling.
- **UT-100** (concurrency): logout during active sync coordinates single completion/confirm path.
- **UT-101** (state): app kill mid-logout: next launch has no ambiguous authenticated private view.
- **UT-102** (idempotency): repeated logout taps trigger one flow.
- **UT-103** (ordering): clear-data waits for sync result or discard confirm.
- **UT-104** (state): deactivation during logout blocks new protected sync; discard rules remain.
- **UT-105** (boundary): many cached maps: cleanup removes all account-bound keys.

### US-012: Publish and unpublish an owned map (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-106** (happy): publish.php sets is_published=true; public map.php returns 200.
- **UT-107** (happy): unpublish.php hides from gallery and public map.php returns 404.
- **UT-108** (happy): new map default is_published=false.
- **UT-109** (error): non-owner publish returns forbidden.
- **UT-110** (error): publish blocked when required public-facing name invalid.
- **UT-111** (state): empty map publish requires explicit confirm flag or returns confirmation_required.
- **UT-112** (boundary): overlong public description rejected without truncation.
- **UT-113** (error): client does not show published until server success.

### US-013: Discover published maps (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-114** (happy): public/maps.php without auth returns only published non-moderated maps of active owners.
- **UT-115** (happy): q search matches name/description; excludes private.
- **UT-116** (happy): empty search results return [] with stable shape.
- **UT-117** (error): hostile q handled as literal search; no XSS in JSON.
- **UT-118** (happy): empty q returns default page of public maps.
- **UT-119** (boundary): overlong q rejected; pageSize capped.
- **UT-120** (error): offline search does not present stale as freshly current.
- **UT-121** (idempotency): repeat search does not duplicate ids in client merge.

### US-014: Inspect a published map (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-122** (happy): public map.php + elements.php allow read-only GeoJSON and photo ids.
- **UT-123** (error): public surface has no edit/export/download endpoints succeeding anonymously.
- **UT-124** (error): unpublished/moderated/deleted public_id returns 404.
- **UT-125** (error): malformed public_id returns 404.
- **UT-126** (happy): published empty map returns 200 with empty elements.
- **UT-127** (error): network fail distinguishes retryable unavailable from 404 deleted.
- **UT-128** (idempotency): repeat GET causes no mutation.

### US-015: Manage account status (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-129** (happy): admin users.php search returns status and professional fields.
- **UT-130** (happy): user_status deactivate stops sessions/mutations and unpublishes visibility.
- **UT-131** (happy): activate restores access only if email_verified.
- **UT-132** (happy): status change writes audit_events and enqueues owner notification mail.
- **UT-133** (error): invalid transition/id rejected without affecting others.
- **UT-134** (happy): empty search returns [].
- **UT-135** (error): client shows success only after authoritative response.
- **UT-136** (idempotency): repeat deactivate keeps deactivated; audits trace attempts without corrupt state.
- **UT-137** (error): activate deleted/missing user rejected.

### US-016: Moderate public maps (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-138** (happy): moderate_map.php clears public access immediately.
- **UT-139** (happy): moderation stores reason, audit actor, notifies owner.
- **UT-140** (happy): owner private get shows moderation_reason.
- **UT-141** (error): missing reason returns validation_error.
- **UT-142** (state): moderate already-unpublished still consistent private unavailable publicly.
- **UT-143** (boundary): overlong reason rejected.
- **UT-144** (idempotency): repeat moderate keeps unavailable; no contradictory published flag.

### US-017: Intervene in private maps with accountability (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-145** (happy): private_access.php with reason allows view and writes audit.
- **UT-146** (happy): private_mutate edit/delete applies change, stores before/after, notifies owner.
- **UT-147** (happy): owner notification/history identifies action/time/actor/target/reason.
- **UT-148** (error): no product API updates or deletes audit_events rows.
- **UT-149** (error): missing reason or invalid geometry rejects intervention.
- **UT-150** (happy): view empty private map still audits access.
- **UT-151** (boundary): large before/after stored with documented truncation policy that preserves identifiers.
- **UT-152** (ordering): notification sent only after confirmed commit.

### US-018: Permanently delete an account and its data (TechSpec: Auth/Maps/Sync/Admin as applicable)

- **UT-153** (happy): delete_account.php with password+confirm phrase hard-deletes user maps elements photos tokens sessions.
- **UT-154** (happy): after delete login fails; public routes 404.
- **UT-155** (state): client warns unsynced local work will be discarded.
- **UT-156** (happy): re-register same email creates empty account; old maps absent.
- **UT-157** (error): wrong password does not start deletion.
- **UT-158** (error): missing confirm phrase: no data changes.
- **UT-159** (idempotency): replay delete returns already-complete without recreate.
- **UT-160** (ordering): deletion requires current authenticated confirmation; mid-flow logout cancels.

### Shared components (TechSpec: Core Interfaces / CLIs)

- **UT-161** (error): PHP auth guard on elements/create without session returns 401.
- **UT-162** (error): ST_GeomFromGeoJSON failure path returns validation_error not 500 with raw PDO leak.
- **UT-163** (happy): ST_AsGeoJSON round-trip preserves point coordinates within tolerance.
- **UT-164** (happy): OfflineStore.enqueue writes pending row keyed by userId+client_mutation_id.
- **UT-165** (error): OfflineStore rejects cross-user read.
- **UT-166** (happy): SyncEngine.reduceConflicts maps 409 payload into conflicted outbox status.
- **UT-167** (error): api client maps 429 to rate_limited toast-friendly error.
- **UT-168** (happy): seed_admin.php creates admin when count(admin)=0.
- **UT-169** (error): seed_admin.php no-ops when admin exists.
- **UT-170** (happy): migrate.php applies pending SQL idempotently on second run.
- **UT-171** (happy): photo get.php denies private photo to anonymous.
- **UT-172** (happy): mailer sends verification with single-use token URL.

## Integration Tests

### API and multi-actor flows

- **IT-001**: two concurrent register.php with same email: exactly one 201 and one uniqueness validation_error; one user row.
- **IT-002**: identical valid register retried with same client idempotency key creates one user and bounded verification emails.
- **IT-003**: verify.php token for unknown user returns not_found without activating any account.
- **IT-004**: after hard-deleted user, register with same email succeeds as new pending user with empty maps.
- **IT-005**: registration under load still returns within timeout for valid unique payloads while rate limit remains enforced.
- **IT-006**: token for user A opened while session is user B verifies only user A; B session unchanged.
- **IT-007**: two concurrent valid verify requests for same token: account verified once; second is already-used safe response.
- **IT-008**: after successful verify, reopening link reports already verified without erroring into deactivated.
- **IT-009**: correct password login before verify returns account_pending and blocks maps/create.php.
- **IT-010**: verify token for deactivated account does not reactivate.
- **IT-011**: two devices login same account: both sessions valid in sessions_registry.
- **IT-012**: deep link /editor/:id after login returns to that route when authorized.
- **IT-013**: admin deactivates user mid-session: next maps/list.php returns 403 account_deactivated.
- **IT-014**: many parallel logins for different users never cross session user ids.
- **IT-015**: reset token for user A while logged in as B resets only A; B session intact until A global revoke rules apply to A only.
- **IT-016**: two concurrent resets with same token: one succeeds; other rejected; only one password current; all A sessions invalidated.
- **IT-017**: disconnect after reset submit: retry shows token used or success once; password not double-rotated to third value.
- **IT-018**: pending_verification user cannot use reset to become active map editor without verify.
- **IT-019**: deactivated/deleted account reset does not reactivate or recreate.
- **IT-020**: bulk forgot abuse does not reveal which emails exist via response diffs.
- **IT-021**: user B PATCH profile of A via forged id returns forbidden; A unchanged.
- **IT-022**: two sessions patch profile: last accepted write visible via me.php; stale write gets conflict or clear final state.
- **IT-023**: interrupted patch: reload me.php shows authoritative saved fields only.
- **IT-024**: verify older email-change token after newer change_email is rejected; only current pending_email can activate.
- **IT-025**: deactivated mid-edit: profile.php returns account_deactivated.
- **IT-026**: username uniqueness check remains correct with large users table fixture.
- **IT-027**: anonymous/pending/deactivated/non-owner mutate returns 401/403.
- **IT-028**: concurrent rename and delete: delete wins; subsequent update returns not_found.
- **IT-029**: create with same client_mutation_id retried returns same map id once.
- **IT-030**: opening /editor/:id evaluates authz before returning element payload.
- **IT-031**: update on deleted map returns not_found; unpublished owned map remains editable.
- **IT-032**: list with 100x maps supports pagination/search without returning other owners.
- **IT-033**: anonymous/pending/deactivated/non-owner denied.
- **IT-034**: two sessions update same element with same base_version: one succeeds version+1; other returns conflict with two snapshots.
- **IT-035**: retry create/delete with same client_mutation_id is idempotent.
- **IT-036**: update after remote delete returns deletion conflict; no silent recreate.
- **IT-037**: map with 100x elements lists with pagination/progress contract.
- **IT-038**: non-owner upload forbidden; anonymous write forbidden; anonymous read ok if public.
- **IT-039**: photo delete vs element update conflict surfaces resolvable conflicted state.
- **IT-040**: partial upload abort leaves no public-fetchable photo id.
- **IT-041**: retry upload with same client_mutation_id does not duplicate rows.
- **IT-042**: element deleted mid-upload: no orphan public photo.
- **IT-043**: many photos return progressively; get.php still authz-checked.
- **IT-044**: large batch push reports per-item failures and incremental progress.
- **IT-045**: deactivated mid-sync: protected mutations return forbidden and do not apply.
- **IT-046**: two devices push overlapping mutations: duplicates collapse via client_mutation_id; true conflicts remain.
- **IT-047**: disconnect mid-push: completed mutations stay synced; remainder resume.
- **IT-048**: replay same batch: server-visible creates occur once.
- **IT-049**: remote delete vs local edit → deletion conflict; no silent recreate.
- **IT-050**: 100x pending ops: progress observable; individual failures identifiable.
- **IT-051**: anonymous/pending/deactivated/non-owner denied.
- **IT-052**: publish/unpublish race: final DB state matches last accepted op; one gallery row max.
- **IT-053**: retry publish idempotent on public_id; no duplicate gallery entries.
- **IT-054**: public link before publish completes returns 404.
- **IT-055**: owner deactivated or map deleted → public 404.
- **IT-056**: many concurrent publishes: each map once; visibility owner-specific.
- **IT-057**: requesting private id via public list never returns it.
- **IT-058**: unpublish while results open: map.php recheck returns 404.
- **IT-059**: direct public_id route works without gallery preload when published.
- **IT-060**: moderated/deleted/owner-deactivated map in stale client list opens unavailable.
- **IT-061**: 100x public maps: pagination usable.
- **IT-062**: dense geometry loads via paginated/progressive elements list.
- **IT-063**: anonymous admin/owner mutate endpoints return 401.
- **IT-064**: owner updates element: anonymous refresh sees new version coherently.
- **IT-065**: element deep link checks map visibility before returning element.
- **IT-066**: map unpublished during view: subsequent element/photo GET 404.
- **IT-067**: 100x elements: viewport/progressive list remains usable.
- **IT-068**: large directory paginates.
- **IT-069**: field user hitting admin users.php gets 403 without data.
- **IT-070**: two admins flip status: final state correct; both attempts audited.
- **IT-071**: activate pending_verification user leaves map create blocked.
- **IT-072**: bulk status ops keep per-account isolation and complete audits.
- **IT-073**: non-admin moderate returns 403.
- **IT-074**: owner unpublish concurrent with moderate: final unavailable; admin attempt audited.
- **IT-075**: interrupted moderate: public recheck before success UI.
- **IT-076**: cached public page: fresh GET 404 after moderate.
- **IT-077**: moderate deleted map returns already-unavailable; no recreate.
- **IT-078**: audit search finds moderation rows at scale.
- **IT-079**: field/anonymous/invalid admin session denied.
- **IT-080**: owner and admin concurrent edit: conflict explicit; both attempts audited.
- **IT-081**: interrupted mutate: no false success; authoritative GET shows real state.
- **IT-082**: retry delete: resource deleted once; each attempt audited.
- **IT-083**: target deleted before intervene: no restore.
- **IT-084**: audit search at 100x volume remains complete for authorized admin.
- **IT-085**: large account deletion removes all owned rows; progress/completion observable.
- **IT-086**: other user cannot delete victim account.
- **IT-087**: race with edit/publish/sync/admin: deletion prevents new account-bound state and removes existing.
- **IT-088**: client disconnect after confirm: data stays deleted; safe status if identity permits.
- **IT-089**: deactivated self-delete path documented: secure recovery/admin assist without map reactivation shortcut.
- **IT-090**: very large delete revokes sessions/public access promptly while finalize completes.

## End-to-End Tests

### Create a professional account (US-001)

- **E2E-001**: Visitor opens /register → fills valid professional form + consent → sees verification-sent confirmation → pending user exists in DB.

### Verify an email address (US-002)

- **E2E-002**: Pending user opens email link → account active → login succeeds → can create first map.

### Log in with email or username (US-003)

- **E2E-003**: Verified user logs in with email → lands on private workspace listing only owned maps.

### Recover a forgotten password (US-004)

- **E2E-004**: User requests reset → opens link → sets new password → logs in with new password only.

### Maintain profile and credentials (US-005)

- **E2E-005**: User updates profile and username → sees new values → logs in with new username.

### Create and manage owned maps (US-006)

- **E2E-006**: Verified user creates map → sees it private in workspace → renames → deletes.

### Capture and edit geospatial elements (US-007)

- **E2E-007**: Owner draws point, line, polygon → edits metadata → deletes one element → map reflects server state.

### Attach photos to elements (US-008)

- **E2E-008**: Owner attaches photo to element → preview → publish map → anonymous can open photo; owner removes photo → anonymous 404.

### Work on downloaded maps without connectivity (US-009)

- **E2E-009**: User prepares map → goes offline → edits element (pending badge) → unprepared map shows unavailable.

### Synchronize changes and resolve conflicts (US-010)

- **E2E-010**: Two sessions edit same element → sync shows conflict UI with both versions → user picks one → both sessions converge.

### Log out without silently losing work (US-011)

- **E2E-011**: User with pending edits logs out → confirms discard or syncs → relaunch shows login and no prior maps.

### Publish and unpublish an owned map (US-012)

- **E2E-012**: Owner publishes map after warning → appears in gallery → unpublishes → gallery and direct link unavailable.

### Discover published maps (US-013)

- **E2E-013**: Anonymous opens /gallery → searches → opens a result map.

### Inspect a published map (US-014)

- **E2E-014**: Anonymous opens public route → pans map → inspects element and photo → no edit controls.

### Manage account status (US-015)

- **E2E-015**: Admin searches user → deactivates with reason → user login blocked and public maps gone → activate restores when verified.

### Moderate public maps (US-016)

- **E2E-016**: Admin moderates published map with reason → gallery gone → owner sees reason privately.

### Intervene in private maps with accountability (US-017)

- **E2E-017**: Admin opens private map with reason → edits element → owner receives notification; audit lists before/after.

### Permanently delete an account and its data (US-018)

- **E2E-018**: User confirms account deletion → cannot login → former public_id 404 → new registration with same email has empty workspace.

## Endpoint Contract Checklist

Each TechSpec route must have success and documented failure coverage via the IDs above. Additional explicit contract anchors:

- **IT-091**: POST /php/auth/register.php success 201 pending_verification; validation 400; rate_limited 429.
- **IT-092**: POST /php/auth/login.php success 200 sets cookie; generic 401; account_pending 403; account_deactivated 403; rate_limited 429.
- **IT-093**: POST /php/sync/push.php returns per-mutation synced|conflict|failed; idempotent client_mutation_id.
- **IT-094**: GET /php/public/map.php?public_id= published 200; private/moderated/unpublished 404.
- **IT-095**: POST /php/admin/private_mutate.php requires reason; writes audit before/after; notifies owner.
- **IT-096**: POST /php/auth/delete_account.php cascades DB+files; frees username/email uniqueness.

## Notes

- E2E IDs may be implemented as Playwright later or as full-stack PHPUnit+Vitest journey tests that drive the same observable outcomes through the public UI/API surface.
- Coverage gap: none identified relative to `_user_stories.md` EC catalog; Terms/Privacy document body content is out of test scope until legal copy exists (version string acceptance is covered under US-001).
