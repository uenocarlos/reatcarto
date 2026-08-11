import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  searchCities,
  resetMunicipalitySearchIndexCache,
} from '@/lib/geocodeCities';

const SAMPLE_INDEX = {
  version: 1,
  count: 3,
  municipalities: [
    {
      code: '4314902',
      name: 'Porto Alegre',
      uf: 'RS',
      state: 'Rio Grande do Sul',
      lat: -30.03,
      lng: -51.23,
      bbox: [
        [-30.27, -51.3],
        [-29.93, -51.01],
      ],
    },
    {
      code: '4314407',
      name: 'Pelotas',
      uf: 'RS',
      state: 'Rio Grande do Sul',
      lat: -31.77,
      lng: -52.34,
      bbox: [
        [-31.9, -52.5],
        [-31.6, -52.2],
      ],
    },
    {
      code: '3304557',
      name: 'Rio de Janeiro',
      uf: 'RJ',
      state: 'Rio de Janeiro',
      lat: -22.9,
      lng: -43.2,
      bbox: [
        [-23.1, -43.8],
        [-22.7, -43.1],
      ],
    },
  ],
};

describe('searchCities (índice local)', () => {
  beforeEach(() => {
    resetMunicipalitySearchIndexCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => SAMPLE_INDEX,
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetMunicipalitySearchIndexCache();
  });

  it('retorna lista vazia para query curta', async () => {
    await expect(searchCities('a')).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('busca município pelo nome no índice local', async () => {
    const results = await searchCities('Porto Alegre');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      label: 'Porto Alegre, RS',
      lat: -30.03,
      lng: -51.23,
      placeType: 'municipality',
      uf: 'RS',
    });
    expect(results[0].bbox).toEqual([
      [-30.27, -51.3],
      [-29.93, -51.01],
    ]);
    expect(fetch).toHaveBeenCalledWith(
      '/geo/municipios-search-index.json',
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    );
  });

  it('é acentuação-insensível e prioriza prefixo', async () => {
    const results = await searchCities('pelot');
    expect(results[0].label).toBe('Pelotas, RS');
  });

  it('reutiliza o índice em cache', async () => {
    await searchCities('rio');
    await searchCities('porto');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
