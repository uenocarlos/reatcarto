import { describe, expect, it, vi } from 'vitest';
import {
  buildFeatureCollection,
  exportGeoJsonToFile,
  GisExportError,
} from '@/lib/gis/exportGeoJson';
import { buildGisExportFileName } from '@/lib/gis/exportFileName';
import { truncateShpFieldNames, truncateShpValues } from '@/lib/gis/shapefileLayers';

const point = {
  id: 'p1',
  name: 'Marco',
  description: 'desc',
  element_category: 'terra',
  element_type: 'point',
  geojson: { type: 'Point', coordinates: [-52.1234567, -32.9876543] },
  style: { icon_name: 'pin', icon_color: '#F97316' },
};

const line = {
  id: 'l1',
  name: 'Trilha',
  description: '',
  element_category: 'agua',
  element_type: 'line',
  geojson: JSON.stringify({
    type: 'LineString',
    coordinates: [[-52.1, -32.0], [-52.2, -32.1]],
  }),
  style: JSON.stringify({ color: '#00A', dash_style: 'solid' }),
};

const polygon = {
  id: 'g1',
  name: 'Área',
  description: '',
  element_category: 'conflito',
  element_type: 'polygon',
  geojson: {
    type: 'Polygon',
    coordinates: [[
      [-52.12, -32.03],
      [-52.08, -32.03],
      [-52.08, -32.05],
      [-52.12, -32.05],
      [-52.12, -32.03],
    ]],
  },
  style: { fill_color: '#FED7AA', border_color: '#F97316' },
};

describe('exportGeoJson', () => {
  it('UT-020: builds FeatureCollection for point, line and polygon', () => {
    const result = buildFeatureCollection([point, line, polygon]);
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(3);
    expect(result.features.map((f) => f.geometry.type)).toEqual([
      'Point',
      'LineString',
      'Polygon',
    ]);
    expect(result.features[0].geometry.coordinates[0]).toBeCloseTo(-52.123457, 6);
  });

  it('UT-021: maps element_category to properties.category', () => {
    const result = buildFeatureCollection([line]);
    expect(result.features[0].properties.category).toBe('agua');
  });

  it('UT-022: empty name exports as empty string', () => {
    const result = buildFeatureCollection([{ ...point, name: '' }]);
    expect(result.features[0].properties.name).toBe('');
  });

  it('UT-023: unicode and quotes in style survive JSON.stringify', () => {
    const result = buildFeatureCollection([{
      ...point,
      style: { icon_name: 'farol "Norte"', icon_color: '#áé' },
    }]);
    const json = JSON.stringify(result.features[0].properties);
    expect(json).toContain('farol \\"Norte\\"');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('UT-024: 5000 elements are not truncated', () => {
    const many = Array.from({ length: 5000 }, (_, index) => ({
      ...point,
      id: `p-${index}`,
      name: `P${index}`,
      geojson: { type: 'Point', coordinates: [-52 - (index / 1e6), -32] },
    }));
    const result = buildFeatureCollection(many);
    expect(result.features).toHaveLength(5000);
  });

  it('UT-025: elementIds filter keeps only selected features', () => {
    const result = buildFeatureCollection([point, line, polygon], {
      elementIds: ['p1', 'g1'],
    });
    expect(result.features).toHaveLength(2);
    expect(result.features.map((f) => f.properties.name)).toEqual(['Marco', 'Área']);
  });

  it('UT-026: unparseable geometry is omitted with warning', () => {
    const result = buildFeatureCollection([
      point,
      { id: 'bad', name: 'X', geojson: '{not-json' },
    ]);
    expect(result.features).toHaveLength(1);
    expect(result.warnings).toEqual([{ id: 'bad', reason: 'invalid_geometry' }]);
  });

  it('UT-027: hidden elements still export when selected', () => {
    const result = buildFeatureCollection([point], { elementIds: ['p1'] });
    expect(result.features).toHaveLength(1);
  });

  it('UT-028: locally modified unsynced geometry is exported', () => {
    const local = {
      ...point,
      geojson: { type: 'Point', coordinates: [-51, -31] },
    };
    const result = buildFeatureCollection([local]);
    expect(result.features[0].geometry.coordinates).toEqual([-51, -31]);
  });

  it('UT-029: preparedMapIncomplete sets incompleteWarning', () => {
    const result = buildFeatureCollection([point], { preparedMapIncomplete: true });
    expect(result.incompleteWarning).toBe(true);
  });

  it('UT-030: createObjectURL quota error becomes storage_error', async () => {
    await expect(exportGeoJsonToFile(
      { type: 'FeatureCollection', features: [] },
      'mapa.geojson',
      {
        createObjectURL: () => {
          throw new Error('QuotaExceededError');
        },
        documentRef: document,
      },
    )).rejects.toBeInstanceOf(GisExportError);

    try {
      await exportGeoJsonToFile(
        { type: 'FeatureCollection', features: [] },
        'mapa.geojson',
        {
          createObjectURL: () => {
            throw new Error('QuotaExceededError');
          },
          documentRef: document,
        },
      );
    } catch (error) {
      expect(error.code).toBe('storage_error');
    }
  });

  it('keeps GeoJSON download out of the app window', async () => {
    const createObjectURL = vi.fn(() => 'blob:reatcarto-test');
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mockClick() {
      expect(this.download).toBe('mapa.geojson');
      expect(this.target).toBe('reatcarto-download-frame');
    });
    await exportGeoJsonToFile(
      { type: 'FeatureCollection', features: [] },
      'mapa.geojson',
      { createObjectURL, revokeObjectURL, documentRef: document, isNative: () => false },
    );
    expect(click).toHaveBeenCalled();
    const frame = document.getElementById('reatcarto-download-frame');
    expect(frame).toBeTruthy();
    expect(frame.getAttribute('name')).toBe('reatcarto-download-frame');
    click.mockRestore();
  });
});

describe('shapefile field mapping', () => {
  it('UT-041: truncates description and border_color to 10 chars', () => {
    const mapped = truncateShpFieldNames(['description', 'border_color']);
    expect(mapped.description).toBe('descript');
    expect(mapped.border_color).toBe('border_col');
    expect(mapped.description.length).toBeLessThanOrEqual(10);
    expect(mapped.border_color.length).toBeLessThanOrEqual(10);
  });

  it('UT-042: values longer than 254 are truncated', () => {
    const result = truncateShpValues('x'.repeat(300));
    expect(result.value).toHaveLength(254);
    expect(result.truncated).toBe(true);
  });
});

describe('export file name', () => {
  it('slugifies map name and includes date', () => {
    const name = buildGisExportFileName('Mapa Costeiro', 'geojson', {
      date: new Date('2026-08-13T15:00:00'),
    });
    expect(name).toBe('mapa-costeiro-2026-08-13.geojson');
  });
});
