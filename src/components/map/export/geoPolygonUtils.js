/** Keep only polygon geometries (malha/estado must never fall back to markers). */
export function isPolygonGeometry(geometry) {
  const type = geometry?.type;
  return type === 'Polygon' || type === 'MultiPolygon';
}

/**
 * Continental Brazil window used to frame the overview inset.
 * Excludes remote Atlantic islands (Trindade, São Pedro e São Paulo) that explode the bbox.
 */
export const BRAZIL_MAINLAND_CLIP = Object.freeze({
  minLng: -74.05,
  minLat: -34.0,
  maxLng: -34.6,
  maxLat: 5.5,
});

function walkCoordinates(coords, visit) {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (typeof coords[0] === 'number') {
    visit(coords[0], coords[1]);
    return;
  }
  for (const part of coords) walkCoordinates(part, visit);
}

/**
 * @param {GeoJSON.FeatureCollection|null|undefined} collection
 * @param {{ minLng: number, minLat: number, maxLng: number, maxLat: number }|null} [clip]
 * @returns {{ minLng: number, minLat: number, maxLng: number, maxLat: number }|null}
 */
export function computeCollectionBbox(collection, clip = null) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let found = false;

  for (const feature of collection?.features ?? []) {
    const geometry = feature?.geometry;
    if (!isPolygonGeometry(geometry)) continue;
    walkCoordinates(geometry.coordinates, (lng, lat) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      if (clip) {
        if (lng < clip.minLng || lng > clip.maxLng || lat < clip.minLat || lat > clip.maxLat) return;
      }
      found = true;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
  }

  if (!found) return null;
  return { minLng, minLat, maxLng, maxLat };
}

/**
 * Overview inset should hug continental Brazil so the highlighted UF stays readable.
 * Falls back to the full collection bbox when the clip window has no vertices.
 */
export function computeBrazilOverviewBbox(collection) {
  return computeCollectionBbox(collection, BRAZIL_MAINLAND_CLIP)
    ?? computeCollectionBbox(collection);
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
