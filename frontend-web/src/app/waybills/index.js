import PreviewStatus from '../../components/common/PreviewStatus';
import { TableRowSkeleton } from '../../components/common/Skeleton';
import { useCachedPreview, requirePage, requireDirectory } from '../../services/api/useCachedPreview';
import { CACHE_SLOTS } from '../../services/api/responseCache.mjs';
import React, { useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import PageHeader from '../../components/layout/PageHeader';
import SearchFilterBar from '../../components/common/SearchFilterBar';
import { listClients } from '../../features/clients';
import {
  buildWaybillDetailRoute,
  listWaybills,
  normalizeWaybillPage,
  WaybillsTable,
} from '../../features/waybills';
import { colors, fonts, radius, spacing } from '../../theme';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Status: All' },
  { value: 'GENERATED', label: 'Generated' },
  { value: 'SENT_TO_HAULER', label: 'Sent to Hauler' },
  { value: 'SIGNED_COMPLETED', label: 'Signed / Completed' },
];

export default function WaybillsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [client, setClient] = useState('ALL');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const query = { page, size: pageSize, search: search.trim(), status: status === 'ALL' ? undefined : status, client: client === 'ALL' ? undefined : client };
  const resource = useCachedPreview({ slot: CACHE_SLOTS.WAYBILLS, query,
    fetcher: async signal => requirePage(await listWaybills(query, { signal })) });
  const directory = useCachedPreview({ slot: CACHE_SLOTS.CLIENTS, query: { all: true },
    fetcher: async signal => requireDirectory(await listClients({ all: true }, { signal })) });
  const names = [...new Set((directory.data || []).map(record => record.name || record.clientId).filter(Boolean))].sort();
  const clientOptions = [{ value: 'ALL', label: 'Client: All' }, ...names.map(name => ({ value: name, label: name }))];
  const normalized = normalizeWaybillPage(resource.data);
  const waybills = normalized.content;
  const totalPages = normalized.totalPages;
  const totalElements = normalized.totalElements;
  const loading = resource.loading;

  const openWaybill = (waybill) => {
    router.push(buildWaybillDetailRoute(waybill.waybillId));
  };

  return (
    <AppShell>
      <PageHeader eyebrow="BILLING & FINANCE" title="Waybills" />

      <SearchFilterBar
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Search waybill, shipment, client, recipient, or hauler..."
        filters={[
          {
            label: 'Status',
            value: status,
            onChange: (value) => {
              setStatus(value);
              setPage(0);
            },
            options: STATUS_OPTIONS,
          },
          {
            label: 'Client',
            value: client,
            onChange: (value) => {
              setClient(value);
              setPage(0);
            },
            options: clientOptions,
          },
        ]}
      />

      <PreviewStatus resource={directory} label="Client filters" />
      <PreviewStatus resource={resource} label="Waybills" />
      {loading ? <TableRowSkeleton /> : resource.data !== null ?       <WaybillsTable
        waybills={waybills}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalElements={totalElements}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(0);
        }}
        onView={openWaybill}
      /> : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { fontFamily: fonts.sans, fontSize: 13, color: colors.danger },
  retryButton: { minHeight: 32, paddingVertical: 5, paddingHorizontal: spacing.md },
});
