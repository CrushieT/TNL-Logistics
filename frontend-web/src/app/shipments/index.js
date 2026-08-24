import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import SearchFilterBar from '../../components/common/SearchFilterBar';
import { ShipmentsTable, listShipments } from '../../features/shipments';

const FALLBACK_SHIPMENTS = [
  { shipmentId: 'SHP-2026-011', dateLabel: 'Aug 24, 2026', recipientName: 'Aundray Tafalla', contactNumber: '08921341232', client: 'Northbridge Trading', quantity: 3, status: 'Registered', statusRollup: '3 / 3 Registered', payment: 'Unpaid', balance: 500 },
  { shipmentId: 'SHP-2026-001', dateLabel: 'Aug 3, 2026', recipientName: 'Juan Dela Cruz', contactNumber: '0917-555-0148', client: 'Northbridge Trading', quantity: 3, status: 'Loaded on Truck', statusRollup: '1 / 3 Loaded on Truck', payment: 'Unpaid', balance: 500 },
  { shipmentId: 'SHP-2026-002', dateLabel: 'Aug 4, 2026', recipientName: 'Juan Dela Cruz', contactNumber: '0917-555-0148', client: 'Northbridge Trading', quantity: 1, status: 'Arrived at TNL', statusRollup: '1 / 1 Arrived at TNL', payment: 'Unpaid', balance: 750 },
  { shipmentId: 'SHP-2026-003', dateLabel: 'Aug 5, 2026', recipientName: 'Rosa Aquino', contactNumber: '0917-555-0148', client: 'Northbridge Trading', quantity: 1, status: 'Loaded on Truck', statusRollup: '1 / 1 Loaded on Truck', payment: 'Unpaid', balance: 300 },
  { shipmentId: 'SHP-2026-004', dateLabel: 'Aug 3, 2026', recipientName: 'Mario Bautista', contactNumber: '0918-555-0022', client: 'Sunrise Hardware', quantity: 1, status: 'Arrived at TNL', statusRollup: '1 / 1 Arrived at TNL', payment: 'Paid', balance: 0 },
  { shipmentId: 'SHP-2026-005', dateLabel: 'Aug 3, 2026', recipientName: 'Mario Bautista', contactNumber: '0918-555-0022', client: 'Sunrise Hardware', quantity: 1, status: 'Arrived at TNL', statusRollup: '1 / 1 Arrived at TNL', payment: 'Unpaid', balance: 500 },
  { shipmentId: 'SHP-2026-006', dateLabel: 'Aug 4, 2026', recipientName: 'Ana Villanueva', contactNumber: '0918-555-0022', client: 'Sunrise Hardware', quantity: 1, status: 'Arrived at TNL', statusRollup: '1 / 1 Arrived at TNL', payment: 'Unpaid', balance: 600 },
  { shipmentId: 'SHP-2026-007', dateLabel: 'Aug 5, 2026', recipientName: 'Ana Villanueva', contactNumber: '0918-555-0022', client: 'Sunrise Hardware', quantity: 1, status: 'Loaded on Truck', statusRollup: '1 / 1 Loaded on Truck', payment: 'Unpaid', balance: 500 },
  { shipmentId: 'SHP-2026-008', dateLabel: 'Aug 6, 2026', recipientName: 'Mario Bautista', contactNumber: '0918-555-0022', client: 'Sunrise Hardware', quantity: 1, status: 'Registered', statusRollup: '1 / 1 Registered', payment: 'Unpaid', balance: 600 },
  { shipmentId: 'SHP-2026-009', dateLabel: 'Aug 4, 2026', recipientName: 'Grace Tan', contactNumber: '0999-555-0099', client: 'Metro Fashion House', quantity: 2, status: 'Arrived at TNL', statusRollup: '2 / 2 Arrived at TNL', payment: 'Paid', balance: 0 },
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Status: All' },
  { value: 'Registered', label: 'Registered' },
  { value: 'Loaded on Truck', label: 'Loaded on Truck' },
  { value: 'Arrived at TNL', label: 'Arrived at TNL' },
  { value: 'Loaded to Hauler', label: 'Loaded to Hauler' },
];

const PAYMENT_OPTIONS = [
  { value: 'ALL', label: 'Payment: All' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Unpaid', label: 'Unpaid' },
  { value: 'Partial', label: 'Partial' },
];

export default function ShipmentsListScreen() {
  const router = useRouter();
  const [shipments, setShipments] = useState(FALLBACK_SHIPMENTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  const load = useCallback(async () => {
    try {
      const data = await listShipments();
      if (data?.length) setShipments(data);
    } catch (err) {
      console.warn('Shipments fetch failed, using fallback data.', err?.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      const matchesSearch =
        !search ||
        s.shipmentId.toLowerCase().includes(search.toLowerCase()) ||
        s.recipientName.toLowerCase().includes(search.toLowerCase()) ||
        s.client.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      const matchesPayment = paymentFilter === 'ALL' || s.payment === paymentFilter;
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [shipments, search, statusFilter, paymentFilter]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Master Records · Transactions"
        title="Shipments"
        right={<Button label="+ Register Shipment" variant="primary" onPress={() => router.push('/register')} />}
      />

      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        placeholder="Search shipment, tracking ID, recipient..."
        filters={[
          { label: 'Status', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
          { label: 'Payment', value: paymentFilter, onChange: setPaymentFilter, options: PAYMENT_OPTIONS },
        ]}
      />

      <ShipmentsTable
        shipments={filtered}
        onView={(s) => router.push(`/shipments/${s.shipmentId}`)}
      />
    </AppShell>
  );
}
