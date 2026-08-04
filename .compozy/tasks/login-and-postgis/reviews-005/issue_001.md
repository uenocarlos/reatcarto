---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: php/lib/Auth/AuthService.php
line: 409
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Password reset token consume is not atomic

## Review Comment

`auth_password_reset` checks `is_token_used()` outside the transaction, then updates the password and calls `mark_token_used()` which only does `UPDATE ... SET used_at = NOW() WHERE id = :id` with no `used_at IS NULL` guard (`TokenService.php` ~107–111).

Two concurrent requests with the same valid reset token can both pass the used-check, both set different password hashes, and both succeed. That violates single-use recovery tokens (PRD recovery links and UT/IT concurrency around reset).

**Suggested fix:** Inside the transaction, atomically claim the token first:

```sql
UPDATE password_reset_tokens
SET used_at = NOW()
WHERE id = :id AND used_at IS NULL
```

If zero rows are affected, abort with “token already used”. Then update `password_hash`. Apply the same pattern to `auth_verify_email` / email-change paths (~219–242), which share `mark_token_used`.

## Triage

- Decision: `UNREVIEWED`
- Notes:
