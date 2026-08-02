import { normalizeExportSettings } from './exportSettings';

const DEFAULT_STATE_COLOR = '#1D4ED8';
const DEFAULT_MUNICIPALITY_COLOR = '#DC2626';
const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/;

/**
 * @param {string} raw
 * @param {string} fallback
 */
export function normalizeLocationColor(raw, fallback) {
  if (typeof raw === 'string' && HEX_COLOR.test(raw.trim())) {
    return raw.trim();
  }
  return fallback;
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 */
export function normalizeLocationSettings(settings) {
  const normalized = normalizeExportSettings(settings);
  return {
    ...normalized,
    stateColor: normalizeLocationColor(normalized.stateColor, DEFAULT_STATE_COLOR),
    municipalityColor: normalizeLocationColor(normalized.municipalityColor, DEFAULT_MUNICIPALITY_COLOR),
  };
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 */
export function isLocationSelectionComplete(settings) {
  const normalized = normalizeLocationSettings(settings);
  if (normalized.locatorCount === 0) return true;
  return Boolean(normalized.stateCode && normalized.municipalityCode);
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 */
export function isLocationFeatureActive(settings) {
  const normalized = normalizeLocationSettings(settings);
  if (normalized.locatorCount === 0) return false;
  return Boolean(normalized.stateCode && normalized.municipalityCode);
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {ReturnType<typeof getLocatorGeometries>|null} [boundaryResult]
 */
export function buildLocatorInsetDescriptors(settings, boundaryResult = null) {
  const normalized = normalizeLocationSettings(settings);
  if (normalized.locatorCount === 0 || !isLocationSelectionComplete(normalized)) {
    return [];
  }

  const descriptors = [];
  if (normalized.locatorCount === 2) {
    descriptors.push({
      id: 'inset-sa-context',
      kind: 'sa-context',
      geometry: boundaryResult?.saContextGeometry ?? null,
      stateGeometry: boundaryResult?.stateGeometry ?? null,
    });
  }
  if (normalized.locatorCount >= 1) {
    descriptors.push({
      id: 'inset-state-muni',
      kind: 'state-muni',
      stateGeometry: boundaryResult?.stateGeometry ?? null,
      municipalityGeometry: boundaryResult?.municipalityGeometry ?? null,
    });
  }
  return descriptors;
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {{ stateName?: string, municipalityName?: string }} [labels]
 */
export function buildLocationLegendItems(settings, labels = {}) {
  const normalized = normalizeLocationSettings(settings);
  if (!isLocationFeatureActive(normalized)) return [];

  /** @type {Array<{ id: string, label: string, color: string, kind: string }>} */
  const items = [];

  if (normalized.showStateInLegend && normalized.stateCode) {
    items.push({
      id: `loc-state-${normalized.stateCode}`,
      label: labels.stateName ? `UF: ${labels.stateName}` : `UF (${normalized.stateCode})`,
      color: normalized.stateColor,
      kind: 'location-state',
    });
  }
  if (normalized.showMunicipalityInLegend && normalized.municipalityCode) {
    items.push({
      id: `loc-muni-${normalized.municipalityCode}`,
      label: labels.municipalityName ? `Município: ${labels.municipalityName}` : `Município (${normalized.municipalityCode})`,
      color: normalized.municipalityColor,
      kind: 'location-municipality',
    });
  }
  if (normalized.showMunicipalMesh && normalized.stateCode) {
    items.push({
      id: `loc-mesh-${normalized.stateCode}`,
      label: 'Malha municipal',
      color: normalized.municipalityColor,
      kind: 'location-mesh',
    });
  }
  return items;
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {ReturnType<typeof getLocatorGeometries>|null} [boundaryResult]
 */
export function buildLocationOverlayModel(settings, boundaryResult = null) {
  const normalized = normalizeLocationSettings(settings);
  if (normalized.locatorCount === 0 || !isLocationSelectionComplete(normalized)) {
    return {
      outline: null,
      mesh: null,
      meshError: false,
      orphanFree: true,
    };
  }

  const meshFailed = Boolean(normalized.showMunicipalMesh && boundaryResult && !boundaryResult.municipalMesh);

  return {
    outline: {
      geometry: boundaryResult?.municipalityGeometry ?? null,
      color: normalized.municipalityColor,
      municipalityCode: normalized.municipalityCode,
    },
    mesh:
      normalized.showMunicipalMesh && boundaryResult?.municipalMesh
        ? {
            geometry: boundaryResult.municipalMesh,
            color: normalized.municipalityColor,
          }
        : null,
    meshError: meshFailed,
    orphanFree: true,
  };
}

/**
 * @param {string} query
 * @param {Array<{ code: string, name: string }>} municipalities
 */
export function filterMunicipalities(query, municipalities) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return municipalities ?? [];
  return (municipalities ?? []).filter(
    (item) => item.name.toLowerCase().includes(q) || item.code.includes(q)
  );
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {Array<{ code: string }>} states
 * @param {Array<{ code: string }>} municipalities
 */
export function reconcileLocationSettings(settings, states = [], municipalities = []) {
  const normalized = normalizeLocationSettings(settings);
  const stateCodes = new Set(states.map((s) => String(s.code)));
  const muniCodes = new Set(municipalities.map((m) => String(m.code)));

  let { stateCode, municipalityCode } = normalized;
  if (stateCode && !stateCodes.has(String(stateCode))) {
    stateCode = null;
    municipalityCode = null;
  }
  if (municipalityCode && !muniCodes.has(String(municipalityCode))) {
    municipalityCode = null;
  }

  return {
    ...normalized,
    stateCode,
    municipalityCode,
  };
}

/**
 * @param {string|null} municipalityCode
 * @param {string|null} stateCode
 * @param {Array<{ code: string }>} municipalitiesForState
 */
export function validateMunicipalityForState(municipalityCode, stateCode, municipalitiesForState) {
  if (!municipalityCode || !stateCode) return false;
  return municipalitiesForState.some((m) => String(m.code) === String(municipalityCode));
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {string|null} nextStateCode
 */
export function applyStateChange(settings, nextStateCode) {
  const normalized = normalizeLocationSettings(settings);
  const changed = String(normalized.stateCode ?? '') !== String(nextStateCode ?? '');
  return {
    stateCode: nextStateCode || null,
    municipalityCode: changed ? null : normalized.municipalityCode,
  };
}

/**
 * Merge element legend items with location legend entries for gates/preview.
 * @param {Array<Record<string, unknown>>} elementItems
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {{ stateName?: string, municipalityName?: string }} [labels]
 */
export function mergeLegendItems(elementItems, settings, labels = {}) {
  return [...(elementItems ?? []), ...buildLocationLegendItems(settings, labels)];
}
