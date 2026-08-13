import { beforeEach, describe, expect, it, vi } from 'vitest';

const isOnlineMock = vi.fn(() => true);

vi.mock('@/api/http', () => ({
  API_BASE_URL: '/php',
  ApiError: class ApiError extends Error {
    constructor(code, message, status, fields = {}) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
      this.fields = fields;
    }
  },
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/offline/connectivity', () => ({
  isOnline: () => isOnlineMock(),
}));

import { api, ApiError } from '@/api/apiClient';
import { apiFetch } from '@/api/http';

describe('api.icons', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    isOnlineMock.mockReset();
    isOnlineMock.mockReturnValue(true);
  });

  it('UT-070: url helper returns icon GET path', () => {
    expect(api.icons.url('x')).toBe('/php/icons/get.php?id=x');
    expect(api.icons.url('uuid/with/special')).toBe(
      `/php/icons/get.php?id=${encodeURIComponent('uuid/with/special')}`,
    );
  });

  it('UT-071: create builds FormData with file and optional name', async () => {
    const file = new File(['png'], 'icon.png', { type: 'image/png' });
    vi.mocked(apiFetch).mockResolvedValue({ icon: { id: 'icon-1', url: '/php/icons/get.php?id=icon-1' } });

    await api.icons.create(file, { name: 'Farol', clientMutationId: 'mut-1' });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [, options] = vi.mocked(apiFetch).mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('file')).toBe(file);
    expect(options.body.get('name')).toBe('Farol');
    expect(options.body.get('client_mutation_id')).toBe('mut-1');
  });

  it('UT-072: remove surfaces forbidden errors from apiFetch', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError('forbidden', 'Not allowed.', 403));

    await expect(api.icons.remove('icon-1')).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Not allowed.',
      status: 403,
    });
  });

  it('list throws offline error without calling apiFetch', async () => {
    isOnlineMock.mockReturnValue(false);

    await expect(api.icons.list()).rejects.toMatchObject({ code: 'offline' });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
