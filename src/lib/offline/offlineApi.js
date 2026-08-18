import { OfflineStore, OUTBOX_STATUS } from '@/lib/offline/OfflineStore';
import { validateOfflineGeometry } from '@/lib/offline/geometryValidation';
import {
  buildElementSyncPayload,
  mergeOutboxPayloads,
  pickStyleFallbackFields,
  sameResourceId,
  styleFromElement,
} from '@/lib/offline/outboxMerge';

let currentUserId = null;

export function setOfflineUserId(userId) {
  currentUserId = userId;
}

export function getOfflineUserId() {
  return currentUserId;
}

function storeForUser() {
  if (!currentUserId) {
    throw new Error('Offline store requires authenticated user.');
  }
  return new OfflineStore(currentUserId);
}

function newLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Keep the editor optimistic id so later offline edits attach to the same outbox row. */
export function resolveLocalElementId(payload = {}) {
  const candidate = payload.local_id ?? payload.id;
  if (candidate != null && String(candidate).trim() !== '') {
    return String(candidate);
  }
  return newLocalId();
}

async function ensureOfflineMapReady(store, mapId, mapHint = null) {
  if (!mapId) return;
  if (await store.isMapPrepared(mapId)) return;
  const existing = await store.getMap(mapId);
  const elements = await store.getElements(mapId);
  await store.prepareMap(existing ?? mapHint ?? { id: mapId }, elements);
}

/**
 * Cache the open map so Android can list and draw newly inserted elements offline.
 * Pending local rows are never overwritten by the server copy.
 */
export async function cacheMapForOffline(map, elements = []) {
  if (!map?.id || !currentUserId) return { ok: false };
  const store = storeForUser();
  const mapId = map.id;
  const existing = await store.getElements(mapId);
  const pending = new Map(
    (existing ?? [])
      .filter((el) => el?._pending)
      .map((el) => [String(el.id), el])
  );
  const merged = [];
  const seen = new Set();
  for (const el of elements ?? []) {
    const id = String(el.id);
    seen.add(id);
    merged.push(pending.get(id) ?? el);
  }
  for (const [id, el] of pending) {
    if (!seen.has(id)) merged.push(el);
  }
  for (const el of existing ?? []) {
    const id = String(el.id);
    if (!seen.has(id) && !pending.has(id)) {
      await store.removeElement(el.id);
    }
  }
  const photosMeta = merged.flatMap((el) =>
    (el.photos ?? []).map((p) => ({ ...p, element_id: el.id }))
  );
  await store.prepareMap(map, merged, photosMeta);
  return { ok: true };
}

function uuidFromBytes(bytes) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newMutationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return uuidFromBytes(bytes);
}

export async function prepareOfflineMap(mapId, fetchMap, fetchElements) {
  const store = storeForUser();
  const map = (await fetchMap(mapId))[0];
  const elements = await fetchElements(mapId);
  const photosMeta = elements.flatMap((el) =>
    (el.photos ?? []).map((p) => ({ ...p, element_id: el.id }))
  );
  const size = await store.estimatePrepareSize(map, elements);
  const quota = await store.checkQuota(size);
  if (!quota.ok) {
    return { ok: false, reason: quota.reason };
  }
  await store.prepareMap(map, elements, photosMeta);
  return { ok: true, map, elements };
}

export async function offlineListMaps() {
  const store = storeForUser();
  const prepared = await store.getPreparedMaps();
  return prepared.filter((p) => p.status === 'ready').map((p) => p.map);
}

export async function offlineGetMap(mapId) {
  const store = storeForUser();
  let map = await store.getMap(mapId);
  const elements = await store.getElements(mapId);
  if (!(await store.isMapPrepared(mapId))) {
    if (!map && elements.length === 0) {
      return { unavailable: true };
    }
    await store.prepareMap(map ?? { id: mapId }, elements);
    map = await store.getMap(mapId);
  }
  return { map, elements };
}

export async function offlineCreateElement(payload, clientMutationId = newMutationId()) {
  const store = storeForUser();
  const validation = validateOfflineGeometry(
    payload.element_type,
    payload.geojson,
    payload.name?.trim() ? payload.name : 'Element'
  );
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const localId = resolveLocalElementId(payload);
  const parsedGeojson =
    typeof payload.geojson === 'string' ? JSON.parse(payload.geojson) : payload.geojson;
  const element = {
    id: localId,
    map_id: payload.map_id,
    element_type: payload.element_type,
    geojson: parsedGeojson,
    name: payload.name?.trim() ? payload.name : 'Element',
    description: payload.description ?? '',
    element_category: payload.element_category ?? 'terra',
    style: styleFromElement(payload),
    is_publicly_visible: payload.is_publicly_visible !== false && payload.is_publicly_visible !== 0,
    version: 0,
    _pending: true,
    photos: [],
  };
  await ensureOfflineMapReady(store, payload.map_id);
  await store.upsertElement(payload.map_id, element);
  await store.enqueue({
    client_mutation_id: clientMutationId,
    resource_type: 'element',
    op: 'create',
    resource_id: localId,
    base_version: null,
    payload: buildElementSyncPayload(element),
  });
  return { ...element, client_mutation_id: clientMutationId, _queued: true };
}

export async function offlineUpdateElement(id, payload, clientMutationId = newMutationId()) {
  const store = storeForUser();
  if (payload.geojson) {
    const validation = validateOfflineGeometry(
      payload.element_type ?? 'point',
      payload.geojson,
      payload.name
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  }
  const rows = await store.getAllOutbox();
  const existing = rows.find(
    (r) => sameResourceId(r.resource_id, id) && r.resource_type === 'element'
  );
  let mapId = payload.map_id ?? existing?.payload?.map_id;
  if (!mapId) {
    const prepared = await store.getPreparedMaps();
    for (const p of prepared) {
      const els = await store.getElements(p.mapId);
      if (els.some((e) => sameResourceId(e.id, id))) {
        mapId = p.mapId;
        break;
      }
    }
  }
  const elements = mapId ? await store.getElements(mapId) : [];
  const current = elements.find((e) => sameResourceId(e.id, id));
  const nextStyle = {
    ...styleFromElement(
      mergeOutboxPayloads(current ?? {}, {
        ...payload,
        style: payload.style !== undefined ? payload.style : current?.style,
      })
    ),
    ...pickStyleFallbackFields(payload),
  };
  const updated = {
    ...(current ?? { id, map_id: mapId, element_type: payload.element_type ?? 'point' }),
    ...payload,
    id,
    map_id: mapId ?? current?.map_id ?? payload.map_id,
    version: current?.version ?? payload.base_version ?? 0,
    style: nextStyle ?? {},
    _pending: true,
  };
  if (!updated.map_id) {
    throw new Error('Element not found in offline cache.');
  }
  await ensureOfflineMapReady(store, updated.map_id);
  await store.upsertElement(updated.map_id, updated);
  const syncPayload = buildElementSyncPayload(updated);
  const collapsed = await store.collapseOutboxForResource('element', id);
  if (collapsed?.op === 'create' && collapsed.status === OUTBOX_STATUS.PENDING) {
    await store.updateOutbox(collapsed.client_mutation_id, { payload: syncPayload });
  } else {
    await store.enqueue({
      client_mutation_id: clientMutationId,
      resource_type: 'element',
      op: 'update',
      resource_id: id,
      base_version: payload.base_version ?? current?.version,
      payload: syncPayload,
    });
  }
  return { ...updated, client_mutation_id: clientMutationId, _queued: true };
}

export async function offlineDeleteElement(id, baseVersion, clientMutationId = newMutationId()) {
  const store = storeForUser();
  await store.collapseOutboxForResource('element', id);
  await store.enqueue({
    client_mutation_id: clientMutationId,
    resource_type: 'element',
    op: 'delete',
    resource_id: id,
    base_version: baseVersion,
    payload: { id },
  });
  await store.removeElement(id);
  return { deleted: true, client_mutation_id: clientMutationId, _queued: true };
}

export async function offlineQueuePhotoUpload(
  elementId,
  file,
  dependsOn,
  clientMutationId = newMutationId()
) {
  const store = storeForUser();
  await store.storePhotoBlob(clientMutationId, file, file.type);
  await store.enqueue({
    client_mutation_id: clientMutationId,
    resource_type: 'photo',
    op: 'create',
    resource_id: null,
    base_version: null,
    depends_on: dependsOn ?? null,
    payload: { element_id: elementId, content_type: file.type, file_name: file.name },
  });
  return { client_mutation_id: clientMutationId, _queued: true, status: OUTBOX_STATUS.PENDING };
}

export async function getOutboxSummary() {
  const store = storeForUser();
  const rows = await store.getAllOutbox();
  return {
    pending: rows.filter((r) => r.status === OUTBOX_STATUS.PENDING).length,
    conflicted: rows.filter((r) => r.status === OUTBOX_STATUS.CONFLICTED).length,
    failed: rows.filter((r) => r.status === OUTBOX_STATUS.FAILED).length,
    rows,
  };
}

export async function clearOfflineAccount() {
  if (!currentUserId) return;
  const store = new OfflineStore(currentUserId);
  await store.clearAccountData();
}

export { storeForUser };
