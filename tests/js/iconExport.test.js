import { describe, expect, it } from 'vitest';
import {
  canvasHasDrawableContent,
  exportIconPngBlob,
  isValidIconName,
  normalizeIconName,
  prepareIconExport,
  IconExportError,
} from '@/lib/icons/iconExport';
import { ICON_CANVAS_SIZE, MAX_ICON_BYTES } from '@/lib/icons/constants';

function canvasDouble({ objects = [], blobSize = 1024 } = {}) {
  return {
    getObjects: () => objects,
    exportPngBlob: async () => new Blob([new Uint8Array(blobSize)], { type: 'image/png' }),
    toBlob: async () => new Blob([new Uint8Array(blobSize)], { type: 'image/png' }),
  };
}

describe('iconExport', () => {
  it('UT-010: opaque stroke exports PNG blob within size limit', async () => {
    const canvas = canvasDouble({
      objects: [{ stroke: '#000000', strokeWidth: 4, opacity: 1 }],
      blobSize: 512,
    });

    const blob = await exportIconPngBlob(canvas);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeLessThanOrEqual(MAX_ICON_BYTES);
    expect(ICON_CANVAS_SIZE).toBe(256);
  });

  it('UT-011: prepareIconExport returns blob metadata', async () => {
    const canvas = canvasDouble({
      objects: [{ stroke: '#ff0000', strokeWidth: 2, opacity: 1 }],
      blobSize: 800,
    });

    const result = await prepareIconExport(canvas);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.byteSize).toBe(800);
  });

  it('UT-012: oversize PNG rejects with size-limit error', async () => {
    const canvas = canvasDouble({
      objects: [{ stroke: '#000000', strokeWidth: 4, opacity: 1 }],
      blobSize: MAX_ICON_BYTES + 1,
    });

    await expect(exportIconPngBlob(canvas)).rejects.toMatchObject({
      code: 'payload_too_large',
    });
  });

  it('UT-013: name Farol stays Farol', () => {
    expect(normalizeIconName('Farol')).toBe('Farol');
  });

  it('UT-014: empty canvas and zero-alpha objects block confirm guard', () => {
    expect(canvasHasDrawableContent(canvasDouble({ objects: [] }))).toBe(false);
    expect(
      canvasHasDrawableContent(
        canvasDouble({
          objects: [{ stroke: 'transparent', fill: 'transparent', strokeWidth: 0, opacity: 0 }],
        }),
      ),
    ).toBe(false);
  });

  it('UT-015: whitespace name is invalid and does not fall back', () => {
    expect(normalizeIconName('   ')).toBe('');
    expect(isValidIconName('   ')).toBe(false);
    expect(isValidIconName('Farol')).toBe(true);
  });

  it('UT-016: name length 101 truncates to 100 characters', () => {
    const longName = 'a'.repeat(101);
    expect(normalizeIconName(longName)).toHaveLength(100);
    expect(normalizeIconName(longName)).toBe('a'.repeat(100));
  });

  it('throws empty error when export returns null blob', async () => {
    const canvas = {
      getObjects: () => [{ stroke: '#000', strokeWidth: 2, opacity: 1 }],
      toBlob: async () => null,
    };

    await expect(exportIconPngBlob(canvas)).rejects.toBeInstanceOf(IconExportError);
  });
});
