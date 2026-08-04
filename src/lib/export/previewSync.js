import { PREVIEW_DEBOUNCE_MS } from './constants.js';

/**
 * Pure debounce helper for export preview sync (ADR-010).
 * @param {(value: unknown) => void} subscriber
 * @param {number} [debounceMs]
 */
export function createPreviewSync(subscriber, debounceMs = PREVIEW_DEBOUNCE_MS) {
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;
  /** @type {unknown} */
  let pendingValue = undefined;
  let hasPending = false;

  function schedule(value) {
    pendingValue = value;
    hasPending = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      flushPreviewSync();
    }, debounceMs);
  }

  function flushPreviewSync() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!hasPending) return;
    const value = pendingValue;
    hasPending = false;
    pendingValue = undefined;
    subscriber(value);
  }

  return { schedule, flushPreviewSync };
}

/** @deprecated Use createPreviewSync().flushPreviewSync */
export function flushPreviewSync(sync) {
  sync.flushPreviewSync();
}
