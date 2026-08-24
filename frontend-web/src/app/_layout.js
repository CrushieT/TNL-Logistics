import React from 'react';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F3F2ED' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="shipments/index" />
      <Stack.Screen name="shipments/[shipmentId]/index" />
      <Stack.Screen name="shipments/[shipmentId]/units/[trackingId]" />
      <Stack.Screen name="clients" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="weekly-collections" />
      <Stack.Screen name="statements" />
      <Stack.Screen name="tracking-logs" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="users" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
