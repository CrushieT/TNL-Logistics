import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
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

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithPin, isAuthenticated, isLoading: authLoading } = useAuth();

  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to main dashboard
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.replace('/(main)');
    }
  }, [isAuthenticated, authLoading, router]);

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

  const handleSignIn = async () => {
    if (pin.length !== 4 || submitting || lockoutSeconds > 0) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      await loginWithPin(pin);
      router.replace('/(main)');
    } catch (error) {
      setPin('');
      const responseData = error.response?.data;
      if (error.response?.status === 429) {
        const retryAfter = responseData?.retryAfterSeconds || 60;
        setLockoutSeconds(retryAfter);
        setErrorMessage(`Too many failed attempts. Locked out for ${retryAfter}s.`);
      } else if (responseData?.message) {
        setErrorMessage(responseData.message);
      } else {
        setErrorMessage('Unable to sign in. Please verify your connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isButtonEnabled = pin.length === 4 && !submitting && lockoutSeconds === 0;

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

        <Text style={styles.subtitle}>
          One app, role-based. Office Staff manage shipments & labels; Field Staff scan to advance tracking. Enter your PIN.
        </Text>

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
        <TouchableOpacity
          style={[
            styles.signInButton,
            isButtonEnabled ? styles.signInButtonActive : styles.signInButtonDisabled,
          ]}
          onPress={handleSignIn}
          disabled={!isButtonEnabled}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.signInText}>
              {lockoutSeconds > 0 ? `LOCKED (${lockoutSeconds}s)` : 'SIGN IN'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Bottom Demo Credentials Caption */}
        <View style={styles.footer}>
          <Text style={styles.demoCaption}>
            Demo - Office: 2222 (Andrea) · Field: 0001 (Carlo) · Admin: 1111
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  container: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  logoContainer: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  logoImage: {
    width: 220,
    height: 70,
    marginBottom: 8,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
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
  subtitle: {
    fontSize: 13.5,
    color: colors.inkSoft,
    lineHeight: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
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
  signInButton: {
    width: '100%',
    maxWidth: 340,
    height: 48,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 20,
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
  footer: {
    marginTop: 'auto',
    paddingTop: 12,
  },
  demoCaption: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.inkFaint,
    textAlign: 'center',
  },
});
