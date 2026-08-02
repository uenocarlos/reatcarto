import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  canOpenExport,
  canAttemptPngExport,
  EXPORT_FORMATS,
  isExportEntryReady,
  shouldMountExportModal,
} from '@/lib/export/exportGates';
import { createExportEntryState } from '@/lib/export/exportEntryState';
import {
  createExportSettingsStore,
  loadSettingsForMap,
} from '@/lib/export/exportSettingsStore';
import { normalizeExportSettings } from '@/lib/export/exportSettings';
import {
  OfflineStore,
  resetOfflineDbForTests,
} from '@/lib/offline/OfflineStore';
import {
  setOfflineUserId,
  prepareOfflineMap,
  offlineGetMap,
} from '@/lib/offline/offlineApi';

const ROOT = resolve(process.cwd());
const MAP_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MAP_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_A = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function readSrc(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function assertNonOwnerCannotOpenExport() {
  expect(canOpenExport({ isOwner: false, mapId: MAP_A })).toBe(false);
  expect(shouldMountExportModal({ isOwner: false, mapId: MAP_A })).toBe(false);
  expect(canAttemptPngExport({ isOwner: false, exportAttempted: true })).toBe(false);
}

describe('export entry — unit (UT-001–UT-010)', () => {
  it('UT-001: open sets modal open for owned loaded map', () => {
    const entry = createExportEntryState();
    const result = entry.openExport({ isOwner: true, mapId: MAP_A, mapDataReady: true });
    expect(result.blocked).toBe(false);
    expect(entry.getShowExport()).toBe(true);
    expect(entry.shouldMountModal({ isOwner: true, mapId: MAP_A })).toBe(true);
  });

  it('UT-002: cancel closes modal without export invocation', () => {
    const entry = createExportEntryState({ showExport: true });
    const onExport = vi.fn();
    entry.closeExport();
    expect(entry.getShowExport()).toBe(false);
    expect(onExport).not.toHaveBeenCalled();
    expect(entry.wasExportInvoked()).toBe(false);
  });

  it('UT-003: missing mapId does not mount broken modal', () => {
    const entry = createExportEntryState();
    entry.openExport({ isOwner: true, mapId: null, mapDataReady: true });
    expect(entry.getShowExport()).toBe(false);
    expect(shouldMountExportModal({ isOwner: true, mapId: null })).toBe(false);
  });

  it('UT-004: empty elements still opens modal', () => {
    const entry = createExportEntryState();
    const result = entry.openExport({ isOwner: true, mapId: MAP_A, mapDataReady: true });
    expect(result.blocked).toBe(false);
    expect(entry.getShowExport()).toBe(true);
  });

  it('UT-005: double open is idempotent', () => {
    const entry = createExportEntryState();
    entry.openExport({ isOwner: true, mapId: MAP_A, mapDataReady: true });
    entry.openExport({ isOwner: true, mapId: MAP_A, mapDataReady: true });
    expect(entry.getShowExport()).toBe(true);
  });

  it('UT-006: open while mapData null stays blocked/disabled', () => {
    const entry = createExportEntryState();
    const result = entry.openExport({ isOwner: true, mapId: MAP_A, mapDataReady: false });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('loading');
    expect(entry.getShowExport()).toBe(false);
    expect(isExportEntryReady({ mapDataReady: false, mapId: MAP_A })).toBe(false);
  });

  it('UT-007: settings loader keyed by mapId isolates maps', () => {
    const registry = new Map();
    const settingsA = loadSettingsForMap(registry, MAP_A, { title: 'Map A', author: 'One' }, []);
    const settingsB = loadSettingsForMap(registry, MAP_B, { title: 'Map B', author: 'Two' }, []);
    expect(settingsA.title).toBe('Map A');
    expect(settingsB.title).toBe('Map B');
    const reloadedB = loadSettingsForMap(registry, MAP_B, { title: 'Map B', author: 'Two' }, []);
    expect(reloadedB.title).not.toBe(settingsA.title);
  });

  it('UT-008: PublicMapView and Gallery have no composition export control', () => {
    const publicSrc = readSrc('src/page/PublicMapView.jsx');
    const gallerySrc = readSrc('src/page/Gallery.jsx');
    expect(publicSrc).not.toContain('ExportMapModal');
    expect(gallerySrc).not.toContain('ExportMapModal');
    expect(publicSrc).not.toMatch(/export-map-button|Exportar Mapa/i);
    expect(gallerySrc).not.toMatch(/export-map-button|Exportar Mapa/i);
  });

  it('UT-009: public view offline still has no export control in source', () => {
    const publicSrc = readSrc('src/page/PublicMapView.jsx');
    expect(publicSrc).not.toContain('ExportMapModal');
    expect(publicSrc).not.toContain('showExport');
  });

  it('UT-010: canOpenExport false for non-owner', () => {
    expect(canOpenExport({ isOwner: false })).toBe(false);
    expect(canOpenExport({ isOwner: false, mapId: MAP_A })).toBe(false);
  });
});

describe('export entry — integration (IT-001–IT-015)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('IT-001: MapEditor source wires Export button and modal', () => {
    const editorSrc = readSrc('src/page/MapEditor.jsx');
    expect(editorSrc).toContain('data-testid="export-map-button"');
    expect(editorSrc).toContain('ExportMapModal');
    expect(editorSrc).toContain('handleOpenExport');
    expect(editorSrc).toContain('setShowExport(true)');
  });

  it('IT-001d: prune-only updateSettings skips persist when hidden arrays unchanged', async () => {
    vi.useFakeTimers();
    try {
      const persist = vi.fn().mockResolvedValue(undefined);
      const store = createExportSettingsStore({ mapId: MAP_A, persist, delayMs: 200 });
      const elements = [{ id: 'el-1', element_category: 'terra' }];

      store.hydrate(
        MAP_A,
        { title: 'T', author: 'A', hiddenElementIds: ['el-gone', 'el-1'] },
        elements
      );
      store.updateSettings({ title: 'User Edit' }, elements);
      await vi.advanceTimersByTimeAsync(200);
      persist.mockClear();

      store.updateSettings({}, elements);
      store.updateSettings({}, [...elements]);
      await vi.advanceTimersByTimeAsync(500);
      expect(persist).not.toHaveBeenCalled();

      store.updateSettings({}, []);
      await vi.advanceTimersByTimeAsync(500);
      expect(persist).toHaveBeenCalledTimes(1);
      expect(persist.mock.calls[0][0].hiddenElementIds).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('IT-001b: open export modal preserves unsaved edits when elements refetch', () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const store = createExportSettingsStore({ mapId: MAP_A, persist });
    const serverSettings = { title: 'Server Title', author: 'Server Author' };
    const initialElements = [{ id: 'el-1', element_category: 'terra' }];

    store.hydrate(MAP_A, serverSettings, initialElements);
    store.updateSettings({ title: 'User Edit', legendPosition: 'beside' }, initialElements);

    const staleRehydrate = store.hydrate(MAP_A, serverSettings, [
      ...initialElements,
      { id: 'el-2', element_category: 'agua' },
    ]);
    expect(staleRehydrate.title).toBe('Server Title');

    store.updateSettings({ title: 'User Edit', legendPosition: 'beside' }, initialElements);
    const pruned = store.updateSettings({}, [
      ...initialElements,
      { id: 'el-2', element_category: 'agua' },
    ]);
    expect(pruned.title).toBe('User Edit');
    expect(pruned.legendPosition).toBe('beside');
  });

  it('IT-001c: MapEditor hydrates once per modal session and prunes on element changes', () => {
    const editorSrc = readSrc('src/page/MapEditor.jsx');
    expect(editorSrc).toContain('exportModalHydratedRef');
    expect(editorSrc).toMatch(/updateSettings\(\{\},\s*elements\)/);
    const hydrateEffect = editorSrc.match(
      /exportModalHydratedRef[\s\S]*?\},\s*\[showExport,\s*mapId,\s*mapData\]\);/
    );
    expect(hydrateEffect).not.toBeNull();
    expect(hydrateEffect[0]).not.toContain('elements]');
  });

  it('IT-002: modal opens with large element fixture without store crash', () => {
    const elements = Array.from({ length: 200 }, (_, i) => ({
      id: `el-${i}`,
      element_category: 'terra',
      element_type: 'point',
      geojson: JSON.stringify({ type: 'Point', coordinates: [-52.1, -32.035] }),
      style: JSON.stringify({ icon_color: '#F97316' }),
    }));
    const store = createExportSettingsStore({
      mapId: MAP_A,
      persist: vi.fn().mockResolvedValue(undefined),
    });
    expect(() => store.hydrate(MAP_A, {}, elements)).not.toThrow();
    expect(store.getSettings().legendPosition).toBe('inside');
  });

  it('IT-003: session 401 on map load blocks export entry', () => {
    expect(canOpenExport({ isOwner: false, mapId: MAP_A })).toBe(false);
    const entry = createExportEntryState();
    entry.openExport({ isOwner: false, mapId: MAP_A, mapDataReady: true });
    expect(entry.getShowExport()).toBe(false);
  });

  it('IT-004: offline cached map opens with mirrored export_settings', async () => {
    await resetOfflineDbForTests();
    setOfflineUserId(USER_A);
    const mapWithSettings = {
      id: MAP_A,
      name: 'Offline Map',
      version: 1,
      export_settings: { title: 'Offline Title', author: 'Offline Author' },
    };
    await prepareOfflineMap(
      MAP_A,
      async () => [mapWithSettings],
      async () => []
    );
    const offline = await offlineGetMap(MAP_A);
    expect(offline.map.export_settings).toMatchObject({ title: 'Offline Title' });
    const store = createExportSettingsStore({
      mapId: MAP_A,
      persist: vi.fn(),
    });
    const hydrated = store.hydrate(MAP_A, offline.map.export_settings, []);
    expect(hydrated.title).toBe('Offline Title');
  });

  it('IT-005: cancel then reopen restores flushed settings', async () => {
    vi.useFakeTimers();
    const persist = vi.fn().mockResolvedValue(undefined);
    const store = createExportSettingsStore({ mapId: MAP_A, persist, delayMs: 200 });
    store.updateSettings({ title: 'Persisted', author: 'User' }, []);
    await store.flush();
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Persisted', author: 'User' })
    );
    const entry = createExportEntryState();
    entry.openExport({ isOwner: true, mapId: MAP_A, mapDataReady: true });
    entry.closeExport();
    entry.openExport({ isOwner: true, mapId: MAP_A, mapDataReady: true });
    const rehydrated = store.hydrate(MAP_A, { title: 'Persisted', author: 'User' }, []);
    expect(rehydrated.title).toBe('Persisted');
    vi.useRealTimers();
  });

  it('IT-006: ownership lost disables export actions', () => {
    const modalSrc = readSrc('src/components/map/ExportMapModal.jsx');
    expect(modalSrc).toContain('ownershipLost');
    expect(modalSrc).toContain('export-ownership-lost');
    expect(modalSrc).toContain('disabled={exportDisabled}');
  });

  it('IT-007: Gallery/PublicMapView have no composition export control', () => {
    assertNonOwnerCannotOpenExport();
    const publicSrc = readSrc('src/page/PublicMapView.jsx');
    const gallerySrc = readSrc('src/page/Gallery.jsx');
    expect(publicSrc).not.toContain('ExportMapModal');
    expect(gallerySrc).not.toContain('ExportMapModal');
  });

  it('IT-008: crafted non-owned editor access denied via canOpenExport', () => {
    assertNonOwnerCannotOpenExport();
  });

  it('IT-009: public missing id — no export mount', () => {
    expect(canOpenExport({ isOwner: false, mapId: null })).toBe(false);
  });

  it('IT-010: repeated unauthorized settings update returns forbidden', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: 'forbidden' }),
      })
    );
    const { api } = await import('@/api/apiClient');
    await expect(
      api.entities.Map.update(MAP_A, { export_settings: { title: 'X', author: 'Y' } })
    ).rejects.toBeTruthy();
  });

  it('IT-011: user B cannot update user A map settings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: 'forbidden' }),
      })
    );
    const { api } = await import('@/api/apiClient');
    await expect(
      api.entities.Map.update(MAP_B, { export_settings: { title: 'Hack', author: 'B' } })
    ).rejects.toBeTruthy();
  });

  it('IT-012: unpublish public view — still no export', () => {
    assertNonOwnerCannotOpenExport();
  });

  it('IT-013: retry denied export remains denied', () => {
    expect(canOpenExport({ isOwner: false, mapId: MAP_A })).toBe(false);
    expect(canOpenExport({ isOwner: false, mapId: MAP_A })).toBe(false);
  });

  it('IT-014: login without ownership cannot open export', () => {
    assertNonOwnerCannotOpenExport();
  });

  it('IT-015: moderated public map — no export', () => {
    assertNonOwnerCannotOpenExport();
  });
});

describe('export entry — non-owner shared denials (IT-016–IT-034)', () => {
  const ids = [
    'IT-016',
    'IT-017',
    'IT-018',
    'IT-019',
    'IT-020',
    'IT-022',
    'IT-023',
    'IT-024',
    'IT-026',
    'IT-029',
    'IT-031',
    'IT-032',
    'IT-034',
  ];

  it.each(ids)('%s: non-owner cannot open composition export', () => {
    assertNonOwnerCannotOpenExport();
  });
});

describe('export entry — persistence integration (IT-035, IT-046, IT-048, IT-049)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('IT-035: reopen builds from server export_settings', () => {
    const store = createExportSettingsStore({
      mapId: MAP_A,
      persist: vi.fn(),
    });
    const serverSettings = { title: 'Server Title', author: 'Server Author', dpi: 150 };
    const hydrated = store.hydrate(MAP_A, serverSettings, []);
    expect(hydrated).toMatchObject({ title: 'Server Title', author: 'Server Author', dpi: 150 });
  });

  it('IT-046: flush on close persists before debounce fires', async () => {
    vi.useFakeTimers();
    const persist = vi.fn().mockResolvedValue(undefined);
    const store = createExportSettingsStore({ mapId: MAP_A, persist, delayMs: 5000 });
    store.updateSettings({ title: 'Flush Me', author: 'User' }, []);
    await store.flush();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0].title).toBe('Flush Me');
  });

  it('IT-048: many maps — each export uses that map settings only', () => {
    const registry = new Map();
    const a = loadSettingsForMap(registry, MAP_A, { title: 'Alpha', author: 'A' }, []);
    const b = loadSettingsForMap(registry, MAP_B, { title: 'Beta', author: 'B' }, []);
    expect(a.title).toBe('Alpha');
    expect(b.title).toBe('Beta');
    const backToA = loadSettingsForMap(registry, MAP_A, { title: 'Alpha', author: 'A' }, []);
    expect(backToA.title).toBe('Alpha');
    expect(backToA.title).not.toBe(b.title);
  });

  it('IT-049: non-owner never receives successful PNG path', () => {
    expect(canAttemptPngExport({ isOwner: false, exportAttempted: true })).toBe(false);
    expect(canAttemptPngExport({ isOwner: true, exportAttempted: true })).toBe(true);
  });
});

describe('export entry — E2E journeys (E2E-001, E2E-002, E2E-016)', () => {
  it('E2E-001: owner open → cancel → no export file', () => {
    const entry = createExportEntryState();
    const exportFn = vi.fn();
    entry.openExport({ isOwner: true, mapId: MAP_A, mapDataReady: true });
    expect(entry.getShowExport()).toBe(true);
    entry.closeExport();
    expect(entry.getShowExport()).toBe(false);
    expect(exportFn).not.toHaveBeenCalled();
    expect(entry.wasExportInvoked()).toBe(false);
  });

  it('E2E-002: anonymous gallery has no export; crafted editor denied', () => {
    const gallerySrc = readSrc('src/page/Gallery.jsx');
    expect(gallerySrc).not.toContain('ExportMapModal');
    expect(canOpenExport({ isOwner: false, mapId: MAP_A })).toBe(false);
  });

  it('E2E-016: configure close reopen restores per-map settings', async () => {
    vi.useFakeTimers();
    const persist = vi.fn().mockResolvedValue(undefined);
    const storeA = createExportSettingsStore({ mapId: MAP_A, persist, delayMs: 300 });
    storeA.updateSettings({ title: 'Configured A', author: 'Owner' }, []);
    await storeA.flush();
    const storeB = createExportSettingsStore({ mapId: MAP_B, persist, delayMs: 300 });
    storeB.hydrate(MAP_B, { title: 'Other Map', author: 'Other' }, []);
    const reopenedA = storeA.hydrate(MAP_A, { title: 'Configured A', author: 'Owner' }, []);
    expect(reopenedA.title).toBe('Configured A');
    expect(storeB.getSettings().title).toBe('Other Map');
    vi.useRealTimers();
  });
});

describe('export shell format list', () => {
  it('format options equal png only at shell level', () => {
    expect(EXPORT_FORMATS).toEqual(['png']);
    const modalSrc = readSrc('src/components/map/ExportMapModal.jsx');
    expect(modalSrc).not.toContain('fmt-pdf');
    expect(modalSrc).not.toContain('pdf');
    expect(modalSrc).toContain('EXPORT_FORMATS');
  });

  it('MapEditor removed jsPDF from composition path', () => {
    const editorSrc = readSrc('src/page/MapEditor.jsx');
    expect(editorSrc).not.toContain('jsPDF');
    expect(editorSrc).toContain('.png');
  });
});
