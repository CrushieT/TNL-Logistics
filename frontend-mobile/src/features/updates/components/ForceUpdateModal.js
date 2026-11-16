import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  BackHandler,
  Platform,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { colors, typography, spacing, radius } from '../../../theme';
import { PressableScale } from '../../../components/common/PressableScale';

/**
 * Non-dismissible hard-gate modal requiring mobile staff to update their application
 * before accessing any features. Traps Android hardware back press and disallows touch-outside dismissal.
 */
export function ForceUpdateModal({
  visible = false,
  localVersion,
  serverVersion,
  apkDownloadUrl,
  isLoading = false,
  onRetry,
}) {
  // Prevent dismissal via Android hardware back key
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      subscription.remove();
    };
  }, [visible]);

  if (Platform.OS === 'web' || !visible) {
    return null;
  }

  const handleDownload = async () => {
    if (!apkDownloadUrl) return;
    try {
      await Linking.openURL(apkDownloadUrl);
    } catch {
      // System URL opening fallback
    }
  };

  const localCode = localVersion?.versionCode ?? 1;
  const localName = localVersion?.versionName ?? '1.0.0';
  const latestCode = serverVersion?.latestVersionCode ?? 1;
  const latestName = serverVersion?.latestVersionName ?? '1.0.0';
  const releaseNotes = serverVersion?.releaseNotes;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Suppress back key dismissal
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Eyebrow Badge */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MANDATORY UPDATE</Text>
          </View>

          {/* Title and Subtitle */}
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.subtitle}>
            A newer version of the application is required to continue. Please download and install the latest update to access the field system.
          </Text>

          {/* Version Comparison Box */}
          <View style={styles.versionBox}>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Installed Version</Text>
              <Text style={styles.versionValueCurrent}>
                v{localName} (Build {localCode})
              </Text>
            </View>
            <View style={styles.versionDivider} />
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>Required Version</Text>
              <Text style={styles.versionValueTarget}>
                v{latestName} (Build {latestCode})
              </Text>
            </View>
          </View>

          {/* Optional Release Notes */}
          {releaseNotes ? (
            <View style={styles.notesContainer}>
              <Text style={styles.notesHeader}>What's New</Text>
              <ScrollView style={styles.notesScroll} nestedScrollEnabled>
                <Text style={styles.notesText}>{releaseNotes}</Text>
              </ScrollView>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <PressableScale
              onPress={handleDownload}
              disabled={!apkDownloadUrl}
              style={[styles.primaryButton, !apkDownloadUrl && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>Download & Install Update</Text>
            </PressableScale>

            <PressableScale
              onPress={onRetry}
              disabled={isLoading}
              style={styles.secondaryButton}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.ink} />
              ) : (
                <Text style={styles.secondaryButtonText}>Check Again</Text>
              )}
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 17, 17, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    padding: spacing.xl,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: spacing.md,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h1,
    fontSize: 22,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkSoft,
    marginBottom: spacing.lg,
  },
  versionBox: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionLabel: {
    ...typography.eyebrow,
    fontSize: 11,
    color: colors.inkFaint,
  },
  versionValueCurrent: {
    ...typography.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  versionValueTarget: {
    ...typography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
  },
  versionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  notesContainer: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  notesHeader: {
    ...typography.eyebrow,
    fontSize: 10,
    color: colors.inkFaint,
    marginBottom: spacing.xs,
  },
  notesScroll: {
    maxHeight: 80,
  },
  notesText: {
    ...typography.bodySmall,
    color: colors.inkSoft,
    lineHeight: 16,
  },
  actionsContainer: {
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  disabledButton: {
    opacity: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
});
