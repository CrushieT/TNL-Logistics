import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
import { getQueueRows } from '../../offline-sync/services/offlineQueueStore';
import { isUnresolved } from '../../offline-sync/offlineQueueFlow.mjs';

const AuthContext = createContext(null);

function toBoundUser(user) {
  if (!user) return null;
  return {
    userId: user.userId,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    staffType: user.staffType ?? null,
    hasPinSet: user.hasPinSet,
  };
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [boundUser, setBoundUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [popupNotice, setPopupNotice] = useState(null);

  const installSession = useCallback(async (replacementToken, nextUser) => {
    await replaceAuthenticatedSession({ token: replacementToken, user: nextUser });
    setToken(replacementToken);
    setUser(nextUser);
    setIsLocked(false);
  }, []);

  const clearAccessSessionPreservingBinding = useCallback(async () => {
    await clearStoredAccessSession();
    setToken(null);
    setUser(null);
    setIsLocked(true);
  }, []);

  const clearInvalidDeviceSession = useCallback(async () => {
    await clearStoredDeviceSession();
    setToken(null);
    setUser(null);
    setBoundUser(null);
    setIsLocked(false);
  }, []);

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
        if ((storedBoundUser || (storedUser && !storedUser.mustChangePassword)) && !deviceCredentials) {
          await clearInvalidDeviceSession();
          showSessionNotice({
            eyebrow: 'DEVICE SECURITY',
            title: 'Password Sign In Required',
            message: 'This device must be bound with a password before PIN unlock can be used.',
            action: 'password-login',
            username: storedUser?.username || storedBoundUser?.username,
            reason: 'device_credentials_missing',
          });
          return;
        }

        setBoundUser(storedBoundUser || null);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
          setIsLocked(storedUser.mustChangePassword ? false : locked);

          if (!storedUser.mustChangePassword && deviceCredentials) {
            try {
              const profile = await authService.fetchCurrentUser();
              if (isMounted) {
                const refreshedUser = { ...storedUser, ...profile };
                await saveUser(refreshedUser);
                setUser(refreshedUser);
              }
            } catch {
              // The API interceptor owns session and device credential failures.
            }
          }
        } else if (storedBoundUser && deviceCredentials) {
          setIsLocked(true);
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
      const { token: receivedToken, deviceId, deviceToken, ...userData } = data;

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
      return userData;
    } finally {
      setIsLoading(false);
    }
  }, [installSession]);

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
    const nextUser = { ...user, ...result };
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
      const { token: receivedToken, deviceId, deviceToken, ...userData } = data;
      await saveDeviceCredentials(deviceId, deviceToken);
      await installSession(receivedToken, userData);
      const nextBoundUser = toBoundUser(userData);
      await saveBoundUser(nextBoundUser);
      setBoundUser(nextBoundUser);
      return userData;
    } finally {
      setIsLoading(false);
    }
  }, [boundUser?.username, clearInvalidDeviceSession, installSession, user?.username]);

  const lockSession = useCallback(async () => {
    await setAppLocked(true);
    setIsLocked(true);
    router.replace('/(auth)/pin');
  }, [router]);

  const unbindCurrentDevice = useCallback(async () => {
    const offlineRows = user?.userId ? await getQueueRows(user.userId) : [];
    if (offlineRows.some(isUnresolved)) {
      throw { code: 'OFFLINE_QUEUE_PENDING', message: 'Synchronize or review offline scans before unbinding this device.' };
    }
    const result = await authService.unbindCurrentDevice();
    await clearInvalidDeviceSession();
    router.replace('/(auth)/login');
    return result;
  }, [clearInvalidDeviceSession, router, user?.userId]);

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
  const isAuthenticated = Boolean(token && user && !isLocked && !mustChangePassword && !mustSetupPin);

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
