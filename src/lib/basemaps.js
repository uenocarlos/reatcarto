/** Shared basemap tile config for editor + export. */

/** @typedef {'branco'|'osm'|'satelite'} BasemapId */

/**
 * @typedef {object} BasemapConfig
 * @property {string} url
 * @property {number} maxZoom
 * @property {string[]} [subdomains]
 * @property {boolean} [crossOrigin] — false for Google (no CORS); omit/true for canvas-friendly sources
 */

/** @type {Readonly<Record<BasemapId, BasemapConfig>>} */
export const BASEMAPS = Object.freeze({
  branco: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    maxZoom: 20,
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
  },
  // Google satellite — higher zoom than ArcGIS World Imagery in this app
  satelite: {
    url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    crossOrigin: false,
  },
});

export const MAP_MAX_ZOOM = 20;

/** @type {Readonly<Record<BasemapId, string>>} */
export const BASEMAP_TILE_URLS = Object.freeze({
  branco: BASEMAPS.branco.url,
  osm: BASEMAPS.osm.url,
  satelite: BASEMAPS.satelite.url,
});

/**
 * @param {unknown} basemap
 * @returns {BasemapId}
 */
export function normalizeBasemapId(basemap) {
  const key = String(basemap ?? '').toLowerCase();
  if (key === 'branco' || key === 'osm' || key === 'satelite') return key;
  return 'branco';
}

/**
 * Props for react-leaflet / Leaflet TileLayer.
 * @param {unknown} basemap
 * @param {{ forExport?: boolean }} [options]
 */
export function getBasemapTileProps(basemap, options = {}) {
  const id = normalizeBasemapId(basemap);
  const cfg = BASEMAPS[id];
  const props = {
    url: cfg.url,
    maxZoom: cfg.maxZoom,
    maxNativeZoom: cfg.maxZoom,
  };
  if (cfg.subdomains) props.subdomains = cfg.subdomains;

  if (options.forExport) {
    // Google tiles typically lack CORS; forcing anonymous taints/breaks capture.
    if (cfg.crossOrigin !== false) {
      props.crossOrigin = 'anonymous';
    }
  }

  return props;
}
