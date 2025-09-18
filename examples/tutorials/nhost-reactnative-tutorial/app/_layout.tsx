import { Stack } from "expo-router";
import { AuthProvider } from "./lib/nhost/AuthProvider";
import { colors } from "./styles/theme";

/**
 * Root layout component that provides authentication context to the entire app.
 * Uses Expo Router's Stack navigation for screen management.
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: "Home",
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.surface,
            headerTitleStyle: { fontWeight: "bold" },
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            title: "Profile",
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: colors.surface,
            headerTitleStyle: { fontWeight: "bold" },
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
