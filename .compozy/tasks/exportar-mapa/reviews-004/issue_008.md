---
provider: manual
pr:
round: 4
round_created_at: 2026-08-02T18:01:05Z
status: resolved
file: src/components/map/ExportMapModal.jsx
line: 43
severity: low
author: claude-code
provider_ref:
---

# Issue 008: Freeze snapshot mutates ref during render

## Review Comment

The export freeze writes `frozenExportRef.current` during render when `isExporting` flips true. Ref mutation during render is unsafe under concurrent React / Strict Mode remounts and can interact with the readiness races in issue_001 (snapshot taken on an intermediate render).

Suggested fix: capture the freeze snapshot in a `useEffect` (or in the export click handler / `MapEditor.handleExport` before awaiting capture), then render from that state/ref only after it is set. Prefer lifting the snapshot to the export controller start path so freeze and capture share one source of truth.

## Triage

- Decision: `valid`
- Root cause: Lines 43–49 mutated `frozenExportRef.current` synchronously in the component body whenever `isExporting` changed. React render must stay pure; ref writes during render are unsafe under Strict Mode double-invocation and concurrent rendering, and can capture intermediate props on the first pass before sibling effects settle.
- Fix approach: Replace the render-time ref with `useState` (`frozenExport`). Capture `{ settings, elements }` synchronously in `handleExportClick` before calling `onExport`, so the snapshot exists before the parent flips `isExporting`. A companion `useEffect` clears the snapshot when export ends and provides a fallback (`prev ?? snapshot`) if `isExporting` becomes true without passing through the click handler. Preview continues to derive `previewSettings` / `previewElements` from `frozenExport` only while `isExporting` is true; `basemapReadiness` stays live (issue_001 contract preserved).
- Verification: `npm run lint`, `npm run typecheck`, `npm run test` (387/387), `npm run build` — all exit 0.
