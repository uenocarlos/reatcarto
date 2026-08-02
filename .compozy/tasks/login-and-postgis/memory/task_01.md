# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Delivered foundation: env config, bootstrap, PostGIS migrations, migrate/seed CLIs, `.env.example`, Vite proxy, Composer/PHPUnit + Vitest harness, UT-168–170.

## Important Decisions

- Split migration/seed logic into `php/lib/MigrationRunner.php` and `php/lib/AdminSeeder.php` for CLI + PHPUnit reuse.
- Test bootstrap uses `build_app_config()` after forcing `DB_NAME=reatcarto_test`; resets schema with `DROP SCHEMA public CASCADE` per test class.

## Learnings

- Windows PowerShell requires `;` instead of `&&` for chained commands.
- PHPUnit pre-set empty env vars block `.env` loading in `load_env_file()` (getenv !== false).

## Files / Surfaces

- Created: `php/config.php`, `php/bootstrap.php`, `php/lib/*`, `php/migrations/001-004.sql`, `php/bin/migrate.php`, `php/bin/seed_admin.php`, `.env.example`, `.gitignore`, `composer.json`, `phpunit.xml`, `tests/php/**`, `tests/js/harness.test.js`, `vitest.config.js`, `uploads/.gitkeep`
- Modified: `package.json`, `vite.config.js`

## Errors / Corrections

- Fixed double `require` of `config.php` in test bootstrap (function redeclare) via `build_app_config()`.
- Fixed PHPUnit auth failure by removing empty `DB_PASSWORD` from phpunit.xml.

## Ready for Next Run

- task_01 complete; no blockers for task_02 auth API work.
