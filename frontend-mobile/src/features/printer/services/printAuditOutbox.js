import AsyncStorage from '@react-native-async-storage/async-storage';

export const PRINT_AUDIT_OUTBOX_KEY = 'tnl_pending_print_audits';
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

export function createPrintAuditOutbox(storage = AsyncStorage) {
  let mutationQueue = Promise.resolve();

  function enqueueMutation(operation) {
    const pendingMutation = mutationQueue.then(operation, operation);
    mutationQueue = pendingMutation.catch(() => undefined);
    return pendingMutation;
  }

  async function readAll() {
    try {
      const storedValue = await storage.getItem(PRINT_AUDIT_OUTBOX_KEY);
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

  async function writeAll(entries) {
    if (entries.length > MAX_OUTBOX_ENTRIES) throw new OutboxCapacityError();
    try {
      await storage.setItem(PRINT_AUDIT_OUTBOX_KEY, JSON.stringify(entries));
    } catch (error) {
      throw new OutboxStorageError('Unable to save print audit storage. Printing is blocked to protect audit history.', error);
    }
  }

  async function assertCapacityAvailable() {
    const entries = await readAll();
    if (entries.length >= MAX_OUTBOX_ENTRIES) throw new OutboxCapacityError();
    await writeAll(entries);
    return MAX_OUTBOX_ENTRIES - entries.length;
  }

  function enqueuePrintAudit(entry) {
    if (!isValidEntry(entry)) return Promise.reject(new TypeError('Invalid print audit outbox entry'));
    return enqueueMutation(async () => {
      const entries = await readAll();
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
      await writeAll(entries);
      return nextEntry;
    });
  }

  function removePrintAudit(printJobId) {
    return enqueueMutation(async () => {
      const entries = await readAll();
      await writeAll(entries.filter((entry) => entry.printJobId !== printJobId));
    });
  }

  function updatePrintAudit(printJobId, updates) {
    return enqueueMutation(async () => {
      const entries = await readAll();
      const nextEntries = entries.map((entry) => entry.printJobId === printJobId
        ? { ...entry, ...updates, attempts: (entry.attempts || 0) + 1 }
        : entry);
      await writeAll(nextEntries);
    });
  }

  async function getPendingPrintAudits(ownerUserId) {
    if (!ownerUserId) return [];
    const entries = await readAll();
    return entries.filter((entry) => entry.ownerUserId === ownerUserId && RETRYABLE_STATUSES.has(entry.status));
  }

  async function getPendingCount(ownerUserId) {
    return (await getPendingPrintAudits(ownerUserId)).length;
  }

  return {
    assertCapacityAvailable,
    enqueuePrintAudit,
    getPendingCount,
    getPendingPrintAudits,
    readAll,
    removePrintAudit,
    updatePrintAudit,
  };
}

const defaultOutbox = createPrintAuditOutbox();

export const assertPrintAuditCapacityAvailable = () => defaultOutbox.assertCapacityAvailable();
export const enqueuePrintAudit = (entry) => defaultOutbox.enqueuePrintAudit(entry);
export const getPendingCount = (ownerUserId) => defaultOutbox.getPendingCount(ownerUserId);
export const getPendingPrintAudits = (ownerUserId) => defaultOutbox.getPendingPrintAudits(ownerUserId);
export const removePrintAudit = (printJobId) => defaultOutbox.removePrintAudit(printJobId);
export const updatePrintAudit = (printJobId, updates) => defaultOutbox.updatePrintAudit(printJobId, updates);

export function classifyAuditError(error) {
  const status = error?.response?.status;
  if (status === 401) return 'AUTH_PAUSED';
  if (status === 400 || status === 403 || status === 409) return 'FAILED';
  return 'PENDING';
}

export async function syncPrintAuditEntry({ entry, sendAudit, outbox = defaultOutbox }) {
  await outbox.enqueuePrintAudit(entry);
  try {
    await sendAudit(entry);
  } catch (error) {
    const status = classifyAuditError(error);
    await outbox.updatePrintAudit(entry.printJobId, {
      status,
      lastError: error?.message || 'Audit sync failed',
    });
    return status;
  }
  await outbox.removePrintAudit(entry.printJobId);
  return 'SYNCED';
}
