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
import {
  changePassword,
  isAuthenticated,
  getCurrentUser,
  logout,
} from '../services/api/client';

function EyeIcon({ visible, size = 18, color = colors.inkSoft }) {
  if (visible) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { width, height } = useWindowDimensions();

  const isSmallScreen = width < 480;
  const isCompactHeight = height < 640;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (!navigationState?.key) return;

    if (!isAuthenticated()) {
      router.replace('/login');
    } else if (currentUser && !currentUser.mustChangePassword) {
      router.replace('/');
    }
  }, [navigationState?.key, currentUser?.mustChangePassword, router]);

  if (!isAuthenticated() || (currentUser && !currentUser.mustChangePassword)) {
    return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  }

  const handleSubmit = async () => {
    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      setErrorMessage('Please enter a new password.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage('New password must be different from current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirm password do not match.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await changePassword(currentPassword, newPassword);
      router.replace('/');
    } catch (error) {
      const serverMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update password. Please verify your current password.';
      setErrorMessage(serverMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = () => {
    logout();
    router.replace('/login');
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
              <Text style={styles.systemBadge}>SECURITY REQUIREMENT</Text>
            </View>
          </View>

          {/* Instruction Notice */}
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>MANDATORY PASSWORD CHANGE</Text>
            <Text style={styles.noticeText}>
              Your account requires a password update before proceeding. Please enter your
              current credentials and set a new password of at least 8 characters.
            </Text>
            {Boolean(currentUser?.username) && (
              <View style={styles.accountBadge}>
                <Text style={styles.accountLabel}>
                  USER ACCOUNT:{' '}
                  <Text style={styles.accountValue}>
                    {currentUser.username} ({currentUser.role || 'STAFF'})
                  </Text>
                </Text>
              </View>
            )}
          </View>

          {/* Error Alert Box */}
          {Boolean(errorMessage) && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>UPDATE FAILED</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={[styles.form, isCompactHeight && styles.formCompact]}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>CURRENT PASSWORD</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={currentPassword}
                  onChangeText={(text) => {
                    setCurrentPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter temporary or current password"
                  placeholderTextColor={colors.inkFaint}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  returnKeyType="next"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  accessibilityLabel={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                >
                  <EyeIcon visible={showCurrentPassword} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>NEW PASSWORD (MIN. 8 CHARACTERS)</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter new password"
                  placeholderTextColor={colors.inkFaint}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  returnKeyType="next"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  accessibilityLabel={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  <EyeIcon visible={showNewPassword} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.inkFaint}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  <EyeIcon visible={showConfirmPassword} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>UPDATE PASSWORD & PROCEED</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.signOutButton}
              onPress={handleSignOut}
              disabled={isSubmitting}
            >
              <Text style={styles.signOutButtonText}>CANCEL & SIGN OUT</Text>
            </TouchableOpacity>
          </View>

          {/* Security Footer Notice */}
          <View style={[styles.footerNote, isCompactHeight && styles.footerNoteCompact]}>
            <Text style={styles.footerText}>
              Security Policy: Passwords must be distinct from current credentials
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
    maxWidth: 520,
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
    paddingBottom: spacing.xl,
  },
  cardCompact: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoSectionCompact: {
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 180,
    height: 48,
    marginBottom: spacing.sm,
  },
  logoImageSmall: {
    width: 150,
    height: 40,
  },
  dividerLine: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  badgeWrap: {
    alignSelf: 'center',
  },
  systemBadge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.inkFaint,
    textTransform: 'uppercase',
  },
  noticeBox: {
    backgroundColor: '#FAF9F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeTitle: {
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  noticeText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  accountBadge: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accountLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
  },
  accountValue: {
    fontWeight: '700',
    color: colors.ink,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xs,
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.danger,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  errorMessage: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  form: {
    gap: spacing.md,
  },
  formCompact: {
    gap: spacing.sm,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.inkSoft,
    textTransform: 'uppercase',
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.sans,
    color: colors.ink,
    outlineStyle: 'none',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  signOutButton: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.inkFaint,
    textTransform: 'uppercase',
  },
  footerNote: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  footerNoteCompact: {
    marginTop: spacing.md,
  },
  footerText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.inkFaint,
    textAlign: 'center',
  },
});
