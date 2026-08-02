# Task Memory: task_06.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Deliver admin APIs/UI (users, status, moderate, private intervene, audit) + hard delete_account with cascades and identity reuse.

## Important Decisions

- Activate requires verified email (UT-131 / IT-071); rejects unverified over US-015 EC-8 prose that suggested activate-before-verify with map editing still blocked.
- Deactivated self-delete blocked via `require_active_user` / session guards; recovery is admin activate or password-reset rules (IT-089).
- Audit JSON truncation at 32KB preserves id fields (`_truncated`).
- Confirm phrase constant: `DELETE MY ACCOUNT`.

## Learnings

- PDO `query()` cannot bind named params; use prepare/execute (IT-090 assertion fix).
- Workspace has no `.git`; auto-commit skipped.

## Files / Surfaces

- `php/lib/Admin/*`, `php/admin/*`, `php/auth/delete_account.php`
- `src/page/Admin*.jsx`, `Profile.jsx`, `apiClient.js` admin + deleteAccount
- `tests/php/Admin/AdminApiTest.php`, `DeleteAccountTest.php`, `tests/js/admin.test.js`

## Errors / Corrections

- Fixed IT-090 sessions_registry count query (prepare/bind).
- Hardened `require_admin` to check DB role; `admin_list_audit` takes real admin actor.
- Cleared unused imports so `eslint --quiet` passes; scoped `jsconfig.json` so typecheck exits 0 without pulling Leaflet.

## Ready for Next Run

- Feature complete; no further PRD tasks in this workflow graph after task_06.
