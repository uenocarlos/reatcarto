/**
 * Sanitize user-entered export metadata for safe plain-text rendering.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeExportText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

/**
 * @param {{ title?: string }} settings
 * @returns {string|null}
 */
export function buildHeaderTitle(settings) {
  const title = sanitizeExportText(settings?.title);
  return title.length > 0 ? title : null;
}

/**
 * @param {{ author?: string, technicalResponsible?: string }} settings
 * @returns {{ authorLine: string|null, responsibleLine: string|null }}
 */
export function buildFooterMetadata(settings) {
  const author = sanitizeExportText(settings?.author);
  const responsible = sanitizeExportText(settings?.technicalResponsible);
  return {
    authorLine: author.length > 0 ? author : null,
    responsibleLine: responsible.length > 0 ? responsible : null,
  };
}

const FOOTER_LOGO_MAX_WIDTH_PX = 48;
const FOOTER_TEXT_MAX_WIDTH_RATIO = 0.7;

/**
 * Layout helper for institutional footer — keeps text within paper bounds.
 * @param {{ authorText?: string, paperWidthPx?: number, logoWidthPx?: number }} options
 * @returns {{ textMaxWidthPx: number, logoWidthPx: number, ok: boolean }}
 */
export function computeFooterLayout({ authorText = '', paperWidthPx = 800, logoWidthPx = FOOTER_LOGO_MAX_WIDTH_PX } = {}) {
  const safePaper = Math.max(200, Number(paperWidthPx) || 800);
  const safeLogo = Math.min(FOOTER_LOGO_MAX_WIDTH_PX, Math.max(24, Number(logoWidthPx) || FOOTER_LOGO_MAX_WIDTH_PX));
  const textMaxWidthPx = Math.floor(safePaper * FOOTER_TEXT_MAX_WIDTH_RATIO);
  const authorLen = typeof authorText === 'string' ? authorText.length : 0;
  const ok = authorLen <= 500 && textMaxWidthPx + safeLogo <= safePaper;
  return { textMaxWidthPx, logoWidthPx: safeLogo, ok };
}

/**
 * Wrap long titles within paper width without throwing.
 * @param {string} title
 * @param {number} maxCharsPerLine
 * @returns {string[]}
 */
export function wrapTitleLines(title, maxCharsPerLine = 60) {
  const text = sanitizeExportText(title);
  if (!text) return [];
  const lines = [];
  for (let i = 0; i < text.length; i += maxCharsPerLine) {
    lines.push(text.slice(i, i + maxCharsPerLine));
  }
  return lines;
}
