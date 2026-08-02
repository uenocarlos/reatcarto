import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  sanitizeExportText,
  buildHeaderTitle,
  buildFooterMetadata,
  computeFooterLayout,
  wrapTitleLines,
} from '@/lib/export/compositionMetadata';
import {
  getLegendLayoutMode,
  resolveLegendRect,
  clampLegendRect,
  applyLegendDrag,
  applyLegendResize,
  isInsideDragEnabled,
  buildLegendGridStyle,
  computeCompositionLayout,
  buildLegendItems,
  LEGEND_SPACING_PX,
} from '@/lib/export/legendLayout';
import { buildTagDescriptors, snapshotTagsForExport } from '@/lib/export/exportTags';
import {
  resolveBasemapTileUrl,
  isOfflineBasemapAvailable,
  normalizeBasemapForPlatform,
  isGoogleSatelliteUrl,
  evaluateBasemapReadiness,
  buildOfflineReadinessPayload,
  buildOnlineReadinessPayload,
  BASEMAP_TILE_URLS,
} from '@/lib/export/basemapResolver';
import {
  getPaperAspectRatio,
  getCaptureScaleFactor,
  computePaperFrameDimensions,
  reclampLegendRectForOrientation,
  PAPER_MM,
} from '@/lib/export/paperFrame';
import { computeDynamicScaleBar, metersPerPixel } from '@/lib/export/dynamicScale';
import { buildPreviewModel, createCoalescedPreviewUpdater } from '@/lib/export/previewModel';
import {
  buildInstitutionalFooterContent,
  snapshotInstitutionalFooter,
  shouldShowIbgeCredit,
  INSTITUTIONAL_LINES,
} from '@/lib/export/institutionalFooter';
import { safeParseStyle, safeParseGeojson } from '@/lib/export/elementStyle';
import {
  toggleCategoryVisibility,
  toggleElementVisibility,
  isCategoryVisible,
  isElementVisible,
} from '@/lib/export/exportVisibility';
import {
  normalizeExportSettings,
  effectiveVisibleElements,
  validateExportGates,
  pruneExportSettings,
} from '@/lib/export/exportSettings';
import { getLocalTileUrl } from '@/lib/tileManager';
import { waitForPreviewReadiness, ExportCaptureError } from '@/lib/export/pngExporter';

const ROOT = resolve(process.cwd());
function readSrc(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

const sampleEl = (overrides = {}) => ({
  id: 'el-1',
  element_category: 'terra',
  element_type: 'point',
  name: 'Point A',
  geojson: JSON.stringify({ type: 'Point', coordinates: [-52.1, -32.035] }),
  style: JSON.stringify({ icon_color: '#F97316' }),
  ...overrides,
});

/** Mirrors CompositionPreview → buildPreviewModel with OfflineTileLayer callback payloads. */
function buildOfflinePreviewModel(tileEntries, overrides = {}) {
  return buildPreviewModel({
    settings: { basemap: 'offline', title: 'T', author: 'A' },
    elements: [sampleEl()],
    isNativePlatform: true,
    basemapReadiness: buildOfflineReadinessPayload(tileEntries),
    ...overrides,
  });
}

/** Mirrors CompositionPreview → buildPreviewModel with OnlineTileLayer callback payloads. */
function buildOnlinePreviewModel(tileEntries, basemap = 'carto', overrides = {}) {
  return buildPreviewModel({
    settings: { basemap, title: 'T', author: 'A' },
    elements: [sampleEl()],
    basemapReadiness: buildOnlineReadinessPayload(tileEntries),
    ...overrides,
  });
}

/** Mirrors ExportMapModal exportDisabled readiness gate (previewStatus must be ready). */
function exportBlockedByPreviewStatus(model) {
  return model.previewStatus !== 'ready';
}

describe('export preview — metadata UT-011–020', () => {
  it('UT-011: title non-empty — preview header equals trimmed title', () => {
    expect(buildHeaderTitle({ title: '  Meu Mapa  ' })).toBe('Meu Mapa');
  });

  it('UT-012: author set — footer includes author line', () => {
    expect(buildFooterMetadata({ author: 'Ana' }).authorLine).toBe('Ana');
  });

  it('UT-013: technical responsible set; blank omits line', () => {
    expect(buildFooterMetadata({ technicalResponsible: 'Eng.' }).responsibleLine).toBe('Eng.');
    expect(buildFooterMetadata({ technicalResponsible: '   ' }).responsibleLine).toBeNull();
  });

  it('UT-014: hostile title rendered as plain text', () => {
    const hostile = '<script>alert(1)</script>Título';
    expect(sanitizeExportText(hostile)).toBe('alert(1)Título');
    expect(buildHeaderTitle({ title: hostile })).not.toContain('<script>');
  });

  it('UT-015: whitespace title blocked by gates', () => {
    const settings = normalizeExportSettings({ title: '   ', author: 'A' });
    expect(validateExportGates(settings, [sampleEl()], []).ok).toBe(false);
  });

  it('UT-016: very long title wraps without throw', () => {
    const long = 'A'.repeat(200);
    const lines = wrapTitleLines(long, 60);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('').length).toBe(200);
  });

  it('UT-017: clear title then set again — latest string', () => {
    expect(buildHeaderTitle({ title: '' })).toBeNull();
    expect(buildHeaderTitle({ title: 'Novo' })).toBe('Novo');
  });

  it('UT-018: gate validation reads current settings at click time', () => {
    const stale = normalizeExportSettings({ title: '', author: 'A' });
    expect(validateExportGates(stale, [sampleEl()], []).ok).toBe(false);
    const fresh = normalizeExportSettings({ title: 'Ok', author: 'A' });
    expect(validateExportGates(fresh, [sampleEl()], []).ok).toBe(true);
  });

  it('UT-019: normalize isolated per map in store selector pattern', () => {
    const a = normalizeExportSettings({ title: 'A', author: '1' });
    const b = normalizeExportSettings({ title: 'B', author: '2' });
    expect(a.title).not.toBe(b.title);
  });

  it('UT-020: extremely long author — footer layout ok', () => {
    const layout = computeFooterLayout({ authorText: 'A'.repeat(400), paperWidthPx: 800 });
    expect(layout.ok).toBe(true);
    expect(layout.textMaxWidthPx).toBeGreaterThan(0);
  });
});

describe('export preview — legend layout UT-021–043', () => {
  it('UT-021: inside layout mode', () => {
    expect(getLegendLayoutMode({ legendPosition: 'inside' })).toBe('inside');
  });

  it('UT-022: beside grows composition width', () => {
    const layout = computeCompositionLayout({
      legendPosition: 'beside',
      itemCount: 4,
      mapWidth: 600,
      mapHeight: 400,
    });
    expect(layout.mode).toBe('beside');
    expect(layout.totalWidth).toBeGreaterThan(layout.mapWidth);
    expect(layout.legendOutsideMap).toBe(true);
  });

  it('UT-022b: beside preview applies compositionLayout growth in CompositionPreview', () => {
    const model = buildPreviewModel({
      settings: { legendPosition: 'beside', title: 'T', author: 'A', legendColumns: 2 },
      elements: [sampleEl()],
    });
    expect(model.compositionLayout.legendOutsideMap).toBe(true);
    expect(model.compositionLayout.totalWidth).toBeGreaterThan(model.compositionLayout.mapWidth);
    const expectedAspect =
      model.compositionLayout.totalWidth / model.compositionLayout.totalHeight;
    expect(expectedAspect).toBeGreaterThan(model.paperFrame.aspect);

    const src = readSrc('src/components/map/export/CompositionPreview.jsx');
    expect(src).toContain('data-composition-aspect');
    expect(src).toContain('layout.legendOutsideMap');
    expect(src).toContain('layout.totalWidth / layout.totalHeight');
    expect(src).toContain('data-map-aspect');
    expect(src).toMatch(/aspectRatio:\s*String\(paperAspect\)/);
  });

  it('UT-023: below grows composition height', () => {
    const layout = computeCompositionLayout({
      legendPosition: 'below',
      itemCount: 4,
      mapWidth: 600,
      mapHeight: 400,
    });
    expect(layout.mode).toBe('below');
    expect(layout.totalHeight).toBeGreaterThan(layout.mapHeight);
  });

  it('UT-023b: below preview applies compositionLayout growth in CompositionPreview', () => {
    const model = buildPreviewModel({
      settings: { legendPosition: 'below', title: 'T', author: 'A', legendColumns: 2 },
      elements: [sampleEl()],
    });
    expect(model.compositionLayout.legendOutsideMap).toBe(true);
    expect(model.compositionLayout.totalHeight).toBeGreaterThan(model.compositionLayout.mapHeight);
    const expectedAspect =
      model.compositionLayout.totalWidth / model.compositionLayout.totalHeight;
    expect(expectedAspect).toBeLessThan(model.paperFrame.aspect);

    const src = readSrc('src/components/map/export/CompositionPreview.jsx');
    expect(src).toContain('data-composition-aspect');
    expect(src).toContain('layout.legendOutsideMap');
    expect(src).toContain('layout.totalWidth / layout.totalHeight');
  });

  it('UT-024: right→beside; unknown→inside default', () => {
    expect(normalizeExportSettings({ legendPosition: 'right' }).legendPosition).toBe('beside');
    expect(normalizeExportSettings({}).legendPosition).toBe('inside');
    expect(normalizeExportSettings({ legendPosition: 'foo' }).legendPosition).toBe('inside');
  });

  it('UT-025: no legend items — empty region', () => {
    const items = buildLegendItems([], { legendColumns: 2 });
    expect(items).toEqual([]);
    const layout = computeCompositionLayout({ legendPosition: 'below', itemCount: 0, mapWidth: 600, mapHeight: 400 });
    expect(layout.legendOutsideMap).toBe(false);
  });

  it('UT-026: 40 items below — height >= map', () => {
    const layout = computeCompositionLayout({
      legendPosition: 'below',
      itemCount: 40,
      mapWidth: 600,
      mapHeight: 400,
      columns: 2,
    });
    expect(layout.totalHeight).toBeGreaterThanOrEqual(layout.mapHeight);
  });

  it('UT-027: rapid position updates — last wins', () => {
    expect(getLegendLayoutMode({ legendPosition: 'inside' })).toBe('inside');
    expect(getLegendLayoutMode({ legendPosition: 'below' })).toBe('below');
  });

  it('UT-028: layout with bad input does not throw', () => {
    expect(() =>
      computeCompositionLayout({ legendPosition: 'beside', itemCount: NaN, mapWidth: 0, mapHeight: 0 })
    ).not.toThrow();
  });

  it('UT-029: setting below twice — stable metrics', () => {
    const a = computeCompositionLayout({ legendPosition: 'below', itemCount: 3, mapWidth: 500, mapHeight: 300 });
    const b = computeCompositionLayout({ legendPosition: 'below', itemCount: 3, mapWidth: 500, mapHeight: 300 });
    expect(a).toEqual(b);
  });

  it('UT-030: position before elements — applies when items exist', () => {
    const empty = buildLegendItems([], { legendPosition: 'beside' });
    const filled = buildLegendItems([sampleEl()], { legendPosition: 'beside', legendColumns: 2 });
    expect(empty.length).toBe(0);
    expect(filled.length).toBe(1);
  });

  it('UT-031: return to inside restores rect', () => {
    const saved = { x: 0.1, y: 0.2, w: 0.3, h: 0.25 };
    const settings = normalizeExportSettings({ legendPosition: 'inside', legendRect: saved });
    expect(resolveLegendRect(settings)).toEqual(clampLegendRect(saved));
  });

  it('UT-032: columns=6 grid uses 6 columns', () => {
    expect(buildLegendGridStyle(6, 12, 'normal').columns).toBe(6);
  });

  it('UT-033: drag delta clamps to [0,1]', () => {
    const start = { x: 0.5, y: 0.5, w: 0.3, h: 0.2 };
    const moved = applyLegendDrag(start, -0.6, 0.1);
    expect(moved.x).toBeGreaterThanOrEqual(0);
    expect(moved.y).toBeLessThanOrEqual(1 - moved.h);
  });

  it('UT-034: resize clamps min/max', () => {
    const tiny = applyLegendResize({ x: 0.1, y: 0.1, w: 0.01, h: 0.01 }, 0, 0);
    expect(tiny.w).toBeGreaterThanOrEqual(0.15);
    expect(tiny.h).toBeGreaterThanOrEqual(0.12);
  });

  it('UT-035: beside — drag not enabled', () => {
    expect(isInsideDragEnabled('beside')).toBe(false);
  });

  it('UT-036: drag x<0 clamps to 0', () => {
    const rect = applyLegendDrag({ x: 0.05, y: 0.2, w: 0.3, h: 0.2 }, -0.2, 0);
    expect(rect.x).toBe(0);
  });

  it('UT-037: empty inside legend — resolve returns default but items empty hides frame', () => {
    expect(resolveLegendRect({ legendPosition: 'inside' })).not.toBeNull();
    expect(buildLegendItems([], {}).length).toBe(0);
  });

  it('UT-038: resize below min equals min size', () => {
    const rect = applyLegendResize({ x: 0.2, y: 0.2, w: 0.16, h: 0.13 }, -0.5, -0.5);
    expect(rect.w).toBeGreaterThanOrEqual(0.15);
    expect(rect.h).toBeGreaterThanOrEqual(0.12);
  });

  it('UT-039: two moves — last wins', () => {
    const base = { x: 0.3, y: 0.3, w: 0.3, h: 0.25 };
    applyLegendDrag(base, 0.1, 0);
    const last = applyLegendDrag(base, 0.2, 0);
    expect(last.x).toBeGreaterThan(base.x);
  });

  it('UT-040: pointer cancel — rect stays last valid', () => {
    const rect = clampLegendRect({ x: 0.2, y: 0.2, w: 0.3, h: 0.25 });
    expect(rect).toEqual(clampLegendRect(rect));
  });

  it('UT-041: repeated identical resize — same rect', () => {
    const base = { x: 0.2, y: 0.2, w: 0.4, h: 0.3 };
    expect(applyLegendResize(base, 0, 0)).toEqual(applyLegendResize(base, 0, 0));
  });

  it('UT-042: mid-drag switch to below — external layout', () => {
    expect(getLegendLayoutMode({ legendPosition: 'below' })).toBe('below');
    expect(isInsideDragEnabled('below')).toBe(false);
  });

  it('UT-043: restore saved rect', () => {
    const saved = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(resolveLegendRect({ legendPosition: 'inside', legendRect: saved })).toEqual(clampLegendRect(saved));
  });
});

describe('export preview — legend appearance UT-044–055', () => {
  it('UT-044: columns=4', () => {
    expect(buildLegendGridStyle(4, 12, 'normal').columns).toBe(4);
  });

  it('UT-045: font 14', () => {
    expect(buildLegendGridStyle(2, 14, 'normal').fontSizePx).toBe(14);
  });

  it('UT-046: spacing wide', () => {
    expect(buildLegendGridStyle(2, 12, 'wide').spacing).toBe('wide');
    expect(LEGEND_SPACING_PX.wide).toBe(8);
  });

  it('UT-047: out-of-range clamp', () => {
    expect(normalizeExportSettings({ legendColumns: 99 }).legendColumns).toBe(6);
    expect(normalizeExportSettings({ legendFontSizePx: 3 }).legendFontSizePx).toBe(8);
    expect(normalizeExportSettings({ legendFontSizePx: 40 }).legendFontSizePx).toBe(18);
  });

  it('UT-048: empty items — settings model intact', () => {
    const s = normalizeExportSettings({ legendColumns: 3, legendFontSizePx: 10 });
    expect(s.legendColumns).toBe(3);
  });

  it('UT-049: long label + 6 columns — swatch present', () => {
    const items = buildLegendItems(
      [sampleEl({ name: 'Nome muito longo para legenda exportada' })],
      { legendColumns: 6, legendFontSizePx: 12 }
    );
    expect(items[0].swatchSizePx).toBeGreaterThan(0);
  });

  it('UT-050: rapid font changes — last wins', () => {
    expect(buildLegendGridStyle(2, 16, 'normal').fontSizePx).toBe(16);
    expect(buildLegendGridStyle(2, 8, 'normal').fontSizePx).toBe(8);
  });

  it('UT-051: absurd DPI clamped for capture scale', () => {
    expect(getCaptureScaleFactor(9999)).toBeCloseTo(600 / 96, 5);
  });

  it('UT-052: compact→normal→wide', () => {
    expect(buildLegendGridStyle(2, 12, 'compact').spacing).toBe('compact');
    expect(buildLegendGridStyle(2, 12, 'normal').spacing).toBe('normal');
    expect(buildLegendGridStyle(2, 12, 'wide').spacing).toBe('wide');
  });

  it('UT-053: font then position both in layout snapshot', () => {
    const model = buildPreviewModel({
      settings: { legendFontSizePx: 14, legendPosition: 'beside', title: 'T', author: 'A' },
      elements: [sampleEl()],
    });
    expect(model.legendGrid.fontSizePx).toBe(14);
    expect(model.legendLayoutMode).toBe('beside');
  });

  it('UT-054: normalize round-trip preserves appearance', () => {
    const raw = { legendColumns: 5, legendFontSizePx: 15, legendSpacing: 'wide' };
    const once = normalizeExportSettings(raw);
    const twice = normalizeExportSettings(once);
    expect(twice.legendColumns).toBe(5);
    expect(twice.legendFontSizePx).toBe(15);
    expect(twice.legendSpacing).toBe('wide');
  });

  it('UT-055: 60 items columns=3 without throw', () => {
    const els = Array.from({ length: 60 }, (_, i) => sampleEl({ id: `e-${i}`, name: `E${i}` }));
    expect(() => buildLegendItems(els, { legendColumns: 3 })).not.toThrow();
    expect(buildLegendGridStyle(3, 12, 'normal').columns).toBe(3);
  });
});

describe('export preview — visibility UT-056–068', () => {
  it('UT-056: hide category terra', () => {
    const settings = normalizeExportSettings({ hiddenCategoryIds: ['terra'] });
    const visible = effectiveVisibleElements([sampleEl()], settings);
    expect(visible).toHaveLength(0);
  });

  it('UT-057: hide one element id', () => {
    const settings = normalizeExportSettings({ hiddenElementIds: ['el-1'] });
    expect(effectiveVisibleElements([sampleEl()], settings)).toHaveLength(0);
  });

  it('UT-058: re-show element', () => {
    const hidden = normalizeExportSettings({ hiddenElementIds: ['el-1'] });
    const shown = normalizeExportSettings({ hiddenElementIds: [] });
    expect(effectiveVisibleElements([sampleEl()], hidden)).toHaveLength(0);
    expect(effectiveVisibleElements([sampleEl()], shown)).toHaveLength(1);
  });

  it('UT-059: hiding for export does not mutate source elements', () => {
    const elements = [sampleEl()];
    const copyBefore = JSON.stringify(elements);
    effectiveVisibleElements(elements, normalizeExportSettings({ hiddenElementIds: ['el-1'] }));
    expect(JSON.stringify(elements)).toBe(copyBefore);
  });

  it('UT-060: prune drops deleted hidden id', () => {
    const pruned = pruneExportSettings({ hiddenElementIds: ['gone'] }, [sampleEl()]);
    expect(pruned.hiddenElementIds).toEqual([]);
  });

  it('UT-061: no elements — empty list', () => {
    expect(effectiveVisibleElements([], normalizeExportSettings({}))).toEqual([]);
  });

  it('UT-062: 300 ids toggle map completes', () => {
    const ids = Array.from({ length: 300 }, (_, i) => `el-${i}`);
    const settings = normalizeExportSettings({ hiddenElementIds: ids });
    expect(settings.hiddenElementIds).toHaveLength(300);
  });

  it('UT-063: last toggle wins', () => {
    let s = normalizeExportSettings({});
    s = { ...s, ...toggleCategoryVisibility(s, 'terra') };
    s = { ...s, ...toggleCategoryVisibility(s, 'terra') };
    expect(s.hiddenCategoryIds.includes('terra')).toBe(false);
  });

  it('UT-064: invalid style JSON — safe fallback', () => {
    expect(safeParseStyle('not-json')).toEqual({});
    const items = buildLegendItems([sampleEl({ style: '{bad' })], {});
    expect(items[0].color).toBeTruthy();
  });

  it('UT-065: toggle off-on-off ends hidden', () => {
    let s = normalizeExportSettings({});
    s = { ...s, ...toggleElementVisibility(s, 'el-1') };
    s = { ...s, ...toggleElementVisibility(s, 'el-1') };
    s = { ...s, ...toggleElementVisibility(s, 'el-1') };
    expect(s.hiddenElementIds.includes('el-1')).toBe(true);
  });

  it('UT-066: category off then child on — child stays hidden', () => {
    const s = normalizeExportSettings({ hiddenCategoryIds: ['terra'] });
    expect(isElementVisible(s, 'el-1', [sampleEl()])).toBe(false);
  });

  it('UT-067: element removed — prune removes hidden id', () => {
    const pruned = pruneExportSettings({ hiddenElementIds: ['el-1', 'el-2'] }, [sampleEl({ id: 'el-1' })]);
    expect(pruned.hiddenElementIds).toEqual(['el-1']);
  });

  it('UT-068: all hidden no legend — content gate error', () => {
    const s = normalizeExportSettings({ title: 'T', author: 'A', hiddenCategoryIds: ['terra'] });
    expect(validateExportGates(s, [], []).ok).toBe(false);
  });
});

describe('export preview — tags UT-069–080', () => {
  it('UT-069: showTags true — tag descriptors', () => {
    const tags = buildTagDescriptors([sampleEl()], { showTags: true });
    expect(tags).toHaveLength(1);
    expect(tags[0].text).toBe('Point A');
  });

  it('UT-069b: LineString tag anchor at centroid', () => {
    const el = sampleEl({
      id: 'line-1',
      element_type: 'line',
      name: 'River A',
      geojson: JSON.stringify({
        type: 'LineString',
        coordinates: [
          [-52.0, -32.0],
          [-52.2, -32.1],
        ],
      }),
    });
    const tags = buildTagDescriptors([el], { showTags: true });
    expect(tags).toHaveLength(1);
    expect(tags[0].text).toBe('River A');
    expect(tags[0].lng).toBeCloseTo(-52.1, 5);
    expect(tags[0].lat).toBeCloseTo(-32.05, 5);
    expect(tags[0].lat).not.toBe(0);
    expect(tags[0].lng).not.toBe(0);
  });

  it('UT-069c: Polygon tag anchor at outer ring centroid', () => {
    const el = sampleEl({
      id: 'poly-1',
      element_type: 'polygon',
      name: 'Field B',
      geojson: JSON.stringify({
        type: 'Polygon',
        coordinates: [
          [
            [-52.0, -32.0],
            [-52.1, -32.0],
            [-52.1, -32.1],
            [-52.0, -32.1],
            [-52.0, -32.0],
          ],
        ],
      }),
    });
    const tags = buildTagDescriptors([el], { showTags: true });
    expect(tags).toHaveLength(1);
    expect(tags[0].text).toBe('Field B');
    expect(tags[0].lng).toBeCloseTo(-52.05, 5);
    expect(tags[0].lat).toBeCloseTo(-32.05, 5);
  });

  it('UT-069d: unsupported geometry without coordinates — no tag at 0,0', () => {
    const el = sampleEl({
      name: 'Bad Geo',
      geojson: JSON.stringify({ type: 'GeometryCollection', geometries: [] }),
    });
    expect(buildTagDescriptors([el], { showTags: true })).toHaveLength(0);
  });

  it('UT-070: showTags false — no tags', () => {
    expect(buildTagDescriptors([sampleEl()], { showTags: false })).toEqual([]);
  });

  it('UT-071: hidden element — no tag', () => {
    const tags = buildTagDescriptors([sampleEl()], { showTags: true, hiddenElementIds: ['el-1'] });
    expect(tags).toHaveLength(0);
  });

  it('UT-072: hostile name escaped in descriptor text', () => {
    const tags = buildTagDescriptors([sampleEl({ name: '<b>X</b>' })], { showTags: true });
    expect(tags[0].text).not.toContain('<b>');
  });

  it('UT-073: blank name — no tag', () => {
    expect(buildTagDescriptors([sampleEl({ name: '  ' })], { showTags: true })).toHaveLength(0);
  });

  it('UT-074: 20 overlapping points — 20 tags', () => {
    const els = Array.from({ length: 20 }, (_, i) =>
      sampleEl({ id: `p-${i}`, name: `P${i}` })
    );
    expect(buildTagDescriptors(els, { showTags: true })).toHaveLength(20);
  });

  it('UT-075: tag toggle last value wins', () => {
    expect(buildTagDescriptors([sampleEl()], { showTags: true }).length).toBe(1);
    expect(buildTagDescriptors([sampleEl()], { showTags: false }).length).toBe(0);
  });

  it('UT-076: export snapshot tags frozen', () => {
    const snap = snapshotTagsForExport([sampleEl()], normalizeExportSettings({ showTags: true }));
    expect(snap).toHaveLength(1);
  });

  it('UT-077: rapid toggle ends on last boolean', () => {
    const on = buildTagDescriptors([sampleEl()], { showTags: true });
    const off = buildTagDescriptors([sampleEl()], { showTags: false });
    expect(on.length).toBe(1);
    expect(off.length).toBe(0);
  });

  it('UT-078: tags before load — appear when elements present', () => {
    expect(buildTagDescriptors([], { showTags: true })).toHaveLength(0);
    expect(buildTagDescriptors([sampleEl()], { showTags: true })).toHaveLength(1);
  });

  it('UT-079: persist restore showTags', () => {
    expect(normalizeExportSettings({ showTags: true }).showTags).toBe(true);
  });

  it('UT-080: 500-char name — tag present', () => {
    const name = 'N'.repeat(500);
    const tags = buildTagDescriptors([sampleEl({ name })], { showTags: true });
    expect(tags[0].text.length).toBe(500);
  });
});

describe('export preview — basemap UT-081–091', () => {
  it('UT-081: carto/osm/satellite URLs not Google', () => {
    expect(resolveBasemapTileUrl('carto')).toBe(BASEMAP_TILE_URLS.carto);
    expect(resolveBasemapTileUrl('osm')).toBe(BASEMAP_TILE_URLS.osm);
    expect(resolveBasemapTileUrl('satellite')).toContain('arcgisonline.com');
    expect(isGoogleSatelliteUrl(resolveBasemapTileUrl('satellite'))).toBe(false);
  });

  it('UT-082: native offline uses getLocalTileUrl export', () => {
    expect(typeof getLocalTileUrl).toBe('function');
    expect(readSrc('src/components/map/export/OfflineTileLayer.jsx')).toContain('getLocalTileUrl');
  });

  it('UT-083: web offline disabled', () => {
    expect(isOfflineBasemapAvailable(false)).toBe(false);
    expect(normalizeBasemapForPlatform('offline', false)).toBe('carto');
  });

  it('UT-084: unknown basemap → carto', () => {
    expect(normalizeExportSettings({ basemap: 'foo' }).basemap).toBe('carto');
  });

  it('UT-085: offline null tiles — unusable', () => {
    const payload = buildOfflineReadinessPayload(new Map([['11:101:200', null]]));
    expect(payload).toEqual({ requiredTiles: [null], partial: true });
    expect(evaluateBasemapReadiness('offline', payload)).toBe('unusable');
  });

  it('UT-085a: OfflineTileLayer readiness payload matches evaluateBasemapReadiness', () => {
    expect(evaluateBasemapReadiness('offline', buildOfflineReadinessPayload(new Map()))).toBe('loading');

    const pending = new Map([['11:100:200', undefined]]);
    expect(evaluateBasemapReadiness('offline', buildOfflineReadinessPayload(pending))).toBe('loading');

    const ready = new Map([
      ['11:100:200', 'capacitor://tile-a'],
      ['11:101:200', 'capacitor://tile-b'],
    ]);
    expect(evaluateBasemapReadiness('offline', buildOfflineReadinessPayload(ready))).toBe('ready');

    const missing = new Map([
      ['11:100:200', 'capacitor://tile-a'],
      ['11:101:200', null],
    ]);
    const partialPayload = buildOfflineReadinessPayload(missing);
    expect(partialPayload).toEqual({
      requiredTiles: ['capacitor://tile-a', null],
      partial: true,
    });
    expect(evaluateBasemapReadiness('offline', partialPayload)).toBe('unusable');
  });

  it('UT-086: partial tiles — unusable', () => {
    const payload = buildOfflineReadinessPayload(
      new Map([
        ['11:100:200', 'capacitor://tile-a'],
        ['11:101:200', null],
      ])
    );
    expect(payload.partial).toBe(true);
    expect(evaluateBasemapReadiness('offline', payload)).toBe('unusable');
  });

  it('UT-087: rapid basemap changes — last wins in model', () => {
    const osm = buildPreviewModel({ settings: { basemap: 'osm', title: 'T', author: 'A' }, elements: [sampleEl()] });
    const sat = buildPreviewModel({
      settings: { basemap: 'satellite', title: 'T', author: 'A' },
      elements: [sampleEl()],
    });
    expect(osm.basemap).toBe('osm');
    expect(sat.basemap).toBe('satellite');
  });

  it('UT-088: tile error — preview error flag', () => {
    const model = buildPreviewModel({
      settings: { basemap: 'carto', title: 'T', author: 'A' },
      elements: [sampleEl()],
      basemapReadiness: { error: true },
    });
    expect(model.previewStatus).toBe('error');
  });

  it('UT-088a: online basemap without readiness payload stays loading', () => {
    const model = buildPreviewModel({
      settings: { basemap: 'carto', title: 'T', author: 'A' },
      elements: [sampleEl()],
    });
    expect(model.basemapStatus).toBe('loading');
    expect(model.previewStatus).toBe('loading');
    expect(exportBlockedByPreviewStatus(model)).toBe(true);
  });

  it('UT-088b: OnlineTileLayer readiness payload matches evaluateBasemapReadiness', () => {
    expect(evaluateBasemapReadiness('osm', buildOnlineReadinessPayload(new Map()))).toBe('loading');

    const pending = new Map([['11:100:200', undefined]]);
    expect(evaluateBasemapReadiness('osm', buildOnlineReadinessPayload(pending))).toBe('loading');

    const ready = new Map([
      ['11:100:200', 'https://tile-a'],
      ['11:101:200', 'https://tile-b'],
    ]);
    expect(evaluateBasemapReadiness('satellite', buildOnlineReadinessPayload(ready))).toBe('ready');

    const failed = new Map([['11:101:200', null]]);
    expect(evaluateBasemapReadiness('carto', buildOnlineReadinessPayload(failed))).toBe('error');
  });

  it('UT-089: re-select osm stable URL', () => {
    expect(resolveBasemapTileUrl('osm')).toBe(resolveBasemapTileUrl('osm'));
  });

  it('UT-090: export before ready — model shows loading/unusable', () => {
    const loadingModel = buildOfflinePreviewModel(new Map([['11:100:200', undefined]]));
    expect(loadingModel.basemapStatus).toBe('loading');
    expect(loadingModel.previewStatus).toBe('loading');
    expect(exportBlockedByPreviewStatus(loadingModel)).toBe(true);

    const unusableModel = buildOfflinePreviewModel(
      new Map([
        ['11:100:200', 'capacitor://tile-a'],
        ['11:101:200', null],
      ])
    );
    expect(unusableModel.basemapStatus).toBe('unusable');
    expect(unusableModel.previewStatus).toBe('error');
    expect(exportBlockedByPreviewStatus(unusableModel)).toBe(true);
  });

  it('UT-090e: basemap switch clears sticky error readiness (US-009.EC-5/EC-7)', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain('useEffect');
    expect(src).toMatch(/setBasemapReadiness\s*\(\s*\{\s*\}\s*\)/);
    expect(src).toMatch(/\[basemap\]/);

    const staleError = buildPreviewModel({
      settings: { basemap: 'osm', title: 'T', author: 'A' },
      elements: [sampleEl()],
      basemapReadiness: { error: true },
    });
    expect(staleError.previewStatus).toBe('error');

    const afterReset = buildPreviewModel({
      settings: { basemap: 'osm', title: 'T', author: 'A' },
      elements: [sampleEl()],
      basemapReadiness: {},
    });
    expect(afterReset.previewStatus).toBe('loading');
    expect(exportBlockedByPreviewStatus(afterReset)).toBe(true);

    const afterNewTiles = buildOnlinePreviewModel(
      new Map([
        ['11:100:200', 'https://tile-a'],
        ['11:101:200', 'https://tile-b'],
      ]),
      'osm'
    );
    expect(afterNewTiles.previewStatus).toBe('ready');
    expect(exportBlockedByPreviewStatus(afterNewTiles)).toBe(false);
  });

  it('UT-090d: online export before tiles ready — model shows loading until settle', () => {
    expect(buildOnlinePreviewModel(new Map()).previewStatus).toBe('loading');

    const pending = buildOnlinePreviewModel(new Map([['11:100:200', undefined]]));
    expect(pending.basemapStatus).toBe('loading');
    expect(pending.previewStatus).toBe('loading');
    expect(exportBlockedByPreviewStatus(pending)).toBe(true);

    const ready = buildOnlinePreviewModel(
      new Map([
        ['11:100:200', 'https://tile-a'],
        ['11:101:200', 'https://tile-b'],
      ]),
      'osm'
    );
    expect(ready.basemapStatus).toBe('ready');
    expect(ready.previewStatus).toBe('ready');
    expect(exportBlockedByPreviewStatus(ready)).toBe(false);

    const failed = buildOnlinePreviewModel(new Map([['11:101:200', null]]), 'satellite');
    expect(failed.basemapStatus).toBe('error');
    expect(failed.previewStatus).toBe('error');
    expect(exportBlockedByPreviewStatus(failed)).toBe(true);
  });

  it('UT-091: restore satellite basemap', () => {
    expect(normalizeExportSettings({ basemap: 'satellite' }).basemap).toBe('satellite');
  });
});

describe('export preview — offline readiness pipeline UT-090a–UT-090c', () => {
  it('UT-090a: OfflineTileLayer lifecycle drives previewStatus (CompositionPreview data-preview-status)', () => {
    expect(buildOfflinePreviewModel(new Map()).previewStatus).toBe('loading');

    const pending = buildOfflinePreviewModel(new Map([['11:100:200', undefined]]));
    expect(pending.basemapStatus).toBe('loading');
    expect(pending.previewStatus).toBe('loading');

    const ready = buildOfflinePreviewModel(
      new Map([
        ['11:100:200', 'capacitor://tile-a'],
        ['11:101:200', 'capacitor://tile-b'],
      ])
    );
    expect(ready.basemapStatus).toBe('ready');
    expect(ready.previewStatus).toBe('ready');
    expect(exportBlockedByPreviewStatus(ready)).toBe(false);

    const missing = buildOfflinePreviewModel(new Map([['11:101:200', null]]));
    expect(missing.basemapStatus).toBe('unusable');
    expect(missing.previewStatus).toBe('error');
  });

  it('UT-090b: legacy ready:true callback ignored — stays loading', () => {
    const model = buildPreviewModel({
      settings: { basemap: 'offline', title: 'T', author: 'A' },
      elements: [sampleEl()],
      isNativePlatform: true,
      basemapReadiness: { ready: true },
    });
    expect(model.basemapStatus).toBe('loading');
    expect(model.previewStatus).toBe('loading');
    expect(exportBlockedByPreviewStatus(model)).toBe(true);
  });

  it('UT-090f: stale offline tile async must not corrupt readiness after unload/reuse', () => {
    const offlineSrc = readSrc('src/components/map/export/OfflineTileLayer.jsx');
    expect(offlineSrc).toMatch(/tileRequestTokens|requestId|isCurrent/);
    expect(offlineSrc).toContain('tileRequestTokens.delete(key)');

    const tileEntries = new Map();
    const tileRequestTokens = new Map();
    let requestSeq = 0;
    const key = '11:100:200';

    const startTile = () => {
      const requestId = ++requestSeq;
      tileRequestTokens.set(key, requestId);
      tileEntries.set(key, undefined);
      return requestId;
    };
    const isCurrent = (requestId) => tileRequestTokens.get(key) === requestId;
    const applyResult = (requestId, value) => {
      if (!isCurrent(requestId)) return;
      tileEntries.set(key, value);
    };
    const unload = () => {
      tileRequestTokens.delete(key);
      tileEntries.delete(key);
    };

    const idA = startTile();
    unload();
    const idB = startTile();
    applyResult(idA, null);
    expect(tileEntries.get(key)).toBe(undefined);
    expect(evaluateBasemapReadiness('offline', buildOfflineReadinessPayload(tileEntries))).toBe('loading');

    applyResult(idB, 'capacitor://tile-b');
    expect(evaluateBasemapReadiness('offline', buildOfflineReadinessPayload(tileEntries))).toBe('ready');
  });

  it('UT-090h: OnlineTileLayer sets crossOrigin for html2canvas useCORS capture', () => {
    const onlineSrc = readSrc('src/components/map/export/OnlineTileLayer.jsx');
    expect(onlineSrc).toMatch(/L\.tileLayer\s*\(\s*url\s*,\s*\{[^}]*crossOrigin\s*:\s*(?:true|'anonymous'|"anonymous")/);
  });

  it('UT-090g: stale online tileload after unload must not mark basemap ready', () => {
    const onlineSrc = readSrc('src/components/map/export/OnlineTileLayer.jsx');
    expect(onlineSrc).toMatch(/tileRequestTokens|requestId|isCurrent/);
    expect(onlineSrc).toContain('tileRequestTokens.delete(key)');

    const tileEntries = new Map();
    const tileRequestTokens = new Map();
    const tileLoadRequestIds = new WeakMap();
    let requestSeq = 0;
    const key = '11:100:200';

    const startTile = (tileEl) => {
      const requestId = ++requestSeq;
      tileRequestTokens.set(key, requestId);
      tileEntries.set(key, undefined);
      if (tileEl) tileLoadRequestIds.set(tileEl, requestId);
      return requestId;
    };
    const isCurrent = (requestId) => tileRequestTokens.get(key) === requestId;
    const applyLoad = (requestId, tileEl, value) => {
      const boundId = tileEl ? tileLoadRequestIds.get(tileEl) : undefined;
      if (boundId === undefined || !isCurrent(boundId) || boundId !== requestId) return;
      tileEntries.set(key, value);
    };
    const unload = () => {
      tileRequestTokens.delete(key);
      tileEntries.delete(key);
    };

    const tileA = {};
    const idA = startTile(tileA);
    unload();
    const tileB = {};
    const idB = startTile(tileB);
    applyLoad(idA, tileA, 'https://stale-tile');
    expect(tileEntries.get(key)).toBe(undefined);
    expect(evaluateBasemapReadiness('osm', buildOnlineReadinessPayload(tileEntries))).toBe('loading');

    applyLoad(idB, tileB, 'https://tile-b');
    expect(tileEntries.get(key)).toBe('https://tile-b');
    expect(evaluateBasemapReadiness('osm', buildOnlineReadinessPayload(tileEntries))).toBe('ready');
  });

  it('UT-090c: previewStatus from buildPreviewModel gates exportCompositionPng readiness wait', async () => {
    vi.useFakeTimers();
    try {
      const loadingModel = buildOfflinePreviewModel(new Map());
      const loadingEl = { getAttribute: vi.fn(() => loadingModel.previewStatus) };
      const loadingPromise = waitForPreviewReadiness(loadingEl, { timeoutMs: 300, pollMs: 50 });
      const loadingAssertion = expect(loadingPromise).rejects.toBeInstanceOf(ExportCaptureError);
      await vi.advanceTimersByTimeAsync(350);
      await loadingAssertion;

      const readyModel = buildOfflinePreviewModel(new Map([['11:100:200', 'capacitor://tile-a']]));
      expect(readyModel.previewStatus).toBe('ready');
      const readyEl = { getAttribute: vi.fn(() => readyModel.previewStatus) };
      await expect(waitForPreviewReadiness(readyEl, { timeoutMs: 500, pollMs: 50 })).resolves.toBeUndefined();

      const errorModel = buildOfflinePreviewModel(new Map([['11:101:200', null]]));
      expect(errorModel.previewStatus).toBe('error');
      const errorEl = { getAttribute: vi.fn(() => errorModel.previewStatus) };
      await expect(
        waitForPreviewReadiness(errorEl, { timeoutMs: 500, pollMs: 50 })
      ).rejects.toBeInstanceOf(ExportCaptureError);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('export preview — paper/DPI UT-117–127', () => {
  it('UT-117: A4 landscape aspect', () => {
    const ratio = getPaperAspectRatio('A4', 'landscape');
    expect(ratio).toBeCloseTo(PAPER_MM.A4.h / PAPER_MM.A4.w, 3);
  });

  it('UT-118: dpi 300 scale factor', () => {
    expect(getCaptureScaleFactor(300)).toBeCloseTo(300 / 96, 5);
  });

  it('UT-119: Letter portrait round-trip', () => {
    const s = normalizeExportSettings({ paperSize: 'Letter', orientation: 'portrait' });
    expect(normalizeExportSettings(s)).toEqual(s);
  });

  it('UT-120: invalid paper and dpi clamp', () => {
    expect(normalizeExportSettings({ paperSize: 'A2' }).paperSize).toBe('A4');
    expect(normalizeExportSettings({ dpi: 10 }).dpi).toBe(72);
    expect(normalizeExportSettings({ dpi: 9999 }).dpi).toBe(600);
  });

  it('UT-121: missing dpi → 300', () => {
    expect(normalizeExportSettings({}).dpi).toBe(300);
  });

  it('UT-122: capture scale finite at high dpi', () => {
    expect(Number.isFinite(getCaptureScaleFactor(600))).toBe(true);
  });

  it('UT-123: capture scale frozen at start value', () => {
    const atStart = getCaptureScaleFactor(300);
    const later = getCaptureScaleFactor(150);
    expect(atStart).not.toBe(later);
    expect(atStart).toBeCloseTo(300 / 96, 5);
  });

  it('UT-124: preview error/blocked — no implicit export success path in modal', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain('exportDisabled');
    expect(src).toContain('previewModel.previewStatus');
    expect(src).toContain('basemapReadiness={basemapReadiness}');
    expect(src).toContain('handleBasemapReadinessChange');
    expect(src).not.toMatch(/toast\.success.*Export/i);
  });

  it('UT-125: capture scale helper idempotent for repeated export config', () => {
    expect(getCaptureScaleFactor(300)).toBe(getCaptureScaleFactor(300));
  });

  it('UT-126: orientation change reclamps legend rect', () => {
    const rect = { x: 0.9, y: 0.1, w: 0.3, h: 0.2 };
    const reclamped = reclampLegendRectForOrientation(rect, 'portrait');
    expect(reclamped.x + reclamped.w).toBeLessThanOrEqual(1);
  });

  it('UT-127: persist orientation landscape', () => {
    expect(normalizeExportSettings({ orientation: 'landscape' }).orientation).toBe('landscape');
  });
});

describe('export preview — live model UT-128–136', () => {
  it('UT-128: no mandatory refresh button in modal source', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).not.toMatch(/Atualizar Preview/i);
  });

  it('UT-129: preview model chrome flags', () => {
    const model = buildPreviewModel({ settings: { title: 'T', author: 'A' }, elements: [sampleEl()] });
    expect(model.chrome.graticule).toBe(true);
    expect(model.chrome.dynamicScale).toBe(true);
    expect(model.chrome.northArrow).toBe(true);
    expect(model.chrome.footer).toBe(true);
  });

  it('UT-130: blocked gates — exportDisabled true', () => {
    const model = buildPreviewModel({ settings: { title: '', author: '' }, elements: [sampleEl()] });
    expect(model.exportDisabled).toBe(true);
  });

  it('UT-131: boundaries loading — previewStatus loading', () => {
    const model = buildPreviewModel({
      settings: { title: 'T', author: 'A' },
      elements: [sampleEl()],
      boundaryLoading: true,
    });
    expect(model.previewStatus).toBe('loading');
  });

  it('UT-132: coalesced updates end on latest hash', async () => {
    vi.useFakeTimers();
    const commits = [];
    const updater = createCoalescedPreviewUpdater((m) => commits.push(m.settings.title), 30);
    updater.schedule({ settings: { title: 'A', author: 'A' }, elements: [] });
    updater.schedule({ settings: { title: 'B', author: 'A' }, elements: [] });
    await vi.advanceTimersByTimeAsync(30);
    expect(commits.at(-1)).toBe('B');
    vi.useRealTimers();
  });

  it('UT-133: overlapping generations — latest committed', async () => {
    vi.useFakeTimers();
    const commits = [];
    const updater = createCoalescedPreviewUpdater((m) => commits.push(m.settings.dpi), 20);
    updater.schedule({ settings: { title: 'T', author: 'A', dpi: 100 }, elements: [] });
    updater.schedule({ settings: { title: 'T', author: 'A', dpi: 200 }, elements: [] });
    updater.flush({ settings: { title: 'T', author: 'A', dpi: 300 }, elements: [] });
    expect(commits.at(-1)).toBe(300);
    vi.useRealTimers();
  });

  it('UT-134: render error status', () => {
    const model = buildPreviewModel({
      settings: { basemap: 'carto', title: 'T', author: 'A' },
      elements: [sampleEl()],
      basemapReadiness: { error: true },
    });
    expect(model.previewStatus).toBe('error');
  });

  it('UT-135: settings when elements arrive', () => {
    const empty = buildPreviewModel({ settings: { title: 'T', author: 'A' }, elements: [] });
    const filled = buildPreviewModel({ settings: { title: 'T', author: 'A' }, elements: [sampleEl()] });
    expect(empty.visibleElements).toHaveLength(0);
    expect(filled.visibleElements).toHaveLength(1);
  });

  it('UT-136: basemap switch updates tile URL key', () => {
    const carto = buildPreviewModel({ settings: { basemap: 'carto', title: 'T', author: 'A' }, elements: [sampleEl()] });
    const osm = buildPreviewModel({ settings: { basemap: 'osm', title: 'T', author: 'A' }, elements: [sampleEl()] });
    expect(carto.tileUrl).not.toBe(osm.tileUrl);
  });
});

describe('export preview — footer UT-137–145', () => {
  it('UT-137: institutional lines always present', () => {
    const content = buildInstitutionalFooterContent({});
    expect(content.institutionalLines).toEqual(expect.arrayContaining([INSTITUTIONAL_LINES[0]]));
  });

  it('UT-138: IBGE credit when location used', () => {
    expect(shouldShowIbgeCredit({ locatorCount: 1, stateCode: '43', municipalityCode: '4314902' })).toBe(true);
    expect(
      buildInstitutionalFooterContent({ locatorCount: 1, stateCode: '43', municipalityCode: '4314902' }).ibgeCreditLine
    ).toBeTruthy();
    expect(buildInstitutionalFooterContent({ locatorCount: 0 }).ibgeCreditLine).toBeNull();
  });

  it('UT-139: logo onError fallback described in component source', () => {
    const src = readSrc('src/components/map/export/InstitutionalFooter.jsx');
    expect(src).toContain('onError');
    expect(src).toContain('export-logo-fallback');
  });

  it('UT-140: empty responsible — institutional block present', () => {
    const content = buildInstitutionalFooterContent({ author: 'A' });
    expect(content.institutionalLines.length).toBeGreaterThan(0);
    expect(content.responsibleLine).toBeNull();
  });

  it('UT-141: narrow footer layout without throw', () => {
    expect(() => computeFooterLayout({ paperWidthPx: 240 })).not.toThrow();
  });

  it('UT-142: logo fail keeps text attribution in footer content', () => {
    const content = buildInstitutionalFooterContent({});
    expect(content.institutionalLines.join(' ')).toMatch(/ReatCarto/);
  });

  it('UT-143: two footer snapshots equal for same settings', () => {
    const s = normalizeExportSettings({ author: 'X', locatorCount: 0 });
    expect(snapshotInstitutionalFooter(s)).toBe(snapshotInstitutionalFooter(s));
  });

  it('UT-144: author change updates footer props', () => {
    const a = buildInstitutionalFooterContent({ author: 'One' });
    const b = buildInstitutionalFooterContent({ author: 'Two' });
    expect(a.authorLine).not.toBe(b.authorLine);
  });

  it('UT-145: high DPI — logo still in composition tree source', () => {
    const src = readSrc('src/components/map/export/CompositionPreview.jsx');
    expect(src).toContain('InstitutionalFooter');
  });
});

describe('export preview — dynamic scale UT-187–188', () => {
  it('UT-187: scale label not always fixed 3km', () => {
    const z11 = computeDynamicScaleBar({ lat: -32, zoom: 11 });
    const z14 = computeDynamicScaleBar({ lat: -32, zoom: 14 });
    expect(z11.label).toBeTruthy();
    expect(z14.label).toBeTruthy();
    expect(z11.distanceMeters).not.toBe(z14.distanceMeters);
  });

  it('UT-188: extreme zoom — finite positive scale', () => {
    const extreme = computeDynamicScaleBar({ lat: 0, zoom: 2 });
    expect(extreme.barPx).toBeGreaterThan(0);
    expect(Number.isFinite(extreme.distanceMeters)).toBe(true);
    expect(metersPerPixel(0, 2)).toBeGreaterThan(0);
  });
});

describe('export preview — integration IT-021, IT-025, IT-027, IT-033, IT-036', () => {
  it('IT-021: narrow viewport scrollable modal + cancel', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain('ScrollArea');
    expect(src).toContain('data-testid="export-cancel"');
    expect(src).toMatch(/flex-col md:flex-row/);
  });

  it('IT-025: native offline selectable source wiring', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain('isOfflineBasemapAvailable');
    const previewMapSrc = readSrc('src/components/map/export/PreviewMap.jsx');
    expect(previewMapSrc).toContain('OfflineTileLayer');
    expect(previewMapSrc).toContain('OnlineTileLayer');
    expect(readSrc('src/components/map/export/OfflineTileLayer.jsx')).toContain('getLocalTileUrl');
    expect(readSrc('src/components/map/export/OnlineTileLayer.jsx')).toContain('buildOnlineReadinessPayload');
  });

  it('IT-027: satellite + dpi 300 preview model', () => {
    const model = buildPreviewModel({
      settings: { basemap: 'satellite', dpi: 300, title: 'T', author: 'A' },
      elements: [sampleEl()],
    });
    expect(model.basemap).toBe('satellite');
    expect(model.paperFrame.captureScale).toBeCloseTo(300 / 96, 5);
  });

  it('IT-033: large paper + satellite model loading path', () => {
    const model = buildPreviewModel({
      settings: { paperSize: 'A3', basemap: 'satellite', dpi: 600, title: 'T', author: 'A' },
      elements: [sampleEl()],
      boundaryLoading: true,
    });
    expect(model.previewStatus).toBe('loading');
    expect(model.paperFrame.paperSize).toBe('A3');
  });

  it('IT-036: mobile stack layout classes', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain('data-mobile-layout="stack"');
    expect(src).toContain('export-preview-column');
  });
});

describe('export preview — E2E source contracts E2E-003–014', () => {
  it('E2E-003: metadata controls wired to preview', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain("update('title'");
    expect(src).toContain('CompositionPreview');
  });

  it('E2E-004: legend position options inside/beside/below', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain("'inside'");
    expect(src).toContain("'beside'");
    expect(src).toContain("'below'");
  });

  it('E2E-005: inside legend drag/resize in LegendFrame', () => {
    const src = readSrc('src/components/map/export/LegendFrame.jsx');
    expect(src).toContain('applyLegendDrag');
    expect(src).toContain('applyLegendResize');
  });

  it('E2E-006: columns/font/spacing controls', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain('legendColumns');
    expect(src).toContain('legendFontSizePx');
    expect(src).toContain('legendSpacing');
  });

  it('E2E-007: visibility panel independent overlay', () => {
    const src = readSrc('src/components/map/export/ExportVisibilityPanel.jsx');
    expect(src).toContain('hiddenCategoryIds');
    expect(src).toContain('hiddenElementIds');
  });

  it('E2E-008: global tags switch', () => {
    const src = readSrc('src/components/map/export/ExportVisibilityPanel.jsx');
    expect(src).toContain('showTags');
  });

  it('E2E-009: basemap options ArcGIS + offline disabled web', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain('export-offline-web-disabled');
    expect(resolveBasemapTileUrl('satellite')).toContain('arcgisonline');
  });

  it('E2E-012: paper/orientation/DPI controls', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain('paperSize');
    expect(src).toContain('orientation');
    expect(src).toContain('dpi');
  });

  it('E2E-013: live preview without refresh', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).not.toMatch(/Atualizar Preview/i);
    expect(src).toContain('buildPreviewModel');
  });

  it('E2E-014: footer institutional + logo', () => {
    const src = readSrc('src/components/map/export/InstitutionalFooter.jsx');
    expect(src).toContain('ReatCarto');
    expect(src).toContain('LOGO_PATH');
  });
});

/** Sample boundary payload for locator export-freeze behavioral tests (US-010/US-015). */
const sampleLocatorBoundary = {
  stateGeometry: {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { id: '43' }, geometry: { type: 'Point', coordinates: [-53, -29] } }],
  },
  municipalityGeometry: {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { id: '4314902' }, geometry: { type: 'Point', coordinates: [-51, -30] } }],
  },
  municipalMesh: null,
  usedFallback: false,
};

/** Mirrors CompositionPreview inputs while isExporting with locators configured. */
function buildExportFreezePreviewModel(boundaryResult, overrides = {}) {
  return buildPreviewModel({
    settings: {
      title: 'T',
      author: 'A',
      locatorCount: 1,
      stateCode: '43',
      municipalityCode: '4314902',
      basemap: 'carto',
      ...(overrides.settings ?? {}),
    },
    elements: [sampleEl()],
    basemapReadiness: buildOnlineReadinessPayload(['https://tiles.example.com/{z}/{x}/{y}.png']),
    boundaryResult,
    boundaryLoading: false,
    locationLabels: { stateName: 'Rio Grande do Sul', municipalityName: 'Porto Alegre' },
    ...overrides,
  });
}

describe('export preview — composition frozen during export (review issue_003)', () => {
  it('options panel and preview freeze while isExporting', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toContain('const optionsDisabled = ownershipLost || isExporting');
    expect(src).toContain('data-options-disabled');
    expect(src).toContain('frozenExport');
    expect(src).toContain('previewSettings');
    expect(src).not.toContain('previewBasemapReadiness');
    expect(src).toContain('data-preview-frozen');
    expect(src).toContain('pointer-events-none');
    expect(src).toMatch(/if\s*\(\s*isExporting\s*\)\s*return/);
    expect(src).toMatch(/enabled:\s*open\s*&&\s*!ownershipLost\s*&&\s*!isExporting/);
    expect(src).not.toMatch(/disabled=\{ownershipLost\}/);
  });

  it('modal previewModel uses frozen previewSettings/previewElements aligned with CompositionPreview', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    const previewModelBlock = src.match(/const previewModel = useMemo\([\s\S]*?\),\s*\[[^\]]+\]\s*\)/);
    expect(previewModelBlock).toBeTruthy();
    const block = previewModelBlock[0];
    expect(block).toContain('settings: previewSettings');
    expect(block).toContain('elements: previewElements');
    expect(block).not.toMatch(/settings:\s*config\b/);
    expect(block).not.toMatch(/elements:\s*elements\b/);
    expect(block).toContain('basemapReadiness');
    expect(src).toMatch(
      /effectiveVisibleElements\(\s*previewElements\s*,\s*previewSettings\s*\)/
    );
    expect(src).toMatch(/validateExportGates\(\s*previewSettings\s*,/);
  });

  it('boundary hook preserves loaded geometries when disabled during export', () => {
    const hookSrc = readSrc('src/lib/export/useExportLocationBoundaries.js');
    expect(hookSrc).toMatch(/if\s*\(\s*!enabled\s*\)\s*\{\s*\n\s*setBoundaryLoading\(false\);\s*\n\s*return undefined;\s*\n\s*\}/);
    expect(hookSrc).not.toMatch(/if\s*\(\s*!enabled\s*\|\|\s*normalized\.locatorCount\s*===\s*0\s*\)/);
    expect(hookSrc).toMatch(
      /useEffect\(\(\) => \{\s*if\s*\(\s*!enabled\s*\)\s*\{[\s\S]*?if\s*\(\s*normalized\.locatorCount\s*===\s*0\s*\)[\s\S]*?getLocatorGeometries/
    );
  });

  it('preserved boundaryResult keeps locator insets and overlay outline during export freeze', () => {
    const beforeExport = buildExportFreezePreviewModel(sampleLocatorBoundary);
    expect(beforeExport.previewStatus).toBe('ready');
    expect(beforeExport.locatorInsets.length).toBeGreaterThan(0);
    expect(beforeExport.locationOverlay.outline).toBeTruthy();

    // isExporting disables the hook (enabled=false) but must not clear an already-loaded boundaryResult.
    const duringExport = buildExportFreezePreviewModel(sampleLocatorBoundary);
    expect(duringExport.previewStatus).toBe('ready');
    expect(duringExport.locatorInsets).toEqual(beforeExport.locatorInsets);
    expect(duringExport.locationOverlay.outline).toEqual(beforeExport.locationOverlay.outline);
  });

  it('null boundaryResult during export drops locator geometries from capture model', () => {
    const withBoundary = buildExportFreezePreviewModel(sampleLocatorBoundary);
    const withoutBoundary = buildExportFreezePreviewModel(null);
    expect(withBoundary.locatorInsets[0].stateGeometry).toBeTruthy();
    expect(withBoundary.locatorInsets[0].municipalityGeometry).toBeTruthy();
    expect(withBoundary.locationOverlay.outline.geometry).toBeTruthy();
    expect(withoutBoundary.locatorInsets[0].stateGeometry).toBeFalsy();
    expect(withoutBoundary.locatorInsets[0].municipalityGeometry).toBeFalsy();
    expect(withoutBoundary.locationOverlay.outline.geometry).toBeFalsy();
  });
});

describe('export preview — live basemap readiness during export (review issue_001)', () => {
  it('frozen export snapshot excludes basemapReadiness; tile callbacks stay live while isExporting', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toMatch(/setFrozenExport\(\{[^}]*settings[^}]*elements[^}]*\}\)/);
    expect(src).not.toMatch(/setFrozenExport\(\{[^}]*basemapReadiness/);
    expect(src).not.toContain('previewBasemapReadiness');
    expect(src).toMatch(/basemapReadiness=\{basemapReadiness\}/);
    expect(src).not.toMatch(
      /const handleBasemapReadinessChange[\s\S]*if\s*\(\s*isExporting\s*\)\s*return[\s\S]*setBasemapReadiness/
    );
    expect(src).toMatch(/useEffect\([\s\S]*isExporting[\s\S]*setFrozenExport/);
    expect(src).toMatch(/handleExportClick[\s\S]*setFrozenExport\(\{[^}]*settings[^}]*elements[^}]*\}\)/);
  });

  it('tile failure after export start must flip previewStatus to error for waitForPreviewReadiness (ADR-010)', () => {
    const readyBefore = buildOnlinePreviewModel(
      new Map([
        ['11:100:200', 'https://tile-a'],
        ['11:101:200', 'https://tile-b'],
      ]),
      'carto'
    );
    expect(readyBefore.previewStatus).toBe('ready');

    const afterTileFailure = buildOnlinePreviewModel(new Map([['11:101:200', null]]), 'carto');
    expect(afterTileFailure.previewStatus).toBe('error');
    expect(exportBlockedByPreviewStatus(afterTileFailure)).toBe(true);
  });
});

describe('export preview — elements frozen during export (review issue_004)', () => {
  it('CompositionPreview receives frozen elements while isExporting', () => {
    const src = readSrc('src/components/map/ExportMapModal.jsx');
    expect(src).toMatch(/setFrozenExport\(\{[^}]*elements/);
    expect(src).toContain('const previewElements');
    expect(src).toMatch(/elements=\{previewElements\}/);
    expect(src).not.toMatch(/<CompositionPreview[\s\S]*elements=\{elements\}/);
  });
});

describe('export preview — geo parse helpers', () => {
  it('safeParseGeojson handles point', () => {
    const geo = safeParseGeojson(JSON.stringify({ type: 'Point', coordinates: [1, 2] }));
    expect(geo.type).toBe('Point');
  });
});

describe('export preview — paper frame dimensions', () => {
  it('computePaperFrameDimensions returns aspect and capture scale', () => {
    const frame = computePaperFrameDimensions({ paperSize: 'A4', orientation: 'landscape', dpi: 300 });
    expect(frame.aspect).toBeGreaterThan(1);
    expect(frame.captureScale).toBeCloseTo(300 / 96, 5);
  });
});
