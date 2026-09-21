import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Icon } from 'react-native-paper';
import { useAuth } from '../../../features/auth/context/AuthContext';
import { colors, typography } from '../../../theme';
import { PersonalParcelSummary } from '../../../features/tracking-history/components/PersonalParcelSummary';
import { PersonalTrackingTimeline } from '../../../features/tracking-history/components/PersonalTrackingTimeline';
import { trackingHistoryApi } from '../../../features/tracking-history/services/trackingHistoryApi';
import { formatPackageDisplay } from '../../../features/tracking-history/trackingHistoryFlow.mjs';

export default function SelectedParcelHistoryScreen() {
  const router = useRouter();
  const { trackingId } = useLocalSearchParams();
  const { user, isLoading: authLoading } = useAuth();

  const [parcel, setParcel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  const activeControllerRef = useRef(null);
  const hasLoadedRef = useRef(false);

  // Role Guard: Restrict strictly to FIELD_STAFF
  useEffect(() => {
    if (!authLoading && user && user.role !== 'FIELD_STAFF') {
      router.replace('/(main)');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    hasLoadedRef.current = false;
    setParcel(null);
    setIsLoading(true);
    setError(null);
    setIsNotFound(false);
  }, [trackingId]);

  const fetchParcelHistory = useCallback(async (isInitial = false) => {
    if (!trackingId) return;

    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;

    if (isInitial) {
      setIsLoading(true);
      setError(null);
      setIsNotFound(false);
    }

    try {
      const data = await trackingHistoryApi.getMyParcelHistory(trackingId, controller.signal);
      if (activeControllerRef.current !== controller || controller.signal.aborted) return;
      setParcel(data);
      hasLoadedRef.current = true;
      setError(null);
      setIsNotFound(false);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (activeControllerRef.current !== controller) return;
      if (err.response?.status === 404) {
        setParcel(null);
        hasLoadedRef.current = false;
        setIsNotFound(true);
        setError('This parcel is not available in your personal scan history.');
      } else {
        const msg = err.response?.data?.message || 'Failed to load personal parcel history.';
        setError(msg);
      }
    } finally {
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
        setIsLoading(false);
      }
    }
  }, [trackingId]);

  useFocusEffect(
    useCallback(() => {
      const isInitial = !hasLoadedRef.current;
      fetchParcelHistory(isInitial);

      return () => {
        activeControllerRef.current?.abort();
        activeControllerRef.current = null;
      };
    }, [fetchParcelHistory])
  );

  if (authLoading || !user || user.role !== 'FIELD_STAFF') {
    return null;
  }

  const headerTitle = parcel
    ? formatPackageDisplay(parcel.packageIndex, parcel.packageCount)
    : 'PACKAGE DETAILS';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Safe Area Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon source="arrow-left" size={24} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      {isLoading && !parcel ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : isNotFound ? (
        <View style={styles.errorContainer}>
          <Icon source="alert-circle-outline" size={48} color={colors.inkFaint} />
          <Text style={styles.notFoundTitle}>Parcel Not Available</Text>
          <Text style={styles.notFoundMessage}>
            This parcel is not available in your personal scan history.
          </Text>
          <TouchableOpacity style={styles.backActionButton} onPress={() => router.back()}>
            <Text style={styles.backActionText}>Return to History</Text>
          </TouchableOpacity>
        </View>
      ) : error && !parcel ? (
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color={colors.danger} />
          <Text style={styles.errorTitle}>Unable to Load Parcel History</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchParcelHistory(true)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.contentContainer}>
          {Boolean(error) && (
            <View style={styles.inlineNotice}>
              <Text style={styles.inlineNoticeText}>{error}</Text>
              <TouchableOpacity
                onPress={() => fetchParcelHistory(false)}
              >
                <Text style={styles.inlineNoticeRetry}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Operational Parcel Summary Card */}
          <PersonalParcelSummary parcel={parcel} />

          {/* Full-width Toggle Button */}
          <View style={styles.toggleWrapper}>
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setShowHistory((prev) => !prev)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={showHistory ? 'Hide my history' : 'Show my history'}
            >
              <Text style={styles.toggleButtonText}>
                {showHistory ? 'HIDE MY HISTORY' : 'SHOW MY HISTORY'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Personal Chronological Timeline */}
          {showHistory && (
            <PersonalTrackingTimeline events={parcel?.events || []} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  headerRightSpacer: {
    width: 32,
  },
  contentContainer: {
    backgroundColor: colors.canvas,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 12,
    marginBottom: 6,
  },
  notFoundMessage: {
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  backActionButton: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
    marginTop: 12,
    marginBottom: 6,
  },
  errorMessage: {
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  retryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  inlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 4,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
  },
  inlineNoticeText: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '600',
    flex: 1,
  },
  inlineNoticeRetry: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginLeft: 8,
  },
  toggleWrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  toggleButton: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: 1.5,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.8,
  },
});
