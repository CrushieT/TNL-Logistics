import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../services/authService';
import { setSessionEventCallback } from '../../../services/api/client';
import { StatusModal } from '../../../components/common/StatusModal';
import {
  clearAccessSessionPreservingBinding as clearStoredAccessSession,
  clearDeviceSession as clearStoredDeviceSession,
  getBoundUser,
  getDeviceCredentials,
  getToken,
  getUser,
  isAppLocked,
  replaceAuthenticatedSession,
  saveBoundUser,
  saveDeviceCredentials,
  saveToken,
  saveUser,
  setAppLocked,
} from '../../../services/storage/secureStore';
import { shouldRestoreLockedSession } from '../services/appLifecycleLock.mjs';
import { isSupportedMobileRole, sanitizeMobileUser } from '../services/roleAccess.mjs';

const AuthContext = createContext(null);

function toBoundUser(user) {
  const roleOnlyUser = sanitizeMobileUser(user);
  if (!roleOnlyUser) return null;
  return {
    userId: roleOnlyUser.userId,
    username: roleOnlyUser.username,
    fullName: roleOnlyUser.fullName,
    role: roleOnlyUser.role,
    hasPinSet: roleOnlyUser.hasPinSet,
  };
}

function requireSupportedMobileUser(user) {
  const roleOnlyUser = sanitizeMobileUser(user);
  if (!roleOnlyUser) {
    throw {
      status: 403,
      code: 'UNSUPPORTED_MOBILE_ROLE',
      message: 'This account is not authorized for the mobile application.',
      retryAfterSeconds: null,
    };
  }
  return roleOnlyUser;
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [boundUser, setBoundUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [popupNotice, setPopupNotice] = useState(null);

  const rejectInvalidIdentity = useCallback(async () => {
    await clearStoredDeviceSession();
    setToken(null);
    setUser(null);
    setBoundUser(null);
    setIsLocked(false);
  }, []);

  const installSession = useCallback(async (replacementToken, nextUser) => {
    const roleOnlyUser = requireSupportedMobileUser(nextUser);
    await replaceAuthenticatedSession({ token: replacementToken, user: roleOnlyUser });
    setToken(replacementToken);
    setUser(roleOnlyUser);
    setIsLocked(false);
  }, []);

  const refreshAuthenticatedUser = useCallback(async (authenticatedUser) => {
    try {
      const profile = await authService.fetchCurrentUser();
      const refreshedUser = requireSupportedMobileUser({ ...authenticatedUser, ...profile });
      await saveUser(refreshedUser);
      setUser(refreshedUser);
      const refreshedBoundUser = toBoundUser(refreshedUser);
      await saveBoundUser(refreshedBoundUser);
      setBoundUser(refreshedBoundUser);
      return refreshedUser;
    } catch (error) {
      if (error?.code === 'UNSUPPORTED_MOBILE_ROLE') {
        await rejectInvalidIdentity();
        throw error;
      }
      return authenticatedUser;
    }
  }, [rejectInvalidIdentity]);

  const clearAccessSessionPreservingBinding = useCallback(async () => {
    await clearStoredAccessSession();
    setToken(null);
    setUser(null);
    setIsLocked(true);
  }, []);

  const clearInvalidDeviceSession = useCallback(async () => {
    await rejectInvalidIdentity();
  }, [rejectInvalidIdentity]);

  const showSessionNotice = useCallback((notice) => {
    setPopupNotice({
      eyebrow: notice.eyebrow || 'SECURITY NOTICE',
      title: notice.title || 'Sign In Required',
      message: notice.message || 'Please sign in with your password to continue.',
      confirmText: notice.confirmText || 'CONTINUE',
      action: notice.action || 'password-login',
      username: notice.username || '',
      reason: notice.reason || 'session_expired',
    });
  }, []);

  const startPasswordReauthentication = useCallback(async ({
    username,
    reason = 'password_reauthentication',
  } = {}) => {
    const targetUsername = username || user?.username || boundUser?.username || '';
    await clearAccessSessionPreservingBinding();
    router.replace({
      pathname: '/(auth)/login',
      params: { username: targetUsername, reason },
    });
  }, [boundUser?.username, clearAccessSessionPreservingBinding, router, user?.username]);

  useEffect(() => {
    setSessionEventCallback(async (event) => {
      const storedUser = await getUser();
      const storedBoundUser = await getBoundUser();
      const username = storedUser?.username || storedBoundUser?.username || '';

      if (event.type === 'SESSION_REAUTH_REQUIRED') {
        await clearAccessSessionPreservingBinding();
        router.replace('/(auth)/pin');
        showSessionNotice({
          eyebrow: 'SESSION RENEWAL',
          title: 'Unlock Required',
          message: 'Your account security changed. Unlock this device with your PIN to renew the session.',
          action: 'dismiss',
        });
      } else if (event.type === 'INVALID_DEVICE_CREDENTIALS') {
        await clearInvalidDeviceSession();
        router.replace({
          pathname: '/(auth)/login',
          params: { username, reason: 'device_credentials_invalid' },
        });
        showSessionNotice({
          eyebrow: 'DEVICE SECURITY',
          title: 'Password Sign In Required',
          message: 'This device binding is no longer valid. Sign in with your password to bind it again.',
          action: 'dismiss',
        });
      }
    });
    return () => setSessionEventCallback(null);
  }, [clearAccessSessionPreservingBinding, clearInvalidDeviceSession, router, showSessionNotice]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const [storedBoundUser, storedToken, storedUser, deviceCredentials, locked] = await Promise.all([
          getBoundUser(), getToken(), getUser(), getDeviceCredentials(), isAppLocked(),
        ]);

        if (!isMounted) return;
        const restoredBoundUser = storedBoundUser ? sanitizeMobileUser(storedBoundUser) : null;
        const restoredUser = storedUser ? sanitizeMobileUser(storedUser) : null;
        if ((storedBoundUser && !restoredBoundUser) || (storedUser && !restoredUser)) {
          await clearInvalidDeviceSession();
          showSessionNotice({
            eyebrow: 'ACCOUNT ACCESS',
            title: 'Password Sign In Required',
            message: 'The saved session uses an unsupported or outdated role and was removed.',
            action: 'dismiss',
          });
          return;
        }
        if (storedBoundUser && Object.hasOwn(storedBoundUser, 'staffType')) {
          await saveBoundUser(restoredBoundUser);
        }
        if (storedUser && Object.hasOwn(storedUser, 'staffType')) {
          await saveUser(restoredUser);
        }
        if ((restoredBoundUser || (restoredUser && !restoredUser.mustChangePassword)) && !deviceCredentials) {
          await clearInvalidDeviceSession();
          showSessionNotice({
            eyebrow: 'DEVICE SECURITY',
            title: 'Password Sign In Required',
            message: 'This device must be bound with a password before PIN unlock can be used.',
            action: 'password-login',
            username: restoredUser?.username || restoredBoundUser?.username,
            reason: 'device_credentials_missing',
          });
          return;
        }

        setBoundUser(restoredBoundUser || null);
        if (storedToken && restoredUser) {
          const restoredLocked = shouldRestoreLockedSession({
            platform: Platform.OS,
            boundUser: restoredBoundUser,
            user: restoredUser,
            hasDeviceCredentials: Boolean(deviceCredentials),
            persistedLocked: locked,
          });
          setToken(storedToken);
          setUser(restoredUser);
          setIsLocked(restoredLocked);
          if (restoredLocked && !locked) {
            await setAppLocked(true);
          }

          if (!restoredLocked && !restoredUser.mustChangePassword && deviceCredentials) {
            authService.fetchCurrentUser()
              .then(async (profile) => {
                if (isMounted) {
                  const refreshedUser = requireSupportedMobileUser({ ...restoredUser, ...profile });
                  await saveUser(refreshedUser);
                  setUser(refreshedUser);
                }
              })
              .catch(async (error) => {
                if (error?.code === 'UNSUPPORTED_MOBILE_ROLE' && isMounted) {
                  await clearInvalidDeviceSession();
                }
              });
          }
        } else if (restoredBoundUser && deviceCredentials) {
          const restoredLocked = shouldRestoreLockedSession({
            platform: Platform.OS,
            boundUser: restoredBoundUser,
            user: null,
            hasDeviceCredentials: true,
            persistedLocked: locked,
          });
          setIsLocked(restoredLocked);
          if (restoredLocked && !locked) {
            await setAppLocked(true);
          }
        }
      } catch {
        if (isMounted) {
          setToken(null);
          setUser(null);
          setBoundUser(null);
          setIsLocked(false);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    restoreSession();
    return () => { isMounted = false; };
  }, [clearInvalidDeviceSession, showSessionNotice]);

  const loginWithPassword = useCallback(async (username, password) => {
    setIsLoading(true);
    try {
      const existingDeviceCredentials = await getDeviceCredentials();
      const data = await authService.loginWithPassword(username, password, existingDeviceCredentials?.deviceId);
      const { token: receivedToken, deviceId, deviceToken, ...rawUserData } = data;
      const userData = requireSupportedMobileUser(rawUserData);

      if (userData.mustChangePassword) {
        await saveToken(receivedToken);
        await saveUser(userData);
        await setAppLocked(false);
        setToken(receivedToken);
        setUser(userData);
        setIsLocked(false);
        return userData;
      }

      await saveDeviceCredentials(deviceId, deviceToken);
      const nextBoundUser = toBoundUser(userData);
      await saveBoundUser(nextBoundUser);
      await installSession(receivedToken, userData);
      setBoundUser(nextBoundUser);
      return refreshAuthenticatedUser(userData);
    } finally {
      setIsLoading(false);
    }
  }, [installSession, refreshAuthenticatedUser]);

  const completeRequiredPasswordChange = useCallback(async (currentPassword, newPassword) => {
    setIsLoading(true);
    try {
      const result = await authService.changePassword(currentPassword, newPassword);
      const existingBinding = await getBoundUser();
      if (existingBinding) await clearAccessSessionPreservingBinding();
      else await clearInvalidDeviceSession();
      return { ...result, username: result.username || user?.username || '' };
    } finally {
      setIsLoading(false);
    }
  }, [clearAccessSessionPreservingBinding, clearInvalidDeviceSession, user?.username]);

  const rotatePasswordInSession = useCallback(async (currentPassword, newPassword) => {
    const result = await authService.changePassword(currentPassword, newPassword);
    const nextUser = requireSupportedMobileUser({ ...user, ...result });
    delete nextUser.token;
    delete nextUser.message;
    await installSession(result.token, nextUser);
    const nextBoundUser = toBoundUser(nextUser);
    await saveBoundUser(nextBoundUser);
    setBoundUser(nextBoundUser);
    return result;
  }, [installSession, user]);

  const setupInitialPin = useCallback(async (pin) => {
    const result = await authService.setupInitialPin(pin);
    const nextUser = { ...user, hasPinSet: true };
    const nextBoundUser = { ...(boundUser || toBoundUser(nextUser)), hasPinSet: true };
    await installSession(result.token, nextUser);
    await saveBoundUser(nextBoundUser);
    setBoundUser(nextBoundUser);
    return result;
  }, [boundUser, installSession, user]);

  const rotateUserPin = useCallback(async (pin, currentPassword) => {
    const result = await authService.rotatePin(pin, currentPassword);
    const nextUser = { ...user, hasPinSet: true };
    const nextBoundUser = { ...(boundUser || toBoundUser(nextUser)), hasPinSet: true };
    await installSession(result.token, nextUser);
    await saveBoundUser(nextBoundUser);
    setBoundUser(nextBoundUser);
    return result;
  }, [boundUser, installSession, user]);

  const unlockWithPin = useCallback(async (pin) => {
    setIsLoading(true);
    try {
      const targetUsername = boundUser?.username || user?.username;
      const deviceCredentials = await getDeviceCredentials();
      if (!targetUsername || !deviceCredentials) {
        await clearInvalidDeviceSession();
        throw { code: 'MISSING_DEVICE_CREDENTIALS', message: 'Password sign in is required.' };
      }
      const data = await authService.loginWithPin(targetUsername, pin, deviceCredentials);
      const { token: receivedToken, deviceId, deviceToken, ...rawUserData } = data;
      const userData = requireSupportedMobileUser(rawUserData);
      await saveDeviceCredentials(deviceId, deviceToken);
      await installSession(receivedToken, userData);
      const nextBoundUser = toBoundUser(userData);
      await saveBoundUser(nextBoundUser);
      setBoundUser(nextBoundUser);
      return refreshAuthenticatedUser(userData);
    } finally {
      setIsLoading(false);
    }
  }, [boundUser?.username, clearInvalidDeviceSession, installSession, refreshAuthenticatedUser, user?.username]);

  const lockSession = useCallback(async () => {
    setIsLocked(true);
    const persistLock = setAppLocked(true);
    router.replace('/(auth)/pin');
    await persistLock;
  }, [router]);

  const unbindCurrentDevice = useCallback(async () => {
    const result = await authService.unbindCurrentDevice();
    await clearInvalidDeviceSession();
    router.replace('/(auth)/login');
    return result;
  }, [clearInvalidDeviceSession, router]);

  const updateBoundUserPinStatus = useCallback(async (hasPinSet) => {
    const currentBoundUser = boundUser || await getBoundUser();
    if (!currentBoundUser) return;
    const nextBoundUser = { ...currentBoundUser, hasPinSet };
    await saveBoundUser(nextBoundUser);
    setBoundUser(nextBoundUser);
    setUser((currentUser) => currentUser ? { ...currentUser, hasPinSet } : currentUser);
  }, [boundUser]);

  const handleNoticeConfirm = async () => {
    const notice = popupNotice;
    setPopupNotice(null);
    if (notice?.action === 'password-login') {
      await startPasswordReauthentication({ username: notice.username, reason: notice.reason });
    }
  };

  const mustChangePassword = Boolean(user?.mustChangePassword);
  const mustSetupPin = Boolean(user && !mustChangePassword && user.hasPinSet === false);
  const isAuthenticated = Boolean(
    token
    && user
    && isSupportedMobileRole(user.role)
    && !isLocked
    && !mustChangePassword
    && !mustSetupPin
  );

  return (
    <AuthContext.Provider value={{
      user, boundUser, token, isAuthenticated, isLoading, isLocked, mustChangePassword, mustSetupPin,
      loginWithPassword, completeRequiredPasswordChange, rotatePasswordInSession, setupInitialPin,
      rotateUserPin, unlockWithPin, loginWithPin: unlockWithPin, lockSession,
      startPasswordReauthentication, unbindCurrentDevice, clearInvalidDeviceSession,
      updateBoundUserPinStatus, showSessionNotice,
    }}>
      {children}
      <StatusModal
        visible={Boolean(popupNotice)}
        title={popupNotice?.title}
        eyebrow={popupNotice?.eyebrow}
        message={popupNotice?.message}
        confirmText={popupNotice?.confirmText || 'CONTINUE'}
        onConfirm={handleNoticeConfirm}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
