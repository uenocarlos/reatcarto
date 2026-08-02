const API_BASE_URL = '/php';

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
      error.fields || {}
    );
  }

  return payload;
}

export { API_BASE_URL };
