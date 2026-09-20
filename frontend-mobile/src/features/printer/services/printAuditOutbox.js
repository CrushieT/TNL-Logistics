import AsyncStorage from '@react-native-async-storage/async-storage';

export const PRINT_AUDIT_OUTBOX_KEY = 'tnl_pending_print_audits';
const MAX_OUTBOX_ENTRIES = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidEntry(entry) {
  return entry
    && UUID_PATTERN.test(entry.printJobId || '')
    && typeof entry.ownerUserId === 'string'
    && typeof entry.shipmentId === 'string'
    && Array.isArray(entry.trackingIds)
    && entry.trackingIds.length > 0
    && entry.trackingIds.every((trackingId) => typeof trackingId === 'string' && trackingId.trim());
}

async function readAll() {
  try {
    const storedValue = await AsyncStorage.getItem(PRINT_AUDIT_OUTBOX_KEY);
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];
    return Array.isArray(parsedValue) ? parsedValue.filter(isValidEntry) : [];
  } catch {
    return [];
  }
}

async function writeAll(entries) {
  await AsyncStorage.setItem(PRINT_AUDIT_OUTBOX_KEY, JSON.stringify(entries.slice(-MAX_OUTBOX_ENTRIES)));
}

export async function enqueuePrintAudit(entry) {
  if (!isValidEntry(entry)) throw new TypeError('Invalid print audit outbox entry');
  const entries = await readAll();
  const existingIndex = entries.findIndex((item) => item.printJobId === entry.printJobId);
  const nextEntry = {
    ...entry,
    status: entry.status || 'PENDING',
    createdAt: entry.createdAt || new Date().toISOString(),
    attempts: entry.attempts || 0,
  };
  if (existingIndex >= 0) entries[existingIndex] = nextEntry;
  else entries.push(nextEntry);
  await writeAll(entries);
  return nextEntry;
}

export async function removePrintAudit(printJobId) {
  const entries = await readAll();
  await writeAll(entries.filter((entry) => entry.printJobId !== printJobId));
}

export async function updatePrintAudit(printJobId, updates) {
  const entries = await readAll();
  const nextEntries = entries.map((entry) => entry.printJobId === printJobId
    ? { ...entry, ...updates, attempts: (entry.attempts || 0) + 1 }
    : entry);
  await writeAll(nextEntries);
}

export async function getPendingPrintAudits(ownerUserId) {
  if (!ownerUserId) return [];
  const entries = await readAll();
  return entries.filter((entry) => entry.ownerUserId === ownerUserId && entry.status === 'PENDING');
}

export function classifyAuditError(error) {
  const status = error?.response?.status;
  if (status === 401) return 'AUTH_PAUSED';
  if (status === 400 || status === 403 || status === 409) return 'FAILED';
  return 'PENDING';
}
