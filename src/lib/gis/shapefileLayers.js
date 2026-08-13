import {
  SHAPEFILE_FIELD_MAP,
  SHAPEFILE_LAYER_BY_GEOJSON,
  SHAPEFILE_LAYER_LABELS,
  SHAPEFILE_VALUE_MAX,
} from './constants';

/**
 * @param {string[]} names
 * @returns {Record<string, string>}
 */
export function truncateShpFieldNames(names) {
  const used = new Set();
  /** @type {Record<string, string>} */
  const result = {};

  for (const name of names) {
    const source = String(name ?? '');
    let base = SHAPEFILE_FIELD_MAP[source] ?? source.slice(0, 10);
    base = String(base).slice(0, 10) || 'field';
    let candidate = base;
    let index = 1;
    while (used.has(candidate)) {
      const suffix = String(index);
      candidate = `${base.slice(0, Math.max(1, 10 - suffix.length))}${suffix}`.slice(0, 10);
      index += 1;
    }
    used.add(candidate);
    result[source] = candidate;
  }

  return result;
}

/**
 * @param {unknown} value
 * @returns {{ value: string, truncated: boolean }}
 */
export function truncateShpValues(value) {
  const str = value == null ? '' : String(value);
  if (str.length <= SHAPEFILE_VALUE_MAX) {
    return { value: str, truncated: false };
  }
  return { value: str.slice(0, SHAPEFILE_VALUE_MAX), truncated: true };
}

/**
 * @param {Array<{ geometry?: { type?: string }, properties?: Record<string, unknown> }>} features
 */
export function groupShapefileLayers(features) {
  const buckets = {
    points: [],
    lines: [],
    polygons: [],
  };

  for (const feature of features ?? []) {
    const layerId = SHAPEFILE_LAYER_BY_GEOJSON[feature?.geometry?.type];
    if (!layerId) continue;
    buckets[layerId].push(feature);
  }

  return ['points', 'lines', 'polygons']
    .filter((id) => buckets[id].length > 0)
    .map((id) => ({
      id,
      label: SHAPEFILE_LAYER_LABELS[id],
      count: buckets[id].length,
      features: buckets[id],
    }));
}

/**
 * @param {Array<{ properties?: Record<string, unknown> }>} features
 */
export function collectShapefileTruncationWarnings(features) {
  let truncatedFields = 0;
  for (const feature of features ?? []) {
    const properties = feature?.properties ?? {};
    for (const value of Object.values(properties)) {
      if (truncateShpValues(value).truncated) truncatedFields += 1;
    }
  }
  return truncatedFields;
}
