import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  defaultExportSettings,
  normalizeExportSettings,
  pruneExportSettings,
  validateExportGates,
  effectiveVisibleElements,
  createDebouncedExportSettingsPersist,
} from '@/lib/export/exportSettings';
import { resetOfflineDbForTests } from '@/lib/offline/OfflineStore';
import {
  setOfflineUserId,
  prepareOfflineMap,
  offlineGetMap,
} from '@/lib/offline/offlineApi';

const sampleElement = {
  id: 'visible-el',
  element_category: 'terra',
  name: 'Point A',
};

describe('exportSettings', () => {
  describe('normalize / defaults / prune', () => {
    it('UT-157: save settings then load deep equal normalized', () => {
      const raw = { title: 'Report', author: 'Analyst', dpi: 450, legendColumns: 4 };
      const saved = normalizeExportSettings(raw);
      const loaded = normalizeExportSettings(saved);
      expect(loaded).toEqual(saved);
    });

    it('UT-158: mapA vs mapB settings isolation', () => {
      const mapA = normalizeExportSettings({ title: 'Map A', author: 'One' });
      const mapB = normalizeExportSettings({ title: 'Map B', author: 'Two' });
      expect(mapA.title).toBe('Map A');
      expect(mapB.title).toBe('Map B');
      expect(mapA).not.toEqual(mapB);
    });

    it('UT-159: corrupted JSON / wrong types fall back to defaults', () => {
      expect(normalizeExportSettings('not-json')).toEqual(defaultExportSettings());
      expect(normalizeExportSettings(null)).toEqual(defaultExportSettings());
      expect(normalizeExportSettings([])).toEqual(defaultExportSettings());
      expect(normalizeExportSettings({ legendColumns: 'bad', dpi: null })).toMatchObject({
        legendColumns: 2,
        dpi: 300,
      });
    });

    it('UT-160: empty object yields defaults including inside legend and dpi 300', () => {
      const settings = normalizeExportSettings({});
      expect(settings).toEqual(defaultExportSettings());
      expect(settings.legendPosition).toBe('inside');
      expect(settings.dpi).toBe(300);
    });

    it('UT-161: large visibility arrays normalize and prune complete', () => {
      const hiddenElementIds = Array.from({ length: 500 }, (_, i) => `el-${i}`);
      const settings = normalizeExportSettings({ hiddenElementIds, hiddenCategoryIds: ['cat-x'] });
      expect(settings.hiddenElementIds).toHaveLength(500);
      const pruned = pruneExportSettings(settings, [sampleElement]);
      expect(pruned.hiddenElementIds).toEqual([]);
      expect(pruned.hiddenCategoryIds).toEqual([]);
    });

    it('UT-174: defaultExportSettings matches TechSpec defaults table', () => {
      expect(defaultExportSettings()).toEqual({
        title: '',
        author: '',
        technicalResponsible: '',
        legendPosition: 'inside',
        legendRect: null,
        legendColumns: 2,
        legendFontSizePx: 12,
        legendSpacing: 'normal',
        hiddenCategoryIds: [],
        hiddenElementIds: [],
        showTags: false,
        basemap: 'carto',
        locatorCount: 0,
        stateCode: null,
        municipalityCode: null,
        stateColor: '#1D4ED8',
        municipalityColor: '#DC2626',
        showStateInLegend: false,
        showMunicipalityInLegend: false,
        showMunicipalMesh: false,
        paperSize: 'A4',
        orientation: 'landscape',
        dpi: 300,
      });
    });

    it('UT-178: legacy legendPosition right migrates to beside', () => {
      expect(normalizeExportSettings({ legendPosition: 'right' }).legendPosition).toBe('beside');
    });

    it('UT-179: empty hidden arrays are valid', () => {
      const settings = normalizeExportSettings({ hiddenCategoryIds: [], hiddenElementIds: [] });
      expect(settings.hiddenCategoryIds).toEqual([]);
      expect(settings.hiddenElementIds).toEqual([]);
    });

    it('UT-180: normalize is idempotent', () => {
      const once = normalizeExportSettings({ title: 'T', author: 'A', dpi: 200, legendPosition: 'below' });
      const twice = normalizeExportSettings(once);
      expect(twice).toEqual(once);
    });

    it('UT-108: invalid location colors fall back to defaults in normalizeExportSettings', () => {
      const settings = normalizeExportSettings({
        stateColor: 'notahex',
        municipalityColor: 'bad',
      });
      expect(settings.stateColor).toBe('#1D4ED8');
      expect(settings.municipalityColor).toBe('#DC2626');
    });

    it('UT-108: valid hex location colors persist through normalizeExportSettings', () => {
      const settings = normalizeExportSettings({
        stateColor: '#ABCDEF',
        municipalityColor: '  #123456  ',
      });
      expect(settings.stateColor).toBe('#ABCDEF');
      expect(settings.municipalityColor).toBe('#123456');
    });

    it('UT-108: invalid location colors do not round-trip on re-normalize', () => {
      const once = normalizeExportSettings({ stateColor: 'notahex', municipalityColor: '#DC2626' });
      const twice = normalizeExportSettings(once);
      expect(twice).toEqual(once);
      expect(twice.stateColor).toBe('#1D4ED8');
    });
  });

  describe('validateExportGates', () => {
    const validSettings = normalizeExportSettings({
      title: 'Title',
      author: 'Author',
      locatorCount: 0,
    });

    it('UT-162: non-empty title author and visible element passes', () => {
      const result = validateExportGates(validSettings, [sampleElement], []);
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('UT-163: missing author blocked', () => {
      const settings = { ...validSettings, author: '' };
      const result = validateExportGates(settings, [sampleElement], []);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.field === 'author')).toBe(true);
    });

    it('UT-164: locatorCount 1 without state blocked', () => {
      const settings = normalizeExportSettings({
        title: 'T',
        author: 'A',
        locatorCount: 1,
        stateCode: null,
      });
      const result = validateExportGates(settings, [sampleElement], []);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.field === 'stateCode')).toBe(true);
    });

    it('UT-165: no visible elements and no legend items blocked', () => {
      const result = validateExportGates(validSettings, [], []);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.field === 'content')).toBe(true);
    });

    it('UT-166: whitespace title and author blocked', () => {
      const settings = normalizeExportSettings({ title: '   ', author: '\t', locatorCount: 0 });
      const result = validateExportGates(settings, [sampleElement], []);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.field === 'title')).toBe(true);
      expect(result.errors.some((e) => e.field === 'author')).toBe(true);
    });

    it('UT-167: empty technicalResponsible still ok when other gates pass', () => {
      const settings = normalizeExportSettings({
        title: 'T',
        author: 'A',
        technicalResponsible: '',
      });
      const result = validateExportGates(settings, [sampleElement], []);
      expect(result.ok).toBe(true);
    });

    it('UT-168: after fixing title validation passes', () => {
      const broken = normalizeExportSettings({ title: '', author: 'A' });
      expect(validateExportGates(broken, [sampleElement], []).ok).toBe(false);
      const fixed = normalizeExportSettings({ title: 'Fixed', author: 'A' });
      expect(validateExportGates(fixed, [sampleElement], []).ok).toBe(true);
    });

    it('UT-169: gate result independent of navigator.onLine', () => {
      vi.stubGlobal('navigator', { onLine: false });
      const offline = validateExportGates(validSettings, [sampleElement], []);
      vi.stubGlobal('navigator', { onLine: true });
      const online = validateExportGates(validSettings, [sampleElement], []);
      expect(offline).toEqual(online);
    });

    it('UT-170: repeated validate while blocked returns same errors', () => {
      const settings = normalizeExportSettings({ title: '', author: '', locatorCount: 1 });
      const first = validateExportGates(settings, [], []);
      const second = validateExportGates(settings, [], []);
      expect(second).toEqual(first);
    });

    it('UT-171: hidden elements but location legend entry satisfies content gate', () => {
      const settings = normalizeExportSettings({
        title: 'T',
        author: 'A',
        hiddenElementIds: [sampleElement.id],
        showStateInLegend: true,
        stateCode: '43',
        municipalityCode: '4314902',
        locatorCount: 1,
      });
      const visible = effectiveVisibleElements([sampleElement], settings);
      const legendItems = [{ type: 'state', code: '43' }];
      const result = validateExportGates(settings, visible, legendItems);
      expect(result.ok).toBe(true);
    });

    it('UT-172: locatorCount 0 clears locator requirement', () => {
      const settings = normalizeExportSettings({
        title: 'T',
        author: 'A',
        locatorCount: 0,
        stateCode: null,
        municipalityCode: null,
      });
      const result = validateExportGates(settings, [sampleElement], []);
      expect(result.ok).toBe(true);
      expect(result.errors.some((e) => e.field === 'stateCode')).toBe(false);
    });

    it('UT-173: missing title and locator include both fields', () => {
      const settings = normalizeExportSettings({
        title: '',
        author: 'A',
        locatorCount: 1,
        stateCode: null,
      });
      const result = validateExportGates(settings, [sampleElement], []);
      expect(result.errors.some((e) => e.field === 'title')).toBe(true);
      expect(result.errors.some((e) => e.field === 'stateCode')).toBe(true);
    });

    it('HTML-only title and author blocked after sanitize (issue 005)', () => {
      const htmlOnly = normalizeExportSettings({
        title: '<b></b>',
        author: '<script></script>',
        locatorCount: 0,
      });
      expect(htmlOnly.title).toBe('');
      expect(htmlOnly.author).toBe('');
      const result = validateExportGates(htmlOnly, [sampleElement], []);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.field === 'title')).toBe(true);
      expect(result.errors.some((e) => e.field === 'author')).toBe(true);
    });

    it('title and author with HTML tags normalize to visible text', () => {
      const settings = normalizeExportSettings({
        title: '<b>Map Title</b>',
        author: '  <i>Author</i>  ',
        locatorCount: 0,
      });
      expect(settings.title).toBe('Map Title');
      expect(settings.author).toBe('Author');
      expect(validateExportGates(settings, [sampleElement], []).ok).toBe(true);
    });
  });

  describe('debounced persist helper', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('UT-175: debounce fires once after quiet period', async () => {
      const persist = vi.fn().mockResolvedValue(undefined);
      const store = createDebouncedExportSettingsPersist({ persist, delayMs: 300 });
      store.setSettings({ title: 'A', author: 'B' });
      store.setSettings({ title: 'A2', author: 'B' });
      expect(persist).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(300);
      expect(persist).toHaveBeenCalledTimes(1);
      expect(persist.mock.calls[0][0].title).toBe('A2');
    });

    it('UT-176: flush invokes persist immediately', async () => {
      const persist = vi.fn().mockResolvedValue(undefined);
      const store = createDebouncedExportSettingsPersist({ persist, delayMs: 1000 });
      store.setSettings({ title: 'Flush', author: 'Now' });
      await store.flush();
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it('UT-177: persist reject keeps in-memory settings for session', async () => {
      const persist = vi.fn().mockRejectedValue(new Error('500'));
      const store = createDebouncedExportSettingsPersist({ persist, delayMs: 100 });
      store.setSettings({ title: 'Session', author: 'Keep' });
      await expect(store.flush()).rejects.toThrow('500');
      expect(store.getMemorySettings()).toMatchObject({ title: 'Session', author: 'Keep' });
    });

    it('debounced persist failure invokes onPersistError and marks failure', async () => {
      const error = new Error('500');
      const persist = vi.fn().mockRejectedValue(error);
      const onPersistError = vi.fn();
      const store = createDebouncedExportSettingsPersist({
        persist,
        delayMs: 100,
        onPersistError,
        retryDelayMs: 0,
      });
      store.setSettings({ title: 'Debounced', author: 'Fail' });
      await vi.advanceTimersByTimeAsync(100);
      expect(onPersistError).toHaveBeenCalledWith(error);
      expect(store.hasPersistFailure()).toBe(true);
      expect(store.getMemorySettings()).toMatchObject({ title: 'Debounced', author: 'Fail' });
    });

    it('successful persist clears hasPersistFailure after prior debounced failure', async () => {
      const persist = vi
        .fn()
        .mockRejectedValueOnce(new Error('500'))
        .mockResolvedValueOnce(undefined);
      const onPersistError = vi.fn();
      const store = createDebouncedExportSettingsPersist({
        persist,
        delayMs: 100,
        onPersistError,
        retryDelayMs: 0,
      });
      store.setSettings({ title: 'Recover', author: 'User' });
      await vi.advanceTimersByTimeAsync(100);
      expect(store.hasPersistFailure()).toBe(true);
      await store.flush();
      expect(store.hasPersistFailure()).toBe(false);
      expect(onPersistError).toHaveBeenCalledTimes(1);
    });

    it('schedules backoff retry after debounced persist failure', async () => {
      const persist = vi
        .fn()
        .mockRejectedValueOnce(new Error('500'))
        .mockResolvedValueOnce(undefined);
      const onPersistError = vi.fn();
      const store = createDebouncedExportSettingsPersist({
        persist,
        delayMs: 100,
        onPersistError,
        retryDelayMs: 500,
      });
      store.setSettings({ title: 'Retry', author: 'Later' });
      await vi.advanceTimersByTimeAsync(100);
      expect(persist).toHaveBeenCalledTimes(1);
      expect(store.hasPersistFailure()).toBe(true);
      await vi.advanceTimersByTimeAsync(500);
      expect(persist).toHaveBeenCalledTimes(2);
      expect(store.hasPersistFailure()).toBe(false);
    });

    it('new edits cancel pending retry and debounce fresh persist', async () => {
      const persist = vi
        .fn()
        .mockRejectedValueOnce(new Error('500'))
        .mockResolvedValueOnce(undefined);
      const store = createDebouncedExportSettingsPersist({
        persist,
        delayMs: 200,
        retryDelayMs: 1000,
      });
      store.setSettings({ title: 'First', author: 'Edit' });
      await vi.advanceTimersByTimeAsync(200);
      store.setSettings({ title: 'Second', author: 'Edit' });
      await vi.advanceTimersByTimeAsync(200);
      expect(persist).toHaveBeenCalledTimes(2);
      expect(persist.mock.calls[1][0].title).toBe('Second');
      await vi.advanceTimersByTimeAsync(1000);
      expect(persist).toHaveBeenCalledTimes(2);
    });
  });
});

describe('exportSettings integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  it('IT-040: debounced settings-only update hits update.php without base_version', async () => {
    vi.useFakeTimers();
    const mapId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        map: {
          id: mapId,
          version: 3,
          export_settings: { title: 'Debounced', author: 'User' },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api } = await import('@/api/apiClient');
    const persist = vi.fn((settings) => api.entities.Map.update(mapId, { export_settings: settings }));
    const store = createDebouncedExportSettingsPersist({ persist, delayMs: 200 });
    store.setSettings({ title: 'Debounced', author: 'User' });
    await vi.advanceTimersByTimeAsync(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      id: mapId,
      export_settings: expect.objectContaining({ title: 'Debounced', author: 'User' }),
    });
    expect(body.base_version).toBeUndefined();
    vi.useRealTimers();
  });

  it('IT-045: identical settings save twice succeeds idempotently', async () => {
    const mapId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const settings = { title: 'Same', author: 'User', legendPosition: 'inside', dpi: 300 };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          map: { id: mapId, version: 1, export_settings: settings },
        }),
      })
    );
    const { api } = await import('@/api/apiClient');
    const first = await api.entities.Map.update(mapId, { export_settings: settings });
    const second = await api.entities.Map.update(mapId, { export_settings: settings });
    expect(second.export_settings.title).toBe(first.export_settings.title);
  });

  it('IT-050: client normalize to API round-trip preserves fields', async () => {
    const mapId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const clientSettings = normalizeExportSettings({
      title: 'Round Trip',
      author: 'Tester',
      legendPosition: 'right',
      dpi: 150,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          map: {
            id: mapId,
            version: 2,
            export_settings: {
              title: 'Round Trip',
              author: 'Tester',
              legendPosition: 'beside',
              dpi: 150,
            },
          },
        }),
      })
    );
    const { api } = await import('@/api/apiClient');
    const updated = await api.entities.Map.update(mapId, { export_settings: clientSettings });
    expect(updated.export_settings).toMatchObject({
      title: 'Round Trip',
      author: 'Tester',
      legendPosition: 'beside',
      dpi: 150,
    });
  });

  it('mirrors export_settings to IndexedDB after settings-only Map.update', async () => {
    await resetOfflineDbForTests();
    const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const mapId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    setOfflineUserId(userId);
    await prepareOfflineMap(
      mapId,
      async () => [{ id: mapId, name: 'Field Map', version: 1, export_settings: { title: 'Initial', author: 'User' } }],
      async () => []
    );
    const updatedSettings = normalizeExportSettings({ title: 'Mirrored', author: 'Offline' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({
          success: true,
          map: { id: mapId, version: 1, export_settings: updatedSettings },
        }),
      })
    );
    const { api } = await import('@/api/apiClient');
    await api.entities.Map.update(mapId, { export_settings: updatedSettings });
    const offline = await offlineGetMap(mapId);
    expect(offline.map.export_settings).toMatchObject({ title: 'Mirrored', author: 'Offline' });
  });

  it('IT-044: persist 500 keeps session memory usable', async () => {
    vi.useFakeTimers();
    const persist = vi
      .fn()
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValueOnce(undefined);
    const store = createDebouncedExportSettingsPersist({ persist, delayMs: 100 });
    const settings = normalizeExportSettings({ title: 'Offline Session', author: 'User' });
    store.setSettings(settings);
    await expect(store.flush()).rejects.toThrow('500');
    const memory = store.getMemorySettings();
    expect(validateExportGates(memory, [{ id: 'x', element_category: 'terra' }], []).ok).toBe(true);
    vi.useRealTimers();
  });
});
