import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing, radius } from '../../../theme';
import { formatCurrency } from '../utils/collectionsUtils';

export default function BatchSoaModal({
  visible,
  cycleDate,
  eligibleClients = [],
  onClose,
  onConfirmBatch,
}) {
  const [submitting, setSubmitting] = useState(false);

  if (!visible) return null;

  const totalAmount = eligibleClients.reduce(
    (sum, c) => sum + Number(c.netAmountDue || c.currentCharges || 0),
    0
  );

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onConfirmBatch?.();
      onClose?.();
    } catch (err) {
      console.warn('Batch generation error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>GENERATE BATCH STATEMENTS OF ACCOUNT</Text>
            <Pressable
              onPress={onClose}
              style={({ hovered }) => [styles.closeBtn, hovered && styles.closeBtnHovered]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Body Info */}
          <View style={styles.body}>
            <Text style={styles.leadText}>
              You are about to generate Statements of Account (SOAs) for all eligible clients in this Thursday collection cycle.
            </Text>

            {/* Summary Highlights */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Collection Cycle:</Text>
                <Text style={styles.summaryValue}>{cycleDate}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Eligible Clients:</Text>
                <Text style={styles.summaryValue}>{eligibleClients.length} clients</Text>
              </View>

              <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <Text style={styles.summaryLabel}>Total Net Billing:</Text>
                <Text style={[styles.summaryValue, styles.totalAmountText]}>
                  {formatCurrency(totalAmount)}
                </Text>
              </View>
            </View>

            <Text style={styles.noteText}>
              Note: Generating SOAs will assign statement numbers and lock unbilled shipments for this collection period.
            </Text>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              style={({ hovered }) => [styles.cancelBtn, hovered && styles.cancelBtnHovered]}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              disabled={submitting || eligibleClients.length === 0}
              style={({ hovered }) => [
                styles.confirmBtn,
                (submitting || eligibleClients.length === 0) && styles.confirmBtnDisabled,
                hovered && !submitting && styles.confirmBtnHovered,
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>
                  Generate {eligibleClients.length} SOAs →
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.4,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnHovered: {
    opacity: 0.7,
  },
  closeBtnText: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.inkFaint,
  },
  body: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 16,
  },
  leadText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 18,
  },
  summaryBox: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  summaryLabel: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  summaryValue: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  totalAmountText: {
    fontFamily: fonts.mono,
    color: colors.ink,
    fontSize: 14,
  },
  noteText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FAF9F5',
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  cancelBtnHovered: {
    backgroundColor: '#F3F2EB',
  },
  cancelBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnHovered: {
    opacity: 0.88,
  },
  confirmBtnDisabled: {
    backgroundColor: '#8A897F',
    opacity: 0.5,
  },
  confirmBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
