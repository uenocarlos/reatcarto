import { validateExportGates, effectiveVisibleElements, normalizeExportSettings } from './exportSettings';
import { exportCompositionPng, ExportCaptureError } from './pngExporter';
import { buildLegendItems } from './legendLayout';
import { mergeLegendItems } from './locationPreview';
import { EXPORT_FORMATS } from './exportGates';

/**
 * @typedef {Object} ExportAttemptContext
 * @property {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @property {HTMLElement|null|undefined} previewEl
 * @property {Array<Record<string, unknown>>} [elements]
 * @property {{ stateName?: string, municipalityName?: string }} [locationLabels]
 * @property {boolean} [canExport]
 * @property {string} [fileBaseName]
 */

/**
 * Stateful export orchestration: gates, concurrency guard, frozen config, abort.
 * @param {{
 *   exportPng?: typeof exportCompositionPng,
 *   validateGates?: typeof validateExportGates,
 * }} [options]
 */
export function createExportController(options = {}) {
  const exportPngFn = options.exportPng ?? exportCompositionPng;
  const validateGatesFn = options.validateGates ?? validateExportGates;

  let isExporting = false;
  /** @type {AbortController|null} */
  let abortController = null;
  /** @type {import('./exportSettings').ExportSettings|null} */
  let frozenSettings = null;

  /**
   * @param {ExportAttemptContext} ctx
   * @returns {Promise<{
   *   status: 'success'|'blocked'|'rejected'|'aborted'|'cancelled'|'error',
   *   gateErrors?: Array<{ field: string }>,
   *   delivery?: { delivered: boolean, method?: string },
   *   error?: ExportCaptureError|Error,
   *   frozenSettings?: import('./exportSettings').ExportSettings,
   * }>}
   */
  async function attemptExport(ctx) {
    if (isExporting) {
      return { status: 'rejected' };
    }

    if (ctx.canExport === false) {
      return { status: 'error', error: new ExportCaptureError('Permissão negada', { code: 'forbidden' }) };
    }

    const elements = ctx.elements ?? [];
    const normalized = normalizeExportSettings(ctx.settings);
    const visible = effectiveVisibleElements(elements, normalized);
    const elementLegendItems = buildLegendItems(visible, normalized);
    const legendItems = mergeLegendItems(elementLegendItems, normalized, ctx.locationLabels ?? {});
    const gateResult = validateGatesFn(normalized, visible, legendItems);

    if (!gateResult.ok) {
      return { status: 'blocked', gateErrors: gateResult.errors };
    }

    isExporting = true;
    frozenSettings = { ...normalized };
    abortController = new AbortController();

    try {
      const result = await exportPngFn({
        previewEl: ctx.previewEl,
        settings: frozenSettings,
        fileBaseName: ctx.fileBaseName ?? frozenSettings.title,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) {
        return { status: 'aborted', frozenSettings };
      }

      if (result.cancelled || !result.delivered) {
        return { status: 'cancelled', delivery: result, frozenSettings };
      }

      return { status: 'success', delivery: result, frozenSettings };
    } catch (err) {
      if (abortController?.signal.aborted) {
        return { status: 'aborted', frozenSettings };
      }
      return { status: 'error', error: err instanceof Error ? err : new Error(String(err)), frozenSettings };
    } finally {
      isExporting = false;
      abortController = null;
      frozenSettings = null;
    }
  }

  function abortExport() {
    abortController?.abort();
  }

  function getIsExporting() {
    return isExporting;
  }

  /** @returns {import('./exportSettings').ExportSettings|null} */
  function getFrozenSettings() {
    return frozenSettings ? { ...frozenSettings } : null;
  }

  return {
    attemptExport,
    abortExport,
    getIsExporting,
    getFrozenSettings,
    getFormatOptions: () => [...EXPORT_FORMATS],
  };
}
