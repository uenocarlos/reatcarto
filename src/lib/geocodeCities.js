/**
 * Busca de municípios brasileiros via índice local (public/geo/municipios-search-index.json),
 * gerado a partir das mesmas malhas usadas no mapa de localização.
 */

const INDEX_URL = '/geo/municipios-search-index.json';

/** @type {Promise<Array<MunicipalityEntry>>|null} */
let indexPromise = null;

/**
 * @typedef {{
 *   code: string,
 *   name: string,
 *   uf: string,
 *   state?: string,
 *   lat: number,
 *   lng: number,
 *   bbox?: [[number, number], [number, number]]
 * }} MunicipalityEntry
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   lat: number,
 *   lng: number,
 *   zoom: number,
 *   bbox: [[number, number], [number, number]]|null,
 *   placeType: string,
 *   uf?: string,
 *   code?: string
 * }} CitySearchResult
 */

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * @param {{ signal?: AbortSignal, fetchFn?: typeof fetch }} [options]
 * @returns {Promise<MunicipalityEntry[]>}
 */
export async function loadMunicipalitySearchIndex(options = {}) {
  const doFetch = options.fetchFn || fetch;
  if (!indexPromise) {
    indexPromise = (async () => {
      const res = await doFetch(INDEX_URL, {
        signal: options.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error('Falha ao carregar índice de municípios');
      }
      const data = await res.json();
      const list = Array.isArray(data?.municipalities) ? data.municipalities : [];
      return list.filter(
        (m) =>
          m &&
          Number.isFinite(Number(m.lat)) &&
          Number.isFinite(Number(m.lng)) &&
          String(m.name || '').trim()
      );
    })().catch((err) => {
      indexPromise = null;
      throw err;
    });
  }
  return indexPromise;
}

/** @param {{ fetchFn?: typeof fetch }} [options] */
export function resetMunicipalitySearchIndexCache(options = {}) {
  indexPromise = null;
  if (options.fetchFn) {
    /* no-op: next loadMunicipalitySearchIndex can pass fetchFn */
  }
}

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * @param {MunicipalityEntry} entry
 * @param {string} needle
 */
function scoreEntry(entry, needle, bias) {
  const name = normalizeText(entry.name);
  const uf = normalizeText(entry.uf);
  const label = `${name} ${uf}`;
  let score = 0;

  if (name === needle) score += 1000;
  else if (name.startsWith(needle)) score += 800;
  else if (name.includes(needle)) score += 500;
  else if (label.includes(needle)) score += 300;
  else return null;

  // Bônus leve se a query incluir a UF (ex.: "rio grande rs")
  if (needle.includes(` ${uf}`) || needle.endsWith(` ${uf}`) || needle === uf) {
    score += 50;
  }

  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    const dist = haversineKm(bias, { lat: entry.lat, lng: entry.lng });
    score += Math.max(0, 200 - dist);
  }

  return score;
}

/**
 * @param {MunicipalityEntry} entry
 * @returns {CitySearchResult}
 */
function toSearchResult(entry) {
  const state = entry.state || entry.uf;
  const label = state && state !== entry.name ? `${entry.name}, ${entry.uf}` : entry.name;
  return {
    id: String(entry.code || `${entry.uf}:${entry.name}`),
    label,
    lat: entry.lat,
    lng: entry.lng,
    zoom: 12,
    bbox: Array.isArray(entry.bbox) ? entry.bbox : null,
    placeType: 'municipality',
    uf: entry.uf,
    code: entry.code,
  };
}

/**
 * @param {string} query
 * @param {{ signal?: AbortSignal, limit?: number, bias?: { lat: number, lng: number }, fetchFn?: typeof fetch }} [options]
 * @returns {Promise<CitySearchResult[]>}
 */
export async function searchCities(query, options = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const { signal, limit = 6, bias, fetchFn } = options;
  const municipalities = await loadMunicipalitySearchIndex({ signal, fetchFn });
  const needle = normalizeText(q);
  if (!needle) return [];

  const ranked = [];
  for (const entry of municipalities) {
    if (signal?.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }
    const score = scoreEntry(entry, needle, bias);
    if (score == null) continue;
    ranked.push({ score, entry });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.name.localeCompare(b.entry.name, 'pt-BR');
  });

  return ranked.slice(0, limit).map((row) => toSearchResult(row.entry));
}
