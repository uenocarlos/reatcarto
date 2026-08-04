---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: tests
line: 0
severity: high
author: claude-code
provider_ref:
---

# Issue 012: Entire assigned test suite is missing from the tree

## Review Comment

All login-and-postgis tasks are marked `completed` with every `## Tests` ID checked, and `_tests.md` defines a full UT/IT/E2E contract (Vitest + PHPUnit). In the current workspace the **`tests/` directory does not exist** — PHP and JS suites previously present (per task memory and git deletions of `tests/js/*`, `tests/php/*`) are gone.

Without that harness:

- Claims of UT/IT parity cannot be re-run (`npm test` / PHPUnit have no sources)
- Prior review rounds that closed “missing test ID” issues cannot be re-validated
- Regressions in auth, sync OCC, and admin audit can ship undetected

**Suggested fix:** Restore the Vitest + PHPUnit suite under `tests/` so every ID assigned in task_01–task_06 is implemented and green, or add the harness as a hard CI gate before marking the feature merge-ready. If deletion was intentional, tasks and `_tasks.md` checkboxes must not claim the tests exist.

## Triage

- Decision: `UNREVIEWED`
- Notes:
