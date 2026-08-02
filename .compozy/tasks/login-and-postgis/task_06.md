---
status: completed
title: "Admin accountability and permanent account deletion"
type: backend
complexity: high
---

# Task 6: Admin accountability and permanent account deletion

## Overview
Delivers role-gated administration (account status, public moderation, audited private intervention) plus permanent self-service account deletion with cascading data removal and identity reuse. Closes the privileged-ops and privacy lifecycle for the feature.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST implement admin APIs: users search, user_status activate/deactivate (+ reason), moderate_map, private_access, private_mutate, audit list — all requiring `role=admin`.
2. MUST write immutable `audit_events` (no product UPDATE/DELETE) with actor, target, action, reason, before/after where applicable; notify owners via mailer on confirmed admin outcomes.
3. MUST deactivate: end protected use, revoke sessions, remove public visibility; activate only restores when email verification still satisfied.
4. MUST require reason for moderation and private access/mutation; private intervention must not publish maps.
5. MUST implement `delete_account.php` with password + confirm phrase; hard-delete user, maps, elements, photos files, tokens, sessions; free username/email for re-registration without restoring data.
6. MUST build admin UI under `/admin/*` and Profile deletion flow warning about unsynced local work; wipe offlineStore on successful deletion.
7. MUST implement and pass every assigned test case in `## Tests`.
</requirements>

## Subtasks
- [x] 6.1 Implement admin users list/search and user_status with audit + notification
- [x] 6.2 Implement moderate_map with reason, public hide, owner-visible moderation_reason
- [x] 6.3 Implement private_access / private_mutate with mandatory reason and before/after audit
- [x] 6.4 Implement audit list/search (append-only guarantee)
- [x] 6.5 Implement delete_account hard delete cascades + session wipe + identity free
- [x] 6.6 Build admin UI pages (users, moderation/intervention, audit) with role gates
- [x] 6.7 Extend Profile deletion UX + client OfflineStore/auth wipe; wire api.admin and deleteAccount
- [x] 6.8 Implement assigned UT/IT/E2E cases for US-015–US-018 plus IT-095/IT-096

## Implementation Details
Follow TechSpec Admin API and delete_account, ADR-004, ADR-005, ADR-011. Depends on auth (task_02), maps/photos (task_03), sync/offline clear (task_04), and public visibility fields (task_05). Field users must never self-elevate; first admin comes from seed CLI (task_01).

### Relevant Files
- `src/lib/AuthContext.jsx` — role on user; post-delete logout
- `src/lib/PageNotFound.jsx` — existing admin role check pattern
- `src/api/apiClient.js` — add admin + deleteAccount
- `src/page/DashBoard.jsx` — admin nav entry
- `src/page/Profile.jsx` — deletion section (from task_02)
- `src/lib/offline/OfflineStore.js` — wipe on delete (from task_04)
- `php/bin/seed_admin.php` — first admin prerequisite
- `.compozy/tasks/login-and-postgis/_techspec.md` — admin + deletion
- `.compozy/tasks/login-and-postgis/adrs/adr-004.md`, `adr-005.md`, `adr-011.md`

### Dependent Files
- `php/admin/users.php`, `user_status.php`, `moderate_map.php`, `private_access.php`, `private_mutate.php`, `audit.php` — create
- `php/auth/delete_account.php` — create
- `src/page/AdminUsers.jsx`, `AdminAudit.jsx`, `AdminMapIntervention.jsx` — create
- `src/App.jsx`, `src/api/apiClient.js`, `src/lib/AuthContext.jsx`, `src/page/Profile.jsx` — modify
- `tests/php/AdminApiTest.php`, `DeleteAccountTest.php` — create

### Related ADRs
- [ADR-004: Administrative Access with Auditing and Owner Notification](adrs/adr-004.md) — privileged actions, audit, notify
- [ADR-005: Durable Geospatial Records and Complete Account Deletion](adrs/adr-005.md) — complete erasure
- [ADR-011: Admin Bootstrap Seed and Identity Reuse After Deletion](adrs/adr-011.md) — free identifiers after hard delete

## Deliverables
- Admin APIs and UI for status, moderation, private intervention, audit search
- Immutable audit trail + owner notifications
- Permanent account deletion with cascades, public 404, and empty re-registration
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-129, UT-130, UT-131, UT-132, UT-133, UT-134, UT-135, UT-136, UT-137 — admin account search/status transitions, audit, notifications, idempotency
- [x] UT-138, UT-139, UT-140, UT-141, UT-142, UT-143, UT-144 — moderation reason, public hide, owner visibility, idempotency
- [x] UT-145, UT-146, UT-147, UT-148, UT-149, UT-150, UT-151, UT-152 — private access/mutate audit before/after, immutable audit, notification ordering
- [x] UT-153, UT-154, UT-155, UT-156, UT-157, UT-158, UT-159, UT-160 — delete_account confirmation, cascades, identity reuse, mid-flow cancel
- [x] IT-068, IT-069, IT-070, IT-071, IT-072 — admin directory scale, field-user deny, concurrent status flips, pending activate rules
- [x] IT-073, IT-074, IT-075, IT-076, IT-077, IT-078 — moderation authz, races with unpublish, cache recheck, audit search scale
- [x] IT-079, IT-080, IT-081, IT-082, IT-083, IT-084 — private intervene authz, owner/admin conflicts, retry delete audited, no restore
- [x] IT-085, IT-086, IT-087, IT-088, IT-089, IT-090 — deletion scale, cross-user deny, races, disconnect, deactivated path, prompt revoke
- [x] IT-095, IT-096 — private_mutate and delete_account contract checklist
- [x] E2E-015, E2E-016, E2E-017, E2E-018 — deactivate/activate, moderate, private intervene, permanent delete journeys

## Success Criteria
- Every assigned test case implemented and passing
- Field/anonymous actors never obtain admin data or mutate via admin routes
- Audit entries cannot be altered through ordinary product APIs
- After deletion, login fails, former public_id 404s, and re-registration yields an empty workspace
