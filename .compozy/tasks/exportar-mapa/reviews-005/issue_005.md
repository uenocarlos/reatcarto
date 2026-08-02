---
provider: manual
pr:
round: 5
round_created_at: 2026-08-02T18:41:38Z
status: resolved
file: src/lib/export/exportTags.js
line: 24
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Non-point tags get lat/lng 0,0

## Review Comment

`buildTagDescriptors` only reads coordinates for `Point` geometries. For `LineString` / `Polygon` (and other types) it leaves `lat`/`lng` at `0` and still pushes a tag:

```js
let lat = 0;
let lng = 0;
// ...
if (geo?.type === 'Point' && Array.isArray(geo.coordinates)) {
  lng = geo.coordinates[0];
  lat = geo.coordinates[1];
}
tags.push({ elementId: element.id, text: name, lat, lng });
```

With `showTags: true`, named lines/polygons either appear at Null Island (if the view includes 0,0) or are silently missing from the Brazil extent — contradicting US-008 (“names of currently visible elements”). UT-069+ only exercise `Point` fixtures, so CI does not catch this.

Suggested fix: derive an anchor (centroid / first coordinate / bbox center) for line and polygon GeoJSON, or skip non-point geometries until anchors exist. Prefer skipping over inventing `(0,0)`. Extend tests with LineString/Polygon elements and assert a sensible on-feature position (or absence if intentionally unsupported and documented).

## Triage

- Decision: `valid`
- Root cause: `buildTagDescriptors` initialized `lat`/`lng` to zero and only populated them for `Point` geometries, so named `LineString`/`Polygon` elements were tagged at Null Island or outside the Brazil viewport.
- Fix: Added `collectCoordinatePairs` and `extractTagAnchor` to compute a centroid anchor for Point, MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon, Feature, FeatureCollection, and GeometryCollection. Elements without derivable finite coordinates are skipped instead of emitting `(0,0)`.
- Tests: Added UT-069b (LineString centroid), UT-069c (Polygon outer-ring centroid), and UT-069d (empty GeometryCollection skipped).
