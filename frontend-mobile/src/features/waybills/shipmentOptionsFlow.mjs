export const SHIPMENT_OPTION_PAGE_SIZE = 20;
export const SHIPMENT_RECOMMENDATION_SIZE = 8;
export const SHIPMENT_SEARCH_MIN_LENGTH = 2;
export const SHIPMENT_SEARCH_DEBOUNCE_MS = 250;

export function normalizeShipmentSearch(value) {
  return String(value || '').trim().toUpperCase();
}

export function buildShipmentOptionParams({
  page = 0,
  size = SHIPMENT_OPTION_PAGE_SIZE,
  search = ''
} = {}) {
  const parsedPage = Number.parseInt(page, 10);
  const parsedSize = Number.parseInt(size, 10);
  const normalizedSearch = normalizeShipmentSearch(search);
  return {
    page: Number.isNaN(parsedPage) ? 0 : Math.max(0, parsedPage),
    size: Number.isNaN(parsedSize) ? SHIPMENT_OPTION_PAGE_SIZE : Math.min(100, Math.max(1, parsedSize)),
    ...(normalizedSearch ? { search: normalizedSearch } : {})
  };
}

export function appendUniqueShipmentOptions(existing = [], incoming = []) {
  const merged = [];
  const seenShipmentIds = new Set();

  for (const option of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    const shipmentId = option?.shipmentId;
    if (!shipmentId || seenShipmentIds.has(shipmentId)) continue;
    seenShipmentIds.add(shipmentId);
    merged.push(option);
  }

  return merged;
}

export function hasNextShipmentOptionPage(page) {
  if (!page || page.empty === true) return false;
  if (typeof page.last === 'boolean') return !page.last;
  const pageNumber = Number(page.number);
  const totalPages = Number(page.totalPages);
  return Number.isInteger(pageNumber) && Number.isInteger(totalPages) && pageNumber + 1 < totalPages;
}

export function createShipmentOptionRequestCoordinator() {
  let recentGeneration = 0;
  let recommendationGeneration = 0;
  let firstPageToken = null;
  let nextPageToken = null;
  let recommendationToken = null;

  function abortToken(token) {
    token?.controller.abort();
  }

  function createToken(kind, generation, query = '') {
    const controller = new AbortController();
    return { kind, generation, query, controller, signal: controller.signal };
  }

  function beginFirstPage() {
    abortToken(firstPageToken);
    abortToken(nextPageToken);
    firstPageToken = null;
    nextPageToken = null;
    recentGeneration += 1;
    firstPageToken = createToken('FIRST_PAGE', recentGeneration);
    return firstPageToken;
  }

  function beginNextPage() {
    if (firstPageToken || nextPageToken) return null;
    nextPageToken = createToken('NEXT_PAGE', recentGeneration);
    return nextPageToken;
  }

  function beginRecommendation(query) {
    abortToken(recommendationToken);
    recommendationGeneration += 1;
    recommendationToken = createToken(
      'RECOMMENDATION',
      recommendationGeneration,
      normalizeShipmentSearch(query)
    );
    return recommendationToken;
  }

  function isCurrent(token) {
    if (!token || token.signal.aborted) return false;
    if (token.kind === 'FIRST_PAGE') {
      return token === firstPageToken && token.generation === recentGeneration;
    }
    if (token.kind === 'NEXT_PAGE') {
      return token === nextPageToken && token.generation === recentGeneration;
    }
    if (token.kind === 'RECOMMENDATION') {
      return token === recommendationToken && token.generation === recommendationGeneration;
    }
    return false;
  }

  function finish(token) {
    if (token?.kind === 'FIRST_PAGE' && token === firstPageToken) {
      firstPageToken = null;
      return true;
    }
    if (token?.kind === 'NEXT_PAGE' && token === nextPageToken) {
      nextPageToken = null;
      return true;
    }
    if (token?.kind === 'RECOMMENDATION' && token === recommendationToken) {
      recommendationToken = null;
      return true;
    }
    return false;
  }

  function cancelRecommendations() {
    abortToken(recommendationToken);
    recommendationToken = null;
    recommendationGeneration += 1;
  }

  function cancelAll() {
    abortToken(firstPageToken);
    abortToken(nextPageToken);
    abortToken(recommendationToken);
    firstPageToken = null;
    nextPageToken = null;
    recommendationToken = null;
    recentGeneration += 1;
    recommendationGeneration += 1;
  }

  return {
    beginFirstPage,
    beginNextPage,
    beginRecommendation,
    isCurrent,
    finish,
    cancelRecommendations,
    cancelAll
  };
}
