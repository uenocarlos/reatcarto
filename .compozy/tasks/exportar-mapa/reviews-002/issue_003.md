---
provider: manual
pr:
round: 2
round_created_at: 2026-08-02T17:26:20Z
status: resolved
file: src/components/map/ExportMapModal.jsx
line: 120
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Composition stays editable during PNG capture

## Review Comment

While `isExporting` is true, only the Export button is gated. Options controls still use `disabled={ownershipLost}` (title, author, legend, basemap, location, visibility, paper/DPI, etc.) and `CompositionPreview` keeps rebuilding from live `settings` / boundaries / readiness.

`createExportController` freezes settings for `exportCompositionPng` (DPI scale + filename), but capture is `html2canvas(previewEl)` of the live DOM. During `waitForPreviewReadiness` (up to 15s) or capture, the owner can change title, hide layers, switch basemap, or alter locators — the PNG no longer matches the gated/frozen configuration, and success can still toast.

Conflicts with the “preview equals PNG” / frozen-attempt intent in the TechSpec export flow and US-015 (success only for the intended composition).

Suggested fix: disable the options panel (and legend drag) when `isExporting`, and/or ignore `onSettingsChange` while exporting. Optionally snapshot `data-settings-hash` at attempt start and abort if it changes before capture completes.

## Triage

- Decision: `valid`
- Root cause: `isExporting` only fed `exportDisabled` on the submit button; option controls and the live preview pipeline continued to accept mutations and re-render during `html2canvas` capture.
- Fix approach:
  - Introduce `optionsDisabled = ownershipLost || isExporting` and apply it to every options-panel control.
  - Guard `update`, orientation patches, legend-rect changes, and basemap-readiness callbacks with early return when `isExporting`.
  - Disable location-boundary fetching while exporting (`enabled: open && !ownershipLost && !isExporting`).
  - Snapshot settings + basemap readiness on first render with `isExporting === true` and feed the frozen values to `CompositionPreview`.
  - Block legend drag and other preview interaction via `pointer-events-none` + `data-preview-frozen` on the preview column wrapper (no child-file edits required).
