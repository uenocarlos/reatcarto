import { describe, expect, it } from 'vitest';
import {
  buildGraphicScaleOptions,
  cartographicElementIntersectsRect,
  shouldCheckElementCollision,
} from '@/components/map/export/MapChrome';

const map = {
  latLngToContainerPoint: ([lat, lng]) => ({ x: lng, y: lat }),
};

describe('cartographic collision geometry', () => {
  it('uses a double scale line on the main map and a single line in location maps', () => {
    expect(buildGraphicScaleOptions({ compact: true, maxWidth: 96 })).toMatchObject({
      doubleLine: false,
      fill: 'fill',
      showSubunits: false,
      lengthUnit: 'metric',
      position: 'bottomleft',
      labelPlacement: 'top',
      minUnitWidth: 40,
      maxUnitsWidth: 96,
    });
    expect(buildGraphicScaleOptions({ compact: false }).doubleLine).toBe(true);
    expect(buildGraphicScaleOptions({ compact: false }).minUnitWidth).toBe(50);
  });

  it('checks map features only for the legend', () => {
    expect(shouldCheckElementCollision('legend')).toBe(true);
    expect(shouldCheckElementCollision('north')).toBe(false);
    expect(shouldCheckElementCollision('scale')).toBe(false);
  });

  it('does not treat the whole bounding box of a line as occupied', () => {
    const line = {
      id: 'line-1',
      geojson: { type: 'LineString', coordinates: [[0, 0], [100, 100]] },
    };

    expect(cartographicElementIntersectsRect(map, line, {
      left: 70, right: 80, top: 0, bottom: 10,
    })).toBe(false);
    expect(cartographicElementIntersectsRect(map, line, {
      left: 45, right: 55, top: 45, bottom: 55,
    })).toBe(true);
  });

  it('checks polygon fill instead of only its bounding box', () => {
    const polygon = {
      id: 'polygon-1',
      geojson: {
        type: 'Polygon',
        coordinates: [[[0, 0], [100, 0], [0, 100], [0, 0]]],
      },
    };

    expect(cartographicElementIntersectsRect(map, polygon, {
      left: 75, right: 85, top: 75, bottom: 85,
    })).toBe(false);
    expect(cartographicElementIntersectsRect(map, polygon, {
      left: 10, right: 20, top: 10, bottom: 20,
    })).toBe(true);
  });
});
