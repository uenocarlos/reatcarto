/**
 * Owner editor is the only place that can load private map data.
 * Public/shared views never mount MapEditor with a valid session.
 */
export function canExportGis({ isAuthenticated = false, mapAuthError = false } = {}) {
  return Boolean(isAuthenticated) && !mapAuthError;
}
