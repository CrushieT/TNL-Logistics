import { createShipmentOptionRequestCoordinator } from './shipmentOptionsFlow.mjs';

export const WAYBILL_OPTION_PAGE_SIZE = 20;
export const WAYBILL_RECOMMENDATION_SIZE = 8;
export const WAYBILL_SEARCH_MIN_LENGTH = 2;
export const WAYBILL_SEARCH_DEBOUNCE_MS = 250;

export function normalizeWaybillSearch(value) {
  return String(value || '').trim().toUpperCase();
}

export function buildWaybillOptionParams({
  page = 0,
  size = WAYBILL_OPTION_PAGE_SIZE,
  search = '',
  status = 'SENT_TO_HAULER'
} = {}) {
  const parsedPage = Number.parseInt(page, 10);
  const parsedSize = Number.parseInt(size, 10);
  const normalizedSearch = normalizeWaybillSearch(search);
  return {
    page: Number.isNaN(parsedPage) ? 0 : Math.max(0, parsedPage),
    size: Number.isNaN(parsedSize) ? WAYBILL_OPTION_PAGE_SIZE : Math.min(100, Math.max(1, parsedSize)),
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
    ...(status ? { status } : {})
  };
}

export function appendUniqueWaybillOptions(existing = [], incoming = []) {
  const merged = [];
  const seenWaybillIds = new Set();
  for (const option of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    const waybillId = option?.waybillId;
    if (!waybillId || seenWaybillIds.has(waybillId)) continue;
    seenWaybillIds.add(waybillId);
    merged.push(option);
  }
  return merged;
}

export function hasNextWaybillOptionPage(page) {
  if (!page || page.empty === true) return false;
  if (typeof page.last === 'boolean') return !page.last;
  const pageNumber = Number(page.number);
  const totalPages = Number(page.totalPages);
  return Number.isInteger(pageNumber) && Number.isInteger(totalPages) && pageNumber + 1 < totalPages;
}

export function createWaybillOptionRequestCoordinator() {
  return createShipmentOptionRequestCoordinator();
}
