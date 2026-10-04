import apiClient from '../../../services/api/client';

export async function getDashboardSummary(cycle) {
  try {
    const params = cycle ? { cycle } : {};
    const { data } = await apiClient.get('/dashboard/summary', { params });
    return data;
  } catch (err) {
    return null;
  }
}

export async function listShipments(params = {}) {
  const { data } = await apiClient.get('/shipments', { params });
  return data;
}

export async function getShipment(shipmentId) {
  const { data } = await apiClient.get(`/shipments/${shipmentId}`);
  return data;
}

export async function getShipmentCalculationSettings(clientId) {
  const { data } = await apiClient.get('/shipments/calculation-settings', {
    params: { clientId },
  });
  return data;
}

export async function getParcelUnit(trackingId) {
  const { data } = await apiClient.get(`/parcel-units/${trackingId}`);
  return data;
}

export async function printLabels(shipmentId, packageIds, printJobId, printerId = 'SYSTEM-PDF') {
  const { data } = await apiClient.post(`/shipments/${shipmentId}/labels/print`, {
    printJobId,
    packageIds,
    printerId,
  });
  return data;
}

export async function registerShipment(payload) {
  const qty = parseInt(payload.quantity, 10) || (Array.isArray(payload.parcels) ? payload.parcels.length : 1);
  let parcels;
  if (Array.isArray(payload.parcels) && payload.parcels.length > 0) {
    parcels = payload.parcels.map((p, idx) => ({
      seq: p.seq || (idx + 1),
      weightKg: typeof p.weightKg === 'number' ? p.weightKg : (parseFloat(p.weightKg) || 0),
      lengthCm: typeof p.lengthCm === 'number' ? p.lengthCm : (parseFloat(p.lengthCm) || 0),
      widthCm: typeof p.widthCm === 'number' ? p.widthCm : (parseFloat(p.widthCm) || 0),
      heightCm: typeof p.heightCm === 'number' ? p.heightCm : (parseFloat(p.heightCm) || 0),
    }));
  } else {
    const weight = parseFloat(payload.weightPerUnit) || 0;
    const length = parseFloat(payload.lengthCm) || 0;
    const width = parseFloat(payload.widthCm) || 0;
    const height = parseFloat(payload.heightCm) || 0;

    parcels = Array.from({ length: qty }, (_, i) => ({
      seq: i + 1,
      weightKg: weight,
      lengthCm: length,
      widthCm: width,
      heightCm: height,
    }));
  }

  const backendRequest = {
    clientId: payload.clientId,
    recipientAddress: payload.recipient?.address || payload.recipientAddress || '',
    recipientContact: payload.recipient?.contactNumber || payload.recipientContact || '',
    description: payload.description || 'General Goods',
    quantity: qty,
    chargeModel: 'PER_KILO',
    otherCharges: parseFloat(payload.otherCharges) || 0,
    paidAtRegistration: Boolean(payload.paidAtRegistration),
    route: payload.route || 'Manila to TNL Labo C.N.',
    registeredVia: 'DESKTOP_OFFICE',
    expectedRatePerKilo: payload.expectedRatePerKilo ? parseFloat(payload.expectedRatePerKilo) : undefined,
    expectedVolumetricDivisor: payload.expectedVolumetricDivisor ? parseInt(payload.expectedVolumetricDivisor, 10) : undefined,
    parcels,
  };

  const { data } = await apiClient.post('/shipments', backendRequest);

  return {
    shipmentId: data.shipmentId,
    clientId: data.clientId,
    recipient: data.recipientName,
    recipientDetails: payload.recipient || {
      fullName: data.recipientName,
      address: backendRequest.recipientAddress,
      contactNumber: backendRequest.recipientContact,
    },
    client: payload.clientName || data.clientId,
    quantity: data.trackingIds ? data.trackingIds.length : qty,
    chargeModel: 'Per kilo',
    shippingFee: data.shippingFee,
    otherCharges: data.otherCharges,
    totalAmount: data.totalAmount,
    paidAtRegistration: data.paidAtRegistration,
    description: backendRequest.description,
    route: backendRequest.route,
    appliedRatePerKilo: data.appliedRatePerKilo,
    appliedVolumetricDivisor: data.appliedVolumetricDivisor,
    totalActualWeight: data.totalActualWeight,
    totalVolumetricWeight: data.totalVolumetricWeight,
    billableWeight: data.billableWeight,
    units: (data.trackingIds || []).map((tid, idx) => ({
      trackingId: tid,
      packageIndex: idx + 1,
      packageCount: data.trackingIds.length,
      labelStatus: 'Pending',
    })),
  };
}

export async function listTrackingLogs(params = {}) {
  const { data } = await apiClient.get('/tracking-logs', { params });
  return data;
}
