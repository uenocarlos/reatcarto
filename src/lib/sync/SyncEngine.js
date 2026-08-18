import { OUTBOX_STATUS, OfflineStore } from '@/lib/offline/OfflineStore';
import { isOnline } from '@/lib/offline/connectivity';
import { mergeElementForSync, parseStyleValue } from '@/lib/offline/outboxMerge';

/**
 * @param {object} errorPayload - 409 conflict body from api
 * @param {string} clientMutationId
 * @returns {object}
 */
export function reduceConflicts(errorPayload, clientMutationId) {
  const err = errorPayload?.error ?? errorPayload;
  return {
    client_mutation_id: clientMutationId,
    local_snapshot: err.local_snapshot ?? errorPayload.local_snapshot ?? {},
    remote_snapshot: err.remote_snapshot ?? errorPayload.remote_snapshot ?? {},
    kind: err.kind ?? errorPayload.kind ?? 'update_update',
    status: OUTBOX_STATUS.CONFLICTED,
  };
}

export class SyncEngine {
  /** @param {string} userId @param {object} apiClient */
  constructor(userId, apiClient) {
    this.userId = userId;
    this.api = apiClient;
    this.store = new OfflineStore(userId);
    this._flushing = false;
    this._progress = { completed: 0, total: 0 };
    this._listeners = new Set();
  }

  onProgress(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  _emitProgress() {
    for (const cb of this._listeners) {
      cb({ ...this._progress });
    }
  }

  getProgress() {
    return { ...this._progress };
  }

  isFlushing() {
    return this._flushing;
  }

  async getReadyMutations() {
    const pending = await this.store.getAllOutbox();
    const ready = [];
    const syncedIds = new Set(
      pending.filter((r) => r.status === OUTBOX_STATUS.SYNCED).map((r) => r.client_mutation_id)
    );
    for (const row of pending.filter((r) => r.status === OUTBOX_STATUS.PENDING)) {
      if (row.depends_on && !syncedIds.has(row.depends_on)) {
        const dep = pending.find((r) => r.client_mutation_id === row.depends_on);
        if (dep && dep.status !== OUTBOX_STATUS.SYNCED) {
          continue;
        }
      }
      ready.push(row);
    }
    return ready;
  }

  async flush(options = {}) {
    if (this._flushing && !options.force) {
      return { upToDate: false, inProgress: true };
    }
    if (!isOnline()) {
      return { upToDate: false, offline: true };
    }

    const MAX_PASSES = 8;
    let passCount = 0;
    const aggregatedResults = [];
    let anySyncedThisPass = true;
    let upToDate = false;
    let waiting = false;

    this._flushing = true;
    try {
      const initialPending = await this.store.getPendingOutbox();
      if (initialPending.length === 0) {
        this._flushing = false;
        return { upToDate: true, results: [] };
      }
      this._progress = { completed: 0, total: initialPending.length };
      this._emitProgress();

      while (passCount < MAX_PASSES && anySyncedThisPass) {
        passCount += 1;
        anySyncedThisPass = false;
        waiting = false;

        const pending = await this.store.getPendingOutbox();
        if (pending.length === 0) {
          upToDate = true;
          break;
        }

        const collapsed = new Set();
        for (const row of pending) {
          if (!row.resource_type || row.resource_id == null) continue;
          const key = `${row.resource_type}\0${row.resource_id}`;
          if (collapsed.has(key)) continue;
          collapsed.add(key);
          await this.store.collapseOutboxForResource(row.resource_type, row.resource_id);
        }

        const ready = await this.getReadyMutations();
        const mutations = [];
        for (const row of ready) {
          let payload = row.payload ?? {};
          if (row.resource_type === 'element' && row.op !== 'delete' && row.resource_id != null) {
            const local = await this.store.getElementById(row.resource_id);
            if (local) {
              payload = mergeElementForSync(local, payload);
            }
          }
          mutations.push({
            client_mutation_id: row.client_mutation_id,
            resource_type: row.resource_type,
            op: row.op,
            resource_id: row.resource_id,
            base_version: row.base_version,
            depends_on: row.depends_on ?? null,
            payload,
          });
        }

        if (mutations.length === 0) {
          waiting = true;
          break;
        }

        const batchResult = await this.api.sync.push(mutations, {
          photoBlobs: this.store,
          onItemProgress: () => {
            this._progress.completed += 1;
            this._emitProgress();
          },
        });

        for (const item of batchResult.results ?? []) {
          aggregatedResults.push(item);
          if (item.status === 'synced') {
            anySyncedThisPass = true;
            await this.store.updateOutbox(item.client_mutation_id, {
              status: OUTBOX_STATUS.SYNCED,
              error: null,
            });
            if (item.resource) {
              await this._applyResource(item);
            }
          } else if (item.status === 'conflict') {
            await this.store.storeConflict({
              client_mutation_id: item.client_mutation_id,
              local_snapshot: item.conflict?.local_snapshot ?? item.local_snapshot,
              remote_snapshot: item.conflict?.remote_snapshot ?? item.remote_snapshot,
              kind: item.conflict?.kind ?? item.kind ?? 'update_update',
            });
          } else if (item.status === 'failed') {
            await this.store.updateOutbox(item.client_mutation_id, {
              status: OUTBOX_STATUS.FAILED,
              error: item.error ?? { message: 'Sync failed' },
            });
          }
        }
      }

      if (!waiting) {
        const remaining = await this.store.getPendingOutbox();
        upToDate = remaining.length === 0;
      }

      const result = { upToDate, results: aggregatedResults };
      if (waiting) result.waiting = true;
      if (passCount >= MAX_PASSES && !upToDate) result.iterationCapReached = true;
      return result;
    } finally {
      this._flushing = false;
    }
  }

  async _applyResource(item) {
    const { resource_type: type, resource, client_mutation_id: clientMutationId } = item;
    if (!resource) return;
    if (type === 'map') {
      await this.store.prepareMap(resource, await this.store.getElements(resource.id));
    } else if (type === 'element') {
      const rows = await this.store.getAllOutbox();
      const outboxRow = clientMutationId
        ? rows.find((r) => r.client_mutation_id === clientMutationId)
        : null;
      const localId =
        outboxRow?.op === 'create' && outboxRow.resource_id ? outboxRow.resource_id : null;

      const local = await this.store.getElementById(localId || resource.id);
      const localStyle = parseStyleValue(local?.style) ?? {};
      const remoteStyle = parseStyleValue(resource.style) ?? {};
      const style =
        Object.keys(localStyle).length > 0
          ? { ...remoteStyle, ...localStyle }
          : remoteStyle;
      await this.store.upsertElement(resource.map_id, {
        ...local,
        ...resource,
        style,
        _pending: false,
      });

      if (localId && localId !== resource.id) {
        await this.store.removeElement(localId);
        for (const row of rows) {
          const eligible =
            row.status === OUTBOX_STATUS.PENDING ||
            row.status === OUTBOX_STATUS.FAILED ||
            row.status === OUTBOX_STATUS.CONFLICTED;
          if (!eligible) continue;
          const usesLocalId =
            row.payload?.element_id === localId ||
            (row.resource_type === 'element' && row.resource_id === localId);
          if (!usesLocalId) continue;
          const patch = { payload: { ...row.payload, element_id: resource.id } };
          if (row.resource_id === localId) {
            patch.resource_id = resource.id;
          }
          await this.store.updateOutbox(row.client_mutation_id, patch);
        }
      }
    }
  }

  async _buildResolveMutation(clientMutationId, choice) {
    const outboxRow = (await this.store.getAllOutbox()).find(
      (r) => r.client_mutation_id === clientMutationId
    );
    const mutation = outboxRow
      ? {
          resource_type: outboxRow.resource_type,
          op: outboxRow.op,
          resource_id: outboxRow.resource_id,
          payload: outboxRow.payload ?? {},
        }
      : { payload: {} };

    if (choice === 'local') {
      const conflict = (await this.store.getConflicts()).find(
        (c) => c.client_mutation_id === clientMutationId
      );
      const localSnapshot = conflict?.local_snapshot;
      if (localSnapshot && typeof localSnapshot === 'object') {
        const hasPayload =
          mutation.payload &&
          typeof mutation.payload === 'object' &&
          Object.keys(mutation.payload).length > 0;
        mutation.payload = hasPayload
          ? { ...localSnapshot, ...mutation.payload }
          : { ...localSnapshot };
      }
    }

    return mutation;
  }

  async resolveConflict(clientMutationId, choice, baseVersion) {
    const mutation = await this._buildResolveMutation(clientMutationId, choice);
    const result = await this.api.sync.resolveConflict(
      clientMutationId,
      choice,
      baseVersion,
      mutation
    );
    await this.store.updateOutbox(clientMutationId, { status: OUTBOX_STATUS.SYNCED, error: null });
    await this.store.clearConflict(clientMutationId);
    if (result.resource) {
      await this._applyResource({
        resource_type: result.resource_type,
        resource: result.resource,
        client_mutation_id: clientMutationId,
      });
    }
    return result;
  }

  async checkRemoteDeletes(fetchMapFn) {
    const prepared = await this.store.getPreparedMaps();
    for (const entry of prepared) {
      if (entry.status !== 'ready') continue;
      try {
        if (!isOnline()) break;
        await fetchMapFn(entry.mapId);
      } catch (err) {
        if (err?.status === 404 || err?.code === 'not_found') {
          await this.store.quarantineMap(entry.mapId);
        }
      }
    }
  }
}
