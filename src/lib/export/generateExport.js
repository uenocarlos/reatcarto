import { assertExportTitle, buildExportFileName } from './session.js';

export class ExportGenerationError extends Error {
  /**
   * @param {string} message
   * @param {{ code: 'aborted'|'capture'|'memory'|'tiles'|'validation' }} options
   */
  constructor(message, options) {
    super(message);
    this.name = 'ExportGenerationError';
    this.code = options.code;
  }
}

const DEFAULT_TILE_TIMEOUT_MS = 15000;
const TILE_POLL_MS = 50;

/** Keep preview-only guidance out of the downloaded map. */
export function shouldIncludeInExport(node) {
  return node?.getAttribute?.('data-export-exclude') !== 'true';
}

/**
 * @param {HTMLElement} root
 * @param {{ timeoutMs?: number, signal?: AbortSignal, probe?: () => boolean }} options
 */
export async function waitForTilesReady(root, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TILE_TIMEOUT_MS;
  const probe = options.probe ?? (() => root?.dataset?.tilesReady === 'true');
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (options.signal?.aborted) {
      throw new ExportGenerationError('Export aborted', { code: 'aborted' });
    }
    if (probe()) return;
    await new Promise((resolve) => setTimeout(resolve, TILE_POLL_MS));
  }

  throw new ExportGenerationError('Basemap tiles not ready', { code: 'tiles' });
}

/**
 * Map capture library errors to stable generation codes (UT-041).
 * @param {unknown} error
 */
export function mapCaptureError(error) {
  const message = String(error?.message ?? error ?? '');
  const lower = message.toLowerCase();
  if (lower.includes('memory') || lower.includes('allocation') || lower.includes('size')) {
    return 'memory';
  }
  return 'capture';
}

/**
 * @param {Blob} blob
 * @param {string} fileName
 * @param {{ createObjectURL?: (b: Blob) => string, revokeObjectURL?: (u: string) => void, documentRef?: Document }} [deps]
 */
function triggerDownload(blob, fileName, deps = {}) {
  const doc = deps.documentRef ?? (typeof document !== 'undefined' ? document : null);
  const createObjectURL = deps.createObjectURL ?? URL.createObjectURL.bind(URL);
  const revokeObjectURL = deps.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
  if (!doc) return;

  const url = createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  revokeObjectURL(url);
}

function computeImagePlacement({ srcWidth, srcHeight, maxWidth, maxHeight }) {
  const safeWidth = Math.max(1, Number(srcWidth) || 1);
  const safeHeight = Math.max(1, Number(srcHeight) || 1);
  const scale = Math.min(maxWidth / safeWidth, maxHeight / safeHeight);
  const width = safeWidth * scale;
  const height = safeHeight * scale;
  return {
    width,
    height,
    x: (maxWidth - width) / 2,
    y: (maxHeight - height) / 2,
  };
}

/**
 * Client-side PNG/PDF export pipeline (ADR-008).
 * @param {{
 *   compositionEl: HTMLElement,
 *   mapFreezeEls?: HTMLElement[],
 *   format: 'png'|'pdf',
 *   dpi: number,
 *   paper: 'a4'|'a3'|'letter',
 *   orientation: 'landscape'|'portrait',
 *   fileTitle: string,
 *   signal?: AbortSignal,
 * }} options
 * @param {{
 *   toPng?: (el: HTMLElement, opts: Record<string, unknown>) => Promise<string>,
 *   jsPDF?: new (...args: unknown[]) => { addImage: Function, save: Function, output: Function },
 *   downloadBlob?: typeof triggerDownload,
 *   waitForTiles?: typeof waitForTilesReady,
 *   documentRef?: Document,
 * }} [deps]
 */
export async function generateExport(options, deps = {}) {
  const titleCheck = assertExportTitle(options.fileTitle);
  if (!titleCheck.ok) {
    throw new ExportGenerationError('Title is required', { code: 'validation' });
  }

  if (options.signal?.aborted) {
    throw new ExportGenerationError('Export aborted', { code: 'aborted' });
  }

  const waitForTiles = deps.waitForTiles ?? waitForTilesReady;
  await waitForTiles(options.compositionEl, {
    signal: options.signal,
    probe: deps.tileProbe,
    timeoutMs: deps.tileTimeoutMs,
  });

  if (options.signal?.aborted) {
    throw new ExportGenerationError('Export aborted', { code: 'aborted' });
  }

  const pixelRatio = options.dpi / 96;
  const toPng = deps.toPng;
  if (!toPng) {
    throw new ExportGenerationError('Capture dependency missing', { code: 'capture' });
  }

  let dataUrl;
  try {
    dataUrl = await toPng(options.compositionEl, {
      pixelRatio,
      cacheBust: true,
      skipFonts: false,
      filter: shouldIncludeInExport,
    });
  } catch (error) {
    const code = mapCaptureError(error);
    throw new ExportGenerationError('Capture failed', { code });
  }

  if (options.signal?.aborted) {
    throw new ExportGenerationError('Export aborted', { code: 'aborted' });
  }

  const fileName = buildExportFileName(titleCheck.title, options.format);
  const downloadBlob = deps.downloadBlob ?? triggerDownload;

  if (options.format === 'pdf') {
    const JsPDF = deps.jsPDF;
    if (!JsPDF) {
      throw new ExportGenerationError('PDF dependency missing', { code: 'capture' });
    }
    const doc = new JsPDF({
      orientation: options.orientation,
      unit: 'mm',
      format: options.paper,
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const domWidth = options.compositionEl?.offsetWidth || options.compositionEl?.clientWidth || 1;
    const domHeight = options.compositionEl?.offsetHeight || options.compositionEl?.clientHeight || 1;
    const imageProps = typeof doc.getImageProperties === 'function'
      ? doc.getImageProperties(dataUrl)
      : { width: domWidth, height: domHeight };
    const placement = computeImagePlacement({
      srcWidth: imageProps?.width || domWidth,
      srcHeight: imageProps?.height || domHeight,
      maxWidth: pageWidth,
      maxHeight: pageHeight,
    });
    doc.addImage(dataUrl, 'PNG', placement.x, placement.y, placement.width, placement.height);
    if (deps.savePdf) {
      deps.savePdf(doc, fileName);
    } else {
      doc.save(fileName);
    }
    return { fileName, mimeType: 'application/pdf' };
  }

  const blob = await (deps.dataUrlToBlob
    ? deps.dataUrlToBlob(dataUrl)
    : fetch(dataUrl).then((r) => r.blob()));

  downloadBlob(blob, fileName, deps);
  return { fileName, mimeType: 'image/png' };
}

export { triggerDownload };
