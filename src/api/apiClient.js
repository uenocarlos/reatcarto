import { apiFetch, API_BASE_URL, ApiError, resolveApiAssetUrl } from './http';
import { GIS_ELEMENT_PAGE_SIZE } from '@/lib/gis/constants';
import { isOnline } from '@/lib/offline/connectivity';
import {
  setOfflineUserId,
  getOfflineUserId,
  prepareOfflineMap,
  offlineListMaps,
  offlineGetMap,
  offlineCreateElement,
  offlineUpdateElement,
  offlineDeleteElement,
  offlineQueuePhotoUpload,
  newMutationId,
  storeForUser,
  cacheMapForOffline,
} from '@/lib/offline/offlineApi';
import { reduceConflicts } from '@/lib/sync/SyncEngine';

function newMutationIdInternal() {
  return newMutationId();
}

const ELEMENT_REQUEST_TIMEOUT_MS = 10000;

function abortSignalAfter(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function isNetworkError(err) {
  return err?.code === 'network_error' || err?.name === 'AbortError' || err?.status === 0;
}

function isOfflineFallbackError(err) {
  return isNetworkError(err) || err?.status === 401;
}

async function fetchAllPaginated(buildPath, mapItems) {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const data = await apiFetch(buildPath(page), {
      method: 'GET',
      signal: abortSignalAfter(ELEMENT_REQUEST_TIMEOUT_MS),
    });
    const batch = mapItems(data);
    all.push(...batch);
    totalPages = Math.max(1, Number(data?.pagination?.total_pages) || 1);
    if (batch.length === 0) break;
    page += 1;
  } while (page <= totalPages);
  return all;
}

async function withNetworkFallback(onlineFn, offlineFn) {
  if (!isOnline()) {
    return offlineFn();
  }
  try {
    return await onlineFn();
  } catch (err) {
    if (isOfflineFallbackError(err)) {
      try {
        return await offlineFn();
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

function unavailableOfflineError() {
  const err = new Error('Map not available offline.');
  err.code = 'offline_unavailable';
  return err;
}

async function readOfflineElements(mapId) {
  const offline = await offlineGetMap(mapId);
  if (offline.unavailable) {
    throw unavailableOfflineError();
  }
  return (offline.elements ?? []).map(normalizeElement);
}

async function writeThroughElement(element) {
  try {
    if (!getOfflineUserId() || !element?.map_id || !element?.id) return;
    await storeForUser().upsertElement(element.map_id, element);
  } catch {
    /* IndexedDB cache is best-effort */
  }
}

async function dropCachedElement(id) {
  try {
    if (!getOfflineUserId() || id == null) return;
    await storeForUser().removeElement(id);
  } catch {
    /* IndexedDB cache is best-effort */
  }
}

function pendingOutboxIds(outbox, op) {
  return new Set(
    (outbox ?? [])
      .filter((row) => row.resource_type === 'element' && row.op === op && row.status === 'pending')
      .map((row) => String(row.resource_id))
  );
}

export async function mergeLocalPendingElements(mapId, serverElements) {
  try {
    if (!getOfflineUserId()) return serverElements;
    const store = storeForUser();
    const local = await store.getElements(mapId);
    const outbox = typeof store.getAllOutbox === 'function' ? await store.getAllOutbox() : [];
    const deletedIds = pendingOutboxIds(outbox, 'delete');
    const pendingCreateIds = pendingOutboxIds(outbox, 'create');
    const pendingUpdateIds = pendingOutboxIds(outbox, 'update');
    const byId = new Map((serverElements ?? []).map((el) => [String(el.id), el]));
    for (const raw of local ?? []) {
      const normalized = normalizeElement(raw);
      const id = String(normalized.id);
      if (deletedIds.has(id)) continue;
      const keepLocal =
        Boolean(raw?._pending) || pendingCreateIds.has(id) || pendingUpdateIds.has(id);
      if (!keepLocal) continue;
      byId.set(id, { ...normalized, _pending: true });
    }
    for (const id of deletedIds) {
      byId.delete(id);
    }
    return [...byId.values()];
  } catch {
    return serverElements;
  }
}

/**
 * @param {object} mutation
 * @param {{ getPhotoBlob?: (id: string) => Promise<object|null> }} photoStore
 */
async function syncUploadOfflinePhoto(mutation, photoStore) {
  const clientMutationId = mutation.client_mutation_id;
  if (!photoStore?.getPhotoBlob) {
    throw new ApiError('validation_error', 'Offline photo store unavailable.', 400);
  }
  const blobRow = await photoStore.getPhotoBlob(clientMutationId);
  if (!blobRow?.blob) {
    throw new ApiError('validation_error', 'Photo blob missing from offline store.', 400);
  }
  const elementId = mutation.payload?.element_id;
  if (!elementId) {
    throw new ApiError('validation_error', 'element_id required for photo upload.', 400);
  }
  const contentType = blobRow.content_type || mutation.payload?.content_type || 'image/jpeg';
  const fileName = mutation.payload?.file_name || 'photo.jpg';
  const file =
    blobRow.blob instanceof File
      ? blobRow.blob
      : new File([blobRow.blob], fileName, { type: contentType });
  const form = new FormData();
  form.append('element_id', elementId);
  form.append('client_mutation_id', clientMutationId);
  form.append('file', file);
  const data = await apiFetch('/photos/upload.php', { method: 'POST', body: form });
  return {
    client_mutation_id: clientMutationId,
    status: 'synced',
    resource_type: 'photo',
    resource: data.photo,
  };
}

function normalizeMap(map) {
  if (!map) return map;
  return {
    ...map,
    created_date: map.created_at ?? map.created_date,
  };
}

export function normalizeElement(element) {
  if (!element) return element;
  let styleObj = element.style;
  if (typeof styleObj === 'string') {
    try {
      styleObj = JSON.parse(styleObj);
    } catch {
      styleObj = {};
    }
  }
  if (styleObj && typeof styleObj === 'object' && styleObj.custom_icon_url) {
    styleObj = { ...styleObj, custom_icon_url: resolveApiAssetUrl(styleObj.custom_icon_url) };
  }
  const style =
    typeof element.style === 'string' && !styleObj?.custom_icon_url
      ? element.style
      : JSON.stringify(styleObj ?? {});
  const geojson =
    typeof element.geojson === 'string' ? element.geojson : JSON.stringify(element.geojson ?? {});
  const photos = (element.photos ?? []).map((p) => ({
    ...p,
    url: resolveApiAssetUrl(p.url || `${API_BASE_URL}/photos/get.php?id=${encodeURIComponent(p.id)}`),
  }));
  const videos = (element.videos ?? []).map((v) => ({
    ...v,
    url: resolveApiAssetUrl(v.url || `${API_BASE_URL}/videos/get.php?id=${encodeURIComponent(v.id)}`),
  }));
  return {
    ...element,
    style,
    geojson,
    is_publicly_visible: element.is_publicly_visible !== false && element.is_publicly_visible !== 0,
    photo_urls: photos.map((p) => p.url),
    photos,
    video_urls: videos.map((v) => v.url),
    videos,
  };
}

export { ApiError } from './http';

export const api = {
  auth: {
    register: async (input) => {
      const data = await apiFetch('/auth/register.php', { method: 'POST', body: input });
      return {
        user: data.user,
        email_verification_required: data.email_verification_required === true,
      };
    },
    verifyEmail: async (token, type) => {
      const data = await apiFetch('/auth/verify.php', {
        method: 'POST',
        body: { token, ...(type ? { type } : {}) },
      });
      return data.user;
    },
    resendVerification: async (email) =>
      apiFetch('/auth/resend_verification.php', { method: 'POST', body: { email } }),
    login: async (identifier, password) => {
      const data = await apiFetch('/auth/login.php', {
        method: 'POST',
        body: { identifier, password },
      });
      return data.user;
    },
    logout: async () => apiFetch('/auth/logout.php', { method: 'POST', body: {} }),
    me: async () => {
      const data = await apiFetch('/auth/me.php', { method: 'GET' });
      return data.user;
    },
    requestPasswordReset: async (email) =>
      apiFetch('/auth/password_forgot.php', { method: 'POST', body: { email } }),
    resetPassword: async (token, password, confirmation) =>
      apiFetch('/auth/password_reset.php', {
        method: 'POST',
        body: { token, password, password_confirmation: confirmation },
      }),
    updateProfile: async (patch) => {
      const data = await apiFetch('/auth/profile.php', { method: 'PATCH', body: patch });
      return data.user;
    },
    listElementCategories: async () => {
      const data = await apiFetch('/auth/element_categories.php', { method: 'GET' });
      return data.categories ?? [];
    },
    addElementCategory: async (label) => {
      const data = await apiFetch('/auth/element_categories.php', {
        method: 'POST',
        body: { label },
      });
      return data.category;
    },
    changeUsername: async (username) => {
      const data = await apiFetch('/auth/change_username.php', {
        method: 'POST',
        body: { username },
      });
      return data.user;
    },
    changeEmail: async (email) => {
      const data = await apiFetch('/auth/change_email.php', { method: 'POST', body: { email } });
      return data.user;
    },
    changePassword: async (currentPassword, newPassword, confirmation) =>
      apiFetch('/auth/change_password.php', {
        method: 'POST',
        body: {
          current_password: currentPassword,
          new_password: newPassword,
          password_confirmation: confirmation,
        },
      }),
    deleteAccount: async ({ password, confirmPhrase }) =>
      apiFetch('/auth/delete_account.php', {
        method: 'POST',
        body: { password, confirm_phrase: confirmPhrase },
      }),
  },
  entities: {
    Map: {
      list: async (sort, options = {}) => {
        const sortMaps = (maps) => {
          if (sort === '-created_date') {
            maps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          }
          return maps;
        };
        return withNetworkFallback(
          async () => {
            const params = new URLSearchParams();
            if (options.q) params.set('q', options.q);
            if (options.page) params.set('page', String(options.page));
            if (options.pageSize) params.set('page_size', String(options.pageSize));
            const qs = params.toString();
            const data = await apiFetch(`/maps/list.php${qs ? `?${qs}` : ''}`, {
              method: 'GET',
              signal: abortSignalAfter(ELEMENT_REQUEST_TIMEOUT_MS),
            });
            return sortMaps((data.maps ?? []).map(normalizeMap));
          },
          async () => sortMaps((await offlineListMaps()).map(normalizeMap))
        );
      },
      filter: async ({ id }) => {
        return withNetworkFallback(
          async () => {
            const data = await apiFetch(`/maps/get.php?id=${encodeURIComponent(id)}`, {
              method: 'GET',
              signal: abortSignalAfter(ELEMENT_REQUEST_TIMEOUT_MS),
            });
            return [normalizeMap(data.map)];
          },
          async () => {
            const offline = await offlineGetMap(id);
            if (offline.unavailable) {
              throw unavailableOfflineError();
            }
            return [normalizeMap(offline.map)];
          }
        );
      },
      create: async (payload, clientMutationId = newMutationIdInternal()) => {
        if (!isOnline()) {
          throw new Error('Cannot create maps while offline.');
        }
        const data = await apiFetch('/maps/create.php', {
          method: 'POST',
          body: { ...payload, client_mutation_id: clientMutationId },
        });
        return normalizeMap(data.map);
      },
      update: async (id, payload, clientMutationId = newMutationIdInternal()) => {
        const { version, base_version, ...rest } = payload;
        const body = {
          id,
          ...rest,
          client_mutation_id: clientMutationId,
          base_version: base_version ?? version ?? payload.base_version ?? payload.version,
        };
        const data = await apiFetch('/maps/update.php', {
          method: 'PATCH',
          body,
        });
        return normalizeMap(data.map);
      },
      delete: async (id, baseVersion, clientMutationId = newMutationIdInternal()) => {
        const body = { id, client_mutation_id: clientMutationId };
        if (baseVersion != null) body.base_version = baseVersion;
        return apiFetch('/maps/delete.php', {
          method: 'DELETE',
          body,
        });
      },
      publish: async (id, options = {}, clientMutationId = newMutationIdInternal()) => {
        const body = {
          id,
          ...(options.confirmEmpty ? { confirm_empty: true } : {}),
          client_mutation_id: clientMutationId,
        };
        if (options.baseVersion != null) body.base_version = options.baseVersion;
        const data = await apiFetch('/maps/publish.php', {
          method: 'POST',
          body,
        });
        return normalizeMap(data.map);
      },
      unpublish: async (id, baseVersion, clientMutationId = newMutationIdInternal()) => {
        const body = { id, client_mutation_id: clientMutationId };
        if (baseVersion != null) body.base_version = baseVersion;
        const data = await apiFetch('/maps/unpublish.php', {
          method: 'POST',
          body,
        });
        return normalizeMap(data.map);
      },
      prepareOffline: async (mapId) => {
        const result = await prepareOfflineMap(
          mapId,
          (id) => api.entities.Map.filter({ id }),
          (id) => api.entities.MapElement.filter({ map_id: id })
        );
        if (!result.ok) {
          throw new Error(result.reason === 'quota_exceeded' ? 'Storage quota exceeded.' : 'Prepare failed.');
        }
        return result;
      },
    },
    MapElement: {
      list: async () => {
        throw new Error('MapElement.list requires map_id; use filter({ map_id })');
      },
      filter: async ({ map_id, page, pageSize }) => {
        return withNetworkFallback(
          async () => {
            const loadPage = async (pageNum, size) => {
              const params = new URLSearchParams({ map_id, page: String(pageNum) });
              params.set('page_size', String(size));
              const data = await apiFetch(`/elements/list.php?${params}`, {
                method: 'GET',
                signal: abortSignalAfter(ELEMENT_REQUEST_TIMEOUT_MS),
              });
              return data;
            };
            if (page || pageSize) {
              const data = await loadPage(page || 1, pageSize || GIS_ELEMENT_PAGE_SIZE);
              const server = (data.elements ?? []).map(normalizeElement);
              return mergeLocalPendingElements(map_id, server);
            }
            const server = await fetchAllPaginated(
              (pageNum) => {
                const params = new URLSearchParams({
                  map_id,
                  page: String(pageNum),
                  page_size: String(GIS_ELEMENT_PAGE_SIZE),
                });
                return `/elements/list.php?${params}`;
              },
              (data) => (data.elements ?? []).map(normalizeElement)
            );
            return mergeLocalPendingElements(map_id, server);
          },
          () => readOfflineElements(map_id)
        );
      },
      create: async (payload, clientMutationId = newMutationIdInternal()) => {
        const { local_id, ...rest } = payload ?? {};
        const runOffline = async () =>
          normalizeElement(await offlineCreateElement({ ...rest, local_id }, clientMutationId));
        const style =
          typeof rest.style === 'string' ? rest.style : JSON.stringify(rest.style ?? {});
        const geojson =
          typeof rest.geojson === 'string' ? rest.geojson : JSON.stringify(rest.geojson);
        return withNetworkFallback(async () => {
          const data = await apiFetch('/elements/create.php', {
            method: 'POST',
            signal: abortSignalAfter(ELEMENT_REQUEST_TIMEOUT_MS),
            body: {
              ...rest,
              name: rest.name?.trim() ? rest.name : 'Element',
              style,
              geojson,
              client_mutation_id: clientMutationId,
            },
          });
          const created = normalizeElement(data.element);
          await writeThroughElement({ ...created, _pending: false });
          if (local_id && String(local_id) !== String(created.id)) {
            try {
              await storeForUser().removeElement(local_id);
            } catch {
              /* ignore */
            }
          }
          return created;
        }, runOffline);
      },
      update: async (id, payload, clientMutationId = newMutationIdInternal()) => {
        const runOffline = async () =>
          normalizeElement(await offlineUpdateElement(id, payload, clientMutationId));
        return withNetworkFallback(async () => {
          const baseVersion = payload.base_version ?? payload.version;
          const body = { id, client_mutation_id: clientMutationId };
          if (baseVersion != null) body.base_version = baseVersion;
          for (const key of [
            'name',
            'description',
            'element_category',
            'geojson',
            'style',
            'element_type',
            'is_publicly_visible',
          ]) {
            if (payload[key] !== undefined) {
              if (key === 'style' && typeof payload[key] !== 'string') {
                body[key] = JSON.stringify(payload[key]);
              } else if (key === 'geojson' && typeof payload[key] !== 'string') {
                body[key] = JSON.stringify(payload[key]);
              } else if (key === 'is_publicly_visible') {
                body[key] = payload[key] !== false && payload[key] !== 0 && payload[key] !== 'false' && payload[key] !== 'f';
              } else {
                body[key] = payload[key];
              }
            }
          }
          const data = await apiFetch('/elements/update.php', {
            method: 'PATCH',
            signal: abortSignalAfter(ELEMENT_REQUEST_TIMEOUT_MS),
            body,
          });
          const updated = normalizeElement(data.element);
          await writeThroughElement({ ...updated, _pending: false });
          return updated;
        }, runOffline);
      },
      delete: async (id, baseVersion, clientMutationId = newMutationIdInternal()) => {
        return withNetworkFallback(
          async () => {
            const body = { id, client_mutation_id: clientMutationId };
            if (baseVersion != null) body.base_version = baseVersion;
            const result = await apiFetch('/elements/delete.php', {
              method: 'DELETE',
              signal: abortSignalAfter(ELEMENT_REQUEST_TIMEOUT_MS),
              body,
            });
            await dropCachedElement(id);
            return result;
          },
          () => offlineDeleteElement(id, baseVersion, clientMutationId)
        );
      },
    },
  },
  icons: {
    list: async () => {
      if (!isOnline()) {
        throw new ApiError('offline', 'A biblioteca de ícones requer conexão com a internet.', 0);
      }
      const data = await apiFetch('/icons/list.php', { method: 'GET' });
      return (data.icons ?? []).map((icon) => ({
        ...icon,
        url: resolveApiAssetUrl(icon.url),
      }));
    },
    create: async (file, { name, clientMutationId } = {}, mutationId = newMutationIdInternal()) => {
      if (!isOnline()) {
        throw new ApiError('offline', 'A biblioteca de ícones requer conexão com a internet.', 0);
      }
      const form = new FormData();
      form.append('file', file);
      if (name != null && String(name).trim() !== '') {
        form.append('name', String(name).trim());
      }
      form.append('client_mutation_id', clientMutationId ?? mutationId);
      const data = await apiFetch('/icons/upload.php', { method: 'POST', body: form });
      return data.icon;
    },
    remove: async (id) => {
      if (!isOnline()) {
        throw new ApiError('offline', 'A biblioteca de ícones requer conexão com a internet.', 0);
      }
      return apiFetch('/icons/remove.php', { method: 'POST', body: { id } });
    },
    url: (id) => resolveApiAssetUrl(`/php/icons/get.php?id=${encodeURIComponent(id)}`),
  },
  media: {
    listPhotos: async ({ page = 1, pageSize } = {}) => {
      const params = new URLSearchParams({ page: String(page) });
      if (pageSize != null) params.set('page_size', String(pageSize));
      const data = await apiFetch(`/photos/list.php?${params.toString()}`, { method: 'GET' });
      return {
        photos: data.photos ?? [],
        pagination: data.pagination ?? { page: 1, page_size: 50, total: 0, total_pages: 0 },
      };
    },
    upload: async (elementId, file, clientMutationId = newMutationIdInternal(), dependsOn = null) => {
      if (!isOnline()) {
        return offlineQueuePhotoUpload(elementId, file, dependsOn, clientMutationId);
      }
      const form = new FormData();
      form.append('element_id', elementId);
      form.append('client_mutation_id', clientMutationId);
      form.append('file', file);
      const data = await apiFetch('/photos/upload.php', { method: 'POST', body: form });
      return data.photo;
    },
    delete: async (photoId, baseVersion, clientMutationId = newMutationIdInternal()) => {
      const body = { id: photoId, client_mutation_id: clientMutationId };
      if (baseVersion != null) body.base_version = baseVersion;
      return apiFetch('/photos/delete.php', { method: 'DELETE', body });
    },
    url: (photoId) => resolveApiAssetUrl(`${API_BASE_URL}/photos/get.php?id=${encodeURIComponent(photoId)}`),
    listVideos: async ({ page = 1, pageSize } = {}) => {
      const params = new URLSearchParams({ page: String(page) });
      if (pageSize != null) params.set('page_size', String(pageSize));
      const data = await apiFetch(`/videos/list.php?${params.toString()}`, { method: 'GET' });
      return {
        videos: data.videos ?? [],
        pagination: data.pagination ?? { page: 1, page_size: 50, total: 0, total_pages: 0 },
      };
    },
    uploadVideo: async (elementId, file, clientMutationId = newMutationIdInternal()) => {
      if (!isOnline()) {
        throw new ApiError('offline', 'O envio de vídeos requer conexão com a internet.', 0);
      }
      const form = new FormData();
      form.append('element_id', elementId);
      form.append('client_mutation_id', clientMutationId);
      form.append('file', file);
      const data = await apiFetch('/videos/upload.php', { method: 'POST', body: form });
      return data.video;
    },
    deleteVideo: async (videoId, baseVersion, clientMutationId = newMutationIdInternal()) => {
      const body = { id: videoId, client_mutation_id: clientMutationId };
      if (baseVersion != null) body.base_version = baseVersion;
      return apiFetch('/videos/delete.php', { method: 'DELETE', body });
    },
    videoUrl: (videoId) => resolveApiAssetUrl(`${API_BASE_URL}/videos/get.php?id=${encodeURIComponent(videoId)}`),
  },
  sync: {
    push: async (mutations, options = {}) => {
      const photoStore = options.photoBlobs;
      const results = [];
      const pushMutations = [];

      for (const mutation of mutations) {
        if (mutation.resource_type === 'photo' && mutation.op === 'create') {
          try {
            results.push(await syncUploadOfflinePhoto(mutation, photoStore));
          } catch (err) {
            const code = err instanceof ApiError ? err.code : 'unknown_error';
            const message = err instanceof ApiError ? err.message : 'Photo upload failed.';
            results.push({
              client_mutation_id: mutation.client_mutation_id,
              status: 'failed',
              error: { code, message },
            });
          }
          if (options.onItemProgress) {
            options.onItemProgress();
          }
          continue;
        }
        pushMutations.push(mutation);
      }

      if (pushMutations.length > 0) {
        const data = await apiFetch('/sync/push.php', {
          method: 'POST',
          body: { mutations: pushMutations },
        });
        results.push(...(data.results ?? []));
        if (options.onItemProgress) {
          for (const _ of data.results ?? []) {
            options.onItemProgress();
          }
        }
      }

      return {
        success: true,
        results,
        progress: { completed: results.length, total: mutations.length },
      };
    },
    resolveConflict: async (clientMutationId, choice, baseVersion, mutation = {}) => {
      return apiFetch('/sync/resolve.php', {
        method: 'POST',
        body: {
          client_mutation_id: clientMutationId,
          choice,
          base_version: baseVersion,
          mutation,
        },
      });
    },
  },
  offline: {
    setUserId: setOfflineUserId,
    listPreparedMaps: offlineListMaps,
    reduceConflicts,
    cacheMap: cacheMapForOffline,
  },
  public: {
    listMaps: async ({ q, page, pageSize } = {}) => {
      const params = new URLSearchParams();
      if (q != null && q !== '') params.set('q', q);
      if (page) params.set('page', String(page));
      if (pageSize) params.set('page_size', String(pageSize));
      const qs = params.toString();
      return apiFetch(`/public/maps.php${qs ? `?${qs}` : ''}`, { method: 'GET' });
    },
    getMap: async (publicId) => {
      const data = await apiFetch(
        `/public/map.php?public_id=${encodeURIComponent(publicId)}`,
        { method: 'GET' }
      );
      return data.map;
    },
    listElements: async (publicId, { page, pageSize } = {}) => {
      const safeNormalize = (el) => {
        const normalized = normalizeElement(el);
        delete normalized.map_id;
        delete normalized.author_id;
        return normalized;
      };
      if (page || pageSize) {
        const params = new URLSearchParams({ public_id: publicId });
        if (page) params.set('page', String(page));
        if (pageSize) params.set('page_size', String(pageSize));
        const data = await apiFetch(`/public/elements.php?${params}`, { method: 'GET' });
        return {
          elements: (data.elements ?? []).map(safeNormalize),
          pagination: data.pagination,
        };
      }
      const elements = await fetchAllPaginated(
        (pageNum) => {
          const params = new URLSearchParams({
            public_id: publicId,
            page: String(pageNum),
            page_size: String(GIS_ELEMENT_PAGE_SIZE),
          });
          return `/public/elements.php?${params}`;
        },
        (data) => (data.elements ?? []).map(safeNormalize)
      );
      return { elements, pagination: { page: 1, page_size: elements.length, total: elements.length, total_pages: 1 } };
    },
    getPhoto: (photoId) =>
      resolveApiAssetUrl(`${API_BASE_URL}/public/photo.php?id=${encodeURIComponent(photoId)}`),
  },
  admin: {
    listUsers: async ({ q, page, pageSize } = {}) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (page) params.set('page', String(page));
      if (pageSize) params.set('page_size', String(pageSize));
      const qs = params.toString();
      return apiFetch(`/admin/users.php${qs ? `?${qs}` : ''}`, { method: 'GET' });
    },
    setUserStatus: async (userId, status, reason) =>
      apiFetch('/admin/user_status.php', {
        method: 'POST',
        body: { user_id: userId, status, reason },
      }),
    moderateMap: async (mapId, reason) =>
      apiFetch('/admin/moderate_map.php', {
        method: 'POST',
        body: { map_id: mapId, reason },
      }),
    getPrivateMap: async (mapId, reason) =>
      apiFetch('/admin/private_access.php', {
        method: 'POST',
        body: { map_id: mapId, reason },
      }),
    mutatePrivate: async (input, reason) =>
      apiFetch('/admin/private_mutate.php', {
        method: 'POST',
        body: { ...input, reason },
      }),
    listAudit: async ({ q, page, pageSize } = {}) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (page) params.set('page', String(page));
      if (pageSize) params.set('page_size', String(pageSize));
      const qs = params.toString();
      return apiFetch(`/admin/audit.php${qs ? `?${qs}` : ''}`, { method: 'GET' });
    },
  },
};
