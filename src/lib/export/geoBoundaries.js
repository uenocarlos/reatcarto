/** @typedef {{ uf: string, name: string, code?: string }} NormalizedState */
/** @typedef {{ code: string, name: string, uf: string }} NormalizedMunicipality */

const UFS_PATH = '/geo/ufs.geojson';
const MUNICIPIOS_DIR = '/geo/municipios';
const LEGACY_MUNICIPIOS_PATH = '/geo/municipios.geojson';

const MUNICIPIOS_FILE_BY_UF = Object.freeze({
  AC: 'ac',
  AL: 'al',
  AM: 'am',
  AP: 'ap',
  BA: 'ba',
  CE: 'ce',
  DF: 'df',
  ES: 'es',
  GO: 'go',
  MA: 'ma',
  MG: 'mg',
  MS: 'ms',
  MT: 'mt',
  PA: 'pa',
  PB: 'pb',
  PE: 'pe',
  PI: 'pi',
  PR: 'pr',
  RJ: 'rj',
  RN: 'rn',
  RO: 'ro',
  RR: 'rr',
  RS: 'rs',
  SC: 'sc',
  SE: 'se',
  SP: 'sp',
  TO: 'to',
});

/** @type {{ states: NormalizedState[], municipalities: NormalizedMunicipality[], loaded: boolean }|null} */
let cache = null;

/** @type {typeof fetch|null} */
let fetchImpl = typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null;

/**
 * @param {{ fetchFn?: typeof fetch }} [options]
 */
export function configureGeoBoundaries(options = {}) {
  if (options.fetchFn) fetchImpl = options.fetchFn;
}

export function resetGeoBoundariesCache() {
  cache = null;
}

/**
 * @param {import('geojson').FeatureCollection|Record<string, unknown>} collection
 * @returns {NormalizedState[]}
 */
export function normalizeStatesCollection(collection) {
  const features = /** @type {Array<{ properties?: Record<string, unknown> }>} */ (
    collection?.features ?? []
  );
  return features.map((feature) => ({
    uf: String(feature.properties?.SIGLA_UF ?? feature.properties?.sigla ?? feature.properties?.uf ?? ''),
    name: String(feature.properties?.NM_UF ?? feature.properties?.nome ?? feature.properties?.name ?? ''),
    code: String(feature.properties?.CD_UF ?? feature.properties?.id ?? feature.properties?.code ?? ''),
  }));
}

/**
 * @param {import('geojson').FeatureCollection|Record<string, unknown>} collection
 * @returns {NormalizedMunicipality[]}
 */
export function normalizeMunicipalitiesCollection(collection) {
  const features = /** @type {Array<{ properties?: Record<string, unknown> }>} */ (
    collection?.features ?? []
  );
  return features.map((feature) => ({
    code: String(feature.properties?.CD_MUN ?? feature.properties?.id ?? feature.properties?.code ?? ''),
    name: String(feature.properties?.NM_MUN ?? feature.properties?.nome ?? feature.properties?.name ?? ''),
    uf: String(feature.properties?.SIGLA_UF ?? feature.properties?.uf ?? feature.properties?.sigla ?? ''),
  }));
}

/**
 * @param {string} path
 * @param {AbortSignal|undefined} signal
 */
async function fetchGeoJson(path, signal) {
  if (!fetchImpl) throw new GeoBoundaryError('Fetch unavailable', { status: 0 });
  const response = await fetchImpl(path, { signal });
  if (!response.ok) {
    throw new GeoBoundaryError(`Failed to load ${path}`, { status: response.status });
  }
  return response.json();
}

function buildMunicipiosPathForState(state) {
  const uf = String(state?.uf ?? '').trim().toUpperCase();
  const fileId = MUNICIPIOS_FILE_BY_UF[uf] || uf.toLowerCase();
  return `${MUNICIPIOS_DIR}/${fileId}.geojson`;
}

export class GeoBoundaryError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'GeoBoundaryError';
    this.status = options.status ?? 0;
  }
}

/**
 * Load UF boundaries and municipality features from static public/geo layout.
 * Successful loads are cached in-module; failures do not populate cache.
 * @param {{ signal?: AbortSignal, fetchFn?: typeof fetch }} [options]
 */
export async function loadGeoBoundaries(options = {}) {
  if (options.fetchFn) fetchImpl = options.fetchFn;
  if (cache?.loaded) {
    return {
      states: cache.states,
      municipalities: cache.municipalities,
      fromCache: true,
    };
  }

  try {
    const ufsData = await fetchGeoJson(UFS_PATH, options.signal);
    const states = normalizeStatesCollection(ufsData);
    // Injected fetchers keep compatibility with the former single-file fixture;
    // production uses the split per-UF files to avoid loading Brazil at once.
    const municipalityCollections = options.fetchFn
      ? [await fetchGeoJson(LEGACY_MUNICIPIOS_PATH, options.signal)]
      : await Promise.all(
          states.map((state) => fetchGeoJson(buildMunicipiosPathForState(state), options.signal)),
        );
    const municipalities = municipalityCollections.flatMap((collection) => normalizeMunicipalitiesCollection(collection));

    cache = { states, municipalities, loaded: true };
    return { states, municipalities, fromCache: false };
  } catch (error) {
    cache = null;
    throw error;
  }
}

/**
 * @param {NormalizedMunicipality[]} municipalities
 * @param {string} ufSigla
 */
export function filterMunicipalitiesByUf(municipalities, ufSigla) {
  const uf = String(ufSigla ?? '').toUpperCase();
  return (municipalities ?? []).filter((m) => String(m.uf).toUpperCase() === uf);
}

/**
 * @param {{ locationCount?: number, locations?: Array<{ uf?: string|null, municipioCode?: string|null }> }} params
 */
export function validateLocationSelection(params = {}) {
  const locationCount = params.locationCount ?? 0;
  const locations = params.locations ?? [];

  if (locationCount === 0) {
    return { ok: true };
  }

  for (let i = 0; i < locationCount; i += 1) {
    const entry = locations[i] ?? {};
    if (!entry.uf) {
      return { ok: false, incomplete: true, index: i };
    }
  }

  return { ok: true };
}

/**
 * Whether duplicate UF selections across two inset slots are allowed (UT-054).
 * @param {Array<{ uf?: string|null }>} locations
 */
export function allowsDuplicateUfLocations(locations) {
  const ufs = (locations ?? []).map((l) => l.uf).filter(Boolean);
  return ufs.length >= 2 && ufs[0] === ufs[1];
}
