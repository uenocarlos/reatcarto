/** @typedef {'ibge'|'fallback'} BoundarySource */

const IBGE_LOCALIDADES = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const IBGE_MALHAS = 'https://servicodados.ibge.gov.br/api/v3/malhas';

export class BoundaryUnavailableError extends Error {
  constructor(message = 'Limites administrativos indisponíveis') {
    super(message);
    this.name = 'BoundaryUnavailableError';
  }
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_FALLBACK_BASE = '/geo';

/** @type {typeof fetch|null} */
let fetchImpl = typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null;
let isOnlineImpl = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);
let fallbackBase = DEFAULT_FALLBACK_BASE;
let timeoutMs = DEFAULT_TIMEOUT_MS;

/**
 * @param {{ fetchFn?: typeof fetch, isOnlineFn?: () => boolean, fallbackBase?: string, timeoutMs?: number }} [options]
 */
export function configureBrazilBoundaryService(options = {}) {
  if (options.fetchFn) fetchImpl = options.fetchFn;
  if (options.isOnlineFn) isOnlineImpl = options.isOnlineFn;
  if (typeof options.fallbackBase === 'string') fallbackBase = options.fallbackBase;
  if (typeof options.timeoutMs === 'number') timeoutMs = options.timeoutMs;
}

export function resetBrazilBoundaryServiceConfig() {
  fetchImpl = typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null;
  isOnlineImpl = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);
  fallbackBase = DEFAULT_FALLBACK_BASE;
  timeoutMs = DEFAULT_TIMEOUT_MS;
}

async function fetchWithTimeout(url, init = {}) {
  if (!fetchImpl) throw new BoundaryUnavailableError('Fetch unavailable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await Promise.race([
      fetchImpl(url, { ...init, signal: controller.signal }),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('timeout')));
      }),
    ]);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchFallbackJson(path) {
  const res = await fetchWithTimeout(`${fallbackBase}${path}`);
  if (!res.ok) throw new Error(`Fallback miss ${path}`);
  return res.json();
}

/**
 * @param {Array<{ id: string|number, sigla?: string, nome: string }>} rows
 * @returns {Array<{ code: string, sigla: string, name: string }>}
 */
function mapStateRows(rows) {
  return (rows ?? []).map((row) => ({
    code: String(row.id),
    sigla: row.sigla ?? '',
    name: row.nome ?? row.name ?? '',
  }));
}

/**
 * @param {import('geojson').FeatureCollection} collection
 */
function statesFromGeoCollection(collection) {
  return (collection?.features ?? []).map((feature) => ({
    code: String(feature.properties?.id ?? feature.properties?.code ?? ''),
    sigla: feature.properties?.sigla ?? '',
    name: feature.properties?.nome ?? feature.properties?.name ?? '',
  }));
}

/**
 * @param {import('geojson').FeatureCollection} collection
 */
function municipalitiesFromGeoCollection(collection) {
  return (collection?.features ?? []).map((feature) => ({
    code: String(feature.properties?.id ?? feature.properties?.code ?? ''),
    name: feature.properties?.nome ?? feature.properties?.name ?? '',
    uf: feature.properties?.uf ?? '',
  }));
}

/**
 * @returns {Promise<{ items: Array<{ code: string, sigla: string, name: string }>, source: BoundarySource }>}
 */
export async function listStates() {
  if (isOnlineImpl()) {
    try {
      const rows = await fetchJson(`${IBGE_LOCALIDADES}/estados?orderBy=nome`);
      return { items: mapStateRows(rows), source: 'ibge' };
    } catch {
      /* fall through */
    }
  }

  const fallback = await fetchFallbackJson('/ufs.geojson');
  return { items: statesFromGeoCollection(fallback), source: 'fallback' };
}

/**
 * @param {string} stateCode
 * @returns {Promise<{ items: Array<{ code: string, name: string, uf?: string }>, source: BoundarySource }>}
 */
export async function listMunicipalities(stateCode) {
  const code = String(stateCode ?? '').trim();
  if (!code) return { items: [], source: 'fallback' };

  if (isOnlineImpl()) {
    try {
      const rows = await fetchJson(`${IBGE_LOCALIDADES}/estados/${code}/municipios`);
      return {
        items: (rows ?? []).map((row) => ({
          code: String(row.id),
          name: row.nome,
          uf: row.microrregiao?.mesorregiao?.UF?.sigla ?? '',
        })),
        source: 'ibge',
      };
    } catch {
      /* fall through */
    }
  }

  const fallback = await fetchFallbackJson(`/municipios/${code}.geojson`);
  return { items: municipalitiesFromGeoCollection(fallback), source: 'fallback' };
}

/**
 * @param {string} stateCode
 * @param {BoundarySource} preferredSource
 */
async function loadStateGeometry(stateCode, preferredSource) {
  if (preferredSource === 'ibge') {
    const geo = await fetchJson(
      `${IBGE_MALHAS}/estados/${stateCode}?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=N`
    );
    return geo;
  }
  const ufs = await fetchFallbackJson('/ufs.geojson');
  const feature = (ufs.features ?? []).find((f) => String(f.properties?.id) === String(stateCode));
  if (!feature) throw new BoundaryUnavailableError(`State ${stateCode} not found`);
  return { type: 'FeatureCollection', features: [feature] };
}

async function loadMunicipalityGeometry(municipalityCode, stateCode, preferredSource) {
  if (preferredSource === 'ibge') {
    const geo = await fetchJson(
      `${IBGE_MALHAS}/municipios/${municipalityCode}?formato=application/vnd.geo+json&qualidade=intermediaria`
    );
    return geo;
  }
  const munis = await fetchFallbackJson(`/municipios/${stateCode}.geojson`);
  const feature = (munis.features ?? []).find((f) => String(f.properties?.id) === String(municipalityCode));
  if (!feature) throw new BoundaryUnavailableError(`Municipality ${municipalityCode} not found`);
  return { type: 'FeatureCollection', features: [feature] };
}

async function loadMunicipalMesh(stateCode, preferredSource) {
  if (preferredSource === 'ibge') {
    const geo = await fetchJson(
      `${IBGE_MALHAS}/estados/${stateCode}?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=municipio`
    );
    return geo;
  }
  return fetchFallbackJson(`/municipios/${stateCode}.geojson`);
}

/** SA inset context has no IBGE malha endpoint — always served from `public/geo/`. */
async function loadSaContext() {
  return fetchFallbackJson('/sa-brazil-context.geojson');
}

/**
 * @param {{
 *   stateCode: string|null,
 *   municipalityCode: string|null,
 *   locatorCount: 0|1|2,
 *   includeMesh?: boolean,
 * }} params
 */
export async function getLocatorGeometries(params) {
  const locatorCount = Number(params.locatorCount) || 0;
  if (locatorCount === 0) {
    return {
      source: /** @type {BoundarySource} */ ('fallback'),
      usedFallback: false,
      insets: [],
      stateGeometry: null,
      municipalityGeometry: null,
      municipalMesh: null,
      saContextGeometry: null,
    };
  }

  const stateCode = params.stateCode ? String(params.stateCode) : null;
  const municipalityCode = params.municipalityCode ? String(params.municipalityCode) : null;
  if (!stateCode || !municipalityCode) {
    throw new BoundaryUnavailableError('UF e município são obrigatórios para mapas de localização');
  }

  let usedFallback = !isOnlineImpl();

  async function resolveWithFallback(loader) {
    if (!isOnlineImpl()) {
      usedFallback = true;
      return loader('fallback');
    }
    try {
      return await loader('ibge');
    } catch {
      usedFallback = true;
      return loader('fallback');
    }
  }

  try {
    const saContextPromise =
      locatorCount === 2
        ? loadSaContext().then((geometry) => {
            usedFallback = true;
            return geometry;
          })
        : Promise.resolve(null);

    const [stateGeometry, municipalityGeometry, saContextGeometry, municipalMesh] = await Promise.all([
      resolveWithFallback((src) => loadStateGeometry(stateCode, src)),
      resolveWithFallback((src) => loadMunicipalityGeometry(municipalityCode, stateCode, src)),
      saContextPromise,
      params.includeMesh
        ? resolveWithFallback((src) => loadMunicipalMesh(stateCode, src))
        : Promise.resolve(null),
    ]);

    /** @type {Array<{ kind: 'sa-context'|'state-muni', label: string }>} */
    const insets = [];
    if (locatorCount === 2 && saContextGeometry) {
      insets.push({ kind: 'sa-context', label: 'América do Sul' });
    }
    if (locatorCount >= 1) {
      insets.push({ kind: 'state-muni', label: 'UF + Município' });
    }

    return {
      source: usedFallback ? 'fallback' : 'ibge',
      usedFallback,
      insets,
      stateGeometry,
      municipalityGeometry,
      municipalMesh,
      saContextGeometry,
      stateCode,
      municipalityCode,
    };
  } catch (error) {
    if (error instanceof BoundaryUnavailableError) throw error;
    throw new BoundaryUnavailableError(error instanceof Error ? error.message : 'Boundary fetch failed');
  }
}
