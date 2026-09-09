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
  ResetPasswordModal,
  ResetPinModal,
  ConfirmActionModal,
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
  OFFICE_STAFF: 'Mobile only (office workflows) · shared system',
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
  const [userToResetPassword, setUserToResetPassword] = useState(null);
  const [userToResetPin, setUserToResetPin] = useState(null);
  const [actionConfirmationConfig, setActionConfirmationConfig] = useState(null);
  const [activeActionMenuUserId, setActiveActionMenuUserId] = useState(null);
  const actionMenuContainerRef = useRef(null);

  // Close more action popover on outside click in web
  useEffect(() => {
    if (!activeActionMenuUserId || typeof document === 'undefined') return;

    const handleClickOutside = (event) => {
      if (actionMenuContainerRef.current) {
        const domNode = actionMenuContainerRef.current;
        if (domNode.contains && !domNode.contains(event.target)) {
          setActiveActionMenuUserId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [activeActionMenuUserId]);

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
    showFeedback(`Password reset for ${userId}. Active sessions revoked; temporary password assigned.`);
    await loadUsers(false);
  };

  const handleResetPin = async (userId, pinValue, clearPin = false) => {
    await resetPin(userId, pinValue, clearPin);
    const feedbackMessage = clearPin
      ? `Mobile PIN cleared for ${userId}. Active sessions revoked; courier must configure PIN on next mobile login.`
      : `Mobile PIN updated for ${userId}. Active sessions revoked.`;
    showFeedback(feedbackMessage);
    await loadUsers(false);
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
              style={[
                styles.tableRow,
                idx % 2 === 1 && styles.tableRowAlt,
                activeActionMenuUserId === user.userId && { zIndex: 100 },
              ]}
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
                <View
                  style={styles.moreActionWrapper}
                  ref={activeActionMenuUserId === user.userId ? actionMenuContainerRef : undefined}
                >
                  <Pressable
                    style={[
                      styles.actionBtn,
                      activeActionMenuUserId === user.userId && styles.actionBtnActive,
                    ]}
                    onPress={() =>
                      setActiveActionMenuUserId(
                        activeActionMenuUserId === user.userId ? null : user.userId
                      )
                    }
                  >
                    <Text style={styles.actionBtnText}>More ▾</Text>
                  </Pressable>
                  {activeActionMenuUserId === user.userId && (
                    <View style={styles.actionPopover}>
                      <Pressable
                        style={({ hovered }) => [
                          styles.popoverItem,
                          hovered && styles.popoverItemHovered,
                        ]}
                        onPress={() => {
                          setActiveActionMenuUserId(null);
                          setUserToResetPassword(user);
                        }}
                      >
                        <Text style={styles.popoverItemText}>Reset Password</Text>
                      </Pressable>
                      {user.role !== 'ADMIN' ? (
                        <Pressable
                          style={({ hovered }) => [
                            styles.popoverItem,
                            hovered && styles.popoverItemHovered,
                          ]}
                          onPress={() => {
                            setActiveActionMenuUserId(null);
                            setUserToResetPin(user);
                          }}
                        >
                          <Text style={styles.popoverItemText}>Reset Mobile PIN</Text>
                        </Pressable>
                      ) : null}
                      <View style={styles.popoverDivider} />
                      <Pressable
                        style={({ hovered }) => [
                          styles.popoverItem,
                          hovered && styles.popoverItemDangerHovered,
                        ]}
                        onPress={() => {
                          setActiveActionMenuUserId(null);
                          setUserToDelete(user);
                        }}
                      >
                        <Text style={[styles.popoverItemText, styles.popoverItemTextDanger]}>
                          Delete Account
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
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
          <Text style={styles.capabilityTitle}>ADMINISTRATOR</Text>
          {[
            'Register clients, shipments & parcels',
            'Generate QR + manage QR / label printing',
            'Register & manage vehicles (trucks)',
            'Record payments, weekly collections & SOA (deductions, Collected By)',
            'Generate & manage waybills',
            'Tracking monitoring & financial/operational reports',
            'User & staff account administration',
            'System configuration & settings',
          ].map((item) => (
            <View key={item} style={styles.capabilityItem}>
              <Text style={styles.capabilityCheck}>✓</Text>
              <Text style={styles.capabilityText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.capabilityNote}>
            Administrator = full administrative and operational access across desktop and mobile.
          </Text>
        </View>

        <View style={[styles.capabilityCard, { flex: 1 }]}>
          <Text style={styles.capabilityTitle}>OFFICE STAFF</Text>
          {[
            'Login · Change Password · Logout',
            'Register clients, shipments & parcels (mobile app)',
            'Generate QR + manage QR / label printing (Bluetooth thermal printer)',
          ].map((item) => (
            <View key={item} style={styles.capabilityItem}>
              <Text style={styles.capabilityCheck}>✓</Text>
              <Text style={styles.capabilityText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.capabilityNote}>
            Mobile app only (authorized shipment registration & label printing). Blocked from billing, reports, and administration.
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
        onRequestResetPassword={(u) => setUserToResetPassword(u)}
        onRequestResetPin={(u) => setUserToResetPin(u)}
      />

      <ResetPasswordModal
        visible={Boolean(userToResetPassword)}
        user={userToResetPassword}
        onClose={() => setUserToResetPassword(null)}
        onRequestConfirm={(u, newPass) => {
          setUserToResetPassword(null);
          setActionConfirmationConfig({
            title: 'CONFIRM PASSWORD RESET',
            warningTitle: 'SECURITY ACTION: CREDENTIAL RESET',
            user: u,
            description: `You are about to reset the password for ${u.fullName} (@${u.username}).`,
            bulletPoints: [
              `A temporary password (${newPass}) will be assigned to this account.`,
              'All existing active sessions across all devices will be immediately revoked.',
              'The staff member will be required to choose a new password upon their next login.',
            ],
            confirmLabel: 'Confirm Password Reset',
            confirmVariant: 'primary',
            onConfirm: async () => {
              await handleResetPassword(u.userId, newPass);
            },
          });
        }}
        onConfirm={handleResetPassword}
      />

      <ResetPinModal
        visible={Boolean(userToResetPin)}
        user={userToResetPin}
        onClose={() => setUserToResetPin(null)}
        onRequestConfirm={(u, { clearPin, pin }) => {
          setUserToResetPin(null);
          if (clearPin) {
            setActionConfirmationConfig({
              title: 'CONFIRM PIN CLEAR',
              warningTitle: 'SECURITY ACTION: CLEAR MOBILE PIN',
              user: u,
              description: `You are about to clear the mobile PIN for ${u.fullName} (@${u.username}).`,
              bulletPoints: [
                'The enrolled 4-digit PIN will be removed from this account.',
                'All active mobile sessions for this user will be revoked immediately.',
                'The staff member must configure a new secret PIN upon their next mobile login.',
              ],
              confirmLabel: 'Clear PIN & Revoke Sessions',
              confirmVariant: 'danger',
              onConfirm: async () => {
                await handleResetPin(u.userId, null, true);
              },
            });
          } else {
            setActionConfirmationConfig({
              title: 'CONFIRM PIN ASSIGNMENT',
              warningTitle: 'SECURITY ACTION: MANUAL PIN ASSIGNMENT',
              user: u,
              description: `You are about to manually assign a new 4-digit PIN for ${u.fullName} (@${u.username}).`,
              bulletPoints: [
                'The previous PIN will be overwritten with the manually assigned 4-digit PIN.',
                'All active mobile sessions for this user will be revoked immediately.',
                'Only use this manual override if the courier cannot complete initial setup on their terminal.',
              ],
              confirmLabel: 'Assign PIN & Revoke Sessions',
              confirmVariant: 'primary',
              onConfirm: async () => {
                await handleResetPin(u.userId, pin, false);
              },
            });
          }
        }}
        onConfirm={handleResetPin}
      />

      {actionConfirmationConfig && (
        <ConfirmActionModal
          visible={Boolean(actionConfirmationConfig)}
          user={actionConfirmationConfig.user}
          title={actionConfirmationConfig.title}
          warningTitle={actionConfirmationConfig.warningTitle}
          description={actionConfirmationConfig.description}
          bulletPoints={actionConfirmationConfig.bulletPoints}
          confirmLabel={actionConfirmationConfig.confirmLabel}
          confirmVariant={actionConfirmationConfig.confirmVariant}
          onClose={() => setActionConfirmationConfig(null)}
          onConfirm={actionConfirmationConfig.onConfirm}
        />
      )}

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
  tableCard: { marginBottom: spacing.lg, padding: 0, overflow: 'visible' },
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
    overflow: 'visible',
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
  actionBtnActive: {
    backgroundColor: '#FAF9F5',
    borderColor: colors.ink,
  },
  actionBtnDanger: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  actionBtnText: { fontFamily: fonts.sans, fontSize: 11, fontWeight: '600', color: colors.ink },
  actionBtnTextDanger: { color: colors.danger },
  moreActionWrapper: {
    position: 'relative',
  },
  actionPopover: {
    position: 'absolute',
    top: 26,
    right: 0,
    minWidth: 165,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1001,
    paddingVertical: 4,
  },
  popoverItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  popoverItemHovered: {
    backgroundColor: '#F3F2EB',
  },
  popoverItemDangerHovered: {
    backgroundColor: colors.dangerSoft,
  },
  popoverItemText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  popoverItemTextDanger: {
    color: colors.danger,
  },
  popoverDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
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
