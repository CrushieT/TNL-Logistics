import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../features/auth/context/AuthContext';
import { RegistrationScreen } from '../../features/shipments/components/RegistrationScreen';

export default function RegisterShipmentRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  if (user?.role !== 'OFFICE_STAFF') return <Redirect href="/(main)" />;
  return <RegistrationScreen key={user.userId || user.username} />;
}
