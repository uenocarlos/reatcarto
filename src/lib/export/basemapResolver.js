import { normalizeExportSettings } from './exportSettings';

export const BASEMAP_TILE_URLS = Object.freeze({
  carto: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
});

const GOOGLE_SATELLITE_PATTERN = /google\.com|lyrs=s/;

/**
 * @param {'carto'|'osm'|'satellite'|'offline'|string} basemap
 * @returns {string|null}
 */
export function resolveBasemapTileUrl(basemap) {
  const normalized = normalizeExportSettings({ basemap });
  if (normalized.basemap === 'offline') return null;
  return BASEMAP_TILE_URLS[normalized.basemap] ?? BASEMAP_TILE_URLS.carto;
}

/**
 * @param {boolean} isNativePlatform
 * @returns {boolean}
 */
export function isOfflineBasemapAvailable(isNativePlatform) {
  return Boolean(isNativePlatform);
}

/**
 * @param {import('./exportSettings').ExportBasemap|string} basemap
 * @param {boolean} isNativePlatform
 */
export function normalizeBasemapForPlatform(basemap, isNativePlatform) {
  const normalized = normalizeExportSettings({ basemap });
  if (normalized.basemap === 'offline' && !isOfflineBasemapAvailable(isNativePlatform)) {
    return 'carto';
  }
  return normalized.basemap;
}

/**
 * @param {string|null} url
 * @returns {boolean}
 */
export function isGoogleSatelliteUrl(url) {
  return typeof url === 'string' && GOOGLE_SATELLITE_PATTERN.test(url);
}

/**
 * Build a tile-readiness payload for visible basemap tiles.
 * @param {Map<string, string|null|undefined>} tileEntries
 * @returns {{ requiredTiles: Array<string|null>, partial?: boolean }}
 */
function buildTileReadinessPayload(tileEntries) {
  const values = [...tileEntries.values()];
  if (values.length === 0 || values.some((value) => value === undefined)) {
    return { requiredTiles: [] };
  }
  const requiredTiles = values;
  if (requiredTiles.some((tile) => tile === null)) {
    return { requiredTiles, partial: true };
  }
  return { requiredTiles };
}

/**
 * Build the offline basemap readiness payload for visible tiles.
 * @param {Map<string, string|null|undefined>} tileEntries
 * @returns {{ requiredTiles: Array<string|null>, partial?: boolean }}
 */
export function buildOfflineReadinessPayload(tileEntries) {
  return buildTileReadinessPayload(tileEntries);
}

/**
 * Build the online basemap readiness payload for visible tiles.
 * @param {Map<string, string|null|undefined>} tileEntries
 * @returns {{ requiredTiles: Array<string|null>, partial?: boolean }}
 */
export function buildOnlineReadinessPayload(tileEntries) {
  return buildTileReadinessPayload(tileEntries);
}

/**
 * @param {'carto'|'osm'|'satellite'|'offline'} basemap
 * @param {{ requiredTiles?: Array<string|null>, partial?: boolean }} readiness
 * @returns {'ready'|'loading'|'unusable'|'error'}
 */
export function evaluateBasemapReadiness(basemap, readiness = {}) {
  const normalized = normalizeExportSettings({ basemap });
  if (readiness.error) return 'error';

  const tiles = readiness.requiredTiles ?? [];

  if (normalized.basemap === 'offline') {
    if (tiles.length === 0) return 'loading';
    if (tiles.some((t) => t === undefined)) return 'loading';
    if (tiles.some((t) => t === null)) return 'unusable';
    return 'ready';
  }

  if (tiles.length === 0) return 'loading';
  if (tiles.some((t) => t === undefined)) return 'loading';
  if (tiles.some((t) => t === null)) return 'error';
  return 'ready';
}
