import { router } from "expo-router";
import type React from "react";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useAuth } from "../lib/nhost/AuthProvider";
import { commonStyles } from "../styles/commonStyles";
import { colors } from "../styles/theme";

type AppRoutes = "/" | "/signin" | "/signup" | "/profile";

interface ProtectedScreenProps {
  children: React.ReactNode;
  redirectTo?: AppRoutes;
}

/**
 * ProtectedScreen component that wraps screens requiring authentication.
 * Automatically redirects unauthenticated users to the signin screen.
 * Shows loading spinner while checking authentication status.
 */
export default function ProtectedScreen({
  children,
  redirectTo = "/signin",
}: ProtectedScreenProps) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  if (isLoading) {
    return (
      <View style={commonStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={commonStyles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
