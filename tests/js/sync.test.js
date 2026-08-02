import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiError } from '@/api/http';

describe('sync api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('UT-070: sync.push uploads offline photo creates via multipart', async () => {
    const blob = new Blob(['fake-image'], { type: 'image/jpeg' });
    const photoStore = {
      getPhotoBlob: vi.fn().mockResolvedValue({
        blob,
        content_type: 'image/jpeg',
      }),
    };
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('photos/upload.php')) {
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            success: true,
            photo: { id: 'ph-1', element_id: 'el-1' },
          }),
        };
      }
      return {
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, results: [], progress: { completed: 0, total: 0 } }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('@/api/apiClient');
    const data = await api.sync.push(
      [
        {
          client_mutation_id: 'photo-mid',
          resource_type: 'photo',
          op: 'create',
          payload: { element_id: 'el-1', file_name: 'field.jpg' },
        },
      ],
      { photoBlobs: photoStore }
    );

    expect(data.results[0].status).toBe('synced');
    expect(data.results[0].resource.id).toBe('ph-1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/photos/upload.php'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(photoStore.getPhotoBlob).toHaveBeenCalledWith('photo-mid');
  });

  it('UT-086/UT-088: sync.push handles conflicts and idempotent replay', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          results: [
            {
              client_mutation_id: 'mut-conflict',
              status: 'conflict',
              conflict: {
                local_snapshot: { name: 'Local' },
                remote_snapshot: { name: 'Remote' },
                kind: 'update_update',
              },
            },
            {
              client_mutation_id: 'mut-replay',
              status: 'synced',
              resource_type: 'element',
              resource: { id: 'el-1', version: 2 },
            },
          ],
          progress: { completed: 2, total: 2 },
        }),
      })
    );
    const { api } = await import('@/api/apiClient');
    const data = await api.sync.push([
      { client_mutation_id: 'mut-conflict', resource_type: 'element', op: 'update', payload: {} },
      { client_mutation_id: 'mut-replay', resource_type: 'element', op: 'update', payload: {} },
    ]);
    expect(data.results[0].status).toBe('conflict');
    expect(data.results[1].status).toBe('synced');
  });

  it('UT-087: resolveConflict sends choice to server', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          resource_type: 'element',
          resource: { id: 'el-1', name: 'Winner', version: 3 },
        }),
      })
    );
    const { api } = await import('@/api/apiClient');
    const result = await api.sync.resolveConflict('mut-1', 'local', 2);
    expect(result.resource.name).toBe('Winner');
  });

  it('UT-089: failed mutation in batch does not block others', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          results: [
            { client_mutation_id: 'bad', status: 'failed', error: { code: 'validation_error' } },
            { client_mutation_id: 'good', status: 'synced', resource_type: 'element', resource: { id: 'x' } },
          ],
        }),
      })
    );
    const { api } = await import('@/api/apiClient');
    const data = await api.sync.push([{ client_mutation_id: 'bad' }, { client_mutation_id: 'good' }]);
    expect(data.results.filter((r) => r.status === 'synced')).toHaveLength(1);
  });

  it('UT-167: api client maps 429 to rate_limited error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: false,
          error: { code: 'rate_limited', message: 'Too many requests.', fields: {} },
        }),
      })
    );
    const { apiFetch } = await import('@/api/http');
    await expect(apiFetch('/maps/list.php')).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
    });
  });

  it('E2E-010: conflict resolution flow via sync API', async () => {
    const push = vi.fn().mockResolvedValue({
      success: true,
      results: [
        {
          client_mutation_id: 'conflict-mut',
          status: 'conflict',
          conflict: {
            local_snapshot: { name: 'Field A' },
            remote_snapshot: { name: 'Field B' },
            kind: 'update_update',
          },
        },
      ],
    });
    const resolve = vi.fn().mockResolvedValue({
      success: true,
      resource_type: 'element',
      resource: { id: 'el', name: 'Field A', version: 4 },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url) => {
        if (String(url).includes('resolve')) {
          return {
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => resolve(),
          };
        }
        return {
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => push(),
        };
      })
    );
    const { api } = await import('@/api/apiClient');
    const pushed = await api.sync.push([{ client_mutation_id: 'conflict-mut', op: 'update' }]);
    expect(pushed.results[0].status).toBe('conflict');
    const resolved = await api.sync.resolveConflict('conflict-mut', 'local', 2);
    expect(resolved.resource.name).toBe('Field A');
  });
});

describe('ApiError', () => {
  it('preserves error code for toast mapping', () => {
    const err = new ApiError('rate_limited', 'Too many requests.', 429);
    expect(err.code).toBe('rate_limited');
  });
});
