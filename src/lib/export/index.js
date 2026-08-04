/**
 * Public export library surface for composition UI (task_02/03).
 * Pure modules — no React or Leaflet constructors required.
 */

export {
  INSTITUTIONAL_FOOTER_LINES,
  EXPORT_LOGO_PATH,
  EXPORT_NORTH_PATH,
  buildFooterLines,
  buildBrandingComposition,
} from './branding.js';

export {
  DEFAULT_DPI,
  MIN_DPI,
  MAX_DPI,
  BASEMAP_TILE_URLS,
  PREVIEW_DEBOUNCE_MS,
  LEGEND_SPACING_VALUES,
  LEGEND_COLUMNS_MIN,
  LEGEND_COLUMNS_MAX,
  LEGEND_FONT_MIN,
  LEGEND_FONT_MAX,
} from './constants.js';

export {
  createEditorExportSnapshot,
  createDefaultExportSession,
  clampDpi,
  assertExportTitle,
  mapEditorBasemapToExport,
  resolveBasemapTileUrl,
  buildExportFileName,
  truncateTitleForPreview,
  clampLegendColumns,
  validateLegendFontPx,
  validateLegendSpacing,
  setFormat,
  setDpi,
  setLegendColumns,
  setLegendInside,
  setMapChrome,
  setLocationCount,
  deriveDefaultLegendLayout,
} from './session.js';

export {
  buildLegendItems,
  applyLegendItemOrder,
  withLegendTopics,
  categoryBucket,
  LEGEND_TOPIC_DEFS,
} from './legendItems.js';

export { createPreviewSync, flushPreviewSync } from './previewSync.js';

export {
  loadGeoBoundaries,
  filterMunicipalitiesByUf,
  validateLocationSelection,
  allowsDuplicateUfLocations,
  normalizeStatesCollection,
  normalizeMunicipalitiesCollection,
  resetGeoBoundariesCache,
  configureGeoBoundaries,
  GeoBoundaryError,
} from './geoBoundaries.js';

export { computeScaleLabel, formatScaleLabel, metersPerPixel, pickScaleDistance } from './scale.js';

export {
  generateExport,
  ExportGenerationError,
  waitForTilesReady,
  mapCaptureError,
} from './generateExport.js';
