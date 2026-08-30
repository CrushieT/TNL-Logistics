import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import StatusBadge from '../../../components/common/StatusBadge';
import { getShipmentPaymentHistory } from '../services/paymentApi';
import { colors, fonts, spacing, radius } from '../../../theme';

export default function PaymentHistoryModal({
  visible,
  shipment,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyData, setHistoryData] = useState(null);

  useEffect(() => {
    if (visible && shipment?.shipmentId) {
      fetchHistory(shipment.shipmentId);
    } else {
      setHistoryData(null);
      setError(null);
    }
  }, [visible, shipment?.shipmentId]);

  const fetchHistory = async (shipmentId) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getShipmentPaymentHistory(shipmentId);
      setHistoryData(data);
    } catch (err) {
      console.error('Failed to load payment history:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch payment history.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !shipment) return null;

  const totalDue = historyData?.totalAmount ?? Number(shipment.totalAmount ?? shipment.amountDue ?? 0);
  const totalPaid = historyData?.totalPaid ?? Number(shipment.amountPaid ?? shipment.paid ?? 0);
  const remainingBalance = historyData?.balance ?? (shipment.balance !== undefined && shipment.balance !== null
    ? Number(shipment.balance)
    : Math.max(0, totalDue - totalPaid));
  const paymentStatus = historyData?.paymentStatus || shipment.payment || (remainingBalance <= 0 ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Unpaid');

  const paymentsList = historyData?.payments || [];

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₱${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>PAYMENT HISTORY</Text>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Shipment Summary Box */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardTopRow}>
              <Text style={styles.shipmentTitle}>
                {shipment.shipmentId} · {historyData?.clientName || shipment.clientName || shipment.client || 'Client'}
              </Text>
              <StatusBadge value={paymentStatus} kind="payment" />
            </View>

            {/* 3-Column Metrics Breakdown */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>AMOUNT DUE</Text>
                <Text style={styles.metricValue}>{formatCurrency(totalDue)}</Text>
              </View>

              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>TOTAL PAID</Text>
                <Text style={[styles.metricValue, { color: colors.ink }]}>{formatCurrency(totalPaid)}</Text>
              </View>

              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>BALANCE</Text>
                <Text style={[styles.metricValue, { color: remainingBalance > 0 ? '#DC2626' : '#16A34A' }]}>
                  {formatCurrency(remainingBalance)}
                </Text>
              </View>
            </View>
          </View>

          {/* Ledger Table Content */}
          <View style={styles.body}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.ink} size="small" />
                <Text style={styles.loadingText}>Loading payment records...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : paymentsList.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No payments recorded yet</Text>
                <Text style={styles.emptySub}>
                  Payments recorded against this shipment will be listed here chronologically.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.scrollArea}>
                {/* Ledger Header */}
                <View style={styles.ledgerHeaderRow}>
                  <Text style={[styles.ledgerHeaderCell, { flex: 1.1 }]}>DATE</Text>
                  <Text style={[styles.ledgerHeaderCell, { flex: 1.0, textAlign: 'right' }]}>AMOUNT</Text>
                  <Text style={[styles.ledgerHeaderCell, { flex: 1.1 }]}>METHOD</Text>
                  <Text style={[styles.ledgerHeaderCell, { flex: 1.3 }]}>REFERENCE NO.</Text>
                  <Text style={[styles.ledgerHeaderCell, { flex: 1.5 }]}>REMARKS</Text>
                  <Text style={[styles.ledgerHeaderCell, { flex: 1.1 }]}>STAFF</Text>
                </View>

                {/* Ledger Rows */}
                {paymentsList.map((p, idx) => {
                  const methodLabel = p.method === 'BANK' || p.method === 'BANK_TRANSFER'
                    ? 'Bank Transfer'
                    : p.method === 'GCASH'
                    ? 'GCash'
                    : p.method === 'CHEQUE'
                    ? 'Cheque'
                    : p.method === 'CASH'
                    ? 'Cash'
                    : (p.method || 'Other');

                  return (
                    <View
                      key={p.paymentId || idx}
                      style={[
                        styles.ledgerRow,
                        idx !== paymentsList.length - 1 && styles.ledgerRowDivider,
                      ]}
                    >
                      <View style={{ flex: 1.1 }}>
                        <Text style={styles.dateCell}>{p.paymentDateFormatted || p.paymentDate || '—'}</Text>
                      </View>

                      <View style={{ flex: 1.0, alignItems: 'flex-end' }}>
                        <Text style={styles.amountCell}>{formatCurrency(p.amountPaid)}</Text>
                      </View>

                      <View style={{ flex: 1.1 }}>
                        <Text style={styles.methodCell}>{methodLabel}</Text>
                      </View>

                      <View style={{ flex: 1.3 }}>
                        <Text style={styles.refCell}>{p.referenceNo || '—'}</Text>
                      </View>

                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.remarksCell}>{p.remarks || '—'}</Text>
                      </View>

                      <View style={{ flex: 1.1 }}>
                        <Text style={styles.staffCell}>{p.recordedByStaff || '—'}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={({ hovered, pressed }) => [
                styles.closeModalBtn,
                hovered && styles.closeModalBtnHovered,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.closeModalBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
    maxWidth: 680,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
    maxHeight: '85%',
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
  infoCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  shipmentTitle: {
    fontFamily: fonts.mono,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 180,
  },
  scrollArea: {
    maxHeight: 280,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F5',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  ledgerHeaderCell: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  ledgerRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateCell: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
  },
  amountCell: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  methodCell: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink,
  },
  refCell: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  remarksCell: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkSoft,
  },
  staffCell: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  emptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.inkFaint,
    textAlign: 'center',
    maxWidth: 360,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FAF9F5',
  },
  closeModalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeModalBtnHovered: {
    backgroundColor: '#EBE9E1',
  },
  closeModalBtnText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.ink,
  },
});
