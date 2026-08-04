---
provider: manual
pr:
round: 5
round_created_at: 2026-08-03T14:15:33Z
status: pending
file: php/lib/Photos/PhotoService.php
line: 78
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Admins cannot load private photo bytes

## Review Comment

`admin_private_access` returns elements with nested photos whose `url` points at `/php/photos/get.php?id=…` (`photos_for_element`). But `photo_can_read()` only allows the map owner or a publicly eligible map — there is no admin branch:

```php
function photo_can_read(?array $user, array $photo): bool
{
    if ($user !== null && (string) $photo['owner_id'] === (string) $user['id']) {
        return true;
    }
    return map_is_public_eligible($photo);
}
```

An authenticated admin performing audited private intervention receives photo metadata and URLs, then gets **403** when fetching bytes. That breaks US-017 (admin may view private maps/elements/supporting media for support) despite audit on map open.

**Suggested fix:** Either allow `$user['role'] === 'admin'` in `photo_can_read` (prefer after `require_admin` on a dedicated admin GET), or serve bytes via `admin/photo.php` that re-validates admin session, logs access reason, and reuses `photos_serve_bytes` without treating admin as owner.

## Triage

- Decision: `UNREVIEWED`
- Notes:
