import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createColoredIcon, iconSizeForZoom } from '@/components/map/pointIcon';
import ExportLegend from '@/components/map/export/ExportLegend';
import { groupElements, identityOf } from '@/lib/export/layerGrouping';

const CUSTOM_URL = '/php/icons/get.php?id=abc';
const LEGACY_URL = 'https://cdn.example/x.png';

describe('createColoredIcon bitmap branch', () => {
  it('UT-040: custom URL uses img without mask-image', () => {
    const icon = createColoredIcon('#f00', 'pin', CUSTOM_URL);
    expect(icon.html).toContain('<img');
    expect(icon.html).toContain(CUSTOM_URL);
    expect(icon.html).not.toContain('mask-image');
  });

  it('UT-044: bitmap branch ignores icon_color for artwork', () => {
    const icon = createColoredIcon('#f00', 'pin', CUSTOM_URL);
    expect(icon.html).not.toMatch(/background-color:\s*#f00/i);
    expect(icon.html).not.toMatch(/background-color:\s*rgb\(255,\s*0,\s*0\)/i);
  });

  it('UT-046: bitmap sizes follow iconSizeForZoom at zoom boundaries', () => {
    const far = createColoredIcon('#000', 'pin', CUSTOM_URL, { zoom: 9 });
    const near = createColoredIcon('#000', 'pin', CUSTOM_URL, { zoom: 16 });
    expect(iconSizeForZoom(9)).toBe(14);
    expect(iconSizeForZoom(16)).toBe(32);
    expect(far.iconSize).toEqual([14, 14]);
    expect(near.iconSize).toEqual([32, 32]);
    expect(far.html).toContain('width:14px;height:14px');
    expect(near.html).toContain('width:32px;height:32px');
  });

  it('UT-047: empty custom URL uses SVG path without img', () => {
    const icon = createColoredIcon('#0f0', 'pin', '');
    expect(icon.html).not.toContain('<img');
    expect(icon.html).toContain('<svg');
  });

  it('UT-048: legacy custom URL uses img color-preserving path', () => {
    const icon = createColoredIcon('#0f0', 'pin', LEGACY_URL);
    expect(icon.html).toContain('<img');
    expect(icon.html).toContain(LEGACY_URL);
    expect(icon.html).not.toContain('mask-image');
  });

  it('uses center anchor for custom bitmap markers', () => {
    const icon = createColoredIcon('#000', 'pin', CUSTOM_URL, { size: 24 });
    expect(icon.iconAnchor).toEqual([12, 12]);
  });

  it('includes onerror fallback for broken custom URLs', () => {
    const icon = createColoredIcon('#000', 'pin', CUSTOM_URL);
    expect(icon.html).toContain('onerror=');
    expect(icon.html).toContain("this.style.visibility='hidden'");
  });

  it('built-in SVG path in icon_name still uses mask tint when custom URL empty', () => {
    const icon = createColoredIcon('#0f0', '/icons/pin.svg', '');
    expect(icon.html).not.toContain('<img');
    expect(icon.html).toContain('mask-image');
    expect(icon.html).toContain('background-color:#0f0');
  });
});

describe('ExportLegend custom URL symbols', () => {
  it('UT-045: custom URL legend symbol uses bitmap class, not mask class', () => {
    render(
      <ExportLegend
        items={[{
          id: 'leg-1',
          label: 'Custom',
          symbolKind: 'point',
          style: {
            icon_name: 'pin',
            icon_color: '#f00',
            custom_icon_url: CUSTOM_URL,
          },
        }]}
        legendPosition="bottom"
      />,
    );

    const symbol = screen.getByTestId('export-legend-item').querySelector('.export-legend__symbol');
    expect(symbol).toHaveClass('export-legend__symbol--point-bitmap');
    expect(symbol).not.toHaveClass('export-legend__symbol--point-icon');
    expect(symbol.querySelector('img')).toHaveAttribute('src', CUSTOM_URL);
  });

  it('built-in icon_name path keeps mask legend symbol', () => {
    render(
      <ExportLegend
        items={[{
          id: 'leg-2',
          label: 'Built-in path',
          symbolKind: 'point',
          style: {
            icon_name: '/icons/pin.svg',
            icon_color: '#0f0',
            custom_icon_url: '',
          },
        }]}
        legendPosition="bottom"
      />,
    );

    const symbol = screen.getByTestId('export-legend-item').querySelector('.export-legend__symbol');
    expect(symbol).toHaveClass('export-legend__symbol--point-icon');
    expect(symbol).not.toHaveClass('export-legend__symbol--point-bitmap');
  });
});

describe('legend grouping with custom_icon_url', () => {
  it('UT-049: different custom URLs do not collapse in identityOf', () => {
    const a = identityOf({
      id: 'a1',
      name: 'Same',
      style: { icon_name: 'pin', icon_color: '#f00', custom_icon_url: '/php/icons/get.php?id=1' },
    }, 'point');
    const b = identityOf({
      id: 'b1',
      name: 'Same',
      style: { icon_name: 'pin', icon_color: '#f00', custom_icon_url: '/php/icons/get.php?id=2' },
    }, 'point');

    expect(a.key).not.toBe(b.key);

    const groups = groupElements([
      { id: 'a1', name: 'Same', element_category: 'outros', style: { icon_name: 'pin', icon_color: '#f00', custom_icon_url: '/php/icons/get.php?id=1' } },
      { id: 'b1', name: 'Same', element_category: 'outros', style: { icon_name: 'pin', icon_color: '#f00', custom_icon_url: '/php/icons/get.php?id=2' } },
    ], 'point');

    expect(groups).toHaveLength(2);
  });
});
