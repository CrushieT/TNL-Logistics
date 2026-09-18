import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../features/auth/context/AuthContext';
import { ShipmentDetailScreen } from '../../../features/shipments/components/ShipmentDetailScreen';

export default function ShipmentDetailRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { id } = useLocalSearchParams();

  if (isLoading || !isAuthenticated) return null;
  if (user?.role !== 'OFFICE_STAFF') return <Redirect href="/(main)" />;

  return <ShipmentDetailScreen shipmentId={id} />;
}
