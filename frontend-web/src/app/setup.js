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

function EyeIcon({ visible, size = 18, color = colors.inkSoft }) {
  if (visible) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function SetupScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { width, height } = useWindowDimensions();

  const isSmallScreen = width < 480;
  const isCompactHeight = height < 640;

  // Multi-step navigation state
  const [activeStep, setActiveStep] = useState(1);

  // Step 1: Admin Account state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Company Branding state (pre-filled with defaults)
  const [companyName, setCompanyName] = useState('TC & CT Integrated Logistics');
  const [companyAddress, setCompanyAddress] = useState('Labo, Camarines Norte');
  const [companyContact, setCompanyContact] = useState('0917-555-0000');
  const [billingEmail, setBillingEmail] = useState('billing@tnllogistics.ph');

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!navigationState?.key) return;

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

  const handleNextStep = () => {
    const trimmedName = fullName.trim();
    const trimmedUsername = username.trim();

    if (!trimmedName || !trimmedUsername || !password || !confirmPassword) {
      setErrorMessage('Please complete all administrator fields.');
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
    setActiveStep(2);
  };

  const handlePreviousStep = () => {
    setErrorMessage('');
    setActiveStep(1);
  };

  const handleSubmit = async () => {
    const trimmedCompanyName = companyName.trim();
    const trimmedAddress = companyAddress.trim();
    const trimmedContact = companyContact.trim();
    const trimmedEmail = billingEmail.trim();

    if (!trimmedCompanyName || !trimmedAddress || !trimmedContact || !trimmedEmail) {
      setErrorMessage('Please complete all company branding fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please provide a valid billing email address.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await registerFirstBootAdmin({
        fullName: fullName.trim(),
        username: username.trim(),
        password,
        confirmPassword,
        companyName: trimmedCompanyName,
        companyAddress: trimmedAddress,
        companyContact: trimmedContact,
        billingEmail: trimmedEmail,
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
              <Text style={styles.systemBadge}>FIRST BOOT SYSTEM SETUP</Text>
            </View>
          </View>

          {/* Stepper Navigation Header */}
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => activeStep === 2 && handlePreviousStep()}
              style={[
                styles.stepTab,
                activeStep === 1 && styles.stepTabActive,
              ]}
            >
              <Text style={[styles.stepTabNumber, activeStep === 1 && styles.stepTabNumberActive]}>01</Text>
              <Text style={[styles.stepTabLabel, activeStep === 1 && styles.stepTabLabelActive]}>ADMIN ACCOUNT</Text>
            </TouchableOpacity>

            <View style={styles.stepConnector} />

            <View
              style={[
                styles.stepTab,
                activeStep === 2 && styles.stepTabActive,
              ]}
            >
              <Text style={[styles.stepTabNumber, activeStep === 2 && styles.stepTabNumberActive]}>02</Text>
              <Text style={[styles.stepTabLabel, activeStep === 2 && styles.stepTabLabelActive]}>COMPANY BRANDING</Text>
            </View>
          </View>

          {/* Context Notice Callout */}
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>
              {activeStep === 1 ? 'PRIMARY ADMINISTRATOR PROVISIONING' : 'INITIAL COMPANY & SOA BRANDING'}
            </Text>
            <Text style={styles.noticeMessage}>
              {activeStep === 1
                ? 'No administrator account exists. Configure the primary system owner credentials below.'
                : 'Configure legal company details printed on Statements of Account (SOA) and Waybill manifests.'}
            </Text>
          </View>

          {/* Error Alert Box */}
          {Boolean(errorMessage) && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>SETUP VALIDATION ERROR</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
          )}

          {/* STEP 1: Administrator Credentials */}
          {activeStep === 1 && (
            <View style={[styles.form, isCompactHeight && styles.formCompact]}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>FULL NAME *</Text>
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
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>USERNAME *</Text>
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
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>PASSWORD *</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Minimum 8 characters"
                    placeholderTextColor={colors.inkFaint}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon visible={showPassword} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>CONFIRM PASSWORD *</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Re-enter password"
                    placeholderTextColor={colors.inkFaint}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    returnKeyType="go"
                    onSubmitEditing={handleNextStep}
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
                style={styles.primaryButton}
                onPress={handleNextStep}
              >
                <Text style={styles.primaryButtonText}>
                  CONTINUE TO COMPANY BRANDING →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: Company & SOA Branding */}
          {activeStep === 2 && (
            <View style={[styles.form, isCompactHeight && styles.formCompact]}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>BUSINESS NAME *</Text>
                <TextInput
                  style={styles.input}
                  value={companyName}
                  onChangeText={(text) => {
                    setCompanyName(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="TC & CT Integrated Logistics"
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>ADDRESS *</Text>
                <TextInput
                  style={styles.input}
                  value={companyAddress}
                  onChangeText={(text) => {
                    setCompanyAddress(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Labo, Camarines Norte"
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>CONTACT *</Text>
                <TextInput
                  style={styles.input}
                  value={companyContact}
                  onChangeText={(text) => {
                    setCompanyContact(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="0917-555-0000"
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>BILLING EMAIL *</Text>
                <TextInput
                  style={styles.input}
                  value={billingEmail}
                  onChangeText={(text) => {
                    setBillingEmail(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="billing@tnllogistics.ph"
                  placeholderTextColor={colors.inkFaint}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                />
              </View>

              {/* Dynamic Live Document Header Preview */}
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewBadge}>DOCUMENT BRANDING PREVIEW</Text>
                  <Text style={styles.previewMeta}>Statement of Account / Waybill Header</Text>
                </View>
                <View style={styles.previewBody}>
                  <Text style={styles.previewCompanyName}>{companyName.trim() || 'TC & CT Integrated Logistics'}</Text>
                  <Text style={styles.previewCompanyDetails}>
                    {companyAddress.trim() || 'Labo, Camarines Norte'} · {companyContact.trim() || '0917-555-0000'}
                  </Text>
                  <Text style={styles.previewEmail}>{billingEmail.trim() || 'billing@tnllogistics.ph'}</Text>
                </View>
              </View>

              {/* Navigation Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.secondaryButton}
                  onPress={handlePreviousStep}
                  disabled={isSubmitting}
                >
                  <Text style={styles.secondaryButtonText}>← BACK</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.primaryButton,
                    styles.primaryButtonFlex,
                    isSubmitting && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      INITIALIZE & LAUNCH CONSOLE
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

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
    maxWidth: 540,
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
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 14,
    marginBottom: spacing.lg,
  },
  stepTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  stepTabActive: {
    backgroundColor: '#FAF9F5',
  },
  stepTabNumber: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.inkFaint,
  },
  stepTabNumberActive: {
    color: colors.accent,
  },
  stepTabLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 0.8,
  },
  stepTabLabelActive: {
    color: colors.ink,
  },
  stepConnector: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 8,
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
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  previewCard: {
    backgroundColor: '#F9F8F5',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 14,
    marginTop: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 6,
  },
  previewBadge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.8,
  },
  previewMeta: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.inkFaint,
  },
  previewBody: {
    alignItems: 'center',
    gap: 3,
  },
  previewCompanyName: {
    fontFamily: fonts.sans,
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  previewCompanyDetails: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.inkSoft,
  },
  previewEmail: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  secondaryButton: {
    height: 48,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.8,
  },
  primaryButton: {
    height: 48,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryButtonFlex: {
    flex: 1,
    marginTop: 0,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
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
