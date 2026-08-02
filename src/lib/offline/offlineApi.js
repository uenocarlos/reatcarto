import { OfflineStore, OUTBOX_STATUS } from '@/lib/offline/OfflineStore';
import { isOnline } from '@/lib/offline/connectivity';
import { validateOfflineGeometry } from '@/lib/offline/geometryValidation';

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

export function newMutationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `mut-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  const prepared = await store.isMapPrepared(mapId);
  if (!prepared) {
    return { unavailable: true };
  }
  const map = await store.getMap(mapId);
  const elements = await store.getElements(mapId);
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
  const localId = newLocalId();
  const element = {
    id: localId,
    map_id: payload.map_id,
    element_type: payload.element_type,
    geojson: typeof payload.geojson === 'string' ? JSON.parse(payload.geojson) : payload.geojson,
    name: payload.name?.trim() ? payload.name : 'Element',
    description: payload.description ?? '',
    element_category: payload.element_category ?? 'terra',
    style: typeof payload.style === 'string' ? JSON.parse(payload.style) : payload.style ?? {},
    version: 0,
    _pending: true,
    photos: [],
  };
  await store.upsertElement(payload.map_id, element);
  await store.enqueue({
    client_mutation_id: clientMutationId,
    resource_type: 'element',
    op: 'create',
    resource_id: localId,
    base_version: null,
    payload: {
      map_id: payload.map_id,
      element_type: payload.element_type,
      geojson: element.geojson,
      name: element.name,
      description: element.description,
      element_category: element.element_category,
      style: element.style,
    },
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
  const existing = rows.find((r) => r.resource_id === id && r.resource_type === 'element');
  let mapId = payload.map_id;
  if (!mapId) {
    const prepared = await store.getPreparedMaps();
    for (const p of prepared) {
      const els = await store.getElements(p.mapId);
      if (els.some((e) => e.id === id)) {
        mapId = p.mapId;
        break;
      }
    }
  }
  const elements = mapId ? await store.getElements(mapId) : [];
  const current = elements.find((e) => e.id === id);
  if (!current) {
    throw new Error('Element not found in offline cache.');
  }
  const updated = {
    ...current,
    ...payload,
    version: current.version,
    _pending: true,
  };
  await store.upsertElement(mapId, updated);
  await store.collapseOutboxForResource('element', id);
  await store.enqueue({
    client_mutation_id: clientMutationId,
    resource_type: 'element',
    op: 'update',
    resource_id: id,
    base_version: payload.base_version ?? current.version,
    payload,
  });
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
