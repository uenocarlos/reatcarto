import { afterEach, describe, expect, it, vi } from 'vitest';
import { newMutationId } from '@/lib/offline/offlineApi';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('newMutationId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a UUID when randomUUID is missing (plain HTTP)', () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, i) => i);
    vi.stubGlobal('crypto', {
      getRandomValues(arr) {
        arr.set(bytes);
        return arr;
      },
    });

    const id = newMutationId();
    expect(id).toMatch(UUID_RE);
    expect(id.startsWith('mut-')).toBe(false);
  });
});
