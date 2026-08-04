import {
  BASEMAP_TILE_URLS,
  DEFAULT_DPI,
  DEFAULT_FORMAT,
  DEFAULT_LEGEND_COLUMNS,
  DEFAULT_LEGEND_FONT_PX,
  DEFAULT_LEGEND_POSITION,
  DEFAULT_LEGEND_SPACING,
  DEFAULT_MUNICIPIO_COLOR,
  DEFAULT_ORIENTATION,
  DEFAULT_PAPER,
  DEFAULT_STATE_COLOR,
  LEGEND_COLUMNS_MAX,
  LEGEND_COLUMNS_MIN,
  LEGEND_FONT_MAX,
  LEGEND_FONT_MIN,
  LEGEND_SPACING_VALUES,
  MAX_DPI,
  MIN_DPI,
} from './constants.js';
import { buildLegendItems } from './legendItems.js';

/**
 * @typedef {Object} EditorExportSnapshot
 * @property {string} mapName
 * @property {{ lat: number, lng: number }} center
 * @property {number} zoom
 * @property {Set<string>|string[]} hiddenIds
 * @property {string} basemap
 * @property {Array<Record<string, unknown>>} elements
 */

/**
 * @typedef {Object} ExportSessionState
 * @property {string} title
 * @property {string} authorship
 * @property {string} technicalResponsible
 * @property {'png'|'pdf'} format
 * @property {'a4'|'a3'|'letter'} paper
 * @property {'landscape'|'portrait'} orientation
 * @property {number} dpi
 * @property {'inside'|'right'|'bottom'} legendPosition
 * @property {number} legendColumns
 * @property {number} legendFontPx
 * @property {string} legendSpacing
 * @property {{ xPct: number, yPct: number, wPct: number, hPct: number }} legendInside
 * @property {number} legendRightWidthPct
 * @property {string[]} legendItemOrder
 * @property {boolean} legendGroupByTopic
 * @property {Set<string>} hiddenIds
 * @property {boolean} showLabels
 * @property {'branco'|'osm'|'satelite'} basemap
 * @property {0|1|2} locationCount
 * @property {Array<{ uf: string|null, stateName?: string|null, municipioCode: string|null, municipioName?: string|null }>} locations
 * @property {boolean} showMunicipalMesh
 * @property {boolean} stateOnLegend
 * @property {string} stateColor
 * @property {string} municipioColor
 * @property {{ lat: number, lng: number }} center
 * @property {number} zoom
 * @property {Array<Record<string, unknown>>} elements
 * @property {boolean} isGenerating
 * @property {string|null} generationError
 * @property {string|null} geoLoadError
 */

const DEFAULT_NORTH_POSITION = Object.freeze({ xPct: 8, yPct: 68 });
const DEFAULT_SCALE_POSITION = Object.freeze({ xPct: 3, yPct: 86 });

export function deriveDefaultLegendLayout(elements = [], hiddenIds = new Set()) {
  const items = buildLegendItems({ elements, hiddenIds, groupByTopic: true });
  const itemCount = items.filter((item) => item.symbolKind !== 'topic').length;
  const topicCount = items.length - itemCount;

  let columns = 1;
  let fontPx = 12;
  let widthPct = 30;
  if (itemCount > 6 && itemCount <= 14) {
    columns = 2;
    fontPx = 11;
    widthPct = 46;
  } else if (itemCount > 14 && itemCount <= 27) {
    columns = 3;
    fontPx = 10;
    widthPct = 64;
  } else if (itemCount > 27) {
    columns = Math.min(6, Math.max(4, Math.ceil(itemCount / 10)));
    fontPx = itemCount > 50 ? 8 : 9;
    widthPct = Math.min(92, columns * 17);
  }

  const itemRows = Math.ceil(itemCount / columns);
  const estimatedHeightPx = 50 + itemRows * 30 + topicCount * 24;
  const heightPct = Math.max(24, Math.min(90, Math.ceil((estimatedHeightPx / 420) * 100)));

  return {
    columns,
    fontPx,
    spacing: itemCount > 27 ? 'very_compact' : itemCount > 14 ? 'compact' : 'normal',
    inside: {
      xPct: 100 - widthPct - 3,
      yPct: 100 - heightPct - 3,
      wPct: widthPct,
      hPct: heightPct,
    },
    itemCount,
  };
}

/**
 * @param {{ mapName?: string, center?: { lat?: number, lng?: number }, zoom?: number, hiddenIds?: Set<string>|string[], basemap?: string, elements?: Array<Record<string, unknown>> }} input
 * @returns {EditorExportSnapshot}
 */
export function createEditorExportSnapshot(input = {}) {
  const exportableElements = Array.isArray(input.elements)
    ? input.elements
        .filter((el) => el?.is_publicly_visible !== false && el?.is_publicly_visible !== 0)
        .map((el) => ({ ...el }))
    : [];

  const hiddenIds = input.hiddenIds instanceof Set
    ? new Set(input.hiddenIds)
    : new Set(Array.isArray(input.hiddenIds) ? input.hiddenIds : []);

  return {
    mapName: String(input.mapName ?? ''),
    center: {
      lat: Number(input.center?.lat ?? 0),
      lng: Number(input.center?.lng ?? 0),
    },
    zoom: Number(input.zoom ?? 0),
    hiddenIds,
    basemap: String(input.basemap ?? 'branco'),
    elements: exportableElements,
  };
}

/**
 * @param {EditorExportSnapshot} snapshot
 * @returns {ExportSessionState}
 */
export function createDefaultExportSession(snapshot) {
  const hiddenIds = snapshot.hiddenIds instanceof Set
    ? new Set(snapshot.hiddenIds)
    : new Set(Array.isArray(snapshot.hiddenIds) ? snapshot.hiddenIds : []);
  const legendLayout = deriveDefaultLegendLayout(snapshot.elements, hiddenIds);

  return {
    title: String(snapshot.mapName ?? ''),
    authorship: '',
    technicalResponsible: '',
    format: DEFAULT_FORMAT,
    paper: DEFAULT_PAPER,
    orientation: DEFAULT_ORIENTATION,
    dpi: DEFAULT_DPI,
    legendPosition: DEFAULT_LEGEND_POSITION,
    legendColumns: legendLayout.columns,
    legendFontPx: legendLayout.fontPx,
    legendSpacing: legendLayout.spacing,
    legendInside: { ...legendLayout.inside },
    legendRightWidthPct: 25,
    legendItemOrder: [],
    legendGroupByTopic: true,
    northPosition: { ...DEFAULT_NORTH_POSITION },
    northSizePx: 70,
    scalePosition: { ...DEFAULT_SCALE_POSITION },
    scaleSizePx: 140,
    hiddenIds,
    showLabels: false,
    basemap: mapEditorBasemapToExport(snapshot.basemap),
    locationCount: 0,
    locations: [{ uf: null, municipioCode: null }, { uf: null, municipioCode: null }],
    showMunicipalMesh: false,
    stateOnLegend: false,
    stateColor: DEFAULT_STATE_COLOR,
    municipioColor: DEFAULT_MUNICIPIO_COLOR,
    center: { ...snapshot.center },
    zoom: snapshot.zoom,
    elements: snapshot.elements.map((el) => ({ ...el })),
    isGenerating: false,
    generationError: null,
    geoLoadError: null,
  };
}

/**
 * @param {unknown} value
 * @param {{ previous?: number }} [options]
 * @returns {{ ok: boolean, value: number, nonNumeric?: boolean }}
 */
export function clampDpi(value, options = {}) {
  const previous = options.previous ?? DEFAULT_DPI;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { ok: false, value: previous, nonNumeric: true };
  }
  return { ok: true, value: Math.min(MAX_DPI, Math.max(MIN_DPI, num)) };
}

/**
 * @param {unknown} title
 * @returns {{ ok: true, title: string } | { ok: false, code: 'empty_title' }}
 */
export function assertExportTitle(title) {
  const trimmed = String(title ?? '').trim();
  if (!trimmed) {
    return { ok: false, code: 'empty_title' };
  }
  return { ok: true, title: trimmed };
}

/**
 * @param {unknown} basemap
 * @returns {'branco'|'osm'|'satelite'}
 */
export function mapEditorBasemapToExport(basemap) {
  const key = String(basemap ?? '').toLowerCase();
  if (key === 'branco' || key === 'osm' || key === 'satelite') return key;
  return 'branco';
}

/**
 * @param {unknown} basemap
 * @returns {string}
 */
export function resolveBasemapTileUrl(basemap) {
  const key = mapEditorBasemapToExport(basemap);
  return BASEMAP_TILE_URLS[key];
}

/**
 * @param {unknown} title
 * @param {'png'|'pdf'} format
 * @returns {string}
 */
export function buildExportFileName(title, format) {
  let base = String(title ?? '').trim();
  base = base.replace(/[/\\]/g, '_');
  if (!base) base = 'mapa';
  const ext = format === 'pdf' ? '.pdf' : '.png';
  if (base.toLowerCase().endsWith(ext)) return base;
  return `${base}${ext}`;
}

const PREVIEW_TITLE_MAX = 500;

/**
 * @param {unknown} title
 * @returns {string}
 */
export function truncateTitleForPreview(title) {
  const str = String(title ?? '');
  if (str.length <= PREVIEW_TITLE_MAX) return str;
  return `${str.slice(0, PREVIEW_TITLE_MAX)}…`;
}

/**
 * @param {unknown} columns
 * @returns {number}
 */
export function clampLegendColumns(columns) {
  const num = Number(columns);
  if (!Number.isFinite(num)) return DEFAULT_LEGEND_COLUMNS;
  return Math.min(LEGEND_COLUMNS_MAX, Math.max(LEGEND_COLUMNS_MIN, Math.round(num)));
}

/**
 * Font px policy: clamp out-of-range values to bounds (UT-025).
 * @param {unknown} fontPx
 * @returns {{ ok: boolean, value: number, clamped?: boolean }}
 */
export function validateLegendFontPx(fontPx) {
  const num = Number(fontPx);
  if (!Number.isFinite(num)) {
    return { ok: false, value: DEFAULT_LEGEND_FONT_PX, clamped: true };
  }
  if (num < LEGEND_FONT_MIN || num > LEGEND_FONT_MAX) {
    return {
      ok: false,
      value: Math.min(LEGEND_FONT_MAX, Math.max(LEGEND_FONT_MIN, num)),
      clamped: true,
    };
  }
  return { ok: true, value: num };
}

/**
 * @param {unknown} spacing
 * @returns {string}
 */
export function validateLegendSpacing(spacing) {
  const value = String(spacing ?? DEFAULT_LEGEND_SPACING);
  return LEGEND_SPACING_VALUES.includes(value) ? value : DEFAULT_LEGEND_SPACING;
}

/**
 * @param {ExportSessionState} session
 * @param {'png'|'pdf'} format
 * @returns {ExportSessionState}
 */
export function setFormat(session, format) {
  return { ...session, format };
}

/**
 * @param {ExportSessionState} session
 * @param {number} dpi
 * @returns {ExportSessionState}
 */
export function setDpi(session, dpi) {
  const result = clampDpi(dpi, { previous: session.dpi });
  return { ...session, dpi: result.value };
}

/**
 * @param {ExportSessionState} session
 * @param {number} columns
 * @returns {ExportSessionState}
 */
export function setLegendColumns(session, columns) {
  return { ...session, legendColumns: clampLegendColumns(columns) };
}

/**
 * @param {ExportSessionState} session
 * @param {{ xPct?: number, yPct?: number, wPct?: number, hPct?: number }} metrics
 * @returns {ExportSessionState}
 */
export function setLegendInside(session, metrics) {
  return {
    ...session,
    legendInside: {
      xPct: Number(metrics.xPct ?? session.legendInside.xPct),
      yPct: Number(metrics.yPct ?? session.legendInside.yPct),
      wPct: Number(metrics.wPct ?? session.legendInside.wPct),
      hPct: Number(metrics.hPct ?? session.legendInside.hPct),
    },
  };
}

/** Clamp a cartographic control to the main map's percentage coordinate space. */
export function setMapChrome(session, control, values = {}) {
  const isNorth = control === 'north';
  const positionKey = isNorth ? 'northPosition' : 'scalePosition';
  const sizeKey = isNorth ? 'northSizePx' : 'scaleSizePx';
  const currentPosition = session[positionKey] ?? (isNorth ? DEFAULT_NORTH_POSITION : DEFAULT_SCALE_POSITION);
  const minSize = isNorth ? 32 : 80;
  const maxSize = isNorth ? 140 : 260;
  const rawSize = Number(values.sizePx ?? session[sizeKey]);
  const sizePx = Number.isFinite(rawSize)
    ? Math.min(maxSize, Math.max(minSize, rawSize))
    : session[sizeKey];
  const rawX = Number(values.xPct ?? currentPosition.xPct);
  const rawY = Number(values.yPct ?? currentPosition.yPct);

  return {
    ...session,
    [positionKey]: {
      xPct: Math.min(100, Math.max(0, Number.isFinite(rawX) ? rawX : currentPosition.xPct)),
      yPct: Math.min(100, Math.max(0, Number.isFinite(rawY) ? rawY : currentPosition.yPct)),
    },
    [sizeKey]: sizePx,
  };
}

/**
 * @param {ExportSessionState} session
 * @param {0|1|2} count
 * @returns {ExportSessionState}
 */
export function setLocationCount(session, count) {
  const locationCount = count === 1 || count === 2 ? count : 0;
  const locations = locationCount === 0
    ? [{ uf: null, municipioCode: null }, { uf: null, municipioCode: null }]
    : session.locations;
  return { ...session, locationCount, locations };
}
