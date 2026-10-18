import apiClient from '../../../services/api/client';
import { formatCycleDateRangeFromDates } from '../utils/collectionsUtils';

/**
 * Fetch active Thursday weekly collections consolidation dashboard data.
 * @param {string} [targetDate] - Optional Thursday date (YYYY-MM-DD)
 */
export async function getWeeklyCollections(targetDate, options = {}) {
  const params = {};
  if (targetDate) {
    params.targetDate = targetDate;
  }
  const signal = options?.signal;
  const { data } = await apiClient.get('/collections/weekly', {
    params,
    ...(signal ? { signal } : {}),
  });
  return data;
}

/**
 * Fetch unbilled shipments, previous balance, and deductions preview for a client.
 * @param {string|number} clientId
 * @param {string} [cutoffDate] - Optional cutoff date (YYYY-MM-DD)
 */
export async function getClientUnbilledPreview(clientId, cutoffDate) {
  const params = {};
  if (cutoffDate) {
    params.cutoffDate = cutoffDate;
  }
  const { data } = await apiClient.get(`/collections/preview/${clientId}`, { params });
  return data;
}

/**
 * Generate a single Statement of Account (SOA) for a client with applied deductions.
 * @param {Object} payload - { clientId, cutoffDate, deductions: [{ category, amount, description, referenceNo }] }
 */
export async function generateSingleSoa(payload) {
  const { data } = await apiClient.post('/soa/generate', payload);
  return data;
}

/**
 * Generate batch Statements of Account for all unbilled clients or selected clients.
 * @param {Object} payload - { targetThursday, scope, clientIds }
 */
export async function generateBatchSoa(payload) {
  const { data } = await apiClient.post('/soa/generate-batch', payload);
  return data;
}

/**
 * Fetch all clients directory for client switcher dropdown.
 */
export async function listAllClients() {
  const { data } = await apiClient.get('/clients', { params: { size: 100 } });
  return data;
}

/**
 * Fetch detailed Statement of Account preview with itemized shipments for a client.
 * @param {string} clientId
 * @param {string} [targetDate] - Target Thursday (YYYY-MM-DD)
 */
export async function getStatementPreview(clientId, targetDate) {
  const params = { clientId };
  if (targetDate) {
    params.targetDate = targetDate;
  }
  const { data } = await apiClient.get('/soa/preview', { params });
  return data;
}

/**
 * Persist deductions, note, and collector on an SOA.
 * @param {Object} payload - { clientId, targetDate, deductionAmount, deductionNote, collectedBy }
 */
export async function saveStatement(payload) {
  const { data } = await apiClient.post('/soa/save', payload);
  return data;
}

/**
 * Fetch active authorized staff list for the "COLLECTED BY" dropdown.
 */
export async function getAuthorizedCollectors() {
  const { data } = await apiClient.get('/soa/collectors');
  return data;
}

/**
 * Fetch list of active Thursday cycle dates that actually contain shipments.
 * @returns {Promise<Array<{ isoDate: string, label: string }>>}
 */
export async function getActiveCollectionCycles(options = {}) {
  try {
    const { data } = await apiClient.get('/collections/cycles', {
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (Array.isArray(data) && data.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return data.map((isoDate, index) => {
        const parts = isoDate.split('-');
        const end = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

        let start = new Date(end);
        start.setDate(end.getDate() - 6);

        if (index < data.length - 1) {
          const nextParts = data[index + 1].split('-');
          const prevCycleEnd = new Date(Number(nextParts[0]), Number(nextParts[1]) - 1, Number(nextParts[2]));
          const anchoredStart = new Date(prevCycleEnd);
          anchoredStart.setDate(anchoredStart.getDate() + 1);

          if (anchoredStart > start) {
            start = anchoredStart;
          }
        }

        const isCurrent = index === 0 && end >= today;
        const baseLabel = formatCycleDateRangeFromDates(start, end);
        return {
          isoDate,
          label: isCurrent ? `${baseLabel} (Current Cycle)` : baseLabel,
          isCurrent,
        };
      });
    }
  } catch (err) {
    if (options.signal?.aborted) throw err;
    console.warn('Failed to load active cycles from backend:', err?.message);
  }
  return [];
}
