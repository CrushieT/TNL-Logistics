import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { authService } from '../services/authService';
import { setSessionRevokedCallback } from '../../../services/api/client';
import { StatusModal } from '../../../components/common/StatusModal';
import {
  saveToken,
  getToken,
  removeToken,
  saveUser,
  getUser,
  removeUser,
  saveBoundUser,
  getBoundUser,
  removeBoundUser,
  setAppLocked,
  isAppLocked,
} from '../../../services/storage/secureStore';

const AuthContext = createContext({
  user: null,
  boundUser: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  isLocked: false,
  mustSetupPin: false,
  loginWithPassword: async () => {},
  setupUserPin: async () => {},
  unlockWithPin: async () => {},
  loginWithPin: async () => {},
  lockSession: async () => {},
  fullLogout: async () => {},
  logout: async () => {},
  updateBoundUserPinStatus: async () => {},
  showSessionNotice: () => {},
});

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [boundUser, setBoundUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [popupNotice, setPopupNotice] = useState(null);

  const showSessionNotice = useCallback(({
    title,
    eyebrow = 'SECURITY NOTICE',
    message,
    confirmText = 'PROCEED TO SIGN IN',
    username,
    reason = 'pin_cleared',
  }) => {
    setPopupNotice({
      title,
      eyebrow,
      message,
      confirmText,
      username,
      reason,
    });
  }, []);

  const handleNoticeConfirm = async () => {
    const currentNotice = popupNotice;
    setPopupNotice(null);
    await fullLogout();
    try {
      router.replace({
        pathname: '/(auth)/login',
        params: {
          username: currentNotice?.username || '',
          reason: currentNotice?.reason || 'pin_cleared',
        },
      });
    } catch (error) {
      // Non-blocking navigation error
    }
  };

  // Register session revocation callback for 401s on authenticated requests
  useEffect(() => {
    setSessionRevokedCallback(async () => {
      const storedUser = await getUser();
      const storedBoundUser = await getBoundUser();
      const username = storedUser?.username || storedBoundUser?.username;

      await removeToken();
      await removeUser();
      await removeBoundUser();
      await setAppLocked(false);

      setToken(null);
      setUser(null);
      setBoundUser(null);
      setIsLocked(false);

      showSessionNotice({
        title: 'Session Ended',
        eyebrow: 'SESSION REVOKED',
        message: 'Your session was revoked or expired. Please sign in again with your password.',
        confirmText: 'PROCEED TO SIGN IN',
        username,
        reason: 'session_expired',
      });
    });
  }, [showSessionNotice]);

  // Restore stored session and device binding on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const storedBoundUser = await getBoundUser();
        const storedToken = await getToken();
        const storedUser = await getUser();
        const lockedStatus = await isAppLocked();

        if (storedBoundUser) {
          setBoundUser(storedBoundUser);
        }

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
          setIsLocked(lockedStatus || false);

          // Verify session freshness with server in background
          try {
            const freshUser = await authService.fetchCurrentUser();
            if (freshUser) {
              if (freshUser.hasPinSet === false) {
                // PIN cleared by admin -> log out account completely and display notice
                await removeToken();
                await removeUser();
                await removeBoundUser();
                await setAppLocked(false);
                setToken(null);
                setUser(null);
                setBoundUser(null);
                setIsLocked(false);

                showSessionNotice({
                  title: 'PIN Reset by Administrator',
                  eyebrow: 'SECURITY NOTICE',
                  message: 'Your PIN was cleared by an administrator. Please sign in with your password to configure a new PIN.',
                  confirmText: 'PROCEED TO SIGN IN',
                  username: freshUser.username,
                  reason: 'pin_cleared',
                });
              } else {
                setUser(freshUser);
              }
            }
          } catch (verifyError) {
            if (verifyError.response?.status === 401) {
              // Token revoked / tokenVersion mismatch on server
              await removeToken();
              await removeUser();
              await removeBoundUser();
              await setAppLocked(false);
              setToken(null);
              setUser(null);
              setBoundUser(null);
              setIsLocked(false);

              showSessionNotice({
                title: 'Session Ended',
                eyebrow: 'SESSION REVOKED',
                message: 'Your session was revoked or expired. Please sign in again with your password.',
                confirmText: 'PROCEED TO SIGN IN',
                username: storedUser.username,
                reason: 'session_expired',
              });
            }
          }
        } else if (storedBoundUser) {
          // If stored bound user has no PIN configured, clear binding and show notice
          if (storedBoundUser.hasPinSet === false) {
            await removeBoundUser();
            setBoundUser(null);
            setIsLocked(false);

            showSessionNotice({
              title: 'PIN Reset by Administrator',
              eyebrow: 'SECURITY NOTICE',
              message: 'Your PIN was cleared by an administrator. Please sign in with your password to configure a new PIN.',
              confirmText: 'PROCEED TO SIGN IN',
              username: storedBoundUser.username,
              reason: 'pin_cleared',
            });
          } else {
            setIsLocked(true);
          }
        }
      } catch (e) {
        // Fallback gracefully on storage read failure
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, [showSessionNotice]);

  const loginWithPassword = useCallback(async (username, password) => {
    setIsLoading(true);
    try {
      const data = await authService.loginWithPassword(username, password);
      const { token: receivedToken, ...userData } = data;

      await saveToken(receivedToken);
      await saveUser(userData);
      await saveBoundUser({
        userId: userData.userId,
        username: userData.username,
        fullName: userData.fullName,
        role: userData.role,
        hasPinSet: userData.hasPinSet,
      });
      await setAppLocked(false);

      setToken(receivedToken);
      setUser(userData);
      setBoundUser({
        userId: userData.userId,
        username: userData.username,
        fullName: userData.fullName,
        role: userData.role,
        hasPinSet: userData.hasPinSet,
      });
      setIsLocked(false);

      return userData;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setupUserPin = useCallback(async (pin) => {
    setIsLoading(true);
    try {
      const result = await authService.setupPin(pin);
      const updatedUser = user ? { ...user, hasPinSet: true } : null;
      const updatedBoundUser = boundUser ? { ...boundUser, hasPinSet: true } : null;

      if (updatedUser) {
        await saveUser(updatedUser);
        setUser(updatedUser);
      }
      if (updatedBoundUser) {
        await saveBoundUser(updatedBoundUser);
        setBoundUser(updatedBoundUser);
      }

      return result;
    } finally {
      setIsLoading(false);
    }
  }, [user, boundUser]);

  const unlockWithPin = useCallback(async (pin) => {
    setIsLoading(true);
    try {
      const targetUsername = boundUser?.username || user?.username;
      const payload = targetUsername ? { username: targetUsername, pin } : { pin };
      const data = await authService.loginWithPin(payload);
      const { token: receivedToken, ...userData } = data;

      await saveToken(receivedToken);
      await saveUser(userData);
      await setAppLocked(false);

      setToken(receivedToken);
      setUser(userData);
      setIsLocked(false);

      return userData;
    } finally {
      setIsLoading(false);
    }
  }, [boundUser, user]);

  const lockSession = useCallback(async () => {
    await setAppLocked(true);
    setIsLocked(true);
  }, []);

  const fullLogout = useCallback(async () => {
    setIsLoading(true);
    try {
      await removeToken();
      await removeUser();
      await removeBoundUser();
      await setAppLocked(false);

      setToken(null);
      setUser(null);
      setBoundUser(null);
      setIsLocked(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateBoundUserPinStatus = useCallback(async (hasPinSet) => {
    const current = boundUser || await getBoundUser();
    if (current) {
      const updated = { ...current, hasPinSet };
      await saveBoundUser(updated);
      setBoundUser(updated);
      if (user) {
        setUser((prev) => (prev ? { ...prev, hasPinSet } : prev));
      }
    }
  }, [boundUser, user]);

  const mustSetupPin = Boolean(user && user.hasPinSet === false);
  const isAuthenticated = Boolean(token && user && !isLocked && !mustSetupPin);

  return (
    <AuthContext.Provider
      value={{
        user,
        boundUser,
        token,
        isAuthenticated,
        isLoading,
        isLocked,
        mustSetupPin,
        loginWithPassword,
        setupUserPin,
        unlockWithPin,
        loginWithPin: unlockWithPin,
        lockSession,
        fullLogout,
        logout: fullLogout,
        updateBoundUserPinStatus,
        showSessionNotice,
      }}
    >
      {children}
      <StatusModal
        visible={Boolean(popupNotice)}
        title={popupNotice?.title}
        eyebrow={popupNotice?.eyebrow}
        message={popupNotice?.message}
        confirmText={popupNotice?.confirmText || 'PROCEED TO SIGN IN'}
        onConfirm={handleNoticeConfirm}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
