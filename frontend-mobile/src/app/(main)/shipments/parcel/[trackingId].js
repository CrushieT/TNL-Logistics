import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../../features/auth/context/AuthContext';
import { canAccessMobileRoute, MOBILE_ROUTES } from '../../../../features/auth/services/roleAccess.mjs';
import { ParcelDetailScreen } from '../../../../features/shipments/components/ParcelDetailScreen';

export default function ParcelDetailRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { trackingId } = useLocalSearchParams();

  if (isLoading || !isAuthenticated) return null;
  if (!canAccessMobileRoute(user?.role, MOBILE_ROUTES.SHIPMENTS)) return <Redirect href="/(main)" />;

  return <ParcelDetailScreen trackingId={trackingId} />;
}
