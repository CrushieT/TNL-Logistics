import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../services/authService';
import { authSessionCoordinator as coordinator, commitSessionState, refreshMatchingProfile } from '../services/sessionCoordinator.mjs';
import { setSessionEventCallback } from '../../../services/api/client';
import { StatusModal } from '../../../components/common/StatusModal';
import {
  clearAccessSessionPreservingBinding as clearStoredAccessSession,
  clearDeviceSession as clearStoredDeviceSession,
  commitCompleteSession,
  getBoundUser,
  getDeviceCredentials,
  getToken,
  getUser,
  isAppLocked,
  isSessionCommitPending,
  saveBoundUser,
  setAppLocked,
} from '../../../services/storage/secureStore';
import { shouldRestoreLockedSession } from '../services/appLifecycleLock.mjs';
import { isSupportedMobileRole, sanitizeMobileUser } from '../services/roleAccess.mjs';

const AuthContext = createContext(null);

function requireSupportedMobileUser(user) {
  const nextUser = sanitizeMobileUser(user);
  if (!nextUser?.userId || !nextUser?.username) {
    throw { status: 403, code: 'UNSUPPORTED_MOBILE_ROLE', message: 'This account is not authorized for the mobile application.' };
  }
  return nextUser;
}

function toBoundUser(user) {
  const { userId, username, fullName, role, hasPinSet } = requireSupportedMobileUser(user);
  return { userId, username, fullName, role, hasPinSet };
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [boundUser, setBoundUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [popupNotice, setPopupNotice] = useState(null);

  const clearSession = useCallback(async (preserveBinding) => {
    const generation = coordinator.begin();
    setToken(null);
    setUser(null);
    setIsLocked(true);
    setIsLoading(true);
    try {
      const remainingBoundUser = await coordinator.commit(generation, async () => {
        if (preserveBinding && !await isSessionCommitPending()) {
          await clearStoredAccessSession();
          return getBoundUser();
        }
        await clearStoredDeviceSession();
        return null;
      });
      setBoundUser(remainingBoundUser);
      setIsLocked(Boolean(remainingBoundUser));
      return generation;
    } finally {
      if (coordinator.isCurrent(generation)) setIsLoading(false);
    }
  }, []);

  const clearAccessSessionPreservingBinding = useCallback(() => clearSession(true), [clearSession]);
  const clearInvalidDeviceSession = useCallback(() => clearSession(false), [clearSession]);

  const installSession = useCallback(async (replacementToken, nextUser, generation = coordinator.generation(), deviceCredentials) => {
    const roleOnlyUser = requireSupportedMobileUser(nextUser);
    let installedBoundUser;
    try {
      await commitSessionState(coordinator, generation, async () => {
        const credentials = roleOnlyUser.mustChangePassword ? null : deviceCredentials || await getDeviceCredentials();
        installedBoundUser = credentials ? toBoundUser(roleOnlyUser) : await getBoundUser();
        if (!roleOnlyUser.mustChangePassword && !credentials) {
          throw { code: 'MISSING_DEVICE_CREDENTIALS', message: 'Password sign in is required.' };
        }
        await commitCompleteSession({
          token: replacementToken, user: roleOnlyUser,
          deviceCredentials: credentials, boundUser: installedBoundUser,
        });
      });
    } catch (error) {
      if (coordinator.isCurrent(generation) || coordinator.isCurrent(error?.invalidatedGeneration)) {
        setToken(null);
        setUser(null);
        setBoundUser(null);
        setIsLocked(true);
        setIsLoading(false);
      }
      throw error;
    }
    coordinator.publish(generation, {
      token: replacementToken, userId: roleOnlyUser.userId,
      deviceId: deviceCredentials?.deviceId || (await getDeviceCredentials())?.deviceId,
    });
    setToken(replacementToken);
    setUser(roleOnlyUser);
    setBoundUser(installedBoundUser);
    setIsLocked(false);
  }, []);

  const refreshAuthenticatedUser = useCallback(async (authenticatedUser) => {
    const snapshot = coordinator.current();
    try {
      const refreshedUser = await refreshMatchingProfile(coordinator, snapshot, authenticatedUser,
        () => authService.fetchCurrentUser(), async (profile) => {
          const nextUser = requireSupportedMobileUser(profile);
          await commitCompleteSession({
            token: snapshot.token, user: nextUser,
            deviceCredentials: await getDeviceCredentials(), boundUser: toBoundUser(nextUser),
          });
        });
      if (!refreshedUser) return;
      setUser(refreshedUser);
      setBoundUser(toBoundUser(refreshedUser));
    } catch (error) {
      if (error?.code === 'SESSION_PERSISTENCE_FAILED' && coordinator.isCurrent(error.invalidatedGeneration)) {
        await clearInvalidDeviceSession();
        return;
      }
      if (coordinator.matches(snapshot) && ['UNSUPPORTED_MOBILE_ROLE', 'PROFILE_IDENTITY_MISMATCH'].includes(error?.code)) {
        await clearInvalidDeviceSession();
      }
    }
  }, [clearInvalidDeviceSession]);

  const showSessionNotice = useCallback((notice) => {
    setPopupNotice({
      eyebrow: notice.eyebrow || 'SECURITY NOTICE', title: notice.title || 'Sign In Required',
      message: notice.message || 'Please sign in with your password to continue.',
      confirmText: notice.confirmText || 'CONTINUE', action: notice.action || 'password-login',
      username: notice.username || '', reason: notice.reason || 'session_expired',
    });
  }, []);

  const startPasswordReauthentication = useCallback(async ({
    username, reason = 'password_reauthentication',
  } = {}) => {
    const targetUsername = username || user?.username || boundUser?.username || '';
    const generation = await clearAccessSessionPreservingBinding();
    coordinator.assertCurrent(generation);
    router.replace({ pathname: '/(auth)/login', params: { username: targetUsername, reason } });
  }, [boundUser?.username, clearAccessSessionPreservingBinding, router, user?.username]);

  useEffect(() => {
    setSessionEventCallback(async (event) => {
      if (!coordinator.isCurrent(event.generation)) return;
      const username = user?.username || boundUser?.username || '';
      if (event.type === 'SESSION_REAUTH_REQUIRED') {
        const generation = await clearAccessSessionPreservingBinding();
        coordinator.assertCurrent(generation);
        router.replace('/(auth)/pin');
      } else if (event.type === 'INVALID_DEVICE_CREDENTIALS') {
        const generation = await clearInvalidDeviceSession();
        coordinator.assertCurrent(generation);
        router.replace({ pathname: '/(auth)/login', params: { username, reason: 'device_credentials_invalid' } });
      }
    });
    return () => setSessionEventCallback(null);
  }, [boundUser?.username, user?.username, clearAccessSessionPreservingBinding, clearInvalidDeviceSession, router]);

  useEffect(() => {
    let isMounted = true;
    const generation = coordinator.begin();
    async function restoreSession() {
      try {
        const [storedBoundUser, storedToken, storedUser, deviceCredentials, locked, pending] = await Promise.all([
          getBoundUser(), getToken(), getUser(), getDeviceCredentials(), isAppLocked(), isSessionCommitPending(),
        ]);
        if (!isMounted || !coordinator.isCurrent(generation)) return;
        const restoredBoundUser = storedBoundUser ? sanitizeMobileUser(storedBoundUser) : null;
        const restoredUser = storedUser ? sanitizeMobileUser(storedUser) : null;
        if (pending || (storedBoundUser && !restoredBoundUser) || (storedUser && !restoredUser)
            || (restoredUser && !restoredUser.mustChangePassword && restoredBoundUser?.userId !== restoredUser.userId)
            || ((restoredBoundUser || (restoredUser && !restoredUser.mustChangePassword)) && !deviceCredentials)) {
          await clearInvalidDeviceSession();
          return;
        }
        setBoundUser(restoredBoundUser);
        setToken(storedToken);
        setUser(restoredUser);
        const restoredLocked = shouldRestoreLockedSession({
          platform: Platform.OS, boundUser: restoredBoundUser, user: restoredUser,
          hasDeviceCredentials: Boolean(deviceCredentials), persistedLocked: locked,
        });
        setIsLocked(restoredLocked);
        if (restoredLocked) {
          await coordinator.commit(generation, () => setAppLocked(true));
        } else if (storedToken && restoredUser) {
          coordinator.publish(generation, {
            token: storedToken, userId: restoredUser.userId, deviceId: deviceCredentials?.deviceId,
          });
          if (!restoredUser.mustChangePassword && deviceCredentials) {
            void refreshAuthenticatedUser(restoredUser);
          }
        }
      } catch {
        if (isMounted && coordinator.isCurrent(generation)) await clearInvalidDeviceSession();
      } finally {
        if (isMounted && coordinator.isCurrent(generation)) setIsLoading(false);
      }
    }
    void restoreSession();
    return () => { isMounted = false; };
  }, [clearInvalidDeviceSession, refreshAuthenticatedUser]);

  const loginWithPassword = useCallback(async (username, password, confirmDeviceSwitch = false) => {
    const generation = coordinator.begin();
    setIsLoading(true);
    setToken(null);
    setUser(null);
    setIsLocked(true);
    try {
      const credentials = await getDeviceCredentials();
      coordinator.assertCurrent(generation);
      const data = await authService.loginWithPassword(username, password, credentials, confirmDeviceSwitch);
      coordinator.assertCurrent(generation);
      const { token: receivedToken, deviceId, deviceToken, ...rawUserData } = data;
      const userData = requireSupportedMobileUser(rawUserData);
      await installSession(receivedToken, userData, generation,
        userData.mustChangePassword ? null : { deviceId, deviceToken });
      coordinator.assertCurrent(generation);
      return userData;
    } finally {
      if (coordinator.isCurrent(generation)) setIsLoading(false);
    }
  }, [installSession]);

  const completeRequiredPasswordChange = useCallback(async (currentPassword, newPassword) => {
    const generation = coordinator.generation();
    setIsLoading(true);
    try {
      const result = await authService.changePassword(currentPassword, newPassword);
      coordinator.assertCurrent(generation);
      const nextGeneration = await clearAccessSessionPreservingBinding();
      coordinator.assertCurrent(nextGeneration);
      return { ...result, username: result.username || user?.username || '' };
    } finally {
      if (coordinator.isCurrent(generation)) setIsLoading(false);
    }
  }, [clearAccessSessionPreservingBinding, user?.username]);

  const rotatePasswordInSession = useCallback(async (currentPassword, newPassword) => {
    const generation = coordinator.generation();
    const result = await authService.changePassword(currentPassword, newPassword);
    coordinator.assertCurrent(generation);
    const nextUser = requireSupportedMobileUser({ ...user, ...result });
    delete nextUser.token;
    delete nextUser.message;
    await installSession(result.token, nextUser, generation);
    return result;
  }, [installSession, user]);

  const setupInitialPin = useCallback(async (pin) => {
    const generation = coordinator.generation();
    const result = await authService.setupInitialPin(pin);
    coordinator.assertCurrent(generation);
    await installSession(result.token, { ...user, hasPinSet: true }, generation);
    return result;
  }, [installSession, user]);

  const rotateUserPin = useCallback(async (pin, currentPassword) => {
    const generation = coordinator.generation();
    const result = await authService.rotatePin(pin, currentPassword);
    coordinator.assertCurrent(generation);
    await installSession(result.token, { ...user, hasPinSet: true }, generation);
    return result;
  }, [installSession, user]);

  const unlockWithPin = useCallback(async (pin) => {
    const targetUsername = boundUser?.username;
    const generation = coordinator.begin();
    setIsLoading(true);
    try {
      const credentials = await getDeviceCredentials();
      coordinator.assertCurrent(generation);
      if (!targetUsername || !credentials) {
        throw { code: 'MISSING_DEVICE_CREDENTIALS', message: 'Password sign in is required.' };
      }
      const data = await authService.loginWithPin(targetUsername, pin, credentials);
      coordinator.assertCurrent(generation);
      const { token: receivedToken, deviceId, deviceToken, ...rawUserData } = data;
      const userData = requireSupportedMobileUser(rawUserData);
      await installSession(receivedToken, userData, generation, { deviceId, deviceToken });
      coordinator.assertCurrent(generation);
      return userData;
    } finally {
      if (coordinator.isCurrent(generation)) setIsLoading(false);
    }
  }, [boundUser?.username, installSession]);

  const lockSession = useCallback(async () => {
    const generation = await clearAccessSessionPreservingBinding();
    coordinator.assertCurrent(generation);
    router.replace('/(auth)/pin');
  }, [clearAccessSessionPreservingBinding, router]);

  const unbindCurrentDevice = useCallback(async () => {
    const generation = coordinator.generation();
    const result = await authService.unbindCurrentDevice();
    coordinator.assertCurrent(generation);
    const nextGeneration = await clearInvalidDeviceSession();
    coordinator.assertCurrent(nextGeneration);
    router.replace('/(auth)/login');
    return result;
  }, [clearInvalidDeviceSession, router]);

  const updateBoundUserPinStatus = useCallback(async (hasPinSet) => {
    const snapshot = coordinator.current();
    if (!boundUser) return;
    const nextBoundUser = { ...boundUser, hasPinSet };
    await coordinator.commit(snapshot.generation, () => saveBoundUser(nextBoundUser));
    setBoundUser(nextBoundUser);
    setUser((currentUser) => currentUser?.userId === nextBoundUser.userId ? { ...currentUser, hasPinSet } : currentUser);
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
  const isAuthenticated = Boolean(token && user && isSupportedMobileRole(user.role)
    && !isLocked && !mustChangePassword && !mustSetupPin && !isLoading);

  return (
    <AuthContext.Provider value={{
      user, boundUser, token, isAuthenticated, isLoading, isLocked, mustChangePassword, mustSetupPin,
      loginWithPassword, completeRequiredPasswordChange, rotatePasswordInSession, setupInitialPin,
      rotateUserPin, unlockWithPin, loginWithPin: unlockWithPin, lockSession,
      startPasswordReauthentication, unbindCurrentDevice, clearInvalidDeviceSession,
      cancelPendingAuthentication: clearAccessSessionPreservingBinding,
      updateBoundUserPinStatus, showSessionNotice,
    }}>
      {children}
      <StatusModal visible={Boolean(popupNotice)} title={popupNotice?.title}
        eyebrow={popupNotice?.eyebrow} message={popupNotice?.message}
        confirmText={popupNotice?.confirmText || 'CONTINUE'} onConfirm={handleNoticeConfirm} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
