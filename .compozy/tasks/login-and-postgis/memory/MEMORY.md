# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- task_01–task_06 completed for login-and-postgis workflow (auth → maps → offline/sync → public → admin/delete).
- Dev DB name default `reatcarto`; PHPUnit uses disposable `reatcarto_test` (schema reset via DROP SCHEMA per test class).
- Workspace currently has no `.git` directory (local commit tooling unavailable).

## Shared Decisions

- Env keys: `DB_*`, `SMTP_*`, `MAIL_FROM`, `TERMS_VERSION`, `PRIVACY_VERSION`, `UPLOADS_ROOT`, `SESSION_*`, `ADMIN_*`.
- Migrations tracked in `schema_migrations`; files under `php/migrations/*.sql` applied in lexical order inside transactions.
- Vite dev proxy `/php` → `http://localhost:8080` (PHP built-in server expected in later tasks).

## Shared Learnings

- PHPUnit `<env>` entries override `.env`; omit empty `DB_PASSWORD` in phpunit.xml so local `.env` credentials apply.
- `build_app_config()` in `php/config.php` allows tests to reload config after overriding env vars.

## Open Risks

- Vite `/php` proxy target port must match however PHP is served locally (8080 assumed; not validated in this task).
- `reatcarto_test` database must exist before PHPUnit runs (created manually once on this machine).

## Handoffs

- task_06 completed: admin APIs (`users`, `user_status`, `moderate_map`, `private_access`, `private_mutate`, `audit`), delete_account hard erase + identity free, `/admin/*` UI, Profile wipe via `clearOfflineAccount`.
- Activate-without-verified-email is rejected; private intervene never sets `is_published`.
