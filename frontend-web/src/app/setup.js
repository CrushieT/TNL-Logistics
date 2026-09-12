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
import { useRouter, useRootNavigationState } from 'expo-router';
import { colors, fonts, spacing, radius } from '../theme';
import { registerFirstBootAdmin, checkFirstBootStatus, isAuthenticated } from '../services/api/client';

export default function SetupScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { width, height } = useWindowDimensions();

  const isSmallScreen = width < 480;
  const isCompactHeight = height < 640;

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!navigationState?.key) return;

    // If system is already bootstrapped or user is authenticated, redirect away
    checkFirstBootStatus().then((isFirstBoot) => {
      if (!isFirstBoot) {
        if (isAuthenticated()) {
          router.replace('/');
        } else {
          router.replace('/login');
        }
      }
    });
  }, [navigationState?.key, router]);

  const handleSubmit = async () => {
    const trimmedName = fullName.trim();
    const trimmedUsername = username.trim();

    if (!trimmedName || !trimmedUsername || !password || !confirmPassword) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await registerFirstBootAdmin({
        fullName: trimmedName,
        username: trimmedUsername,
        password,
        confirmPassword,
      });
      router.replace('/');
    } catch (error) {
      const serverMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to initialize system administrator. Please try again.';
      setErrorMessage(serverMessage);
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
              <Text style={styles.systemBadge}>FIRST BOOT SETUP</Text>
            </View>
          </View>

          {/* First Boot Notice Callout */}
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>INITIAL SYSTEM PROVISIONING</Text>
            <Text style={styles.noticeMessage}>
              No administrator account detected in the database. Create the primary system administrator to initialize the operations console.
            </Text>
          </View>

          {/* Error Alert Box */}
          {Boolean(errorMessage) && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>SETUP VALIDATION ERROR</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
          )}

          {/* Administrator Registration Form */}
          <View style={[styles.form, isCompactHeight && styles.formCompact]}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. Maria Santos"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isSubmitting}
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>USERNAME</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. admin"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
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
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Minimum 8 characters"
                placeholderTextColor={colors.inkFaint}
                secureTextEntry
                autoCapitalize="none"
                editable={!isSubmitting}
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Re-enter password"
                placeholderTextColor={colors.inkFaint}
                secureTextEntry
                autoCapitalize="none"
                editable={!isSubmitting}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  INITIALIZE SYSTEM ADMINISTRATOR
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Security Footer Notice */}
          <View style={[styles.footerNote, isCompactHeight && styles.footerNoteCompact]}>
            <Text style={styles.footerText}>
              System Provisioning · Single Administrator Invariant Enforcement
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
    paddingTop: 36,
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
    marginBottom: spacing.lg,
  },
  logoSectionCompact: {
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 240,
    height: 78,
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
    color: colors.accent,
    letterSpacing: 1.4,
  },
  noticeBox: {
    backgroundColor: '#FAF9F5',
    borderLeftWidth: 3.5,
    borderLeftColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  noticeMessage: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.inkSoft,
    lineHeight: 18,
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
  errorTitle: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  errorMessage: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
  form: {
    gap: 16,
  },
  formCompact: {
    gap: spacing.sm,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.8,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    fontSize: 14,
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
    marginTop: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.9,
  },
  footerNote: {
    marginTop: 24,
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
    fontSize: 11,
    color: colors.inkFaint,
    textAlign: 'center',
  },
});
