import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../theme';
import { PressableScale } from '../../../components/common/PressableScale';
import { PasswordInput } from './PasswordInput';

export function PasswordChallengeModal({ visible, password, onPasswordChange, onCancel, onSubmit, error, submitting }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={submitting ? undefined : onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>PASSWORD CHALLENGE</Text>
          <Text style={styles.title}>Verify Your Password</Text>
          <Text style={styles.message}>Enter your current password before changing the device PIN.</Text>
          {Boolean(error) && <Text style={styles.error}>{error}</Text>}
          <PasswordInput
            label="CURRENT PASSWORD"
            value={password}
            onChangeText={onPasswordChange}
            editable={!submitting}
            autoFocus
          />
          <View style={styles.actions}>
            <PressableScale
              style={styles.action}
              contentStyle={styles.cancel}
              onPress={onCancel}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Cancel password verification"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </PressableScale>
            <PressableScale
              style={styles.action}
              contentStyle={[styles.submit, (!password || submitting) && styles.disabled]}
              onPress={onSubmit}
              disabled={!password || submitting}
              accessibilityRole="button"
              accessibilityLabel="Verify current password"
            >
              {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.submitText}>Verify</Text>}
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.canvas, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 22 },
  eyebrow: { color: colors.accent, fontFamily: 'monospace', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  title: { color: colors.ink, fontSize: 19, fontWeight: '800', marginBottom: 6 },
  message: { color: colors.inkSoft, fontSize: 13, lineHeight: 19, marginBottom: 18 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '700', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  cancel: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderColor: colors.border, borderWidth: 1, borderRadius: 4 },
  cancelText: { color: colors.inkSoft, fontWeight: '700' },
  submit: { minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black, borderRadius: 4 },
  disabled: { backgroundColor: '#8E8E8E' },
  submitText: { color: '#FFFFFF', fontWeight: '800' },
});
