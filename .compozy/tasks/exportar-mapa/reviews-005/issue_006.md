---
provider: manual
pr:
round: 5
round_created_at: 2026-08-02T18:41:38Z
status: resolved
file: src/lib/export/pngExporter.js
line: 226
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Capture does not recheck readiness after wait

## Review Comment

`exportCompositionPng` awaits `waitForPreviewReadiness` then immediately calls `capturePreviewCanvas` with no revalidation:

```js
if (!skipReadinessWait) {
  await waitForPreviewReadiness(previewEl, { signal });
}
// ...
const canvas = await capturePreviewCanvas(previewEl, normalized, deps);
```

`waitForPreviewReadiness` returns on the first `data-preview-status="ready"` poll. After reviews-004, basemap readiness stays live during export, so a `tileunload` / tile error between the successful poll and (or during) `html2canvas` can leave the DOM in `loading`/`error` while capture still proceeds and delivery reports success — the same class of false-success the freeze/readiness rounds tried to close (UT-090 / ADR-010).

Suggested fix: re-read `data-preview-status` immediately before `html2canvas` and abort with `preview_not_ready` if not `ready`; optionally require status to stay `ready` for a short stable window (e.g. 2–3 consecutive polls). Consider aborting capture if status flips to `error` mid-wait via a shared AbortSignal tied to readiness.

## Triage

- Decision: `valid`
- Root cause: `waitForPreviewReadiness` returned on the first `ready` poll and `exportCompositionPng` invoked `html2canvas` without a final gate. With live basemap readiness during export (reviews-004 issue_001), a `tileunload` or tile error between the last poll and capture could flip `data-preview-status` to `loading`/`error` while capture still proceeded and reported delivery success — violating UT-090 / ADR-010.
- Fix: added `assertPreviewReadyForCapture` called immediately before `capturePreviewCanvas`; extended `waitForPreviewReadiness` with `stablePolls` (default 1, export path uses 3 consecutive `ready` polls via `READINESS_STABLE_POLLS`).
- Tests: stable-poll contract, pre-capture assert, and race regression (`exportCompositionPng aborts capture when status flips after readiness wait`).
