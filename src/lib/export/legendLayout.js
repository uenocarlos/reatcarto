import { normalizeExportSettings } from './exportSettings';

/** @typedef {'inside'|'beside'|'below'} LegendLayoutMode */

export const LEGEND_MIN_W = 0.15;
export const LEGEND_MIN_H = 0.12;
export const LEGEND_MAX_W = 0.95;
export const LEGEND_MAX_H = 0.95;

export const DEFAULT_LEGEND_RECT = Object.freeze({
  x: 0.55,
  y: 0.55,
  w: 0.4,
  h: 0.35,
});

export const LEGEND_SPACING_PX = Object.freeze({
  compact: 2,
  normal: 4,
  wide: 8,
});

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @returns {LegendLayoutMode}
 */
export function getLegendLayoutMode(settings) {
  const normalized = normalizeExportSettings(settings);
  return normalized.legendPosition;
}

/**
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function clampLegendRect(rect) {
  const w = Math.min(LEGEND_MAX_W, Math.max(LEGEND_MIN_W, Number(rect.w) || LEGEND_MIN_W));
  const h = Math.min(LEGEND_MAX_H, Math.max(LEGEND_MIN_H, Number(rect.h) || LEGEND_MIN_H));
  const x = Math.min(1 - w, Math.max(0, Number(rect.x) || 0));
  const y = Math.min(1 - h, Math.max(0, Number(rect.y) || 0));
  return { x, y, w, h };
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @returns {{ x: number, y: number, w: number, h: number }|null}
 */
export function resolveLegendRect(settings) {
  const normalized = normalizeExportSettings(settings);
  if (normalized.legendPosition !== 'inside') return null;
  if (normalized.legendRect) {
    return clampLegendRect(normalized.legendRect);
  }
  return { ...DEFAULT_LEGEND_RECT };
}

/**
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @param {number} dx normalized delta
 * @param {number} dy normalized delta
 */
export function applyLegendDrag(rect, dx, dy) {
  return clampLegendRect({
    ...rect,
    x: rect.x + dx,
    y: rect.y + dy,
  });
}

/**
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @param {number} dw normalized delta
 * @param {number} dh normalized delta
 */
export function applyLegendResize(rect, dw, dh) {
  return clampLegendRect({
    ...rect,
    w: rect.w + dw,
    h: rect.h + dh,
  });
}

/**
 * @param {LegendLayoutMode} legendPosition
 * @returns {boolean}
 */
export function isInsideDragEnabled(legendPosition) {
  return legendPosition === 'inside';
}

/**
 * @param {number} columns
 * @param {number} fontSizePx
 * @param {'compact'|'normal'|'wide'} spacing
 */
export function buildLegendGridStyle(columns, fontSizePx, spacing) {
  const normalized = normalizeExportSettings({ legendColumns: columns, legendFontSizePx: fontSizePx, legendSpacing: spacing });
  return {
    gridTemplateColumns: `repeat(${normalized.legendColumns}, minmax(0, 1fr))`,
    fontSize: `${normalized.legendFontSizePx}px`,
    gap: `${LEGEND_SPACING_PX[normalized.legendSpacing] ?? LEGEND_SPACING_PX.normal}px`,
    columns: normalized.legendColumns,
    fontSizePx: normalized.legendFontSizePx,
    spacing: normalized.legendSpacing,
  };
}

/**
 * Estimate legend region size for beside/below growth layouts.
 * @param {{ legendPosition: LegendLayoutMode, itemCount: number, columns?: number, fontSizePx?: number, spacing?: string }} params
 */
export function estimateLegendRegion(params) {
  const normalized = normalizeExportSettings({
    legendPosition: params.legendPosition,
    legendColumns: params.columns,
    legendFontSizePx: params.fontSizePx,
    legendSpacing: params.spacing,
  });
  const count = Math.max(0, params.itemCount ?? 0);
  if (count === 0) {
    return { widthRatio: 0, heightRatio: 0, empty: true };
  }
  const rows = Math.ceil(count / normalized.legendColumns);
  const rowHeight = normalized.legendFontSizePx + (LEGEND_SPACING_PX[normalized.legendSpacing] ?? 4) + 8;
  const headerHeight = 24;
  const legendHeightPx = headerHeight + rows * rowHeight + 16;
  const legendWidthPx = normalized.legendColumns * 120;

  if (normalized.legendPosition === 'beside') {
    return {
      widthRatio: Math.min(0.45, legendWidthPx / 600),
      heightRatio: 0,
      empty: false,
      legendHeightPx,
      legendWidthPx,
    };
  }
  if (normalized.legendPosition === 'below') {
    return {
      widthRatio: 0,
      heightRatio: Math.min(0.5, legendHeightPx / 500),
      empty: false,
      legendHeightPx,
      legendWidthPx,
    };
  }
  return { widthRatio: 0, heightRatio: 0, empty: count === 0, legendHeightPx, legendWidthPx };
}

/**
 * @param {{ legendPosition: LegendLayoutMode, itemCount: number, mapWidth: number, mapHeight: number, columns?: number, fontSizePx?: number, spacing?: string }} params
 */
export function computeCompositionLayout(params) {
  const mode = params.legendPosition ?? 'inside';
  const mapWidth = Math.max(1, params.mapWidth ?? 600);
  const mapHeight = Math.max(1, params.mapHeight ?? 400);
  const legend = estimateLegendRegion({
    legendPosition: mode,
    itemCount: params.itemCount,
    columns: params.columns,
    fontSizePx: params.fontSizePx,
    spacing: params.spacing,
  });

  if (mode === 'beside') {
    const legendWidth = legend.empty ? 0 : Math.max(140, legend.legendWidthPx ?? 160);
    return {
      mode,
      mapWidth,
      mapHeight,
      totalWidth: mapWidth + legendWidth,
      totalHeight: mapHeight,
      legendWidth,
      legendHeight: mapHeight,
      legendOutsideMap: !legend.empty,
    };
  }

  if (mode === 'below') {
    const legendHeight = legend.empty ? 0 : Math.max(80, legend.legendHeightPx ?? 120);
    return {
      mode,
      mapWidth,
      mapHeight,
      totalWidth: mapWidth,
      totalHeight: mapHeight + legendHeight,
      legendWidth: mapWidth,
      legendHeight,
      legendOutsideMap: !legend.empty,
    };
  }

  return {
    mode: 'inside',
    mapWidth,
    mapHeight,
    totalWidth: mapWidth,
    totalHeight: mapHeight,
    legendWidth: 0,
    legendHeight: 0,
    legendOutsideMap: false,
  };
}

/**
 * @param {Array<{ name?: string, element_type?: string, style?: string }>} items
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 */
export function buildLegendItems(items, settings) {
  const normalized = normalizeExportSettings(settings);
  const style = buildLegendGridStyle(
    normalized.legendColumns,
    normalized.legendFontSizePx,
    normalized.legendSpacing
  );
  return (items ?? []).map((item, index) => {
    let parsed = {};
    try {
      parsed = item.style ? JSON.parse(item.style) : {};
    } catch {
      parsed = {};
    }
    const color = parsed.icon_color || parsed.color || parsed.border_color || '#F97316';
    const label = typeof item.name === 'string' && item.name.trim() !== '' ? item.name.trim() : `Elem. ${index + 1}`;
    return {
      id: item.id ?? `legend-${index}`,
      label,
      color,
      elementType: item.element_type ?? 'point',
      fillColor: parsed.fill_color || '#FED7AA',
      swatchSizePx: Math.max(8, Math.round(style.fontSizePx * 0.9)),
    };
  });
}
