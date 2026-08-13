import { describe, expect, it, vi } from 'vitest';
import { confirmIconEditorSave } from '@/lib/icons/iconEditorConfirm';
import { MAX_ICON_BYTES } from '@/lib/icons/constants';

function canvasWithBlob(blobSize = 512) {
  return {
    getObjects: () => [{ stroke: '#000000', strokeWidth: 2, opacity: 1 }],
    exportPngBlob: async () => new Blob([new Uint8Array(blobSize)], { type: 'image/png' }),
  };
}

describe('confirmIconEditorSave', () => {
  it('UT-031: 401 from create maps to auth error without applying URL', async () => {
    const applyCustomIconUrl = vi.fn();
    const createIcon = vi.fn().mockRejectedValue({
      code: 'unauthorized',
      status: 401,
      message: 'Sessão expirada',
    });

    const result = await confirmIconEditorSave({
      canvas: canvasWithBlob(),
      name: 'Farol',
      createIcon,
      applyCustomIconUrl,
      isOnlineCheck: () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('auth');
    expect(applyCustomIconUrl).not.toHaveBeenCalled();
  });

  it('UT-033: network reject leaves style unchanged and does not append library', async () => {
    const applyCustomIconUrl = vi.fn();
    const createIcon = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await confirmIconEditorSave({
      canvas: canvasWithBlob(),
      name: 'Farol',
      createIcon,
      applyCustomIconUrl,
      isOnlineCheck: () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('network');
    expect(applyCustomIconUrl).not.toHaveBeenCalled();
  });

  it('UT-034: offline confirm returns offline error without calling create', async () => {
    const createIcon = vi.fn();
    const applyCustomIconUrl = vi.fn();

    const result = await confirmIconEditorSave({
      canvas: canvasWithBlob(),
      name: 'Farol',
      createIcon,
      applyCustomIconUrl,
      isOnlineCheck: () => false,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('offline');
    expect(createIcon).not.toHaveBeenCalled();
    expect(applyCustomIconUrl).not.toHaveBeenCalled();
  });

  it('rejects blank name without calling create', async () => {
    const createIcon = vi.fn();
    const applyCustomIconUrl = vi.fn();

    const result = await confirmIconEditorSave({
      canvas: canvasWithBlob(),
      name: '   ',
      createIcon,
      applyCustomIconUrl,
      isOnlineCheck: () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('name');
    expect(createIcon).not.toHaveBeenCalled();
    expect(applyCustomIconUrl).not.toHaveBeenCalled();
  });

  it('happy path applies custom_icon_url on success', async () => {
    const applyCustomIconUrl = vi.fn();
    const createIcon = vi.fn().mockResolvedValue({
      id: 'new-icon',
      url: '/php/icons/get.php?id=new-icon',
    });

    const result = await confirmIconEditorSave({
      canvas: canvasWithBlob(),
      name: 'Farol',
      createIcon,
      applyCustomIconUrl,
      isOnlineCheck: () => true,
    });

    expect(result.ok).toBe(true);
    expect(applyCustomIconUrl).toHaveBeenCalledWith('/php/icons/get.php?id=new-icon');
  });

  it('rejects oversize pre-exported blob without calling create', async () => {
    const createIcon = vi.fn();
    const applyCustomIconUrl = vi.fn();

    const result = await confirmIconEditorSave({
      blob: new Blob([new Uint8Array(MAX_ICON_BYTES + 1)], { type: 'image/png' }),
      name: 'Farol',
      createIcon,
      applyCustomIconUrl,
      isOnlineCheck: () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('oversize');
    expect(createIcon).not.toHaveBeenCalled();
  });

  it('rejects oversize export without calling create', async () => {
    const createIcon = vi.fn();
    const applyCustomIconUrl = vi.fn();

    const result = await confirmIconEditorSave({
      canvas: canvasWithBlob(MAX_ICON_BYTES + 1),
      name: 'Farol',
      createIcon,
      applyCustomIconUrl,
      isOnlineCheck: () => true,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('oversize');
    expect(createIcon).not.toHaveBeenCalled();
  });
});
