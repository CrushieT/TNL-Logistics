import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { apiClient } from '../../../services/api/client';
import {
  getLocalAppVersion,
  checkAppVersionStatus,
  resolveApkDownloadUrl,
  registerVersionObsoleteListener,
} from '../services/appVersionService.mjs';

/**
 * Hook to evaluate mobile application version compatibility against backend policies.
 * Triggers on initial mount and whenever the app transitions back to active foreground.
 *
 * @returns {{
 *   isUpdateRequired: boolean,
 *   isUpdateAvailable: boolean,
 *   localVersion: { versionCode: number, versionName: string },
 *   serverVersion: { minSupportedVersionCode: number, latestVersionCode: number, latestVersionName: string, apkDownloadUrl: string|null, forceUpdate: boolean, releaseNotes: string|null }|null,
 *   apkDownloadUrl: string|null,
 *   isLoading: boolean,
 *   error: Error|null,
 *   checkVersion: () => Promise<void>
 * }}
 */
export function useAppVersionCheck() {
  const [status, setStatus] = useState({
    isUpdateRequired: false,
    isUpdateAvailable: false,
    localVersion: getLocalAppVersion(),
    serverVersion: null,
    apkDownloadUrl: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Prevent race conditions with concurrent or overlapping checks
  const isCheckingRef = useRef(false);

  const checkVersion = useCallback(async () => {
    // Only enforce mobile app gating on native mobile platforms
    if (Platform.OS === 'web') {
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/settings/mobile-version', { skipAuth: true });
      const serverVersion = response?.data;
      const localVersion = getLocalAppVersion();

      const evaluation = checkAppVersionStatus({ localVersion, serverVersion });
      const downloadUrl = resolveApkDownloadUrl({ serverVersion });

      if (__DEV__) {
        console.log('[useAppVersionCheck] Version evaluated:', {
          local: localVersion,
          server: serverVersion,
          isUpdateRequired: evaluation.isUpdateRequired,
        });
      }

      setStatus({
        isUpdateRequired: evaluation.isUpdateRequired,
        isUpdateAvailable: evaluation.isUpdateAvailable,
        localVersion: evaluation.localVersion,
        serverVersion: evaluation.serverVersion,
        apkDownloadUrl: downloadUrl,
      });
    } catch (err) {
      if (__DEV__) {
        console.warn('[useAppVersionCheck] Check failed:', err?.message || err);
      }
      // Non-blocking network failure: retain previous required state if already flagged
      setError(err);
    } finally {
      setIsLoading(false);
      isCheckingRef.current = false;
    }
  }, []);

  // Check version on initial mount
  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  // Re-check version when returning to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkVersion();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkVersion]);

  // Instantly mount modal when an outgoing API request receives 426 Upgrade Required
  useEffect(() => {
    const unsubscribe = registerVersionObsoleteListener((serverData) => {
      setStatus((prev) => ({
        ...prev,
        isUpdateRequired: true,
        isUpdateAvailable: true,
        apkDownloadUrl: serverData?.apkDownloadUrl || prev.apkDownloadUrl,
        serverVersion: {
          ...prev.serverVersion,
          minSupportedVersionCode: serverData?.minVersionCode ?? prev.serverVersion?.minSupportedVersionCode,
          apkDownloadUrl: serverData?.apkDownloadUrl || prev.serverVersion?.apkDownloadUrl,
        },
      }));
      // Trigger background refresh to fetch latest release notes
      checkVersion();
    });

    return () => {
      unsubscribe();
    };
  }, [checkVersion]);

  return {
    isUpdateRequired: status.isUpdateRequired,
    isUpdateAvailable: status.isUpdateAvailable,
    localVersion: status.localVersion,
    serverVersion: status.serverVersion,
    apkDownloadUrl: status.apkDownloadUrl,
    isLoading,
    error,
    checkVersion,
  };
}
