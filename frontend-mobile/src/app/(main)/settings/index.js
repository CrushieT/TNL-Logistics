import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { BackButton } from '../../../components/common/BackButton';
import { PressableScale } from '../../../components/common/PressableScale';
import { StatusModal } from '../../../components/common/StatusModal';
import { useAuth } from '../../../features/auth/context/AuthContext';
import { authService } from '../../../features/auth/services/authService';
import { AccountIdentityCard } from '../../../features/settings/components/AccountIdentityCard';
import { SecurityActionRow } from '../../../features/settings/components/SecurityActionRow';
import { resolveAccountDisplay } from '../../../features/settings/accountSecurityFlow.mjs';
import { colors } from '../../../theme';

function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function SessionRow({ label, value }) {
  return (
    <View style={styles.sessionRow}>
      <Text style={styles.sessionLabel}>{label}</Text>
      <Text style={styles.sessionValue}>{value}</Text>
    </View>
  );
}

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLocked, lockSession, unbindCurrentDevice } = useAuth();
  const [profile, setProfile] = useState(user);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [unbindVisible, setUnbindVisible] = useState(false);
  const [unbindError, setUnbindError] = useState('');
  const [unbinding, setUnbinding] = useState(false);
  const refreshGeneration = useRef(0);
  const unbindGate = useRef(false);

  const refreshProfile = useCallback(async (manual = false) => {
    const generation = ++refreshGeneration.current;
    if (manual) setRefreshing(true);
    setRefreshError('');
    try {
      const currentProfile = await authService.fetchCurrentUser();
      if (generation === refreshGeneration.current) setProfile(currentProfile);
    } catch (error) {
      if (generation === refreshGeneration.current) {
        setRefreshError(error.message || 'Account details could not be refreshed. Cached details are shown.');
      }
    } finally {
      if (manual && generation === refreshGeneration.current) setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setProfile((current) => current || user);
    refreshProfile(false);
    return () => { refreshGeneration.current += 1; };
  }, [refreshProfile, user]));

  const account = resolveAccountDisplay(profile, { user, isAuthenticated, isLocked });
  const binding = account.deviceBinding;

  const handleUnbind = async () => {
    if (unbindGate.current) return;
    unbindGate.current = true;
    setUnbinding(true);
    setUnbindError('');
    try {
      await unbindCurrentDevice();
      setUnbindVisible(false);
    } catch (error) {
      setUnbindError(error.message || 'Device unbinding could not be confirmed. Your local session was preserved.');
    } finally {
      unbindGate.current = false;
      setUnbinding(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refreshProfile(true)} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>ACCOUNT</Text>
          <View style={styles.headerSpacer} />
        </View>

        <AccountIdentityCard account={account} />

        {Boolean(refreshError) && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{refreshError}</Text>
            <PressableScale onPress={() => refreshProfile(true)} contentStyle={styles.retryButton} accessibilityRole="button">
              <Text style={styles.retryText}>RETRY</Text>
            </PressableScale>
          </View>
        )}

        <Text style={styles.sectionTitle}>SESSION & DEVICE</Text>
        <View style={styles.sessionCard}>
          <SessionRow label="SHIFT ACCESS" value={account.isUnlocked ? 'UNLOCKED' : 'LOCKED'} />
          <SessionRow label="PIN" value={account.hasPinSet ? 'CONFIGURED' : 'NOT CONFIGURED'} />
          <SessionRow label="DEVICE" value={binding ? 'BOUND' : 'UNAVAILABLE'} />
          <SessionRow label="DEVICE ID" value={binding?.maskedDeviceId || '—'} />
          <SessionRow label="LAST AUTHENTICATED" value={formatTimestamp(binding?.lastAuthenticatedAt)} />
        </View>

        <Text style={styles.sectionTitle}>SECURITY</Text>
        <SecurityActionRow icon="lock-reset" title="Change Password" subtitle="Rotate your account password" onPress={() => router.push('/(main)/settings/password')} />
        <SecurityActionRow icon="dialpad" title="Change 4-Digit PIN" subtitle="Verify your password before changing PIN" onPress={() => router.push('/(main)/settings/pin')} />
        <SecurityActionRow icon="lock-outline" title="Lock App" subtitle="Keep this device bound and require PIN unlock" onPress={lockSession} />

        <Text style={styles.sectionTitle}>DEVICE ACCESS</Text>
        <SecurityActionRow
          icon="cellphone-remove"
          title="Sign Out and Unbind Device"
          subtitle="Remove PIN access only from this device"
          danger
          onPress={() => { setUnbindError(''); setUnbindVisible(true); }}
        />
      </ScrollView>

      <StatusModal
        visible={unbindVisible}
        eyebrow="DEVICE ACCESS"
        title={unbindError ? 'Unbind Not Confirmed' : 'Sign Out and Unbind?'}
        message={unbindError || 'This device will no longer accept PIN unlock. Password login will be required to bind it again. Other bound devices remain active.'}
        cancelText={unbindError ? 'Cancel' : 'Stay Signed In'}
        confirmText={unbinding ? 'Unbinding…' : unbindError ? 'Retry' : 'Unbind Device'}
        confirmVariant="danger"
        onCancel={() => { if (!unbinding) setUnbindVisible(false); }}
        onConfirm={handleUnbind}
      />
      {unbinding && <View style={styles.busyOverlay} pointerEvents="none"><ActivityIndicator color={colors.accent} /></View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 40 },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.ink, fontFamily: 'monospace', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  headerSpacer: { width: 52 },
  sectionTitle: { color: colors.inkFaint, fontFamily: 'monospace', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.1, marginBottom: 8, marginTop: 24 },
  sessionCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 4, paddingHorizontal: 16 },
  sessionRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: 14 },
  sessionLabel: { color: colors.inkFaint, fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  sessionValue: { color: colors.ink, flex: 1, fontSize: 11.5, fontWeight: '700', textAlign: 'right' },
  errorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerSoft, borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 4, marginTop: 12, padding: 10 },
  errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
  retryButton: { minHeight: 44, minWidth: 60, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: colors.danger, fontFamily: 'monospace', fontSize: 11, fontWeight: '800' },
  busyOverlay: { position: 'absolute', top: 12, right: 12 },
});
