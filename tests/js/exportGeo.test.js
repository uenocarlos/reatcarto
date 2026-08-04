import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  loadGeoBoundaries,
  filterMunicipalitiesByUf,
  validateLocationSelection,
  allowsDuplicateUfLocations,
  resetGeoBoundariesCache,
  normalizeStatesCollection,
  normalizeMunicipalitiesCollection,
} from '@/lib/export/geoBoundaries';
import { setLocationCount, createDefaultExportSession, createEditorExportSnapshot } from '@/lib/export/session';

const ufsFixture = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { CD_UF: '43', SIGLA_UF: 'RS', NM_UF: 'Rio Grande do Sul' }, geometry: null },
  ],
};

const rsMunicipiosFixture = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { CD_MUN: '4314902', NM_MUN: 'Porto Alegre', SIGLA_UF: 'RS' }, geometry: null },
    { type: 'Feature', properties: { CD_MUN: '4304606', NM_MUN: 'Canoas', SIGLA_UF: 'RS' }, geometry: null },
  ],
};

describe('geo boundaries', () => {
  beforeEach(() => {
    resetGeoBoundariesCache();
  });

  it('UT-050: load normalizes and caches', async () => {
    const fetchFn = vi.fn(async (url) => {
      if (url === '/geo/ufs.geojson') {
        return { ok: true, json: async () => ufsFixture };
      }
      if (url === '/geo/municipios.geojson') {
        return { ok: true, json: async () => rsMunicipiosFixture };
      }
      return { ok: false, status: 404 };
    });

    const first = await loadGeoBoundaries({ fetchFn });
    expect(first.states.length).toBeGreaterThan(0);
    expect(first.municipalities.length).toBeGreaterThan(0);
    expect(first.fromCache).toBe(false);

    const second = await loadGeoBoundaries({ fetchFn });
    expect(second.fromCache).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('UT-051: filter municipalities by UF RS', () => {
    const municipalities = normalizeMunicipalitiesCollection(rsMunicipiosFixture);
    const filtered = filterMunicipalitiesByUf(municipalities, 'RS');
    expect(filtered.every((m) => m.uf === 'RS')).toBe(true);
    expect(filtered.length).toBe(2);
  });

  it('UT-052: 404 rejects and cache not successful', async () => {
    resetGeoBoundariesCache();
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 }));
    await expect(loadGeoBoundaries({ fetchFn })).rejects.toThrow();
    resetGeoBoundariesCache();
    const callsAfterFail = vi.fn(async () => ({ ok: false, status: 404 }));
    await expect(loadGeoBoundaries({ fetchFn: callsAfterFail })).rejects.toThrow();
    expect(callsAfterFail).toHaveBeenCalled();
  });

  it('UT-053: incomplete selection when uf null', () => {
    const result = validateLocationSelection({
      locationCount: 1,
      locations: [{ uf: null, municipioCode: null }],
    });
    expect(result.ok).toBe(false);
    expect(result.incomplete).toBe(true);
  });

  it('UT-054: two locations same UF allowed', () => {
    const locations = [{ uf: 'RS' }, { uf: 'RS' }];
    expect(validateLocationSelection({ locationCount: 2, locations }).ok).toBe(true);
    expect(allowsDuplicateUfLocations(locations)).toBe(true);
  });

  it('UT-055: locationCount 2 to 0 clears entries', () => {
    let session = createDefaultExportSession(createEditorExportSnapshot({ mapName: 'M' }));
    session = {
      ...session,
      locationCount: 2,
      locations: [{ uf: 'RS', municipioCode: '4314902' }, { uf: 'SC', municipioCode: '4205407' }],
    };
    session = setLocationCount(session, 0);
    expect(session.locationCount).toBe(0);
    expect(session.locations.every((l) => l.uf === null)).toBe(true);
  });

  it('normalizes state properties', () => {
    const states = normalizeStatesCollection(ufsFixture);
    expect(states[0]).toEqual({ uf: 'RS', name: 'Rio Grande do Sul', code: '43' });
  });
});
