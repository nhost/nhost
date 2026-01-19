import { router } from 'expo-router';
import type React from 'react';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../lib/nhost/AuthProvider';

type AppRoutes = '/' | '/signin' | '/signup' | '/profile';

interface ProtectedScreenProps {
  children: React.ReactNode;
  redirectTo?: AppRoutes;
}

export default function ProtectedScreen({
  children,
  redirectTo = '/signin',
}: ProtectedScreenProps) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
