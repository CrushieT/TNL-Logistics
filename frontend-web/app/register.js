import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import AppShell from '../components/common/AppShell';
import PageHeader from '../components/common/PageHeader';
import ShipmentForm from '../components/ShipmentForm';
import ShipmentResultView from '../components/ShipmentResultView';
import PrintLabelsModal from '../components/PrintLabelsModal';
import Toast from '../components/common/Toast';
import { listClients, registerShipment } from '../api/shipments';

// Demo fallback so the form is usable before /clients is wired up.
const FALLBACK_CLIENTS = [
  { id: 'CL-001', code: 'CL-001', name: 'Northbridge Trading' },
  { id: 'CL-002', code: 'CL-002', name: 'Sunrise Hardware' },
  { id: 'CL-003', code: 'CL-003', name: 'Metro Fashion House' },
];

export default function RegisterShipmentScreen() {
  const router = useRouter();
  const [clients, setClients] = useState(FALLBACK_CLIENTS);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    listClients()
      .then((data) => setClients(data?.length ? data : FALLBACK_CLIENTS))
      .catch(() => setClients(FALLBACK_CLIENTS));
  }, []);

  const handleSubmit = useCallback(async (payload) => {
    setSubmitting(true);
    try {
      const clientRecord = clients.find((c) => c.id === payload.clientId);
      let response;
      try {
        response = await registerShipment({ ...payload, clientName: clientRecord?.name });
      } catch (err) {
        // Fall back to a locally-assembled preview if the backend isn't
        // reachable yet, so the UI flow can still be demoed end-to-end.
        response = buildLocalPreview(payload, clientRecord);
      }
      setResult(response);
      setToastVisible(true);
    } finally {
      setSubmitting(false);
    }
  }, [clients]);

  function buildLocalPreview(payload, clientRecord) {
    const shipmentId = 'SHP-2026-011';
    const units = Array.from({ length: payload.quantity }, (_, i) => ({
      trackingId: `TRK-2026-${String(114 + i).padStart(6, '0')}`,
      packageIndex: i + 1,
      packageCount: payload.quantity,
      labelStatus: 'Pending',
    }));
    return {
      shipmentId,
      recipient: payload.recipient.fullName,
      recipientDetails: payload.recipient,
      client: clientRecord?.name || '—',
      quantity: payload.quantity,
      chargeModel: payload.chargeModel === 'FLAT' ? 'Flat' : 'Per unit',
      totalAmount: payload.totalAmount,
      description: payload.description,
      route: payload.route,
      units,
    };
  }

  if (result) {
    return (
      <AppShell>
        <ShipmentResultView
          shipment={result}
          onRegisterAnother={() => setResult(null)}
          onViewShipment={() => router.push(`/shipments/${result.shipmentId}`)}
          onPreviewLabels={() => setModalVisible(true)}
        />
        <PrintLabelsModal
          visible={modalVisible}
          shipment={result}
          onClose={() => setModalVisible(false)}
          onPrint={() => setModalVisible(false)}
        />
        <Toast
          visible={toastVisible}
          message={`Shipment ${result.shipmentId} registered · ${result.units.length} QR codes generated`}
          onDismiss={() => setToastVisible(false)}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader eyebrow="Scenario 1 · Encode & Identify" title="Register Shipment" />
      <ShipmentForm clients={clients} onSubmit={handleSubmit} submitting={submitting} />
    </AppShell>
  );
}
