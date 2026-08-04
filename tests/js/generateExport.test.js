import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  generateExport,
  ExportGenerationError,
  waitForTilesReady,
  mapCaptureError,
  shouldIncludeInExport,
} from '@/lib/export/generateExport';

function makeCompositionEl(tilesReady = true) {
  return {
    dataset: { tilesReady: tilesReady ? 'true' : 'false' },
  };
}

describe('generateExport', () => {
  it('excludes preview-only warnings from the final capture', () => {
    const warning = document.createElement('div');
    warning.setAttribute('data-export-exclude', 'true');

    expect(shouldIncludeInExport(warning)).toBe(false);
    expect(shouldIncludeInExport(document.createElement('div'))).toBe(true);
  });

  it('UT-040: tiles timeout throws code tiles', async () => {
    const compositionEl = makeCompositionEl(false);
    await expect(
      generateExport(
        {
          compositionEl,
          format: 'png',
          dpi: 150,
          paper: 'a4',
          orientation: 'landscape',
          fileTitle: 'Mapa',
        },
        {
          toPng: vi.fn(),
          tileTimeoutMs: 100,
          tileProbe: () => false,
          waitForTiles: (el, opts) =>
            waitForTilesReady(el, { ...opts, timeoutMs: 100, probe: () => false }),
        }
      )
    ).rejects.toMatchObject({ code: 'tiles' });
  });

  it('UT-041: memory-like capture error mapped', () => {
    expect(mapCaptureError(new Error('Out of memory'))).toBe('memory');
    expect(mapCaptureError(new Error('canvas allocation failed'))).toBe('memory');
    expect(mapCaptureError(new Error('generic'))).toBe('capture');
  });

  it('UT-042: png path calls toPng once and download once', async () => {
    const toPng = vi.fn().mockResolvedValue('data:image/png;base64,AAAA');
    const downloadBlob = vi.fn();
    const compositionEl = makeCompositionEl(true);

    const result = await generateExport(
      {
        compositionEl,
        format: 'png',
        dpi: 300,
        paper: 'a4',
        orientation: 'landscape',
        fileTitle: 'Meu Mapa',
      },
      {
        toPng,
        downloadBlob,
        waitForTiles: async () => {},
        dataUrlToBlob: async () => new Blob(['x'], { type: 'image/png' }),
      }
    );

    expect(toPng).toHaveBeenCalledTimes(1);
    expect(toPng.mock.calls[0][1].filter).toBe(shouldIncludeInExport);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(result.mimeType).toBe('image/png');
    expect(result.fileName).toMatch(/\.png$/);
  });

  it('UT-043: pdf path constructs jsPDF and saves once', async () => {
    const savePdf = vi.fn();
    const addImage = vi.fn();
    const getWidth = vi.fn(() => 297);
    const getHeight = vi.fn(() => 210);

    class FakeJsPDF {
      constructor(opts) {
        this.opts = opts;
        this.internal = { pageSize: { getWidth, getHeight } };
      }
      addImage(...args) {
        addImage(...args);
      }
      save(name) {
        savePdf(this, name);
      }
    }

    const compositionEl = makeCompositionEl(true);
    const result = await generateExport(
      {
        compositionEl,
        format: 'pdf',
        dpi: 150,
        paper: 'a4',
        orientation: 'landscape',
        fileTitle: 'Relatório',
      },
      {
        toPng: vi.fn().mockResolvedValue('data:image/png;base64,BBBB'),
        jsPDF: FakeJsPDF,
        savePdf,
        waitForTiles: async () => {},
      }
    );

    expect(addImage).toHaveBeenCalled();
    expect(savePdf).toHaveBeenCalledTimes(1);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.fileName).toMatch(/\.pdf$/);
  });

  it('UT-044: abort mid-flight returns aborted without download', async () => {
    const controller = new AbortController();
    const downloadBlob = vi.fn();
    const toPng = vi.fn().mockImplementation(async () => {
      controller.abort();
      return 'data:image/png;base64,CCCC';
    });

    await expect(
      generateExport(
        {
          compositionEl: makeCompositionEl(true),
          format: 'png',
          dpi: 150,
          paper: 'a4',
          orientation: 'landscape',
          fileTitle: 'Mapa',
          signal: controller.signal,
        },
        {
          toPng,
          downloadBlob,
          waitForTiles: async () => {},
        }
      )
    ).rejects.toMatchObject({ code: 'aborted' });

    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
