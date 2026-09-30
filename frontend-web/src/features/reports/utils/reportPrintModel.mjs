const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const REPORT_PAGE_CONTENT_UNITS = 23;
const EXECUTIVE_SUMMARY_UNITS = 5;
const TABLE_HEADER_UNITS = 2;
const TABLE_ROW_UNITS = 1;
const SIGNATURE_UNITS = 4;

function getSingleValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function isValidIsoDate(value) {
  if (typeof value !== 'string') return false;

  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return parsedDate.getUTCFullYear() === year
    && parsedDate.getUTCMonth() === month - 1
    && parsedDate.getUTCDate() === day;
}

export function normalizeReportPrintParams(params = {}) {
  const startDate = getSingleValue(params.startDate);
  const endDate = getSingleValue(params.endDate);

  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    return {
      isValid: false,
      error: 'A valid report start date and end date are required.',
    };
  }

  if (startDate > endDate) {
    return {
      isValid: false,
      error: 'The report start date cannot be after the end date.',
    };
  }

  return { isValid: true, startDate, endDate };
}

export function buildReportPrintUrl(startDate, endDate) {
  return `/reports/print?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
}

function createPage({ showExecutiveSummary = false } = {}) {
  return {
    showExecutiveSummary,
    tableBlocks: [],
    showSignatures: false,
    usedUnits: showExecutiveSummary ? EXECUTIVE_SUMMARY_UNITS : 0,
  };
}

function appendTableSection(pages, section, rows) {
  let rowIndex = 0;

  while (rowIndex < rows.length) {
    let page = pages[pages.length - 1];
    let availableUnits = REPORT_PAGE_CONTENT_UNITS - page.usedUnits;

    if (availableUnits < TABLE_HEADER_UNITS + TABLE_ROW_UNITS) {
      page = createPage();
      pages.push(page);
      availableUnits = REPORT_PAGE_CONTENT_UNITS;
    }

    const availableRowCount = Math.max(
      1,
      Math.floor((availableUnits - TABLE_HEADER_UNITS) / TABLE_ROW_UNITS),
    );
    const pageRows = rows.slice(rowIndex, rowIndex + availableRowCount);

    page.tableBlocks.push({
      section,
      isContinuation: rowIndex > 0,
      rows: pageRows,
    });
    page.usedUnits += TABLE_HEADER_UNITS + (pageRows.length * TABLE_ROW_UNITS);
    rowIndex += pageRows.length;
  }
}

export function createPrintableReportModel(reportData = {}, requestedStartDate, requestedEndDate) {
  const clientRevenue = Array.isArray(reportData.clientRevenue)
    ? reportData.clientRevenue
    : [];
  const collectionItems = Array.isArray(reportData.collectionSummary?.items)
    ? reportData.collectionSummary.items
    : [];

  const pages = [createPage({ showExecutiveSummary: true })];
  appendTableSection(
    pages,
    'CLIENT_REVENUE',
    clientRevenue.length > 0 ? clientRevenue : [{ isEmpty: true }],
  );

  if (collectionItems.length > 0) {
    appendTableSection(pages, 'WEEKLY_COLLECTIONS', collectionItems);
  }

  let finalPage = pages[pages.length - 1];
  if (REPORT_PAGE_CONTENT_UNITS - finalPage.usedUnits < SIGNATURE_UNITS) {
    finalPage = createPage();
    pages.push(finalPage);
  }
  finalPage.showSignatures = true;
  finalPage.usedUnits += SIGNATURE_UNITS;

  return {
    startDate: requestedStartDate || reportData.startDate || '',
    endDate: requestedEndDate || reportData.endDate || '',
    generatedAt: reportData.generatedAt || null,
    kpis: reportData.kpis || {},
    pages,
  };
}
