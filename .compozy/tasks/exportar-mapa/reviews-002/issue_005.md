---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T17:26:20Z
status: resolved
file: src/lib/export/exportSettings.js
line: 152
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Location colors persist without hex validation

## Review Comment

US-011.EC-1 / UT-108 require invalid location colors to fall back to defaults. Hex clamping exists only in `normalizeLocationColor` / `normalizeLocationSettings` (`locationPreview.js`), which the live preview uses.

Persist/normalize paths keep arbitrary strings:

- JS `normalizeExportSettings`: `stateColor` / `municipalityColor` via `asString(...)` with no hex check.
- PHP `normalize_export_settings` in `php/lib/Maps/MapService.php`: same — any string is stored.

Invalid values therefore round-trip through JSONB/IndexedDB and reappear in form controls on reopen, while only the preview silently corrects them. Preview and persisted settings diverge.

Suggested fix: apply the same `#RRGGBB` clamp (or default) inside `normalizeExportSettings` and PHP `normalize_export_settings` so gates, forms, preview, and DB share one contract. Reuse or share the regex already in `locationPreview.js`.

## Triage

- Decision: `valid`
- Root cause: `normalizeExportSettings` accepted any string for `stateColor` / `municipalityColor` via `asString(...)`, while hex clamping existed only in `normalizeLocationColor` (`locationPreview.js`) used by preview paths. Invalid values therefore persisted through IndexedDB/API round-trips and reappeared in form controls.
- Fix: Added `normalizeHexColor` with the same `#RRGGBB` regex contract as `locationPreview.js` and applied it inside `normalizeExportSettings` so persist, gates, forms, and preview share normalized colors on the JS path.
- Out of batch scope: PHP `normalize_export_settings` in `MapService.php` still accepts arbitrary strings; server-side parity should be tracked separately if required.
- Verification: `npm run lint`, `npm run typecheck`, `npm run test` (including new UT-108 cases in `exportSettings.test.js`).
