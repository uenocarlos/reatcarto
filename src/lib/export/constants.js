/** @typedef {'png'|'pdf'} ExportFormat */
/** @typedef {'a4'|'a3'|'letter'} ExportPaper */
/** @typedef {'landscape'|'portrait'} ExportOrientation */
/** @typedef {'branco'|'osm'|'satelite'} ExportBasemap */
/** @typedef {'inside'|'right'|'bottom'} LegendPosition */
/** @typedef {'very_compact'|'compact'|'normal'|'loose'|'very_loose'} LegendSpacing */

export const DEFAULT_DPI = 300;
export const MIN_DPI = 72;
export const MAX_DPI = 600;

export const DEFAULT_FORMAT = 'png';
export const DEFAULT_PAPER = 'a4';
export const DEFAULT_ORIENTATION = 'landscape';
export const DEFAULT_LEGEND_POSITION = 'inside';

export const LEGEND_COLUMNS_MIN = 1;
export const LEGEND_COLUMNS_MAX = 6;
export const LEGEND_FONT_MIN = 8;
export const LEGEND_FONT_MAX = 18;
export const DEFAULT_LEGEND_FONT_PX = 12;
export const DEFAULT_LEGEND_COLUMNS = 1;
export const DEFAULT_LEGEND_SPACING = 'normal';

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

/** Tile URLs aligned with LeafletMap BASEMAP_URLS */
export const BASEMAP_TILE_URLS = Object.freeze({
  branco: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satelite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
});
