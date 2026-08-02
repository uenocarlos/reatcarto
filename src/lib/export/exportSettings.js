import { sanitizeExportText } from './compositionMetadata';

/** @typedef {'inside'|'beside'|'below'} LegendPosition */
/** @typedef {'compact'|'normal'|'wide'} LegendSpacing */
/** @typedef {'carto'|'osm'|'satellite'|'offline'} ExportBasemap */
/** @typedef {0|1|2} LocatorCount */

/**
 * @typedef {Object} ExportSettings
 * @property {string} title
 * @property {string} author
 * @property {string} technicalResponsible
 * @property {LegendPosition} legendPosition
 * @property {{x:number,y:number,w:number,h:number}|null} legendRect
 * @property {number} legendColumns
 * @property {number} legendFontSizePx
 * @property {LegendSpacing} legendSpacing
 * @property {string[]} hiddenCategoryIds
 * @property {string[]} hiddenElementIds
 * @property {boolean} showTags
 * @property {ExportBasemap} basemap
 * @property {LocatorCount} locatorCount
 * @property {string|null} stateCode
 * @property {string|null} municipalityCode
 * @property {string} stateColor
 * @property {string} municipalityColor
 * @property {boolean} showStateInLegend
 * @property {boolean} showMunicipalityInLegend
 * @property {boolean} showMunicipalMesh
 * @property {'A4'|'A3'|'Letter'} paperSize
 * @property {'landscape'|'portrait'} orientation
 * @property {number} dpi
 */

const LEGEND_POSITIONS = new Set(['inside', 'beside', 'below']);
const LEGEND_SPACINGS = new Set(['compact', 'normal', 'wide']);
const BASEMAPS = new Set(['carto', 'osm', 'satellite', 'offline']);
const PAPER_SIZES = new Set(['A4', 'A3', 'Letter']);
const ORIENTATIONS = new Set(['landscape', 'portrait']);
const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/;

/**
 * @returns {ExportSettings}
 */
export function defaultExportSettings() {
  return {
    title: '',
    author: '',
    technicalResponsible: '',
    legendPosition: 'inside',
    legendRect: null,
    legendColumns: 2,
    legendFontSizePx: 12,
    legendSpacing: 'normal',
    hiddenCategoryIds: [],
    hiddenElementIds: [],
    showTags: false,
    basemap: 'carto',
    locatorCount: 0,
    stateCode: null,
    municipalityCode: null,
    stateColor: '#1D4ED8',
    municipalityColor: '#DC2626',
    showStateInLegend: false,
    showMunicipalityInLegend: false,
    showMunicipalMesh: false,
    paperSize: 'A4',
    orientation: 'landscape',
    dpi: 300,
  };
}

function clampInt(value, min, max, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

/**
 * @param {unknown} raw
 * @param {string} fallback
 * @returns {string}
 */
function normalizeHexColor(raw, fallback) {
  if (typeof raw === 'string' && HEX_COLOR.test(raw.trim())) {
    return raw.trim();
  }
  return fallback;
}

function asBool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string');
}

function normalizeLegendRect(raw, legendPosition) {
  if (legendPosition !== 'inside') return null;
  if (!raw || typeof raw !== 'object') return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const w = Number(raw.w);
  const h = Number(raw.h);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    w: Math.min(1, Math.max(0, w)),
    h: Math.min(1, Math.max(0, h)),
  };
}

function normalizeLegendPosition(raw) {
  if (raw === 'right') return 'beside';
  return LEGEND_POSITIONS.has(raw) ? raw : 'inside';
}

function normalizeLocatorCount(raw) {
  const n = Number(raw);
  if (n === 1 || n === 2) return /** @type {LocatorCount} */ (n);
  return 0;
}

/**
 * @param {unknown} raw
 * @returns {ExportSettings}
 */
export function normalizeExportSettings(raw) {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaultExportSettings();
  }

  const defaults = defaultExportSettings();
  /** @type {Record<string, unknown>} */
  const input = raw;
  const legendPosition = normalizeLegendPosition(input.legendPosition);

  return {
    title: sanitizeExportText(asString(input.title, defaults.title)),
    author: sanitizeExportText(asString(input.author, defaults.author)),
    technicalResponsible: sanitizeExportText(asString(input.technicalResponsible, defaults.technicalResponsible)),
    legendPosition,
    legendRect: normalizeLegendRect(input.legendRect, legendPosition),
    legendColumns: clampInt(input.legendColumns, 1, 6, defaults.legendColumns),
    legendFontSizePx: clampInt(input.legendFontSizePx, 8, 18, defaults.legendFontSizePx),
    legendSpacing: LEGEND_SPACINGS.has(input.legendSpacing) ? input.legendSpacing : defaults.legendSpacing,
    hiddenCategoryIds: asStringArray(input.hiddenCategoryIds),
    hiddenElementIds: asStringArray(input.hiddenElementIds),
    showTags: asBool(input.showTags, defaults.showTags),
    basemap: BASEMAPS.has(input.basemap) ? input.basemap : defaults.basemap,
    locatorCount: normalizeLocatorCount(input.locatorCount),
    stateCode: typeof input.stateCode === 'string' && input.stateCode.trim() !== '' ? input.stateCode : null,
    municipalityCode:
      typeof input.municipalityCode === 'string' && input.municipalityCode.trim() !== ''
        ? input.municipalityCode
        : null,
    stateColor: normalizeHexColor(asString(input.stateColor, defaults.stateColor), defaults.stateColor),
    municipalityColor: normalizeHexColor(
      asString(input.municipalityColor, defaults.municipalityColor),
      defaults.municipalityColor
    ),
    showStateInLegend: asBool(input.showStateInLegend, defaults.showStateInLegend),
    showMunicipalityInLegend: asBool(input.showMunicipalityInLegend, defaults.showMunicipalityInLegend),
    showMunicipalMesh: asBool(input.showMunicipalMesh, defaults.showMunicipalMesh),
    paperSize: PAPER_SIZES.has(input.paperSize) ? input.paperSize : defaults.paperSize,
    orientation: ORIENTATIONS.has(input.orientation) ? input.orientation : defaults.orientation,
    dpi: clampInt(input.dpi, 72, 600, defaults.dpi),
  };
}

/**
 * @param {ExportSettings|Record<string, unknown>} a
 * @param {ExportSettings|Record<string, unknown>} b
 * @returns {boolean}
 */
export function exportSettingsEqual(a, b) {
  return JSON.stringify(normalizeExportSettings(a)) === JSON.stringify(normalizeExportSettings(b));
}

/**
 * @param {ExportSettings} settings
 * @param {Array<{ id?: string, element_category?: string, category?: string }>} elements
 * @returns {ExportSettings}
 */
export function pruneExportSettings(settings, elements = []) {
  const normalized = normalizeExportSettings(settings);
  const categoryIds = new Set(
    elements.map((el) => el.element_category ?? el.category).filter((c) => typeof c === 'string')
  );
  const elementIds = new Set(elements.map((el) => el.id).filter((id) => typeof id === 'string'));

  return {
    ...normalized,
    hiddenCategoryIds: normalized.hiddenCategoryIds.filter((id) => categoryIds.has(id)),
    hiddenElementIds: normalized.hiddenElementIds.filter((id) => elementIds.has(id)),
  };
}

/**
 * @param {Array<{ id?: string, element_category?: string, category?: string }>} elements
 * @param {ExportSettings} settings
 * @returns {Array<Record<string, unknown>>}
 */
export function effectiveVisibleElements(elements, settings) {
  const normalized = normalizeExportSettings(settings);
  const hiddenCategories = new Set(normalized.hiddenCategoryIds);
  const hiddenElements = new Set(normalized.hiddenElementIds);

  return (elements ?? []).filter((element) => {
    const category = element.element_category ?? element.category;
    if (typeof category === 'string' && hiddenCategories.has(category)) {
      return false;
    }
    if (typeof element.id === 'string' && hiddenElements.has(element.id)) {
      return false;
    }
    return true;
  });
}

function isBlank(value) {
  return sanitizeExportText(value) === '';
}

/**
 * @param {ExportSettings} settings
 * @param {Array<Record<string, unknown>>} visibleElements
 * @param {Array<Record<string, unknown>>} legendItems
 * @returns {{ ok: boolean, errors: Array<{ field: string }> }}
 */
export function validateExportGates(settings, visibleElements = [], legendItems = []) {
  const normalized = normalizeExportSettings(settings);
  /** @type {Array<{ field: string }>} */
  const errors = [];

  if (isBlank(normalized.title)) {
    errors.push({ field: 'title' });
  }
  if (isBlank(normalized.author)) {
    errors.push({ field: 'author' });
  }

  if (normalized.locatorCount >= 1 && !normalized.stateCode) {
    errors.push({ field: 'stateCode' });
  }
  if (normalized.locatorCount >= 1 && !normalized.municipalityCode) {
    errors.push({ field: 'municipalityCode' });
  }

  const hasVisibleElements = (visibleElements ?? []).length > 0;
  const hasLegendItems = (legendItems ?? []).length > 0;
  if (!hasVisibleElements && !hasLegendItems) {
    errors.push({ field: 'content' });
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {{
 *   persist: (settings: ExportSettings) => Promise<unknown>,
 *   delayMs?: number,
 *   onPersistError?: (error: unknown) => void,
 *   retryDelayMs?: number,
 * }} options
 */
export function createDebouncedExportSettingsPersist({
  persist,
  delayMs = 400,
  onPersistError,
  retryDelayMs = 2000,
}) {
  /** @type {ExportSettings|null} */
  let memorySettings = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let retryTimer = null;
  let lastPersistFailed = false;

  function clearRetryTimer() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function notifyPersistError(error) {
    lastPersistFailed = true;
    if (onPersistError) {
      onPersistError(error);
    } else {
      console.error('[exportSettings] persist failed');
    }
  }

  function scheduleRetry() {
    if (!retryDelayMs || retryDelayMs <= 0 || !memorySettings) return;
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      runPersist().catch(() => {});
    }, retryDelayMs);
  }

  async function runPersist() {
    if (!memorySettings) return;
    try {
      await persist(memorySettings);
      lastPersistFailed = false;
      clearRetryTimer();
    } catch (error) {
      notifyPersistError(error);
      scheduleRetry();
      throw error;
    }
  }

  function setSettings(settings) {
    memorySettings = normalizeExportSettings(settings);
    clearRetryTimer();
    schedule();
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      runPersist().catch(() => {});
    }, delayMs);
  }

  async function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    clearRetryTimer();
    await runPersist();
  }

  function getMemorySettings() {
    return memorySettings;
  }

  function hasPersistFailure() {
    return lastPersistFailed;
  }

  return { setSettings, schedule, flush, getMemorySettings, hasPersistFailure };
}
