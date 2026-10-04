import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import FormField from '../../../components/common/FormField';
import { colors, fonts, spacing, radius, type } from '../../../theme';

function formatMeasure(value, digits, suffix) {
  return value === null ? 'Unavailable' : `${value.toFixed(digits)} ${suffix}`;
}

export default function ShipmentPricingSummary({
  ratePerKilo,
  volumetricDivisor,
  shipmentMetrics = {},
  otherCharges = '0',
  onOtherChargesChange,
  totalAmount = 0,
  errors = {},
  calculationSettingsState = 'loading',
  onRetryCalculationSettings,
}) {
  return (
    <View style={styles.summaryContainer}>
      <Text style={styles.dimensionsHeader}>LIVE RATING BREAKDOWN & SUMMARY</Text>
      <View style={styles.summaryGrid}>
        {/* 1. Rate per Kilo (Read-only) */}
        <View style={styles.summaryCardCol}>
          <Text style={type.label}>Rate per Kilo</Text>
          <View style={styles.readOnlyStatBox}>
            <Text style={styles.statLargeText}>
              {ratePerKilo ? `₱${Number(ratePerKilo).toFixed(2)}` : '—'}
            </Text>
            <Text style={styles.statSubText}>Configured by Admin</Text>
          </View>
        </View>

        {/* 2. Weight Metrics */}
        <View style={styles.summaryCardCol}>
          <Text style={type.label}>Weight Summary</Text>
          <View style={styles.metricsBox}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Total Actual Weight</Text>
              <Text style={styles.metricValue}>
                {formatMeasure(shipmentMetrics.actualWeight, 2, 'kg')}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                Volumetric Weight (/{volumetricDivisor || 5000})
              </Text>
              <Text style={styles.metricValue}>
                {formatMeasure(shipmentMetrics.volumetricWeight, 2, 'kg')}
              </Text>
            </View>
            <View style={[styles.metricRow, styles.billableRow]}>
              <Text style={styles.billableLabel}>Billable Weight</Text>
              <Text style={styles.billableValue}>
                {formatMeasure(shipmentMetrics.billableWeight, 2, 'kg')}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Charges & Total */}
        <View style={styles.summaryCardCol}>
          <FormField
            label="Other Charges (₱)"
            value={otherCharges}
            onChangeText={onOtherChargesChange}
            numericOnly
            placeholder="0"
            maxLength={13}
            helper="Valuation, packaging, etc."
            error={errors.otherCharges}
          />
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
            <Text style={styles.totalValue}>
              ₱{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.totalFormula}>
              {shipmentMetrics.shippingFee !== null ? `₱${shipmentMetrics.shippingFee.toFixed(2)} shipping` : '—'}
              {' + ₱'}{(parseFloat(otherCharges) || 0).toFixed(2)} charges
            </Text>
          </View>
        </View>
      </View>

      {/* Settings Status Notice */}
      {calculationSettingsState === 'loading' ? (
        <View style={styles.settingsStatusRow}>
          <ActivityIndicator color={colors.inkSoft} size="small" />
          <Text style={styles.settingsMessage}>Loading rate and weight settings from server...</Text>
        </View>
      ) : null}

      {calculationSettingsState === 'unconfigured' ? (
        <View style={styles.settingsAlertBox}>
          <Text style={styles.settingsAlertTitle}>Rate per Kilo Not Configured</Text>
          <Text style={styles.settingsAlertMessage}>
            Shipment registration is blocked because Rate per Kilo is not configured. An administrator must set the rate in Settings before shipments can be registered.
          </Text>
        </View>
      ) : null}

      {calculationSettingsState === 'error' ? (
        <View style={styles.settingsErrorBox}>
          <Text style={styles.settingsAlertTitle}>Calculation Settings Unavailable</Text>
          <Text style={styles.settingsAlertMessage}>
            Unable to load rate and divisor settings from server. Please check connection and retry.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onRetryCalculationSettings}
            style={styles.settingsRetry}
          >
            <Text style={styles.settingsRetryText}>Retry Settings</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryContainer: {
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  dimensionsHeader: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  summaryCardCol: {
    flex: 1,
    minWidth: 240,
  },
  readOnlyStatBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: '#FFFFFF',
    marginTop: spacing.xs,
    justifyContent: 'center',
    minHeight: 70,
  },
  statLargeText: {
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: '900',
    color: colors.ink,
  },
  statSubText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  metricsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.xs,
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metricLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkSoft,
  },
  metricValue: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
  },
  billableRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  billableLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
  },
  billableValue: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: '900',
    color: colors.ink,
  },
  totalBox: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.xs + 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    minHeight: 70,
  },
  totalLabel: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: colors.inkFaint,
    letterSpacing: 0.8,
  },
  totalValue: {
    fontFamily: fonts.sans,
    fontSize: 24,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: -0.5,
  },
  totalFormula: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  settingsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  settingsMessage: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    lineHeight: 15,
  },
  settingsAlertBox: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  settingsAlertTitle: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 2,
  },
  settingsAlertMessage: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkSoft,
    lineHeight: 16,
  },
  settingsErrorBox: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  settingsRetry: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  settingsRetryText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    textDecorationLine: 'underline',
  },
});
