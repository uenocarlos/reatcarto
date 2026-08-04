/** Keep only polygon geometries (malha/estado must never fall back to markers). */
export function isPolygonGeometry(geometry) {
  const type = geometry?.type;
  return type === 'Polygon' || type === 'MultiPolygon';
}

export function filterPolygonFeatures(collection) {
  if (!collection || !Array.isArray(collection.features)) {
    return { type: 'FeatureCollection', features: [] };
  }
  return {
    type: 'FeatureCollection',
    features: collection.features.filter((feature) => isPolygonGeometry(feature?.geometry)),
  };
}

/** UF numeric codes (IBGE) — used for `/geo/municipios/{code}.geojson`. */
export const UF_IBGE_CODES = Object.freeze({
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32',
  GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15', PB: '25', PR: '41',
  PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
  SP: '35', SE: '28', TO: '17',
});

export function resolveUfIbgeCode(ufSigla, statesMeta = []) {
  const uf = String(ufSigla ?? '').toUpperCase();
  if (!uf) return null;
  const fromMeta = (statesMeta ?? []).find((s) => String(s.uf).toUpperCase() === uf);
  if (fromMeta?.code) return String(fromMeta.code);
  return UF_IBGE_CODES[uf] ?? null;
}
