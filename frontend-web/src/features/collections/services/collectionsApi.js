import apiClient from '../../../services/api/client';
import { parseShipmentRegistrationDate } from '../utils/collectionsUtils';

/**
 * Fetch active Thursday weekly collections consolidation dashboard data.
 * @param {string} [targetDate] - Optional Thursday date (YYYY-MM-DD)
 */
export async function getWeeklyCollections(targetDate) {
  try {
    const params = {};
    if (targetDate) {
      params.targetDate = targetDate;
    }
    const { data } = await apiClient.get('/collections/weekly', { params });
    if (data && data.items) {
      return data;
    }
  } catch (err) {
    console.warn('Backend /collections/weekly endpoint unavailable, using fallback aggregator:', err?.message);
  }

  // Resilient fallback aggregator
  try {
    const [clientsRes, shipmentsRes] = await Promise.all([
      apiClient.get('/clients', { params: { size: 100 } }),
      apiClient.get('/shipments', { params: { size: 200 } }),
    ]);

    const clients = clientsRes?.data?.content || clientsRes?.data || [];
    const shipments = shipmentsRes?.data?.content || shipmentsRes?.data || [];

    let totalDue = 0;
    let totalCollected = 0;
    let outstandingBalance = 0;

    const cycleEnd = targetDate ? new Date(`${targetDate}T23:59:59.999`) : new Date();
    const cycleStart = new Date(cycleEnd);
    cycleStart.setDate(cycleStart.getDate() - 6);
    cycleStart.setHours(0, 0, 0, 0);

    const items = clients.map((c) => {
      const clientShipments = shipments.filter((s) => {
        const matchClient =
          String(s.clientId || s.client?.id || s.client?.clientId || '') === String(c.id || c.clientId || '') ||
          (s.clientName && c.name && s.clientName.toLowerCase() === c.name.toLowerCase()) ||
          (s.clientId && c.code && s.clientId === c.code);
        if (!matchClient) return false;

        const shipDate = parseShipmentRegistrationDate(s);
        if (!shipDate) return false;

        return shipDate >= cycleStart && shipDate <= cycleEnd;
      });

      const unbilledShipments = clientShipments.filter((s) => !s.statementId && !s.soaNo);
      const currentCharges = clientShipments.reduce(
        (sum, s) => sum + Number(s.totalAmount ?? s.amountDue ?? 0),
        0
      );
      const paidCharges = clientShipments.reduce(
        (sum, s) => sum + Number(s.amountPaid ?? s.paid ?? 0),
        0
      );

      const prevBal = Number(c.previousBalance || c.carriedBalance || 0);
      const deductions = 0;
      const netDue = Math.max(0, currentCharges + prevBal - paidCharges - deductions);

      totalDue += currentCharges + prevBal;
      totalCollected += paidCharges;
      outstandingBalance += netDue;

      const hasUnbilled = unbilledShipments.length > 0;
      const status = hasUnbilled ? 'READY_FOR_SOA' : (netDue === 0 ? 'SETTLED' : 'SOA_GENERATED');

      return {
        clientId: c.id || c.clientId,
        clientName: c.name,
        clientCode: c.code || c.clientId || 'CL',
        contactNumber: c.contactNumber || c.phone || '',
        shipmentsCount: clientShipments.length,
        unbilledShipmentsCount: unbilledShipments.length,
        currentCharges,
        previousBalance: prevBal,
        paid: paidCharges,
        totalDeductions: deductions,
        netAmountDue: netDue,
        balance: netDue,
        status,
        statementId: null,
      };
    });

    const activeClientsCount = items.filter((i) => i.unbilledShipmentsCount > 0 || i.netAmountDue > 0).length;

    return {
      collectionDate: targetDate || new Date().toISOString().split('T')[0],
      totalDue,
      totalCollected,
      outstandingBalance,
      activeClientsCount,
      items,
    };
  } catch (fallbackErr) {
    console.error('Weekly collections fallback aggregation failed:', fallbackErr);
    return {
      collectionDate: targetDate || new Date().toISOString().split('T')[0],
      totalDue: 0,
      totalCollected: 0,
      outstandingBalance: 0,
      activeClientsCount: 0,
      items: [],
    };
  }
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
