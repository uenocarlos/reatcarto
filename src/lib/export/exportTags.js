import { effectiveVisibleElements, normalizeExportSettings } from './exportSettings';
import { sanitizeExportText } from './compositionMetadata';

/**
 * @param {unknown} geo
 * @returns {Array<[number, number]>}
 */
function collectCoordinatePairs(geo) {
  if (!geo || typeof geo !== 'object') return [];

  const typed = /** @type {{ type?: string, coordinates?: unknown, geometry?: unknown, features?: unknown[], geometries?: unknown[] }} */ (
    geo
  );

  if (typed.type === 'Point' && Array.isArray(typed.coordinates) && typed.coordinates.length >= 2) {
    return [[typed.coordinates[0], typed.coordinates[1]]];
  }

  if (typed.type === 'MultiPoint' && Array.isArray(typed.coordinates)) {
    return typed.coordinates
      .filter((coord) => Array.isArray(coord) && coord.length >= 2)
      .map((coord) => [coord[0], coord[1]]);
  }

  if (typed.type === 'LineString' && Array.isArray(typed.coordinates)) {
    return typed.coordinates
      .filter((coord) => Array.isArray(coord) && coord.length >= 2)
      .map((coord) => [coord[0], coord[1]]);
  }

  if (typed.type === 'MultiLineString' && Array.isArray(typed.coordinates)) {
    return typed.coordinates.flatMap((line) =>
      Array.isArray(line)
        ? line
            .filter((coord) => Array.isArray(coord) && coord.length >= 2)
            .map((coord) => [coord[0], coord[1]])
        : []
    );
  }

  if (typed.type === 'Polygon' && Array.isArray(typed.coordinates) && Array.isArray(typed.coordinates[0])) {
    const ring = typed.coordinates[0]
      .filter((coord) => Array.isArray(coord) && coord.length >= 2)
      .map((coord) => [coord[0], coord[1]]);
    if (ring.length > 1) {
      const [firstLng, firstLat] = ring[0];
      const [lastLng, lastLat] = ring[ring.length - 1];
      if (firstLng === lastLng && firstLat === lastLat) {
        ring.pop();
      }
    }
    return ring;
  }

  if (typed.type === 'MultiPolygon' && Array.isArray(typed.coordinates)) {
    return typed.coordinates.flatMap((polygon) => {
      if (!Array.isArray(polygon) || !Array.isArray(polygon[0])) return [];
      const ring = polygon[0]
        .filter((coord) => Array.isArray(coord) && coord.length >= 2)
        .map((coord) => [coord[0], coord[1]]);
      if (ring.length > 1) {
        const [firstLng, firstLat] = ring[0];
        const [lastLng, lastLat] = ring[ring.length - 1];
        if (firstLng === lastLng && firstLat === lastLat) {
          ring.pop();
        }
      }
      return ring;
    });
  }

  if (typed.type === 'Feature') {
    return collectCoordinatePairs(typed.geometry);
  }

  if (typed.type === 'FeatureCollection') {
    return (typed.features ?? []).flatMap((feature) => collectCoordinatePairs(feature));
  }

  if (typed.type === 'GeometryCollection') {
    return (typed.geometries ?? []).flatMap((geometry) => collectCoordinatePairs(geometry));
  }

  return [];
}

/**
 * @param {unknown} geo
 * @returns {{ lat: number, lng: number } | null}
 */
function extractTagAnchor(geo) {
  const pairs = collectCoordinatePairs(geo);
  if (pairs.length === 0) return null;

  let sumLng = 0;
  let sumLat = 0;
  let count = 0;

  for (const [lng, lat] of pairs) {
    if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      continue;
    }
    sumLng += lng;
    sumLat += lat;
    count += 1;
  }

  if (count === 0) return null;
  return { lng: sumLng / count, lat: sumLat / count };
}

/**
 * @param {Array<Record<string, unknown>>} elements
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @returns {Array<{ elementId: string, text: string, lat: number, lng: number }>}
 */
export function buildTagDescriptors(elements, settings) {
  const normalized = normalizeExportSettings(settings);
  if (!normalized.showTags) return [];

  const visible = effectiveVisibleElements(elements, normalized);
  /** @type {Array<{ elementId: string, text: string, lat: number, lng: number }>} */
  const tags = [];

  for (const element of visible) {
    const name = sanitizeExportText(element.name);
    if (!name) continue;
    if (typeof element.id !== 'string') continue;

    let anchor;
    try {
      const geo = typeof element.geojson === 'string' ? JSON.parse(element.geojson) : element.geojson;
      anchor = extractTagAnchor(geo);
    } catch {
      continue;
    }

    if (!anchor) continue;

    tags.push({ elementId: element.id, text: name, lat: anchor.lat, lng: anchor.lng });
  }

  return tags;
}

/**
 * Snapshot tags at export start — frozen copy for UT-076.
 * @param {Array<Record<string, unknown>>} elements
 * @param {import('./exportSettings').ExportSettings} settings
 */
export function snapshotTagsForExport(elements, settings) {
  return buildTagDescriptors(elements, settings);
}
