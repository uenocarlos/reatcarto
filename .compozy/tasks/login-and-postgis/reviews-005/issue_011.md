---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: php/lib/Photos/PhotoService.php
line: 347
severity: medium
author: claude-code
provider_ref:
---

# Issue 011: Private photo GET leaks existence via 403 vs 404

## Review Comment

`photos_serve_bytes` for the private path distinguishes:

- photo missing → `404 not_found`
- photo exists but `!photo_can_read` → `403 forbidden`

`photos_serve_public` intentionally collapses both to 404. Private `photos/get.php` therefore lets anonymous or foreign authenticated callers **enumerate photo UUIDs**. Knowing a private map exists is weaker than photo existence, but UUID validation probing still reveals private asset inventory.

**Suggested fix:** For unauthorized readers, return the same 404 envelope as public serve (`not_found` / “Photo not found.”). Keep 403 only if product policy wants authenticated owners of other resources to see “access denied” — prefer uniform not-found for non-owners and anonymous.

## Triage

- Decision: `UNREVIEWED`
- Notes:
