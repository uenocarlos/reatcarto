import {
  ICON_CANVAS_SIZE,
  MAX_ICON_BYTES,
  MAX_ICON_NAME_LENGTH,
} from './constants';
import { normalizeIconPngBlob } from './iconNormalize';

export class IconExportError extends Error {
  /** @param {'empty' | 'payload_too_large'} code */
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'IconExportError';
  }
}

/** @param {unknown} name */
export function normalizeIconName(name) {
  const trimmed = String(name ?? '').trim();
  if (trimmed.length > MAX_ICON_NAME_LENGTH) {
    return trimmed.slice(0, MAX_ICON_NAME_LENGTH);
  }
  return trimmed;
}

/** @param {unknown} name */
export function isValidIconName(name) {
  return normalizeIconName(name).length > 0;
}

function colorHasVisibleAlpha(color, opacity = 1) {
  if (!color || color === 'transparent') return false;
  const alpha = Math.max(0, Math.min(1, opacity));
  if (alpha <= 0) return false;

  if (typeof color === 'string') {
    const rgba = color.match(/^rgba?\(([^)]+)\)$/i);
    if (rgba) {
      const parts = rgba[1].split(',').map((part) => part.trim());
      if (parts.length === 4) {
        return Number(parts[3]) > 0 && alpha > 0;
      }
      return alpha > 0;
    }
    if (color.startsWith('#') && color.length === 9) {
      const channelAlpha = parseInt(color.slice(7, 9), 16) / 255;
      return channelAlpha > 0 && alpha > 0;
    }
  }

  return alpha > 0;
}

/** @param {Record<string, unknown>} obj */
function objectHasVisibleInk(obj) {
  const stroke = obj.stroke ?? obj.get?.('stroke');
  const fill = obj.fill ?? obj.get?.('fill');
  const opacity = obj.opacity ?? obj.get?.('opacity') ?? 1;
  const strokeWidth = Number(obj.strokeWidth ?? obj.get?.('strokeWidth') ?? 0);

  if (strokeWidth > 0 && colorHasVisibleAlpha(stroke, opacity)) {
    return true;
  }
  return colorHasVisibleAlpha(fill, opacity);
}

/** @param {{ getObjects?: () => unknown[]; _objects?: unknown[] }} canvas */
export function canvasHasDrawableContent(canvas) {
  const objects = canvas.getObjects?.() ?? canvas._objects ?? [];
  if (!Array.isArray(objects) || objects.length === 0) return false;
  return objects.some((obj) => objectHasVisibleInk(/** @type {Record<string, unknown>} */ (obj)));
}

/**
 * @param {{ toBlob?: (options?: object) => Promise<Blob | null>; exportPngBlob?: () => Promise<Blob> }} canvas
 * @returns {Promise<Blob>}
 */
export async function exportIconPngBlob(canvas) {
  if (!canvasHasDrawableContent(canvas)) {
    throw new IconExportError('empty', 'O canvas está vazio.');
  }

  let blob;
  if (typeof canvas.exportPngBlob === 'function') {
    blob = await canvas.exportPngBlob();
  } else if (typeof canvas.toBlob === 'function') {
    blob = await canvas.toBlob({
      format: 'png',
      multiplier: 1,
      enableRetinaScaling: false,
      left: 0,
      top: 0,
      width: ICON_CANVAS_SIZE,
      height: ICON_CANVAS_SIZE,
    });
  } else {
    throw new IconExportError('empty', 'Canvas export is unavailable.');
  }

  if (!blob) {
    throw new IconExportError('empty', 'Não foi possível exportar o ícone.');
  }

  if (blob.size > MAX_ICON_BYTES) {
    throw new IconExportError(
      'payload_too_large',
      `O ícone excede o limite de ${Math.round(MAX_ICON_BYTES / 1024)}KB.`,
    );
  }

  if (blob.type && blob.type !== 'image/png') {
    throw new IconExportError('empty', 'A exportação deve ser PNG.');
  }

  return blob;
}

/**
 * @param {{ toBlob?: (options?: object) => Promise<Blob | null>; exportPngBlob?: () => Promise<Blob> }} canvas
 * @returns {Promise<{ blob: Blob; byteSize: number }>}
 */
export async function prepareIconExport(canvas) {
  const blob = await exportIconPngBlob(canvas);
  return { blob, byteSize: blob.size };
}

/**
 * Export then fit content into the standard 256×256 optical frame.
 * @param {{ toBlob?: (options?: object) => Promise<Blob | null>; exportPngBlob?: () => Promise<Blob> }} canvas
 * @returns {Promise<{ blob: Blob; byteSize: number }>}
 */
export async function prepareNormalizedIconExport(canvas) {
  const raw = await exportIconPngBlob(canvas);
  let blob;
  try {
    blob = await normalizeIconPngBlob(raw);
  } catch (err) {
    const message = err?.message || 'Não foi possível exportar o ícone.';
    if (/excede o limite|200 KB/i.test(message)) {
      throw new IconExportError('payload_too_large', message);
    }
    throw new IconExportError('empty', message);
  }

  if (blob.size > MAX_ICON_BYTES) {
    throw new IconExportError(
      'payload_too_large',
      `O ícone excede o limite de ${Math.round(MAX_ICON_BYTES / 1024)}KB.`,
    );
  }

  return { blob, byteSize: blob.size };
}
