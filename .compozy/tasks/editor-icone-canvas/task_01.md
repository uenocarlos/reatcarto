---
status: completed
title: "Backend user_icons API and public icon serve"
type: backend
complexity: high
---

# Task 1: Backend user_icons API and public icon serve

## Overview
Delivers the account-scoped `user_icons` persistence layer and `/php/icons/*` HTTP surface (plus public serve) that the StylePanel library and canvas confirm flow depend on. Soft-hide keeps bytes available for points that already reference an icon after catalog removal.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST add migration `user_icons` per TechSpec Data Models (`user_id`, `name`, `storage_key`, `content_type` PNG-only, `byte_size`, `library_hidden_at`, timestamps) with owner cascade.
2. MUST add `MAX_ICON_BYTES` (200 KiB) and `MAX_ICON_NAME_LENGTH` (100) to `Limits.php`.
3. MUST implement `IconService` mirroring photos patterns: list (non-hidden only), upload multipart PNG, soft-remove, authenticated GET with ACL, public GET when publicly referenced.
4. MUST expose endpoints `list.php`, `upload.php`, `get.php`, `remove.php` under `/php/icons/` and `/php/public/icon.php`.
5. MUST enforce owner-only list/upload/remove via `require_active_user`; GET allows owner or authenticated reader of a referencing element; public endpoint only when a publicly visible element references the icon.
6. MUST apply name fallback `"Ícone"` for blank/whitespace names; support optional `client_mutation_id` idempotency on upload.
7. MUST rewrite `style.custom_icon_url` from `/php/icons/get.php?id=` to `/php/public/icon.php?id=` inside public element formatting.
8. MUST NOT hard-delete files on soft-remove; GET MUST still serve owner (and eligible public/ref) after hide.
9. MUST implement and pass every assigned test case in the Tests section.
</requirements>

## Subtasks
- [x] 1.1 Author and apply `008_user_icons.sql` (or next free migration number) for `user_icons`
- [x] 1.2 Add icon limit constants and wire `IconService` into bootstrap requires
- [x] 1.3 Implement upload + list with validation, fallback name, and idempotent `client_mutation_id`
- [x] 1.4 Implement soft-remove and authenticated GET with reference ACL
- [x] 1.5 Implement public icon serve gated on public element reference
- [x] 1.6 Rewrite icon URLs in `format_public_element_record` (or equivalent public serializer)
- [x] 1.7 Implement assigned integration cases (IT-001 through IT-020) against local PHP/PostGIS

## Implementation Details
Follow TechSpec **Data Models**, **API Endpoints**, ADR-006, and ADR-008. Mirror `php/lib/Photos/PhotoService.php` and `php/photos/*` for CORS, auth helpers, storage under `uploads/`, and error codes. Do not build UI or Fabric in this task.

### Relevant Files
- `php/lib/Photos/PhotoService.php` — upload/serve/ACL template
- `php/photos/upload.php`, `get.php`, `delete.php` — endpoint bootstrap pattern
- `php/public/photo.php` — public serve pattern
- `php/lib/Limits.php` — add icon constants
- `php/lib/Elements/ElementService.php` — `format_public_element_record` URL rewrite
- `php/bootstrap.php` — require new service
- `php/migrations/` — next `NNN_user_icons.sql`
- `.compozy/tasks/editor-icone-canvas/_techspec.md` — canonical contracts

### Dependent Files
- `php/lib/Icons/IconService.php` — create
- `php/icons/list.php`, `upload.php`, `get.php`, `remove.php` — create
- `php/public/icon.php` — create
- `php/migrations/008_user_icons.sql` (or next number) — create
- `tests/php/` or HTTP IT harness scripts — create/extend as needed for IT IDs

### Related ADRs
- [ADR-002: Per-User Icon Library](adrs/adr-002.md) — product library rules
- [ADR-006: user_icons API + soft-remove](adrs/adr-006.md) — persistence design
- [ADR-008: Icon GET ACL + public endpoint](adrs/adr-008.md) — authorization

## Deliverables
- Migrated `user_icons` table and working icon HTTP API
- Public icon URL rewrite on public elements
- Soft-remove without breaking referenced GETs
- Every test case assigned in the Tests section implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] IT-001, IT-002, IT-003, IT-004, IT-005 — upload success, size reject, storage failure, unauthenticated, idempotent mutation id
- [x] IT-006, IT-007, IT-008, IT-009, IT-010, IT-011 — isolation, name rules, duplicates, element style persist, large list
- [x] IT-012, IT-013, IT-014, IT-015 — soft-remove, refresh omit, forbidden remove, idempotent remove
- [x] IT-016, IT-017, IT-018, IT-019, IT-020 — GET ACL owner/deny/ref and public allow/deny

## Success Criteria
- Every assigned test case implemented and passing
- Owner can upload ≤200KB PNG and list it; other users cannot list it
- Soft-removed icons disappear from list but remain fetchable when authorized
- Public maps referencing an icon can load bytes via `/php/public/icon.php`

## Follow-up notes
- Conflict resolution: names longer than 100 chars are rejected with `validation_error` (IT-008 allows reject or truncate).
- Auto-commit was not enabled by the caller; leave diff for manual commit.
- Test bootstrap gained `email_verification_required()` (required by AuthTestCase) and `ElementCategoryService` require.
