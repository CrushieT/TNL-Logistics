/**
 * Core mobile version comparison and evaluation service.
 * Operates on integer version codes to guarantee deterministic monotonic ordering.
 */

/**
 * Resolve local application build metadata from Expo Constants or injected environment.
 * @param {Object} [constantsSource] Optional override for testing
 * @returns {{ versionCode: number, versionName: string }}
 */
export function getLocalAppVersion(constantsSource = null) {
  let expoConfig = null;
  let nativeAppVersion = null;
  let nativeBuildVersion = null;

  if (constantsSource) {
    expoConfig = constantsSource.expoConfig;
    nativeAppVersion = constantsSource.nativeAppVersion;
    nativeBuildVersion = constantsSource.nativeBuildVersion;
  } else {
    try {
      // Dynamic import to remain compatible with Node test environments without native modules
      const Constants = require('expo-constants')?.default || require('expo-constants');
      expoConfig = Constants?.expoConfig;
      nativeAppVersion = Constants?.nativeAppVersion;
      nativeBuildVersion = Constants?.nativeBuildVersion;
    } catch {
      // Fallbacks used when running outside native runtime
    }
  }

  const rawCode =
    expoConfig?.android?.versionCode ??
    (nativeBuildVersion ? parseInt(nativeBuildVersion, 10) : null) ??
    1;

  const parsedCode = Number(rawCode);
  const versionCode = Number.isInteger(parsedCode) && parsedCode > 0 ? parsedCode : 1;
  const versionName = expoConfig?.version || nativeAppVersion || '1.0.0';

  return { versionCode, versionName };
}

/**
 * Evaluates whether an update is required or optional given local and server version metadata.
 * @param {Object} params
 * @param {{ versionCode?: number|string, versionName?: string }} [params.localVersion]
 * @param {{ minSupportedVersionCode?: number|string, latestVersionCode?: number|string, latestVersionName?: string, apkDownloadUrl?: string, forceUpdate?: boolean, releaseNotes?: string }} [params.serverVersion]
 * @returns {{ isUpdateRequired: boolean, isUpdateAvailable: boolean, localVersion: { versionCode: number, versionName: string }, serverVersion: { minSupportedVersionCode: number, latestVersionCode: number, latestVersionName: string, apkDownloadUrl: string|null, forceUpdate: boolean, releaseNotes: string|null } }}
 */
export function checkAppVersionStatus({ localVersion, serverVersion } = {}) {
  const localCodeRaw = Number(localVersion?.versionCode);
  const localCode = Number.isInteger(localCodeRaw) && localCodeRaw > 0 ? localCodeRaw : 1;
  const localName = localVersion?.versionName || '1.0.0';

  if (!serverVersion || typeof serverVersion !== 'object') {
    return {
      isUpdateRequired: false,
      isUpdateAvailable: false,
      localVersion: { versionCode: localCode, versionName: localName },
      serverVersion: {
        minSupportedVersionCode: localCode,
        latestVersionCode: localCode,
        latestVersionName: localName,
        apkDownloadUrl: null,
        forceUpdate: false,
        releaseNotes: null,
      },
    };
  }

  const minCodeRaw = Number(serverVersion.minSupportedVersionCode);
  const minCode = Number.isInteger(minCodeRaw) && minCodeRaw > 0 ? minCodeRaw : 1;

  const latestCodeRaw = Number(serverVersion.latestVersionCode);
  const latestCode = Number.isInteger(latestCodeRaw) && latestCodeRaw > 0 ? latestCodeRaw : minCode;

  const isForceUpdate = serverVersion.forceUpdate !== false;

  const isUpdateAvailable = localCode < latestCode;
  const isUpdateRequired = isForceUpdate && localCode < minCode;

  return {
    isUpdateRequired,
    isUpdateAvailable,
    localVersion: {
      versionCode: localCode,
      versionName: localName,
    },
    serverVersion: {
      minSupportedVersionCode: minCode,
      latestVersionCode: latestCode,
      latestVersionName: serverVersion.latestVersionName || '1.0.0',
      apkDownloadUrl: serverVersion.apkDownloadUrl || null,
      forceUpdate: isForceUpdate,
      releaseNotes: serverVersion.releaseNotes || null,
    },
  };
}

/**
 * Resolves the primary APK download URL, falling back to client environment configurations.
 * @param {{ serverVersion?: { apkDownloadUrl?: string }, defaultUrl?: string }} options
 * @returns {string|null}
 */
export function resolveApkDownloadUrl({ serverVersion, defaultUrl = null } = {}) {
  if (serverVersion?.apkDownloadUrl && typeof serverVersion.apkDownloadUrl === 'string' && serverVersion.apkDownloadUrl.trim()) {
    return serverVersion.apkDownloadUrl.trim();
  }
  if (defaultUrl && typeof defaultUrl === 'string' && defaultUrl.trim()) {
    return defaultUrl.trim();
  }
  const envUrl = process.env.EXPO_PUBLIC_ANDROID_APK_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  return null;
}

const versionObsoleteListeners = new Set();

/**
 * Register a listener to be notified when the backend rejects an API request with HTTP 426 Upgrade Required.
 * @param {(serverData: Object) => void} listener
 * @returns {() => void} unsubscribe function
 */
export function registerVersionObsoleteListener(listener) {
  if (typeof listener !== 'function') return () => {};
  versionObsoleteListeners.add(listener);
  return () => {
    versionObsoleteListeners.delete(listener);
  };
}

/**
 * Dispatches a version obsolete event to all registered listeners.
 * @param {Object} [payload] Server-provided error payload containing minVersionCode, latestVersionCode, etc.
 */
export function notifyVersionObsolete(payload = {}) {
  for (const listener of versionObsoleteListeners) {
    try {
      listener(payload);
    } catch {
      // Non-blocking listener execution failure
    }
  }
}

/**
 * Returns mobile version headers for outgoing HTTP requests.
 * @param {string} [platformOverride]
 * @param {Object} [constantsSource]
 * @returns {Record<string, string>}
 */
export function buildMobileVersionHeaders(platformOverride = null, constantsSource = null) {
  let platform = platformOverride;
  if (!platform) {
    try {
      const { Platform } = require('react-native');
      platform = Platform?.OS;
    } catch {
      platform = null;
    }
  }

  if (platform !== 'android' && platform !== 'ios') {
    return {};
  }

  const { versionCode } = getLocalAppVersion(constantsSource);
  return {
    'X-App-Version-Code': String(versionCode),
    'X-App-Platform': platform,
  };
}
