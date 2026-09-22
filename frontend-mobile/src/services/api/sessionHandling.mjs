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

export function classifySessionFailure(error, currentToken) {
  const status = error?.response?.status;
  const code = error?.response?.data?.code;
  const config = error?.config || {};

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

export function sanitizeSensitiveError(error) {
  const responseData = error?.response?.data || {};
  const sensitiveValues = collectSensitiveValues(error?.config);
  const serverMessage = typeof responseData.message === 'string'
    ? responseData.message
    : 'The request could not be completed.';
  const containsSensitiveValue = sensitiveValues.some((value) => serverMessage.includes(value));

  return {
    status: error?.response?.status || null,
    code: typeof responseData.code === 'string' ? responseData.code : null,
    message: containsSensitiveValue ? 'The request could not be completed.' : serverMessage,
    retryAfterSeconds: Number.isFinite(responseData.retryAfterSeconds)
      ? responseData.retryAfterSeconds
      : null,
  };
}
