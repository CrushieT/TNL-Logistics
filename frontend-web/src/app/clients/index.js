import CheckIcon from '../../components/common/CheckIcon';
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
import { useRouter } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  RegisterClientModal,
  DeactivateClientModal,
} from '../../features/clients';
import { subscribeRealtimeEvents } from '../../features/shipments';
import { colors, fonts, spacing, radius, type } from '../../theme';

const STATUS_FILTERS = ['ALL', 'Active', 'Inactive'];

export default function ClientsScreen() {
  const router = useRouter();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [clientToEdit, setClientToEdit] = useState(null);
  const [clientToDelete, setClientToDelete] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Action Feedback Alert State
  const [feedback, setFeedback] = useState(null);
  const feedbackTimer = useRef(null);

  const showFeedback = (message, type = 'success') => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ type, message });
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  const loadClientsData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const data = await listClients({ all: true });

      if (Array.isArray(data)) {
        setClients(data);
      } else if (data && data.content) {
        setClients(data.content);
      }
    } catch (err) {
      console.warn('Failed to fetch clients:', err?.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClientsData(true);
  }, [loadClientsData]);

  // Real-time SSE listener: auto-updates metrics and shipments
  useEffect(() => {
    const handleSilentRefresh = () => {
      loadClientsData(false);
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
  }, [loadClientsData]);

  const handleSaveClient = async (payload, clientId) => {
    if (clientId) {
      await updateClient(clientId, payload);
      showFeedback(`Client ${clientId} (${payload.name}) updated successfully.`);
    } else {
      const created = await createClient(payload);
      const newId = created?.clientId || created?.id || 'Client';
      showFeedback(`Client ${newId} (${payload.name}) registered successfully.`);
    }
    await loadClientsData(false);
  };

  const handleDeactivateClient = async (clientId) => {
    const target = clients.find((c) => (c.clientId || c.id) === clientId);
    const targetName = target?.name ? ` (${target.name})` : '';
    await deleteClient(clientId);
    showFeedback(`Client ${clientId}${targetName} removed / deactivated successfully.`);
    await loadClientsData(false);
  };

  // Status counts from all clients
  const counts = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.active !== false).length;
    const inactive = clients.filter((c) => c.active === false).length;
    return { ALL: total, Active: active, Inactive: inactive };
  }, [clients]);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return clients.filter((c) => {
      if (selectedStatus !== 'ALL') {
        const isClientActive = c.active !== false;
        if (selectedStatus === 'Active' && !isClientActive) return false;
        if (selectedStatus === 'Inactive' && isClientActive) return false;
      }
      if (query) {
        const idMatch = (c.clientId || c.id || '').toLowerCase().includes(query);
        const nameMatch = (c.name || '').toLowerCase().includes(query);
        const contactMatch = (c.contactNumber || '').toLowerCase().includes(query);
        const emailMatch = (c.email || '').toLowerCase().includes(query);
        const addrMatch = (c.address || '').toLowerCase().includes(query);
        return idMatch || nameMatch || contactMatch || emailMatch || addrMatch;
      }
      return true;
    });
  }, [clients, selectedStatus, searchQuery]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, pageSize]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const paginatedClients = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredClients.slice(startIdx, startIdx + pageSize);
  }, [filteredClients, currentPage, pageSize]);

  return (
    <AppShell>
      {/* Header Row */}
      <PageHeader
        eyebrow="BILLING & FINANCE"
        title="Clients"
        right={
          <Button
            label="Register Client"
            variant="primary"
            onPress={() => {
              setClientToEdit(null);
              setRegisterModalVisible(true);
            }}
          />
        }
      />

      {/* Feedback Confirmation Alert */}
      {feedback ? (
        <View style={styles.feedbackAlert}>
          <View style={styles.feedbackContent}>
            <CheckIcon size={14} color="#15803D" style={{ marginRight: 8, marginTop: 1 }} />
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
            const count = counts[status] !== undefined ? counts[status] : 0;
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
            placeholder="Search clients..."
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

      {/* Clients Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.headerCell, { flex: 0.9 }]}>CLIENT ID</Text>
          <Text style={[styles.headerCell, { flex: 2.1 }]}>NAME</Text>
          <Text style={[styles.headerCell, { flex: 1.3 }]}>TIER</Text>
          <Text style={[styles.headerCell, { flex: 1.3 }]}>CONTACT</Text>
          <Text style={[styles.headerCell, { flex: 0.9, textAlign: 'center' }]}>SHIPMENTS</Text>
          <Text style={[styles.headerCell, { flex: 1.2, textAlign: 'right' }]}>TOTAL CHARGES</Text>
          <Text style={[styles.headerCell, { flex: 1.0, textAlign: 'right' }]}>PAID</Text>
          <Text style={[styles.headerCell, { flex: 1.2, textAlign: 'right' }]}>OUTSTANDING</Text>
          <Text style={[styles.headerCell, { flex: 1.5, textAlign: 'right' }]}>ACTIONS</Text>
        </View>

        {loading && clients.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.inkFaint} />
            <Text style={styles.loadingText}>Loading client directory...</Text>
          </View>
        ) : filteredClients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {clients.length === 0 ? 'No clients registered yet.' : 'No clients match your search or filter.'}
            </Text>
          </View>
        ) : (
          paginatedClients.map((c, idx) => {
            const cid = c.clientId || c.id;
            const hasBalance = Number(c.outstandingBalance || 0) > 0;
            return (
              <View
                key={cid}
                style={[
                  styles.tableRow,
                  idx !== paginatedClients.length - 1 && styles.rowDivider,
                  !c.active && styles.inactiveRow,
                ]}
              >
                <Text style={[styles.cellMono, { flex: 0.9 }]}>{cid}</Text>
                
                <View style={[styles.nameCol, { flex: 2.1 }]}>
                  <Text style={styles.cellStrong}>{c.name}</Text>
                  <Text style={styles.cellSubtext} numberOfLines={1}>
                    {c.email || c.address || '-'}
                  </Text>
                </View>

                <View style={[styles.tierCol, { flex: 1.3 }]}>
                  {c.ratePerKilo !== null && c.ratePerKilo !== undefined ? (
                    <View style={styles.vipBadge}>
                      <Text style={styles.vipBadgeText}>VIP · ₱{Number(c.ratePerKilo).toFixed(2)}/kg</Text>
                    </View>
                  ) : (
                    <View style={styles.regularBadge}>
                      <Text style={styles.regularBadgeText}>REGULAR</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.cell, { flex: 1.3 }]}>{c.contactNumber || '-'}</Text>
                <Text style={[styles.cellCenterMono, { flex: 0.9 }]}>{c.totalShipments || 0}</Text>
                <Text style={[styles.cellRightMono, { flex: 1.2 }]}>
                  ₱{Number(c.totalCharges || 0).toLocaleString()}
                </Text>
                <Text style={[styles.paidRightMono, { flex: 1.0 }]}>
                  ₱{Number(c.totalPaid || 0).toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.cellRightMono,
                    hasBalance ? styles.outstandingDue : styles.outstandingZero,
                    { flex: 1.2 },
                  ]}
                >
                  ₱{Number(c.outstandingBalance || 0).toLocaleString()}
                </Text>

                <View style={[styles.actionsCell, { flex: 1.5 }]}>
                  <Pressable
                    onPress={() => {
                      setClientToEdit(c);
                      setRegisterModalVisible(true);
                    }}
                  >
                    <Text style={styles.actionEdit}>Edit</Text>
                  </Pressable>
                  <Text style={styles.actionSep}>|</Text>
                  <Pressable onPress={() => setClientToDelete(c)}>
                    <Text style={styles.actionDelete}>Delete</Text>
                  </Pressable>
                  <Text style={styles.actionSep}>|</Text>
                  <Pressable onPress={() => router.push(`/clients/${cid}`)}>
                    <Text style={styles.actionView}>View</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {/* Pagination Footer matching Shipments format */}
        <View style={styles.paginationFooter}>
          <View style={styles.paginationInfo}>
            <Text style={styles.paginationText}>
              Showing <Text style={styles.paginationTextStrong}>{paginatedClients.length}</Text> of{' '}
              <Text style={styles.paginationTextStrong}>{filteredClients.length}</Text> clients
              <Text style={styles.paginationDot}> | </Text>
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
              label="Previous"
              variant="secondary"
              disabled={currentPage <= 1 || loading}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={styles.pageBtn}
            />

            <Button
              label="Next"
              variant="secondary"
              disabled={currentPage >= totalPages || loading}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={styles.pageBtn}
            />
          </View>
        </View>
      </View>

      {/* Register / Edit Client Modal */}
      <RegisterClientModal
        visible={registerModalVisible}
        clientToEdit={clientToEdit}
        onClose={() => {
          setRegisterModalVisible(false);
          setClientToEdit(null);
        }}
        onSaved={handleSaveClient}
      />

      {/* Smart Delete / Deactivate Confirmation Modal */}
      <DeactivateClientModal
        visible={Boolean(clientToDelete)}
        client={clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={handleDeactivateClient}
      />
    </AppShell>
  );
}

const webSelectStyle = {
  fontFamily: fonts.mono,
  fontSize: 12.5,
  color: colors.inkSoft,
  backgroundColor: '#FAF9F5',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  padding: '6px 10px',
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 260,
    flex: 1,
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13.5,
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
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkSoft,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
  },
  table: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F5',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCell: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inactiveRow: {
    backgroundColor: '#FAF9F6',
  },
  cellMono: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  nameCol: {
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tierCol: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  vipBadge: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  vipBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.warning,
  },
  regularBadge: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  regularBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.inkFaint,
  },
  cellStrong: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  cellSubtext: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
  },
  cell: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
  },
  cellCenterMono: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
  },
  cellRightMono: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
  },
  paidRightMono: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'right',
  },
  outstandingDue: {
    color: colors.accent,
  },
  outstandingZero: {
    color: colors.success,
  },
  actionsCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  actionEdit: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  actionSep: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
  },
  actionDelete: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  actionView: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  paginationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#FAF9F5',
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
    fontSize: 12.5,
    color: colors.inkSoft,
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
