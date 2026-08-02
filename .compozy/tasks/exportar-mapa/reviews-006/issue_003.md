---
provider: manual
pr:
round: 6
round_created_at: 2026-08-02T19:17:05Z
status: pending
file: src/components/map/export/CompositionPreview.jsx
line: 59
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Outer aspectRatio excludes title/footer chrome

## Review Comment

`previewAspect` is derived from paper or `compositionLayout` (map ± outside legend only), but it is applied to the **capture root** that also contains the header title and `InstitutionalFooter`:

```jsx
style={{
  aspectRatio: String(previewAspect),
  maxHeight: '100%',
}}
```

With `overflow-hidden` and a flex column (`title` + `flex-1` map + footer), the forced box is sized as if chrome did not exist. Title/footer consume height inside that box, so the map frame is vertically compressed (or content clips) in the DOM that `html2canvas` captures. Paper/DPI options therefore do not produce a faithful print-like frame (US-012 / US-014), especially with a non-empty title and institutional lines.

Suggested fix: size the capture root from content (or compute aspect including measured chrome), and keep `aspectRatio` / paper framing on `composition-map-frame` only. Ensure beside/below `LegendFrame` widths/heights follow `compositionLayout.legendWidth` / `legendHeight` so the outer ratio matches the real flex layout. Add a preview/export test that a titled composition’s captured map frame aspect stays within tolerance of `paperFrame.aspect`.

## Triage

- Decision: `UNREVIEWED`
- Notes:
