import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import {
  saveToken,
  getToken,
  removeToken,
  saveUser,
  getUser,
  removeUser,
} from '../../../services/storage/secureStore';

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  loginWithPin: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore stored session on mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await getToken();
        const storedUser = await getUser();

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
        }
      } catch (e) {
        // Stored session read error
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const loginWithPin = useCallback(async (pin) => {
    setIsLoading(true);
    try {
      const data = await authService.loginWithPin(pin);
      const { token: receivedToken, ...userData } = data;

      await saveToken(receivedToken);
      await saveUser(userData);

      setToken(receivedToken);
      setUser(userData);
      return userData;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await removeToken();
      await removeUser();
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        isLoading,
        loginWithPin,
        logout,
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
