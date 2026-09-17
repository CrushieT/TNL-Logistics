import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../features/auth/context/AuthContext';
import { colors } from '../../theme';
import { PressableScale } from '../../components/common/PressableScale';
import { NoticeBanner } from '../../components/common/NoticeBanner';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const {
    loginWithPassword,
    isAuthenticated,
    boundUser,
    isLocked,
    mustSetupPin,
    isLoading: authLoading,
  } = useAuth();

  const isPinClearedNotice = params?.reason === 'pin_cleared';
  const isSessionExpiredNotice = params?.reason === 'session_expired';

  const [username, setUsername] = useState(params?.username || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill username from route param or cleared bound account
  useEffect(() => {
    if (params?.username && typeof params.username === 'string') {
      setUsername(params.username);
    } else if (boundUser?.username && boundUser.hasPinSet === false) {
      setUsername(boundUser.username);
    }
  }, [params?.username, boundUser?.username, boundUser?.hasPinSet]);

  // If already fully authenticated, redirect to main
  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated) {
      router.replace('/(main)');
      return;
    }

    if (mustSetupPin) {
      router.replace('/(auth)/setup-pin');
      return;
    }

    // If device is already bound to a user with PIN configured and locked, default to PIN unlock
    if (boundUser && isLocked && boundUser.hasPinSet !== false && !params?.username && !isPinClearedNotice) {
      router.replace('/(auth)/pin');
    }
  }, [isAuthenticated, authLoading, boundUser, isLocked, mustSetupPin, params?.username, isPinClearedNotice, router]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleSignIn = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password || submitting || lockoutSeconds > 0) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      const userData = await loginWithPassword(trimmedUsername, password);
      if (userData.hasPinSet === false) {
        router.replace('/(auth)/setup-pin');
      } else {
        router.replace('/(main)');
      }
    } catch (error) {
      const responseData = error.response?.data;
      if (error.response?.status === 429) {
        const retryAfter = responseData?.retryAfterSeconds || 60;
        setLockoutSeconds(retryAfter);
        setErrorMessage(`Too many failed attempts. Locked out for ${retryAfter}s.`);
      } else if (responseData?.message) {
        setErrorMessage(responseData.message);
      } else {
        setErrorMessage('Unable to sign in. Please verify your credentials and network connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isButtonEnabled =
    username.trim().length > 0 &&
    password.length > 0 &&
    !submitting &&
    lockoutSeconds === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
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
            Enter your assigned staff credentials to bind this handheld terminal to your account.
          </Text>

          {/* Cleared PIN / Session Notice Banners */}
          {isPinClearedNotice && (
            <NoticeBanner
              title="PIN SETUP REQUIRED"
              subtitle="Your PIN was cleared by an administrator. Please sign in with your password to set up a new PIN."
            />
          )}

          {isSessionExpiredNotice && (
            <NoticeBanner
              title="SESSION EXPIRED"
              subtitle="Your session was revoked or expired. Please sign in with your password."
            />
          )}

          {/* Bound User Quick Shortcut (if returning user with valid PIN) */}
          {boundUser && boundUser.hasPinSet !== false && !isPinClearedNotice && (
            <PressableScale
              style={styles.boundUserPressable}
              contentStyle={styles.boundUserBanner}
              onPress={() => router.push('/(auth)/pin')}
              activeScale={0.97}
            >
              <View style={styles.boundUserContent}>
                <Text style={styles.boundUserLabel}>DEVICE BOUND TO</Text>
                <Text style={styles.boundUserName}>{boundUser.fullName || boundUser.username}</Text>
              </View>
              <Text style={styles.boundUserLink}>USE PIN UNLOCK</Text>
            </PressableScale>
          )}

          {/* Error / Lockout Feedback */}
          {Boolean(errorMessage) && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter username"
                placeholderTextColor={colors.inkFaint}
                value={username}
                onChangeText={(text) => {
                  setErrorMessage('');
                  setUsername(text);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting && lockoutSeconds === 0}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter password"
                  placeholderTextColor={colors.inkFaint}
                  value={password}
                  onChangeText={(text) => {
                    setErrorMessage('');
                    setPassword(text);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting && lockoutSeconds === 0}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <PressableScale
              style={styles.signInButtonPressable}
              contentStyle={[
                styles.signInButton,
                isButtonEnabled ? styles.signInButtonActive : styles.signInButtonDisabled,
              ]}
              onPress={handleSignIn}
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
          </View>

          {/* Bottom Info / Demo Caption */}
          <View style={styles.footer}>
            <Text style={styles.demoCaption}>
              Accounts are created and managed in the Web Admin Portal.
            </Text>
            <Text style={styles.demoSubCaption}>
              Demo - Office: office / office123 · Field: field / field123
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  keyboardAvoid: {
    flex: 1,
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
  boundUserPressable: {
    width: '100%',
    maxWidth: 380,
    marginBottom: 16,
  },
  boundUserBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EAE8DE',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  boundUserContent: {
    flex: 1,
  },
  boundUserLabel: {
    fontSize: 9.5,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.inkFaint,
    marginBottom: 2,
  },
  boundUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  boundUserLink: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  errorContainer: {
    width: '100%',
    maxWidth: 380,
    padding: 10,
    backgroundColor: colors.dangerSoft,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 380,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.inkSoft,
    marginBottom: 6,
  },
  textInput: {
    width: '100%',
    height: 46,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.ink,
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  passwordInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.ink,
  },
  passwordToggle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordToggleText: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.5,
  },
  signInButtonPressable: {
    width: '100%',
  },
  signInButton: {
    width: '100%',
    height: 48,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
    marginTop: 16,
    paddingTop: 12,
    alignItems: 'center',
  },
  demoCaption: {
    fontSize: 11.5,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 4,
  },
  demoSubCaption: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.inkFaint,
    textAlign: 'center',
  },
});
