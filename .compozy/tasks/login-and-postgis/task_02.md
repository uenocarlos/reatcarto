---
status: completed
title: "Auth API, mailer, and client session UI"
type: backend
complexity: high
---

# Task 2: Auth API, mailer, and client session UI

## Overview
Delivers verified professional registration through profile/credential maintenance as a full vertical slice: modular PHP auth endpoints, SMTP mailer, cookie sessions with registry, and React client gates/pages. Removes the App authentication bypass so private routes require a real session.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
1. MUST implement all TechSpec auth endpoints under `php/auth/` (register through change_password; exclude hard delete — that is task_06) using bootstrap session cookies and `sessions_registry`.
2. MUST hash passwords with `password_hash` / `password_verify`; store consent versions/time; enforce uniqueness, rate limits, and generic responses that avoid account enumeration.
3. MUST send verification and recovery mail via `php/mail/` using SMTP env; tokens single-use with 24h TTL.
4. MUST expose full `api.auth.*` (except `deleteAccount`) over `fetch` with `credentials: 'include'` and the standard error envelope.
5. MUST wire AuthContext + ProtectedRoute (align `checkUserAuth`/`checkAppState`), remove `isAuthenticated = true` bypass in `App.jsx`, and add Register/Verify/Recovery/Profile routes and forms.
6. MUST block pending/deactivated accounts from map mutation with `account_pending` / `account_deactivated` codes; dual-identifier login (email|username).
7. MUST revoke sessions globally on password reset/change per ADR-007.
8. MUST implement and pass every assigned test case in `## Tests`.
</requirements>

## Subtasks
- [x] 2.1 Implement register, verify, resend_verification with consent versions and mailer
- [x] 2.2 Implement login, logout, me with sessions_registry and account-state responses
- [x] 2.3 Implement password_forgot / password_reset with generic success and global revoke
- [x] 2.4 Implement profile, change_username, change_email, change_password
- [x] 2.5 Replace apiClient auth mocks with real HTTP + error mapping
- [x] 2.6 Fix AuthContext and ProtectedRoute; remove App bypass; preserve return-to deep links
- [x] 2.7 Build Register, Verify, Forgot/Reset, and Profile/Settings UI with a11y form states
- [x] 2.8 Implement assigned UT/IT/E2E cases for US-001–US-005 plus shared auth/mailer cases

## Implementation Details
Follow TechSpec **Auth & account** endpoints, Core Interfaces `User`/`api.auth`, ADR-001, ADR-006, ADR-007. Legacy `php/login.php` must not remain the client entry — new modular paths under `php/auth/`. Profile UI may omit permanent deletion controls until task_06 wires `deleteAccount`.

### Relevant Files
- `src/App.jsx` — remove auth bypass; add protected/public auth routes
- `src/lib/AuthContext.jsx` — full session API surface
- `src/components/ProtectedRoute.jsx` — align with AuthContext
- `src/page/Login.jsx` — extend with register/recovery links
- `src/api/apiClient.js` — replace localStorage auth mock
- `src/lib/query-client.js` — QueryClient already provided
- `php/login.php` — legacy reference only
- `.compozy/tasks/login-and-postgis/_techspec.md` — auth contract
- `.compozy/tasks/login-and-postgis/adrs/adr-001.md`, `adr-007.md`

### Dependent Files
- `php/auth/register.php`, `verify.php`, `resend_verification.php`, `login.php`, `logout.php`, `me.php` — create
- `php/auth/password_forgot.php`, `password_reset.php`, `profile.php`, `change_username.php`, `change_email.php`, `change_password.php` — create
- `php/mail/` — create SMTP mailer
- `src/page/Register.jsx`, `VerifyEmail.jsx`, `PasswordForgot.jsx`, `PasswordReset.jsx`, `Profile.jsx` — create
- `src/api/apiClient.js`, `src/lib/AuthContext.jsx`, `src/components/ProtectedRoute.jsx`, `src/App.jsx` — modify

### Related ADRs
- [ADR-001: Open Account Registration and Verified Identity](adrs/adr-001.md) — registration, verify, dual login, recovery
- [ADR-006: Evolve Procedural PHP as Authoritative Backend](adrs/adr-006.md) — modular PHP endpoints
- [ADR-007: Cookie-Based PHP Sessions and Multi-Device Policy](adrs/adr-007.md) — cookies, multi-session, global revoke

## Deliverables
- Auth API + mailer operational with rate limits and safe error envelopes
- Client session hydrate, login/register/verify/recovery/profile flows
- App no longer bypasses authentication
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-001, UT-002, UT-003, UT-004, UT-005, UT-006, UT-007, UT-008, UT-009, UT-010, UT-011, UT-012 — registration validation, consent, pending map block, client guards
- [x] UT-013, UT-014, UT-015, UT-016, UT-017, UT-018, UT-019, UT-020 — email verification, resend, token expiry/replay, delivery UI
- [x] UT-021, UT-022, UT-023, UT-024, UT-025, UT-026, UT-027, UT-028, UT-029, UT-030, UT-031 — dual-identifier login, generic failures, pending/deactivated, rate limits
- [x] UT-032, UT-033, UT-034, UT-035, UT-036, UT-037, UT-038 — password forgot/reset enumeration-safe flows
- [x] UT-039, UT-040, UT-041, UT-042, UT-043, UT-044, UT-045, UT-046 — profile, username, pending email, password change + session revoke
- [x] UT-161 — PHP auth guard returns 401 on unauthenticated mutator
- [x] UT-172 — mailer sends verification with single-use token URL
- [x] IT-001, IT-002, IT-003, IT-004, IT-005 — registration concurrency, idempotency, identity reuse after delete fixture, scale
- [x] IT-006, IT-007, IT-008, IT-009, IT-010 — verification cross-session, races, ordering with login/deactivate
- [x] IT-011, IT-012, IT-013, IT-014 — multi-device sessions, deep-link return, mid-session deactivation, session isolation
- [x] IT-015, IT-016, IT-017, IT-018, IT-019, IT-020 — reset token isolation, races, pending/deactivated rules, abuse
- [x] IT-021, IT-022, IT-023, IT-024, IT-025, IT-026 — profile authorization, concurrency, email-change token ordering, uniqueness at scale
- [x] IT-091, IT-092 — register/login endpoint contract checklist
- [x] E2E-001, E2E-002, E2E-003, E2E-004, E2E-005 — register → verify → login → recovery → profile journeys

## Success Criteria
- Every assigned test case implemented and passing
- Verified active user can obtain session via email or username; pending cannot create maps
- Recovery and verification links are single-use and enumeration-safe
- Protected client routes redirect unauthenticated users and restore deep links after login
