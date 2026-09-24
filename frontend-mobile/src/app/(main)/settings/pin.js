import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BackButton } from '../../../components/common/BackButton';
import { Keypad } from '../../../components/common/Keypad';
import { PinIndicator } from '../../../components/common/PinIndicator';
import { PressableScale } from '../../../components/common/PressableScale';
import { StatusModal } from '../../../components/common/StatusModal';
import { useAuth } from '../../../features/auth/context/AuthContext';
import { authService } from '../../../features/auth/services/authService';
import { PasswordChallengeModal } from '../../../features/settings/components/PasswordChallengeModal';
import { normalizeSecurityError, validateFourDigitPin } from '../../../features/settings/accountSecurityFlow.mjs';
import { colors } from '../../../theme';

const PASSWORD_CHALLENGE = 'PASSWORD_CHALLENGE';
const NEW_PIN = 'NEW_PIN';
const CONFIRM_PIN = 'CONFIRM_PIN';
const SUBMITTING = 'SUBMITTING';
const SUCCESS = 'SUCCESS';

export default function ChangeAccountPinScreen() {
  const router = useRouter();
  const { rotateUserPin } = useAuth();
  const [stage, setStage] = useState(PASSWORD_CHALLENGE);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmationPin, setConfirmationPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [challengeSubmitting, setChallengeSubmitting] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const submitGate = useRef(false);
  const sensitiveState = useRef({ currentPassword: '', newPin: '', confirmationPin: '' });

  useEffect(() => {
    sensitiveState.current = { currentPassword, newPin, confirmationPin };
  }, [confirmationPin, currentPassword, newPin]);

  const resetAll = useCallback(() => {
    sensitiveState.current = { currentPassword: '', newPin: '', confirmationPin: '' };
    setCurrentPassword('');
    setNewPin('');
    setConfirmationPin('');
    setErrorMessage('');
    setRetryAfter(0);
    setStage(PASSWORD_CHALLENGE);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') resetAll();
    });
    return () => {
      sensitiveState.current = { currentPassword: '', newPin: '', confirmationPin: '' };
      subscription.remove();
    };
  }, [resetAll]);

  useEffect(() => {
    if (retryAfter <= 0) return undefined;
    const timer = setInterval(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  const cancelFlow = () => {
    resetAll();
    router.replace('/(main)/settings');
  };

  const verifyPassword = async () => {
    if (submitGate.current || !currentPassword || currentPassword.length > 128 || retryAfter > 0) return;
    submitGate.current = true;
    setChallengeSubmitting(true);
    setErrorMessage('');
    try {
      await authService.verifyCurrentPassword(currentPassword);
      setStage(NEW_PIN);
    } catch (error) {
      const normalized = normalizeSecurityError(error);
      setErrorMessage(normalized.message);
      if (normalized.retryAfterSeconds) setRetryAfter(normalized.retryAfterSeconds);
    } finally {
      submitGate.current = false;
      setChallengeSubmitting(false);
    }
  };

  const activePin = stage === NEW_PIN ? newPin : confirmationPin;
  const setActivePin = stage === NEW_PIN ? setNewPin : setConfirmationPin;
  const handleDigit = (digit) => {
    if (stage === SUBMITTING || activePin.length >= 4) return;
    setErrorMessage('');
    setActivePin((value) => `${value}${digit}`);
  };
  const handleBackspace = () => {
    if (stage === SUBMITTING) return;
    setErrorMessage('');
    setActivePin((value) => value.slice(0, -1));
  };

  const continuePin = () => {
    if (!validateFourDigitPin(newPin)) return;
    setConfirmationPin('');
    setStage(CONFIRM_PIN);
  };

  const submitPin = async () => {
    if (submitGate.current || !validateFourDigitPin(confirmationPin) || retryAfter > 0) return;
    if (newPin !== confirmationPin) {
      setNewPin('');
      setConfirmationPin('');
      setErrorMessage('PINs do not match. Enter a new 4-digit PIN.');
      setStage(NEW_PIN);
      return;
    }
    submitGate.current = true;
    setStage(SUBMITTING);
    setErrorMessage('');
    try {
      await rotateUserPin(confirmationPin, currentPassword);
      setCurrentPassword('');
      setNewPin('');
      setConfirmationPin('');
      sensitiveState.current = { currentPassword: '', newPin: '', confirmationPin: '' };
      setStage(SUCCESS);
    } catch (error) {
      const normalized = normalizeSecurityError(error);
      setErrorMessage(normalized.message);
      if (normalized.retryAfterSeconds) setRetryAfter(normalized.retryAfterSeconds);
      if (normalized.code === 'PASSWORD_VERIFICATION_FAILED' || normalized.code === 'PASSWORD_REAUTH_REQUIRED') {
        resetAll();
        setErrorMessage(normalized.message);
      } else {
        setConfirmationPin('');
        setStage(CONFIRM_PIN);
      }
    } finally {
      submitGate.current = false;
    }
  };

  const startOver = () => {
    setNewPin('');
    setConfirmationPin('');
    setErrorMessage('');
    setStage(NEW_PIN);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}><BackButton onPress={cancelFlow} /><Text style={styles.headerTitle}>CHANGE PIN</Text><View style={styles.spacer} /></View>
      {stage !== PASSWORD_CHALLENGE && stage !== SUCCESS && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.eyebrow}>{stage === NEW_PIN ? 'NEW PIN' : 'CONFIRM PIN'}</Text>
          <Text style={styles.title}>{stage === NEW_PIN ? 'Choose a 4-Digit PIN' : 'Confirm Your PIN'}</Text>
          <Text style={styles.subtitle}>{stage === NEW_PIN ? 'Use four numeric digits for device unlock.' : 'Enter the same PIN again to confirm.'}</Text>
          {Boolean(errorMessage) && <Text style={styles.error}>{errorMessage}{retryAfter > 0 ? ` Try again in ${retryAfter}s.` : ''}</Text>}
          <PinIndicator length={4} value={activePin} />
          <Keypad onKeyPress={handleDigit} onBackspace={handleBackspace} disabled={stage === SUBMITTING || retryAfter > 0} />
          <PressableScale
            style={styles.fullWidth}
            contentStyle={[styles.primary, (!validateFourDigitPin(activePin) || stage === SUBMITTING || retryAfter > 0) && styles.disabled]}
            onPress={stage === NEW_PIN ? continuePin : submitPin}
            disabled={!validateFourDigitPin(activePin) || stage === SUBMITTING || retryAfter > 0}
            accessibilityRole="button"
            accessibilityLabel={stage === NEW_PIN ? 'Continue to confirm PIN' : 'Submit new PIN'}
          >
            <Text style={styles.primaryText}>{stage === SUBMITTING ? 'UPDATING…' : stage === NEW_PIN ? 'CONTINUE' : 'UPDATE PIN'}</Text>
          </PressableScale>
          {stage === CONFIRM_PIN && (
            <PressableScale onPress={startOver} contentStyle={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>START OVER</Text>
            </PressableScale>
          )}
        </ScrollView>
      )}

      <PasswordChallengeModal
        visible={stage === PASSWORD_CHALLENGE}
        password={currentPassword}
        onPasswordChange={(value) => { setCurrentPassword(value); setErrorMessage(''); }}
        onCancel={cancelFlow}
        onSubmit={verifyPassword}
        error={errorMessage ? `${errorMessage}${retryAfter > 0 ? ` Try again in ${retryAfter}s.` : ''}` : ''}
        submitting={challengeSubmitting}
      />

      <StatusModal
        visible={stage === SUCCESS}
        eyebrow="PIN UPDATED"
        title="4-Digit PIN Changed"
        message="Your new PIN is ready for the next device unlock."
        confirmText="Return to Account"
        onConfirm={() => router.replace('/(main)/settings')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  headerTitle: { color: colors.ink, fontFamily: 'monospace', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }, spacer: { width: 52 },
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: 420, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 36 },
  eyebrow: { color: colors.accent, fontFamily: 'monospace', fontSize: 10.5, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800', marginBottom: 7, textAlign: 'center' },
  subtitle: { color: colors.inkSoft, fontSize: 13, lineHeight: 19, marginBottom: 16, textAlign: 'center' },
  error: { width: '100%', color: colors.danger, backgroundColor: colors.dangerSoft, borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 4, padding: 10, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  fullWidth: { width: '100%', maxWidth: 340 },
  primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black, borderRadius: 4 },
  disabled: { backgroundColor: '#8E8E8E' }, primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 8 },
  secondaryText: { color: colors.inkSoft, fontFamily: 'monospace', fontSize: 11, fontWeight: '800' },
});
