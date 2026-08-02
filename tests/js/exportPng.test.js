import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  exportCompositionPng,
  ExportCaptureError,
  waitForPreviewReadiness,
  assertPreviewReadyForCapture,
  assertCanvasSizeSafe,
  sanitizePngFileName,
  MAX_CANVAS_DIMENSION,
  MAX_PNG_BASE_NAME_LENGTH,
} from '@/lib/export/pngExporter';
import { createExportController } from '@/lib/export/exportController';
import { EXPORT_FORMATS } from '@/lib/export/exportGates';
import { validateExportGates } from '@/lib/export/exportSettings';

const ROOT = resolve(process.cwd());

function readSrc(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

const validSettings = {
  title: 'Meu Mapa',
  author: 'Autor',
  dpi: 300,
  locatorCount: 0,
};

const sampleElement = {
  id: 'el-1',
  element_category: 'terra',
  element_type: 'point',
  geojson: JSON.stringify({ type: 'Point', coordinates: [-52.1, -32.035] }),
  style: JSON.stringify({ icon_color: '#F97316' }),
};

function makePreviewEl(status = 'ready') {
  return {
    getAttribute: vi.fn((name) => (name === 'data-preview-status' ? status : null)),
    setAttribute: vi.fn(),
  };
}

function makeMockCanvas(width = 800, height = 600) {
  return {
    width,
    height,
    toDataURL: vi.fn(() => 'data:image/png;base64,AAAA'),
  };
}

describe('pngExporter — unit (UT-146–UT-156)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('UT-146: gates pass — exportCompositionPng called with preview element', async () => {
    const previewEl = makePreviewEl('ready');
    const html2canvasFn = vi.fn().mockResolvedValue(makeMockCanvas());
    const linkClick = vi.fn();
    const doc = {
      createElement: vi.fn(() => ({ download: '', href: '', click: linkClick })),
    };

    await exportCompositionPng({
      previewEl,
      settings: validSettings,
      fileBaseName: 'Meu Mapa',
      skipReadinessWait: true,
      deps: {
        html2canvasFn,
        capacitor: { isNativePlatform: () => false },
        documentRef: doc,
      },
    });

    expect(html2canvasFn).toHaveBeenCalledWith(
      previewEl,
      expect.objectContaining({ useCORS: true, scale: 300 / 96 })
    );
  });

  it('UT-147: web path creates download link with PNG data URL', async () => {
    const previewEl = makePreviewEl('ready');
    const html2canvasFn = vi.fn().mockResolvedValue(makeMockCanvas());
    const link = { download: '', href: '', click: vi.fn() };
    const doc = { createElement: vi.fn(() => link) };

    const result = await exportCompositionPng({
      previewEl,
      settings: validSettings,
      skipReadinessWait: true,
      deps: {
        html2canvasFn,
        capacitor: { isNativePlatform: () => false },
        documentRef: doc,
      },
    });

    expect(doc.createElement).toHaveBeenCalledWith('a');
    expect(link.download).toBe('Meu Mapa.png');
    expect(link.href).toMatch(/^data:image\/png/);
    expect(link.click).toHaveBeenCalled();
    expect(result.delivered).toBe(true);
    expect(result.method).toBe('web');
  });

  it('UT-148: gates fail — exporter not called', async () => {
    const exportPng = vi.fn();
    const controller = createExportController({ exportPng });

    const result = await controller.attemptExport({
      settings: { title: '', author: '', locatorCount: 0 },
      previewEl: makePreviewEl(),
      elements: [],
      canExport: true,
    });

    expect(result.status).toBe('blocked');
    expect(exportPng).not.toHaveBeenCalled();
  });

  it('UT-149: previewEl null — throws ExportCaptureError', async () => {
    await expect(
      exportCompositionPng({
        previewEl: null,
        settings: validSettings,
        skipReadinessWait: true,
      })
    ).rejects.toBeInstanceOf(ExportCaptureError);

    await expect(
      exportCompositionPng({
        previewEl: null,
        settings: validSettings,
        skipReadinessWait: true,
      })
    ).rejects.toMatchObject({ code: 'missing_preview' });
  });

  it('UT-150: canvas too large — failure path', async () => {
    const previewEl = makePreviewEl('ready');
    const huge = makeMockCanvas(MAX_CANVAS_DIMENSION + 1, 100);
    const html2canvasFn = vi.fn().mockResolvedValue(huge);

    await expect(
      exportCompositionPng({
        previewEl,
        settings: validSettings,
        skipReadinessWait: true,
        deps: { html2canvasFn, capacitor: { isNativePlatform: () => false } },
      })
    ).rejects.toBeInstanceOf(ExportCaptureError);

    expect(() => assertCanvasSizeSafe(huge)).toThrow(ExportCaptureError);
  });

  it('UT-151: second export while isExporting — rejected', async () => {
    let resolveCapture;
    const exportPng = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCapture = resolve;
        })
    );
    const controller = createExportController({ exportPng });

    const first = controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });
    expect(controller.getIsExporting()).toBe(true);

    const second = await controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });
    expect(second.status).toBe('rejected');
    expect(exportPng).toHaveBeenCalledTimes(1);

    resolveCapture({ delivered: true, method: 'web', fileName: 'Meu Mapa.png' });
    await first;
  });

  it('UT-152: dismiss abort — success suppressed', async () => {
    let resolveCapture;
    const exportPng = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCapture = resolve;
        })
    );
    const controller = createExportController({ exportPng });

    const pending = controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });

    controller.abortExport();
    resolveCapture({ delivered: true, method: 'web', fileName: 'Meu Mapa.png' });
    const result = await pending;
    expect(result.status).toBe('aborted');
  });

  it('UT-153: after success, new export allowed', async () => {
    const exportPng = vi.fn().mockResolvedValue({ delivered: true, method: 'web', fileName: 'a.png' });
    const controller = createExportController({ exportPng });

    const first = await controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });
    expect(first.status).toBe('success');
    expect(controller.getIsExporting()).toBe(false);

    const second = await controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });
    expect(second.status).toBe('success');
    expect(exportPng).toHaveBeenCalledTimes(2);
  });

  it('UT-154: capture config frozen at start', async () => {
    let capturedSettings;
    const exportPng = vi.fn(async ({ settings }) => {
      capturedSettings = { ...settings };
      return { delivered: true, method: 'web', fileName: 'a.png' };
    });
    const controller = createExportController({ exportPng });

    const result = await controller.attemptExport({
      settings: { ...validSettings, dpi: 150 },
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });

    expect(controller.getFrozenSettings()).toBeNull();
    expect(result.status).toBe('success');
    expect(capturedSettings.dpi).toBe(150);
    expect(exportPng.mock.calls[0][0].settings.dpi).toBe(150);
  });

  it('UT-155: format options list equals png only', () => {
    expect(EXPORT_FORMATS).toEqual(['png']);
    const controller = createExportController();
    expect(controller.getFormatOptions()).toEqual(['png']);
    const modalSrc = readSrc('src/components/map/ExportMapModal.jsx');
    expect(modalSrc).toContain('EXPORT_FORMATS');
    expect(modalSrc).not.toContain('fmt-pdf');
  });

  it('UT-156: isExporting true until resolve/reject', async () => {
    let resolveCapture;
    const exportPng = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveCapture = resolve;
        })
    );
    const controller = createExportController({ exportPng });

    expect(controller.getIsExporting()).toBe(false);
    const pending = controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });
    expect(controller.getIsExporting()).toBe(true);

    resolveCapture({ delivered: true, method: 'web', fileName: 'a.png' });
    await pending;
    expect(controller.getIsExporting()).toBe(false);
  });
});

describe('sanitizePngFileName', () => {
  it('keeps benign titles and normalizes .png suffix', () => {
    expect(sanitizePngFileName('Meu Mapa')).toBe('Meu Mapa.png');
    expect(sanitizePngFileName('Meu Mapa.png')).toBe('Meu Mapa.png');
    expect(sanitizePngFileName('  mapa  ')).toBe('mapa.png');
  });

  it('strips path segments and traversal sequences', () => {
    expect(sanitizePngFileName('../../evil')).toBe('evil.png');
    expect(sanitizePngFileName('subdir/mapa')).toBe('mapa.png');
    expect(sanitizePngFileName('..\\evil')).toBe('evil.png');
    expect(sanitizePngFileName('..')).toBe('mapa.png');
  });

  it('removes null bytes and unsafe characters', () => {
    expect(sanitizePngFileName('map\u0000a')).toBe('mapa.png');
    expect(sanitizePngFileName('bad:name')).toBe('bad_name.png');
  });

  it('clamps long base names', () => {
    const longBase = 'a'.repeat(MAX_PNG_BASE_NAME_LENGTH + 50);
    const sanitized = sanitizePngFileName(longBase);
    expect(sanitized).toBe(`${'a'.repeat(MAX_PNG_BASE_NAME_LENGTH)}.png`);
  });
});

describe('pngExporter — integration (IT-037–IT-039)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('IT-037: web export mock download invoked with PNG', async () => {
    const previewEl = makePreviewEl('ready');
    const html2canvasFn = vi.fn().mockResolvedValue(makeMockCanvas());
    const link = { download: '', href: '', click: vi.fn() };

    await exportCompositionPng({
      previewEl,
      settings: validSettings,
      skipReadinessWait: true,
      deps: {
        html2canvasFn,
        capacitor: { isNativePlatform: () => false },
        documentRef: { createElement: () => link },
      },
    });

    expect(link.click).toHaveBeenCalled();
    expect(link.href).toContain('image/png');
  });

  it('IT-038: native export Filesystem.writeFile + Share.share with file uri', async () => {
    const previewEl = makePreviewEl('ready');
    const html2canvasFn = vi.fn().mockResolvedValue(makeMockCanvas());
    const writeFile = vi.fn().mockResolvedValue({ uri: 'file:///cache/Meu Mapa.png' });
    const share = vi.fn().mockResolvedValue({ activityType: 'com.android.bluetooth' });

    const result = await exportCompositionPng({
      previewEl,
      settings: validSettings,
      skipReadinessWait: true,
      deps: {
        html2canvasFn,
        capacitor: { isNativePlatform: () => true },
        filesystem: { writeFile, Directory: { Cache: 'CACHE' } },
        sharePlugin: { share },
      },
    });

    expect(writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'Meu Mapa.png',
        directory: 'CACHE',
      })
    );
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'file:///cache/Meu Mapa.png' })
    );
    expect(result.delivered).toBe(true);
    expect(result.method).toBe('native');
  });

  it('IT-038c: native export treats resolved share without activityType as delivered', async () => {
    const previewEl = makePreviewEl('ready');
    const html2canvasFn = vi.fn().mockResolvedValue(makeMockCanvas());
    const writeFile = vi.fn().mockResolvedValue({ uri: 'file:///cache/Meu Mapa.png' });
    const share = vi.fn().mockResolvedValue({});

    const result = await exportCompositionPng({
      previewEl,
      settings: validSettings,
      skipReadinessWait: true,
      deps: {
        html2canvasFn,
        capacitor: { isNativePlatform: () => true },
        filesystem: { writeFile, Directory: { Cache: 'CACHE' } },
        sharePlugin: { share },
      },
    });

    expect(result.delivered).toBe(true);
    expect(result.cancelled).toBeUndefined();
    expect(result.method).toBe('native');
  });

  it('IT-038d: native export treats Share canceled rejection as cancelled', async () => {
    const previewEl = makePreviewEl('ready');
    const html2canvasFn = vi.fn().mockResolvedValue(makeMockCanvas());
    const writeFile = vi.fn().mockResolvedValue({ uri: 'file:///cache/Meu Mapa.png' });
    const share = vi.fn().mockRejectedValue(new Error('Share canceled'));

    const result = await exportCompositionPng({
      previewEl,
      settings: validSettings,
      skipReadinessWait: true,
      deps: {
        html2canvasFn,
        capacitor: { isNativePlatform: () => true },
        filesystem: { writeFile, Directory: { Cache: 'CACHE' } },
        sharePlugin: { share },
      },
    });

    expect(result.delivered).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(result.method).toBe('native');
  });

  it('IT-038b: native export sanitizes path-like file names before writeFile', async () => {
    const previewEl = makePreviewEl('ready');
    const html2canvasFn = vi.fn().mockResolvedValue(makeMockCanvas());
    const writeFile = vi.fn().mockResolvedValue({ uri: 'file:///cache/evil.png' });
    const share = vi.fn().mockResolvedValue({ activityType: 'com.android.bluetooth' });

    const result = await exportCompositionPng({
      previewEl,
      settings: { ...validSettings, title: '../../evil' },
      skipReadinessWait: true,
      deps: {
        html2canvasFn,
        capacitor: { isNativePlatform: () => true },
        filesystem: { writeFile, Directory: { Cache: 'CACHE' } },
        sharePlugin: { share },
      },
    });

    expect(writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'evil.png', directory: 'CACHE' })
    );
    expect(result.fileName).toBe('evil.png');
  });

  it('IT-039: auth lost mid-export — no success delivery', async () => {
    const exportPng = vi.fn();
    const controller = createExportController({ exportPng });

    const result = await controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: false,
    });

    expect(result.status).toBe('error');
    expect(exportPng).not.toHaveBeenCalled();
    expect(result.error?.code).toBe('forbidden');
  });
});

describe('pngExporter — readiness (UT-090 parity)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  it('waitForPreviewReadiness throws when status stays loading', async () => {
    const previewEl = makePreviewEl('loading');
    const promise = waitForPreviewReadiness(previewEl, { timeoutMs: 500, pollMs: 100 });
    const assertion = expect(promise).rejects.toBeInstanceOf(ExportCaptureError);
    await vi.advanceTimersByTimeAsync(600);
    await assertion;
  });

  it('waitForPreviewReadiness resolves when status becomes ready', async () => {
    let status = 'loading';
    const previewEl = {
      getAttribute: vi.fn(() => status),
    };
    const promise = waitForPreviewReadiness(previewEl, { timeoutMs: 2000, pollMs: 100 });
    await vi.advanceTimersByTimeAsync(150);
    status = 'ready';
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();
  });

  it('waitForPreviewReadiness requires stable ready polls when configured', async () => {
    const previewEl = makePreviewEl('ready');
    const promise = waitForPreviewReadiness(previewEl, {
      timeoutMs: 2000,
      pollMs: 100,
      stablePolls: 3,
    });
    await vi.advanceTimersByTimeAsync(250);
    await expect(promise).resolves.toBeUndefined();
    expect(previewEl.getAttribute).toHaveBeenCalledTimes(3);
  });

  it('waitForPreviewReadiness resets stable count when status flips away from ready', async () => {
    let status = 'loading';
    const previewEl = {
      getAttribute: vi.fn(() => status),
    };
    const promise = waitForPreviewReadiness(previewEl, {
      timeoutMs: 2000,
      pollMs: 100,
      stablePolls: 2,
    });
    await vi.advanceTimersByTimeAsync(150);
    status = 'ready';
    await vi.advanceTimersByTimeAsync(100);
    status = 'loading';
    await vi.advanceTimersByTimeAsync(100);
    status = 'ready';
    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toBeUndefined();
  });

  it('assertPreviewReadyForCapture throws preview_not_ready when status is loading', () => {
    const previewEl = makePreviewEl('loading');
    expect(() => assertPreviewReadyForCapture(previewEl)).toThrow(ExportCaptureError);
    expect(() => assertPreviewReadyForCapture(previewEl)).toThrow(
      expect.objectContaining({ code: 'preview_not_ready' })
    );
  });

  it('exportCompositionPng aborts capture when status flips after readiness wait (review issue_006)', async () => {
    let pollCount = 0;
    const previewEl = {
      getAttribute: vi.fn((name) => {
        if (name !== 'data-preview-status') return null;
        pollCount += 1;
        if (pollCount <= 3) return 'ready';
        return 'loading';
      }),
    };
    const html2canvasFn = vi.fn().mockResolvedValue(makeMockCanvas());

    const promise = exportCompositionPng({
      previewEl,
      settings: validSettings,
      deps: {
        html2canvasFn,
        capacitor: { isNativePlatform: () => false },
        documentRef: { createElement: () => ({ download: '', href: '', click: vi.fn() }) },
      },
    });

    const assertion = expect(promise).rejects.toMatchObject({ code: 'preview_not_ready' });
    await vi.runAllTimersAsync();
    await assertion;
    expect(html2canvasFn).not.toHaveBeenCalled();
  });

  it('exportCompositionPng rechecks readiness before html2canvas even with skipReadinessWait', async () => {
    const previewEl = makePreviewEl('loading');
    const html2canvasFn = vi.fn().mockResolvedValue(makeMockCanvas());

    await expect(
      exportCompositionPng({
        previewEl,
        settings: validSettings,
        skipReadinessWait: true,
        deps: {
          html2canvasFn,
          capacitor: { isNativePlatform: () => false },
        },
      })
    ).rejects.toMatchObject({ code: 'preview_not_ready' });

    expect(html2canvasFn).not.toHaveBeenCalled();
  });
});

describe('pngExporter — E2E journeys (E2E-015, E2E-017)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('E2E-015: gates pass → PNG download; success only on delivery', async () => {
    const exportPng = vi.fn().mockResolvedValue({ delivered: true, method: 'web', fileName: 'Meu Mapa.png' });
    const controller = createExportController({ exportPng });
    const onSuccess = vi.fn();

    const result = await controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });

    if (result.status === 'success') onSuccess();
    expect(result.status).toBe('success');
    expect(onSuccess).toHaveBeenCalled();
    expect(exportPng).toHaveBeenCalled();
  });

  it('E2E-015: failure path — no success on capture error', async () => {
    const exportPng = vi.fn().mockRejectedValue(new ExportCaptureError('Falha', { code: 'capture_failed' }));
    const controller = createExportController({ exportPng });
    const onSuccess = vi.fn();

    const result = await controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });

    if (result.status === 'success') onSuccess();
    expect(result.status).toBe('error');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('E2E-015: share cancel — no success delivery', async () => {
    const exportPng = vi.fn().mockResolvedValue({ delivered: false, cancelled: true, method: 'native' });
    const controller = createExportController({ exportPng });

    const result = await controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });

    expect(result.status).toBe('cancelled');
  });

  it('E2E-017: blank title/author blocked; fixing allows export', async () => {
    const exportPng = vi.fn().mockResolvedValue({ delivered: true, method: 'web', fileName: 'a.png' });
    const controller = createExportController({ exportPng });

    const blocked = await controller.attemptExport({
      settings: { title: '', author: '', locatorCount: 0 },
      previewEl: makePreviewEl(),
      elements: [],
      canExport: true,
    });
    expect(blocked.status).toBe('blocked');
    expect(validateExportGates({ title: '', author: '' }, [], []).ok).toBe(false);

    const fixed = await controller.attemptExport({
      settings: validSettings,
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });
    expect(fixed.status).toBe('success');
    expect(exportPng).toHaveBeenCalledTimes(1);
  });

  it('E2E-017: incomplete locator blocks export', async () => {
    const exportPng = vi.fn();
    const controller = createExportController({ exportPng });

    const result = await controller.attemptExport({
      settings: { ...validSettings, locatorCount: 1, stateCode: null },
      previewEl: makePreviewEl(),
      elements: [sampleElement],
      canExport: true,
    });

    expect(result.status).toBe('blocked');
    expect(result.gateErrors?.some((e) => e.field === 'stateCode')).toBe(true);
    expect(exportPng).not.toHaveBeenCalled();
  });

  it('E2E-017: empty content blocked with visible gate fields', async () => {
    const gate = validateExportGates(validSettings, [], []);
    expect(gate.ok).toBe(false);
    expect(gate.errors.some((e) => e.field === 'content')).toBe(true);

    const modalSrc = readSrc('src/components/map/ExportMapModal.jsx');
    expect(modalSrc).toContain('export-gate-errors');
  });
});

describe('pngExporter — MapEditor wiring', () => {
  it('MapEditor uses exportController and removed inline html2canvas', () => {
    const editorSrc = readSrc('src/page/MapEditor.jsx');
    expect(editorSrc).toContain('createExportController');
    expect(editorSrc).toContain('exportControllerRef');
    expect(editorSrc).not.toContain('html2canvas');
    expect(editorSrc).not.toContain('jsPDF');
  });

  it('ExportMapModal exposes isExporting lifecycle', () => {
    const modalSrc = readSrc('src/components/map/ExportMapModal.jsx');
    expect(modalSrc).toContain('isExporting');
    expect(modalSrc).toContain('data-exporting');
    expect(modalSrc).toContain('Gerando…');
  });

  it('MapEditor freezes export settings store while isExporting', () => {
    const editorSrc = readSrc('src/page/MapEditor.jsx');
    expect(editorSrc).toMatch(
      /setExportSettings\(exportSettingsStoreRef\.current\.updateSettings\(\{\}, elements\)\);[\s\S]*?\}, \[showExport, mapId, elements, isExporting\]\);/
    );
    expect(editorSrc).toMatch(
      /if \(!exportSettingsStoreRef\.current \|\| isExporting\) return;[\s\S]*?updateSettings\(partial, elements\)/
    );
  });

  it('MapEditor sets isExporting before flush and snapshots elements for attemptExport (review issue_003)', () => {
    const editorSrc = readSrc('src/page/MapEditor.jsx');
    const handleExportBlock = editorSrc.match(/const handleExport = async[\s\S]*?^\s*\};/m);
    expect(handleExportBlock).toBeTruthy();
    const block = handleExportBlock[0];
    const setExportingIdx = block.indexOf('setIsExporting(true)');
    const flushIdx = block.indexOf('flush()');
    expect(setExportingIdx).toBeGreaterThan(-1);
    expect(flushIdx).toBeGreaterThan(-1);
    expect(setExportingIdx).toBeLessThan(flushIdx);
    expect(block).toContain('const frozenElements = elements');
    expect(block).toMatch(/elements:\s*frozenElements/);
  });
});
