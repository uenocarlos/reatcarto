import {
  ICON_ALPHA_THRESHOLD,
  ICON_CANVAS_SIZE,
  ICON_CONTENT_RATIO,
  MAX_ICON_BYTES,
} from './constants';

/**
 * @param {{ data: ArrayLike<number>; width: number; height: number }} imageData
 * @param {number} [alphaThreshold]
 * @returns {{ minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } | null}
 */
export function findOpaqueBounds(imageData, alphaThreshold = ICON_ALPHA_THRESHOLD) {
  const width = Number(imageData?.width) || 0;
  const height = Number(imageData?.height) || 0;
  const data = imageData?.data;
  if (!data || width < 1 || height < 1) return null;

  const threshold = Math.max(0, Number(alphaThreshold) || 0);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * @param {{ minX: number; minY: number; width: number; height: number }} bounds
 * @param {number} [canvasSize]
 * @param {number} [contentRatio]
 */
export function computeNormalizedDrawRect(
  bounds,
  canvasSize = ICON_CANVAS_SIZE,
  contentRatio = ICON_CONTENT_RATIO,
) {
  const size = Math.max(1, Math.round(Number(canvasSize) || ICON_CANVAS_SIZE));
  const ratio = Math.min(1, Math.max(0.1, Number(contentRatio) || ICON_CONTENT_RATIO));
  const target = Math.max(1, Math.round(size * ratio));
  const srcW = Math.max(1, Number(bounds?.width) || 1);
  const srcH = Math.max(1, Number(bounds?.height) || 1);
  const scale = Math.min(target / srcW, target / srcH);
  const dw = Math.max(1, Math.round(srcW * scale));
  const dh = Math.max(1, Math.round(srcH * scale));

  return {
    sx: Math.max(0, Math.round(Number(bounds?.minX) || 0)),
    sy: Math.max(0, Math.round(Number(bounds?.minY) || 0)),
    sw: srcW,
    sh: srcH,
    dx: Math.round((size - dw) / 2),
    dy: Math.round((size - dh) / 2),
    dw,
    dh,
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível gerar o PNG.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * @param {CanvasImageSource & { naturalWidth?: number; width?: number; naturalHeight?: number; height?: number }} source
 * @returns {Promise<Blob>}
 */
export async function normalizeSourceToStandardPng(source) {
  const srcW = Math.max(1, Math.round(source.naturalWidth || source.width || 0));
  const srcH = Math.max(1, Math.round(source.naturalHeight || source.height || 0));

  const work = document.createElement('canvas');
  work.width = srcW;
  work.height = srcH;
  const workCtx = work.getContext('2d', { willReadFrequently: true });
  if (!workCtx) {
    throw new Error('Não foi possível processar a imagem.');
  }
  workCtx.clearRect(0, 0, srcW, srcH);
  workCtx.drawImage(source, 0, 0, srcW, srcH);

  const bounds = findOpaqueBounds(workCtx.getImageData(0, 0, srcW, srcH));
  if (!bounds) {
    throw new Error('O canvas está vazio.');
  }

  const draw = computeNormalizedDrawRect(bounds);
  const out = document.createElement('canvas');
  out.width = ICON_CANVAS_SIZE;
  out.height = ICON_CANVAS_SIZE;
  const ctx = out.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível processar a imagem.');
  }
  ctx.clearRect(0, 0, ICON_CANVAS_SIZE, ICON_CANVAS_SIZE);
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) {
    ctx.imageSmoothingQuality = 'high';
  }
  ctx.drawImage(work, draw.sx, draw.sy, draw.sw, draw.sh, draw.dx, draw.dy, draw.dw, draw.dh);

  const blob = await canvasToPngBlob(out);
  if (blob.size > MAX_ICON_BYTES) {
    throw new Error(`O ícone excede o limite de ${Math.round(MAX_ICON_BYTES / 1024)}KB.`);
  }
  return blob;
}

/**
 * @param {Blob} blob
 * @returns {Promise<Blob>}
 */
export async function normalizeIconPngBlob(blob) {
  if (!blob) {
    throw new Error('Não foi possível exportar o ícone.');
  }

  const bitmap = await loadBlobAsImage(blob);
  try {
    return await normalizeSourceToStandardPng(bitmap);
  } finally {
    if (typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
}

/**
 * @param {Blob} blob
 * @returns {Promise<HTMLImageElement | ImageBitmap>}
 */
async function loadBlobAsImage(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // fall through to <img>
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
