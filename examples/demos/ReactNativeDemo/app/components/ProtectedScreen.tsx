import React, { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useAuth } from "../lib/nhost/AuthProvider";
import { router } from "expo-router";

type AppRoutes = "/" | "/signin" | "/signup" | "/profile";

interface ProtectedScreenProps {
  children: React.ReactNode;
  redirectTo?: AppRoutes;
}

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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
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
