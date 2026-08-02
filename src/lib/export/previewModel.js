import { normalizeExportSettings, effectiveVisibleElements, validateExportGates } from './exportSettings';
import { buildHeaderTitle, buildFooterMetadata } from './compositionMetadata';
import { getLegendLayoutMode, resolveLegendRect, computeCompositionLayout, buildLegendItems } from './legendLayout';
import { buildTagDescriptors } from './exportTags';
import { normalizeBasemapForPlatform, resolveBasemapTileUrl, evaluateBasemapReadiness } from './basemapResolver';
import { computePaperFrameDimensions } from './paperFrame';
import { buildInstitutionalFooterContent } from './institutionalFooter';
import {
  buildLocatorInsetDescriptors,
  buildLocationOverlayModel,
  mergeLegendItems,
  normalizeLocationSettings,
} from './locationPreview';

/**
 * @typedef {'idle'|'loading'|'ready'|'error'} PreviewStatus
 */

/**
 * @param {{
 *   settings: import('./exportSettings').ExportSettings|Record<string, unknown>,
 *   elements?: Array<Record<string, unknown>>,
 *   isNativePlatform?: boolean,
 *   boundaryLoading?: boolean,
 *   boundaryResult?: Record<string, unknown>|null,
 *   boundaryError?: boolean,
 *   locationLabels?: { stateName?: string, municipalityName?: string },
 *   basemapReadiness?: { requiredTiles?: Array<string|null>, partial?: boolean, error?: boolean },
 *   baseWidthPx?: number,
 *   mapZoom?: number,
 *   mapLat?: number,
 * }} params
 */
export function buildPreviewModel(params) {
  const settings = normalizeLocationSettings(params.settings);
  const elements = params.elements ?? [];
  const visibleElements = effectiveVisibleElements(elements, settings);
  const elementLegendItems = buildLegendItems(visibleElements, settings);
  const legendItems = mergeLegendItems(elementLegendItems, settings, params.locationLabels ?? {});
  const boundaryResult = params.boundaryResult ?? null;
  const locatorInsets = buildLocatorInsetDescriptors(settings, boundaryResult);
  const locationOverlay = buildLocationOverlayModel(settings, boundaryResult);
  const layout = computeCompositionLayout({
    legendPosition: settings.legendPosition,
    itemCount: legendItems.length,
    columns: settings.legendColumns,
    fontSizePx: settings.legendFontSizePx,
    spacing: settings.legendSpacing,
    mapWidth: params.baseWidthPx ?? 640,
    mapHeight: Math.round((params.baseWidthPx ?? 640) * 0.65),
  });
  const paper = computePaperFrameDimensions({
    paperSize: settings.paperSize,
    orientation: settings.orientation,
    dpi: settings.dpi,
    baseWidthPx: params.baseWidthPx,
  });
  const basemap = normalizeBasemapForPlatform(settings.basemap, Boolean(params.isNativePlatform));
  const tileUrl = resolveBasemapTileUrl(basemap);
  const basemapStatus = evaluateBasemapReadiness(basemap, params.basemapReadiness ?? {});

  let previewStatus = /** @type {PreviewStatus} */ ('ready');
  if (params.boundaryLoading) previewStatus = 'loading';
  else if (params.boundaryError || locationOverlay.meshError) previewStatus = 'error';
  else if (basemapStatus === 'error') previewStatus = 'error';
  else if (basemapStatus === 'unusable') previewStatus = 'error';
  else if (basemapStatus === 'loading') previewStatus = 'loading';

  const gateResult = validateExportGates(settings, visibleElements, legendItems);

  return {
    settings,
    headerTitle: buildHeaderTitle(settings),
    footerMetadata: buildFooterMetadata(settings),
    institutionalFooter: buildInstitutionalFooterContent(settings, {
      usedFallback: Boolean(boundaryResult?.usedFallback),
      boundaryError: Boolean(params.boundaryError),
    }),
    legendLayoutMode: getLegendLayoutMode(settings),
    legendRect: resolveLegendRect(settings),
    legendItems,
    legendGrid: {
      columns: settings.legendColumns,
      fontSizePx: settings.legendFontSizePx,
      spacing: settings.legendSpacing,
    },
    compositionLayout: layout,
    paperFrame: paper,
    visibleElements,
    tagDescriptors: buildTagDescriptors(elements, settings),
    basemap,
    tileUrl,
    basemapStatus,
    previewStatus,
    chrome: {
      graticule: true,
      dynamicScale: true,
      northArrow: true,
      footer: true,
    },
    exportDisabled: !gateResult.ok || Boolean(params.boundaryError) || locationOverlay.meshError,
    gateErrors: gateResult.errors,
    settingsHash: JSON.stringify(settings),
    locatorInsets,
    locationOverlay,
    boundarySource: boundaryResult?.source ?? null,
    boundaryUsedFallback: Boolean(boundaryResult?.usedFallback),
  };
}

/**
 * Coalesce rapid preview updates — last settings win (UT-132/133).
 * @param {(model: ReturnType<typeof buildPreviewModel>) => void} commit
 * @param {number} delayMs
 */
export function createCoalescedPreviewUpdater(commit, delayMs = 50) {
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;
  /** @type {ReturnType<typeof buildPreviewModel>|null} */
  let pending = null;
  let generation = 0;

  function schedule(params) {
    generation += 1;
    const currentGen = generation;
    pending = buildPreviewModel(params);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (currentGen === generation && pending) {
        commit(pending);
      }
    }, delayMs);
  }

  function flush(params) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    generation += 1;
    const model = buildPreviewModel(params);
    commit(model);
    return model;
  }

  function cancel() {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  }

  return { schedule, flush, cancel };
}
