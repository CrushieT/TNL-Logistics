import { getCurrentUser } from '../../../services/api/client';
import { printLabels } from './shipmentApi';

const STORAGE_KEY = 'tnl_pending_print_audits';
const MAX_ENTRIES = 100;

function readEntries() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEntries(entries) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  }
}

function classify(error) {
  const status = error?.response?.status;
  if (status === 401) return 'AUTH_PAUSED';
  if (status === 400 || status === 403 || status === 409) return 'FAILED';
  return 'PENDING';
}

export async function submitPrintAudit({ printJobId, shipmentId, trackingIds, printerId = 'SYSTEM-PDF' }) {
  const ownerUserId = getCurrentUser()?.userId;
  if (!ownerUserId) throw new Error('An authenticated user is required to record printing.');
  const entry = { printJobId, shipmentId, trackingIds, printerId, ownerUserId, status: 'PENDING' };
  const entries = readEntries().filter((item) => item.printJobId !== printJobId);
  entries.push(entry);
  writeEntries(entries);

  try {
    await printLabels(shipmentId, trackingIds, printJobId, printerId);
    writeEntries(readEntries().filter((item) => item.printJobId !== printJobId));
    return 'SYNCED';
  } catch (error) {
    const status = classify(error);
    writeEntries(readEntries().map((item) => item.printJobId === printJobId
      ? { ...item, status, lastError: error?.message || 'Audit sync failed' }
      : item));
    return status === 'PENDING' ? 'PENDING' : 'FAILED';
  }
}

export async function retryPendingPrintAudits() {
  const ownerUserId = getCurrentUser()?.userId;
  if (!ownerUserId) return [];
  const pending = readEntries().filter((entry) =>
    entry.ownerUserId === ownerUserId && entry.status === 'PENDING');
  const results = [];
  for (const entry of pending) results.push(await submitPrintAudit(entry));
  return results;
}
