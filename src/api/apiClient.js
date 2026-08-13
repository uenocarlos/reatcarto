import { apiFetch, API_BASE_URL, ApiError } from './http';
import { isOnline } from '@/lib/offline/connectivity';
import {
  setOfflineUserId,
  prepareOfflineMap,
  offlineListMaps,
  offlineGetMap,
  offlineCreateElement,
  offlineUpdateElement,
  offlineDeleteElement,
  offlineQueuePhotoUpload,
  newMutationId,
  storeForUser,
} from '@/lib/offline/offlineApi';
import { reduceConflicts } from '@/lib/sync/SyncEngine';

function newMutationIdInternal() {
  return newMutationId();
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
  const style =
    typeof element.style === 'string' ? element.style : JSON.stringify(element.style ?? {});
  const geojson =
    typeof element.geojson === 'string' ? element.geojson : JSON.stringify(element.geojson ?? {});
  const photos = element.photos ?? [];
  const videos = element.videos ?? [];
  return {
    ...element,
    style,
    geojson,
    is_publicly_visible: element.is_publicly_visible !== false && element.is_publicly_visible !== 0,
    photo_urls: photos.map((p) => p.url || `/php/photos/get.php?id=${encodeURIComponent(p.id)}`),
    photos,
    video_urls: videos.map((v) => v.url || `/php/videos/get.php?id=${encodeURIComponent(v.id)}`),
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
        if (!isOnline()) {
          const maps = (await offlineListMaps()).map(normalizeMap);
          if (sort === '-created_date') {
            maps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          }
          return maps;
        }
        const params = new URLSearchParams();
        if (options.q) params.set('q', options.q);
        if (options.page) params.set('page', String(options.page));
        if (options.pageSize) params.set('page_size', String(options.pageSize));
        const qs = params.toString();
        const data = await apiFetch(`/maps/list.php${qs ? `?${qs}` : ''}`, { method: 'GET' });
        const maps = (data.maps ?? []).map(normalizeMap);
        if (sort === '-created_date') {
          maps.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        return maps;
      },
      filter: async ({ id }) => {
        if (!isOnline()) {
          const offline = await offlineGetMap(id);
          if (offline.unavailable) {
            const err = new Error('Map not available offline.');
            err.code = 'offline_unavailable';
            throw err;
          }
          return [normalizeMap(offline.map)];
        }
        const data = await apiFetch(`/maps/get.php?id=${encodeURIComponent(id)}`, { method: 'GET' });
        return [normalizeMap(data.map)];
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
        if (!isOnline()) {
          const offline = await offlineGetMap(map_id);
          if (offline.unavailable) {
            const err = new Error('Map not available offline.');
            err.code = 'offline_unavailable';
            throw err;
          }
          return offline.elements ?? [];
        }
        const params = new URLSearchParams({ map_id });
        if (page) params.set('page', String(page));
        if (pageSize) params.set('page_size', String(pageSize));
        const data = await apiFetch(`/elements/list.php?${params}`, { method: 'GET' });
        return (data.elements ?? []).map(normalizeElement);
      },
      create: async (payload, clientMutationId = newMutationIdInternal()) => {
        if (!isOnline()) {
          const created = await offlineCreateElement(payload, clientMutationId);
          return normalizeElement(created);
        }
        const style =
          typeof payload.style === 'string' ? payload.style : JSON.stringify(payload.style ?? {});
        const geojson =
          typeof payload.geojson === 'string' ? payload.geojson : JSON.stringify(payload.geojson);
        const data = await apiFetch('/elements/create.php', {
          method: 'POST',
          body: {
            ...payload,
            name: payload.name?.trim() ? payload.name : 'Element',
            style,
            geojson,
            client_mutation_id: clientMutationId,
          },
        });
        return normalizeElement(data.element);
      },
      update: async (id, payload, clientMutationId = newMutationIdInternal()) => {
        if (!isOnline()) {
          const updated = await offlineUpdateElement(id, payload, clientMutationId);
          return normalizeElement(updated);
        }
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
            } else {
              body[key] = payload[key];
            }
          }
        }
        const data = await apiFetch('/elements/update.php', { method: 'PATCH', body });
        return normalizeElement(data.element);
      },
      delete: async (id, baseVersion, clientMutationId = newMutationIdInternal()) => {
        if (!isOnline()) {
          return offlineDeleteElement(id, baseVersion, clientMutationId);
        }
        const body = { id, client_mutation_id: clientMutationId };
        if (baseVersion != null) body.base_version = baseVersion;
        return apiFetch('/elements/delete.php', { method: 'DELETE', body });
      },
    },
  },
  icons: {
    list: async () => {
      if (!isOnline()) {
        throw new ApiError('offline', 'A biblioteca de ícones requer conexão com a internet.', 0);
      }
      const data = await apiFetch('/icons/list.php', { method: 'GET' });
      return data.icons ?? [];
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
    url: (id) => `/php/icons/get.php?id=${encodeURIComponent(id)}`,
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
    url: (photoId) => `${API_BASE_URL}/photos/get.php?id=${encodeURIComponent(photoId)}`,
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
    videoUrl: (videoId) => `${API_BASE_URL}/videos/get.php?id=${encodeURIComponent(videoId)}`,
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
      const params = new URLSearchParams({ public_id: publicId });
      if (page) params.set('page', String(page));
      if (pageSize) params.set('page_size', String(pageSize));
      const data = await apiFetch(`/public/elements.php?${params}`, { method: 'GET' });
      const safeNormalize = (el) => {
        const normalized = normalizeElement(el);
        delete normalized.map_id;
        delete normalized.author_id;
        return normalized;
      };
      return {
        elements: (data.elements ?? []).map(safeNormalize),
        pagination: data.pagination,
      };
    },
    getPhoto: (photoId) =>
      `${API_BASE_URL}/public/photo.php?id=${encodeURIComponent(photoId)}`,
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
