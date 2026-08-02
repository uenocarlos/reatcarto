import { OUTBOX_STATUS, OfflineStore } from '@/lib/offline/OfflineStore';
import { isOnline } from '@/lib/offline/connectivity';

let logoutInProgress = false;

export function isLogoutInProgress() {
  return logoutInProgress;
}

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {() => Promise<object>} opts.syncFn
 * @param {() => Promise<void>} opts.serverLogoutFn
 * @param {boolean} [opts.discardConfirmed]
 * @param {(progress: object) => void} [opts.onProgress]
 */
export async function orchestrateLogout({
  userId,
  syncFn,
  serverLogoutFn,
  discardConfirmed = false,
  onProgress,
}) {
  if (logoutInProgress) {
    return { duplicate: true };
  }
  logoutInProgress = true;
  const store = new OfflineStore(userId);

  try {
    const outbox = await store.getAllOutbox();
    const unsynced = outbox.filter(
      (r) =>
        r.status === OUTBOX_STATUS.PENDING ||
        r.status === OUTBOX_STATUS.CONFLICTED ||
        r.status === OUTBOX_STATUS.FAILED ||
        r.corrupt
    );

    if (onProgress) {
      onProgress({ phase: 'checking', pending: unsynced.length });
    }

    if (unsynced.length > 0 && isOnline() && !discardConfirmed) {
      if (onProgress) onProgress({ phase: 'syncing', pending: unsynced.length });
      try {
        const syncResult = await syncFn();
        const remaining = await store.getPendingOutbox();
        const corrupt = remaining.filter((r) => r.corrupt);
        const stillPending = remaining.filter(
          (r) => r.status !== OUTBOX_STATUS.SYNCED && !r.corrupt
        );
        if ((stillPending.length > 0 || corrupt.length > 0) && !discardConfirmed) {
          return {
            needsDiscardConfirm: true,
            pending: stillPending,
            corrupt,
            syncResult,
          };
        }
      } catch {
        const remaining = await store.getPendingOutbox();
        if (remaining.length > 0 && !discardConfirmed) {
          return { needsDiscardConfirm: true, pending: remaining, syncFailed: true };
        }
      }
    } else if (unsynced.length > 0 && !isOnline() && !discardConfirmed) {
      return { needsDiscardConfirm: true, pending: unsynced, offline: true };
    }

    const remainingUnsynced = (await store.getAllOutbox()).filter(
      (r) =>
        r.status === OUTBOX_STATUS.PENDING ||
        r.status === OUTBOX_STATUS.CONFLICTED ||
        r.status === OUTBOX_STATUS.FAILED ||
        r.corrupt
    );
    if (remainingUnsynced.length > 0 && !discardConfirmed) {
      return { needsDiscardConfirm: true, pending: remainingUnsynced };
    }

    if (onProgress) onProgress({ phase: 'clearing' });

    if (isOnline()) {
      try {
        await serverLogoutFn();
      } catch (err) {
        if (err?.status !== 401) {
          throw err;
        }
      }
    }

    await store.clearAccountData();

    return { success: true };
  } finally {
    logoutInProgress = false;
  }
}

export function resetLogoutStateForTests() {
  logoutInProgress = false;
}
