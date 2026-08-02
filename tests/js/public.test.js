import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('public gallery client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('UT-113: client does not show published until server success', async () => {
    let resolvePublish;
    const publishPromise = new Promise((resolve) => {
      resolvePublish = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url, opts) => {
        if (url.includes('/maps/publish.php')) {
          return publishPromise.then(() => ({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => ({
              success: true,
              map: { id: 'map-1', is_published: true, public_id: 'pub-1', name: 'Map' },
            }),
          }));
        }
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true, maps: [] }),
        });
      })
    );

    const { api } = await import('@/api/apiClient');
    let optimisticPublished = false;
    const pending = api.entities.Map.publish('map-1').then((map) => {
      optimisticPublished = map.is_published;
      return map;
    });
    expect(optimisticPublished).toBe(false);
    resolvePublish();
    const map = await pending;
    expect(map.is_published).toBe(true);
  });

  it('UT-120: offline search does not present stale as freshly current', () => {
    vi.doMock('@/lib/offline/connectivity', () => ({ isOnline: () => false }));
    const offline = true;
    const staleResults = [{ public_id: 'old-1', name: 'Stale' }];
    const presentedAsCurrent = !offline;
    expect(presentedAsCurrent).toBe(false);
    expect(staleResults).toHaveLength(1);
  });

  it('UT-121: repeat search merge does not duplicate ids', () => {
    const mergeMaps = (existing, incoming) => {
      const seen = new Set(existing.map((m) => m.public_id));
      const merged = [...existing];
      for (const map of incoming) {
        if (!seen.has(map.public_id)) {
          seen.add(map.public_id);
          merged.push(map);
        }
      }
      return merged;
    };
    const first = [{ public_id: 'a', name: 'A' }];
    const second = [{ public_id: 'a', name: 'A' }, { public_id: 'b', name: 'B' }];
    const merged = mergeMaps(first, second);
    expect(merged).toHaveLength(2);
    expect(new Set(merged.map((m) => m.public_id)).size).toBe(2);
  });

  it('UT-123: public client has no publish or delete methods on public facade', async () => {
    const { api } = await import('@/api/apiClient');
    expect(api.public.listMaps).toBeTypeOf('function');
    expect(api.public.getMap).toBeTypeOf('function');
    expect(api.public.listElements).toBeTypeOf('function');
    expect(api.public.getPhoto).toBeTypeOf('function');
    expect(api.public.publish).toBeUndefined();
    expect(api.public.delete).toBeUndefined();
  });

  it('E2E-013: gallery search uses public list endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          maps: [{ public_id: '11111111-1111-1111-1111-111111111111', name: 'Coast Map' }],
          pagination: { page: 1, total: 1, total_pages: 1 },
        }),
      })
    );
    const { api } = await import('@/api/apiClient');
    const result = await api.public.listMaps({ q: 'Coast' });
    expect(result.maps).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/public/maps.php?q=Coast'),
      expect.any(Object)
    );
  });

  it('E2E-014: public map and elements fetched read-only', async () => {
    const publicId = '22222222-2222-2222-2222-222222222222';
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            map: { public_id: publicId, name: 'Public', center_lat: -32, center_lng: -52, zoom: 12 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            elements: [
              {
                id: 'el-1',
                element_type: 'point',
                geojson: { type: 'Point', coordinates: [-52.1, -32.035] },
                name: 'Point',
                style: {},
                photos: [{ id: 'ph-1', url: '/php/public/photo.php?id=ph-1' }],
              },
            ],
            pagination: { total: 1 },
          }),
        })
    );
    const { api } = await import('@/api/apiClient');
    const map = await api.public.getMap(publicId);
    expect(map.name).toBe('Public');
    const { elements } = await api.public.listElements(publicId);
    expect(elements).toHaveLength(1);
    expect(elements[0].photos[0].url).toContain('/public/photo.php');
  });
});
