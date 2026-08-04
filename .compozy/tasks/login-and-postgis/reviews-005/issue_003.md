---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: php/lib/Auth/AuthService.php
line: 546
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Password-gated auth actions lack rate limits

## Review Comment

`auth_login`, `auth_register`, resend verification, and profile updates call `enforce_rate_limit`, but sensitive authenticated endpoints do not:

- `auth_change_password` (~546–581) — unlimited `password_verify` on current password
- `auth_delete_account` (~594–620) — unlimited verify before irreversible hard delete
- `auth_change_email` (~513–541) — unlimited verification mail to arbitrary addresses

A stolen session cookie (before revocation) enables offline password guessing against the current password and spam of change-email mail. Hard delete is especially sensitive: brute-force thrashing of password verification is not throttled.

**Suggested fix:** Before `password_verify` / mail send, enforce buckets such as:

```php
enforce_rate_limit(rate_limit_bucket('change_password', request_client_ip(), (string) $user['id']));
enforce_rate_limit(rate_limit_bucket('delete_account', request_client_ip(), (string) $user['id']));
enforce_rate_limit(rate_limit_bucket('change_email', request_client_ip(), (string) $user['id']));
```

Use low thresholds (e.g. 5–10 / 15 min) consistent with login limits.

## Triage

- Decision: `UNREVIEWED`
- Notes:
