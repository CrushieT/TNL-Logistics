import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../../features/auth/context/AuthContext';
import { ParcelDetailScreen } from '../../../../features/shipments/components/ParcelDetailScreen';

export default function ParcelDetailRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { trackingId } = useLocalSearchParams();

  if (isLoading || !isAuthenticated) return null;
  if (user?.role !== 'OFFICE_STAFF') return <Redirect href="/(main)" />;

  return <ParcelDetailScreen trackingId={trackingId} />;
}
