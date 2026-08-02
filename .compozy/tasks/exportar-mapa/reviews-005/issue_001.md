---
provider: manual
pr:
round: 5
round_created_at: 2026-08-02T18:41:38Z
status: resolved
file: src/components/map/export/OnlineTileLayer.jsx
line: 28
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Online tiles lack crossOrigin for html2canvas

## Review Comment

`OnlineTileLayer` creates Leaflet tiles without a CORS mode:

```js
const layer = L.tileLayer(url, { attribution: '' });
```

`exportCompositionPng` captures with `html2canvas(..., { useCORS: true })`. Browsers only expose cross-origin tile pixels to canvas when the `<img>` was loaded with `crossOrigin` set **before** the request. Without it, Carto/OSM/ArcGIS tiles often paint correctly in the Leaflet preview but are omitted or leave a white/partial basemap in the PNG — while readiness still reports `ready` and delivery can toast success. That violates ADR-010 / PRD “preview ≡ PNG” and “unusable basemap must not report success.”

Suggested fix: pass `crossOrigin: true` (or `'anonymous'`) in the `L.tileLayer` options so tiles load CORS-enabled. Confirm Carto/OSM/ArcGIS responses allow anonymous CORS (already assumed by ADR-010). Add a regression that asserts the tile layer options include `crossOrigin`, and ideally a capture stub that fails if tile images lack the attribute.

## Triage

- Decision: `valid`
- Root cause: `L.tileLayer` was created with only `{ attribution: '' }`, so Leaflet tile `<img>` elements load without `crossOrigin`. `exportCompositionPng` uses `html2canvas(..., { useCORS: true })`, which cannot read cross-origin tile pixels unless the image was requested with CORS enabled beforehand. Preview can look correct while the PNG basemap is blank/partial.
- Fix: pass `crossOrigin: true` in `L.tileLayer` options (Leaflet sets `img.crossOrigin = ""`, equivalent to anonymous CORS). Carto/OSM/ArcGIS already assumed CORS-capable per ADR-010.
- Tests: UT-090h asserts `OnlineTileLayer` passes `crossOrigin` into `L.tileLayer`.
