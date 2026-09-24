export const PRINT_AUDIT_STORAGE_KEY = 'tnl_pending_print_audits';
export const MAX_OUTBOX_ENTRIES = 500;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETRYABLE_STATUSES = new Set(['PENDING', 'AUTH_PAUSED']);

export class OutboxCapacityError extends Error {
  constructor(capacity = MAX_OUTBOX_ENTRIES) {
    super(`Print audit storage is full (${capacity} entries). Sync pending audits before printing more labels.`);
    this.name = 'OutboxCapacityError';
    this.code = 'OUTBOX_CAPACITY_REACHED';
    this.capacity = capacity;
  }
}

export class OutboxStorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'OutboxStorageError';
    this.code = 'OUTBOX_STORAGE_UNAVAILABLE';
    this.cause = cause;
  }
}

function isValidEntry(entry) {
  return entry
    && UUID_PATTERN.test(entry.printJobId || '')
    && typeof entry.ownerUserId === 'string'
    && typeof entry.shipmentId === 'string'
    && Array.isArray(entry.trackingIds)
    && entry.trackingIds.length > 0
    && entry.trackingIds.every((trackingId) => typeof trackingId === 'string' && trackingId.trim());
}

export function classifyAuditError(error) {
  const status = error?.response?.status;
  if (status === 401) return 'AUTH_PAUSED';
  if (status === 400 || status === 403 || status === 409) return 'FAILED';
  return 'PENDING';
}

export function createPrintAuditOutbox({ storage, getOwnerUserId, sendAudit }) {
  function readEntries() {
    try {
      const storedValue = storage.getItem(PRINT_AUDIT_STORAGE_KEY);
      if (storedValue === null) return [];

      const parsedValue = JSON.parse(storedValue);
      if (!Array.isArray(parsedValue) || parsedValue.some((entry) => !isValidEntry(entry))) {
        throw new TypeError('Stored print audit outbox data is invalid');
      }
      return parsedValue;
    } catch (error) {
      if (error instanceof OutboxStorageError) throw error;
      throw new OutboxStorageError('Unable to read print audit storage. Printing is blocked to protect audit history.', error);
    }
  }

  function writeEntries(entries) {
    if (entries.length > MAX_OUTBOX_ENTRIES) throw new OutboxCapacityError();
    try {
      storage.setItem(PRINT_AUDIT_STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      throw new OutboxStorageError('Unable to save print audit storage. Printing is blocked to protect audit history.', error);
    }
  }

  function assertCapacityAvailable() {
    const entries = readEntries();
    if (entries.length >= MAX_OUTBOX_ENTRIES) throw new OutboxCapacityError();
    writeEntries(entries);
    return MAX_OUTBOX_ENTRIES - entries.length;
  }

  function enqueuePrintAudit(entry) {
    if (!isValidEntry(entry)) throw new TypeError('Invalid print audit outbox entry');
    const entries = readEntries();
    const existingIndex = entries.findIndex((item) => item.printJobId === entry.printJobId);
    const nextEntry = {
      ...entry,
      status: entry.status || 'PENDING',
      createdAt: entry.createdAt || new Date().toISOString(),
      attempts: entry.attempts ?? 0,
    };

    if (existingIndex >= 0) entries[existingIndex] = nextEntry;
    else {
      if (entries.length >= MAX_OUTBOX_ENTRIES) throw new OutboxCapacityError();
      entries.push(nextEntry);
    }
    writeEntries(entries);
    return nextEntry;
  }

  function removePrintAudit(printJobId) {
    writeEntries(readEntries().filter((entry) => entry.printJobId !== printJobId));
  }

  function updatePrintAudit(printJobId, updates) {
    writeEntries(readEntries().map((entry) => entry.printJobId === printJobId
      ? { ...entry, ...updates, attempts: (entry.attempts || 0) + 1 }
      : entry));
  }

  function getPendingPrintAudits(ownerUserId) {
    if (!ownerUserId) return [];
    return readEntries().filter((entry) =>
      entry.ownerUserId === ownerUserId && RETRYABLE_STATUSES.has(entry.status));
  }

  async function submitPrintAudit(auditEntry) {
    const {
      printJobId,
      shipmentId,
      trackingIds,
      printerId = 'SYSTEM-PDF',
    } = auditEntry;
    const ownerUserId = getOwnerUserId();
    if (!ownerUserId) throw new Error('An authenticated user is required to record printing.');
    const entry = enqueuePrintAudit({
      ...auditEntry,
      printJobId,
      shipmentId,
      trackingIds,
      printerId,
      ownerUserId,
      status: 'PENDING',
    });

    try {
      await sendAudit(entry);
    } catch (error) {
      const status = classifyAuditError(error);
      updatePrintAudit(printJobId, { status, lastError: error?.message || 'Audit sync failed' });
      return status;
    }

    removePrintAudit(printJobId);
    return 'SYNCED';
  }

  async function retryPendingPrintAudits() {
    const ownerUserId = getOwnerUserId();
    if (!ownerUserId) return [];
    const results = [];
    for (const entry of getPendingPrintAudits(ownerUserId)) {
      results.push(await submitPrintAudit(entry));
    }
    return results;
  }

  return {
    assertCapacityAvailable,
    getPendingPrintAudits,
    readEntries,
    retryPendingPrintAudits,
    submitPrintAudit,
  };
}
