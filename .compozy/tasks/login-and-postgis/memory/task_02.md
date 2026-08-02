# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Delivered auth vertical slice: 12 PHP endpoints under `php/auth/`, SMTP mailer, session registry, client auth API/UI, map/element guard stubs, 79 assigned test IDs covered via PHPUnit + Vitest.

## Important Decisions

- Auth business logic throws `AuthException`; endpoints wrap with `auth_handle_endpoint*` for JSON envelope (testability).
- Deactivated accounts return `account_deactivated` (403) on next request while PHP session cookie may still exist; global session registry revoke deferred until explicit logout/password events per IT-013.
- Used verification token replay returns idempotent success when account already active (IT-008/UT-019).
- Migration `005_auth_rate_limits.sql` added for IP+action rate buckets.

## Learnings

- PHPUnit bootstrap must not `require` full `php/bootstrap.php` (function redeclare); mirror task_01 partial bootstrap pattern.
- Clear `auth_rate_limits` in test setUp when exercising registration rate tests.

## Files / Surfaces

- PHP: `php/lib/Auth/*`, `php/mail/Mailer.php`, `php/auth/*.php`, `php/maps/create.php`, `php/elements/create.php`, `php/migrations/005_auth_rate_limits.sql`
- Client: `src/api/http.js`, `src/api/apiClient.js`, `src/lib/AuthContext.jsx`, `src/components/ProtectedRoute.jsx`, `src/App.jsx`, auth pages under `src/page/`
- Tests: `tests/php/Auth/*.php`, `tests/php/AuthTestCase.php`, `tests/js/auth.test.js`

## Errors / Corrections

- Fixed SessionService order: check deactivated status before registry invalidation messaging.
- Fixed test bootstrap and AuthTestCase autoload path.

## Ready for Next Run

- task_02 complete. task_03 can wire `api.entities.*` to real maps/elements HTTP; legacy `php/login.php` unused by client.
