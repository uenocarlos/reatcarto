import { clampLegendRect } from './legendLayout';
import { normalizeExportSettings } from './exportSettings';

/** Paper dimensions in millimeters (width × height in portrait). */
export const PAPER_MM = Object.freeze({
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
  Letter: { w: 215.9, h: 279.4 },
});

const DEFAULT_DPI = 96;

/**
 * @param {'A4'|'A3'|'Letter'|string} paperSize
 * @param {'landscape'|'portrait'|string} orientation
 * @returns {number}
 */
export function getPaperAspectRatio(paperSize, orientation) {
  const normalized = normalizeExportSettings({ paperSize, orientation });
  const dims = PAPER_MM[normalized.paperSize] ?? PAPER_MM.A4;
  const portraitRatio = dims.w / dims.h;
  return normalized.orientation === 'landscape' ? dims.h / dims.w : portraitRatio;
}

/**
 * html2canvas scale factor from export DPI.
 * @param {number} dpi
 * @returns {number}
 */
export function getCaptureScaleFactor(dpi) {
  const normalized = normalizeExportSettings({ dpi });
  return normalized.dpi / DEFAULT_DPI;
}

/**
 * @param {{ paperSize?: string, orientation?: string, dpi?: number, baseWidthPx?: number }} params
 */
export function computePaperFrameDimensions(params = {}) {
  const normalized = normalizeExportSettings(params);
  const aspect = getPaperAspectRatio(normalized.paperSize, normalized.orientation);
  const baseWidthPx = Math.max(200, params.baseWidthPx ?? 640);
  const widthPx = baseWidthPx;
  const heightPx = Math.round(widthPx / aspect);
  return {
    widthPx,
    heightPx,
    aspect,
    captureScale: getCaptureScaleFactor(normalized.dpi),
    paperSize: normalized.paperSize,
    orientation: normalized.orientation,
    dpi: normalized.dpi,
  };
}

/**
 * Reclamp inside legend rect when orientation/paper frame changes.
 * @param {{ x: number, y: number, w: number, h: number }|null} legendRect
 * @param {'landscape'|'portrait'} orientation
 */
export function reclampLegendRectForOrientation(legendRect, orientation) {
  if (!legendRect) return null;
  const normalizedOrientation = normalizeExportSettings({ orientation }).orientation;
  const rect = clampLegendRect(legendRect);
  if (normalizedOrientation === 'portrait' && rect.x + rect.w > 1) {
    return clampLegendRect({ ...rect, x: Math.max(0, 1 - rect.w) });
  }
  if (normalizedOrientation === 'landscape' && rect.y + rect.h > 1) {
    return clampLegendRect({ ...rect, y: Math.max(0, 1 - rect.h) });
  }
  return rect;
}
