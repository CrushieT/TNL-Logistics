import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/common/Button';
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
  const [waybills, setWaybills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [client, setClient] = useState('ALL');
  const [clientOptions, setClientOptions] = useState([{ value: 'ALL', label: 'Client: All' }]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let isMounted = true;
    listClients({ all: true })
      .then((data) => {
        if (!isMounted) return;
        const records = Array.isArray(data) ? data : (data?.content || []);
        const seen = new Set();
        const options = records
          .map((record) => record.name || record.clientId)
          .filter((name) => name && !seen.has(name) && seen.add(name))
          .sort((left, right) => left.localeCompare(right))
          .map((name) => ({ value: name, label: name }));
        setClientOptions([{ value: 'ALL', label: 'Client: All' }, ...options]);
      })
      .catch(() => {
        if (isMounted) setClientOptions([{ value: 'ALL', label: 'Client: All' }]);
      });
    return () => { isMounted = false; };
  }, []);

  const loadWaybills = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const response = await listWaybills({ page, size: pageSize, search: debouncedSearch, status, client });
      if (requestId !== requestSequence.current) return;
      const normalized = normalizeWaybillPage(response);
      setWaybills(normalized.content);
      setTotalPages(normalized.totalPages);
      setTotalElements(normalized.totalElements);
      if (normalized.page !== page) setPage(normalized.page);
    } catch {
      if (requestId !== requestSequence.current) return;
      setWaybills([]);
      setTotalPages(1);
      setTotalElements(0);
      setError('Could not load the waybill directory.');
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [client, debouncedSearch, page, pageSize, status]);

  useEffect(() => {
    loadWaybills();
  }, [loadWaybills]);

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

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Retry" variant="secondary" onPress={loadWaybills} style={styles.retryButton} />
        </View>
      ) : null}

      <WaybillsTable
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
      />
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
