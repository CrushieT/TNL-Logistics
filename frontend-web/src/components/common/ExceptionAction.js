import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import apiClient from '../../services/api/client';
import { colors, fonts, radius, spacing, type } from '../../theme';

export default function ExceptionAction({ label, record, endpoint, onRefresh, isAvailable = true }) {
  const [review, setReview] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [hasConflict, setHasConflict] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const isSubmitting = useRef(false);
  const command = useRef(null);
  const isRecovery = endpoint.endsWith('/found');
  const isWaybillClosure = endpoint.endsWith('/close-all-lost');

  const closeReview = () => {
    if (!isSubmitting.current) setReview(null);
  };

  const openReview = () => {
    if (!isAvailable) return;
    setReview({ ...record, endpoint, label });
    setReason('');
    setError('');
    setHasConflict(false);
    command.current = null;
  };

  const refreshReview = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setIsBusy(true);
    try {
      await onRefresh();
      setReview(null);
      setError('');
      setHasConflict(false);
    } catch {
      setError('Could not refresh. Try again.');
    } finally {
      isSubmitting.current = false;
      setIsBusy(false);
    }
  };

  const submit = async () => {
    const trimmedReason = reason.trim();
    if (isSubmitting.current || hasConflict || !trimmedReason || trimmedReason.length > 255) return;
    isSubmitting.current = true;
    setIsBusy(true);
    setError('');
    const body = { reason: trimmedReason, expectedRevision: review.revision ?? review.manifestRevision };
    const content = JSON.stringify({ endpoint: review.endpoint, ...body });
    let isSaved = false;
    try {
      if (command.current?.content !== content) {
        command.current = { content, requestId: globalThis.crypto.randomUUID() };
      }
      await apiClient.post(review.endpoint, { ...body, requestId: command.current.requestId });
      isSaved = true;
      await onRefresh();
      setReview(null);
    } catch (failure) {
      const isConflict = failure?.response?.status === 409;
      setHasConflict(isConflict || isSaved);
      if (isConflict) {
        try { await onRefresh(); } catch { /* Refresh remains available in the dialog. */ }
      }
      setError(isSaved ? 'Update saved, but the refreshed record could not be loaded. Refresh before continuing.' : isConflict
        ? 'This record changed. Refresh, then open a new confirmation to review the current state.'
        : failure?.response?.data?.message || 'Update failed. Your reason is retained; try again.');
    } finally {
      isSubmitting.current = false;
      setIsBusy(false);
    }
  };

  return (
    <>
      {isAvailable && <Pressable accessibilityRole="button" onPress={openReview}
        style={[styles.trigger, isRecovery ? styles.triggerRecovery : styles.triggerLoss]}>
        <Text style={[styles.triggerText, isRecovery ? styles.recoveryText : styles.lossText]}>{label}</Text>
      </Pressable>}
      <Modal visible={Boolean(review)} transparent animationType="fade" onRequestClose={closeReview}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>ADMIN REVIEW</Text>
                <Text style={styles.title}>{review?.label}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close confirmation"
                disabled={isBusy} onPress={closeReview} style={styles.closeButton}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <View style={styles.contextCard}>
                <View style={styles.contextRow}>
                  <Text style={styles.contextLabel}>{isWaybillClosure ? 'WAYBILL' : 'TRACKING ID'}</Text>
                  <Text style={styles.contextValue}>{review?.trackingId || review?.waybillId}</Text>
                </View>
                <View style={styles.contextRow}>
                  <Text style={styles.contextLabel}>SHIPMENT</Text>
                  <Text style={styles.contextValue}>{review?.shipmentId}</Text>
                </View>
                {!isWaybillClosure && <View style={styles.contextRow}>
                  <Text style={styles.contextLabel}>ASSIGNED WAYBILL</Text>
                  <Text style={styles.contextValue}>{review?.waybillId || 'Unassigned'}</Text>
                </View>}
                <View style={styles.contextRow}>
                  <Text style={styles.contextLabel}>{isWaybillClosure ? 'CURRENT STATE' : 'LAST CONFIRMED'}</Text>
                  <Text style={styles.contextStatus}>{isWaybillClosure ? review?.statusLabel || review?.status : review?.status}</Text>
                </View>
                {isWaybillClosure && <View style={styles.contextRow}>
                  <Text style={styles.contextLabel}>MANIFEST</Text>
                  <Text style={styles.contextStatus}>{review?.lostCount} of {review?.totalQuantity} lost</Text>
                </View>}
              </View>

              <View style={[styles.notice, isRecovery ? styles.recoveryNotice : styles.lossNotice]}>
                <Text style={[styles.noticeTitle, isRecovery ? styles.recoveryText : styles.lossText]}>
                  {isWaybillClosure ? 'ALL PARCELS LOST' : isRecovery ? 'RECOVERY REVIEW' : 'LOSS REVIEW'}
                </Text>
                <Text style={styles.noticeCopy}>
                  {isWaybillClosure
                    ? 'This closes the waybill without delivery events or a signed-paper return.'
                    : isRecovery
                    ? 'The parcel resumes from its last confirmed position. A closed waybill reopens for Dispatch review.'
                    : 'The parcel keeps its last confirmed position. Scanning pauses until it is marked found.'}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>REASON *</Text>
                <TextInput accessibilityLabel="Required reason" placeholder="Describe the reason for this change"
                  placeholderTextColor={colors.inkFaint} multiline maxLength={255}
                  value={reason} onChangeText={setReason} editable={!isBusy && !hasConflict}
                  style={styles.reasonInput} textAlignVertical="top" />
                <Text style={styles.characterCount}>{reason.trim().length} / 255 characters</Text>
              </View>
            </ScrollView>

            {error ? <View style={styles.errorBox}>
              <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            </View> : null}
            <View style={styles.footer}>
              <Pressable accessibilityRole="button" disabled={isBusy} onPress={closeReview} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              {hasConflict ? (
                <Pressable accessibilityRole="button" disabled={isBusy} onPress={refreshReview}
                  style={[styles.confirmButton, isBusy && styles.disabledButton]}>
                  {isBusy ? <ActivityIndicator color={colors.surface} size="small" />
                    : <Text style={styles.confirmText}>Refresh and review again</Text>}
                </Pressable>
              ) : (
                <Pressable accessibilityRole="button" disabled={isBusy || !reason.trim() || reason.trim().length > 255}
                  onPress={submit} style={[styles.confirmButton, !isRecovery && styles.dangerButton,
                    (isBusy || !reason.trim() || reason.trim().length > 255) && styles.disabledButton]}>
                  {isBusy ? <ActivityIndicator color={colors.surface} size="small" />
                    : <Text style={styles.confirmText}>Confirm {isWaybillClosure ? 'Closure' : isRecovery ? 'Found' : 'Lost'}</Text>}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  triggerLoss: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  triggerRecovery: { backgroundColor: colors.successSoft, borderColor: colors.success },
  triggerText: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '800' },
  lossText: { color: colors.danger },
  recoveryText: { color: colors.success },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { ...type.label, color: colors.inkFaint },
  title: { fontFamily: fonts.sans, fontSize: 19, fontWeight: '800', color: colors.ink },
  closeButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  closeText: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '700', color: colors.inkFaint },
  bodyScroll: { flexShrink: 1 },
  body: { padding: spacing.xl, gap: spacing.lg },
  contextCard: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  contextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  contextLabel: { ...type.label, flex: 1, fontSize: 10 },
  contextValue: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'right', flex: 1.5 },
  contextStatus: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '700', color: colors.ink, textAlign: 'right', flex: 1.5 },
  notice: { borderWidth: 1, borderRadius: radius.sm, padding: spacing.md, gap: spacing.xs },
  lossNotice: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  recoveryNotice: { backgroundColor: colors.successSoft, borderColor: colors.success },
  noticeTitle: { ...type.label, fontSize: 10 },
  noticeCopy: { ...type.bodySmall, lineHeight: 17, color: colors.inkSoft },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: { ...type.label, color: colors.ink },
  reasonInput: {
    minHeight: 96,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: fonts.sans,
    fontSize: 13,
  },
  characterCount: { fontFamily: fonts.mono, fontSize: 10, color: colors.inkFaint, textAlign: 'right' },
  errorBox: { backgroundColor: colors.dangerSoft, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  errorText: { fontFamily: fonts.sans, fontSize: 12, color: colors.danger, fontWeight: '700' },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  cancelButton: { minHeight: 40, paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm, backgroundColor: colors.surface },
  cancelText: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '700', color: colors.ink },
  confirmButton: { minHeight: 40, minWidth: 150, paddingHorizontal: spacing.lg, justifyContent: 'center',
    alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.ink },
  dangerButton: { backgroundColor: colors.danger },
  confirmText: { fontFamily: fonts.sans, fontSize: 12, fontWeight: '800', color: colors.surface },
  disabledButton: { opacity: 0.4 },
});
