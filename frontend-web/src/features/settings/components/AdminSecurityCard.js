import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Card from '../../../components/common/Card';
import { colors, fonts, spacing, radius, type } from '../../../theme';
import { changePassword } from '../../../services/api/client';

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

export default function AdminSecurityCard() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!oldPassword) {
      setError('Current password is required.');
      return;
    }

    if (!newPassword) {
      setError('New password is required.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword === oldPassword) {
      setError('New password must be different from current password.');
      return;
    }

    if (!confirmPassword) {
      setError('Please confirm your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await changePassword(oldPassword, newPassword);

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);

      const successMessage = response?.message
        ? `${response.message}. Session token refreshed.`
        : 'Password updated successfully. Session token refreshed.';
      setSuccess(successMessage);
    } catch (err) {
      const serverMessage =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update password. Please check your credentials and try again.';
      setError(serverMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="ADMIN SECURITY / CHANGE PASSWORD" style={styles.card}>
      <Text style={styles.subtitle}>
        Manage primary administrator console credentials. Updating credentials increments the security token version and seamlessly refreshes your active session.
      </Text>

      {/* Success Alert Banner */}
      {Boolean(success) && (
        <View style={styles.successBox}>
          <Text style={styles.successCheck}>✓</Text>
          <Text style={styles.successMessage}>{success}</Text>
        </View>
      )}

      {/* Error Alert Banner */}
      {Boolean(error) && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>PASSWORD VALIDATION ERROR</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        {/* Current Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>CURRENT PASSWORD *</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={oldPassword}
              onChangeText={(text) => {
                setOldPassword(text);
                if (error) setError(null);
                if (success) setSuccess(null);
              }}
              placeholder="Enter current administrator password"
              placeholderTextColor={colors.inkFaint}
              secureTextEntry={!showOldPassword}
              autoCapitalize="none"
              editable={!submitting}
              returnKeyType="next"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowOldPassword(!showOldPassword)}
              accessibilityLabel={showOldPassword ? 'Hide current password' : 'Show current password'}
            >
              <EyeIcon visible={showOldPassword} />
            </TouchableOpacity>
          </View>
        </View>

        {/* New Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>NEW PASSWORD *</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (error) setError(null);
                if (success) setSuccess(null);
              }}
              placeholder="Minimum 8 characters"
              placeholderTextColor={colors.inkFaint}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
              editable={!submitting}
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
          <Text style={styles.helperText}>
            Must be at least 8 characters and different from your current password.
          </Text>
        </View>

        {/* Confirm New Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>CONFIRM NEW PASSWORD *</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (error) setError(null);
                if (success) setSuccess(null);
              }}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.inkFaint}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              editable={!submitting}
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

        {/* Action Button */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitButtonText}>UPDATING PASSWORD...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>UPDATE PASSWORD</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  subtitle: {
    ...type.caption,
    color: colors.inkMuted,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: radius.xs,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
    gap: 8,
  },
  successCheck: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  successMessage: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#15803D',
    flex: 1,
  },
  errorBox: {
    backgroundColor: '#FFF1F2',
    borderLeftWidth: 3.5,
    borderLeftColor: '#E11D48',
    borderRadius: radius.xs,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#E11D48',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  errorMessage: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: '#9F1239',
    fontWeight: '500',
  },
  form: {
    gap: spacing.md,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft,
    letterSpacing: 0.8,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xs,
    paddingHorizontal: 12,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: '#FFFFFF',
    outlineStyle: 'none',
  },
  passwordInput: {
    paddingRight: 42,
  },
  eyeButton: {
    position: 'absolute',
    right: 10,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  helperText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  actionRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  submitButton: {
    height: 44,
    paddingHorizontal: 24,
    backgroundColor: colors.accent,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.0,
  },
});
