---
provider: manual
pr:
round: 3
round_created_at: 2026-08-02T17:42:00Z
status: resolved
file: src/components/map/ExportMapModal.jsx
line: 394
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Preview elements stay live during PNG capture

## Review Comment

During `isExporting`, the modal freezes `settings` and `basemapReadiness` into `frozenExportRef` and blocks option edits, but `CompositionPreview` still receives the live `elements` prop:

```jsx
<CompositionPreview
  settings={previewSettings}
  elements={elements}
  ...
/>
```

`PreviewMap`’s `BoundsFitter` re-runs whenever `elements` changes, and visibility/tag layers follow the live list. A background elements refresh (query invalidation / sync) while html2canvas is running can pan the preview map or add/remove geometries mid-capture, so the PNG no longer matches the composition the owner froze for export (US-015 / ADR-010 preview≡PNG). Settings freeze alone is insufficient when geometry input keeps mutating the DOM under capture.

Suggested fix: snapshot `elements` (and optionally derived visible/tag inputs) into `frozenExportRef` when export starts, and pass the frozen array into `CompositionPreview` for the duration of `isExporting`. Cover with a test that mutating `elements` while `isExporting` does not change the preview’s element ids / bounds-driving list.

## Triage

- Decision: `valid`
- Root cause: `frozenExportRef` snapshoted only `settings` and `basemapReadiness` on export start; `CompositionPreview` still received the live `elements` prop, so background query invalidation could mutate `BoundsFitter` and visibility layers mid-capture.
- Fix: include `elements` in the export snapshot and pass `previewElements` (frozen list) to `CompositionPreview` for the duration of `isExporting`.
- Verification: source-contract test in `tests/js/exportPreview.test.js` asserts snapshot wiring and that `CompositionPreview` no longer receives live `elements`.
