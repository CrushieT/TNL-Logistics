const DEFAULT_PAGE_SIZE = 20;

export function buildWaybillListQuery({ page = 0, size = DEFAULT_PAGE_SIZE, search, status, client } = {}) {
  const query = new URLSearchParams();
  query.set('page', String(Math.max(0, Number(page) || 0)));
  query.set('size', String(Number(size) || DEFAULT_PAGE_SIZE));

  const normalizedSearch = search?.trim();
  if (normalizedSearch) query.set('search', normalizedSearch);
  if (status && status !== 'ALL') query.set('status', status);
  if (client && client !== 'ALL') query.set('client', client.trim());

  return query.toString();
}

export function normalizeWaybillPage(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  const metadata = data?.page || data || {};
  return {
    content,
    page: Number(metadata.number) || 0,
    pageSize: Number(metadata.size) || DEFAULT_PAGE_SIZE,
    totalPages: Math.max(1, Number(metadata.totalPages) || 1),
    totalElements: Number(metadata.totalElements) || 0,
  };
}

export function updateWaybillListState(state, changes) {
  const shouldResetPage = ['search', 'status', 'client', 'pageSize']
    .some((key) => Object.prototype.hasOwnProperty.call(changes, key));
  return {
    ...state,
    ...changes,
    page: shouldResetPage ? 0 : (changes.page ?? state.page),
  };
}

export function buildWaybillDetailRoute(waybillId) {
  return `/waybills/${encodeURIComponent(String(waybillId ?? ''))}`;
}
