import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import SearchFilterBar from '../../components/common/SearchFilterBar';
import { ShipmentsTable, listShipments, subscribeRealtimeEvents } from '../../features/shipments';
import { listVehicles } from '../../features/vehicles';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Status: All' },
  { value: 'Registered', label: 'Registered' },
  { value: 'QR Generated', label: 'QR Generated' },
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
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [vehicleFilter, setVehicleFilter] = useState('ALL');
  const [vehicleOptions, setVehicleOptions] = useState([{ value: 'ALL', label: 'Vehicle: All' }]);

  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const searchTimer = useRef(null);

  // Fetch available vehicles for dynamic filter options
  useEffect(() => {
    let isMounted = true;
    async function loadVehicles() {
      try {
        const vehicles = await listVehicles(true);
        if (isMounted && Array.isArray(vehicles)) {
          const options = [
            { value: 'ALL', label: 'Vehicle: All' },
            ...vehicles.map((v) => ({
              value: v.vehicleId,
              label: `${v.vehicleId} (${v.plateNumber})`,
            })),
          ];
          setVehicleOptions(options);
        }
      } catch (err) {
        console.warn('Failed to load vehicles for filter dropdown:', err?.message);
      }
    }
    loadVehicles();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchShipments = useCallback(async (currPage, currSize, currSearch, currStatus, currPayment, currVehicle, showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const params = {
        page: currPage,
        size: currSize,
      };
      if (currSearch && currSearch.trim()) params.search = currSearch.trim();
      if (currStatus && currStatus !== 'ALL') params.status = currStatus;
      if (currPayment && currPayment !== 'ALL') params.paymentStatus = currPayment;
      if (currVehicle && currVehicle !== 'ALL') params.vehicleId = currVehicle;

      const data = await listShipments(params);
      if (data && data.content) {
        setShipments(data.content);
        setTotalPages(data.page?.totalPages ?? data.totalPages ?? 1);
        setTotalElements(data.page?.totalElements ?? data.totalElements ?? data.content.length);
      } else if (Array.isArray(data)) {
        setShipments(data);
        setTotalPages(1);
        setTotalElements(data.length);
      }
    } catch (err) {
      console.warn('Failed to load shipments from backend:', err?.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // Fetch when filters or page changes
  useEffect(() => {
    fetchShipments(page, pageSize, search, statusFilter, paymentFilter, vehicleFilter, true);
  }, [fetchShipments, page, pageSize, statusFilter, paymentFilter, vehicleFilter]);

  // Real-time SSE listener + Window focus listener
  useEffect(() => {
    const handleSilentRefresh = () => {
      fetchShipments(page, pageSize, search, statusFilter, paymentFilter, vehicleFilter, false);
    };

    // 1. Subscribe to real-time status updates and shipment creation
    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (event.type === 'STATUS_UPDATE' || event.type === 'SHIPMENT_CREATED' || event.type === 'LABEL_PRINTED') {
        handleSilentRefresh();
      }
    });

    // 2. Fallback on window focus
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleSilentRefresh);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleSilentRefresh);
      }
    };
  }, [fetchShipments, page, pageSize, search, statusFilter, paymentFilter, vehicleFilter]);

  // Debounced search
  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(0);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchShipments(0, pageSize, val, statusFilter, paymentFilter, vehicleFilter, true);
    }, 350);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="OPERATIONS"
        title="Shipments"
        right={<Button label="Register Shipment" variant="primary" onPress={() => router.push('/register')} />}
      />

      <SearchFilterBar
        searchValue={search}
        onSearchChange={handleSearchChange}
        placeholder="Search shipment, tracking ID, recipient, client..."
        filters={[
          {
            label: 'Status',
            value: statusFilter,
            onChange: (val) => {
              setStatusFilter(val);
              setPage(0);
            },
            options: STATUS_OPTIONS,
          },
          {
            label: 'Payment',
            value: paymentFilter,
            onChange: (val) => {
              setPaymentFilter(val);
              setPage(0);
            },
            options: PAYMENT_OPTIONS,
          },
          {
            label: 'Vehicle',
            value: vehicleFilter,
            onChange: (val) => {
              setVehicleFilter(val);
              setPage(0);
            },
            options: vehicleOptions,
          },
        ]}
      />

      <ShipmentsTable
        shipments={shipments}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalElements={totalElements}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(0);
        }}
        onView={(s) => router.push(`/shipments/${s.shipmentId}`)}
      />
    </AppShell>
  );
}
