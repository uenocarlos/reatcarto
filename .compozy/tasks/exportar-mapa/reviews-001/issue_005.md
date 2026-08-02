---
provider: manual
pr:
round: 1
round_created_at: 2026-08-02T17:04:39Z
status: resolved
file: src/lib/export/exportSettings.js
line: 217
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Gates accept HTML-only title/author as non-blank

## Review Comment

`validateExportGates` treats title/author as filled when `trim()` is non-empty, but the composition UI renders via `sanitizeExportText` (strips tags). Values like `"<b></b>"` or `"<script></script>"` pass the gate and unlock Export, yet `buildHeaderTitle` / footer metadata become empty after sanitize — producing an attributed export that visually lacks required title/author (US-003 / US-017).

Suggested fix: run the same sanitize (or require non-empty after sanitize) inside `validateExportGates`, and ideally normalize persisted metadata through `sanitizeExportText` so preview, gates, and PNG stay aligned.

Also consider applying sanitize in `exportController.attemptExport` before capture so frozen settings match what is shown.

## Triage

- Decision: `valid`
- Root cause: `validateExportGates` used `trim()` via `isBlank`, while preview/PNG render metadata through `sanitizeExportText` (strips HTML tags). Values like `"<b></b>"` passed gates but rendered empty.
- Fix: import `sanitizeExportText` in `exportSettings.js`; apply it in `normalizeExportSettings` for `title`, `author`, and `technicalResponsible` so persisted settings, gates, preview, and export share the same plain-text values; update `isBlank` to use `sanitizeExportText` so gate checks match rendered output. No `exportController` change needed — it already calls `normalizeExportSettings` before `validateExportGates`.
- Verification: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (see batch verification report).
