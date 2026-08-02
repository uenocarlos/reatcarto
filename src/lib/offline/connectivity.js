/** @returns {boolean} */
export function isOnline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  return true;
}

export function onConnectivityChange(callback) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = () => callback(isOnline());
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}
