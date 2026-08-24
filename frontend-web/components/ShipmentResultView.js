import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './common/Card';
import Button from './common/Button';
import StatusBadge from './common/StatusBadge';
import LabelPreview from './LabelPreview';
import { colors, fonts, spacing, radius, type } from '../constants/theme';

/**
 * Post-registration confirmation screen, matching the prototype's
 * "SHIPMENT REGISTERED" scenario-complete state.
 *
 * shipment: {
 *   shipmentId, recipient, client, quantity, chargeModel, totalAmount,
 *   units: [{ trackingId, packageIndex, packageCount, labelStatus }]
 * }
 */
export default function ShipmentResultView({ shipment, onRegisterAnother, onViewShipment, onPreviewLabels }) {
  if (!shipment) return null;
  const firstUnit = shipment.units?.[0];

  return (
    <View>
      <View style={styles.headerRow}>
        <View>
          <Text style={type.eyebrow}>Scenario 1 Complete</Text>
          <Text style={[type.h1, styles.title]}>Shipment Registered</Text>
        </View>
        <View style={styles.headerActions}>
          <Button label="Register Another" variant="secondary" onPress={onRegisterAnother} />
          <Button label="View Shipment →" variant="primary" onPress={onViewShipment} />
        </View>
      </View>

      <View style={styles.row}>
        <Card style={styles.mainCard}>
          <View style={styles.summaryGrid}>
            <SummaryField label="Shipment ID" value={shipment.shipmentId} />
            <SummaryField label="Quantity" value={`${shipment.quantity} parcel units`} />
            <SummaryField label="Recipient" value={shipment.recipient} />
            <SummaryField label="Client" value={shipment.client} />
            <SummaryField label="Charge Model" value={shipment.chargeModel} />
            <SummaryField label="Total Amount" value={`₱${shipment.totalAmount?.toLocaleString()}`} />
          </View>

          <Text style={styles.unitsLabel}>Parcel Units — Each with a Unique Tracking ID + QR</Text>
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

        {firstUnit && (
          <View style={styles.sideCol}>
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

function SummaryField({ label, value }) {
  return (
    <View style={styles.summaryField}>
      <Text style={type.label}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
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
  },
  mainCard: {
    flex: 1,
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
    width: '30%',
    minWidth: 150,
  },
  summaryValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.ink,
    fontWeight: '600',
    marginTop: 3,
  },
  unitsLabel: {
    ...type.label,
    marginBottom: spacing.sm,
  },
  unitsList: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
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
    color: colors.ink,
    flex: 1,
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
    width: 320,
  },
  showingCaption: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
