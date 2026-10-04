import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppShell from '../../components/layout/AppShell';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import {
  getClient,
  updateClient,
  updateClientRatePerKilo,
  deleteClient,
  RegisterClientModal,
  DeactivateClientModal,
} from '../../features/clients';
import { subscribeRealtimeEvents } from '../../features/shipments';
import { colors, fonts, spacing, radius, type } from '../../theme';

export default function ClientProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deactivateModalVisible, setDeactivateModalVisible] = useState(false);
  const [clientRateEnabled, setClientRateEnabled] = useState(false);
  const [clientRateInput, setClientRateInput] = useState('');
  const [clientRateSaving, setClientRateSaving] = useState(false);
  const [clientRateMessage, setClientRateMessage] = useState('');

  const loadClientData = useCallback(async (showSpinner = true) => {
    if (!id) return;
    try {
      if (showSpinner) setLoading(true);
      const data = await getClient(id);
      if (data) {
        setClient(data);
        setClientRateEnabled(data.ratePerKilo !== null && data.ratePerKilo !== undefined);
        setClientRateInput(data.ratePerKilo !== null && data.ratePerKilo !== undefined
          ? String(data.ratePerKilo)
          : '');
      }
    } catch (err) {
      console.warn('Client profile fetch failed:', err?.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadClientData(true);
  }, [loadClientData]);

  // Real-time SSE listener: silent refresh on shipment or payment events
  useEffect(() => {
    const handleSilentRefresh = () => {
      loadClientData(false);
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
  }, [loadClientData]);

  const handleUpdateClient = async (payload) => {
    await updateClient(id, payload);
    await loadClientData(false);
  };

  const handleDeactivateClient = async (clientId) => {
    await deleteClient(clientId);
    router.push('/clients');
  };

  const handleSaveClientRate = async () => {
    const parsedRate = Number(clientRateInput);
    if (clientRateEnabled && (!Number.isFinite(parsedRate) || parsedRate <= 0)) {
      setClientRateMessage('Enter a valid rate greater than zero.');
      return;
    }

    setClientRateSaving(true);
    setClientRateMessage('');
    try {
      await updateClientRatePerKilo(id, clientRateEnabled ? parsedRate : null);
      await loadClientData(false);
      setClientRateMessage(clientRateEnabled
        ? 'Client-specific rate saved.'
        : 'Client-specific rate disabled. The global rate will be used.');
    } catch (error) {
      setClientRateMessage(error.response?.data?.message || 'Unable to save the client rate.');
    } finally {
      setClientRateSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Pressable onPress={() => router.push('/clients')}>
          <Text style={styles.backLink}>Back to Clients</Text>
        </Pressable>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.ink} size="large" />
          <Text style={styles.loadingText}>Loading client {id} profile...</Text>
        </View>
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell>
        <Pressable onPress={() => router.push('/clients')}>
          <Text style={styles.backLink}>Back to Clients</Text>
        </Pressable>
        <Card>
          <Text style={styles.notFoundText}>Client {id} was not found.</Text>
        </Card>
      </AppShell>
    );
  }

  const shipments = client.shipments || [];

  return (
    <AppShell>
      {/* Header Row */}
      <Pressable onPress={() => router.push('/clients')}>
        <Text style={styles.backLink}>Back to Clients</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <View>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>{client.clientId}</Text>
            {client.ratePerKilo !== null && client.ratePerKilo !== undefined ? (
              <View style={styles.vipHeaderBadge}>
                <Text style={styles.vipHeaderBadgeText}>
                  VIP CLIENT · ₱{Number(client.ratePerKilo).toFixed(2)}/KG
                </Text>
              </View>
            ) : (
              <View style={styles.regularHeaderBadge}>
                <Text style={styles.regularHeaderBadgeText}>REGULAR CLIENT</Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{(client.name || '').toUpperCase()}</Text>
        </View>
        <View style={styles.headerActions}>
          <Button
            label="View Consolidated SOA"
            variant="primary"
            onPress={() => router.push('/statements')}
          />
        </View>
      </View>

      {/* Main Two-Column Content */}
      <View style={[styles.mainLayout, isMobile && styles.mainLayoutMobile]}>
        {/* Left Column: Details Card */}
        <View style={[styles.detailsCol, isMobile && styles.colFull]}>
          <Card title="DETAILS" style={styles.card}>
            {/* Address */}
            <View style={styles.detailField}>
              <Text style={styles.fieldLabel}>ADDRESS</Text>
              <Text style={styles.fieldValue}>{client.address || '-'}</Text>
            </View>

            {/* Contact */}
            <View style={styles.detailField}>
              <Text style={styles.fieldLabel}>CONTACT</Text>
              <Text style={styles.fieldValueMono}>{client.contactNumber || '-'}</Text>
            </View>

            {/* Email */}
            <View style={styles.detailField}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <Text style={styles.fieldValue}>{client.email || '-'}</Text>
            </View>

            {/* Financial Rollup Metric Trio */}
            <View style={styles.financialMetricsBox}>
              <View style={styles.metricItem}>
                <Text style={styles.metricBigCharges}>
                  ₱{Number(client.totalCharges || 0).toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Charges</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricBigPaid}>
                  ₱{Number(client.totalPaid || 0).toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Paid</Text>
              </View>

              <View style={styles.metricItem}>
                <Text
                  style={[
                    styles.metricBigBalance,
                    Number(client.outstandingBalance || 0) > 0 ? styles.balanceDue : styles.balanceZero,
                  ]}
                >
                  ₱{Number(client.outstandingBalance || 0).toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Balance</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Default Rate Model & Status Row */}
            <View style={styles.metaRow}>
              <View>
                <Text style={styles.metaLabel}>DEFAULT RATE MODEL</Text>
                <Text style={styles.metaValue}>
                  {client.defaultRateType === 'PER_PARCEL' ? 'Per Unit Rate' : 'Flat Rate (Shipment)'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.metaLabel}>ACCOUNT STATUS</Text>
                <StatusBadge value={client.active ? 'Active' : 'Inactive'} kind="status" />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.clientRateSection}>
              <View style={styles.clientRateHeader}>
                <View style={styles.clientRateCopy}>
                  <Text style={styles.metaLabel}>CLIENT-SPECIFIC RATE PER KILO</Text>
                  <Text style={styles.rateHelper}>
                    Enable this only when this client has a negotiated rate.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Use client-specific rate per kilo"
                  value={clientRateEnabled}
                  onValueChange={(enabled) => {
                    setClientRateEnabled(enabled);
                    setClientRateMessage('');
                  }}
                  disabled={clientRateSaving}
                  trackColor={{ false: colors.border, true: colors.ink }}
                />
              </View>

              {clientRateEnabled ? (
                <View style={styles.clientRateInputRow}>
                  <Text style={styles.currencyPrefix}>₱</Text>
                  <TextInput
                    accessibilityLabel="Client rate per kilo"
                    value={clientRateInput}
                    onChangeText={(value) => {
                      setClientRateInput(value.replace(/[^0-9.]/g, ''));
                      setClientRateMessage('');
                    }}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    maxLength={13}
                    placeholder="0.00"
                    placeholderTextColor={colors.inkFaint}
                    style={styles.clientRateInput}
                  />
                  <Text style={styles.rateUnit}>per kg</Text>
                </View>
              ) : null}

              <Text style={styles.rateHelper}>
                Global rate: {client.globalRatePerKilo != null ? `₱${Number(client.globalRatePerKilo).toFixed(2)}` : 'Not configured'}
                {' | '}Current effective rate: {client.effectiveRatePerKilo != null ? `₱${Number(client.effectiveRatePerKilo).toFixed(2)}` : 'Not configured'}
              </Text>
              {clientRateMessage ? <Text style={styles.clientRateMessage}>{clientRateMessage}</Text> : null}
              <Button
                label={clientRateSaving ? 'Saving...' : 'Save Rate'}
                variant="secondary"
                disabled={clientRateSaving}
                onPress={handleSaveClientRate}
              />
            </View>

            <View style={styles.divider} />

            {/* Card Action Buttons */}
            <View style={styles.cardActions}>
              <Button
                label="Edit Details"
                variant="secondary"
                onPress={() => setEditModalVisible(true)}
                style={{ flex: 1 }}
              />
              <Button
                label="Deactivate / Delete"
                variant="secondary"
                onPress={() => setDeactivateModalVisible(true)}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>

        {/* Right Column: Embedded Shipments Table */}
        <View style={[styles.shipmentsCol, isMobile && styles.colFull]}>
          <Card title={`SHIPMENTS (${shipments.length})`} style={styles.card}>
            {shipments.length === 0 ? (
              <View style={styles.emptyShipments}>
                <Text style={styles.emptyShipmentsText}>No shipments registered for this client yet.</Text>
              </View>
            ) : (
              <View style={styles.shipmentsTable}>
                {/* Header */}
                <View style={styles.shipmentsHeaderRow}>
                  <Text style={[styles.shipmentHeaderCell, { flex: 1.4 }]}>SHIPMENT</Text>
                  <Text style={[styles.shipmentHeaderCell, { flex: 0.7, textAlign: 'center' }]}>QTY</Text>
                  <Text style={[styles.shipmentHeaderCell, { flex: 1.5 }]}>STATUS</Text>
                  <Text style={[styles.shipmentHeaderCell, { flex: 1.2 }]}>PAYMENT</Text>
                  <Text style={[styles.shipmentHeaderCell, { flex: 1.1, textAlign: 'right' }]}>TOTAL</Text>
                  <Text style={[styles.shipmentHeaderCell, { flex: 1.2, textAlign: 'right' }]}>BALANCE</Text>
                </View>

                {/* Rows */}
                {shipments.map((s, idx) => (
                  <Pressable
                    key={s.shipmentId}
                    style={[
                      styles.shipmentRow,
                      idx !== shipments.length - 1 && styles.shipmentDivider,
                    ]}
                    onPress={() => router.push(`/shipments/${s.shipmentId}`)}
                  >
                    <Text style={[styles.cellMonoBold, { flex: 1.4 }]}>{s.shipmentId}</Text>
                    <Text style={[styles.cellMonoCenter, { flex: 0.7 }]}>{s.quantity}</Text>
                    <View style={{ flex: 1.5 }}>
                      <StatusBadge value={s.status} kind="status" />
                    </View>
                    <View style={{ flex: 1.2 }}>
                      <StatusBadge value={s.payment} kind="payment" />
                    </View>
                    <Text style={[styles.cellMonoRight, { flex: 1.1 }]}>
                      ₱{Number(s.totalAmount || 0).toLocaleString()}
                    </Text>
                    <View style={[styles.balanceActionCell, { flex: 1.2 }]}>
                      <Text
                        style={[
                          styles.cellMonoRight,
                          Number(s.balance || 0) > 0 ? styles.balanceDue : styles.balanceZero,
                        ]}
                      >
                        ₱{Number(s.balance || 0).toLocaleString()}
                      </Text>
                      
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </Card>
        </View>
      </View>

      {/* Edit Client Modal */}
      <RegisterClientModal
        visible={editModalVisible}
        clientToEdit={client}
        onClose={() => setEditModalVisible(false)}
        onSaved={handleUpdateClient}
      />

      {/* Deactivate Client Modal */}
      <DeactivateClientModal
        visible={deactivateModalVisible}
        client={client}
        onClose={() => setDeactivateModalVisible(false)}
        onConfirm={handleDeactivateClient}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  backLink: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.inkFaint,
  },
  notFoundText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.inkSoft,
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  vipHeaderBadge: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  vipHeaderBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.warning,
    letterSpacing: 0.4,
  },
  regularHeaderBadge: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  regularHeaderBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.inkFaint,
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainLayout: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'flex-start',
  },
  mainLayoutMobile: {
    flexDirection: 'column',
  },
  detailsCol: {
    flex: 1.1,
    minWidth: 320,
  },
  shipmentsCol: {
    flex: 1.9,
    minWidth: 420,
  },
  colFull: {
    width: '100%',
    minWidth: '100%',
  },
  card: {
    padding: spacing.lg,
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldValue: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  fieldValueMono: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  financialMetricsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricBigCharges: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  metricBigPaid: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
  },
  metricBigBalance: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '700',
  },
  balanceDue: {
    color: colors.accent,
  },
  balanceZero: {
    color: colors.success,
  },
  metricLabel: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaValue: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  clientRateSection: {
    gap: spacing.sm,
  },
  clientRateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  clientRateCopy: {
    flex: 1,
  },
  clientRateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.ink,
  },
  clientRateInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.ink,
  },
  rateUnit: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
  },
  rateHelper: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkFaint,
  },
  clientRateMessage: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkSoft,
  },
  emptyShipments: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyShipmentsText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkFaint,
  },
  shipmentsTable: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  shipmentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F5',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  shipmentHeaderCell: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  shipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  shipmentDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cellMonoBold: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  cellMonoCenter: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
  },
  cellMonoRight: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
  },
  balanceActionCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  arrowIcon: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.accent,
    fontWeight: '700',
  },
});
