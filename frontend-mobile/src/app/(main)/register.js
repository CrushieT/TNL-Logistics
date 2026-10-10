import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../features/auth/context/AuthContext';
import { canAccessMobileRoute, MOBILE_ROUTES } from '../../features/auth/services/roleAccess.mjs';
import { RegistrationScreen } from '../../features/shipments/components/RegistrationScreen';

export default function RegisterShipmentRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  if (!canAccessMobileRoute(user?.role, MOBILE_ROUTES.REGISTER)) return <Redirect href="/(main)" />;
  return <RegistrationScreen key={user.userId || user.username} />;
}
