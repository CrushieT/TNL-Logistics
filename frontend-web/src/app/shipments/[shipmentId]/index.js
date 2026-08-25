import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppShell from '../../../components/layout/AppShell';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import StatusBadge from '../../../components/common/StatusBadge';
import {
  LabelPreview,
  PrintLabelsModal,
  SingleUnitQRModal,
  getShipment,
  printLabels,
  subscribeRealtimeEvents,
} from '../../../features/shipments';
import { colors, fonts, spacing, radius, type } from '../../../theme';

export default function ShipmentDetailScreen() {
  const router = useRouter();
  const { shipmentId } = useLocalSearchParams();
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [singleQRModalUnit, setSingleQRModalUnit] = useState(null);

  const loadShipment = useCallback(async (showSpinner = true) => {
    if (!shipmentId) return;
    try {
      if (showSpinner) setLoading(true);
      const data = await getShipment(shipmentId);
      if (data) {
        setShipment(data);
      }
    } catch (err) {
      console.warn('Shipment detail fetch failed:', err?.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    loadShipment(true);
  }, [loadShipment]);

  // Real-time SSE listener
  useEffect(() => {
    const handleSilentRefresh = () => {
      loadShipment(false);
    };

    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (event.data?.shipmentId === shipmentId) {
        handleSilentRefresh();
      }
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
  }, [loadShipment, shipmentId]);

  const handlePrintAll = async () => {
    try {
      await printLabels(shipmentId);
      setPrintModalVisible(true);
      loadShipment();
    } catch (err) {
      setPrintModalVisible(true);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Pressable onPress={() => router.push('/shipments')}>
          <Text style={styles.backLink}>← Shipments</Text>
        </Pressable>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.ink} size="large" />
          <Text style={styles.loadingText}>Loading shipment {shipmentId}...</Text>
        </View>
      </AppShell>
    );
  }

  if (!shipment) {
    return (
      <AppShell>
        <Pressable onPress={() => router.push('/shipments')}>
          <Text style={styles.backLink}>← Shipments</Text>
        </Pressable>
        <Card>
          <Text style={styles.notFoundText}>Shipment {shipmentId} was not found.</Text>
        </Card>
      </AppShell>
    );
  }

  const balance = (shipment.totalAmount || 0) - (shipment.amountPaid || 0);
  const firstUnit = shipment.units?.[0];

  return (
    <AppShell>
      <Pressable onPress={() => router.push('/shipments')}>
        <Text style={styles.backLink}>← Shipments</Text>
      </Pressable>

      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>
            {shipment.shipmentId} · {(shipment.origin || 'DESKTOP OFFICE').toUpperCase()}
          </Text>
          <Text style={styles.title}>{(shipment.recipient || '').toUpperCase()}</Text>
        </View>
        <View style={styles.badgeRow}>
          <StatusBadge value={shipment.status} kind="status" />
          <StatusBadge value={shipment.payment} kind="payment" />
        </View>
      </View>

      <View style={styles.row}>
        {/* Left Column: Shipment Transaction Details & Parcel Units */}
        <View style={styles.mainCol}>
          {/* Card 1: Shipment / Transaction */}
          <Card title="SHIPMENT / TRANSACTION" style={styles.cardSpacing}>
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>SHIPMENT ID</Text>
                <Text style={styles.fieldValueMono}>{shipment.shipmentId}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>CLIENT</Text>
                <Text style={styles.fieldValue}>{shipment.client}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>ROUTE</Text>
                <Text style={styles.fieldValue}>{shipment.route}</Text>
              </View>
            </View>

            <View style={[styles.gridRow, { marginTop: spacing.md }]}>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>RECIPIENT</Text>
                <Text style={styles.fieldValue}>{shipment.recipientDetails?.fullName || shipment.recipient}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>CONTACT</Text>
                <Text style={styles.fieldValue}>{shipment.recipientDetails?.contactNumber || '—'}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>REGISTERED</Text>
                <Text style={styles.fieldValue}>{shipment.registeredOn}</Text>
              </View>
            </View>

            <View style={[styles.gridRow, { marginTop: spacing.md }]}>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>ADDRESS</Text>
                <Text style={styles.fieldValue}>{shipment.recipientDetails?.address || '—'}</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>CONTENTS</Text>
                <Text style={styles.fieldValue}>
                  {shipment.description || 'General Goods'} · {shipment.quantity} pcs · {(shipment.chargeModel || '').toLowerCase()}
                </Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>OVERALL STATUS</Text>
                <Text style={styles.fieldValue}>{shipment.statusRollup}</Text>
              </View>
            </View>
          </Card>

          {/* Card 2: Parcel Units */}
          <Card
            title={`PARCEL UNITS (${shipment.units?.length || 0})`}
            right={
              <View style={styles.headerActions}>
                <Button
                  label={`Print All Labels (${shipment.units?.length || 0})`}
                  variant="secondary"
                  onPress={handlePrintAll}
                  style={styles.headerBtn}
                />
                <Button
                  label="Reprint All"
                  variant="secondary"
                  onPress={handlePrintAll}
                  style={styles.headerBtn}
                />
              </View>
            }
          >
            <View style={styles.unitsTable}>
              <View style={styles.unitsHeaderRow}>
                <Text style={[styles.unitsHeaderCell, { flex: 1.3 }]}>PACKAGE</Text>
                <Text style={[styles.unitsHeaderCell, { flex: 1.4 }]}>TRACKING ID</Text>
                <Text style={[styles.unitsHeaderCell, { flex: 1.1 }]}>STATUS</Text>
                <Text style={[styles.unitsHeaderCell, { flex: 1.1 }]}>LABEL</Text>
                <Text style={[styles.unitsHeaderCell, { flex: 0.9, textAlign: 'right' }]} />
              </View>
              {shipment.units?.map((u, idx) => (
                <View
                  key={u.trackingId}
                  style={[styles.unitRow, idx !== shipment.units.length - 1 && styles.unitDivider]}
                >
                  <Text style={[styles.unitCell, { flex: 1.3 }]}>
                    Package {u.packageIndex} of {u.packageCount}
                  </Text>
                  <Text style={[styles.unitCellStrong, { flex: 1.4 }]}>{u.trackingId}</Text>
                  <View style={{ flex: 1.1 }}>
                    <StatusBadge value={u.status} kind="status" />
                  </View>
                  <View style={{ flex: 1.1 }}>
                    <StatusBadge value={u.labelStatus} kind="label" />
                  </View>
                  <View style={{ flex: 0.9, flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
                    <Pressable onPress={() => router.push(`/shipments/${shipmentId}/units/${u.trackingId}`)}>
                      <Text style={styles.unitLinkOrange}>View</Text>
                    </Pressable>
                    <Pressable onPress={() => setSingleQRModalUnit(u)}>
                      <Text style={styles.unitLinkOrange}>Reprint</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.footnote}>
              Each unit is individually trackable with its own unique QR. Reprints reuse the same Tracking ID + QR — never a new parcel.
            </Text>
          </Card>
        </View>

        {/* Right Column: Live Label Preview & Payment Card */}
        <View style={styles.sideCol}>
          {firstUnit && (
            <LabelPreview
              trackingId={firstUnit.trackingId}
              packageIndex={firstUnit.packageIndex}
              packageCount={firstUnit.packageCount}
              recipientName={shipment.recipientDetails?.fullName || shipment.recipient}
              contactNumber={shipment.recipientDetails?.contactNumber}
              address={shipment.recipientDetails?.address}
              contents={shipment.description}
              shipmentId={shipment.shipmentId}
              client={shipment.client}
              route={shipment.route}
              total={shipment.totalAmount}
            />
          )}

          <Pressable style={styles.previewBtn} onPress={handlePrintAll}>
            <Text style={styles.previewBtnText}>Preview / Print Labels</Text>
          </Pressable>

          <Card title="PAYMENT · TRANSACTION" style={styles.paymentCard}>
            <Text style={styles.chargingLabel}>{(shipment.chargeModel || 'Flat')} charging</Text>
            <PaymentLine label="Shipping" value={shipment.shippingFee} />
            <PaymentLine label="Other Charges" value={shipment.otherCharges} />
            <PaymentLine label="Total Due" value={shipment.totalAmount} strong />
            <PaymentLine label="Amount Paid" value={shipment.amountPaid} />
            <View style={styles.paymentDivider} />
            <PaymentLine label="Balance" value={balance} strong accent={balance > 0} />

            <Pressable
              style={styles.managePaymentBtn}
              onPress={() => router.push('/payments')}
            >
              <Text style={styles.managePaymentText}>Manage Payment →</Text>
            </Pressable>
          </Card>
        </View>
      </View>

      {/* Batch Print Labels Modal */}
      <PrintLabelsModal
        visible={printModalVisible}
        shipment={shipment}
        onClose={() => setPrintModalVisible(false)}
        onPrint={() => setPrintModalVisible(false)}
      />

      {/* Interactive Single-Unit QR Code Modal */}
      {singleQRModalUnit && (
        <SingleUnitQRModal
          visible={Boolean(singleQRModalUnit)}
          trackingId={singleQRModalUnit.trackingId}
          packageIndex={singleQRModalUnit.packageIndex}
          packageCount={singleQRModalUnit.packageCount}
          recipientName={shipment.recipientDetails?.fullName || shipment.recipient}
          clientName={shipment.client}
          status={singleQRModalUnit.status}
          labelStatus={singleQRModalUnit.labelStatus}
          onClose={() => setSingleQRModalUnit(null)}
          onViewFull={() => {
            const tid = singleQRModalUnit.trackingId;
            setSingleQRModalUnit(null);
            router.push(`/shipments/${shipmentId}/units/${tid}`);
          }}
        />
      )}
    </AppShell>
  );
}

function PaymentLine({ label, value, strong, accent }) {
  return (
    <View style={styles.paymentLine}>
      <Text style={[styles.paymentLabel, strong && styles.paymentLabelStrong]}>{label}</Text>
      <Text
        style={[
          styles.paymentValue,
          strong && styles.paymentValueStrong,
          accent && styles.paymentValueAccent,
        ]}
      >
        ₱{Number(value || 0).toLocaleString()}
      </Text>
    </View>
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
    color: colors.danger,
    padding: spacing.xl,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.inkFaint,
    fontWeight: '600',
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
    marginTop: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  mainCol: {
    flex: 1,
    minWidth: 280,
  },
  cardSpacing: {
    marginBottom: spacing.lg,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridCol: {
    flex: 1,
  },
  fieldLabel: {
    ...type.label,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.inkFaint,
    marginBottom: 4,
  },
  fieldValue: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '500',
  },
  fieldValueMono: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    minHeight: 30,
  },
  unitsTable: {
    marginTop: spacing.xs,
  },
  unitsHeaderRow: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unitsHeaderCell: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    fontWeight: '600',
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  unitDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unitCell: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  unitCellStrong: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '700',
  },
  unitLinkOrange: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  footnote: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    marginTop: spacing.md,
    lineHeight: 16,
  },
  sideCol: {
    width: 300,
    gap: spacing.sm,
  },
  previewBtn: {
    backgroundColor: colors.ink,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  previewBtnText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  paymentCard: {
    marginTop: spacing.xs,
  },
  chargingLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
    marginBottom: spacing.sm,
  },
  paymentLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  paymentLabel: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  paymentLabelStrong: {
    color: colors.ink,
    fontWeight: '700',
  },
  paymentValue: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.ink,
  },
  paymentValueStrong: {
    fontWeight: '700',
  },
  paymentValueAccent: {
    color: colors.accent,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  managePaymentBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  managePaymentText: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.ink,
  },
});
