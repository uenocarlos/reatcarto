import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/http';

vi.mock('@/lib/offline/connectivity', () => ({
  isOnline: vi.fn(() => true),
}));

vi.mock('@/api/apiClient', async () => {
  const actual = await vi.importActual('@/api/apiClient');
  return {
    ...actual,
    api: {
      entities: {
        MapElement: {
          filter: vi.fn(),
        },
      },
    },
  };
});

vi.mock('@/api/http', async () => {
  const actual = await vi.importActual('@/api/http');
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

import { isOnline } from '@/lib/offline/connectivity';
import { api } from '@/api/apiClient';
import { apiFetch } from '@/api/http';
import { exportShapefile, fetchAllMapElements } from '@/api/gisClient';

function elementRow(index) {
  return {
    id: `e-${index}`,
    name: `E${index}`,
    element_type: 'point',
    element_category: 'terra',
    description: '',
    geojson: { type: 'Point', coordinates: [-52, -32] },
    style: { icon_name: 'pin' },
  };
}

describe('gisClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isOnline.mockReturnValue(true);
  });

  it('UT-090: fetchAllMapElements concatenates paginated API pages', async () => {
    apiFetch
      .mockResolvedValueOnce({
        elements: Array.from({ length: 100 }, (_, i) => elementRow(i)),
        pagination: { page: 1, page_size: 100, total: 250, total_pages: 3 },
      })
      .mockResolvedValueOnce({
        elements: Array.from({ length: 100 }, (_, i) => elementRow(100 + i)),
        pagination: { page: 2, page_size: 100, total: 250, total_pages: 3 },
      })
      .mockResolvedValueOnce({
        elements: Array.from({ length: 50 }, (_, i) => elementRow(200 + i)),
        pagination: { page: 3, page_size: 100, total: 250, total_pages: 3 },
      });

    const all = await fetchAllMapElements('map-1');
    expect(all).toHaveLength(250);
    expect(apiFetch).toHaveBeenCalledTimes(3);
    expect(apiFetch.mock.calls[0][0]).toContain('page=1');
    expect(apiFetch.mock.calls[0][0]).toContain('page_size=100');
  });

  it('UT-090 offline: uses IndexedDB filter without pagination API', async () => {
    isOnline.mockReturnValue(false);
    api.entities.MapElement.filter.mockResolvedValue([elementRow(1), elementRow(2)]);
    const all = await fetchAllMapElements('map-1');
    expect(all).toHaveLength(2);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('UT-045: exportShapefile posts to export-shp.php and returns a Blob', async () => {
    const blob = new Blob(['PK'], { type: 'application/zip' });
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: {
        get: (name) => (name === 'Content-Disposition' ? 'attachment; filename="mapa-2026-08-13.zip"' : 'application/zip'),
      },
      blob: async () => blob,
    }));
    const download = vi.fn();

    const result = await exportShapefile(
      { mapId: 'map-1', scope: 'whole', elementIds: [] },
      { fetchImpl, download },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      '/php/elements/export-shp.php',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).toEqual({ map_id: 'map-1', scope: 'whole', element_ids: [] });
    expect(result.blob).toBe(blob);
    expect(result.fileName).toBe('mapa-2026-08-13.zip');
    expect(download).toHaveBeenCalled();
  });

  it('IT-012: exportShapefile surfaces 403 as ApiError', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 403,
      headers: { get: () => 'application/json' },
      json: async () => ({
        error: { code: 'forbidden', message: 'You do not have access to this map.' },
      }),
    }));

    await expect(
      exportShapefile({ mapId: 'map-1', scope: 'whole' }, { fetchImpl, download: false }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
