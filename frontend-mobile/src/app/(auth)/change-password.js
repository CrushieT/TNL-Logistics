import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../features/auth/context/AuthContext';
import { PressableScale } from '../../components/common/PressableScale';
import { colors } from '../../theme';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user, token, mustChangePassword, completeRequiredPasswordChange, isLoading: authLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && (!token || !user || !mustChangePassword)) {
      router.replace('/(auth)/login');
    }
  }, [authLoading, mustChangePassword, router, token, user]);

  const handleSubmit = async () => {
    if (submitting || !currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const result = await completeRequiredPasswordChange(currentPassword, newPassword);
      router.replace({
        pathname: '/(auth)/login',
        params: { username: result.username || '', reason: 'password_changed' },
      });
    } catch (error) {
      setErrorMessage(error.message || 'Unable to update your password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isButtonEnabled = Boolean(currentPassword && newPassword && confirmPassword && !submitting);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" bounces={false}>
          <Text style={styles.eyebrow}>SECURITY REQUIREMENT</Text>
          <Text style={styles.title}>Change Your Password</Text>
          <Text style={styles.subtitle}>
            Update your temporary password before this device can be bound or unlocked with a PIN.
          </Text>

          {Boolean(errorMessage) && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.form}>
            <PasswordField label="CURRENT PASSWORD" value={currentPassword} onChangeText={setCurrentPassword} editable={!submitting} />
            <PasswordField label="NEW PASSWORD" value={newPassword} onChangeText={setNewPassword} editable={!submitting} />
            <PasswordField label="CONFIRM NEW PASSWORD" value={confirmPassword} onChangeText={setConfirmPassword} editable={!submitting} />

            <PressableScale
              style={styles.actionButtonPressable}
              contentStyle={[styles.actionButton, isButtonEnabled ? styles.actionButtonActive : styles.actionButtonDisabled]}
              onPress={handleSubmit}
              disabled={!isButtonEnabled}
              activeScale={0.97}
            >
              {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.actionText}>UPDATE PASSWORD</Text>}
            </PressableScale>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PasswordField({ label, value, onChangeText, editable }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  keyboardAvoid: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32 },
  eyebrow: { color: colors.accent, fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', marginBottom: 10 },
  subtitle: { color: colors.inkSoft, fontSize: 14, lineHeight: 21, marginBottom: 24 },
  form: { width: '100%' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: colors.inkSoft, fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 4, borderWidth: 1, color: colors.ink, fontSize: 14, height: 46, paddingHorizontal: 12 },
  errorContainer: { backgroundColor: colors.dangerSoft, borderColor: '#FCA5A5', borderRadius: 4, borderWidth: 1, marginBottom: 16, padding: 10 },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  actionButtonPressable: { width: '100%' },
  actionButton: { alignItems: 'center', borderRadius: 3, height: 48, justifyContent: 'center', marginTop: 8 },
  actionButtonActive: { backgroundColor: colors.black },
  actionButtonDisabled: { backgroundColor: '#8E8E8E' },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.8 },
});
