import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  OfflineStore,
  resetOfflineDbForTests,
} from '@/lib/offline/OfflineStore';
import { orchestrateLogout, resetLogoutStateForTests } from '@/lib/offline/logoutFlow';
import { ApiError } from '@/api/http';

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('admin and delete account client', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetOfflineDbForTests();
    resetLogoutStateForTests();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('UT-135: success UI only after authoritative response', async () => {
    let resolveStatus;
    const statusPromise = new Promise((resolve) => {
      resolveStatus = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (String(url).includes('/admin/user_status.php')) {
          return statusPromise.then(() => ({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
              success: true,
              user: { id: 'user-1', status: 'deactivated' },
            }),
          }));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true }),
        });
      })
    );

    const { api } = await import('@/api/apiClient');
    let showSuccess = false;
    const pending = api.admin
      .setUserStatus('user-1', 'deactivate', 'policy violation')
      .then(() => {
        showSuccess = true;
      });

    expect(showSuccess).toBe(false);
    resolveStatus();
    await pending;
    expect(showSuccess).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/user_status.php'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('UT-135: admin status failure does not show success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: false,
          error: { code: 'validation_error', message: 'Invalid transition', fields: {} },
        }),
      })
    );

    const { api } = await import('@/api/apiClient');
    let showSuccess = false;
    try {
      await api.admin.setUserStatus('user-1', 'activate', 'reason').then(() => {
        showSuccess = true;
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }
    expect(showSuccess).toBe(false);
  });

  it('UT-155: deletion warns about unsynced local work via outbox discard confirm', async () => {
    const store = new OfflineStore(USER_A);
    await store.bindAccount();
    await store.enqueue({
      client_mutation_id: 'delete-warn-1',
      resource_type: 'element',
      op: 'update',
      resource_id: 'el-1',
      payload: { name: 'Local edit' },
    });
    vi.stubGlobal('navigator', { onLine: false });

    const result = await orchestrateLogout({
      userId: USER_A,
      discardConfirmed: false,
      syncFn: async () => ({ upToDate: false, offline: true }),
      serverLogoutFn: async () => ({}),
    });

    expect(result.needsDiscardConfirm).toBe(true);
    expect(result.pending.length).toBeGreaterThan(0);
    expect(result.offline).toBe(true);
  });

  it('UT-155: delete account completes only after authoritative server response', async () => {
    let resolveDelete;
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url, opts) => {
        if (String(url).includes('/auth/delete_account.php')) {
          return deletePromise.then(() => ({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ success: true }),
          }));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ success: true }),
        });
      })
    );

    const { api } = await import('@/api/apiClient');
    let accountDeleted = false;
    const pending = api.auth
      .deleteAccount({ password: 'secret', confirmPhrase: 'DELETE MY ACCOUNT' })
      .then(() => {
        accountDeleted = true;
      });

    expect(accountDeleted).toBe(false);
    resolveDelete();
    await pending;
    expect(accountDeleted).toBe(true);

    const deleteCall = fetch.mock.calls.find(([url]) =>
      String(url).includes('/auth/delete_account.php')
    );
    expect(deleteCall).toBeDefined();
    expect(JSON.parse(deleteCall[1].body)).toMatchObject({
      password: 'secret',
      confirm_phrase: 'DELETE MY ACCOUNT',
    });
  });
});

describe('delete account confirm phrase', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('requires exact confirm phrase constant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: false,
          error: {
            code: 'validation_error',
            message: 'Confirm phrase required',
            fields: { confirm_phrase: 'required' },
          },
        }),
      })
    );
    const { api } = await import('@/api/apiClient');
    await expect(
      api.auth.deleteAccount({ password: 'secret', confirmPhrase: 'wrong phrase' })
    ).rejects.toMatchObject({ code: 'validation_error' });
  });
});
