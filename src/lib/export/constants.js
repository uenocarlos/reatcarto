/** @typedef {'png'|'pdf'} ExportFormat */
/** @typedef {'a4'|'a3'|'letter'} ExportPaper */
/** @typedef {'landscape'|'portrait'} ExportOrientation */
/** @typedef {'branco'|'osm'|'satelite'} ExportBasemap */
/** @typedef {'right'|'bottom'} LegendPosition */
/** @typedef {'very_compact'|'compact'|'normal'|'loose'|'very_loose'} LegendSpacing */

export const DEFAULT_DPI = 300;
export const MIN_DPI = 72;
export const MAX_DPI = 600;

export const DEFAULT_FORMAT = 'png';
export const DEFAULT_PAPER = 'a4';
export const DEFAULT_ORIENTATION = 'landscape';
export const DEFAULT_LEGEND_POSITION = 'right';

export const LEGEND_COLUMNS_MIN = 1;
export const LEGEND_COLUMNS_MAX = 6;
export const LEGEND_FONT_MIN = 8;
export const LEGEND_FONT_MAX = 18;
export const DEFAULT_LEGEND_FONT_PX = 12;
export const DEFAULT_LEGEND_COLUMNS = 1;
export const DEFAULT_LEGEND_SPACING = 'normal';

export const DEFAULT_BRASIL_COLOR = '#C9D9F2';
export const DEFAULT_STATE_COLOR = '#D9E6A4';
export const DEFAULT_MUNICIPIO_COLOR = '#E6A4A4';

export const PREVIEW_DEBOUNCE_MS = 400;

export const LEGEND_SPACING_VALUES = Object.freeze([
  'very_compact',
  'compact',
  'normal',
  'loose',
  'very_loose',
]);

/** Tile URLs aligned with editor/export basemaps (see `@/lib/basemaps`) */
export { BASEMAP_TILE_URLS } from '@/lib/basemaps';

/** Re-export for callers that still import from constants */
export { MAP_MAX_ZOOM } from '@/lib/basemaps';
