export function createTrackingHistoryRequestCoordinator() {
  let generation = 0;
  let pageZeroToken = null;
  let paginationToken = null;

  function createRequestToken(kind) {
    const controller = new AbortController();
    return {
      kind,
      generation,
      controller,
      signal: controller.signal,
    };
  }

  function abortRequest(requestToken) {
    requestToken?.controller.abort();
  }

  function beginPageZero() {
    abortRequest(pageZeroToken);
    abortRequest(paginationToken);
    pageZeroToken = null;
    paginationToken = null;
    generation += 1;

    pageZeroToken = createRequestToken('PAGE_ZERO');
    return pageZeroToken;
  }

  function beginPagination() {
    if (pageZeroToken || paginationToken) return null;

    paginationToken = createRequestToken('PAGINATION');
    return paginationToken;
  }

  function isCurrent(requestToken) {
    if (!requestToken || requestToken.signal.aborted || requestToken.generation !== generation) {
      return false;
    }

    if (requestToken.kind === 'PAGE_ZERO') {
      return pageZeroToken === requestToken;
    }
    if (requestToken.kind === 'PAGINATION') {
      return paginationToken === requestToken;
    }
    return false;
  }

  function finish(requestToken) {
    if (requestToken?.kind === 'PAGE_ZERO' && pageZeroToken === requestToken) {
      pageZeroToken = null;
      return true;
    }
    if (requestToken?.kind === 'PAGINATION' && paginationToken === requestToken) {
      paginationToken = null;
      return true;
    }
    return false;
  }

  function cancelAll() {
    abortRequest(pageZeroToken);
    abortRequest(paginationToken);
    pageZeroToken = null;
    paginationToken = null;
    generation += 1;
  }

  return {
    beginPageZero,
    beginPagination,
    isCurrent,
    finish,
    cancelAll,
  };
}
