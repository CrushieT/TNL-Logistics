import React, { useState, useEffect } from 'react';
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
import { authService } from '../../features/auth/services/authService';
import { PinIndicator } from '../../components/common/PinIndicator';
import { Keypad } from '../../components/common/Keypad';
import { colors } from '../../theme';
import { PressableScale } from '../../components/common/PressableScale';
import { StatusModal } from '../../components/common/StatusModal';

export default function PinUnlockScreen() {
  const router = useRouter();
  const {
    boundUser,
    unlockWithPin,
    isAuthenticated,
    isLocked,
    mustChangePassword,
    mustSetupPin,
    startPasswordReauthentication,
    updateBoundUserPinStatus,
    showSessionNotice,
    isLoading: authLoading,
  } = useAuth();

  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [switchAccountModalVisible, setSwitchAccountModalVisible] = useState(false);

  // If already authenticated and not locked, redirect to main
  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated && !isLocked) {
      router.replace('/(main)');
      return;
    }

    if (mustChangePassword) {
      router.replace('/(auth)/change-password');
      return;
    }

    if (mustSetupPin) {
      router.replace('/(auth)/setup-pin');
      return;
    }

    // If no bound user exists on the device, go to initial credential login
    if (!boundUser) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLocked, mustChangePassword, mustSetupPin, boundUser, authLoading, router]);

  // Proactively check if bound user's PIN was cleared by Admin in background
  useEffect(() => {
    let isMounted = true;
    async function verifyBoundUserPinStatus() {
      if (!boundUser?.username) return;
      try {
        const status = await authService.checkMobilePinStatus(boundUser.username);
        if (isMounted && status?.hasPinSet === false) {
          const targetUsername = boundUser.username;
          showSessionNotice({
            title: 'PIN Reset by Administrator',
            eyebrow: 'SECURITY NOTICE',
            message: 'Your PIN was cleared by an administrator. Please sign in with your password to configure a new PIN.',
            confirmText: 'PROCEED TO SIGN IN',
            username: targetUsername,
            reason: 'pin_cleared',
          });
        }
      } catch (e) {
        // Non-blocking background status check failure
      }
    }

    verifyBoundUserPinStatus();
    return () => {
      isMounted = false;
    };
  }, [boundUser?.username, showSessionNotice]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleKeyPress = (digit) => {
    if (submitting || lockoutSeconds > 0) return;
    if (pin.length < 4) {
      setErrorMessage('');
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (submitting || lockoutSeconds > 0) return;
    setErrorMessage('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleUnlock = async () => {
    if (pin.length !== 4 || submitting || lockoutSeconds > 0) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      await unlockWithPin(pin);
      router.replace('/(main)');
    } catch (error) {
      setPin('');
      if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
        await startPasswordReauthentication({
          username: boundUser?.username,
          reason: 'password_change_required',
        });
        return;
      }

      if (error.status === 409) {
        const targetUsername = boundUser?.username;
        showSessionNotice({
          title: 'PIN Reset by Administrator',
          eyebrow: 'SECURITY NOTICE',
          message: 'Your PIN was cleared by an administrator. Please sign in with your password to configure a new PIN.',
          confirmText: 'PROCEED TO SIGN IN',
          username: targetUsername,
          reason: 'pin_cleared',
        });
        return;
      } else if (error.status === 429) {
        const retryAfter = error.retryAfterSeconds || 60;
        setLockoutSeconds(retryAfter);
        setErrorMessage(`Too many failed attempts. Locked out for ${retryAfter}s.`);
      } else if (error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Invalid PIN. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSignIn = () => {
    setSwitchAccountModalVisible(true);
  };

  const handleConfirmSwitchAccount = async () => {
    setSwitchAccountModalVisible(false);
    await startPasswordReauthentication({
      username: boundUser?.username,
      reason: 'password_reauthentication',
    });
  };

  const handleCancelSwitchAccount = () => {
    setSwitchAccountModalVisible(false);
  };

  const isButtonEnabled = pin.length === 4 && !submitting && lockoutSeconds === 0;
  const roleLabel = boundUser?.role ? boundUser.role.replace('_', ' ') : 'STAFF';

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
            <Text style={styles.badgeText}>MOBILE PORTAL</Text>
          </View>
        </View>

        {/* Bound User Identity Card */}
        {boundUser && (
          <View style={styles.boundUserCard}>
            <View style={styles.boundUserHeader}>
              <Text style={styles.boundUserRole}>{roleLabel}</Text>
              <Text style={styles.boundUsernameTag}>@{boundUser.username}</Text>
            </View>
            <Text style={styles.boundUserName}>{boundUser.fullName || boundUser.username}</Text>
            <Text style={styles.boundUserHint}>Enter your 4-digit PIN to unlock shift</Text>
          </View>
        )}

        {/* Error / Lockout Feedback */}
        {Boolean(errorMessage) && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* 4-Dot Indicator */}
        <PinIndicator length={4} value={pin} />

        {/* 3x4 Numeric Keypad */}
        <Keypad
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          disabled={submitting || lockoutSeconds > 0}
        />

        {/* Full-width Sign In Button */}
        <PressableScale
          style={styles.signInButtonPressable}
          contentStyle={[
            styles.signInButton,
            isButtonEnabled ? styles.signInButtonActive : styles.signInButtonDisabled,
          ]}
          onPress={handleUnlock}
          disabled={!isButtonEnabled}
          activeScale={0.97}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.signInText}>
              {lockoutSeconds > 0 ? `LOCKED (${lockoutSeconds}s)` : 'SIGN IN'}
            </Text>
          )}
        </PressableScale>

        {/* Switch Account Option */}
        <PressableScale
          style={styles.switchAccountButton}
          onPress={handlePasswordSignIn}
          activeScale={0.96}
        >
          <Text style={styles.switchAccountText}>Use Password Instead</Text>
        </PressableScale>
      </ScrollView>

      {/* Switch Account Confirmation Modal */}
      <StatusModal
        visible={switchAccountModalVisible}
        eyebrow="PASSWORD SIGN IN"
        title="Use Password Instead?"
        message="The device binding will be preserved while you renew access with your password."
        cancelText="Cancel"
        confirmText="Continue"
        onConfirm={handleConfirmSwitchAccount}
        onCancel={handleCancelSwitchAccount}
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
    marginBottom: 14,
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
  boundUserCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 14,
    marginBottom: 14,
  },
  boundUserHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  boundUserRole: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  boundUsernameTag: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.inkFaint,
  },
  boundUserName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  boundUserHint: {
    fontSize: 12,
    color: colors.inkFaint,
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
  signInButtonPressable: {
    width: '100%',
    maxWidth: 340,
  },
  signInButton: {
    width: '100%',
    height: 48,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  signInButtonActive: {
    backgroundColor: colors.black,
  },
  signInButtonDisabled: {
    backgroundColor: '#8E8E8E',
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  switchAccountButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  switchAccountText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.inkSoft,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
