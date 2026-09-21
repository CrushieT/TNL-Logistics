/**
 * Pure business logic and utilities for Field Personal Scan and Tracking History.
 * Free of React Native imports to allow execution and verification in Node test runners.
 */

export const HISTORY_PAGE_SIZE = 20;

export const SYNC_STATUSES = Object.freeze({
  SYNCED: 'SYNCED',
  PENDING_OFFLINE_SYNC: 'PENDING_OFFLINE_SYNC',
});

export const STATUS_LABELS = Object.freeze({
  REGISTERED: 'Registered',
  QR_GENERATED: 'QR Generated',
  LOADED_ON_TRUCK: 'Loaded on Truck',
  ARRIVED_AT_TNL: 'Outload / Arrive TNL',
  LOADED_TO_HAULER: 'Loaded to Hauler',
  COMPLETED: 'Completed',
});

const STATUS_SEARCH_ALIASES = Object.freeze({
  'registered': 'REGISTERED',
  'qr generated': 'QR_GENERATED',
  'loaded on truck': 'LOADED_ON_TRUCK',
  'load on truck': 'LOADED_ON_TRUCK',
  'arrived at tnl': 'ARRIVED_AT_TNL',
  'outload / arrive tnl': 'ARRIVED_AT_TNL',
  'loaded to hauler': 'LOADED_TO_HAULER',
  'handed to hauler': 'LOADED_TO_HAULER',
  'completed': 'COMPLETED',
});

const MONTH_NAMES = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

/**
 * Trims search query and bounds client length to 50 characters.
 */
export function normalizeHistorySearch(value) {
  if (value == null) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.length > 50 ? trimmed.slice(0, 50) : trimmed;
}

/**
 * Resolves a normalized search string to an exact status enum if matching supported aliases.
 */
export function resolveStatusSearch(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return STATUS_SEARCH_ALIASES[normalized] || null;
}

/**
 * Builds personal history query parameters with search/status segregation and pagination clamping.
 */
export function buildPersonalHistoryParams({ search, page = 0, size = HISTORY_PAGE_SIZE } = {}) {
  const parsedPage = parseInt(page, 10);
  const safePage = Number.isNaN(parsedPage) ? 0 : Math.max(0, parsedPage);

  const parsedSize = parseInt(size, 10);
  const safeSize = Number.isNaN(parsedSize)
    ? HISTORY_PAGE_SIZE
    : Math.min(50, Math.max(1, parsedSize));

  const params = {
    page: safePage,
    size: safeSize,
  };

  if (search != null) {
    const rawTrimmed = String(search).trim();
    if (rawTrimmed) {
      const resolvedStatus = resolveStatusSearch(rawTrimmed);
      if (resolvedStatus) {
        params.status = resolvedStatus;
      } else {
        params.search = normalizeHistorySearch(rawTrimmed);
      }
    }
  }

  return params;
}

/**
 * Appends incoming events to existing list, deduplicating by eventId while preserving order.
 */
export function appendUniqueEvents(existing = [], incoming = []) {
  const safeExisting = Array.isArray(existing) ? existing : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];

  const seenIds = new Set();
  const result = [];

  for (const event of safeExisting) {
    if (event && event.eventId != null) {
      if (!seenIds.has(event.eventId)) {
        seenIds.add(event.eventId);
        result.push(event);
      }
    } else if (event) {
      result.push(event);
    }
  }

  for (const event of safeIncoming) {
    if (event && event.eventId != null) {
      if (!seenIds.has(event.eventId)) {
        seenIds.add(event.eventId);
        result.push(event);
      }
    } else if (event) {
      result.push(event);
    }
  }

  return result;
}

/**
 * Normalizes metrics object, ensuring all counters are non-negative numbers with zero fallbacks.
 */
export function normalizePersonalMetrics(value) {
  return {
    date: value?.date || null,
    totalScans: Number(value?.totalScans) > 0 ? Number(value.totalScans) : 0,
    loadedOnTruck: Number(value?.loadedOnTruck) > 0 ? Number(value.loadedOnTruck) : 0,
    arrivedAtTnl: Number(value?.arrivedAtTnl) > 0 ? Number(value.arrivedAtTnl) : 0,
    handedToHauler: Number(value?.handedToHauler) > 0 ? Number(value.handedToHauler) : 0,
  };
}

/**
 * Formats ISO timestamp or Date to 'MMM d, yyyy · h:mm a'. Returns '—' for missing or invalid dates.
 * Never fabricates a current timestamp.
 */
export function formatHistoryTimestamp(value) {
  if (value == null || value === '') return '—';

  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  } else {
    return '—';
  }

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const month = MONTH_NAMES[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

  return `${month} ${day}, ${year} · ${hours}:${formattedMinutes} ${ampm}`;
}

export function formatPackageDisplay(packageIndex, packageCount) {
  const index = parsePositiveInteger(packageIndex);
  const count = parsePositiveInteger(packageCount);
  if (index == null || count == null || index > count) {
    return 'PACKAGE COUNT UNAVAILABLE';
  }
  return `PACKAGE ${index} OF ${count}`;
}

function parsePositiveInteger(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;

  const normalizedValue = typeof value === 'string' ? value.trim() : value;
  if (typeof normalizedValue === 'string' && !/^\d+$/.test(normalizedValue)) return null;

  const numericValue = Number(normalizedValue);
  return Number.isFinite(numericValue) && Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : null;
}

export function resolveTrackingStatusDisplay(statusDisplay, statusCode) {
  if (typeof statusDisplay === 'string' && statusDisplay.trim()) {
    return statusDisplay.trim();
  }

  const normalizedCode = typeof statusCode === 'string' ? statusCode.trim() : '';
  return STATUS_LABELS[normalizedCode] || 'STATUS UNAVAILABLE';
}

/**
 * Resolves page-zero event replacement, validating and deduplicating the initial feed.
 */
export function replacePageZeroEvents(incoming = []) {
  if (!Array.isArray(incoming)) return [];
  return appendUniqueEvents([], incoming);
}

/**
 * Encodes tracking ID for safe URL segment routing.
 */
export function encodeTrackingId(value) {
  if (value == null) return '';
  return encodeURIComponent(String(value).trim());
}

/**
 * Resolves display metadata for sync status badges.
 */
export function getSyncStatusMeta(status) {
  if (status === SYNC_STATUSES.PENDING_OFFLINE_SYNC) {
    return {
      label: 'PENDING OFFLINE SYNC',
      isPending: true,
      color: '#A8790F',
      bgColor: '#F7EFDA',
      borderColor: '#D4A437',
    };
  }
  return {
    label: 'SYNCED',
    isPending: false,
    color: '#2E7D46',
    bgColor: '#E7F3EA',
    borderColor: '#98D2A5',
  };
}
