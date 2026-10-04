export const PARCEL_PAGE_SIZE = 10;

export function getParcelPageCount(totalUnits) {
  const normalizedTotal = Number.isInteger(totalUnits) && totalUnits > 0 ? totalUnits : 0;
  return Math.max(1, Math.ceil(normalizedTotal / PARCEL_PAGE_SIZE));
}

export function getParcelPageIndex(unitIndex) {
  const normalizedIndex = Number.isInteger(unitIndex) && unitIndex > 0 ? unitIndex : 0;
  return Math.floor(normalizedIndex / PARCEL_PAGE_SIZE);
}

export function clampParcelPage(requestedPage, totalUnits) {
  const normalizedPage = Number.isInteger(requestedPage) ? requestedPage : 0;
  return Math.min(Math.max(0, normalizedPage), getParcelPageCount(totalUnits) - 1);
}

export function createParcelPaginationModel(parcels = [], errors = {}, requestedPage = 0) {
  const safeParcels = Array.isArray(parcels) ? parcels : [];
  const totalUnits = safeParcels.length;
  const totalPages = getParcelPageCount(totalUnits);
  const activePage = clampParcelPage(requestedPage, totalUnits);
  const startIndex = activePage * PARCEL_PAGE_SIZE;
  const endIndex = Math.min(startIndex + PARCEL_PAGE_SIZE, totalUnits);
  const visibleParcels = safeParcels.slice(startIndex, endIndex).map((parcel, localIndex) => ({
    parcel,
    globalIndex: startIndex + localIndex,
  }));
  const errorUnitIndices = new Set();

  Object.keys(errors || {}).forEach((key) => {
    const match = key.match(/^parcels\[(\d+)\]\./);
    if (match) {
      errorUnitIndices.add(Number(match[1]));
    }
  });

  const sortedErrorUnitIndices = Array.from(errorUnitIndices).sort((left, right) => left - right);
  const offPageErrorUnitIndices = sortedErrorUnitIndices.filter(
    (unitIndex) => unitIndex < startIndex || unitIndex >= endIndex,
  );
  const errorPageIndices = new Set(sortedErrorUnitIndices.map(getParcelPageIndex));

  return {
    activePage,
    endIndex,
    errorPageIndices,
    offPageErrorUnitIndices,
    startIndex,
    totalPages,
    totalUnits,
    visibleParcels,
  };
}
