/** Fixed desktop composition widths used for offscreen capture (independent of viewport). */
export const EXPORT_COMPOSITION_LANDSCAPE_WIDTH = 960;
export const EXPORT_COMPOSITION_PORTRAIT_WIDTH = 720;
export const EXPORT_COMPOSITION_MAP_HEIGHT = 420;
export const EXPORT_COMPOSITION_LOCATION_INSET_SIZE = 162;

/**
 * @param {{ orientation?: 'landscape'|'portrait' }} session
 * @returns {number}
 */
export function getFixedCompositionWidth(session) {
  return session?.orientation === 'portrait'
    ? EXPORT_COMPOSITION_PORTRAIT_WIDTH
    : EXPORT_COMPOSITION_LANDSCAPE_WIDTH;
}

/**
 * Inline style vars for a fixed-desktop composition host.
 * @param {{ orientation?: 'landscape'|'portrait' }} session
 */
export function getFixedCompositionStyle(session) {
  return {
    '--export-fixed-width': `${getFixedCompositionWidth(session)}px`,
    '--export-location-inset-size': `${EXPORT_COMPOSITION_LOCATION_INSET_SIZE}px`,
  };
}
