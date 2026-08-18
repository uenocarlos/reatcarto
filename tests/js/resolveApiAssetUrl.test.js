import { describe, expect, it } from 'vitest';
import { resolveApiAssetUrl } from '@/api/http';

describe('resolveApiAssetUrl', () => {
  it('rewrites built-in SVG paths to /assets/icons so Apache FallbackResource cannot 404 them', () => {
    expect(resolveApiAssetUrl('/icons/barco01.svg')).toBe('/assets/icons/barco01.svg');
    expect(resolveApiAssetUrl('/assets/icons/casa.svg')).toBe('/assets/icons/casa.svg');
  });

  it('keeps PHP media URLs on web', () => {
    expect(resolveApiAssetUrl('/php/photos/get.php?id=abc')).toBe('/php/photos/get.php?id=abc');
    expect(resolveApiAssetUrl('/php/videos/get.php?id=abc')).toBe('/php/videos/get.php?id=abc');
  });

  it('passes through absolute and empty values', () => {
    expect(resolveApiAssetUrl('https://cdn.example/x.png')).toBe('https://cdn.example/x.png');
    expect(resolveApiAssetUrl('')).toBe('');
  });
});
