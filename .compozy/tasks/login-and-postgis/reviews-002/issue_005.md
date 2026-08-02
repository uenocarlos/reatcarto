---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T19:07:59Z
status: resolved
file: php/mail/Mailer.php
line: 108
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Localhost Mailer does not speak SMTP protocol

## Review Comment

For `SMTP_HOST` of `localhost` / `127.0.0.1`, `Mailer::send` opens a TCP socket and writes a raw RFC822 payload, then closes — without SMTP greetings, `EHLO`, `MAIL FROM`, `RCPT TO`, or `DATA`. Mailpit, Mailhog, and real SMTP daemons expect a proper SMTP dialogue; this path typically fails to deliver while still returning `true` after `fwrite`.

Verification, password-reset, email-change, and admin-notification mails are required for US-001–US-005 and admin accountability. Callers already treat send failures as non-fatal for enumeration safety, so a broken transport leaves users with pending accounts and no usable link, with little signal beyond optional `error_log` lines.

Suggested fix: use a minimal SMTP client (or a small library) that performs a correct handshake for local Mailpit and authenticated remote SMTP; surface/metrics when send fails after registration/resend; keep generic user-facing responses where required.

## Triage

- Decision: `valid`
- Root cause: For `SMTP_HOST` of `localhost` / `127.0.0.1`, the original `Mailer::send` path opened a TCP socket and wrote a raw RFC822 payload without SMTP greeting, `EHLO`, `MAIL FROM`, `RCPT TO`, or `DATA`. Mailpit/Mailhog and real SMTP daemons reject that sequence, so delivery failed silently while `fwrite` still returned success.
- Fix approach: Replace the raw-write path with a minimal in-process SMTP client that performs the full handshake, optional `AUTH LOGIN`, dot-stuffing, and propagates server rejection codes as `false` return values with `error_log` diagnostics.
- Resolution: `Mailer::sendViaSmtp` now drives the complete SMTP dialogue (`220` greeting, `EHLO`/`HELO`, optional auth, `MAIL FROM`, `RCPT TO`, `DATA`, terminating `.`, `QUIT`). Regression coverage lives in `tests/php/Mail/MailerTest.php` against `tests/php/Mail/fake_smtp_server.php`, asserting handshake commands, auth when credentials are set, and `false` on connection failure or sender rejection. Verified with `vendor\bin\phpunit tests\php\Mail\MailerTest.php` (4/4) and full suite `vendor\bin\phpunit` (269/269, exit 0).
