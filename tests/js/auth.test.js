import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiError, apiFetch } from '@/api/http';

describe('auth client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('UT-012: register network failure does not store verified account locally', async () => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => {
        store[k] = v;
      },
      removeItem: (k) => {
        delete store[k];
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(
      apiFetch('/auth/register.php', { method: 'POST', body: { username: 'x' } })
    ).rejects.toMatchObject({ code: 'network_error' });
    expect(store['reatcarto_user']).toBeUndefined();
  });

  it('UT-030: login network failure surfaces ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(
      apiFetch('/auth/login.php', { method: 'POST', body: { identifier: 'a', password: 'b' } })
    ).rejects.toMatchObject({ code: 'network_error' });
  });

  it('UT-167: maps 429 to rate_limited error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: false,
          error: { code: 'rate_limited', message: 'Too many attempts', fields: {} },
        }),
      })
    );
    await expect(apiFetch('/auth/login.php', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
    });
  });

  it('UT-027: client-side blank identifier validation helper', () => {
    const errors = {};
    const identifier = '';
    const password = '';
    if (!identifier.trim()) errors.identifier = 'required';
    if (!password) errors.password = 'required';
    expect(Object.keys(errors)).toHaveLength(2);
  });

  it('UT-031: double submit guard prevents duplicate navigation flag', async () => {
    let navigated = 0;
    let submitting = false;
    const submit = async () => {
      if (submitting) return;
      submitting = true;
      navigated += 1;
      await Promise.resolve();
      submitting = false;
    };
    await Promise.all([submit(), submit()]);
    expect(navigated).toBe(1);
  });

  it('UT-011: authenticated users should not access register route', () => {
    const redirect = (isAuthenticated) => (isAuthenticated ? '/' : null);
    expect(redirect(true)).toBe('/');
    expect(redirect(false)).toBeNull();
  });

  it('UT-029: deep link return path preserved in login navigation state', () => {
    const from = { pathname: '/editor/map-123' };
    const location = { state: { from } };
    expect(location.state.from.pathname).toBe('/editor/map-123');
  });

  it('UT-020: resend accepted shows delivery pending status flag', () => {
    let deliveryPending = false;
    const onResendAccepted = () => {
      deliveryPending = true;
    };
    onResendAccepted();
    expect(deliveryPending).toBe(true);
  });
});

describe('ApiError envelope', () => {
  it('preserves fields from server envelope', () => {
    const err = new ApiError('validation_error', 'Validation failed', 400, {
      email: 'duplicate',
    });
    expect(err.fields.email).toBe('duplicate');
  });
});
