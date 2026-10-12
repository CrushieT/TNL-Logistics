import React, { useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import apiClient from '../../services/api/client';

export default function ExceptionAction({ label, record, endpoint, onRefresh, isAvailable = true, children }) {
  const [review, setReview] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [hasConflict, setHasConflict] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const isSubmitting = useRef(false);
  const command = useRef(null);

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
        try { await onRefresh(); } catch { /* The refresh action remains available. */ }
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
      {isAvailable && <Pressable accessibilityRole="button" onPress={openReview} style={{ padding: 10 }}>
        <Text>{label}</Text>
      </Pressable>}
      <Modal visible={Boolean(review)} transparent onRequestClose={() => { if (!isBusy) setReview(null); }}>
        <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', padding: 24, gap: 14, width: '100%', maxWidth: 520 }}>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>{review?.label}</Text>
            <Text>{review?.trackingId || review?.waybillId}</Text>
            <Text>Shipment: {review?.shipmentId}</Text>
            <Text>Waybill: {review?.waybillId || 'Unassigned'}</Text>
            {review?.status && <Text>Last confirmed: {review.status}</Text>}
            {children}
            <TextInput accessibilityLabel="Required reason" placeholder="Required reason (1–255 characters)"
              multiline value={reason} onChangeText={setReason} editable={!isBusy && !hasConflict}
              style={{ borderWidth: 1, borderColor: '#aaa', padding: 12, minHeight: 80 }} />
            {error ? <Text accessibilityRole="alert" style={{ color: '#a00' }}>{error}</Text> : null}
            {hasConflict ? (
              <Pressable accessibilityRole="button" disabled={isBusy} onPress={refreshReview}><Text>Refresh and review again</Text></Pressable>
            ) : (
              <Pressable accessibilityRole="button" disabled={isBusy || !reason.trim() || reason.trim().length > 255} onPress={submit}>
                <Text>{isBusy ? 'Saving…' : 'Confirm'}</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => setReview(null)}><Text>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
