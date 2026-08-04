import { describe, expect, it } from 'vitest';
import { computeScaleLabel } from '@/lib/export/scale';

describe('scale helpers', () => {
  it('UT-060: mid zoom returns non-empty unit label', () => {
    const result = computeScaleLabel({ lat: -32, zoom: 11 });
    expect(result.label.length).toBeGreaterThan(0);
    expect(result.label.endsWith('m') || result.label.endsWith('km')).toBe(true);
  });

  it('UT-061: extreme zooms remain finite without NaN', () => {
    const low = computeScaleLabel({ lat: 0, zoom: 1 });
    const high = computeScaleLabel({ lat: 85, zoom: 22 });
    expect(Number.isFinite(low.distanceMeters)).toBe(true);
    expect(Number.isFinite(high.distanceMeters)).toBe(true);
    expect(Number.isFinite(low.barPx)).toBe(true);
    expect(Number.isFinite(high.barPx)).toBe(true);
    expect(low.label).not.toContain('NaN');
    expect(high.label).not.toContain('NaN');
    expect(low.distanceMeters).toBeGreaterThan(0);
    expect(high.distanceMeters).toBeGreaterThan(0);
  });
});
