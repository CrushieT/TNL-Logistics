import { getCurrentUser } from '../../../services/api/client';
import { printLabels } from './shipmentApi';
import { createPrintAuditOutbox } from './printAuditOutboxCore.mjs';

export * from './printAuditOutboxCore.mjs';

function createBrowserStorage() {
  return {
    getItem(key) {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('Browser local storage is unavailable');
      }
      return window.localStorage.getItem(key);
    },
    setItem(key, value) {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('Browser local storage is unavailable');
      }
      window.localStorage.setItem(key, value);
    },
  };
}

const defaultOutbox = createPrintAuditOutbox({
  storage: createBrowserStorage(),
  getOwnerUserId: () => getCurrentUser()?.userId,
  sendAudit: (entry) => printLabels(
    entry.shipmentId,
    entry.trackingIds,
    entry.printJobId,
    entry.printerId
  ),
});

export const assertPrintAuditCapacityAvailable = () => defaultOutbox.assertCapacityAvailable();
export const retryPendingPrintAudits = () => defaultOutbox.retryPendingPrintAudits();
export const submitPrintAudit = (entry) => defaultOutbox.submitPrintAudit(entry);
