/** @typedef {'png'} ExportFormat */

/** @type {ExportFormat[]} */
export const EXPORT_FORMATS = ['png'];

/**
 * Whether the authenticated user may open the composition export flow for a map.
 * @param {{ isOwner?: boolean, mapId?: string|null }} params
 */
export function canOpenExport({ isOwner = false, mapId = null } = {}) {
  return Boolean(isOwner && mapId);
}

/**
 * Whether the export entry control should be interactable (vs loading/disabled).
 * @param {{ mapDataReady?: boolean, mapId?: string|null }} params
 */
export function isExportEntryReady({ mapDataReady = false, mapId = null } = {}) {
  return Boolean(mapId && mapDataReady);
}

/**
 * Whether the modal shell should mount (valid map id + owner).
 * @param {{ isOwner?: boolean, mapId?: string|null }} params
 */
export function shouldMountExportModal({ isOwner = false, mapId = null } = {}) {
  return canOpenExport({ isOwner, mapId });
}

/**
 * Non-owner / public surfaces must never reach a successful PNG export path.
 * @param {{ isOwner?: boolean, exportAttempted?: boolean }} params
 */
export function canAttemptPngExport({ isOwner = false, exportAttempted = false } = {}) {
  if (!isOwner) return false;
  return exportAttempted;
}
