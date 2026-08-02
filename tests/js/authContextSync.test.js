import { describe, expect, it, vi, beforeEach } from 'vitest';
import { executeOutboxFlush } from '@/lib/AuthContext';

describe('AuthContext outbox flush orchestration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
  });

  it('UT-085: skips flush when no sync engine is available', async () => {
    const result = await executeOutboxFlush(() => null);
    expect(result).toEqual({ skipped: true });
  });

  it('UT-080: skips flush while offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const flush = vi.fn();
    const engine = { isFlushing: () => false, flush };
    const result = await executeOutboxFlush(() => engine);
    expect(result).toEqual({ offline: true });
    expect(flush).not.toHaveBeenCalled();
  });

  it('UT-085: delegates flush to SyncEngine when online and authenticated', async () => {
    const flush = vi.fn().mockResolvedValue({ upToDate: true, results: [] });
    const engine = { isFlushing: () => false, flush };
    const result = await executeOutboxFlush(() => engine);
    expect(flush).toHaveBeenCalledOnce();
    expect(result.upToDate).toBe(true);
  });

  it('UT-100: returns inProgress when a flush is already running', async () => {
    const flush = vi.fn();
    const engine = { isFlushing: () => true, flush };
    const result = await executeOutboxFlush(() => engine);
    expect(result).toEqual({ inProgress: true });
    expect(flush).not.toHaveBeenCalled();
  });
});
