const SESSION_PREFIX = 'reatcarto:map-session:';
const MUNICIPIO_LABEL_SUFFIX = ':municipio';

export const DEFAULT_MAP_VIEW = { lat: -32.035, lng: -52.1, zoom: 13 };

function municipioLabelKey(mapId) {
  return `${SESSION_PREFIX}${mapId}${MUNICIPIO_LABEL_SUFFIX}`;
}

function readStandaloneMunicipioLabel(mapId) {
  if (!mapId || typeof localStorage === 'undefined') return '';
  return localStorage.getItem(municipioLabelKey(mapId)) ?? '';
}

/**
 * @typedef {{
 *   lat: number,
 *   lng: number,
 *   zoom: number,
 *   municipioLabel?: string,
 *   hasWorkingViewport?: boolean,
 *   updatedAt?: string|null,
 * }} MapSessionView
 */

/**
 * @param {string} mapId
 * @returns {MapSessionView|null}
 */
export function readMapSession(mapId) {
  if (!mapId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${SESSION_PREFIX}${mapId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    const zoom = Math.round(Number(data.zoom));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return null;
    return {
      lat,
      lng,
      zoom,
      municipioLabel: typeof data.municipioLabel === 'string' ? data.municipioLabel : '',
      hasWorkingViewport: Boolean(data.hasWorkingViewport),
      updatedAt: data.updatedAt ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} mapId
 * @param {MapSessionView} next
 */
function storeMapSession(mapId, next) {
  localStorage.setItem(`${SESSION_PREFIX}${mapId}`, JSON.stringify(next));
}

/**
 * Salva apenas o rótulo do município (referência na busca — não move o mapa ao reabrir).
 *
 * @param {string} mapId
 * @param {string} label
 */
export function writeMunicipioLabel(mapId, label) {
  if (!mapId || typeof localStorage === 'undefined') return;
  const text = String(label ?? '');
  const prev = readMapSession(mapId);
  if (prev) {
    storeMapSession(mapId, {
      ...prev,
      municipioLabel: text,
    });
    return;
  }
  localStorage.setItem(municipioLabelKey(mapId), text);
}

/**
 * @param {string} mapId
 * @returns {string}
 */
export function readMunicipioLabel(mapId) {
  const session = readMapSession(mapId);
  if (session?.municipioLabel) return session.municipioLabel;
  return readStandaloneMunicipioLabel(mapId);
}

/**
 * Salva a área de trabalho real (posição + zoom definidos pelo usuário no mapa).
 *
 * @param {string} mapId
 * @param {{ lat: number, lng: number, zoom: number }} view
 */
export function writeWorkingViewport(mapId, view) {
  if (!mapId || typeof localStorage === 'undefined') return;
  const lat = Number(view.lat);
  const lng = Number(view.lng);
  const zoom = Math.round(Number(view.zoom));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return;

  const prev = readMapSession(mapId);
  const municipioLabel = prev?.municipioLabel || readStandaloneMunicipioLabel(mapId);
  storeMapSession(mapId, {
    lat,
    lng,
    zoom,
    municipioLabel,
    hasWorkingViewport: true,
    updatedAt: new Date().toISOString(),
  });
  localStorage.removeItem(municipioLabelKey(mapId));
}

/**
 * @param {string} mapId
 * @param {Partial<MapSessionView>} partial
 */
export function writeMapSession(mapId, partial) {
  if (!mapId || typeof localStorage === 'undefined') return;
  const prev = readMapSession(mapId);
  const lat = Number(partial.lat ?? prev?.lat);
  const lng = Number(partial.lng ?? prev?.lng);
  const zoom = Math.round(Number(partial.zoom ?? prev?.zoom));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) return;

  storeMapSession(mapId, {
    lat,
    lng,
    zoom,
    municipioLabel:
      partial.municipioLabel !== undefined
        ? String(partial.municipioLabel ?? '')
        : (prev?.municipioLabel ?? ''),
    hasWorkingViewport: partial.hasWorkingViewport ?? prev?.hasWorkingViewport ?? false,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * @param {string} mapId
 * @param {{ center_lat?: number, center_lng?: number, zoom?: number, updated_at?: string }|null|undefined} mapData
 * @returns {MapSessionView}
 */
export function resolveInitialMapView(mapId, mapData) {
  const stored = readMapSession(mapId);
  const fromServer = mapData
    ? {
        lat: Number(mapData.center_lat),
        lng: Number(mapData.center_lng),
        zoom: Math.round(Number(mapData.zoom)),
      }
    : null;

  if (fromServer && (!Number.isFinite(fromServer.lat) || !Number.isFinite(fromServer.lng))) {
    Object.assign(fromServer, DEFAULT_MAP_VIEW);
  }

  // Área de trabalho manual sempre tem prioridade sobre posição do município/servidor
  if (stored?.hasWorkingViewport) {
    return stored;
  }

  if (stored) {
    if (fromServer && mapData?.updated_at && stored.updatedAt) {
      const serverTime = new Date(mapData.updated_at).getTime();
      const localTime = new Date(stored.updatedAt).getTime();
      if (Number.isFinite(serverTime) && Number.isFinite(localTime) && serverTime > localTime + 1000) {
        return {
          ...fromServer,
          municipioLabel: stored.municipioLabel ?? '',
          hasWorkingViewport: false,
          updatedAt: mapData.updated_at,
        };
      }
    }
    return stored;
  }

  if (fromServer) {
    return {
      ...fromServer,
      municipioLabel: '',
      hasWorkingViewport: false,
      updatedAt: mapData?.updated_at ?? null,
    };
  }

  return { ...DEFAULT_MAP_VIEW, municipioLabel: '', hasWorkingViewport: false, updatedAt: null };
}

/**
 * @param {{ lat?: number, lng?: number, zoom?: number }|null|undefined} a
 * @param {{ lat?: number, lng?: number, zoom?: number }|null|undefined} b
 */
export function viewsAlmostEqual(a, b) {
  if (!a || !b) return false;
  return (
    Math.abs(a.lat - b.lat) < 1e-6 &&
    Math.abs(a.lng - b.lng) < 1e-6 &&
    Math.round(a.zoom) === Math.round(b.zoom)
  );
}
