import PreviewStatus from '../../components/common/PreviewStatus';
import { TableRowSkeleton } from '../../components/common/Skeleton';
import { useCachedPreview, requirePage, requireDirectory } from '../../services/api/useCachedPreview';
import { CACHE_SLOTS } from '../../services/api/responseCache.mjs';
import React from 'react';
import { useSavedPageState } from '../../services/navigation/useSavedPageState';
import { Text } from 'react-native';
import { colors, fonts, spacing } from '../../theme';
import { useRouter } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import SearchFilterBar from '../../components/common/SearchFilterBar';
import { ShipmentsTable, listShipments } from '../../features/shipments';
import { listVehicles } from '../../features/vehicles';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Status: All' },
  { value: 'Registered', label: 'Registered' },
  { value: 'QR Generated', label: 'QR Generated' },
  { value: 'Loaded on Truck', label: 'Loaded on Truck' },
  { value: 'Arrived at TNL', label: 'Arrived in Daet' },
  { value: 'Loaded to Hauler', label: 'Loaded to Hauler' },
  { value: 'Completed', label: 'Completed' },
];

const PAYMENT_OPTIONS = [
  { value: 'ALL', label: 'Payment: All' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Unpaid', label: 'Unpaid' },
  { value: 'Partial', label: 'Partial' },
];

export default function ShipmentsListScreen() {
  const router = useRouter();
  const [filterState, updateFilterState] = useSavedPageState('shipments_directory', {
    search: '',
    statusFilter: 'ALL',
    paymentFilter: 'ALL',
    vehicleFilter: 'ALL',
    page: 0,
    pageSize: 20,
  });
  const { search, statusFilter, paymentFilter, vehicleFilter, page, pageSize } = filterState;





  // Pagination state


  const query = { page, size: pageSize, search: search.trim(),
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    paymentStatus: paymentFilter === 'ALL' ? undefined : paymentFilter,
    vehicleId: vehicleFilter === 'ALL' ? undefined : vehicleFilter };
  const resource = useCachedPreview({ slot: CACHE_SLOTS.SHIPMENTS, query, pollMs: 30000,
    fetcher: async signal => requirePage(await listShipments(query, { signal })) });
  const directory = useCachedPreview({ slot: CACHE_SLOTS.VEHICLES, query: { all: true },
    fetcher: async signal => requireDirectory(await listVehicles(true, { signal })) });
  const vehicleOptions = [{ value: 'ALL', label: 'Vehicle: All' }, ...(directory.data || []).map(vehicle => ({ value: vehicle.vehicleId, label: `${vehicle.vehicleId} (${vehicle.plateNumber})` }))];
  const shipments = Array.isArray(resource.data) ? resource.data : resource.data?.content || [];
  const loading = resource.loading;
  const totalPages = resource.data?.page?.totalPages ?? resource.data?.totalPages ?? 1;
  const totalElements = resource.data?.page?.totalElements ?? resource.data?.totalElements ?? shipments.length;
  const handleSearchChange = value => { updateFilterState({ search: value, page: 0 }); };

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
              updateFilterState({ statusFilter: val, page: 0 });

            },
            options: STATUS_OPTIONS,
          },
          {
            label: 'Payment',
            value: paymentFilter,
            onChange: (val) => {
              updateFilterState({ paymentFilter: val, page: 0 });

            },
            options: PAYMENT_OPTIONS,
          },
          {
            label: 'Vehicle',
            value: vehicleFilter,
            onChange: (val) => {
              updateFilterState({ vehicleFilter: val, page: 0 });

            },
            options: vehicleOptions,
          },
        ]}
      />

      <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkFaint, marginBottom: spacing.sm }}>
        Vehicle filter includes current and previous assignments. The Vehicle column shows current assignments only.
      </Text>
      <PreviewStatus resource={directory} label="Vehicle filters" errorOnly />
      <PreviewStatus resource={resource} label="Shipments" />
      {loading ? <TableRowSkeleton /> : resource.data !== null ? <ShipmentsTable
        shipments={shipments}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalElements={totalElements}
        pageSize={pageSize}
        onPageChange={(newPage) => updateFilterState({ page: newPage })}
        onPageSizeChange={(newSize) => {
          updateFilterState({ pageSize: newSize, page: 0 });

        }}
        onView={(s) => router.push(`/shipments/${s.shipmentId}`)}
      /> : null}
    </AppShell>
  );
}
