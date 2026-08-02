import {
  createDebouncedExportSettingsPersist,
  defaultExportSettings,
  exportSettingsEqual,
  normalizeExportSettings,
  pruneExportSettings,
} from './exportSettings';

/**
 * Per-map export settings session store with debounced persist and flush on close/export.
 * @param {{ mapId: string, persist: (settings: import('./exportSettings').ExportSettings) => Promise<unknown>, delayMs?: number }} options
 */
export function createExportSettingsStore({ mapId, persist, delayMs = 500 }) {
  /** @type {string|null} */
  let activeMapId = mapId ?? null;
  /** @type {import('./exportSettings').ExportSettings} */
  let settings = defaultExportSettings();
  const debouncer = createDebouncedExportSettingsPersist({ persist, delayMs });

  function hydrate(newMapId, rawSettings, elements = []) {
    if (!newMapId) return settings;
    activeMapId = newMapId;
    settings = pruneExportSettings(normalizeExportSettings(rawSettings ?? {}), elements);
    return settings;
  }

  function updateSettings(partial, elements = []) {
    const previous = settings;
    settings = pruneExportSettings(
      normalizeExportSettings({ ...settings, ...partial }),
      elements
    );
    if (!exportSettingsEqual(previous, settings)) {
      debouncer.setSettings(settings);
    }
    return settings;
  }

  function getSettings() {
    return settings;
  }

  function getActiveMapId() {
    return activeMapId;
  }

  async function flush() {
    await debouncer.flush();
  }

  return {
    hydrate,
    updateSettings,
    getSettings,
    getActiveMapId,
    flush,
    getMemorySettings: () => debouncer.getMemorySettings(),
  };
}

/**
 * Selector keyed by mapId — switching maps must not leak prior settings.
 * @param {Map<string, ReturnType<typeof createExportSettingsStore>>} registry
 * @param {string} mapId
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} rawSettings
 * @param {Array<Record<string, unknown>>} elements
 */
export function loadSettingsForMap(registry, mapId, rawSettings, elements = []) {
  if (!registry.has(mapId)) {
    registry.set(
      mapId,
      createExportSettingsStore({
        mapId,
        persist: async () => {},
      })
    );
  }
  const store = registry.get(mapId);
  return store.hydrate(mapId, rawSettings, elements);
}
