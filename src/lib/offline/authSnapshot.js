const AUTH_SNAPSHOT_KEY = 'reatcarto:auth-snapshot';

/** @param {unknown} user */
export function isUsableAuthSnapshot(user) {
  return Boolean(user && typeof user === 'object' && user.id);
}

/**
 * Keep the local session unless the user tapped Sair.
 * Network errors and even 401 must not drop a stored account on Android.
 * @param {unknown} snapshot
 */
export function shouldKeepLocalSession(snapshot) {
  return isUsableAuthSnapshot(snapshot);
}

export function saveAuthSnapshot(user) {
  if (typeof localStorage === 'undefined' || !isUsableAuthSnapshot(user)) return;
  localStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(user));
}

export function loadAuthSnapshot() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_SNAPSHOT_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    return isUsableAuthSnapshot(user) ? user : null;
  } catch {
    return null;
  }
}

export function clearAuthSnapshot() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(AUTH_SNAPSHOT_KEY);
}
