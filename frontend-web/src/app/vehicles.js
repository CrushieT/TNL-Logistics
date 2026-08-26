import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AppShell from '../components/layout/AppShell';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import StatusBadge from '../components/common/StatusBadge';
import {
  listVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  RegisterVehicleModal,
  DeactivateVehicleModal,
} from '../features/vehicles';
import { subscribeRealtimeEvents } from '../features/shipments';
import { colors, fonts, spacing, radius, type } from '../theme';

const STATUS_FILTERS = ['ALL', 'Active', 'In Maintenance', 'Inactive'];

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [vehicleToEdit, setVehicleToEdit] = useState(null);
  const [vehicleToDelete, setVehicleToDelete] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Action Feedback Alert State
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'info', message: string }
  const feedbackTimer = useRef(null);

  const showFeedback = (message, type = 'success') => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ type, message });
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  const loadVehiclesData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const data = await listVehicles(true);
      if (Array.isArray(data)) {
        setVehicles(data);
      }
    } catch (err) {
      console.warn('Failed to fetch vehicles:', err?.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehiclesData(true);
  }, [loadVehiclesData]);

  // Real-time SSE listener: auto-update ON TRUCK counts and vehicle statuses upon scan events
  useEffect(() => {
    const handleSilentRefresh = () => {
      loadVehiclesData(false);
    };

    const unsubscribe = subscribeRealtimeEvents(() => {
      handleSilentRefresh();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleSilentRefresh);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleSilentRefresh);
      }
    };
  }, [loadVehiclesData]);

  const handleSaveVehicle = async (payload, vehicleId) => {
    if (vehicleId) {
      await updateVehicle(vehicleId, payload);
      showFeedback(`Vehicle ${vehicleId} (${payload.plateNumber}) updated successfully.`);
    } else {
      const created = await createVehicle(payload);
      const newId = created?.vehicleId || 'Vehicle';
      showFeedback(`Vehicle ${newId} (${payload.plateNumber}) registered successfully.`);
    }
    await loadVehiclesData(false);
  };

  const handleDeactivateVehicle = async (vehicleId) => {
    const target = vehicles.find((v) => v.vehicleId === vehicleId);
    const targetPlate = target?.plateNumber ? ` (${target.plateNumber})` : '';
    await deleteVehicle(vehicleId);
    showFeedback(`Vehicle ${vehicleId}${targetPlate} removed / deactivated successfully.`);
    await loadVehiclesData(false);
  };

  // Status counts
  const counts = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter((v) => v.status === 'Active' || (v.active && !v.status)).length;
    const maint = vehicles.filter((v) => v.status === 'In Maintenance').length;
    const inactive = vehicles.filter((v) => v.status === 'Inactive' || (!v.active && !v.status)).length;
    return { ALL: total, Active: active, 'In Maintenance': maint, Inactive: inactive };
  }, [vehicles]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return vehicles.filter((v) => {
      // Status filter
      if (selectedStatus !== 'ALL') {
        const vStatus = v.status || (v.active ? 'Active' : 'Inactive');
        if (vStatus !== selectedStatus) return false;
      }

      // Search query filter
      if (query) {
        const idMatch = (v.vehicleId || '').toLowerCase().includes(query);
        const plateMatch = (v.plateNumber || '').toLowerCase().includes(query);
        const typeMatch = (v.vehicleType || '').toLowerCase().includes(query);
        const descMatch = (v.description || '').toLowerCase().includes(query);
        return idMatch || plateMatch || typeMatch || descMatch;
      }

      return true;
    });
  }, [vehicles, selectedStatus, searchQuery]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, pageSize]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const paginatedVehicles = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredVehicles.slice(startIdx, startIdx + pageSize);
  }, [filteredVehicles, currentPage, pageSize]);

  return (
    <AppShell>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>FLEET REGISTRY · ADMIN / OFFICE</Text>
          <Text style={styles.title}>VEHICLES / TRUCKS</Text>
        </View>
        <Button
          label="+ Register Vehicle"
          variant="primary"
          onPress={() => {
            setVehicleToEdit(null);
            setRegisterModalVisible(true);
          }}
        />
      </View>

      {/* Notice Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          Only <Text style={styles.boldText}>Active</Text> vehicles appear in the mobile field truck selection. Field Staff never type a plate manually — they pick a registered truck when confirming <Text style={styles.boldText}>Loaded on Truck</Text>.
        </Text>
      </View>

      {/* Feedback Confirmation Alert */}
      {feedback ? (
        <View style={styles.feedbackAlert}>
          <View style={styles.feedbackContent}>
            <Text style={styles.feedbackCheckmark}>✓</Text>
            <Text style={styles.feedbackText}>{feedback.message}</Text>
          </View>
          <Pressable onPress={() => setFeedback(null)} style={styles.feedbackCloseBtn}>
            <Text style={styles.feedbackCloseText}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Search & Filter Toolbar */}
      <View style={styles.toolbar}>
        {/* Status Filter Pills */}
        <View style={styles.filterPills}>
          {STATUS_FILTERS.map((status) => {
            const isSelected = selectedStatus === status;
            const count = counts[status] || 0;
            return (
              <Pressable
                key={status}
                style={[styles.pill, isSelected && styles.pillActive]}
                onPress={() => setSelectedStatus(status)}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                  {status === 'ALL' ? 'All' : status} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ID, plate, type, or description..."
            placeholderTextColor={colors.inkFaint}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Vehicles Table Card */}
      <Card style={styles.card}>
        {loading && vehicles.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.ink} />
            <Text style={styles.loadingText}>Loading fleet registry...</Text>
          </View>
        ) : filteredVehicles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {vehicles.length === 0 ? 'No vehicles registered yet.' : 'No vehicles match your search or filter.'}
            </Text>
          </View>
        ) : (
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.headerCell, { flex: 1.1 }]}>VEHICLE ID</Text>
              <Text style={[styles.headerCell, { flex: 1.3 }]}>PLATE / REGISTRATION</Text>
              <Text style={[styles.headerCell, { flex: 1.6 }]}>TYPE</Text>
              <Text style={[styles.headerCell, { flex: 2.2 }]}>DESCRIPTION</Text>
              <Text style={[styles.headerCell, { flex: 1.3 }]}>STATUS</Text>
              <Text style={[styles.headerCell, { flex: 0.9, textAlign: 'center' }]}>ON TRUCK</Text>
              <Text style={[styles.headerCell, { flex: 1.5 }]}>REMARKS</Text>
              <Text style={[styles.headerCell, { flex: 1.2, textAlign: 'right' }]}>ACTIONS</Text>
            </View>

            {/* Table Rows */}
            {paginatedVehicles.map((v, idx) => (
              <View
                key={v.vehicleId}
                style={[
                  styles.tableRow,
                  idx !== paginatedVehicles.length - 1 && styles.rowDivider,
                  !v.active && styles.inactiveRow,
                ]}
              >
                <Text style={[styles.cellMono, { flex: 1.1 }]}>{v.vehicleId}</Text>
                <Text style={[styles.cellStrong, { flex: 1.3 }]}>{v.plateNumber}</Text>
                <Text style={[styles.cell, { flex: 1.6 }]}>{v.vehicleType || '6-Wheeler Forward'}</Text>
                <Text style={[styles.cell, { flex: 2.2 }]}>{v.description}</Text>
                <View style={{ flex: 1.3 }}>
                  <StatusBadge
                    value={v.status || (v.active ? 'Active' : 'Inactive')}
                    kind="status"
                  />
                </View>
                <Text style={[styles.cellOnTruck, { flex: 0.9 }]}>{v.onTruckCount || 0}</Text>
                <Text style={[styles.cellFaint, { flex: 1.5 }]}>{v.remarks || '—'}</Text>
                <View style={[styles.actionsCell, { flex: 1.2 }]}>
                  <Pressable
                    onPress={() => {
                      setVehicleToEdit(v);
                      setRegisterModalVisible(true);
                    }}
                  >
                    <Text style={styles.actionEdit}>Edit</Text>
                  </Pressable>
                  <Text style={styles.actionSep}>·</Text>
                  <Pressable onPress={() => setVehicleToDelete(v)}>
                    <Text style={styles.actionDelete}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Pagination Footer matching Shipments format */}
            <View style={styles.paginationFooter}>
              <View style={styles.paginationInfo}>
                <Text style={styles.paginationText}>
                  Showing <Text style={styles.paginationTextStrong}>{paginatedVehicles.length}</Text> of{' '}
                  <Text style={styles.paginationTextStrong}>{filteredVehicles.length}</Text> vehicles
                  <Text style={styles.paginationDot}> · </Text>
                  Page <Text style={styles.paginationTextStrong}>{currentPage}</Text> of{' '}
                  <Text style={styles.paginationTextStrong}>{totalPages || 1}</Text>
                </Text>
              </View>

              <View style={styles.paginationActions}>
                {Platform.OS === 'web' ? (
                  <View style={styles.pageSizeSelectWrap}>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      style={webSelectStyle}
                    >
                      <option value={10}>10 / page</option>
                      <option value={20}>20 / page</option>
                      <option value={50}>50 / page</option>
                    </select>
                  </View>
                ) : null}

                <Button
                  label="← Previous"
                  variant="secondary"
                  disabled={currentPage <= 1 || loading}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={styles.pageBtn}
                />

                <Button
                  label="Next →"
                  variant="secondary"
                  disabled={currentPage >= totalPages || loading}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={styles.pageBtn}
                />
              </View>
            </View>
          </View>
        )}
      </Card>

      {/* Register / Edit Vehicle Modal */}
      <RegisterVehicleModal
        visible={registerModalVisible}
        vehicleToEdit={vehicleToEdit}
        onClose={() => {
          setRegisterModalVisible(false);
          setVehicleToEdit(null);
        }}
        onSaved={handleSaveVehicle}
      />

      {/* Bespoke Smart Delete / Deactivate Confirmation Modal */}
      <DeactivateVehicleModal
        visible={Boolean(vehicleToDelete)}
        vehicle={vehicleToDelete}
        onClose={() => setVehicleToDelete(null)}
        onConfirm={handleDeactivateVehicle}
      />
    </AppShell>
  );
}

const webSelectStyle = {
  fontFamily: fonts.mono,
  fontSize: 11.5,
  color: colors.ink,
  border: `1px solid ${colors.border}`,
  backgroundColor: '#FFFFFF',
  padding: '6px 8px',
  borderRadius: 3,
  outline: 'none',
  cursor: 'pointer',
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.inkFaint,
    marginBottom: 2,
  },
  title: {
    ...type.screenTitle,
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  banner: {
    backgroundColor: '#F3F2ED',
    borderWidth: 1,
    borderColor: '#E1DFD5',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  feedbackAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: '#B8E2C8',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    marginBottom: spacing.md,
  },
  feedbackContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  feedbackCheckmark: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '800',
    color: colors.success,
  },
  feedbackText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.ink,
  },
  feedbackCloseBtn: {
    padding: 4,
    marginLeft: spacing.sm,
  },
  feedbackCloseText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    fontWeight: '700',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  filterPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  pillText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 280,
    flex: 1,
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
    paddingVertical: 7,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    fontWeight: '700',
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
  },
  table: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F7F3',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCell: {
    ...type.label,
    fontSize: 10,
    color: colors.inkFaint,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EFEA',
  },
  inactiveRow: {
    backgroundColor: '#FAF9F6',
  },
  cellMono: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  cellStrong: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  cell: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink,
  },
  cellOnTruck: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  cellFaint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
  },
  actionsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  actionEdit: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  actionSep: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
  },
  actionDelete: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  paginationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paginationText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
  },
  paginationTextStrong: {
    fontFamily: fonts.mono,
    fontWeight: '700',
    color: colors.ink,
  },
  paginationDot: {
    color: colors.borderStrong,
  },
  paginationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageSizeSelectWrap: {
    marginRight: spacing.xs,
  },
  pageBtn: {
    minWidth: 84,
  },
});
