import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createPreviewSync } from '@/lib/export/previewSync';

describe('preview sync helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('UT-010: debounce schedules one flush with last value', () => {
    const subscriber = vi.fn();
    const sync = createPreviewSync(subscriber, 300);

    sync.schedule('a');
    sync.schedule('b');
    sync.schedule('c');

    expect(subscriber).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith('c');
  });

  it('UT-011: flushPreviewSync invokes pending update immediately', () => {
    const subscriber = vi.fn();
    const sync = createPreviewSync(subscriber, 400);
    sync.schedule('pending');
    sync.flushPreviewSync();
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith('pending');
    vi.advanceTimersByTime(500);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });
});
