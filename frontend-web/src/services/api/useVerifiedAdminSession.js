import { useEffect, useState } from 'react';
import { getSessionAuthContext, onSessionChanged } from './client';

export function getVerifiedAdminSessionKey() {
  const auth = getSessionAuthContext();
  return auth.isAuthenticated && auth.isVerified && auth.userId != null
    ? JSON.stringify([auth.userId, auth.sessionGeneration])
    : null;
}

export function useVerifiedAdminSession() {
  const [sessionKey, setSessionKey] = useState(getVerifiedAdminSessionKey);

  useEffect(() => {
    const updateSession = () => setSessionKey(getVerifiedAdminSessionKey());
    const unsubscribe = onSessionChanged(updateSession);
    updateSession();
    return unsubscribe;
  }, []);

  return sessionKey;
}
