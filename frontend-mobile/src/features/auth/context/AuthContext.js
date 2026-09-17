import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
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
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [boundUser, setBoundUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
        } else if (storedBoundUser) {
          // Device has bound account but session token is absent/expired
          setIsLocked(true);
        }
      } catch (e) {
        // Fallback gracefully on storage read failure
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

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
      }}
    >
      {children}
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
