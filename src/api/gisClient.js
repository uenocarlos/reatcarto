import { apiFetch, API_BASE_URL, ApiError } from './http';
import { api, mergeLocalPendingElements, normalizeElement } from './apiClient';
import { isOnline } from '@/lib/offline/connectivity';
import { GIS_ELEMENT_PAGE_SIZE } from '@/lib/gis/constants';
import { triggerDownload } from '@/lib/gis/exportGeoJson';

function parseFilename(disposition, fallback) {
  const header = disposition || '';
  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].replace(/["']/g, ''));
    } catch {
      return utfMatch[1];
    }
  }
  const match = header.match(/filename="([^"]+)"/i) || header.match(/filename=([^;]+)/i);
  return match?.[1]?.trim() || fallback;
}

/**
 * Loads every map element, following pagination (page_size=100).
 * Offline uses the IndexedDB copy already exposed by MapElement.filter.
 * Online pages are merged with local outbox/pending geometries waiting to sync.
 *
 * @param {string} mapId
 * @param {{ fetchPage?: Function, offlineFilter?: Function, online?: () => boolean, mergePending?: Function }} [deps]
 */
export async function fetchAllMapElements(mapId, deps = {}) {
  const online = deps.online ?? isOnline;
  if (!online()) {
    const offlineFilter = deps.offlineFilter ?? ((id) => api.entities.MapElement.filter({ map_id: id }));
    return offlineFilter(mapId);
  }

  const fetchPage = deps.fetchPage ?? ((page) => {
    const params = new URLSearchParams({
      map_id: String(mapId),
      page: String(page),
      page_size: String(GIS_ELEMENT_PAGE_SIZE),
    });
    return apiFetch(`/elements/list.php?${params}`, { method: 'GET' });
  });

  const all = [];
  let page = 1;
  let totalPages = 1;

  do {
    const data = await fetchPage(page);
    const batch = (data?.elements ?? []).map(normalizeElement);
    all.push(...batch);
    totalPages = Math.max(1, Number(data?.pagination?.total_pages) || 1);
    if (batch.length === 0) break;
    page += 1;
  } while (page <= totalPages);

  const mergePending = deps.mergePending ?? mergeLocalPendingElements;
  return mergePending(mapId, all);
}

/**
 * @param {{ mapId: string, scope: 'whole'|'selection', elementIds?: string[], fileName?: string }} input
 * @param {{ fetchImpl?: typeof fetch, download?: typeof triggerDownload, documentRef?: Document }} [deps]
 */
export async function exportShapefile(input, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(`${API_BASE_URL}/elements/export-shp.php`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/zip, application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      map_id: input.mapId,
      scope: input.scope,
      element_ids: input.elementIds ?? [],
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    let payload = null;
    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    }
    const error = payload?.error ?? {};
    throw new ApiError(
      error.code || 'unknown_error',
      error.message || 'Falha ao exportar Shapefile.',
      response.status,
      error.fields || {},
    );
  }

  const blob = await response.blob();
  const fileName = parseFilename(
    response.headers.get('Content-Disposition'),
    input.fileName || 'mapa-exportado.zip',
  );

  if (deps.download !== false) {
    const download = deps.download ?? triggerDownload;
    await download(blob, fileName, { documentRef: deps.documentRef });
  }

  return { blob, fileName, mimeType: 'application/zip' };
}
