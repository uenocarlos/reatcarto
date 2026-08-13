import { describe, expect, it } from 'vitest';
import {
  buildLegendItems,
  countLegendSymbolItems,
  legendColumnRangeForItemCount,
  suggestLegendColumns,
} from '@/lib/export/legendItems';
import { clampLegendColumns, validateLegendFontPx, validateLegendSpacing } from '@/lib/export/session';

describe('legend builder', () => {
  it('UT-020: empty elements returns [] without throw', () => {
    expect(buildLegendItems({ elements: [], hiddenIds: new Set(), location: null })).toEqual([]);
  });

  it('UT-021: 200 visible points produce 200 items', () => {
    const elements = Array.from({ length: 200 }, (_, i) => ({
      id: `p-${i}`,
      name: `Point ${i}`,
      element_type: 'point',
    }));
    const items = buildLegendItems({ elements, hiddenIds: new Set() });
    expect(items).toHaveLength(200);
    for (const item of items) {
      expect(item.label).toBeTruthy();
      expect(item.symbolKind).toBe('point');
    }
  });

  it('UT-022: visible point with style produces matching item', () => {
    const items = buildLegendItems({
      elements: [{ id: 'p1', name: 'Porto', element_type: 'point', style: { icon_color: '#ff0000' } }],
      hiddenIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Porto');
    expect(items[0].symbolKind).toBe('point');
  });

  it('UT-023: hidden element excluded', () => {
    const items = buildLegendItems({
      elements: [
        { id: 'hidden', name: 'H', element_type: 'point' },
        { id: 'visible', name: 'V', element_type: 'point' },
      ],
      hiddenIds: new Set(['hidden']),
    });
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('V');
  });

  it('UT-023b: cartographic conventions topic groups location legend items', () => {
    const items = buildLegendItems({
      elements: [{ id: 'visible', name: 'V', element_type: 'point', element_category: 'terra' }],
      hiddenIds: new Set(),
      groupByTopic: true,
      location: {
        stateLabel: 'Rio Grande do Sul',
        municipioLabel: 'Porto Alegre',
        topicLabel: 'Convencoes cartograficas',
      },
    });

    expect(items.map((item) => item.label)).toContain('Convencoes cartograficas');
    expect(items.map((item) => item.label)).toContain('Rio Grande do Sul');
    expect(items.map((item) => item.label)).toContain('Porto Alegre');
  });

  it('orders icons, then lines, then polygons', () => {
    const items = buildLegendItems({
      elements: [
        { id: 'g1', name: 'Area', element_type: 'polygon', element_category: 'terra' },
        { id: 'p1', name: 'Casa', element_type: 'point', element_category: 'agua' },
        { id: 'l1', name: 'Rio', element_type: 'line', element_category: 'terra' },
        { id: 'p2', name: 'Farol', element_type: 'point', element_category: 'terra' },
      ],
      hiddenIds: new Set(),
    });

    expect(items.map((item) => item.symbolKind)).toEqual(['point', 'point', 'line', 'polygon']);
    expect(items.map((item) => item.label)).toEqual(['Casa', 'Farol', 'Rio', 'Area']);
  });

  it('keeps icon/line/polygon priority inside each topic group', () => {
    const items = buildLegendItems({
      elements: [
        { id: 'g1', name: 'Area', element_type: 'polygon', element_category: 'terra' },
        { id: 'p1', name: 'Casa', element_type: 'point', element_category: 'agua' },
        { id: 'l1', name: 'Rio', element_type: 'line', element_category: 'terra' },
        { id: 'p2', name: 'Farol', element_type: 'point', element_category: 'terra' },
      ],
      hiddenIds: new Set(),
      groupByTopic: true,
    });

    expect(items.map((item) => `${item.symbolKind}:${item.label}`)).toEqual([
      'topic:Terra',
      'point:Farol',
      'line:Rio',
      'polygon:Area',
      'topic:Água',
      'point:Casa',
    ]);
  });

  it('UT-024: legendColumns 1–6 accepted', () => {
    expect(clampLegendColumns(6)).toBe(6);
    expect(clampLegendColumns(0)).toBe(1);
    expect(clampLegendColumns(9)).toBe(6);
    expect(clampLegendColumns(6, 2)).toBe(2);
    expect(clampLegendColumns(1, 12)).toBe(1);
  });

  it('limits column options to the legend item count', () => {
    expect(countLegendSymbolItems([
      { symbolKind: 'point' },
      { symbolKind: 'topic' },
      { symbolKind: 'line' },
      { symbolKind: 'polygon' },
    ])).toBe(3);
    expect(legendColumnRangeForItemCount(0).options).toEqual([1]);
    expect(legendColumnRangeForItemCount(3).options).toEqual([1, 2, 3]);
    expect(legendColumnRangeForItemCount(20).options).toEqual([1, 2, 3, 4, 5, 6]);
    expect(suggestLegendColumns(3)).toBe(1);
    expect(suggestLegendColumns(12)).toBe(2);
    expect(suggestLegendColumns(30)).toBe(4);
  });

  it('UT-025: font 8 + very_compact valid; 7/19 clamped', () => {
    expect(validateLegendFontPx(8)).toEqual({ ok: true, value: 8 });
    expect(validateLegendSpacing('very_compact')).toBe('very_compact');
    expect(validateLegendFontPx(7).clamped).toBe(true);
    expect(validateLegendFontPx(7).value).toBe(8);
    expect(validateLegendFontPx(19).clamped).toBe(true);
    expect(validateLegendFontPx(19).value).toBe(18);
  });
});
