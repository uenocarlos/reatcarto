---
provider: manual
pr:
round: 1
round_created_at: 2026-08-02T17:04:39Z
status: resolved
file: php/lib/Maps/MapService.php
line: 38
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: export_settings server validation is object-check only

## Review Comment

`validate_export_settings_payload` only rejects non-arrays:

```php
if (!is_array($settings)) {
    auth_fail(...);
}
return $settings;
```

In PHP, JSON arrays and objects both decode to `array`, so a list payload (`["x"]`) is accepted and stored. There is also no max depth/size clamp on `hiddenCategoryIds` / `hiddenElementIds` or overall JSON size, despite TechSpec noting risk of oversized `export_settings` payloads. Client `normalizeExportSettings` repairs shape on read, but the DB can hold arbitrary owner-written JSON via the settings-only LWW path.

Suggested fix: reject non-associative arrays (`array_is_list`), optionally run a server-side normalize/clamp mirroring the JS contract, and enforce a max encoded byte length before `UPDATE`.

## Triage

- Decision: `valid`
- Root cause: `validate_export_settings_payload` only checks `is_array()`, so JSON list payloads (`["x"]`) pass validation because PHP decodes both JSON objects and arrays as PHP arrays. There is no server-side normalization/clamping and no encoded-size guard before persisting to JSONB.
- Fix approach: reject list arrays with `array_is_list`, normalize/clamp fields to mirror `normalizeExportSettings` in `exportSettings.js`, cap `hiddenCategoryIds` / `hiddenElementIds` length to `ELEMENTS_PER_MAP`, and reject payloads whose normalized JSON exceeds `MAX_EXPORT_SETTINGS_BYTES` before `UPDATE`.
