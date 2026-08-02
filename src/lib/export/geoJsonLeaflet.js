/**
 * Convert GeoJSON coordinates to Leaflet [lat, lng] positions.
 * @param {import('geojson').Geometry|null|undefined} geometry
 * @returns {Array<Array<number>>|Array<Array<Array<number>>>|null}
 */
export function geoJsonToLeafletPositions(geometry) {
  if (!geometry) return null;

  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates;
    return [[lat, lng]];
  }

  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((poly) => poly.map((ring) => ring.map(([lng, lat]) => [lat, lng])));
  }

  if (geometry.type === 'LineString') {
    return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  }

  return null;
}

/**
 * @param {import('geojson').FeatureCollection|import('geojson').Feature|null|undefined} geo
 */
export function firstFeatureGeometry(geo) {
  if (!geo) return null;
  if (geo.type === 'Feature') return geo.geometry ?? null;
  if (geo.type === 'FeatureCollection') return geo.features?.[0]?.geometry ?? null;
  return null;
}

/**
 * @param {import('geojson').FeatureCollection|import('geojson').Feature|null|undefined} geo
 */
export function allFeatureGeometries(geo) {
  if (!geo) return [];
  if (geo.type === 'Feature') return geo.geometry ? [geo.geometry] : [];
  if (geo.type === 'FeatureCollection') {
    return (geo.features ?? []).map((f) => f.geometry).filter(Boolean);
  }
  return [];
}
