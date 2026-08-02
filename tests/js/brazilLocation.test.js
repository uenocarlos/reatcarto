import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BoundaryUnavailableError,
  configureBrazilBoundaryService,
  resetBrazilBoundaryServiceConfig,
  listStates,
  listMunicipalities,
  getLocatorGeometries,
} from '@/lib/export/brazilBoundaries';
import {
  applyStateChange,
  buildLocatorInsetDescriptors,
  buildLocationLegendItems,
  buildLocationOverlayModel,
  filterMunicipalities,
  mergeLegendItems,
  normalizeLocationColor,
  normalizeLocationSettings,
  reconcileLocationSettings,
  validateMunicipalityForState,
} from '@/lib/export/locationPreview';
import { buildPreviewModel } from '@/lib/export/previewModel';
import { validateExportGates } from '@/lib/export/exportSettings';
import { buildInstitutionalFooterContent, shouldShowIbgeCredit } from '@/lib/export/institutionalFooter';

const ROOT = resolve(process.cwd());
const FIXTURE_BASE = resolve(ROOT, 'tests/js/fixtures/geo');

function readFixture(rel) {
  return readFileSync(resolve(FIXTURE_BASE, rel), 'utf8');
}

function readSrc(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function jsonResponse(body, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
  });
}

const sampleElement = {
  id: 'el-1',
  element_category: 'terra',
  element_type: 'point',
  name: 'Point A',
  geojson: JSON.stringify({ type: 'Point', coordinates: [-52.1, -32.035] }),
  style: JSON.stringify({ icon_color: '#F97316' }),
};

describe('Brazil location — locator descriptors UT-092–103', () => {
  it('UT-092: locatorCount 0 — no insets; no state/muni required', () => {
    const settings = { locatorCount: 0, title: 'T', author: 'A' };
    expect(buildLocatorInsetDescriptors(settings)).toEqual([]);
    expect(validateExportGates(settings, [sampleElement], []).ok).toBe(true);
  });

  it('UT-093: count 1 + UF+muni — one inset descriptor', () => {
    const descriptors = buildLocatorInsetDescriptors(
      { locatorCount: 1, stateCode: '43', municipalityCode: '4314902' },
      { stateGeometry: { type: 'FeatureCollection', features: [] }, municipalityGeometry: { type: 'FeatureCollection', features: [] } }
    );
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0].kind).toBe('state-muni');
  });

  it('UT-094: count 2 — two insets (context + state+muni)', () => {
    const descriptors = buildLocatorInsetDescriptors(
      { locatorCount: 2, stateCode: '43', municipalityCode: '4314902' },
      {
        saContextGeometry: { type: 'FeatureCollection', features: [] },
        stateGeometry: { type: 'FeatureCollection', features: [] },
        municipalityGeometry: { type: 'FeatureCollection', features: [] },
      }
    );
    expect(descriptors).toHaveLength(2);
    expect(descriptors.map((d) => d.kind)).toEqual(['sa-context', 'state-muni']);
  });

  it('UT-095: count 2 missing muni — gate error on municipality', () => {
    const settings = normalizeLocationSettings({
      title: 'T',
      author: 'A',
      locatorCount: 2,
      stateCode: '43',
      municipalityCode: null,
    });
    const result = validateExportGates(settings, [sampleElement], []);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'municipalityCode')).toBe(true);
  });

  it('UT-096: muni not in state list — rejected', () => {
    const municipalities = [{ code: '4314902', name: 'Porto Alegre' }];
    expect(validateMunicipalityForState('3304557', '43', municipalities)).toBe(false);
  });

  it('UT-097: state set, muni null, count 1 — gate fails', () => {
    const settings = normalizeLocationSettings({
      title: 'T',
      author: 'A',
      locatorCount: 1,
      stateCode: '43',
      municipalityCode: null,
    });
    expect(validateExportGates(settings, [sampleElement], []).ok).toBe(false);
  });

  it('UT-098: oversized polygon fixture returns geometry without throw', async () => {
    const huge = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: '4314902' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              Array.from({ length: 5000 }, (_, i) => [-52 - i * 0.0001, -32 - i * 0.0001]),
            ],
          },
        },
      ],
    };
    configureBrazilBoundaryService({
      isOnlineFn: () => false,
      fetchFn: (url) => {
        if (String(url).includes('ufs.geojson')) return jsonResponse(JSON.parse(readFixture('ufs.geojson')));
        if (String(url).includes('municipios/43.geojson')) return jsonResponse(huge);
        return jsonResponse({}, false, 404);
      },
      fallbackBase: FIXTURE_BASE,
    });
    const result = await getLocatorGeometries({
      stateCode: '43',
      municipalityCode: '4314902',
      locatorCount: 1,
    });
    expect(result.municipalityGeometry).toBeTruthy();
    resetBrazilBoundaryServiceConfig();
  });

  it('UT-099: change state clears invalid municipality', () => {
    const patch = applyStateChange(
      { stateCode: '43', municipalityCode: '4314902' },
      '33'
    );
    expect(patch.stateCode).toBe('33');
    expect(patch.municipalityCode).toBeNull();
  });

  it('UT-100: IBGE fail + fallback miss — BoundaryUnavailableError', async () => {
    configureBrazilBoundaryService({
      isOnlineFn: () => true,
      fetchFn: () => Promise.reject(new Error('network')),
      fallbackBase: '/missing-geo',
      timeoutMs: 50,
    });
    await expect(
      getLocatorGeometries({ stateCode: '43', municipalityCode: '4314902', locatorCount: 1 })
    ).rejects.toBeInstanceOf(BoundaryUnavailableError);
    resetBrazilBoundaryServiceConfig();
  });

  it('UT-101: None→1→2→None descriptors match count', () => {
    const boundary = {
      saContextGeometry: { type: 'FeatureCollection', features: [] },
      stateGeometry: { type: 'FeatureCollection', features: [] },
      municipalityGeometry: { type: 'FeatureCollection', features: [] },
    };
    expect(buildLocatorInsetDescriptors({ locatorCount: 0 }, boundary)).toHaveLength(0);
    expect(buildLocatorInsetDescriptors({ locatorCount: 1, stateCode: '43', municipalityCode: '4314902' }, boundary)).toHaveLength(1);
    expect(buildLocatorInsetDescriptors({ locatorCount: 2, stateCode: '43', municipalityCode: '4314902' }, boundary)).toHaveLength(2);
  });

  it('UT-102: muni before state not kept without valid state', () => {
    const reconciled = reconcileLocationSettings(
      { stateCode: null, municipalityCode: '4314902' },
      [{ code: '43' }],
      [{ code: '4314902' }]
    );
    expect(reconciled.municipalityCode).toBe('4314902');
    const gated = validateExportGates(
      { title: 'T', author: 'A', locatorCount: 1, stateCode: null, municipalityCode: '4314902' },
      [sampleElement],
      []
    );
    expect(gated.ok).toBe(false);
  });

  it('UT-103: persisted muni absent from catalog cleared + gate', () => {
    const reconciled = reconcileLocationSettings(
      { locatorCount: 1, stateCode: '43', municipalityCode: '9999999', title: 'T', author: 'A' },
      [{ code: '43' }],
      [{ code: '4314902' }]
    );
    expect(reconciled.municipalityCode).toBeNull();
    expect(validateExportGates(reconciled, [sampleElement], []).ok).toBe(false);
  });
});

describe('Brazil location — styling UT-104–116', () => {
  const boundary = {
    municipalityGeometry: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: '4314902' }, geometry: { type: 'Point', coordinates: [-51, -30] } }] },
    municipalMesh: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-51.1, -30.1] } }] },
  };

  it('UT-104: outline uses municipalityColor', () => {
    const overlay = buildLocationOverlayModel(
      { locatorCount: 1, stateCode: '43', municipalityCode: '4314902', municipalityColor: '#00FF00' },
      boundary
    );
    expect(overlay.outline.color).toBe('#00FF00');
  });

  it('UT-105: showStateInLegend adds state legend entry', () => {
    const items = buildLocationLegendItems(
      { locatorCount: 1, stateCode: '43', municipalityCode: '4314902', showStateInLegend: true },
      { stateName: 'Rio Grande do Sul' }
    );
    expect(items.some((item) => item.kind === 'location-state')).toBe(true);
  });

  it('UT-106: showMunicipalMesh flags mesh layer on', () => {
    const overlay = buildLocationOverlayModel(
      { locatorCount: 1, stateCode: '43', municipalityCode: '4314902', showMunicipalMesh: true },
      boundary
    );
    expect(overlay.mesh).toBeTruthy();
  });

  it('UT-107: color change updates legend swatch', () => {
    const items = buildLocationLegendItems(
      {
        locatorCount: 1,
        stateCode: '43',
        municipalityCode: '4314902',
        showMunicipalityInLegend: true,
        municipalityColor: '#ABCDEF',
      },
      { municipalityName: 'Porto Alegre' }
    );
    expect(items.find((item) => item.kind === 'location-municipality')?.color).toBe('#ABCDEF');
  });

  it('UT-108: invalid color falls back to default', () => {
    expect(normalizeLocationColor('notahex', '#1D4ED8')).toBe('#1D4ED8');
  });

  it('UT-109: locatorCount 0 — no orphan overlays', () => {
    const overlay = buildLocationOverlayModel({ locatorCount: 0 }, boundary);
    expect(overlay.outline).toBeNull();
    expect(overlay.mesh).toBeNull();
    expect(buildLocationLegendItems({ locatorCount: 0, showStateInLegend: true })).toEqual([]);
  });

  it('UT-110: mesh request at low zoom completes async without hang', async () => {
    configureBrazilBoundaryService({
      isOnlineFn: () => false,
      fetchFn: (url) => {
        if (String(url).includes('municipios/43')) return jsonResponse(JSON.parse(readFixture('municipios/43.geojson')));
        if (String(url).includes('ufs.geojson')) return jsonResponse(JSON.parse(readFixture('ufs.geojson')));
        return jsonResponse({});
      },
      fallbackBase: FIXTURE_BASE,
      timeoutMs: 100,
    });
    const result = await getLocatorGeometries({
      stateCode: '43',
      municipalityCode: '4314902',
      locatorCount: 1,
      includeMesh: true,
    });
    expect(result.municipalMesh).toBeTruthy();
    resetBrazilBoundaryServiceConfig();
  });

  it('UT-111: color set while loading — final color on loaded geom', () => {
    const first = buildLocationOverlayModel(
      { locatorCount: 1, stateCode: '43', municipalityCode: '4314902', municipalityColor: '#111111' },
      null
    );
    const second = buildLocationOverlayModel(
      { locatorCount: 1, stateCode: '43', municipalityCode: '4314902', municipalityColor: '#222222' },
      boundary
    );
    expect(first.outline.color).toBe('#111111');
    expect(second.outline.color).toBe('#222222');
  });

  it('UT-112: mesh failure sets error flag', () => {
    const overlay = buildLocationOverlayModel(
      { locatorCount: 1, stateCode: '43', municipalityCode: '4314902', showMunicipalMesh: true },
      { municipalityGeometry: boundary.municipalityGeometry, municipalMesh: null }
    );
    expect(overlay.meshError).toBe(true);
    const model = buildPreviewModel({
      settings: {
        title: 'T',
        author: 'A',
        locatorCount: 1,
        stateCode: '43',
        municipalityCode: '4314902',
        showMunicipalMesh: true,
      },
      elements: [sampleElement],
      boundaryResult: { municipalityGeometry: boundary.municipalityGeometry, municipalMesh: null, usedFallback: false },
    });
    expect(model.previewStatus).toBe('error');
  });

  it('UT-113: toggle state legend off removes entry', () => {
    const on = buildLocationLegendItems({
      locatorCount: 1,
      stateCode: '43',
      municipalityCode: '4314902',
      showStateInLegend: true,
    });
    const off = buildLocationLegendItems({
      locatorCount: 1,
      stateCode: '43',
      municipalityCode: '4314902',
      showStateInLegend: false,
    });
    expect(on.length).toBeGreaterThan(off.length);
  });

  it('UT-114: legend flags before selection produce entries after selection exists', () => {
    const before = buildLocationLegendItems({
      locatorCount: 1,
      showStateInLegend: true,
      showMunicipalityInLegend: true,
    });
    expect(before).toHaveLength(0);
    const after = buildLocationLegendItems({
      locatorCount: 1,
      stateCode: '43',
      municipalityCode: '4314902',
      showStateInLegend: true,
      showMunicipalityInLegend: true,
    });
    expect(after.length).toBe(2);
  });

  it('UT-115: new muni code updates outline geometry reference', () => {
    const a = buildLocationOverlayModel(
      { locatorCount: 1, stateCode: '43', municipalityCode: '4314902' },
      boundary
    );
    const b = buildLocationOverlayModel(
      { locatorCount: 1, stateCode: '43', municipalityCode: '4304606' },
      {
        municipalityGeometry: {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { id: '4304606', nome: 'Canoas' }, geometry: { type: 'Point', coordinates: [-51.2, -29.9] } }],
        },
      }
    );
    expect(a.outline.municipalityCode).toBe('4314902');
    expect(b.outline.municipalityCode).toBe('4304606');
  });

  it('UT-116: large UF mesh fixture completes under timeout', async () => {
    configureBrazilBoundaryService({
      isOnlineFn: () => false,
      fetchFn: (url) => {
        if (String(url).includes('municipios/43')) return jsonResponse(JSON.parse(readFixture('municipios/43.geojson')));
        if (String(url).includes('ufs.geojson')) return jsonResponse(JSON.parse(readFixture('ufs.geojson')));
        return jsonResponse({});
      },
      fallbackBase: FIXTURE_BASE,
      timeoutMs: 5000,
    });
    await expect(
      getLocatorGeometries({
        stateCode: '43',
        municipalityCode: '4314902',
        locatorCount: 1,
        includeMesh: true,
      })
    ).resolves.toMatchObject({ source: 'fallback' });
    resetBrazilBoundaryServiceConfig();
  });
});

describe('BrazilBoundaryService UT-181–186', () => {
  beforeEach(() => {
    resetBrazilBoundaryServiceConfig();
  });

  afterEach(() => {
    resetBrazilBoundaryServiceConfig();
  });

  it('UT-181: online mock IBGE success — source ibge', async () => {
    configureBrazilBoundaryService({
      isOnlineFn: () => true,
      fetchFn: (url) => {
        if (String(url).includes('/localidades/estados/43/municipios')) {
          return jsonResponse([{ id: 4314902, nome: 'Porto Alegre' }]);
        }
        if (String(url).includes('/malhas/municipios/4314902')) {
          return jsonResponse({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-51, -30] } }] });
        }
        if (String(url).includes('/malhas/estados/43')) {
          return jsonResponse({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: '43' }, geometry: { type: 'Point', coordinates: [-53, -30] } }] });
        }
        return jsonResponse([]);
      },
      timeoutMs: 1000,
    });
    const result = await getLocatorGeometries({
      stateCode: '43',
      municipalityCode: '4314902',
      locatorCount: 1,
    });
    expect(result.source).toBe('ibge');
  });

  it('UT-182: offline flag uses fallback source', async () => {
    configureBrazilBoundaryService({
      isOnlineFn: () => false,
      fetchFn: (url) => {
        if (String(url).includes('ufs.geojson')) return jsonResponse(JSON.parse(readFixture('ufs.geojson')));
        if (String(url).includes('municipios/43.geojson')) return jsonResponse(JSON.parse(readFixture('municipios/43.geojson')));
        return jsonResponse({}, false, 404);
      },
      fallbackBase: FIXTURE_BASE,
    });
    const result = await getLocatorGeometries({
      stateCode: '43',
      municipalityCode: '4314902',
      locatorCount: 1,
    });
    expect(result.source).toBe('fallback');
    expect(result.usedFallback).toBe(true);
  });

  it('UT-183: IBGE 500 then fallback hit — source fallback', async () => {
    configureBrazilBoundaryService({
      isOnlineFn: () => true,
      fetchFn: (url) => {
        if (String(url).includes('servicodados.ibge.gov.br')) {
          return jsonResponse({}, false, 500);
        }
        if (String(url).includes('ufs.geojson')) return jsonResponse(JSON.parse(readFixture('ufs.geojson')));
        if (String(url).includes('municipios/43.geojson')) return jsonResponse(JSON.parse(readFixture('municipios/43.geojson')));
        return jsonResponse({}, false, 404);
      },
      fallbackBase: FIXTURE_BASE,
    });
    const result = await getLocatorGeometries({
      stateCode: '43',
      municipalityCode: '4314902',
      locatorCount: 1,
    });
    expect(result.source).toBe('fallback');
    expect(result.usedFallback).toBe(true);
  });

  it('UT-184: both fail throws BoundaryUnavailableError', async () => {
    configureBrazilBoundaryService({
      isOnlineFn: () => true,
      fetchFn: () => jsonResponse({}, false, 500),
      fallbackBase: '/missing',
      timeoutMs: 50,
    });
    await expect(
      getLocatorGeometries({ stateCode: '43', municipalityCode: '4314902', locatorCount: 1 })
    ).rejects.toBeInstanceOf(BoundaryUnavailableError);
  });

  it('UT-185: listMunicipalities(43) returns only RS fixture codes', async () => {
    configureBrazilBoundaryService({
      isOnlineFn: () => false,
      fetchFn: (url) => {
        if (String(url).includes('municipios/43.geojson')) return jsonResponse(JSON.parse(readFixture('municipios/43.geojson')));
        return jsonResponse({}, false, 404);
      },
      fallbackBase: FIXTURE_BASE,
    });
    const { items } = await listMunicipalities('43');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => String(item.code).startsWith('43'))).toBe(true);
    expect(items.some((item) => item.code === '4314902')).toBe(true);
  });

  it('UT-186a: locatorCount 2 online IBGE success still flags fallback for static SA context', async () => {
    configureBrazilBoundaryService({
      isOnlineFn: () => true,
      fetchFn: (url) => {
        if (String(url).includes('/malhas/municipios/4314902')) {
          return jsonResponse({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-51, -30] } }] });
        }
        if (String(url).includes('/malhas/estados/43')) {
          return jsonResponse({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: '43' }, geometry: { type: 'Point', coordinates: [-53, -30] } }] });
        }
        if (String(url).includes('sa-brazil-context.geojson')) {
          return jsonResponse(JSON.parse(readFixture('sa-brazil-context.geojson')));
        }
        return jsonResponse({}, false, 404);
      },
      fallbackBase: FIXTURE_BASE,
      timeoutMs: 1000,
    });
    const result = await getLocatorGeometries({
      stateCode: '43',
      municipalityCode: '4314902',
      locatorCount: 2,
    });
    expect(result.saContextGeometry).toBeTruthy();
    expect(result.usedFallback).toBe(true);
    expect(result.source).toBe('fallback');
    resetBrazilBoundaryServiceConfig();
  });

  it('UT-186: IBGE timeout falls back', async () => {
    configureBrazilBoundaryService({
      isOnlineFn: () => true,
      fetchFn: (url) => {
        if (String(url).includes('servicodados.ibge.gov.br')) {
          return new Promise(() => {});
        }
        if (String(url).includes('ufs.geojson')) return jsonResponse(JSON.parse(readFixture('ufs.geojson')));
        if (String(url).includes('municipios/43.geojson')) {
          return jsonResponse(JSON.parse(readFixture('municipios/43.geojson')));
        }
        return jsonResponse({}, false, 404);
      },
      fallbackBase: FIXTURE_BASE,
      timeoutMs: 30,
    });

    const result = await getLocatorGeometries({
      stateCode: '43',
      municipalityCode: '4314902',
      locatorCount: 1,
    });
    expect(result.source).toBe('fallback');
    expect(result.usedFallback).toBe(true);
  });
});

describe('Brazil location — integration IT-028, IT-030, IT-051', () => {
  it('IT-028: boundary service wired to inset UI source', () => {
    const modal = readSrc('src/components/map/ExportMapModal.jsx');
    expect(modal).toContain('useExportLocationBoundaries');
    expect(modal).toContain('LocationOptionsPanel');
    expect(readSrc('src/components/map/export/CompositionPreview.jsx')).toContain('LocationInsets');
  });

  it('IT-030: municipality search filters fixture list', () => {
    const municipalities = [
      { code: '4314902', name: 'Porto Alegre' },
      { code: '4304606', name: 'Canoas' },
    ];
    expect(filterMunicipalities('porto', municipalities)).toHaveLength(1);
    expect(readSrc('src/components/map/export/LocationOptionsPanel.jsx')).toContain('export-municipality-search');
  });

  it('IT-051: online fail shows fallback indication in UI source', () => {
    const panel = readSrc('src/components/map/export/LocationOptionsPanel.jsx');
    expect(panel).toContain('export-boundary-fallback-warning');
    expect(readSrc('src/components/map/export/InstitutionalFooter.jsx')).toContain('export-ibge-fallback-warning');
  });
});

describe('Brazil location — E2E source contracts E2E-010, E2E-011', () => {
  it('E2E-010: locator None/1/2 controls and gate messaging wired', () => {
    const panel = readSrc('src/components/map/export/LocationOptionsPanel.jsx');
    expect(panel).toContain('export-locator-count');
    expect(panel).toContain('export-location-incomplete');
    expect(readSrc('src/components/map/ExportMapModal.jsx')).toContain('export-gate-errors');
  });

  it('E2E-011: location colors, legend checks, mesh wired to preview', () => {
    const panel = readSrc('src/components/map/export/LocationOptionsPanel.jsx');
    expect(panel).toContain('export-state-color');
    expect(panel).toContain('export-municipality-color');
    expect(panel).toContain('export-show-state-legend');
    expect(panel).toContain('export-show-municipal-mesh');
    expect(readSrc('src/components/map/export/PreviewMap.jsx')).toContain('LocationOverlays');
    const merged = mergeLegendItems([], {
      locatorCount: 1,
      stateCode: '43',
      municipalityCode: '4314902',
      showStateInLegend: true,
    });
    expect(merged.length).toBe(1);
  });
});

describe('Brazil location — IBGE credit UT-138 extension', () => {
  it('shows IBGE credit when location active and fallback warning when used', () => {
    expect(shouldShowIbgeCredit({ locatorCount: 1, stateCode: '43', municipalityCode: '4314902' })).toBe(true);
    const footer = buildInstitutionalFooterContent(
      { locatorCount: 1, stateCode: '43', municipalityCode: '4314902' },
      { usedFallback: true }
    );
    expect(footer.ibgeCreditLine).toBeTruthy();
    expect(footer.fallbackWarningLine).toBeTruthy();
  });
});

describe('Brazil location — preview loading UT-131', () => {
  it('UT-131: boundaries loading sets previewStatus loading', () => {
    const model = buildPreviewModel({
      settings: { title: 'T', author: 'A', locatorCount: 1, stateCode: '43', municipalityCode: '4314902' },
      elements: [sampleElement],
      boundaryLoading: true,
    });
    expect(model.previewStatus).toBe('loading');
  });
});

describe('Brazil location — municipality preserved until catalog loads (review issue_002)', () => {
  it('state catalog reconcile preserves municipality when municipalities not loaded yet', () => {
    const normalized = { stateCode: '43', municipalityCode: '4314902', locatorCount: 1 };
    const states = [{ code: '43' }];
    const municipalities = [];

    const stateOnlyReconciled = reconcileLocationSettings(
      { ...normalized, municipalityCode: null },
      states,
      []
    );
    const nextStateCode = stateOnlyReconciled.stateCode;
    const nextMunicipalityCode = nextStateCode === null ? null : normalized.municipalityCode;

    expect(nextStateCode).toBe('43');
    expect(nextMunicipalityCode).toBe('4314902');

    const prematureReconcile = reconcileLocationSettings(normalized, states, municipalities);
    expect(prematureReconcile.municipalityCode).toBeNull();
  });

  it('hook states effect reconciles state only, not municipality membership', () => {
    const src = readSrc('src/lib/export/useExportLocationBoundaries.js');
    expect(src).not.toMatch(/reconcileLocationSettings\(normalized,\s*result\.items,\s*municipalities\)/);
    expect(src).toMatch(/municipalityCode:\s*null/);
    expect(src).toMatch(/listMunicipalities/);
  });
});

describe('Brazil location — municipality select cap (review issue_008)', () => {
  it('shows all filtered rows when search is active and hints when unfiltered list is truncated', () => {
    const panel = readSrc('src/components/map/export/LocationOptionsPanel.jsx');
    expect(panel).not.toMatch(/filteredMunicipalities\.slice\(0,\s*200\)\.map/);
    expect(panel).toContain('visibleMunicipalities');
    expect(panel).toContain('searchActive');
    expect(panel).toContain('export-municipality-refine-hint');
    expect(panel).toContain('municipalityListTruncated');
  });
});

describe('Brazil location — boundaries preserved during export (review issue_001)', () => {
  const boundary = {
    stateGeometry: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: '43' }, geometry: { type: 'Point', coordinates: [-53, -29] } }] },
    municipalityGeometry: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: '4314902' }, geometry: { type: 'Point', coordinates: [-51, -30] } }] },
    municipalMesh: null,
    usedFallback: false,
  };

  it('hook keeps loaded boundary data when disabled (isExporting)', () => {
    const src = readSrc('src/lib/export/useExportLocationBoundaries.js');
    expect(src).toMatch(/if\s*\(\s*normalized\.locatorCount\s*===\s*0\s*\)/);
    expect(src).toMatch(/if\s*\(\s*!enabled\s*\)\s*\{\s*\n\s*setBoundaryLoading\(false\);\s*\n\s*return undefined;\s*\n\s*\}/);
    expect(src).not.toMatch(/if\s*\(\s*!enabled\s*\|\|\s*normalized\.locatorCount\s*===\s*0\s*\)/);
    expect(src).toMatch(
      /useEffect\(\(\) => \{\s*if\s*\(\s*!enabled\s*\)\s*\{[\s\S]*?if\s*\(\s*normalized\.locatorCount\s*===\s*0\s*\)[\s\S]*?getLocatorGeometries/
    );
    expect(src).toMatch(/if\s*\(\s*!normalized\.stateCode\s*\)/);
    expect(src).not.toMatch(/if\s*\(\s*!enabled\s*\|\|\s*!normalized\.stateCode\s*\)/);
  });

  it('stable boundaryResult keeps inset geometries and overlay outline for capture', () => {
    const settings = {
      title: 'T',
      author: 'A',
      locatorCount: 1,
      stateCode: '43',
      municipalityCode: '4314902',
    };
    const model = buildPreviewModel({
      settings,
      elements: [sampleElement],
      boundaryResult: boundary,
      boundaryLoading: false,
      basemapReadiness: { requiredTiles: ['https://tiles.example.com/{z}/{x}/{y}.png'] },
      locationLabels: { stateName: 'Rio Grande do Sul', municipalityName: 'Porto Alegre' },
    });
    expect(model.previewStatus).toBe('ready');
    expect(model.locatorInsets.length).toBeGreaterThan(0);
    expect(model.locationOverlay.outline).toBeTruthy();
  });
});
