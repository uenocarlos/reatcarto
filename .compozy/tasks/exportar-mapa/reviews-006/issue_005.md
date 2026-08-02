---
provider: manual
pr:
round: 6
round_created_at: 2026-08-02T19:17:05Z
status: pending
file: src/lib/export/pngExporter.js
line: 147
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Canvas size guard runs after html2canvas allocates

## Review Comment

`capturePreviewCanvas` awaits `html2canvas` first, then calls `assertCanvasSizeSafe(canvas)`:

```js
canvas = await html2canvasFn(previewEl, { useCORS: true, scale, ... });
assertCanvasSizeSafe(canvas);
```

For large paper + high DPI, the browser may OOM or hang **during** allocation — before the guard can reject with the friendly “Reduza o DPI…” message. PRD performance guidance asks for clear failure rather than indefinite hang on extreme DPI/paper combos.

Suggested fix: preflight using `previewEl` client dimensions × `getCaptureScaleFactor(dpi)` (and the same max dimension product check) **before** calling html2canvas; keep the post-capture assert as a backstop. Add a unit test that an oversized preflight throws `canvas_too_large` without invoking `html2canvasFn`.

## Triage

- Decision: `UNREVIEWED`
- Notes:
