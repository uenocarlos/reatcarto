export const MOBILE_BREAKPOINT = 768;

/** Menor dimensão da viewport — estável ao rotacionar o telefone. */
export function getViewportMinDimension() {
  if (typeof window === 'undefined') return MOBILE_BREAKPOINT;
  return Math.min(window.innerWidth, window.innerHeight);
}

export function isMobileViewport() {
  return getViewportMinDimension() < MOBILE_BREAKPOINT;
}

export function isPortraitViewport() {
  if (typeof window === 'undefined') return true;
  return window.innerHeight >= window.innerWidth;
}

export async function lockScreenOrientation(mode) {
  if (typeof screen === 'undefined' || !screen.orientation?.lock) return false;
  try {
    await screen.orientation.lock(mode);
    return true;
  } catch {
    return false;
  }
}

export function unlockScreenOrientation() {
  try {
    screen?.orientation?.unlock?.();
  } catch {
    // Alguns navegadores bloqueiam unlock fora de fullscreen/PWA.
  }
}
