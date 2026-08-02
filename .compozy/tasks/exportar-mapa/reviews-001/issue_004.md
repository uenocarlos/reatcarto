---
provider: manual
pr:
round: 1
round_created_at: 2026-08-02T17:04:39Z
status: resolved
file: src/lib/export/pngExporter.js
line: 213
severity: high
author: claude-code
provider_ref:
---

# Issue 004: Export filename allows path segments on native write

## Review Comment

The PNG file name is derived from user-controlled title / `fileBaseName` with only a `.png` suffix check:

```js
const safeBase = (fileBaseName || normalized.title || 'mapa').trim() || 'mapa';
const fileName = safeBase.endsWith('.png') ? safeBase : `${safeBase}.png`;
```

That string is passed to Capacitor `Filesystem.writeFile({ path: fileName, directory: Directory.Cache })`. Titles such as `../../evil`, `subdir/mapa`, or names with `\` can escape the intended cache file identity depending on platform path handling.

Suggested fix: sanitize to a single path segment — strip `/`, `\`, null bytes, and `..`; replace remaining unsafe characters; clamp length; then append `.png`. Apply the same safe name for the web `download` attribute for consistency.

## Triage

- Decision: `valid`
- Root cause: `exportCompositionPng` passed user-controlled `fileBaseName` / `title` directly to `Filesystem.writeFile({ path })` and the web `download` attribute with only trim and `.png` suffix handling — no path-segment sanitization.
- Fix: Added exported `sanitizePngFileName()` that extracts a single safe segment (strips `/`, `\`, `.`, `..`, null bytes), replaces unsafe filesystem characters, clamps length, and normalizes the `.png` suffix. Applied in `exportCompositionPng` for both native and web delivery paths.
- Verification: `npm run lint`, `npm run typecheck`, `npm test` (356 passed), `npm run build` — all exit 0.
