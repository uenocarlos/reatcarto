import { Capacitor } from '@capacitor/core';

export const NATIVE_API_BASE_URL = 'https://reatcarto.furg.br:8443/php';
const API_BASE_URL = Capacitor.isNativePlatform() ? NATIVE_API_BASE_URL : '/php';
const NATIVE_ORIGIN = NATIVE_API_BASE_URL.replace(/\/php\/?$/, '');

/** Absolute URL for PHP media and public static assets (icons, photos, videos). */
export function resolveApiAssetUrl(pathOrUrl) {
  const value = String(pathOrUrl ?? '').trim();
  if (!value || /^https?:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  if (value.startsWith('/php/')) {
    return Capacitor.isNativePlatform() ? `${NATIVE_ORIGIN}${value}` : value;
  }
  if (value.startsWith('/icons/')) {
    const assetPath = `/assets${value}`;
    return Capacitor.isNativePlatform() ? `${NATIVE_ORIGIN}${assetPath}` : assetPath;
  }
  if (Capacitor.isNativePlatform() && value.startsWith('/')) {
    return `${NATIVE_ORIGIN}${value}`;
  }
  return value;
}

export class ApiError extends Error {
  constructor(code, message, status, fields = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers = {
    Accept: 'application/json',
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      body:
        options.body && typeof options.body === 'object' && !(options.body instanceof FormData)
          ? JSON.stringify(options.body)
          : options.body,
    });
  } catch {
    throw new ApiError('network_error', 'Network request failed.', 0);
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(
      error.code || 'unknown_error',
      error.message || 'Request failed.',
      response.status,
      error.fields && typeof error.fields === 'object' ? error.fields : {}
    );
  }

  if (!isJson || payload === null) {
    throw new ApiError('network_error', 'Network request failed.', response.status);
  }

  return payload;
}

export { API_BASE_URL };

