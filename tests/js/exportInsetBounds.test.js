import { describe, expect, it } from 'vitest';
import {
  BRAZIL_MAINLAND_CLIP,
  computeCollectionBbox,
  computeBrazilOverviewBbox,
} from '@/components/map/export/geoPolygonUtils';

function polygonFeature(coordinates, properties = {}) {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'Polygon', coordinates },
  };
}

describe('brazil overview inset bounds', () => {
  it('clips remote Atlantic islands out of the overview bbox', () => {
    const mainland = polygonFeature([[
      [-73.9, -33.7],
      [-34.8, -33.7],
      [-34.8, 5.2],
      [-73.9, 5.2],
      [-73.9, -33.7],
    ]]);
    const trindade = polygonFeature([[
      [-29.4, -20.6],
      [-28.8, -20.6],
      [-28.8, -20.4],
      [-29.4, -20.4],
      [-29.4, -20.6],
    ]]);
    const collection = { type: 'FeatureCollection', features: [mainland, trindade] };

    const full = computeCollectionBbox(collection);
    const overview = computeBrazilOverviewBbox(collection);

    expect(full.maxLng).toBeCloseTo(-28.8, 5);
    expect(overview.maxLng).toBeLessThanOrEqual(BRAZIL_MAINLAND_CLIP.maxLng);
    expect(overview.maxLng).toBeCloseTo(-34.8, 5);
    expect(overview.minLng).toBeCloseTo(-73.9, 5);
  });

  it('clips MultiPolygon parts the same way as separate features', () => {
    const collection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { PAIS: 'Brasil' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[-73.9, -33.7], [-34.8, -33.7], [-34.8, 5.2], [-73.9, 5.2], [-73.9, -33.7]]],
            [[[-29.4, -20.6], [-28.8, -20.6], [-28.8, -20.4], [-29.4, -20.4], [-29.4, -20.6]]],
          ],
        },
      }],
    };

    const overview = computeBrazilOverviewBbox(collection);
    expect(overview.maxLng).toBeCloseTo(-34.8, 5);
    expect(overview.minLng).toBeCloseTo(-73.9, 5);
  });

  it('falls back to full bbox when every vertex is outside the mainland clip', () => {
    const remoteOnly = {
      type: 'FeatureCollection',
      features: [polygonFeature([[
        [-29.4, -20.6],
        [-28.8, -20.6],
        [-28.8, -20.4],
        [-29.4, -20.4],
        [-29.4, -20.6],
      ]])],
    };

    const overview = computeBrazilOverviewBbox(remoteOnly);
    expect(overview).toEqual(computeCollectionBbox(remoteOnly));
    expect(overview.maxLng).toBeCloseTo(-28.8, 5);
  });
});
