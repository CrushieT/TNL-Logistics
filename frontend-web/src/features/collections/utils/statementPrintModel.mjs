import { hasValidSoaBankDetails } from '../../settings/utils/soaBankDetails.mjs';

export const STATEMENT_PRINT_COPY_COUNT = 2;
export const ITEMS_PER_PAGE = 11;

export function paginateStatementItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return [[]];
  }

  const pages = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    pages.push(items.slice(i, i + ITEMS_PER_PAGE));
  }

  return pages;
}

export function buildStatementPrintUrl(clientId, cycle) {
  const query = new URLSearchParams({ clientId: String(clientId ?? '') });
  if (cycle) {
    query.set('cycle', String(cycle));
  }
  return `/statements/print?${query.toString()}`;
}

function normalizeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : null;
}

export function hasUnsavedStatementAdjustments(statement, adjustments = {}) {
  if (!statement) return true;

  return normalizeAmount(adjustments.deductionAmount) !== normalizeAmount(statement.deductionAmount)
    || String(adjustments.deductionNote ?? '').trim() !== String(statement.deductionNote ?? '').trim()
    || String(adjustments.collectedBy ?? '').trim() !== String(statement.collectedBy ?? '').trim();
}

export function getStatementPrintBlockReason(statement) {
  if (!statement) {
    return 'Load a saved Statement of Account before printing.';
  }
  if (!statement.isSaved) {
    return 'Save the Statement of Account before printing.';
  }
  if (!hasValidSoaBankDetails(statement)) {
    return 'SOA bank details are incomplete or invalid. Configure them in System Settings before printing.';
  }
  return null;
}

export function createStatementPrintSheetSequence(paginatedPages, copies = STATEMENT_PRINT_COPY_COUNT) {
  const pages = Array.isArray(paginatedPages) && paginatedPages.length > 0 ? paginatedPages : [[]];
  const copyCount = Math.max(1, Number.isInteger(copies) ? copies : 1);

  return Array.from({ length: copyCount }, (_, copyIndex) => (
    pages.map((pageItems, pageIndex) => ({
      copyIndex,
      pageIndex,
      pageNumber: pageIndex + 1,
      totalPages: pages.length,
      isFirstPage: pageIndex === 0,
      isLastPage: pageIndex === pages.length - 1,
      pageItems,
    }))
  )).flat();
}

export function waitForImageReady(uri, createImage) {
  if (!uri || typeof createImage !== 'function') {
    return Promise.resolve('failed');
  }

  return new Promise((resolve) => {
    const image = createImage();
    image.onload = () => resolve('loaded');
    image.onerror = () => resolve('failed');
    image.src = uri;
  });
}
