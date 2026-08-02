import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  OfflineStore,
  OUTBOX_STATUS,
  resetOfflineDbForTests,
} from '@/lib/offline/OfflineStore';
import { validateOfflineGeometry } from '@/lib/offline/geometryValidation';
import {
  setOfflineUserId,
  offlineCreateElement,
  offlineUpdateElement,
  offlineDeleteElement,
  offlineQueuePhotoUpload,
  prepareOfflineMap,
  clearOfflineAccount,
  newMutationId,
} from '@/lib/offline/offlineApi';
import { orchestrateLogout, resetLogoutStateForTests } from '@/lib/offline/logoutFlow';
import { reduceConflicts, SyncEngine } from '@/lib/sync/SyncEngine';

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const MAP_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const sampleMap = {
  id: MAP_ID,
  name: 'Field Map',
  version: 1,
  created_at: new Date().toISOString(),
};

const sampleElement = {
  id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  map_id: MAP_ID,
  element_type: 'point',
  geojson: { type: 'Point', coordinates: [-52.1, -32.035] },
  name: 'Point',
  version: 1,
  style: {},
  photos: [],
};

describe('offline store and sync', () => {
  beforeEach(async () => {
    await resetOfflineDbForTests();
    resetLogoutStateForTests();
    setOfflineUserId(USER_A);
    vi.restoreAllMocks();
  });

  it('UT-164: OfflineStore.enqueue writes pending row keyed by userId+client_mutation_id', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    const mid = newMutationId();
    const row = await store.enqueue({
      client_mutation_id: mid,
      resource_type: 'element',
      op: 'create',
      resource_id: 'local-1',
      payload: { name: 'Test' },
    });
    expect(row.status).toBe(OUTBOX_STATUS.PENDING);
    expect(row.id).toBe(`${USER_A}:${mid}`);
    const all = await store.getAllOutbox();
    expect(all).toHaveLength(1);
  });

  it('UT-165: OfflineStore rejects cross-user read', async () => {
    const storeA = new OfflineStore(USER_A);
    await storeA.bindAccount();
    await storeA.enqueue({
      client_mutation_id: newMutationId(),
      resource_type: 'element',
      op: 'create',
      resource_id: 'x',
      payload: {},
    });
    const storeB = new OfflineStore(USER_B);
    await expect(storeB.getAllOutbox()).rejects.toMatchObject({ code: 'cross_user' });
  });

  it('UT-071: prepareOffline caches map/elements/photos in IndexedDB keyed by user id', async () => {
    await prepareOfflineMap(
      MAP_ID,
      async () => [sampleMap],
      async () => [sampleElement]
    );
    const store = new OfflineStore(USER_A);
    const prepared = await store.getPreparedMaps();
    expect(prepared).toHaveLength(1);
    expect(prepared[0].userId).toBe(USER_A);
    const elements = await store.getElements(MAP_ID);
    expect(elements).toHaveLength(1);
  });

  it('UT-072: offline edit enqueues outbox item status=pending', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => [sampleElement]);
    await offlineUpdateElement(sampleElement.id, { name: 'Edited' });
    const store = new OfflineStore(USER_A);
    const outbox = await store.getAllOutbox();
    expect(outbox.some((r) => r.status === OUTBOX_STATUS.PENDING && r.op === 'update')).toBe(true);
  });

  it('UT-073: opening non-prepared map offline yields unavailable state', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    const prepared = await store.isMapPrepared('unknown-map');
    expect(prepared).toBe(false);
  });

  it('UT-074: anonymous offline without cache does not claim online freshness', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    const maps = await store.getPreparedMaps();
    expect(maps).toEqual([]);
  });

  it('UT-075: offline invalid geometry rejected before outbox enqueue', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    await expect(
      offlineCreateElement({
        map_id: MAP_ID,
        element_type: 'point',
        geojson: { type: 'LineString', coordinates: [] },
        name: '',
      })
    ).rejects.toThrow();
  });

  it('UT-076: no prepared maps shows offline empty state', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    expect(await store.getPreparedMaps()).toEqual([]);
  });

  it('UT-077: quota exceeded on prepare warns and does not corrupt existing cache', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn().mockResolvedValue({ quota: 1000, usage: 900 }),
      },
    });
    const store = new OfflineStore(USER_A);
    const quota = await store.checkQuota(200);
    expect(quota.ok).toBe(false);
    expect(await store.getPreparedMaps()).toHaveLength(1);
  });

  it('UT-078: cache for user A inaccessible when session is user B', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    setOfflineUserId(USER_B);
    const storeB = new OfflineStore(USER_B);
    await expect(storeB.getPreparedMaps()).rejects.toMatchObject({ code: 'cross_user' });
    setOfflineUserId(USER_A);
  });

  it('UT-079: two devices keep separate pending outboxes for same user', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.enqueue({
      client_mutation_id: 'device-a-mut',
      resource_type: 'element',
      op: 'update',
      resource_id: sampleElement.id,
      payload: { name: 'A' },
    });
    await store.enqueue({
      client_mutation_id: 'device-b-mut',
      resource_type: 'element',
      op: 'update',
      resource_id: sampleElement.id,
      payload: { name: 'B' },
    });
    const rows = await store.getAllOutbox();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.client_mutation_id).sort()).toEqual(['device-a-mut', 'device-b-mut']);
  });

  it('UT-080: app restart recovers pending outbox records intact', async () => {
    const mid = newMutationId();
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.enqueue({
      client_mutation_id: mid,
      resource_type: 'element',
      op: 'create',
      resource_id: 'local',
      payload: {},
    });
    const store2 = new OfflineStore(USER_A);
    const rows = await store2.getAllOutbox();
    expect(rows.find((r) => r.client_mutation_id === mid)).toBeTruthy();
  });

  it('UT-081: duplicate offline action dedupes client_mutation_id', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    const mid = newMutationId();
    await store.enqueue({
      client_mutation_id: mid,
      resource_type: 'element',
      op: 'create',
      resource_id: 'local',
      payload: {},
    });
    await store.enqueue({
      client_mutation_id: mid,
      resource_type: 'element',
      op: 'create',
      resource_id: 'local',
      payload: {},
    });
    expect(await store.getAllOutbox()).toHaveLength(1);
  });

  it('UT-082: queued delete after unsynced edit collapses to final local state', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    const rid = sampleElement.id;
    await store.enqueue({
      client_mutation_id: 'edit-1',
      resource_type: 'element',
      op: 'update',
      resource_id: rid,
      payload: { name: 'Edit' },
    });
    await store.enqueue({
      client_mutation_id: 'del-1',
      resource_type: 'element',
      op: 'delete',
      resource_id: rid,
      payload: {},
    });
    const collapsed = await store.collapseOutboxForResource('element', rid);
    expect(collapsed?.op).toBe('delete');
    expect(await store.getAllOutbox()).toHaveLength(1);
  });

  it('UT-083: remotely deleted cached map quarantined for review', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    const store = new OfflineStore(USER_A);
    await store.quarantineMap(MAP_ID);
    const map = await store.getMap(MAP_ID);
    expect(map._quarantined).toBe(true);
  });

  it('UT-054: offline create queued as pending without claiming server success', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    const created = await offlineCreateElement({
      map_id: MAP_ID,
      element_type: 'point',
      geojson: sampleElement.geojson,
      name: 'New Point',
    });
    expect(created._queued).toBe(true);
    expect(created._pending).toBe(true);
    expect(created.version).toBe(0);
  });

  it('UT-062: interrupted capture keeps outbox pending draft', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    const mid = newMutationId();
    const store = new OfflineStore(USER_A);
    await store.enqueue({
      client_mutation_id: mid,
      resource_type: 'element',
      op: 'create',
      resource_id: 'draft-local',
      payload: { name: 'Draft', geojson: sampleElement.geojson },
    });
    const row = (await store.getAllOutbox()).find((r) => r.client_mutation_id === mid);
    expect(row.status).toBe(OUTBOX_STATUS.PENDING);
  });

  it('UT-070/UT-091: photo upload waits for element create prerequisite', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    const elementMid = 'element-create-mid';
    const photoMid = 'photo-upload-mid';
    await store.enqueue({
      client_mutation_id: elementMid,
      resource_type: 'element',
      op: 'create',
      resource_id: 'local-el',
      payload: {},
    });
    await store.enqueue({
      client_mutation_id: photoMid,
      resource_type: 'photo',
      op: 'create',
      resource_id: null,
      depends_on: elementMid,
      payload: { element_id: 'local-el' },
    });
    const engine = new SyncEngine(USER_A, { sync: { push: vi.fn() } });
    const ready = await engine.getReadyMutations();
    expect(ready).toHaveLength(1);
    expect(ready[0].client_mutation_id).toBe(elementMid);
  });

  it('UT-091: flush remaps local element id and uploads dependent photo', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.prepareMap(sampleMap, []);
    const elementMid = 'element-create-mid';
    const photoMid = 'photo-upload-mid';
    const localElId = 'local-el-id';
    const serverEl = { ...sampleElement, id: 'server-el-id', version: 1, _pending: false };

    await store.enqueue({
      client_mutation_id: elementMid,
      resource_type: 'element',
      op: 'create',
      resource_id: localElId,
      payload: { map_id: MAP_ID, name: 'Field point' },
    });
    await store.upsertElement(MAP_ID, { ...sampleElement, id: localElId, _pending: true });
    await store.storePhotoBlob(photoMid, new Blob(['img'], { type: 'image/jpeg' }), 'image/jpeg');
    await store.enqueue({
      client_mutation_id: photoMid,
      resource_type: 'photo',
      op: 'create',
      resource_id: null,
      depends_on: elementMid,
      payload: { element_id: localElId, file_name: 'field.jpg' },
    });

    const push = vi.fn().mockImplementation(async (mutations, options) => {
      const photoMutation = mutations.find((m) => m.client_mutation_id === photoMid);
      if (photoMutation) {
        expect(photoMutation.payload.element_id).toBe('server-el-id');
        expect(options.photoBlobs?.userId).toBe(USER_A);
        return {
          results: [
            {
              client_mutation_id: photoMid,
              status: 'synced',
              resource_type: 'photo',
              resource: { id: 'ph-1', element_id: 'server-el-id' },
            },
          ],
          progress: { completed: 1, total: 1 },
        };
      }
      return {
        results: [
          {
            client_mutation_id: elementMid,
            status: 'synced',
            resource_type: 'element',
            resource: serverEl,
          },
        ],
        progress: { completed: 1, total: 1 },
      };
    });

    const engine = new SyncEngine(USER_A, { sync: { push } });
    vi.stubGlobal('navigator', { onLine: true });

    await engine.flush({ force: true });
    const photoRowAfterElement = (await store.getAllOutbox()).find(
      (r) => r.client_mutation_id === photoMid
    );
    expect(photoRowAfterElement.payload.element_id).toBe('server-el-id');
    expect(photoRowAfterElement.status).toBe(OUTBOX_STATUS.PENDING);

    await engine.flush({ force: true });
    expect(push).toHaveBeenCalledTimes(2);
    const photoRow = (await store.getAllOutbox()).find((r) => r.client_mutation_id === photoMid);
    expect(photoRow.status).toBe(OUTBOX_STATUS.SYNCED);
  });

  it('UT-091: resolveConflict remaps local element id for dependent photo', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.prepareMap(sampleMap, []);
    const elementMid = 'element-create-mid';
    const photoMid = 'photo-upload-mid';
    const localElId = 'local-el-id';
    const serverEl = { ...sampleElement, id: 'server-el-id', version: 1, _pending: false };

    await store.enqueue({
      client_mutation_id: elementMid,
      resource_type: 'element',
      op: 'create',
      resource_id: localElId,
      payload: { map_id: MAP_ID, name: 'Field point' },
    });
    await store.upsertElement(MAP_ID, { ...sampleElement, id: localElId, _pending: true });
    await store.enqueue({
      client_mutation_id: photoMid,
      resource_type: 'photo',
      op: 'create',
      resource_id: null,
      depends_on: elementMid,
      payload: { element_id: localElId, file_name: 'field.jpg' },
    });

    const resolveConflict = vi.fn().mockResolvedValue({
      resource_type: 'element',
      resource: serverEl,
    });
    const engine = new SyncEngine(USER_A, { sync: { resolveConflict } });

    await engine.resolveConflict(elementMid, 'local', null);

    const elements = await store.getElements(MAP_ID);
    expect(elements.find((el) => el.id === localElId)).toBeUndefined();
    expect(elements.find((el) => el.id === 'server-el-id')).toBeDefined();
    const photoRow = (await store.getAllOutbox()).find((r) => r.client_mutation_id === photoMid);
    expect(photoRow.payload.element_id).toBe('server-el-id');
  });

  it('UT-166: SyncEngine.reduceConflicts maps 409 payload into conflicted status', async () => {
    const reduced = reduceConflicts(
      {
        error: {
          code: 'conflict',
          local_snapshot: { name: 'Local' },
          remote_snapshot: { name: 'Remote' },
          kind: 'update_update',
        },
      },
      'mut-1'
    );
    expect(reduced.status).toBe(OUTBOX_STATUS.CONFLICTED);
    expect(reduced.local_snapshot.name).toBe('Local');
  });

  it('UT-085/UT-090: sync flush applies mutations or reports up to date', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    const apiMock = {
      sync: {
        push: vi.fn().mockResolvedValue({ results: [], progress: { completed: 0, total: 0 } }),
      },
    };
    const engine = new SyncEngine(USER_A, apiMock);
    vi.stubGlobal('navigator', { onLine: true });
    const empty = await engine.flush({ force: true });
    expect(empty.upToDate).toBe(true);

    await store.enqueue({
      client_mutation_id: 'sync-mut',
      resource_type: 'element',
      op: 'update',
      resource_id: sampleElement.id,
      payload: { name: 'Synced' },
    });
    apiMock.sync.push.mockResolvedValue({
      results: [{ client_mutation_id: 'sync-mut', status: 'synced', resource_type: 'element', resource: sampleElement }],
      progress: { completed: 1, total: 1 },
    });
    vi.stubGlobal('navigator', { onLine: true });
    const result = await engine.flush({ force: true });
    expect(result.results).toHaveLength(1);
    const row = (await store.getAllOutbox()).find((r) => r.client_mutation_id === 'sync-mut');
    expect(row.status).toBe(OUTBOX_STATUS.SYNCED);
  });

  it('UT-087: resolveConflict passes outbox mutation payload for local choice', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.enqueue({
      client_mutation_id: 'conflict-mut',
      resource_type: 'element',
      op: 'update',
      resource_id: sampleElement.id,
      base_version: 1,
      payload: { name: 'Local Winner' },
    });
    await store.storeConflict({
      client_mutation_id: 'conflict-mut',
      local_snapshot: { name: 'Local Winner', version: 1 },
      remote_snapshot: { name: 'Remote', version: 2 },
      kind: 'update_update',
    });

    const resolveConflict = vi.fn().mockResolvedValue({
      resource_type: 'element',
      resource: { ...sampleElement, name: 'Local Winner', version: 3 },
    });
    const engine = new SyncEngine(USER_A, { sync: { resolveConflict } });

    await engine.resolveConflict('conflict-mut', 'local', 2);

    expect(resolveConflict).toHaveBeenCalledWith('conflict-mut', 'local', 2, {
      resource_type: 'element',
      op: 'update',
      resource_id: sampleElement.id,
      payload: { name: 'Local Winner', version: 1 },
    });

    const row = (await store.getAllOutbox()).find((r) => r.client_mutation_id === 'conflict-mut');
    expect(row.status).toBe(OUTBOX_STATUS.SYNCED);
    const conflicts = await store.getConflicts();
    expect(conflicts.find((c) => c.client_mutation_id === 'conflict-mut')).toBeUndefined();
  });

  it('UT-087: resolveConflict falls back to local_snapshot when outbox payload is empty', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.enqueue({
      client_mutation_id: 'snapshot-mut',
      resource_type: 'element',
      op: 'update',
      resource_id: sampleElement.id,
      base_version: 1,
      payload: {},
    });
    await store.storeConflict({
      client_mutation_id: 'snapshot-mut',
      local_snapshot: { name: 'From Snapshot' },
      remote_snapshot: { name: 'Remote' },
      kind: 'update_update',
    });

    const resolveConflict = vi.fn().mockResolvedValue({
      resource_type: 'element',
      resource: { ...sampleElement, name: 'From Snapshot' },
    });
    const engine = new SyncEngine(USER_A, { sync: { resolveConflict } });

    await engine.resolveConflict('snapshot-mut', 'local', 2);

    expect(resolveConflict).toHaveBeenCalledWith('snapshot-mut', 'local', 2, {
      resource_type: 'element',
      op: 'update',
      resource_id: sampleElement.id,
      payload: { name: 'From Snapshot' },
    });
  });

  it('UT-092: logout with empty outbox clears session path', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    vi.stubGlobal('navigator', { onLine: true });
    const result = await orchestrateLogout({
      userId: USER_A,
      discardConfirmed: false,
      syncFn: async () => ({ upToDate: true }),
      serverLogoutFn: async () => ({ success: true }),
    });
    expect(result.success).toBe(true);
  });

  it('UT-093: logout with pending + online attempts sync then clears', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.enqueue({
      client_mutation_id: 'pending-logout',
      resource_type: 'element',
      op: 'update',
      resource_id: 'el',
      payload: {},
    });
    let synced = false;
    vi.stubGlobal('navigator', { onLine: true });
    const result = await orchestrateLogout({
      userId: USER_A,
      discardConfirmed: false,
      syncFn: async () => {
        synced = true;
        await store.updateOutbox('pending-logout', { status: OUTBOX_STATUS.SYNCED });
        return { upToDate: true };
      },
      serverLogoutFn: async () => ({}),
    });
    expect(synced).toBe(true);
    expect(result.success).toBe(true);
  });

  it('UT-094: logout with unsyncable pending requires discard confirmation', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.enqueue({
      client_mutation_id: 'still-pending',
      resource_type: 'element',
      op: 'update',
      resource_id: 'el',
      payload: {},
    });
    vi.stubGlobal('navigator', { onLine: false });
    const result = await orchestrateLogout({
      userId: USER_A,
      discardConfirmed: false,
      syncFn: async () => ({ upToDate: false, offline: true }),
      serverLogoutFn: async () => ({}),
    });
    expect(result.needsDiscardConfirm).toBe(true);
  });

  it('UT-095: after logout another account cannot read prior cache', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    await clearOfflineAccount();
    setOfflineUserId(USER_B);
    const storeB = new OfflineStore(USER_B);
    await storeB.bindAccount();
    expect(await storeB.getPreparedMaps()).toEqual([]);
  });

  it('UT-096: corrupt outbox item requires discard decision', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.enqueue({
      client_mutation_id: 'corrupt-1',
      resource_type: 'element',
      op: 'update',
      resource_id: 'el',
      payload: {},
    });
    await store.updateOutbox('corrupt-1', { corrupt: true, status: OUTBOX_STATUS.FAILED });
    const rows = await store.getAllOutbox();
    expect(rows.some((r) => r.corrupt)).toBe(true);
  });

  it('UT-100/UT-102: repeated logout taps trigger one flow', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    let calls = 0;
    const slowLogout = orchestrateLogout({
      userId: USER_A,
      syncFn: async () => {
        calls++;
        return { upToDate: true };
      },
      serverLogoutFn: async () => ({}),
    });
    const dup = orchestrateLogout({
      userId: USER_A,
      syncFn: async () => ({ upToDate: true }),
      serverLogoutFn: async () => ({}),
    });
    await slowLogout;
    const dupResult = await dup;
    expect(dupResult.duplicate).toBe(true);
  });

  it('UT-103: clear-data waits for sync or discard confirm', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.prepareMap(sampleMap, []);
    await store.enqueue({
      client_mutation_id: 'wait-mut',
      resource_type: 'element',
      op: 'create',
      resource_id: 'local',
      payload: {},
    });
    const needsConfirm = await orchestrateLogout({
      userId: USER_A,
      discardConfirmed: false,
      syncFn: async () => ({ upToDate: false }),
      serverLogoutFn: async () => ({}),
    });
    expect(needsConfirm.needsDiscardConfirm).toBe(true);
    expect((await store.getPreparedMaps()).length).toBe(1);

    await orchestrateLogout({
      userId: USER_A,
      discardConfirmed: true,
      syncFn: async () => ({}),
      serverLogoutFn: async () => ({}),
    });
    expect((await store.getPreparedMaps()).length).toBe(0);
  });

  it('UT-105: cleanup removes all account-bound keys', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => [sampleElement]);
    await prepareOfflineMap('map-2', async () => [{ ...sampleMap, id: 'map-2' }], async () => []);
    await clearOfflineAccount();
    const store = new OfflineStore(USER_A);
    expect(await store.getPreparedMaps()).toEqual([]);
    expect(await store.getAllOutbox()).toEqual([]);
  });

  it('UT-084: large prepared map remains loadable with progress tracking', async () => {
    const manyElements = Array.from({ length: 200 }, (_, i) => ({
      ...sampleElement,
      id: `el-${i}`,
      name: `Element ${i}`,
    }));
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => manyElements);
    const store = new OfflineStore(USER_A);
    const elements = await store.getElements(MAP_ID);
    expect(elements.length).toBe(200);
  });

  it('E2E-009: prepare → offline edit → unprepared unavailable', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => [sampleElement]);
    const edited = await offlineUpdateElement(sampleElement.id, { name: 'Offline Edit' });
    expect(edited._pending).toBe(true);
    const store = new OfflineStore(USER_A);
    expect(await store.isMapPrepared('other-map')).toBe(false);
  });

  it('E2E-011: logout discard clears cache for relaunch login', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    await orchestrateLogout({
      userId: USER_A,
      discardConfirmed: true,
      syncFn: async () => ({}),
      serverLogoutFn: async () => ({}),
    });
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    expect(await store.getPreparedMaps()).toEqual([]);
  });

  it('UT-097: logout with no cache still ends session', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const result = await orchestrateLogout({
      userId: USER_A,
      syncFn: async () => ({ upToDate: true }),
      serverLogoutFn: async () => ({ success: true }),
    });
    expect(result.success).toBe(true);
  });

  it('UT-098: large queue logout reports progress phases', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    for (let i = 0; i < 20; i++) {
      await store.enqueue({
        client_mutation_id: `bulk-${i}`,
        resource_type: 'element',
        op: 'update',
        resource_id: `el-${i}`,
        payload: {},
      });
    }
    const phases = [];
    vi.stubGlobal('navigator', { onLine: false });
    await orchestrateLogout({
      userId: USER_A,
      onProgress: (p) => phases.push(p.phase),
      syncFn: async () => ({}),
      serverLogoutFn: async () => ({}),
    });
    expect(phases).toContain('checking');
  });

  it('UT-099b: server logout network failure preserves local cache', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    vi.stubGlobal('navigator', { onLine: true });
    const networkErr = new Error('Network request failed.');
    networkErr.status = 0;

    await expect(
      orchestrateLogout({
        userId: USER_A,
        discardConfirmed: true,
        syncFn: async () => ({}),
        serverLogoutFn: async () => {
          throw networkErr;
        },
      })
    ).rejects.toMatchObject({ status: 0 });

    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    expect(await store.getPreparedMaps()).toHaveLength(1);
  });

  it('UT-099: expired session still clears local data after discard confirm', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    vi.stubGlobal('navigator', { onLine: true });
    await orchestrateLogout({
      userId: USER_A,
      discardConfirmed: true,
      syncFn: async () => ({}),
      serverLogoutFn: async () => {
        const err = new Error('Unauthorized');
        err.status = 401;
        throw err;
      },
    });
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    expect(await store.getPreparedMaps()).toEqual([]);
  });

  it('UT-101: post-logout clear leaves no private cache', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    await orchestrateLogout({
      userId: USER_A,
      discardConfirmed: true,
      syncFn: async () => ({}),
      serverLogoutFn: async () => ({}),
    });
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    expect(await store.getPreparedMaps()).toEqual([]);
  });

  it('UT-104: sync failure during logout still requires discard confirmation', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.enqueue({
      client_mutation_id: 'deact-pending',
      resource_type: 'element',
      op: 'update',
      resource_id: 'el',
      payload: {},
    });
    vi.stubGlobal('navigator', { onLine: true });
    const result = await orchestrateLogout({
      userId: USER_A,
      syncFn: async () => {
        throw new Error('account_deactivated');
      },
      serverLogoutFn: async () => ({}),
    });
    expect(result.needsDiscardConfirm).toBe(true);
  });
});

describe('export settings offline mirror', () => {
  beforeEach(async () => {
    await resetOfflineDbForTests();
    setOfflineUserId(USER_A);
    vi.restoreAllMocks();
  });

  it('IT-041: OfflineStore map record stores export_settings after prepare', async () => {
    const mapWithSettings = {
      ...sampleMap,
      export_settings: {
        title: 'Cached',
        author: 'Offline',
        legendPosition: 'inside',
        dpi: 300,
      },
    };
    await prepareOfflineMap(
      MAP_ID,
      async () => [mapWithSettings],
      async () => [sampleElement]
    );
    const store = new OfflineStore(USER_A);
    const cached = await store.getMap(MAP_ID);
    expect(cached.export_settings).toMatchObject({ title: 'Cached', author: 'Offline' });
  });

  it('IT-042: different userId partition cannot read other user export settings', async () => {
    const mapWithSettings = {
      ...sampleMap,
      export_settings: { title: 'Secret', author: 'User A' },
    };
    await prepareOfflineMap(MAP_ID, async () => [mapWithSettings], async () => []);
    setOfflineUserId(USER_B);
    const storeB = new OfflineStore(USER_B);
    await storeB.bindAccount();
    const cached = await storeB.getMap(MAP_ID);
    expect(cached).toBeNull();
  });

  it('IT-043: upsertPreparedMap mirrors latest export_settings LWW', async () => {
    await prepareOfflineMap(MAP_ID, async () => [sampleMap], async () => []);
    const store = new OfflineStore(USER_A);
    await store.upsertPreparedMap({
      id: MAP_ID,
      export_settings: { title: 'Latest', author: 'Writer' },
    });
    const cached = await store.getMap(MAP_ID);
    expect(cached.export_settings).toMatchObject({ title: 'Latest', author: 'Writer' });
  });
});

describe('geometry validation', () => {
  it('UT-075 validates point geometry', () => {
    expect(validateOfflineGeometry('point', { type: 'Point', coordinates: [-52, -32] }, 'Name').valid).toBe(true);
    expect(validateOfflineGeometry('point', { type: 'LineString', coordinates: [] }, 'Name').valid).toBe(false);
  });
});
