---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T18:01:05Z
status: resolved
file: php/lib/Maps/MapService.php
line: 208
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: Server persists non-hex location colors unchanged

## Review Comment

Client `normalizeExportSettings` enforces `#RRGGBB` for `stateColor` / `municipalityColor` (UT-108), but PHP `normalize_export_settings` accepts any string:

```php
'stateColor' => is_string($raw['stateColor'] ?? null) ? $raw['stateColor'] : $defaults['stateColor'],
'municipalityColor' => is_string($raw['municipalityColor'] ?? null) ? $raw['municipalityColor'] : $defaults['municipalityColor'],
```

Crafted API payloads can store CSS-significant values that round-trip through JSONB. The editor re-normalizes on hydrate (mitigation), but persisted dirty values remain a server-boundary gap vs the client contract and can affect any consumer that trusts stored settings without re-normalizing.

Suggested fix: apply the same hex validation/fallback as the JS helper inside `normalize_export_settings`, and cover it in `ExportSettingsTest.php`.

## Triage

- Decision: `valid`
- Root cause: `normalize_export_settings` accepted any string for `stateColor` / `municipalityColor`, while the client contract (UT-108) requires `#RRGGBB` hex or fallback to defaults.
- Fix: Added `normalize_export_hex_color` mirroring JS `normalizeHexColor` (`/^#([0-9A-Fa-f]{6})$/` with trim) and applied it in `normalize_export_settings`. Added UT-108 parity tests in `ExportSettingsTest.php`.

## Resolution

- `normalize_export_hex_color` (lines 169–180) validates `#RRGGBB` hex or returns the default fallback; `normalize_export_settings` applies it to `stateColor` and `municipalityColor` (lines 221–222).
- UT-108 parity covered in `ExportSettingsTest.php`: `testUt108InvalidLocationColorsFallBackToDefaultsOnSave`, `testUt108ValidHexLocationColorsPersistOnSave`, `testUt108InvalidLocationColorsDoNotRoundTripOnReSave`.
- Verification: `npm run lint`, `npm run typecheck`, `npm run test` (387 passed), `npm run build`, `composer test` (255 passed) — all exit 0.
