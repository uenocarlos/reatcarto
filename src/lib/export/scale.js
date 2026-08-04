const EARTH_CIRCUMFERENCE_M = 40075016.686;
const NICE_DISTANCES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];

/**
 * Meters per pixel at latitude/zoom (Web Mercator).
 * @param {number} lat
 * @param {number} zoom
 */
export function metersPerPixel(lat, zoom) {
  const safeLat = Number.isFinite(lat) ? lat : 0;
  const safeZoom = Number.isFinite(zoom) ? zoom : 0;
  return (EARTH_CIRCUMFERENCE_M * Math.abs(Math.cos((safeLat * Math.PI) / 180))) / Math.pow(2, safeZoom + 8);
}

/**
 * @param {number} metersPerPx
 * @param {number} [barWidthPx]
 */
export function pickScaleDistance(metersPerPx, barWidthPx = 120) {
  const mpp = Math.max(Number.EPSILON, metersPerPx);
  const maxMeters = mpp * barWidthPx;
  for (let i = NICE_DISTANCES.length - 1; i >= 0; i -= 1) {
    if (NICE_DISTANCES[i] <= maxMeters) {
      return NICE_DISTANCES[i];
    }
  }
  return NICE_DISTANCES[0];
}

/**
 * @param {number} meters
 * @returns {string}
 */
export function formatScaleLabel(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return '1m';
  if (meters >= 1000) {
    const km = meters / 1000;
    return Number.isInteger(km) ? `${km}km` : `${km.toFixed(1)}km`;
  }
  return `${Math.round(meters)}m`;
}

/**
 * Graphic scale label at a map viewport (UT-060, UT-061).
 * @param {{ lat?: number, zoom?: number, barWidthPx?: number }} params
 */
export function computeScaleLabel(params = {}) {
  const lat = Number.isFinite(params.lat) ? params.lat : -32;
  const zoom = Number.isFinite(params.zoom) ? params.zoom : 11;
  const barWidthPx = Math.max(40, params.barWidthPx ?? 120);
  const mpp = metersPerPixel(lat, zoom);
  const distanceMeters = pickScaleDistance(mpp, barWidthPx);
  const barPx = Math.max(8, Math.min(barWidthPx, distanceMeters / mpp));
  const label = formatScaleLabel(distanceMeters);

  return {
    label,
    distanceMeters,
    barPx,
    metersPerPixel: mpp,
  };
}
