import { isOnline } from '@/lib/offline/connectivity';
import { MAX_ICON_BYTES } from './constants';
import {
  canvasHasDrawableContent,
  prepareIconExport,
  normalizeIconName,
  IconExportError,
} from './iconExport';

/**
 * @param {{
 *   canvas?: { getObjects?: () => unknown[]; toBlob?: (options?: object) => Promise<Blob | null>; exportPngBlob?: () => Promise<Blob> };
 *   blob?: Blob;
 *   name?: string;
 *   createIcon: (file: File, options: { name: string }) => Promise<{ url: string }>;
 *   applyCustomIconUrl: (url: string) => void;
 *   isOnlineCheck?: () => boolean;
 * }} params
 */
export async function confirmIconEditorSave({
  canvas,
  blob: preExportedBlob,
  name,
  createIcon,
  applyCustomIconUrl,
  isOnlineCheck = isOnline,
}) {
  if (!isOnlineCheck()) {
    return {
      ok: false,
      code: 'offline',
      message: 'A biblioteca de ícones requer conexão com a internet.',
    };
  }

  let blob = preExportedBlob;

  if (!blob) {
    if (!canvasHasDrawableContent(canvas)) {
      return {
        ok: false,
        code: 'empty',
        message: 'Desenhe algo no canvas antes de confirmar.',
      };
    }

    try {
      const exportResult = await prepareIconExport(canvas);
      blob = exportResult.blob;
    } catch (err) {
      if (err instanceof IconExportError) {
        if (err.code === 'payload_too_large') {
          return { ok: false, code: 'oversize', message: err.message };
        }
        return { ok: false, code: 'empty', message: err.message };
      }
      throw err;
    }
  } else if (!blob.size) {
    return {
      ok: false,
      code: 'empty',
      message: 'Desenhe algo no canvas antes de confirmar.',
    };
  } else if (blob.size > MAX_ICON_BYTES) {
    return {
      ok: false,
      code: 'oversize',
      message: 'Ícone muito grande. Reduza o desenho ou use menos detalhes.',
    };
  }

  try {
    const normalizedName = normalizeIconName(name);
    if (!normalizedName) {
      return {
        ok: false,
        code: 'name',
        message: 'Dê um nome ao ícone.',
      };
    }
    const file = new File([blob], 'icon.png', { type: 'image/png' });
    const icon = await createIcon(file, { name: normalizedName });
    applyCustomIconUrl(icon.url);
    return { ok: true, icon };
  } catch (err) {
    if (err instanceof IconExportError) {
      if (err.code === 'payload_too_large') {
        return { ok: false, code: 'oversize', message: err.message };
      }
      return { ok: false, code: 'empty', message: err.message };
    }

    const code = err?.code ?? err?.status;
    if (code === 'unauthorized' || code === 401) {
      return {
        ok: false,
        code: 'auth',
        message: err?.message || 'Sessão expirada. Faça login novamente.',
      };
    }

    return {
      ok: false,
      code: 'network',
      message: err?.message || 'Não foi possível salvar o ícone.',
    };
  }
}
