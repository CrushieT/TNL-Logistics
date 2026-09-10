import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Card from '../../../components/common/Card';
import FormField from '../../../components/common/FormField';
import SelectField from '../../../components/common/SelectField';
import { colors, fonts, spacing, radius, type } from '../../../theme';

const COLLECTION_DAYS = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
];

export default function CollectionWeightTrackingCard({
  form,
  errors,
  onChangeField,
  onSave,
  saving,
}) {
  const divisorNumber = parseInt(form.volumetricDivisor, 10) || 5000;

  const formulaPreview = useMemo(() => {
    const divisor = divisorNumber > 0 ? divisorNumber : 5000;
    const computedKg = (60000 / divisor).toFixed(2);
    return `e.g. 50×40×30 = 60,000 cm³ ÷ ${divisor.toLocaleString()} = ${computedKg} kg`;
  }, [divisorNumber]);

  return (
    <Card title="COLLECTION, WEIGHT & TRACKING" style={styles.card}>
      {/* Weekly Collection Day */}
      <View style={styles.fieldWrap}>
        <SelectField
          label="WEEKLY COLLECTION DAY"
          required
          value={form.collectionDay}
          onValueChange={(val) => onChangeField('collectionDay', val)}
          options={COLLECTION_DAYS}
          error={errors.collectionDay}
          helper="System prepares the consolidated collection list automatically."
        />
      </View>

      {/* Volumetric Divisor & Reactive Preview */}
      <View style={styles.fieldWrap}>
        <View style={styles.divisorRow}>
          <View style={styles.divisorInputWrap}>
            <FormField
              label="VOLUMETRIC DIVISOR"
              required
              value={String(form.volumetricDivisor || '')}
              onChangeText={(val) => onChangeField('volumetricDivisor', val)}
              placeholder="5000"
              keyboardType="numeric"
              integerOnly
              error={errors.volumetricDivisor}
            />
          </View>
          <View style={styles.previewFormulaWrap}>
            <Text style={styles.previewFormulaText}>{formulaPreview}</Text>
          </View>
        </View>
        <Text style={styles.subHelper}>
          Configurable business setting — Volumetric Weight = Volume (cm³) ÷ divisor.
        </Text>
      </View>

      {/* Read-Only Prefixes */}
      <View style={styles.fieldWrap}>
        <FormField
          label="TRACKING ID PREFIX"
          value={form.trackingIdPrefixPreview || 'TRK-2026-'}
          editable={false}
          inputStyle={styles.readOnlyInput}
        />
      </View>

      <View style={styles.fieldWrap}>
        <FormField
          label="SHIPMENT ID PREFIX"
          value={form.shipmentIdPrefixPreview || 'SHP-2026-'}
          editable={false}
          inputStyle={styles.readOnlyInput}
        />
      </View>

      {/* Provisional Billable Weight Callout */}
      <View style={styles.calloutBox}>
        <Text style={styles.calloutTitle}>BILLABLE WEIGHT RULE — PROVISIONAL</Text>
        <Text style={styles.calloutBody}>
          Current rule: <Text style={styles.calloutBold}>Greater of Actual Weight vs Volumetric Weight</Text>.
          {' '}This is a placeholder pending final client confirmation. The system always stores Actual Weight,
          Volume, and Volumetric Weight separately — the billable weight formula can be updated when confirmed.
        </Text>
      </View>

      {/* Explanatory System Note */}
      <Text style={styles.systemNote}>
        Tracking: Registered → QR Generated → Loaded on Truck → Outload / Arrive TNL → Loaded to Hauler (per unit).
        Payment, Label & Waybill statuses are tracked separately. History is append-only.
      </Text>

      {/* Save Settings Action */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <Text style={styles.saveBtnText}>Save Settings</Text>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 320,
  },
  fieldWrap: {
    marginBottom: spacing.md,
  },
  divisorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  divisorInputWrap: {
    flex: 1,
    minWidth: 120,
  },
  previewFormulaWrap: {
    flex: 2,
    marginTop: 26,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    justifyContent: 'center',
  },
  previewFormulaText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkMuted,
  },
  subHelper: {
    ...type.bodySmall,
    color: colors.inkFaint,
    marginTop: -8,
    marginBottom: spacing.sm,
  },
  readOnlyInput: {
    backgroundColor: '#F3F4F6',
    color: colors.inkMuted,
    fontFamily: fonts.mono,
  },
  calloutBox: {
    borderWidth: 1,
    borderColor: '#EF4444',
    borderStyle: 'dashed',
    borderRadius: radius.xs,
    padding: spacing.md,
    backgroundColor: '#FEF2F2',
    marginVertical: spacing.md,
  },
  calloutTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  calloutBody: {
    ...type.bodySmall,
    color: '#991B1B',
    lineHeight: 18,
  },
  calloutBold: {
    fontWeight: '700',
  },
  systemNote: {
    ...type.bodySmall,
    color: colors.inkFaint,
    fontFamily: fonts.mono,
    fontSize: 11.5,
    lineHeight: 18,
    marginVertical: spacing.md,
  },
  actionRow: {
    alignItems: 'flex-start',
    marginTop: spacing.sm,
  },
  saveBtn: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radius.xs,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
});
