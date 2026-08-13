import { describe, expect, it } from 'vitest';
import { iconSizeForZoom } from '@/components/map/pointIcon';
import { getIconSvg } from '@/components/map/iconSvgs';

describe('iconSizeForZoom', () => {
  it('maps zoom bands to discrete sizes', () => {
    expect(iconSizeForZoom(8)).toBe(14);
    expect(iconSizeForZoom(10)).toBe(14);
    expect(iconSizeForZoom(11)).toBe(18);
    expect(iconSizeForZoom(12)).toBe(18);
    expect(iconSizeForZoom(13)).toBe(24);
    expect(iconSizeForZoom(15)).toBe(24);
    expect(iconSizeForZoom(16)).toBe(32);
    expect(iconSizeForZoom(20)).toBe(32);
  });

  it('treats invalid zoom as far-band size', () => {
    expect(iconSizeForZoom(NaN)).toBe(14);
    expect(iconSizeForZoom(undefined)).toBe(14);
  });
});

describe('getIconSvg size', () => {
  it('applies width/height for the requested size', () => {
    const svg = getIconSvg('pin', '#F97316', 14);
    expect(svg).toContain('width="14"');
    expect(svg).toContain('height="14"');
    expect(svg).toContain('viewBox="0 0 24 24"');
  });

  it('defaults to 32 when size omitted', () => {
    const svg = getIconSvg('circle', '#000');
    expect(svg).toContain('width="32"');
    expect(svg).toContain('height="32"');
  });
});
