import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../features/auth/context/AuthContext';
import { colors } from '../../theme';

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
