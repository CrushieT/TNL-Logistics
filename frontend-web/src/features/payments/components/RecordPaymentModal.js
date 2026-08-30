import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors, fonts, spacing, radius } from '../../../theme';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank Transfer' },
  { value: 'GCASH', label: 'GCash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTHER', label: 'Other' },
];

export default function RecordPaymentModal({
  visible,
  shipment,
  onClose,
  onSubmitPayment,
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Compute remaining balance: Amount Due - Paid So Far
  const totalDue = Number(shipment?.totalAmount ?? shipment?.amountDue ?? 0);
  const paidSoFar = Number(shipment?.amountPaid ?? shipment?.paid ?? 0);
  const remainingBalance = shipment?.balance !== undefined && shipment?.balance !== null
    ? Number(shipment.balance)
    : Math.max(0, totalDue - paidSoFar);

  useEffect(() => {
    if (shipment && visible) {
      setAmount(remainingBalance > 0 ? String(remainingBalance) : '');
      setMethod('CASH');
      setReferenceNumber('');
      setRemarks('');
      setErrorMessage(null);
    }
  }, [shipment, visible, remainingBalance]);

  if (!visible || !shipment) return null;

  const handleAmountChange = (text) => {
    if (text === '') {
      setAmount('');
      setErrorMessage(null);
      return;
    }

    // Allow only numeric digits and a single decimal point
    const clean = text.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;

    const numericVal = parseFloat(sanitized);
    if (!isNaN(numericVal)) {
      if (numericVal > remainingBalance) {
        // Enforce maximum cap to remaining balance
        setAmount(String(remainingBalance));
        setErrorMessage(`Maximum payable amount is ₱${remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}.`);
        return;
      }
    }

    setAmount(sanitized);
    setErrorMessage(null);
  };

  const isReferenceRequired = ['GCASH', 'BANK', 'CHEQUE'].includes(method);

  const handleSubmit = async () => {
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than ₱0.00.');
      return;
    }

    if (numericAmount > remainingBalance + 0.001) {
      setErrorMessage(`Payment amount cannot exceed the remaining balance of ₱${remainingBalance.toLocaleString()}.`);
      return;
    }

    if (isReferenceRequired && !referenceNumber.trim()) {
      const methodLabel = method === 'BANK' ? 'Bank Transfer' : method === 'GCASH' ? 'GCash' : 'Cheque';
      setErrorMessage(`Reference number is required for ${methodLabel} payments.`);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = {
        shipmentId: shipment.shipmentId,
        amountPaid: numericAmount,
        method,
        referenceNo: referenceNumber.trim() || null,
        paymentDate: new Date().toISOString().split('T')[0],
        remarks: remarks.trim() || null,
      };

      await onSubmitPayment(payload);
      onClose();
    } catch (err) {
      const errorText = extractErrorMessage(err);
      setErrorMessage(errorText);
    } finally {
      setSubmitting(false);
    }
  };

  const extractErrorMessage = (err) => {
    if (err?.response?.data) {
      const data = err.response.data;
      if (data.message) return data.message;
      if (data.fieldErrors) {
        const firstField = Object.values(data.fieldErrors)[0];
        if (firstField) return firstField;
      }
      if (data.error) return data.error;
    }
    return err?.message || 'Failed to record payment.';
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>RECORD PAYMENT</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Shipment Summary Box */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardHeader}>
              {shipment.shipmentId} · {shipment.clientName || shipment.client || 'Client'}
            </Text>
            <View style={styles.infoCardBalanceRow}>
              <Text style={styles.infoCardBalanceLabel}>Balance</Text>
              <Text style={styles.infoCardBalanceValue}>
                ₱{remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* Form Content */}
          <View style={styles.formBody}>
            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Amount Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                AMOUNT PAID (₱) <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={colors.inkFaint}
                style={styles.textInput}
              />
            </View>

            {/* Method & Reference No Row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>METHOD</Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    style={webSelectStyle}
                  >
                    {PAYMENT_METHODS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <TextInput
                    value={method}
                    onChangeText={setMethod}
                    style={styles.textInput}
                  />
                )}
              </View>

              <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                <Text style={styles.fieldLabel}>
                  REFERENCE NO. {isReferenceRequired ? <Text style={styles.requiredStar}>*</Text> : null}
                </Text>
                <TextInput
                  value={referenceNumber}
                  onChangeText={setReferenceNumber}
                  placeholder="e.g. GCASH-12345"
                  placeholderTextColor={colors.inkFaint}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* Remarks Field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>REMARKS</Text>
              <TextInput
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Optional payment notes..."
                placeholderTextColor={colors.inkFaint}
                style={styles.textInput}
              />
            </View>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              style={({ hovered, pressed }) => [
                styles.cancelBtn,
                hovered && styles.cancelBtnHovered,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ hovered, pressed }) => [
                styles.submitBtn,
                hovered && styles.submitBtnHovered,
                pressed && { opacity: 0.85 },
                submitting && { opacity: 0.6 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Record Payment</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const webSelectStyle = {
  fontFamily: fonts.sans,
  fontSize: 13,
  color: colors.ink,
  backgroundColor: '#FAF9F5',
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  padding: '10px 12px',
  outline: 'none',
  width: '100%',
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.ink,
    textTransform: 'uppercase',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: colors.inkFaint,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#F7F6F2',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoCardHeader: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  infoCardBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoCardBalanceLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
  },
  infoCardBalanceValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  formBody: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.inkSoft,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  requiredStar: {
    color: '#DC2626',
  },
  textInput: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    outlineStyle: 'none',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FAF9F5',
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelBtnHovered: {
    backgroundColor: '#EBE9E1',
  },
  cancelBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.ink,
  },
  submitBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  submitBtnHovered: {
    backgroundColor: '#2A2A2A',
  },
  submitBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
