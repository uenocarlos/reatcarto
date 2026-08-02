---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T18:01:05Z
status: resolved
file: src/lib/export/pngExporter.js
line: 186
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Missing share activityType treated as user cancel

## Review Comment

`deliverNativePng` treats a missing/empty `shareResult.activityType` as cancellation:

```js
if (!activityType) {
  return { delivered: false, cancelled: true, method: 'native' };
}
```

Capacitor Share on some iOS/Android versions resolves successfully without a stable `activityType`. The controller then returns `cancelled`, and `MapEditor` suppresses the success toast even though the PNG was written and the share sheet completed — violating US-015 / task_05 (“success only when share sheet presented with a generated file”; cancel must not claim success, but success must not be dropped either).

Tests only mock shares that include `activityType`, so this gap is uncaught.

Suggested fix: treat unresolved share without throw as delivered success (or use Capacitor’s cancel/error channel explicitly); reserve `cancelled` for documented cancel signals/exceptions.

## Triage

- Decision: `valid`
- Root cause: `deliverNativePng` inferred user cancellation from a missing or empty `shareResult.activityType`. Capacitor Share resolves successfully on completed shares even when `activityType` is absent or `""` (documented for iOS/Android); cancellation is signaled via promise rejection (`"Share canceled"`), not via an empty field.
- Fix: remove the `activityType` gate; treat a resolved `Share.share()` as `{ delivered: true }`. Catch share rejections whose message matches `/cancel/i` and return `{ delivered: false, cancelled: true }`; propagate other share errors as `ExportCaptureError`. Added `IT-038c` (empty result → delivered) and `IT-038d` (Share canceled → cancelled).
