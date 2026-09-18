import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../../theme';
import { shipmentApi } from '../services/shipmentApi';
import { BarcodeScannerModal } from './BarcodeScannerModal';

export function FindParcelScreen({ initialFilter = 'ALL' }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(initialFilter); // 'ALL' | 'NEEDS_LABEL'
  const [shipments, setShipments] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const abortControllerRef = useRef(null);

  const fetchShipments = useCallback(async (targetPage, isAppend = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!isAppend) {
      setIsLoading(true);
      setError('');
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await shipmentApi.listShipments(
        {
          search: search.trim(),
          labelStatus: activeFilter === 'NEEDS_LABEL' ? 'NEEDS_LABEL' : undefined,
          page: targetPage,
          size: 20,
        },
        controller.signal
      );

      if (controller.signal.aborted) return;

      const newContent = response.content || [];
      setTotalElements(response.totalElements || 0);
      setTotalPages(response.totalPages || 0);
      setHasMore(!response.last && newContent.length > 0);
      setPage(targetPage);

      if (isAppend) {
        setShipments((prev) => {
          const existingIds = new Set(prev.map((s) => s.shipmentId));
          const unique = newContent.filter((s) => !existingIds.has(s.shipmentId));
          return [...prev, ...unique];
        });
      } else {
        setShipments(newContent);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError('Unable to load shipments. Check connection and retry.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    }
  }, [search, activeFilter]);

  // Debounced search / filter reload
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchShipments(0, false);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchShipments]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchShipments(0, false);
  };

  const handleEndReached = () => {
    if (hasMore && !isLoading && !isLoadingMore) {
      fetchShipments(page + 1, true);
    }
  };

  const handleBarcodeScanned = (scannedCode) => {
    setIsScannerOpen(false);
    const code = scannedCode.trim();
    if (code.startsWith('TRK-')) {
      router.push(`/(main)/shipments/parcel/${encodeURIComponent(code)}`);
    } else if (code.startsWith('SHP-')) {
      router.push(`/(main)/shipments/${encodeURIComponent(code)}`);
    } else {
      setSearch(code);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to office dashboard"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle}>FIND PARCEL</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          accessibilityLabel="Search by tracking ID, name, or contact number"
          style={styles.searchInput}
          placeholder="Tracking ID, name, or contact..."
          placeholderTextColor={colors.inkFaint}
          value={search}
          onChangeText={(val) => {
            setSearch(val);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* Filter Tabs matching prototype: RECENT / ALL | NEEDS LABEL | SCAN QR */}
      <View style={styles.filterBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveFilter('ALL')}
          style={[styles.filterTab, activeFilter === 'ALL' && styles.filterTabActive]}
        >
          <Text style={[styles.filterTabText, activeFilter === 'ALL' && styles.filterTabTextActive]}>
            RECENT / ALL
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveFilter('NEEDS_LABEL')}
          style={[styles.filterTab, activeFilter === 'NEEDS_LABEL' && styles.filterTabActive]}
        >
          <Text style={[styles.filterTabText, activeFilter === 'NEEDS_LABEL' && styles.filterTabTextActive]}>
            NEEDS LABEL
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setIsScannerOpen(true)}
          style={styles.scanQrTab}
        >
          <Text style={styles.scanQrText}>⛶ SCAN QR</Text>
        </Pressable>
      </View>

      {/* Count Info Subhead */}
      <View style={styles.subhead}>
        <Text style={styles.subheadText}>
          {totalElements} {totalElements === 1 ? 'shipment' : 'shipments'} · includes parcels registered on the office PC
        </Text>
      </View>

      {/* Shipments List */}
      <FlatList
        data={shipments}
        keyExtractor={(item) => item.shipmentId}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.accent]} />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          !isLoading && !error ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No matching shipments found</Text>
              <Text style={styles.emptyBody}>Try adjusting your search keywords or filter tab.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {isLoading && !isRefreshing ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : null}
            {isLoadingMore ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : null}
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={() => fetchShipments(page, false)} style={styles.retryBtn}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isPc = item.registeredVia === 'DESKTOP_OFFICE';
          const isAllPrinted = item.allLabelsPrinted === true;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Shipment ${item.shipmentId} for ${item.recipientName}`}
              style={styles.card}
              onPress={() => router.push(`/(main)/shipments/${encodeURIComponent(item.shipmentId)}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.shipmentId}>{item.shipmentId}</Text>
                <Text style={styles.sourceBadge}>{isPc ? 'PC' : 'MOBILE'}</Text>
              </View>

              <Text style={styles.recipientName}>{item.recipientName}</Text>

              <Text style={styles.cardSub}>
                {item.quantity} {item.quantity === 1 ? 'unit' : 'units'} · {item.recipientContact || 'No contact'}
              </Text>

              <View style={styles.cardFooter}>
                <View style={styles.statusBox}>
                  <Text style={styles.statusText}>{item.status || 'Registered'}</Text>
                </View>
                <Text style={[styles.labelText, isAllPrinted ? styles.labelPrinted : styles.labelNeeds]}>
                  {isAllPrinted ? 'labels printed' : 'needs label'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <BarcodeScannerModal
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  backArrow: { fontSize: 24, color: colors.ink, fontWeight: '700' },
  headerTitle: { ...typography.eyebrow, fontSize: 13, letterSpacing: 1, color: colors.ink },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchInput: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.ink,
    fontFamily: 'monospace',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  filterTab: {
    flex: 1,
    minHeight: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  filterTabActive: {
    backgroundColor: colors.black,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  filterTabTextActive: {
    color: colors.surface,
  },
  scanQrTab: {
    flex: 1,
    minHeight: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanQrText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  subhead: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  subheadText: {
    ...typography.bodySmall,
    color: colors.inkFaint,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  shipmentId: {
    ...typography.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  sourceBadge: {
    ...typography.mono,
    fontSize: 11,
    color: colors.inkFaint,
    fontWeight: '700',
  },
  recipientName: {
    ...typography.h2,
    fontSize: 16,
    color: colors.ink,
    marginTop: spacing.xs,
  },
  cardSub: {
    ...typography.bodySmall,
    color: colors.inkSoft,
    marginTop: spacing.xs,
    fontFamily: 'monospace',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  statusBox: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surface,
  },
  statusText: {
    ...typography.mono,
    fontSize: 11,
    color: colors.ink,
    fontWeight: '600',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  labelPrinted: {
    color: colors.success,
  },
  labelNeeds: {
    color: colors.accent,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.h2,
    fontSize: 15,
    marginBottom: spacing.xs,
    color: colors.ink,
  },
  emptyBody: {
    ...typography.bodySmall,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
  },
  retryBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
});
