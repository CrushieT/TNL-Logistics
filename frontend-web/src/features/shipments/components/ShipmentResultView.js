import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import StatusBadge from '../../../components/common/StatusBadge';
import LabelPreview from './LabelPreview';
import { colors, fonts, spacing, radius, type } from '../../../theme';

export default function ShipmentResultView({ shipment, onRegisterAnother, onViewShipment, onPreviewLabels }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 900;

  if (!shipment) return null;
  const firstUnit = shipment.units?.[0];

  return (
    <View style={styles.container}>
      {/* Top Header Row */}
      <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
        <View>
          <Text style={type.eyebrow}>Scenario 1 Complete</Text>
          <Text style={[type.h1, styles.title]}>Shipment Registered</Text>
        </View>
        <View style={styles.headerActions}>
          <Button label="Register Another" variant="secondary" onPress={onRegisterAnother} />
          <Button label="View Shipment →" variant="primary" onPress={onViewShipment} />
        </View>
      </View>

      {/* Main Grid: Left Summary Details & Right Live Label Preview */}
      <View style={[styles.row, isMobile && styles.rowMobile]}>
        <Card style={styles.mainCard}>
          {/* Summary Fields Grid */}
          <View style={styles.summaryGrid}>
            <SummaryField label="Shipment ID" value={shipment.shipmentId} mono />
            <SummaryField label="Quantity" value={`${shipment.quantity} parcel units`} />
            <SummaryField label="Recipient" value={shipment.recipient} />
            <SummaryField label="Client" value={shipment.client} />
            <SummaryField label="Charge Model" value={shipment.chargeModel} />
            <SummaryField label="Total Amount" value={`₱${Number(shipment.totalAmount || 0).toLocaleString()}`} bold />
            <SummaryField
              label="Payment Status"
              value={shipment.paidAtRegistration ? '● Paid (Cash)' : '○ Unpaid (Billed on SOA)'}
              customColor={shipment.paidAtRegistration ? '#059669' : '#DC2626'}
            />
            {shipment.totalVolumeCbm ? (
              <SummaryField label="Total Volume" value={`${Number(shipment.totalVolumeCbm).toFixed(4)} m³`} />
            ) : null}
          </View>

          {/* Parcel Units Table */}
          <Text style={styles.unitsLabel}>PARCEL UNITS — EACH WITH A UNIQUE TRACKING ID + QR</Text>
          <View style={styles.unitsList}>
            {shipment.units?.map((u, idx) => (
              <View
                key={u.trackingId}
                style={[styles.unitRow, idx !== shipment.units.length - 1 && styles.unitDivider]}
              >
                <Text style={styles.unitTracking}>{u.trackingId}</Text>
                <Text style={styles.unitPackage}>
                  Package {u.packageIndex} of {u.packageCount}
                </Text>
                <StatusBadge value={u.labelStatus === 'Printed' ? 'Printed' : 'Pending'} kind="label" />
              </View>
            ))}
          </View>

          <Text style={styles.footnote}>
            A unique Tracking ID and QR were generated for{' '}
            <Text style={styles.footnoteStrong}>each physical parcel</Text>. This is one shared system —
            the same shipment is instantly available in the mobile field app for printing or scanning.
          </Text>

          <Button
            label={`Preview / Print ${shipment.units?.length || 0} Labels`}
            variant="primary"
            onPress={onPreviewLabels}
          />
        </Card>

        {/* Right Preview Card */}
        {firstUnit && (
          <View style={[styles.sideCol, isMobile && styles.sideColMobile]}>
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
            <Text style={styles.showingCaption}>
              Showing Package {firstUnit.packageIndex} of {firstUnit.packageCount}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function SummaryField({ label, value, mono = false, bold = false, customColor }) {
  return (
    <View style={styles.summaryField}>
      <Text style={type.label}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          mono && styles.summaryMono,
          bold && styles.summaryBold,
          Boolean(customColor) && { color: customColor },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  headerRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  title: {
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  rowMobile: {
    flexDirection: 'column',
  },
  mainCard: {
    flex: 1,
    minWidth: 280,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryField: {
    width: '28%',
    minWidth: 140,
  },
  summaryValue: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
    fontWeight: '500',
    marginTop: 3,
  },
  summaryMono: {
    fontFamily: fonts.mono,
    fontWeight: '700',
  },
  summaryBold: {
    fontSize: 16,
    fontWeight: '800',
  },
  unitsLabel: {
    ...type.label,
    marginBottom: spacing.sm,
  },
  unitsList: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  unitDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unitTracking: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    flex: 1.2,
  },
  unitPackage: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkFaint,
    flex: 1,
  },
  footnote: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  footnoteStrong: {
    fontWeight: '700',
    color: colors.ink,
  },
  sideCol: {
    width: 340,
  },
  sideColMobile: {
    width: '100%',
    marginTop: spacing.md,
  },
  showingCaption: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
