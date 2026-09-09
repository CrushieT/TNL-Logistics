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
import TablePaginationFooter from '../features/reports/components/TablePaginationFooter';
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  resetPin,
  CreateUserModal,
  EditUserModal,
  ViewUserModal,
  DeleteUserModal,
} from '../features/users';
import { colors, fonts, spacing, radius, type } from '../theme';

const ROLE_FILTERS = ['ALL', 'ADMIN', 'OFFICE_STAFF', 'FIELD_STAFF'];
const STATUS_FILTERS = ['ALL', 'Active', 'Inactive'];

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  OFFICE_STAFF: 'Office Staff',
  FIELD_STAFF: 'Field Staff',
};

const PLATFORM_ACCESS = {
  ADMIN: 'Full access · shared system',
  OFFICE_STAFF: 'Desktop + Mobile (office) · shared system',
  FIELD_STAFF: 'Mobile (scan-only) · shared system',
};

function RoleChip({ role }) {
  const colors = {
    ADMIN: { bg: '#EFF6FF', text: '#1D4ED8' },
    OFFICE_STAFF: { bg: '#F0FDF4', text: '#15803D' },
    FIELD_STAFF: { bg: '#FFF7ED', text: '#C2410C' },
  };
  const c = colors[role] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <View style={[chipStyles.base, { backgroundColor: c.bg }]}>
      <Text style={[chipStyles.text, { color: c.text }]}>{ROLE_LABELS[role] || role}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  base: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
  },
});

export default function UsersScreen() {
  const [users, setUsers] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToView, setUserToView] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const [feedback, setFeedback] = useState(null);
  const feedbackTimer = useRef(null);

  const showFeedback = (message) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(message);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 4500);
  };

  const loadUsers = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const apiRole = roleFilter === 'ALL' ? 'all' : roleFilter;
      const apiStatus = statusFilter === 'ALL' ? 'all' : statusFilter.toLowerCase();
      const result = await listUsers({ role: apiRole, status: apiStatus, page: currentPage, size: pageSize });
      setUsers(result?.content || []);
      setTotalItems(result?.page?.totalElements ?? result?.totalElements ?? 0);
    } catch (err) {
      console.warn('Failed to load users:', err?.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [roleFilter, statusFilter, currentPage, pageSize]);

  useEffect(() => {
    loadUsers(true);
  }, [loadUsers]);

  useEffect(() => {
    setCurrentPage(0);
  }, [roleFilter, statusFilter, pageSize, searchQuery]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) =>
      (u.fullName || '').toLowerCase().includes(query) ||
      (u.username || '').toLowerCase().includes(query) ||
      (u.userId || '').toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleCreateUser = async (payload) => {
    const created = await createUser(payload);
    showFeedback(`Account ${created?.userId} (${created?.username}) created successfully.`);
    await loadUsers(false);
  };

  const handleUpdateUser = async (payload, userId) => {
    await updateUser(userId, payload);
    showFeedback(`Account ${userId} updated successfully.`);
    await loadUsers(false);
  };

  const handleDeleteUser = async (userId) => {
    await deleteUser(userId);
    showFeedback(`Account ${userId} removed or deactivated successfully.`);
    await loadUsers(false);
  };

  const handleResetPassword = async (userId, newPasswordValue) => {
    await resetPassword(userId, newPasswordValue);
    showFeedback(`Password reset for ${userId}. They will be prompted to change it on next login.`);
  };

  const handleResetPin = async (userId, pinValue) => {
    await resetPin(userId, pinValue);
    showFeedback(`Mobile PIN updated for ${userId}.`);
  };

  return (
    <AppShell>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>ROLE-BASED ACCESS</Text>
          <Text style={styles.title}>USERS / STAFF</Text>
        </View>
        <Button
          label="+ Create User"
          variant="primary"
          onPress={() => setCreateModalVisible(true)}
        />
      </View>

      {/* Feedback Banner */}
      {feedback ? (
        <View style={styles.feedbackAlert}>
          <View style={styles.feedbackContent}>
            <Text style={styles.feedbackCheckmark}>✓</Text>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
          <Pressable onPress={() => setFeedback(null)} style={styles.feedbackCloseBtn}>
            <Text style={styles.feedbackCloseText}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Toolbar */}
      <Card style={styles.toolbarCard}>
        <View style={styles.toolbar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, username, or ID..."
            placeholderTextColor={colors.inkFaint}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.filtersRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>ROLE</Text>
              <View style={styles.pillRow}>
                {ROLE_FILTERS.map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.filterPill, roleFilter === r && styles.filterPillActive]}
                    onPress={() => setRoleFilter(r)}
                  >
                    <Text style={[styles.filterPillText, roleFilter === r && styles.filterPillTextActive]}>
                      {r === 'ALL' ? 'All' : ROLE_LABELS[r]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>STATUS</Text>
              <View style={styles.pillRow}>
                {STATUS_FILTERS.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.filterPill, statusFilter === s && styles.filterPillActive]}
                    onPress={() => setStatusFilter(s)}
                  >
                    <Text style={[styles.filterPillText, statusFilter === s && styles.filterPillTextActive]}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Card>

      {/* Users Table */}
      <Card style={styles.tableCard}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.col, styles.colId, styles.headerText]}>ID</Text>
          <Text style={[styles.col, styles.colName, styles.headerText]}>NAME</Text>
          <Text style={[styles.col, styles.colRole, styles.headerText]}>ROLE</Text>
          <Text style={[styles.col, styles.colAccess, styles.headerText]}>PLATFORM ACCESS</Text>
          <Text style={[styles.col, styles.colStatus, styles.headerText]}>STATUS</Text>
          <Text style={[styles.col, styles.colActions, styles.headerText]}>ACTIONS</Text>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.inkSoft} />
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>No staff accounts found.</Text>
          </View>
        ) : (
          filteredUsers.map((user, idx) => (
            <View
              key={user.userId}
              style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
            >
              <Text style={[styles.col, styles.colId, styles.monoText]}>{user.userId}</Text>
              <Text style={[styles.col, styles.colName, styles.cellText]}>{user.fullName}</Text>
              <View style={[styles.col, styles.colRole]}>
                <RoleChip role={user.role} />
              </View>
              <Text style={[styles.col, styles.colAccess, styles.accessText]} numberOfLines={2}>
                {PLATFORM_ACCESS[user.role] || '—'}
              </Text>
              <View style={[styles.col, styles.colStatus]}>
                <StatusBadge status={user.active ? 'Active' : 'Inactive'} />
              </View>
              <View style={[styles.col, styles.colActions, styles.actionsRow]}>
                <Pressable style={styles.actionBtn} onPress={() => setUserToView(user)}>
                  <Text style={styles.actionBtnText}>View</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => setUserToEdit(user)}>
                  <Text style={styles.actionBtnText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={() => setUserToDelete(user)}
                >
                  <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <TablePaginationFooter
          totalItems={totalItems}
          currentCount={filteredUsers.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(0); }}
          pageSizeOptions={[10, 20, 50]}
          itemLabel="users"
          loading={loading}
        />
      </Card>

      {/* Role Capability Reference Cards */}
      <View style={styles.capabilityRow}>
        <View style={[styles.capabilityCard, { flex: 1 }]}>
          <Text style={styles.capabilityTitle}>ADMINISTRATOR / OFFICE STAFF</Text>
          {[
            'Register clients, shipments & parcels',
            'Generate QR + manage QR / label printing',
            'Register & manage vehicles (trucks)',
            'Record payments, weekly collections & SOA (deductions, Collected By)',
            'Generate & manage waybills',
            'Tracking monitoring & reports',
          ].map((item) => (
            <View key={item} style={styles.capabilityItem}>
              <Text style={styles.capabilityCheck}>✓</Text>
              <Text style={styles.capabilityText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.capabilityNote}>
            Office Staff use the same mobile app (authorized Office workflows). Administrator = full access.
          </Text>
        </View>

        <View style={[styles.capabilityCard, { flex: 1 }]}>
          <Text style={styles.capabilityTitle}>FIELD STAFF (SCAN-ONLY)</Text>
          {[
            'Login · Change Password · Logout',
            'Scan QR → parcel / shipment details',
            'See current status & valid next action',
            'Select registered truck when loading',
            'Confirm status · view tracking history',
          ].map((item) => (
            <View key={item} style={styles.capabilityItem}>
              <Text style={styles.capabilityCheck}>✓</Text>
              <Text style={styles.capabilityText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.capabilityRestriction}>
            No registration, QR generation, printing, payments, SOA, deductions, collections, user or vehicle administration. The role model blocks these actions — not just their buttons.
          </Text>
        </View>
      </View>

      {/* Modals */}
      <CreateUserModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSaved={handleCreateUser}
      />

      <EditUserModal
        visible={Boolean(userToEdit)}
        userToEdit={userToEdit}
        onClose={() => setUserToEdit(null)}
        onSaved={handleUpdateUser}
        onResetPassword={handleResetPassword}
        onResetPin={handleResetPin}
      />

      <ViewUserModal
        visible={Boolean(userToView)}
        user={userToView}
        onClose={() => setUserToView(null)}
        onEdit={(u) => { setUserToView(null); setUserToEdit(u); }}
      />

      <DeleteUserModal
        visible={Boolean(userToDelete)}
        user={userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDeleteUser}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  feedbackAlert: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  feedbackContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  feedbackCheckmark: { fontFamily: fonts.sans, fontSize: 14, color: '#15803D', fontWeight: '800' },
  feedbackText: { fontFamily: fonts.sans, fontSize: 12.5, color: '#166534', fontWeight: '600', flex: 1 },
  feedbackCloseBtn: { paddingLeft: spacing.sm },
  feedbackCloseText: { fontFamily: fonts.sans, fontSize: 13, color: '#166534', fontWeight: '700' },
  toolbarCard: { marginBottom: spacing.md, padding: 0 },
  toolbar: { padding: spacing.lg, gap: spacing.md },
  searchInput: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  filtersRow: { flexDirection: 'row', gap: spacing.xl, flexWrap: 'wrap' },
  filterGroup: { gap: 4 },
  filterGroupLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.7,
  },
  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  filterPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  filterPillActive: { backgroundColor: colors.black, borderColor: colors.black },
  filterPillText: { fontFamily: fonts.sans, fontSize: 11.5, fontWeight: '600', color: colors.ink },
  filterPillTextActive: { color: '#FFFFFF' },
  tableCard: { marginBottom: spacing.lg, padding: 0 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#FAF9F5',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  headerText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: colors.inkFaint,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight || colors.border,
    alignItems: 'center',
  },
  tableRowAlt: { backgroundColor: '#FAFAF8' },
  col: { paddingHorizontal: 4 },
  colId: { width: 80 },
  colName: { flex: 1.2 },
  colRole: { width: 120 },
  colAccess: { flex: 2 },
  colStatus: { width: 80 },
  colActions: { width: 180 },
  monoText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '700', color: colors.ink },
  cellText: { fontFamily: fonts.sans, fontSize: 13, color: colors.ink, fontWeight: '500' },
  accessText: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkSoft },
  actionsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
  },
  actionBtnDanger: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  actionBtnText: { fontFamily: fonts.sans, fontSize: 11, fontWeight: '600', color: colors.ink },
  actionBtnTextDanger: { color: colors.danger },
  loadingRow: { paddingVertical: 40, alignItems: 'center' },
  emptyRow: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontFamily: fonts.sans, fontSize: 13, color: colors.inkSoft },
  capabilityRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
  },
  capabilityCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.sm,
    minWidth: 280,
  },
  capabilityTitle: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  capabilityItem: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  capabilityCheck: { fontFamily: fonts.sans, fontSize: 12, color: '#15803D', fontWeight: '700' },
  capabilityText: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.ink, flex: 1, lineHeight: 18 },
  capabilityNote: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkSoft,
    fontStyle: 'italic',
    marginTop: 4,
  },
  capabilityRestriction: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.danger,
    marginTop: 4,
    lineHeight: 16,
  },
});
