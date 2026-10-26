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

export function generatePaginationItems(activePage, totalPages, jumpStep = 5) {
  const safeTotalPages = Number.isInteger(totalPages) && totalPages > 0 ? totalPages : 1;
  const safeActivePage = Number.isInteger(activePage)
    ? Math.min(Math.max(0, activePage), safeTotalPages - 1)
    : 0;

  if (safeTotalPages <= 7) {
    return Array.from({ length: safeTotalPages }, (_, pageIndex) => ({
      type: 'page',
      pageIndex,
      pageNumber: pageIndex + 1,
      label: String(pageIndex + 1),
      isCurrent: pageIndex === safeActivePage,
      isEllipsis: false,
      coveredPageIndices: [pageIndex],
      key: `page-${pageIndex}`,
    }));
  }

  const createRange = (start, end) => {
    const range = [];
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  };

  if (safeActivePage <= 3) {
    const items = [0, 1, 2, 3, 4].map((pageIndex) => ({
      type: 'page',
      pageIndex,
      pageNumber: pageIndex + 1,
      label: String(pageIndex + 1),
      isCurrent: pageIndex === safeActivePage,
      isEllipsis: false,
      coveredPageIndices: [pageIndex],
      key: `page-${pageIndex}`,
    }));

    items.push({
      type: 'ellipsis',
      ellipsisDirection: 'right',
      pageIndex: Math.min(safeTotalPages - 1, safeActivePage + jumpStep),
      pageNumber: null,
      label: '...',
      isCurrent: false,
      isEllipsis: true,
      coveredPageIndices: createRange(5, safeTotalPages - 2),
      key: 'ellipsis-right',
    });

    items.push({
      type: 'page',
      pageIndex: safeTotalPages - 1,
      pageNumber: safeTotalPages,
      label: String(safeTotalPages),
      isCurrent: false,
      isEllipsis: false,
      coveredPageIndices: [safeTotalPages - 1],
      key: `page-${safeTotalPages - 1}`,
    });

    return items;
  }

  if (safeActivePage >= safeTotalPages - 4) {
    const items = [
      {
        type: 'page',
        pageIndex: 0,
        pageNumber: 1,
        label: '1',
        isCurrent: false,
        isEllipsis: false,
        coveredPageIndices: [0],
        key: 'page-0',
      },
      {
        type: 'ellipsis',
        ellipsisDirection: 'left',
        pageIndex: Math.max(0, safeActivePage - jumpStep),
        pageNumber: null,
        label: '...',
        isCurrent: false,
        isEllipsis: true,
        coveredPageIndices: createRange(1, safeTotalPages - 6),
        key: 'ellipsis-left',
      },
    ];

    for (let pageIndex = safeTotalPages - 5; pageIndex < safeTotalPages; pageIndex++) {
      items.push({
        type: 'page',
        pageIndex,
        pageNumber: pageIndex + 1,
        label: String(pageIndex + 1),
        isCurrent: pageIndex === safeActivePage,
        isEllipsis: false,
        coveredPageIndices: [pageIndex],
        key: `page-${pageIndex}`,
      });
    }

    return items;
  }

  return [
    {
      type: 'page',
      pageIndex: 0,
      pageNumber: 1,
      label: '1',
      isCurrent: false,
      isEllipsis: false,
      coveredPageIndices: [0],
      key: 'page-0',
    },
    {
      type: 'ellipsis',
      ellipsisDirection: 'left',
      pageIndex: Math.max(0, safeActivePage - jumpStep),
      pageNumber: null,
      label: '...',
      isCurrent: false,
      isEllipsis: true,
      coveredPageIndices: createRange(1, safeActivePage - 2),
      key: 'ellipsis-left',
    },
    {
      type: 'page',
      pageIndex: safeActivePage - 1,
      pageNumber: safeActivePage,
      label: String(safeActivePage),
      isCurrent: false,
      isEllipsis: false,
      coveredPageIndices: [safeActivePage - 1],
      key: `page-${safeActivePage - 1}`,
    },
    {
      type: 'page',
      pageIndex: safeActivePage,
      pageNumber: safeActivePage + 1,
      label: String(safeActivePage + 1),
      isCurrent: true,
      isEllipsis: false,
      coveredPageIndices: [safeActivePage],
      key: `page-${safeActivePage}`,
    },
    {
      type: 'page',
      pageIndex: safeActivePage + 1,
      pageNumber: safeActivePage + 2,
      label: String(safeActivePage + 2),
      isCurrent: false,
      isEllipsis: false,
      coveredPageIndices: [safeActivePage + 1],
      key: `page-${safeActivePage + 1}`,
    },
    {
      type: 'ellipsis',
      ellipsisDirection: 'right',
      pageIndex: Math.min(safeTotalPages - 1, safeActivePage + jumpStep),
      pageNumber: null,
      label: '...',
      isCurrent: false,
      isEllipsis: true,
      coveredPageIndices: createRange(safeActivePage + 2, safeTotalPages - 2),
      key: 'ellipsis-right',
    },
    {
      type: 'page',
      pageIndex: safeTotalPages - 1,
      pageNumber: safeTotalPages,
      label: String(safeTotalPages),
      isCurrent: false,
      isEllipsis: false,
      coveredPageIndices: [safeTotalPages - 1],
      key: `page-${safeTotalPages - 1}`,
    },
  ];
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
  const paginationItems = generatePaginationItems(activePage, totalPages);

  return {
    activePage,
    endIndex,
    errorPageIndices,
    offPageErrorUnitIndices,
    paginationItems,
    startIndex,
    totalPages,
    totalUnits,
    visibleParcels,
  };
}
