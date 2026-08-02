/**
 * @param {unknown} styleJson
 * @returns {Record<string, unknown>}
 */
export function safeParseStyle(styleJson) {
  if (!styleJson) return {};
  if (typeof styleJson === 'object' && !Array.isArray(styleJson)) return /** @type {Record<string, unknown>} */ (styleJson);
  if (typeof styleJson !== 'string') return {};
  try {
    const parsed = JSON.parse(styleJson);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {unknown} geojson
 * @returns {Record<string, unknown>|null}
 */
export function safeParseGeojson(geojson) {
  if (!geojson) return null;
  if (typeof geojson === 'object' && !Array.isArray(geojson)) return /** @type {Record<string, unknown>} */ (geojson);
  if (typeof geojson !== 'string') return null;
  try {
    const parsed = JSON.parse(geojson);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
