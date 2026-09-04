import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, fonts, spacing, radius } from '../theme';
import { login, isAuthenticated } from '../services/api/client';

export default function LoginScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const redirectPath = searchParams?.redirect || '/';
  const { width, height } = useWindowDimensions();

  const isSmallScreen = width < 480;
  const isCompactHeight = height < 640;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace(redirectPath);
    }
  }, [redirectPath, router]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const intervalTimer = setInterval(() => {
      setCooldownSeconds((prevSeconds) => {
        if (prevSeconds <= 1) {
          setErrorMessage('');
          return 0;
        }
        return prevSeconds - 1;
      });
    }, 1000);
    return () => clearInterval(intervalTimer);
  }, [cooldownSeconds]);

  const handleSubmit = async () => {
    if (cooldownSeconds > 0) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await login(trimmedUsername, password);
      router.replace(redirectPath);
    } catch (error) {
      if (error?.response?.status === 429) {
        const retryAfter =
          error?.response?.data?.retryAfterSeconds ||
          Number(error?.response?.headers?.['retry-after']) ||
          60;
        setCooldownSeconds(retryAfter);
        setErrorMessage(
          error?.response?.data?.message ||
          `Too many failed attempts. Access is temporarily locked. Please try again in ${retryAfter} seconds.`
        );
      } else {
        const serverMessage =
          error?.response?.data?.message ||
          error?.message ||
          'Authentication failed. Please check your credentials.';
        setErrorMessage(serverMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.pageContainer}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          isSmallScreen && styles.scrollContainerSmall,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            isSmallScreen && styles.cardSmall,
            isCompactHeight && styles.cardCompact,
          ]}
        >
          {/* Brand Header */}
          <View style={[styles.logoSection, isCompactHeight && styles.logoSectionCompact]}>
            <Image
              source={require('../../assets/tracking-logo.png')}
              style={[styles.logoImage, isSmallScreen && styles.logoImageSmall]}
              resizeMode="contain"
            />
            <View style={styles.dividerLine} />
            <View style={styles.badgeWrap}>
              <Text style={styles.systemBadge}>OPERATIONS CONSOLE</Text>
            </View>
          </View>

          {/* Error Alert Box */}
          {Boolean(errorMessage) && (
            <View style={[styles.errorBox, cooldownSeconds > 0 && styles.errorBoxRateLimit]}>
              <Text style={[styles.errorTitle, cooldownSeconds > 0 && styles.errorTitleRateLimit]}>
                {cooldownSeconds > 0 ? 'RATE LIMIT EXCEEDED' : 'ACCESS DENIED'}
              </Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
          )}

          {/* Credentials Form */}
          <View style={[styles.form, isCompactHeight && styles.formCompact]}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>USERNAME</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (errorMessage && cooldownSeconds === 0) setErrorMessage('');
                }}
                placeholder="Enter username"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting && cooldownSeconds === 0}
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage && cooldownSeconds === 0) setErrorMessage('');
                }}
                placeholder="Enter password"
                placeholderTextColor={colors.inkFaint}
                secureTextEntry
                autoCapitalize="none"
                editable={!isSubmitting && cooldownSeconds === 0}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.submitButton,
                (isSubmitting || cooldownSeconds > 0) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || cooldownSeconds > 0}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {cooldownSeconds > 0
                    ? `LOCKED (${cooldownSeconds}S)`
                    : 'SIGN IN TO CONSOLE'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Security Footer Notice */}
          <View style={[styles.footerNote, isCompactHeight && styles.footerNoteCompact]}>
            <Text style={styles.footerText}>
              Authorized Personnel Only · Internal Logistics Operations
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    minHeight: '100%',
  },
  scrollContainerSmall: {
    padding: spacing.md,
    paddingVertical: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 32,
    shadowColor: '#000000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 18,
    elevation: 4,
  },
  cardSmall: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    maxWidth: '100%',
  },
  cardCompact: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoSectionCompact: {
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 260,
    height: 84,
    maxWidth: '100%',
    marginBottom: spacing.xs,
  },
  logoImageSmall: {
    width: 190,
    height: 61,
    marginBottom: spacing.xs,
  },
  dividerLine: {
    width: 64,
    height: 1,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 10,
  },
  badgeWrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#EBE9E0',
    borderRadius: radius.sm,
    marginTop: 4,
  },
  systemBadge: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 1.4,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 3.5,
    borderLeftColor: colors.danger,
    borderWidth: 1,
    borderColor: '#F8D7D4',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorBoxRateLimit: {
    backgroundColor: colors.warningSoft,
    borderLeftColor: colors.warning,
    borderColor: '#F2D399',
  },
  errorTitle: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  errorTitleRateLimit: {
    color: colors.warning,
  },
  errorMessage: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  form: {
    gap: 20,
  },
  formCompact: {
    gap: spacing.md,
  },
  fieldGroup: {
    gap: 7,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    fontSize: 14.5,
    fontFamily: fonts.sans,
    color: colors.ink,
    backgroundColor: '#FFFFFF',
    outlineStyle: 'none',
  },
  submitButton: {
    height: 48,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.9,
  },
  footerNote: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  footerNoteCompact: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  footerText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkFaint,
    textAlign: 'center',
  },
});
