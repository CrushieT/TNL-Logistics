import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { BackButton } from '../../../components/common/BackButton';
import { PressableScale } from '../../../components/common/PressableScale';
import { StatusModal } from '../../../components/common/StatusModal';
import { useAuth } from '../../../features/auth/context/AuthContext';
import { PasswordInput } from '../../../features/settings/components/PasswordInput';
import { normalizeSecurityError, validatePasswordChange } from '../../../features/settings/accountSecurityFlow.mjs';
import { colors } from '../../../theme';

export default function ChangeAccountPasswordScreen() {
  const router = useRouter();
  const { rotatePasswordInSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const submitGate = useRef(false);

  const clearSensitiveState = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
    setErrorMessage('');
    setRetryAfter(0);
  }, []);

  useFocusEffect(useCallback(() => () => clearSensitiveState(), [clearSensitiveState]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') clearSensitiveState();
    });
    return () => subscription.remove();
  }, [clearSensitiveState]);

  useEffect(() => {
    if (retryAfter <= 0) return undefined;
    const timer = setInterval(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  const updateField = (setter) => (value) => {
    setter(value);
    setErrorMessage('');
  };
  const validationError = validatePasswordChange(currentPassword, newPassword, confirmation);

  const handleSubmit = async () => {
    if (submitGate.current || validationError || retryAfter > 0) return;
    submitGate.current = true;
    setSubmitting(true);
    setErrorMessage('');
    try {
      await rotatePasswordInSession(currentPassword, newPassword);
      clearSensitiveState();
      setSuccessVisible(true);
    } catch (error) {
      const normalized = normalizeSecurityError(error);
      setErrorMessage(normalized.message);
      if (normalized.retryAfterSeconds) setRetryAfter(normalized.retryAfterSeconds);
    } finally {
      submitGate.current = false;
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}><BackButton /><Text style={styles.headerTitle}>CHANGE PASSWORD</Text><View style={styles.spacer} /></View>
          <Text style={styles.title}>Rotate Your Password</Text>
          <Text style={styles.subtitle}>Your current device stays bound and unlocked. Other sessions will renew through PIN unlock.</Text>
          {Boolean(errorMessage) && <View style={styles.error}><Text style={styles.errorText}>{errorMessage}{retryAfter > 0 ? ` Try again in ${retryAfter}s.` : ''}</Text></View>}
          <PasswordInput label="CURRENT PASSWORD" value={currentPassword} onChangeText={updateField(setCurrentPassword)} editable={!submitting} />
          <PasswordInput label="NEW PASSWORD" value={newPassword} onChangeText={updateField(setNewPassword)} editable={!submitting} />
          <PasswordInput label="CONFIRM NEW PASSWORD" value={confirmation} onChangeText={updateField(setConfirmation)} editable={!submitting} />
          <PressableScale
            contentStyle={[styles.submit, (validationError || submitting || retryAfter > 0) && styles.disabled]}
            onPress={handleSubmit}
            disabled={Boolean(validationError || submitting || retryAfter > 0)}
            accessibilityRole="button"
            accessibilityLabel="Update password"
          >
            <Text style={styles.submitText}>{submitting ? 'UPDATING…' : 'UPDATE PASSWORD'}</Text>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
      <StatusModal
        visible={successVisible}
        eyebrow="PASSWORD UPDATED"
        title="Password Changed"
        message="Your password was updated and this device remains unlocked."
        confirmText="Return to Account"
        onConfirm={() => { setSuccessVisible(false); router.replace('/(main)/settings'); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, flex: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 22, paddingBottom: 40 },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.ink, fontFamily: 'monospace', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }, spacer: { width: 52 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 24, marginBottom: 8 },
  subtitle: { color: colors.inkSoft, fontSize: 13.5, lineHeight: 20, marginBottom: 28 },
  error: { backgroundColor: colors.dangerSoft, borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 4, padding: 10, marginBottom: 16 },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  submit: { minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black, borderRadius: 4, marginTop: 6 },
  disabled: { backgroundColor: '#8E8E8E' }, submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
});
