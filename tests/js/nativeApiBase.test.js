import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));

import { NATIVE_API_BASE_URL, API_BASE_URL, resolveApiAssetUrl } from '@/api/http';

describe('native API base', () => {
  it('sends Android requests to the public IP backend without the FURG hostname', () => {
    expect(NATIVE_API_BASE_URL).toBe('http://200.132.255.26/php');
    expect(API_BASE_URL).toBe(NATIVE_API_BASE_URL);
    expect(NATIVE_API_BASE_URL).not.toContain('reatcarto.furg.br');
  });

  it('loads bundled SVG icons from the app, not the PHP origin', () => {
    expect(resolveApiAssetUrl('/icons/casa.svg')).toBe('/assets/icons/casa.svg');
    expect(resolveApiAssetUrl('/php/icons/get.php?id=1')).toBe('http://200.132.255.26/php/icons/get.php?id=1');
  });
});
