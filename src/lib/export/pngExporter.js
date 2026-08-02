import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { normalizeExportSettings } from './exportSettings';
import { getCaptureScaleFactor } from './paperFrame';

const DEFAULT_READINESS_TIMEOUT_MS = 15000;
const READINESS_POLL_MS = 100;
/** Consecutive ready polls required before capture (guards tileunload races). */
const READINESS_STABLE_POLLS = 3;

/** Maximum canvas pixel dimension before rejecting capture (OOM guard). */
export const MAX_CANVAS_DIMENSION = 16384;

/** Maximum length for the PNG base name (excluding `.png`). */
export const MAX_PNG_BASE_NAME_LENGTH = 200;

/**
 * Sanitize user-controlled text to a single safe PNG file name (one path segment).
 * @param {unknown} rawBase
 * @returns {string}
 */
export function sanitizePngFileName(rawBase) {
  let base = typeof rawBase === 'string' ? rawBase.trim() : '';
  if (!base) base = 'mapa';

  base = base.replace(/\0/g, '');

  const segments = base.split(/[/\\]+/).filter((seg) => seg && seg !== '.' && seg !== '..');
  base = segments.length > 0 ? segments[segments.length - 1] : 'mapa';

  base = base.replace(/[<>:"|?*]/g, '_').trim();
  if (!base) base = 'mapa';

  if (/\.png$/i.test(base)) {
    base = base.slice(0, -4).trim();
  }
  if (!base) base = 'mapa';

  if (base.length > MAX_PNG_BASE_NAME_LENGTH) {
    base = base.slice(0, MAX_PNG_BASE_NAME_LENGTH);
  }

  return `${base}.png`;
}

export class ExportCaptureError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'ExportCaptureError';
    this.code = options.code ?? 'capture_failed';
    if (options.cause) this.cause = options.cause;
  }
}

/**
 * Immediate readiness gate immediately before html2canvas.
 * @param {HTMLElement|null|undefined} previewEl
 */
export function assertPreviewReadyForCapture(previewEl) {
  if (!previewEl) {
    throw new ExportCaptureError('Elemento de preview indisponível', { code: 'missing_preview' });
  }

  const status = previewEl.getAttribute('data-preview-status');
  if (status === 'ready') return;
  if (status === 'error') {
    throw new ExportCaptureError('Preview indisponível para captura', { code: 'preview_not_ready' });
  }

  throw new ExportCaptureError('Preview indisponível para captura', { code: 'preview_not_ready' });
}

/**
 * Poll preview DOM until `data-preview-status="ready"` or timeout/error.
 * @param {HTMLElement|null|undefined} previewEl
 * @param {{ timeoutMs?: number, signal?: AbortSignal, pollMs?: number, stablePolls?: number }} [options]
 */
export async function waitForPreviewReadiness(previewEl, options = {}) {
  const {
    timeoutMs = DEFAULT_READINESS_TIMEOUT_MS,
    signal,
    pollMs = READINESS_POLL_MS,
    stablePolls = 1,
  } = options;

  if (!previewEl) {
    throw new ExportCaptureError('Elemento de preview indisponível', { code: 'missing_preview' });
  }

  const deadline = Date.now() + timeoutMs;
  let consecutiveReady = 0;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new ExportCaptureError('Exportação cancelada', { code: 'aborted' });
    }

    const status = previewEl.getAttribute('data-preview-status');
    if (status === 'ready') {
      consecutiveReady += 1;
      if (consecutiveReady >= stablePolls) return;
    } else {
      consecutiveReady = 0;
      if (status === 'error') {
        throw new ExportCaptureError('Preview indisponível para captura', { code: 'preview_not_ready' });
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new ExportCaptureError('Tempo esgotado aguardando o preview', { code: 'readiness_timeout' });
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function assertCanvasSizeSafe(canvas) {
  const { width, height } = canvas;
  if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION || width * height > MAX_CANVAS_DIMENSION ** 2) {
    throw new ExportCaptureError('Imagem muito grande para exportar. Reduza o DPI ou o tamanho do papel.', {
      code: 'canvas_too_large',
    });
  }
}

/**
 * @typedef {Object} PngExportDeps
 * @property {typeof html2canvas} [html2canvasFn]
 * @property {{ isNativePlatform: () => boolean }} [capacitor]
 * @property {typeof Share} [sharePlugin]
 * @property {typeof Filesystem} [filesystem]
 * @property {typeof document} [documentRef]
 */

/**
 * @param {HTMLElement} previewEl
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {PngExportDeps} deps
 */
async function capturePreviewCanvas(previewEl, settings, deps) {
  const normalized = normalizeExportSettings(settings);
  const scale = getCaptureScaleFactor(normalized.dpi);
  const html2canvasFn = deps.html2canvasFn ?? html2canvas;

  let canvas;
  try {
    canvas = await html2canvasFn(previewEl, {
      useCORS: true,
      scale,
      logging: false,
      backgroundColor: '#ffffff',
    });
  } catch (err) {
    const message =
      err instanceof Error && /memory|size|canvas|OOM/i.test(err.message)
        ? 'Imagem muito grande para exportar. Reduza o DPI ou o tamanho do papel.'
        : 'Falha ao capturar o preview do mapa';
    throw new ExportCaptureError(message, { code: 'capture_failed', cause: err });
  }

  assertCanvasSizeSafe(canvas);
  return canvas;
}

/**
 * @param {string} dataUrl
 * @param {string} fileName
 * @param {PngExportDeps} deps
 * @returns {Promise<{ delivered: boolean, cancelled?: boolean, method: 'web' }>}
 */
async function deliverWebPng(dataUrl, fileName, deps) {
  const doc = deps.documentRef ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) {
    throw new ExportCaptureError('Ambiente web indisponível para download', { code: 'web_unavailable' });
  }

  const link = doc.createElement('a');
  link.download = fileName;
  link.href = dataUrl;
  link.click();

  return { delivered: true, method: 'web' };
}

/**
 * @param {string} dataUrl
 * @param {string} fileName
 * @param {string} title
 * @param {PngExportDeps} deps
 * @returns {Promise<{ delivered: boolean, cancelled?: boolean, method: 'native' }>}
 */
async function deliverNativePng(dataUrl, fileName, title, deps) {
  const filesystem = deps.filesystem ?? Filesystem;
  const sharePlugin = deps.sharePlugin ?? Share;

  const base64Data = dataUrl.split(',')[1];
  const savedFile = await filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Cache,
  });

  try {
    await sharePlugin.share({
      title: title || 'Meu Mapa',
      text: 'Confira o mapa gerado pelo ReatCarto',
      url: savedFile.uri,
      dialogTitle: 'Compartilhar Mapa',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(message)) {
      return { delivered: false, cancelled: true, method: 'native' };
    }
    throw new ExportCaptureError('Falha ao compartilhar o mapa', { code: 'share_failed', cause: err });
  }

  return { delivered: true, method: 'native' };
}

/**
 * Capture composition preview and deliver PNG (web download or native share).
 *
 * @param {{
 *   previewEl: HTMLElement|null|undefined,
 *   settings: import('./exportSettings').ExportSettings|Record<string, unknown>,
 *   fileBaseName?: string,
 *   signal?: AbortSignal,
 *   deps?: PngExportDeps,
 *   skipReadinessWait?: boolean,
 * }} params
 * @returns {Promise<{ delivered: boolean, cancelled?: boolean, method: 'web'|'native', fileName: string }>}
 */
export async function exportCompositionPng({
  previewEl,
  settings,
  fileBaseName,
  signal,
  deps = {},
  skipReadinessWait = false,
}) {
  if (!previewEl) {
    throw new ExportCaptureError('Elemento de preview indisponível', { code: 'missing_preview' });
  }

  if (signal?.aborted) {
    throw new ExportCaptureError('Exportação cancelada', { code: 'aborted' });
  }

  if (!skipReadinessWait) {
    await waitForPreviewReadiness(previewEl, { signal, stablePolls: READINESS_STABLE_POLLS });
  }

  if (signal?.aborted) {
    throw new ExportCaptureError('Exportação cancelada', { code: 'aborted' });
  }

  assertPreviewReadyForCapture(previewEl);

  const normalized = normalizeExportSettings(settings);
  const canvas = await capturePreviewCanvas(previewEl, normalized, deps);

  if (signal?.aborted) {
    throw new ExportCaptureError('Exportação cancelada', { code: 'aborted' });
  }

  let dataUrl;
  try {
    dataUrl = canvas.toDataURL('image/png');
  } catch (err) {
    throw new ExportCaptureError('Falha ao gerar PNG', { code: 'encode_failed', cause: err });
  }

  const rawBase = (fileBaseName || normalized.title || 'mapa').trim() || 'mapa';
  const fileName = sanitizePngFileName(rawBase);

  const capacitor = deps.capacitor ?? Capacitor;
  const isNative = capacitor.isNativePlatform();

  const delivery = isNative
    ? await deliverNativePng(dataUrl, fileName, normalized.title, deps)
    : await deliverWebPng(dataUrl, fileName, deps);

  return { ...delivery, fileName };
}
