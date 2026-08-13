import { MAX_ICON_BYTES } from '@/lib/icons/constants';
import { normalizeSourceToStandardPng } from '@/lib/icons/iconNormalize';

/**
 * @param {File} file
 * @returns {Promise<File>} PNG file ≤ MAX_ICON_BYTES, 256×256 optical frame
 */
export async function prepareIconPngFile(file) {
  if (!file || !file.size) {
    throw new Error('Selecione um arquivo de imagem.');
  }

  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/')) {
    throw new Error('O arquivo precisa ser uma imagem.');
  }

  const bitmap = await loadImageElement(file);
  try {
    const blob = await normalizeSourceToStandardPng(bitmap);
    if (blob.size > MAX_ICON_BYTES) {
      throw new Error('Ícone deve ter no máximo 200 KB.');
    }

    const baseName = String(file.name || 'icon').replace(/\.[^.]+$/, '') || 'icon';
    return new File([blob], `${baseName}.png`, { type: 'image/png' });
  } finally {
    if (typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }
}

/**
 * @param {string} fileName
 * @returns {string}
 */
export function iconNameFromFileName(fileName) {
  const base = String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .trim();
  return base;
}

/**
 * @param {File} file
 * @returns {Promise<HTMLImageElement | ImageBitmap>}
 */
async function loadImageElement(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img>
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
