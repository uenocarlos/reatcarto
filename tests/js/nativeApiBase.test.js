import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));

import { NATIVE_API_BASE_URL, API_BASE_URL } from '@/api/http';

describe('native API base', () => {
  it('sends Android requests to the isolated HTTPS backend', () => {
    expect(NATIVE_API_BASE_URL).toBe('https://reatcarto.furg.br:8443/php');
    expect(API_BASE_URL).toBe(NATIVE_API_BASE_URL);
  });
});
