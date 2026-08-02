---
provider: manual
pr:
round: 1
round_created_at: 2026-08-02T17:04:39Z
status: resolved
file: src/components/map/ExportMapModal.jsx
line: 351
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Basemap readiness not wired to capture DOM

## Review Comment

`ExportMapModal` keeps `basemapReadiness` in state and uses it in a local `buildPreviewModel` for some UI copy, but `CompositionPreview` (the element passed to `exportCompositionPng`) is never given `basemapReadiness`:

```jsx
<CompositionPreview
  ...
  onBasemapReadinessChange={setBasemapReadiness}
  // basemapReadiness missing
/>
```

`pngExporter.waitForPreviewReadiness` reads `data-preview-status` from that DOM node. Without the prop, CompositionPreview’s model always evaluates online basemaps as immediately `ready` (tile `error` never reaches capture status) and Offline as permanently `loading` when readiness is empty.

Separately, the Export button uses:

```js
ownershipLost || !gateResult.ok || Boolean(locationBoundaries.boundaryError) || isExporting
```

It ignores `previewModel.basemapStatus` / `previewModel.previewStatus` and `previewModel.exportDisabled`, so users can start export while the basemap is unusable or still loading — conflicting with US-009/US-015 (no false success; wait then fail if unusable).

Suggested fix: pass `basemapReadiness={basemapReadiness}` into `CompositionPreview`, and disable export when `previewStatus !== 'ready'` (or when `basemapStatus` is `loading`/`unusable`/`error`).

## Triage

- Decision: `valid`
- Root cause: `ExportMapModal` mantinha `basemapReadiness` em state e o usava em `buildPreviewModel` para mensagens de UI, mas não repassava a prop para `CompositionPreview`. O DOM capturado por `exportCompositionPng` (`data-preview-status`) era montado sem esse estado, então basemaps online pareciam `ready` imediatamente e offline ficavam presos em `loading`. O botão Exportar também ignorava `previewModel.previewStatus`, permitindo exportação com basemap indisponível ou carregando.
- Fix: passar `basemapReadiness={basemapReadiness}` para `CompositionPreview` e incluir `previewModel.previewStatus !== 'ready'` em `exportDisabled`.
- Verification: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
