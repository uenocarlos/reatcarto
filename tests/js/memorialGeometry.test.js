import { describe, expect, it } from 'vitest';
import {
  buildMemorial,
  extractExteriorRing,
  formatDegreesMinutesSeconds,
  MemorialGeometryError,
  utmZoneForLongitude,
} from '@/lib/memorial/geometry';

const square = {
  id: 'polygon-1',
  element_type: 'polygon',
  geojson: {
    type: 'Polygon',
    coordinates: [[
      [-52.101, -32.001],
      [-52.099, -32.001],
      [-52.099, -31.999],
      [-52.101, -31.999],
      [-52.101, -32.001],
    ]],
  },
};

describe('memorial geometry', () => {
  it('extracts the exterior ring without the closing duplicate', () => {
    expect(extractExteriorRing(square)).toHaveLength(4);
  });

  it('builds clockwise UTM rows beginning at the northernmost vertex', () => {
    const memorial = buildMemorial(square);
    expect(memorial.zoneLabel).toBe('22S');
    expect(memorial.centralMeridian).toBe(-51);
    expect(memorial.vertexCount).toBe(4);
    expect(memorial.rows).toHaveLength(4);
    expect(memorial.rows[0].vertex).toBe('Pt0');
    expect(memorial.rows[3].side).toBe('Pt3-Pt0');
    expect(memorial.rows.every((row) => row.distance > 100)).toBe(true);
    expect(memorial.area).toBeGreaterThan(30000);
    expect(memorial.perimeter).toBeGreaterThan(700);
  });

  it('uses the largest exterior polygon from a MultiPolygon', () => {
    const ring = extractExteriorRing({
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [0.1, 0], [0, 0.1], [0, 0]]],
        [[[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]],
      ],
    });
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual([1, 1]);
  });

  it('rejects non-polygon and incomplete geometries', () => {
    expect(() => extractExteriorRing({ type: 'Point', coordinates: [0, 0] }))
      .toThrow(MemorialGeometryError);
    expect(() => extractExteriorRing({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] }))
      .toThrow('ao menos três vértices');
  });

  it('formats zones and azimuths deterministically', () => {
    expect(utmZoneForLongitude(-52.1)).toBe(22);
    expect(formatDegreesMinutesSeconds(359.999999)).toBe('0°00\'00.0"');
    expect(formatDegreesMinutesSeconds(-10)).toBe('350°00\'00.0"');
  });
});

