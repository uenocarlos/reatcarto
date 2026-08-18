import { beforeEach, describe, expect, it, vi } from 'vitest';

const isOnlineMock = vi.fn(() => true);
const getOfflineUserIdMock = vi.fn(() => 'user-1');
const offlineCreateElementMock = vi.fn();
const offlineGetMapMock = vi.fn();
const storeGetElementsMock = vi.fn();
const storeGetAllOutboxMock = vi.fn();
const storeRemoveElementMock = vi.fn();
const storeUpsertElementMock = vi.fn();

vi.mock('@/api/http', async () => {
  const actual = await vi.importActual('@/api/http');
  return {
    ...actual,
    API_BASE_URL: '/php',
    apiFetch: vi.fn(),
  };
});

vi.mock('@/lib/offline/connectivity', () => ({
  isOnline: () => isOnlineMock(),
}));

vi.mock('@/lib/offline/offlineApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getOfflineUserId: () => getOfflineUserIdMock(),
    offlineCreateElement: (...args) => offlineCreateElementMock(...args),
    offlineGetMap: (...args) => offlineGetMapMock(...args),
    storeForUser: () => ({
      getElements: storeGetElementsMock,
      getAllOutbox: storeGetAllOutboxMock,
      removeElement: storeRemoveElementMock,
      upsertElement: storeUpsertElementMock,
    }),
  };
});

import { api, ApiError, normalizeElement } from '@/api/apiClient';
import { apiFetch } from '@/api/http';
import { parseElementGeojson, parseElementStyle } from '@/components/map/export/exportMapUtils';
import { resolveLocalElementId } from '@/lib/offline/offlineApi';

const pointGeo = { type: 'Point', coordinates: [-52.1, -32.03] };
const pointStyle = { icon_name: 'pin', icon_color: '#F97316' };

function localElement(overrides = {}) {
  return {
    id: 'local-1',
    map_id: 'map-1',
    element_type: 'point',
    geojson: pointGeo,
    style: pointStyle,
    name: 'Element',
    _pending: true,
    ...overrides,
  };
}

describe('offline element create/list', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    isOnlineMock.mockReset();
    isOnlineMock.mockReturnValue(true);
    getOfflineUserIdMock.mockReturnValue('user-1');
    offlineCreateElementMock.mockReset();
    offlineGetMapMock.mockReset();
    storeGetElementsMock.mockReset();
    storeGetElementsMock.mockResolvedValue([]);
    storeGetAllOutboxMock.mockReset();
    storeGetAllOutboxMock.mockResolvedValue([]);
    storeRemoveElementMock.mockReset();
    storeRemoveElementMock.mockResolvedValue(undefined);
    storeUpsertElementMock.mockReset();
    storeUpsertElementMock.mockResolvedValue(undefined);
  });

  it('normalizeElement stringifies object geojson and style from IndexedDB', () => {
    const normalized = normalizeElement(localElement());
    expect(typeof normalized.geojson).toBe('string');
    expect(typeof normalized.style).toBe('string');
    expect(JSON.parse(normalized.geojson)).toEqual(pointGeo);
  });

  it('create queues locally when navigator reports offline', async () => {
    isOnlineMock.mockReturnValue(false);
    offlineCreateElementMock.mockResolvedValue(localElement());

    const created = await api.entities.MapElement.create({
      map_id: 'map-1',
      element_type: 'point',
      geojson: JSON.stringify(pointGeo),
      style: JSON.stringify(pointStyle),
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(offlineCreateElementMock).toHaveBeenCalledTimes(1);
    expect(typeof created.geojson).toBe('string');
    expect(created._pending).toBe(true);
  });

  it('create falls back to offline store when the network request fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError('network_error', 'Network request failed.', 0));
    offlineCreateElementMock.mockResolvedValue(localElement({ id: 'queued-1' }));

    const created = await api.entities.MapElement.create({
      map_id: 'map-1',
      element_type: 'point',
      geojson: JSON.stringify(pointGeo),
      style: JSON.stringify(pointStyle),
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(offlineCreateElementMock).toHaveBeenCalledTimes(1);
    expect(created.id).toBe('queued-1');
    expect(typeof created.geojson).toBe('string');
  });

  it('create reuses the editor local_id so later edits sync the same element', async () => {
    isOnlineMock.mockReturnValue(false);
    offlineCreateElementMock.mockResolvedValue(localElement({ id: 'local-keep' }));

    await api.entities.MapElement.create({
      map_id: 'map-1',
      local_id: 'local-keep',
      element_type: 'point',
      geojson: JSON.stringify(pointGeo),
      style: JSON.stringify(pointStyle),
    });

    expect(offlineCreateElementMock).toHaveBeenCalledWith(
      expect.objectContaining({ local_id: 'local-keep', map_id: 'map-1' }),
      expect.anything()
    );
  });

  it('create queues locally when the session cookie is missing (401)', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError('unauthenticated', 'Authentication required.', 401));
    offlineCreateElementMock.mockResolvedValue(localElement({ id: 'local-401' }));

    const created = await api.entities.MapElement.create({
      map_id: 'map-1',
      element_type: 'point',
      geojson: JSON.stringify(pointGeo),
      style: JSON.stringify(pointStyle),
    });

    expect(offlineCreateElementMock).toHaveBeenCalledTimes(1);
    expect(created.id).toBe('local-401');
  });

  it('resolveLocalElementId keeps the optimistic id from the editor', () => {
    expect(resolveLocalElementId({ local_id: 'local-abc' })).toBe('local-abc');
    expect(resolveLocalElementId({ id: 'already-there' })).toBe('already-there');
  });

  it('filter offline normalizes object geojson so the map can render', async () => {
    isOnlineMock.mockReturnValue(false);
    offlineGetMapMock.mockResolvedValue({
      map: { id: 'map-1' },
      elements: [localElement()],
    });

    const elements = await api.entities.MapElement.filter({ map_id: 'map-1' });

    expect(elements).toHaveLength(1);
    expect(typeof elements[0].geojson).toBe('string');
    expect(typeof elements[0].style).toBe('string');
    expect(parseElementGeojson(elements[0])).toEqual(pointGeo);
    expect(parseElementStyle(elements[0])).toMatchObject(pointStyle);
  });

  it('filter online keeps local pending creates that the server does not have yet', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ elements: [] });
    storeGetElementsMock.mockResolvedValue([localElement({ id: 'pending-1' })]);

    const elements = await api.entities.MapElement.filter({ map_id: 'map-1' });

    expect(elements.map((el) => el.id)).toContain('pending-1');
    expect(typeof elements[0].geojson).toBe('string');
  });

  it('filter online hides elements with a pending offline delete', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      elements: [normalizeElement(localElement({ id: 'gone-1', _pending: false }))],
    });
    storeGetAllOutboxMock.mockResolvedValue([
      { resource_type: 'element', op: 'delete', status: 'pending', resource_id: 'gone-1' },
    ]);

    const elements = await api.entities.MapElement.filter({ map_id: 'map-1' });

    expect(elements.map((el) => el.id)).not.toContain('gone-1');
  });

  it('filter online does not resurrect a cached copy after a successful server delete', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ elements: [] });
    storeGetElementsMock.mockResolvedValue([
      localElement({ id: 'deleted-online', _pending: false }),
    ]);

    const elements = await api.entities.MapElement.filter({ map_id: 'map-1' });

    expect(elements.map((el) => el.id)).not.toContain('deleted-online');
  });

  it('delete online removes the element from the IndexedDB cache', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, deleted: true });

    await api.entities.MapElement.delete('el-1', 3);

    expect(apiFetch).toHaveBeenCalledWith(
      '/elements/delete.php',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(storeRemoveElementMock).toHaveBeenCalledWith('el-1');
  });

  it('parseElementGeojson accepts object or string without throwing', () => {
    expect(parseElementGeojson({ geojson: pointGeo })).toEqual(pointGeo);
    expect(parseElementGeojson({ geojson: JSON.stringify(pointGeo) })).toEqual(pointGeo);
    expect(parseElementGeojson({ geojson: 'not-json' })).toBeNull();
    expect(parseElementStyle({ style: pointStyle })).toMatchObject(pointStyle);
  });
});
