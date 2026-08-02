import { openDB } from 'idb';

export const DB_NAME = 'reatcarto-offline';
export const DB_VERSION = 1;

export const OUTBOX_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed',
  CONFLICTED: 'conflicted',
};

/** @param {string} userId @param {string} suffix */
export function scopedKey(userId, suffix) {
  return `${userId}:${suffix}`;
}

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('prepared_maps')) {
          const maps = db.createObjectStore('prepared_maps', { keyPath: 'id' });
          maps.createIndex('by_user', 'userId');
        }
        if (!db.objectStoreNames.contains('elements')) {
          const els = db.createObjectStore('elements', { keyPath: 'id' });
          els.createIndex('by_map', ['userId', 'mapId']);
        }
        if (!db.objectStoreNames.contains('photos_meta')) {
          const photos = db.createObjectStore('photos_meta', { keyPath: 'id' });
          photos.createIndex('by_element', ['userId', 'elementId']);
        }
        if (!db.objectStoreNames.contains('photo_blobs')) {
          db.createObjectStore('photo_blobs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const outbox = db.createObjectStore('outbox', { keyPath: 'id' });
          outbox.createIndex('by_user_status', ['userId', 'status']);
          outbox.createIndex('by_mutation', ['userId', 'client_mutation_id']);
        }
        if (!db.objectStoreNames.contains('conflicts')) {
          db.createObjectStore('conflicts', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export class OfflineStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export class OfflineStore {
  /** @param {string} userId */
  constructor(userId) {
    this.userId = userId;
  }

  assertUser(expectedUserId) {
    if (expectedUserId !== this.userId) {
      throw new OfflineStoreError('cross_user', 'Cross-user cache access denied.');
    }
  }

  async bindAccount() {
    const db = await getDb();
    await db.put('meta', { key: 'currentUserId', value: this.userId });
  }

  async getBoundUserId() {
    const db = await getDb();
    const row = await db.get('meta', 'currentUserId');
    return row?.value ?? null;
  }

  async assertAccess() {
    const bound = await this.getBoundUserId();
    if (bound && bound !== this.userId) {
      throw new OfflineStoreError('cross_user', 'Cache belongs to another account.');
    }
  }

  /** @param {object} mutation */
  async enqueue(mutation) {
    await this.assertAccess();
    const clientMutationId = mutation.client_mutation_id;
    const id = scopedKey(this.userId, clientMutationId);
    const db = await getDb();
    const existing = await db.get('outbox', id);
    if (existing) {
      return existing;
    }
    const row = {
      id,
      userId: this.userId,
      client_mutation_id: clientMutationId,
      resource_type: mutation.resource_type,
      op: mutation.op,
      resource_id: mutation.resource_id ?? null,
      base_version: mutation.base_version ?? null,
      payload: mutation.payload ?? {},
      status: OUTBOX_STATUS.PENDING,
      depends_on: mutation.depends_on ?? null,
      created_at: mutation.created_at ?? new Date().toISOString(),
      error: null,
      corrupt: false,
    };
    await db.put('outbox', row);
    return row;
  }

  async getOutbox(statusFilter) {
    await this.assertAccess();
    const db = await getDb();
    const all = await db.getAllFromIndex('outbox', 'by_user_status', IDBKeyRange.only([this.userId, statusFilter]));
    if (statusFilter) {
      return all.filter((r) => r.status === statusFilter);
    }
    const rows = await db.getAllFromIndex('outbox', 'by_user_status');
    return rows.filter((r) => r.userId === this.userId);
  }

  async getAllOutbox() {
    await this.assertAccess();
    const db = await getDb();
    const all = await db.getAll('outbox');
    return all.filter((r) => r.userId === this.userId);
  }

  async getPendingOutbox() {
    const rows = await this.getAllOutbox();
    return rows.filter(
      (r) =>
        r.status === OUTBOX_STATUS.PENDING ||
        r.status === OUTBOX_STATUS.CONFLICTED ||
        r.status === OUTBOX_STATUS.FAILED
    );
  }

  async updateOutbox(clientMutationId, patch) {
    await this.assertAccess();
    const id = scopedKey(this.userId, clientMutationId);
    const db = await getDb();
    const row = await db.get('outbox', id);
    if (!row) return null;
    const updated = { ...row, ...patch };
    await db.put('outbox', updated);
    return updated;
  }

  async collapseOutboxForResource(resourceType, resourceId) {
    const rows = await this.getAllOutbox();
    const pending = rows.filter(
      (r) =>
        r.resource_type === resourceType &&
        r.resource_id === resourceId &&
        r.status === OUTBOX_STATUS.PENDING
    );
    if (pending.length <= 1) return pending[0] ?? null;
    pending.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const hasDelete = pending.some((r) => r.op === 'delete');
    const finalRow = hasDelete
      ? pending.find((r) => r.op === 'delete') ?? pending[pending.length - 1]
      : pending[pending.length - 1];
    const db = await getDb();
    for (const row of pending) {
      if (row.id !== finalRow.id) {
        await db.delete('outbox', row.id);
      }
    }
    if (finalRow.op === 'delete') {
      await db.put('outbox', { ...finalRow, payload: {} });
    }
    return finalRow;
  }

  async storeConflict(conflict) {
    const id = scopedKey(this.userId, conflict.client_mutation_id);
    const db = await getDb();
    await db.put('conflicts', {
      id,
      userId: this.userId,
      ...conflict,
    });
    await this.updateOutbox(conflict.client_mutation_id, { status: OUTBOX_STATUS.CONFLICTED });
  }

  async getConflicts() {
    await this.assertAccess();
    const db = await getDb();
    const all = await db.getAll('conflicts');
    return all.filter((c) => c.userId === this.userId);
  }

  async clearConflict(clientMutationId) {
    const db = await getDb();
    await db.delete('conflicts', scopedKey(this.userId, clientMutationId));
  }

  async prepareMap(map, elements = [], photosMeta = []) {
    await this.assertAccess();
    await this.bindAccount();
    const db = await getDb();
    const mapId = map.id;
    await db.put('prepared_maps', {
      id: scopedKey(this.userId, mapId),
      userId: this.userId,
      mapId,
      map,
      preparedAt: new Date().toISOString(),
      status: 'ready',
    });
    for (const element of elements) {
      await db.put('elements', {
        id: scopedKey(this.userId, element.id),
        userId: this.userId,
        mapId,
        element,
      });
    }
    for (const photo of photosMeta) {
      await db.put('photos_meta', {
        id: scopedKey(this.userId, photo.id),
        userId: this.userId,
        elementId: photo.element_id ?? photo.elementId,
        photo,
      });
    }
  }

  async getPreparedMaps() {
    await this.assertAccess();
    const db = await getDb();
    const all = await db.getAllFromIndex('prepared_maps', 'by_user', this.userId);
    return all;
  }

  async isMapPrepared(mapId) {
    const db = await getDb();
    const row = await db.get('prepared_maps', scopedKey(this.userId, mapId));
    return row?.status === 'ready';
  }

  async getMap(mapId) {
    await this.assertAccess();
    const db = await getDb();
    const row = await db.get('prepared_maps', scopedKey(this.userId, mapId));
    if (!row) return null;
    if (row.status === 'quarantined') {
      return { ...row.map, _quarantined: true };
    }
    return row.map;
  }

  async upsertPreparedMap(map) {
    await this.assertAccess();
    const db = await getDb();
    const mapId = map.id;
    const id = scopedKey(this.userId, mapId);
    const row = await db.get('prepared_maps', id);
    if (!row) return false;
    await db.put('prepared_maps', {
      ...row,
      map: { ...row.map, ...map },
    });
    return true;
  }

  async quarantineMap(mapId) {
    const db = await getDb();
    const id = scopedKey(this.userId, mapId);
    const row = await db.get('prepared_maps', id);
    if (row) {
      await db.put('prepared_maps', { ...row, status: 'quarantined' });
    }
  }

  async getElements(mapId) {
    await this.assertAccess();
    const db = await getDb();
    const rows = await db.getAllFromIndex('elements', 'by_map', [this.userId, mapId]);
    return rows.map((r) => r.element);
  }

  async upsertElement(mapId, element) {
    await this.assertAccess();
    const db = await getDb();
    await db.put('elements', {
      id: scopedKey(this.userId, element.id),
      userId: this.userId,
      mapId,
      element,
    });
  }

  async removeElement(elementId) {
    const db = await getDb();
    await db.delete('elements', scopedKey(this.userId, elementId));
  }

  async storePhotoBlob(clientMutationId, blob, contentType) {
    const db = await getDb();
    await db.put('photo_blobs', {
      id: scopedKey(this.userId, clientMutationId),
      userId: this.userId,
      blob,
      content_type: contentType,
    });
  }

  async getPhotoBlob(clientMutationId) {
    const db = await getDb();
    return db.get('photo_blobs', scopedKey(this.userId, clientMutationId));
  }

  async clearAccountData() {
    const db = await getDb();
    const stores = ['prepared_maps', 'elements', 'photos_meta', 'photo_blobs', 'outbox', 'conflicts'];
    for (const store of stores) {
      const all = await db.getAll(store);
      for (const row of all) {
        if (row.userId === this.userId) {
          await db.delete(store, row.id);
        }
      }
    }
    const bound = await this.getBoundUserId();
    if (bound === this.userId) {
      await db.delete('meta', 'currentUserId');
    }
  }

  async estimatePrepareSize(map, elements) {
    const json = JSON.stringify({ map, elements });
    return new Blob([json]).size;
  }

  async checkQuota(requiredBytes) {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (est?.quota && est.usage != null && est.usage + requiredBytes > est.quota) {
        return { ok: false, reason: 'quota_exceeded' };
      }
    }
    return { ok: true };
  }
}

export async function resetOfflineDbForTests() {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      /* ignore */
    }
  }
  dbPromise = null;
  if (typeof indexedDB !== 'undefined') {
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  }
}
