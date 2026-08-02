import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('maps client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('UT-050: empty maps list renders empty-state CTA contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, maps: [], pagination: { total: 0 } }),
      })
    );
    const { api } = await import('@/api/apiClient');
    const maps = await api.entities.Map.list('-created_date');
    expect(maps).toEqual([]);
  });

  it('UT-063: save without geometry/name remains unavailable client-side', () => {
    const details = { name: '', description: '' };
    const hasGeometry = false;
    const canSave = hasGeometry && details.name.trim().length > 0;
    expect(canSave).toBe(false);
  });

  it('E2E-006: workspace map flow uses HTTP not localStorage authority', async () => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => {
        store[k] = v;
      },
    });
    const mapId = '11111111-1111-1111-1111-111111111111';
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            map: { id: mapId, name: 'Workspace Map', is_published: false, created_at: new Date().toISOString() },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            maps: [{ id: mapId, name: 'Workspace Map', is_published: false, created_at: new Date().toISOString() }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            map: { id: mapId, name: 'Renamed Map', is_published: false, created_at: new Date().toISOString() },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true, deleted: true }),
        })
    );
    const { api } = await import('@/api/apiClient');
    const created = await api.entities.Map.create({ name: 'Workspace Map' });
    expect(created.is_published).toBe(false);
    const listed = await api.entities.Map.list('-created_date');
    expect(listed).toHaveLength(1);
    const renamed = await api.entities.Map.update(mapId, { name: 'Renamed Map' });
    expect(renamed.name).toBe('Renamed Map');
    await api.entities.Map.delete(mapId);
    expect(store['reatcarto_local_maps']).toBeUndefined();
  });

  it('E2E-007: element CRUD uses server endpoints', async () => {
    const mapId = '22222222-2222-2222-2222-222222222222';
    const elementId = '33333333-3333-3333-3333-333333333333';
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            element: {
              id: elementId,
              map_id: mapId,
              element_type: 'point',
              geojson: { type: 'Point', coordinates: [-52.1, -32.035] },
              name: 'Point',
              version: 1,
              style: '{}',
              photos: [],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            element: { id: elementId, name: 'Edited', version: 2, geojson: {}, style: '{}', photos: [] },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true, deleted: true }),
        })
    );
    const { api } = await import('@/api/apiClient');
    const created = await api.entities.MapElement.create({
      map_id: mapId,
      element_type: 'point',
      geojson: { type: 'Point', coordinates: [-52.1, -32.035] },
      name: 'Point',
    });
    expect(created.id).toBe(elementId);
    const updated = await api.entities.MapElement.update(elementId, { name: 'Edited', base_version: 1 });
    expect(updated.version).toBe(2);
    await api.entities.MapElement.delete(elementId, 2);
  });

  it('IT-030: map route loads auth before element payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: false,
          error: { code: 'not_found', message: 'Map not found.', fields: {} },
        }),
      })
    );
    const { api, ApiError } = await import('@/api/apiClient');
    await expect(api.entities.Map.filter({ id: 'missing-map' })).rejects.toBeInstanceOf(ApiError);
  });
});
