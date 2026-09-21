import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../features/auth/context/AuthContext';
import { PinIndicator } from '../../components/common/PinIndicator';
import { Keypad } from '../../components/common/Keypad';
import { colors } from '../../theme';
import { PressableScale } from '../../components/common/PressableScale';
import { StatusModal } from '../../components/common/StatusModal';

export default function SetupPinScreen() {
  const router = useRouter();
  const {
    user,
    mustChangePassword,
    setupInitialPin,
    startPasswordReauthentication,
    unbindCurrentDevice,
  } = useAuth();

  const [step, setStep] = useState(1); // 1: enter new pin, 2: confirm pin
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    if (mustChangePassword) {
      router.replace('/(auth)/change-password');
    }
  }, [mustChangePassword, router]);

  const activeValue = step === 1 ? pin : confirmPin;

  const handleKeyPress = (digit) => {
    if (submitting) return;
    if (activeValue.length < 4) {
      setErrorMessage('');
      if (step === 1) {
        setPin((prev) => prev + digit);
      } else {
        setConfirmPin((prev) => prev + digit);
      }
    }
  };

  const handleBackspace = () => {
    if (submitting) return;
    setErrorMessage('');
    if (step === 1) {
      setPin((prev) => prev.slice(0, -1));
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleNextStep = () => {
    if (pin.length !== 4) return;
    setStep(2);
    setConfirmPin('');
    setErrorMessage('');
  };

  const handleConfirm = async () => {
    if (confirmPin.length !== 4 || submitting) return;

    if (pin !== confirmPin) {
      setErrorMessage('PINs do not match. Please choose your PIN again.');
      setStep(1);
      setPin('');
      setConfirmPin('');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      await setupInitialPin(pin);
      router.replace('/(main)');
    } catch (error) {
      if (error.code === 'PASSWORD_REAUTH_REQUIRED') {
        await startPasswordReauthentication({
          username: user?.username,
          reason: 'pin_setup_reauth_required',
        });
        return;
      }
      if (error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Failed to configure PIN. Please try again.');
      }
      setStep(1);
      setPin('');
      setConfirmPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCancelError('');
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (submitting) return;
    setSubmitting(true);
    setCancelError('');
    try {
      await unbindCurrentDevice();
      setCancelModalVisible(false);
    } catch (error) {
      setCancelError(error.message || 'Device unbinding could not be confirmed. Retry or stay signed in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismissCancel = () => {
    if (submitting) return;
    setCancelModalVisible(false);
    setCancelError('');
  };

  const isContinueEnabled = step === 1 && pin.length === 4;
  const isConfirmEnabled = step === 2 && confirmPin.length === 4 && !submitting;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} bounces={false}>
        {/* Top Brand Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/tracking-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View style={styles.badgeWrap}>
            <Text style={styles.badgeText}>PIN SETUP</Text>
          </View>
        </View>

        <View style={styles.headerBlock}>
          <Text style={styles.stepEyebrow}>
            {step === 1 ? 'STEP 1 OF 2 — CREATE PIN' : 'STEP 2 OF 2 — CONFIRM PIN'}
          </Text>
          <Text style={styles.title}>
            {step === 1 ? 'Set Up Your Mobile PIN' : 'Confirm Your Mobile PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? `Welcome ${user?.fullName || user?.username || 'Staff'}. Choose a 4-digit PIN for quick access to your terminal.`
              : 'Re-enter your 4-digit PIN to ensure accuracy.'}
          </Text>
        </View>

        {/* Error Feedback */}
        {Boolean(errorMessage) && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* 4-Dot Indicator */}
        <PinIndicator length={4} value={activeValue} />

        {/* 3x4 Numeric Keypad */}
        <Keypad
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          disabled={submitting}
        />

        {/* Action Button */}
        {step === 1 ? (
          <PressableScale
            style={styles.actionButtonPressable}
            contentStyle={[
              styles.actionButton,
              isContinueEnabled ? styles.actionButtonActive : styles.actionButtonDisabled,
            ]}
            onPress={handleNextStep}
            disabled={!isContinueEnabled}
            activeScale={0.97}
          >
            <Text style={styles.actionText}>CONTINUE</Text>
          </PressableScale>
        ) : (
          <PressableScale
            style={styles.actionButtonPressable}
            contentStyle={[
              styles.actionButton,
              isConfirmEnabled ? styles.actionButtonActive : styles.actionButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isConfirmEnabled}
            activeScale={0.97}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.actionText}>CONFIRM PIN</Text>
            )}
          </PressableScale>
        )}

        {/* Back / Cancel link */}
        <View style={styles.footer}>
          {step === 2 ? (
            <PressableScale
              onPress={() => {
                setStep(1);
                setConfirmPin('');
                setErrorMessage('');
              }}
              activeScale={0.95}
              contentStyle={styles.cancelLink}
            >
              <Text style={styles.cancelText}>CHANGE PIN</Text>
            </PressableScale>
          ) : (
            <PressableScale
              onPress={handleCancel}
              activeScale={0.95}
              contentStyle={styles.cancelLink}
            >
              <Text style={styles.cancelText}>CANCEL AND SIGN OUT</Text>
            </PressableScale>
          )}
        </View>
      </ScrollView>

      {/* Cancel PIN Setup Confirmation Modal */}
      <StatusModal
        visible={cancelModalVisible}
        eyebrow="PIN CONFIGURATION"
        title="Cancel PIN Setup?"
        message={cancelError || 'This device will no longer accept PIN unlock. Password sign in will be required to bind it again. Other bound devices remain active.'}
        cancelText={cancelError ? 'Stay Signed In' : 'Keep Setting Up'}
        confirmText={cancelError ? 'Retry' : 'Unbind Device'}
        confirmVariant="danger"
        onConfirm={handleConfirmCancel}
        onCancel={handleDismissCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 220,
    height: 70,
    marginBottom: 8,
  },
  badgeWrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#EBE9E0',
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 1.2,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  stepEyebrow: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.accent,
    marginBottom: 4,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: colors.inkSoft,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorContainer: {
    width: '100%',
    maxWidth: 340,
    padding: 10,
    backgroundColor: colors.dangerSoft,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 8,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButtonPressable: {
    width: '100%',
    maxWidth: 340,
  },
  actionButton: {
    width: '100%',
    height: 48,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  actionButtonActive: {
    backgroundColor: colors.black,
  },
  actionButtonDisabled: {
    backgroundColor: '#8E8E8E',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  footer: {
    marginTop: 4,
  },
  cancelLink: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});
