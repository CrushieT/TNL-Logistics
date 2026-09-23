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
