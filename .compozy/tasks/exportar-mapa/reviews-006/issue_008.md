---
provider: manual
pr:
round: 6
round_created_at: 2026-08-02T19:17:05Z
status: pending
file: src/lib/export/pngExporter.js
line: 199
severity: low
author: claude-code
provider_ref:
---

# Issue 008: Native share leaves PNG in Cache directory

## Review Comment

`deliverNativePng` writes the PNG under `Directory.Cache` and shares the URI, but never deletes the file after share success, cancellation, or failure:

```js
const savedFile = await filesystem.writeFile({
  path: fileName,
  data: base64Data,
  directory: Directory.Cache,
});
```

Repeated field exports accumulate large PNGs in cache (A3/600 DPI data URLs are multi‑MB). Not a correctness bug for a single export, but an operations/storage leak on native devices.

Suggested fix: `try/finally` around share that best-effort `filesystem.deleteFile` for the written path (ignore delete errors). Cover with a unit test that the filesystem mock receives `deleteFile` after share resolves or cancels.

## Triage

- Decision: `UNREVIEWED`
- Notes:
