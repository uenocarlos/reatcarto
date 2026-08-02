const MAX_VERTICES = 10000;

function parseGeoJson(geojson) {
  if (!geojson) return null;
  if (typeof geojson === 'string') {
    try {
      return JSON.parse(geojson);
    } catch {
      return null;
    }
  }
  return geojson;
}

function countVertices(geojson) {
  const g = parseGeoJson(geojson);
  if (!g || !g.type) return 0;
  if (g.type === 'Point') return 1;
  if (g.type === 'LineString') return (g.coordinates || []).length;
  if (g.type === 'Polygon') {
    return (g.coordinates || []).reduce((sum, ring) => sum + ring.length, 0);
  }
  return 0;
}

/** @returns {{ valid: boolean, error?: string }} */
export function validateOfflineGeometry(elementType, geojson, name) {
  const g = parseGeoJson(geojson);
  if (!g || !g.type) {
    return { valid: false, error: 'Geometry is required.' };
  }
  const expected =
    elementType === 'point' ? 'Point' : elementType === 'line' ? 'LineString' : 'Polygon';
  if (g.type !== expected) {
    return { valid: false, error: 'Invalid geometry type.' };
  }
  if (elementType === 'point') {
    const coords = g.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      return { valid: false, error: 'Invalid point coordinates.' };
    }
  }
  if (countVertices(g) > MAX_VERTICES) {
    return { valid: false, error: 'Geometry exceeds vertex limit.' };
  }
  if (name !== undefined && String(name).trim() === '') {
    return { valid: false, error: 'Name is required.' };
  }
  return { valid: true };
}
