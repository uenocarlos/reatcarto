import { describe, expect, it } from 'vitest';
import {
  createEditorExportSnapshot,
  createDefaultExportSession,
  clampDpi,
  setFormat,
  setLegendColumns,
  setLegendInside,
  mapEditorBasemapToExport,
  truncateTitleForPreview,
  deriveDefaultLegendLayout,
} from '@/lib/export/session';

describe('export session factory & inheritance', () => {
  it('UT-001: defaults and inheritance from snapshot', () => {
    const snapshot = createEditorExportSnapshot({
      mapName: 'Estuário',
      basemap: 'osm',
      hiddenIds: ['e2'],
      center: { lat: -32, lng: -52 },
      zoom: 11,
      elements: [{ id: 'e1' }],
    });
    const session = createDefaultExportSession(snapshot);

    expect(session.title).toBe('Estuário');
    expect(session.format).toBe('png');
    expect(session.paper).toBe('a4');
    expect(session.orientation).toBe('landscape');
    expect(session.dpi).toBe(300);
    expect(session.legendPosition).toBe('inside');
    expect(session.locationCount).toBe(0);
    expect(session.basemap).toBe('osm');
    expect(session.hiddenIds.has('e2')).toBe(true);
  });

  it('UT-002: blank map name yields empty title', () => {
    const snapshot = createEditorExportSnapshot({ mapName: '' });
    const session = createDefaultExportSession(snapshot);
    expect(session.title).toBe('');
  });

  it('UT-006: default dpi is 300', () => {
    const session = createDefaultExportSession(createEditorExportSnapshot({ mapName: 'X' }));
    expect(session.dpi).toBe(300);
  });

  it('UT-014: hiddenIds copied, not shared mutable Set', () => {
    const hidden = new Set(['a', 'b', 'c']);
    const snapshot = createEditorExportSnapshot({
      mapName: 'M',
      basemap: 'satelite',
      hiddenIds: hidden,
      elements: [{ id: '1' }, { id: '2' }, { id: '3' }],
    });
    const session = createDefaultExportSession(snapshot);
    expect(session.basemap).toBe('satelite');
    expect([...session.hiddenIds]).toEqual(['a', 'b', 'c']);
    expect(session.hiddenIds).not.toBe(hidden);
    hidden.add('d');
    expect(session.hiddenIds.has('d')).toBe(false);
  });

  it('UT-016: session keeps snapshot elements frozen at open', () => {
    const elements = [{ id: 'e1', name: 'Original' }];
    const snapshot = createEditorExportSnapshot({ mapName: 'M', elements });
    const session = createDefaultExportSession(snapshot);
    elements.push({ id: 'e2' });
    elements[0].name = 'Mutated';
    expect(session.elements).toHaveLength(1);
    expect(session.elements[0].name).toBe('Original');
  });

  it('UT-018: non-public elements stay out of export snapshot', () => {
    const snapshot = createEditorExportSnapshot({
      mapName: 'M',
      elements: [
        { id: 'visible', name: 'Visible', is_publicly_visible: true },
        { id: 'hidden', name: 'Hidden', is_publicly_visible: false },
      ],
    });

    expect(snapshot.elements).toHaveLength(1);
    expect(snapshot.elements[0].id).toBe('visible');
  });

  it('UT-017: independent sessions per open', () => {
    const s1 = createDefaultExportSession(createEditorExportSnapshot({ mapName: 'A', dpi: 150 }));
    const s2 = createDefaultExportSession(createEditorExportSnapshot({ mapName: 'B' }));
    s1.dpi = 120;
    s1.legendPosition = 'right';
    expect(s2.dpi).toBe(300);
    expect(s2.legendPosition).toBe('inside');
    expect(s2.title).toBe('B');
  });
});

describe('DPI clamp', () => {
  it('UT-007: clamp boundaries', () => {
    expect(clampDpi(50).value).toBe(72);
    expect(clampDpi(900).value).toBe(600);
    expect(clampDpi(150).value).toBe(150);
  });

  it('UT-008: non-numeric retains previous', () => {
    const result = clampDpi('abc', { previous: 300 });
    expect(result.value).toBe(300);
    expect(result.nonNumeric).toBe(true);
    expect(result.ok).toBe(false);
  });
});

describe('format retention', () => {
  it('UT-009: format switch retains paper/orientation/dpi/legendPosition', () => {
    let session = createDefaultExportSession(createEditorExportSnapshot({ mapName: 'M' }));
    session = { ...session, paper: 'a3', orientation: 'portrait', dpi: 150, legendPosition: 'right' };
    session = setFormat(session, 'pdf');
    session = setFormat(session, 'png');
    expect(session.paper).toBe('a3');
    expect(session.orientation).toBe('portrait');
    expect(session.dpi).toBe(150);
    expect(session.legendPosition).toBe('right');
  });
});

describe('title preview helper', () => {
  it('UT-013: long title bounded without throw', () => {
    const long = 'A'.repeat(500);
    const result = truncateTitleForPreview(long);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(501);
  });
});

describe('basemap mapping', () => {
  it('UT-015: known keys and unknown fallback', () => {
    expect(mapEditorBasemapToExport('branco')).toBe('branco');
    expect(mapEditorBasemapToExport('osm')).toBe('osm');
    expect(mapEditorBasemapToExport('satelite')).toBe('satelite');
    expect(mapEditorBasemapToExport('unknown')).toBe('branco');
  });
});

describe('legend columns last-write-wins', () => {
  it('UT-012: rapid setLegendColumns ends at 6', () => {
    let session = createDefaultExportSession(createEditorExportSnapshot({ mapName: 'M' }));
    for (let i = 1; i <= 10; i += 1) {
      session = setLegendColumns(session, i === 10 ? 6 : i);
    }
    expect(session.legendColumns).toBe(6);
  });
});

describe('adaptive default legend layout', () => {
  it('counts visible items and increases columns while reducing font size', () => {
    const elements = Array.from({ length: 32 }, (_, index) => ({
      id: `item-${index}`,
      name: `Item ${index}`,
      element_type: 'point',
      element_category: 'terra',
      style: {},
    }));
    const layout = deriveDefaultLegendLayout(elements, new Set(['item-0', 'item-1']));

    expect(layout.itemCount).toBe(30);
    expect(layout.columns).toBe(4);
    expect(layout.fontPx).toBe(9);
    expect(layout.inside.wPct).toBeGreaterThan(30);
    expect(layout.inside.hPct).toBeLessThanOrEqual(90);
    expect(layout.inside.xPct + layout.inside.wPct).toBe(97);
    expect(layout.inside.yPct + layout.inside.hPct).toBe(97);
  });
});

describe('legend inside metrics sticky', () => {
  it('UT-026: legendInside metrics persist on read', () => {
    let session = createDefaultExportSession(createEditorExportSnapshot({ mapName: 'M' }));
    session = setLegendInside(session, { xPct: 10, yPct: 20, wPct: 30, hPct: 40 });
    expect(session.legendInside).toEqual({ xPct: 10, yPct: 20, wPct: 30, hPct: 40 });
    const again = setLegendInside(session, {});
    expect(again.legendInside).toEqual({ xPct: 10, yPct: 20, wPct: 30, hPct: 40 });
  });
});
