import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AppShell from '../../../components/layout/AppShell';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import StatusBadge from '../../../components/common/StatusBadge';
import { LabelPreview, PrintLabelsModal, getShipment } from '../../../features/shipments';
import { colors, fonts, spacing, radius, type } from '../../../theme';

const FALLBACK_SHIPMENT = {
  shipmentId: 'SHP-2026-011',
  origin: 'Desktop Office',
  client: 'Northbridge Trading',
  route: 'Manila → TNL Baguio',
  recipient: 'Aundray Tafalla',
  recipientDetails: {
    fullName: 'Aundray Tafalla',
    contactNumber: '08921341232',
    address: 'Daet, Camarines Norte',
  },
  registeredOn: 'Aug 24, 2026 · Desktop Office',
  description: 'Office Supplies',
  quantity: 3,
  status: 'Registered',
  statusRollup: '3 / 3 Registered',
  payment: 'Unpaid',
  chargeModel: 'Flat',
  shippingFee: 500,
  otherCharges: 0,
  totalAmount: 500,
  amountPaid: 0,
  units: [
    { trackingId: 'TRK-2026-000114', packageIndex: 1, packageCount: 3, status: 'Registered', labelStatus: 'Printed' },
    { trackingId: 'TRK-2026-000115', packageIndex: 2, packageCount: 3, status: 'Registered', labelStatus: 'Printed' },
    { trackingId: 'TRK-2026-000116', packageIndex: 3, packageCount: 3, status: 'Registered', labelStatus: 'Printed' },
  ],
};

export default function ShipmentDetailScreen() {
  const router = useRouter();
  const { shipmentId } = useLocalSearchParams();
  const [shipment, setShipment] = useState(FALLBACK_SHIPMENT);
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getShipment(shipmentId);
      if (data) setShipment(data);
    } catch (err) {
      console.warn('Shipment detail fetch failed, using fallback data.', err?.message);
    }
  }, [shipmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const balance = (shipment.totalAmount || 0) - (shipment.amountPaid || 0);
  const firstUnit = shipment.units?.[0];

  return (
    <AppShell>
      <Pressable onPress={() => router.push('/shipments')}>
        <Text style={styles.backLink}>← Shipments</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <View>
          <Text style={type.eyebrow}>
            {shipment.shipmentId} · {shipment.origin?.toUpperCase()}
          </Text>
          <Text style={[type.h1, styles.title]}>{shipment.recipient?.toUpperCase()}</Text>
        </View>
        <View style={styles.badgeRow}>
          <StatusBadge value={shipment.status} kind="status" />
          <StatusBadge value={shipment.payment} kind="payment" />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.mainCol}>
          <Card title="Shipment / Transaction" style={styles.cardSpacing}>
            <View style={styles.fieldGrid}>
              <Field label="Shipment ID" value={shipment.shipmentId} />
              <Field label="Client" value={shipment.client} />
              <Field label="Route" value={shipment.route} />
              <Field label="Recipient" value={shipment.recipientDetails?.fullName} />
              <Field label="Contact" value={shipment.recipientDetails?.contactNumber} />
              <Field label="Registered" value={shipment.registeredOn} />
              <Field label="Address" value={shipment.recipientDetails?.address} />
              <Field
                label="Contents"
                value={`${shipment.description} · ${shipment.quantity} pcs · ${(shipment.chargeModel || '').toLowerCase()}`}
              />
              <Field label="Overall Status" value={shipment.statusRollup} />
            </View>
          </Card>

          <Card
            title={`Parcel Units (${shipment.units?.length || 0})`}
            right={
              <View style={styles.headerActions}>
                <Button label={`Print All Labels (${shipment.units?.length || 0})`} variant="secondary" onPress={() => setModalVisible(true)} />
                <Button label="Reprint All" variant="secondary" />
              </View>
            }
          >
            <View style={styles.unitsTable}>
              <View style={styles.unitsHeaderRow}>
                <Text style={[styles.unitsHeaderCell, { flex: 1.2 }]}>Package</Text>
                <Text style={[styles.unitsHeaderCell, { flex: 1.4 }]}>Tracking ID</Text>
                <Text style={[styles.unitsHeaderCell, { flex: 1 }]}>Status</Text>
                <Text style={[styles.unitsHeaderCell, { flex: 1.2 }]}>Label</Text>
                <Text style={[styles.unitsHeaderCell, { flex: 1 }]} />
              </View>
              {shipment.units?.map((u, idx) => (
                <View
                  key={u.trackingId}
                  style={[styles.unitRow, idx !== shipment.units.length - 1 && styles.unitDivider]}
                >
                  <Text style={[styles.unitCell, { flex: 1.2 }]}>
                    Package {u.packageIndex} of {u.packageCount}
                  </Text>
                  <Text style={[styles.unitCellStrong, { flex: 1.4 }]}>{u.trackingId}</Text>
                  <View style={{ flex: 1 }}>
                    <StatusBadge value={u.status} kind="status" />
                  </View>
                  <View style={{ flex: 1.2 }}>
                    <StatusBadge value={u.labelStatus} kind="label" />
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
                    <Pressable onPress={() => router.push(`/shipments/${shipmentId}/units/${u.trackingId}`)}>
                      <Text style={styles.unitLink}>View</Text>
                    </Pressable>
                    <Pressable>
                      <Text style={styles.unitLink}>Reprint</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.footnote}>
              Each unit is individually trackable with its own unique QR. Reprints reuse the same
              Tracking ID + QR — never a new parcel.
            </Text>
          </Card>
        </View>

        <View style={styles.sideCol}>
          {firstUnit && (
            <LabelPreview
              trackingId={firstUnit.trackingId}
              packageIndex={firstUnit.packageIndex}
              packageCount={firstUnit.packageCount}
              recipientName={shipment.recipientDetails?.fullName}
              contactNumber={shipment.recipientDetails?.contactNumber}
              address={shipment.recipientDetails?.address}
              contents={shipment.description}
              shipmentId={shipment.shipmentId}
              client={shipment.client}
              route={shipment.route}
              total={shipment.totalAmount}
            />
          )}
          <Button
            label="Preview / Print Labels"
            variant="primary"
            fullWidth
            onPress={() => setModalVisible(true)}
            style={styles.previewBtn}
          />

          <Card title="Payment · Transaction" style={styles.paymentCard}>
            <Text style={styles.chargingLabel}>{shipment.chargeModel} charging</Text>
            <PaymentLine label="Shipping" value={shipment.shippingFee} />
            <PaymentLine label="Other Charges" value={shipment.otherCharges} />
            <PaymentLine label="Total Due" value={shipment.totalAmount} strong />
            <PaymentLine label="Amount Paid" value={shipment.amountPaid} />
            <View style={styles.paymentDivider} />
            <PaymentLine label="Balance" value={balance} strong accent={balance > 0} />
            <Button label="Manage Payment →" variant="primary" fullWidth style={styles.managePaymentBtn} />
          </Card>
        </View>
      </View>

      <PrintLabelsModal
        visible={modalVisible}
        shipment={{ ...shipment, units: shipment.units }}
        onClose={() => setModalVisible(false)}
        onPrint={() => setModalVisible(false)}
      />
    </AppShell>
  );
}

function Field({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  title: {
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  mainCol: {
    flex: 1,
  },
  cardSpacing: {
    marginBottom: spacing.lg,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  field: {
    width: '30%',
    minWidth: 150,
  },
  fieldValue: {
    fontFamily: fonts.mono,
    fontSize: 13.5,
    color: colors.ink,
    fontWeight: '600',
    marginTop: 3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    fontWeight: '600',
  },
  unitLink: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  footnote: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkFaint,
    marginTop: spacing.md,
    lineHeight: 17,
  },
  sideCol: {
    width: 320,
    gap: spacing.md,
  },
  previewBtn: {
    marginTop: 0,
  },
  paymentCard: {
    marginTop: spacing.md,
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
    paddingVertical: 6,
  },
  paymentLabel: {
    fontFamily: fonts.mono,
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
    marginTop: spacing.md,
  },
});
