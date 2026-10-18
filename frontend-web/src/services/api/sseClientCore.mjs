/**
 * Pure parser for W3C Server-Sent Events streams.
 * Handles event framing, JSON payload decoding, multi-chunk buffering,
 * and comment skipping (e.g. :keepalive) with zero external dependencies.
 */
export function createSseStreamParser(onEvent) {
  let buffer = '';
  let currentEvent = 'message';
  let currentData = '';

  function feed(chunk) {
    buffer += chunk;
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith(':')) {
        // Heartbeat or comment line; skip
        continue;
      }

      if (line === '') {
        if (currentData) {
          let parsedData = currentData;
          try {
            parsedData = JSON.parse(currentData);
          } catch (_) {
            // Raw text payload
          }
          onEvent(currentEvent, parsedData);
        }
        currentEvent = 'message';
        currentData = '';
        continue;
      }

      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const dataChunk = line.slice(5).trim();
        currentData = currentData ? `${currentData}\n${dataChunk}` : dataChunk;
      }
    }
  }

  function reset() {
    buffer = '';
    currentEvent = 'message';
    currentData = '';
  }

  return { feed, reset };
}

/**
 * Calculate exponential backoff with small jitter and a 30-second ceiling.
 * Schedule: 1s, 2s, 4s, 8s, 16s, then 30s ceiling.
 *
 * @param {number} attempt - Zero-based attempt count
 * @param {number} [randomFactor=0.5] - Random factor between 0 and 1 for deterministic testing
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoffDelay(attempt, randomFactor = 0.5) {
  const baseDelays = [1000, 2000, 4000, 8000, 16000];
  const base = attempt < baseDelays.length ? baseDelays[attempt] : 30000;
  const jitter = Math.floor(randomFactor * 250);
  return Math.min(30000, base + jitter);
}

/**
 * Check if HTTP status represents an unrecoverable authorization failure.
 *
 * @param {number} status
 * @returns {boolean}
 */
export function isAuthFailureStatus(status) {
  return status === 401 || status === 403;
}

