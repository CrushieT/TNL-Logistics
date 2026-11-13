const SESSION_REAUTH_REQUIRED = 'SESSION_REAUTH_REQUIRED';
const INVALID_DEVICE_CREDENTIALS = 'INVALID_DEVICE_CREDENTIALS';

function readHeader(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name);
  const matchingKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return matchingKey ? headers[matchingKey] : undefined;
}

export function extractBearerToken(config) {
  const authorization = readHeader(config?.headers, 'Authorization');
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  return authorization.slice(7);
}

export function classifySessionFailure(error, currentToken, currentSession) {
  const status = error?.response?.status;
  const code = error?.response?.data?.code;
  const config = error?.config || {};

  if (currentSession && config._sessionGeneration !== currentSession.generation) return { action: 'none' };

  if (config.skipAuth || status !== 401) return { action: 'none' };

  if (code === SESSION_REAUTH_REQUIRED) {
    const requestToken = extractBearerToken(config);
    if (currentToken && requestToken && currentToken !== requestToken && !config._sessionRetryAttempted) {
      return { action: 'retry' };
    }
    return { action: 'reauthenticate' };
  }

  if (code === INVALID_DEVICE_CREDENTIALS) return { action: 'clear-device' };
  return { action: 'none' };
}

export function buildSessionRetryConfig(config, currentToken) {
  return {
    ...config,
    headers: {
      ...(config?.headers || {}),
      Authorization: `Bearer ${currentToken}`,
    },
    _sessionRetryAttempted: true,
  };
}

function collectSensitiveValues(config) {
  const values = [];
  const authorization = readHeader(config?.headers, 'Authorization');
  const deviceToken = readHeader(config?.headers, 'X-Device-Token');
  if (authorization) values.push(String(authorization), String(authorization).replace(/^Bearer\s+/i, ''));
  if (deviceToken) values.push(String(deviceToken));

  let data = config?.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      data = null;
    }
  }
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (/password|pin|token/i.test(key) && typeof value === 'string' && value) {
        values.push(value);
      }
    }
  }
  return values.filter((value) => value.length > 0);
}

export function normalizeApiUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }
  let normalized = rawUrl.trim();
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized.endsWith('/api/v1')) {
    if (normalized.endsWith('/api')) {
      normalized = `${normalized}/v1`;
    } else {
      normalized = `${normalized}/api/v1`;
    }
  }
  return normalized;
}

function resolveStatusFallbackMessage(status) {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your inputs and try again.';
    case 401:
      return 'Invalid username or password. Please verify your credentials and try again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource could not be found.';
    case 409:
      return 'The request could not be completed due to a conflict.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'The server is temporarily unavailable. Please try again later.';
    default:
      return 'Unable to complete request. Please try again.';
  }
}

export function sanitizeSensitiveError(error) {
  let responseData = error?.response?.data || {};
  if (typeof responseData === 'string') {
    try {
      responseData = JSON.parse(responseData);
    } catch {
      responseData = { message: responseData };
    }
  }
  const sensitiveValues = collectSensitiveValues(error?.config);
  const isNetworkFailure =
    error?.code === 'ERR_NETWORK' ||
    error?.message === 'Network Error' ||
    error?.response?.status === 0;

  const status = typeof error?.response?.status === 'number' && error.response.status > 0
    ? error.response.status
    : null;

  const isTechnicalErrorMessage = (msg) =>
    typeof msg === 'string' &&
    (/Request failed with status code \d{3}/i.test(msg) || /^HTTP \d{3}/i.test(msg));

  const serverMessageCandidate =
    typeof responseData.message === 'string' && responseData.message.trim()
      ? responseData.message.trim()
      : typeof responseData.error === 'string' && responseData.error.trim()
        ? responseData.error.trim()
        : null;

  const rawMessage = serverMessageCandidate && !isTechnicalErrorMessage(serverMessageCandidate)
    ? serverMessageCandidate
    : isNetworkFailure
      ? 'Network error. Please verify your connection to the server.'
      : status !== null
        ? resolveStatusFallbackMessage(status)
        : typeof error?.message === 'string' && error.message.trim() && !isTechnicalErrorMessage(error.message)
          ? error.message.trim()
          : 'The request could not be completed.';
  const serverMessage = rawMessage;
  const containsSensitiveValue = sensitiveValues.some((value) => serverMessage.includes(value));

  const retryAfter = readHeader(error?.response?.headers, 'Retry-After');
  let retryAfterSeconds = null;
  if (typeof retryAfter === 'string' || typeof retryAfter === 'number') {
    const text = String(retryAfter).trim();
    if (/^\d+$/.test(text)) {
      retryAfterSeconds = Math.max(0, Number(text));
    } else {
      const deadline = Date.parse(text);
      if (Number.isFinite(deadline)) retryAfterSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    }
  }

  const rawCode = typeof responseData.code === 'string'
    ? responseData.code
    : typeof error?.code === 'string'
      ? error.code
      : null;

  return {
    status: error?.response?.status || null,
    code: containsSensitiveValue ? null : rawCode,
    message: containsSensitiveValue ? 'The request could not be completed.' : serverMessage,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds
      : Number.isFinite(responseData.retryAfterSeconds) ? Math.max(0, responseData.retryAfterSeconds) : null,
  };
}
