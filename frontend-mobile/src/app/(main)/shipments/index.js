import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../features/auth/context/AuthContext';
import { FindParcelScreen } from '../../../features/shipments/components/FindParcelScreen';

export default function ShipmentsListRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { filter } = useLocalSearchParams();

  if (isLoading || !isAuthenticated) return null;
  if (user?.role !== 'OFFICE_STAFF') return <Redirect href="/(main)" />;

  const initialFilter = filter === 'needs_label' ? 'NEEDS_LABEL' : 'ALL';
  return <FindParcelScreen initialFilter={initialFilter} />;
}
