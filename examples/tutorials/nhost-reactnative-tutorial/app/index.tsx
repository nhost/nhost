import { useRouter } from "expo-router";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "./lib/nhost/AuthProvider";
import { commonStyles, homeStyles } from "./styles/commonStyles";

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, session, nhost, user } = useAuth();

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            if (session) {
              await nhost.auth.signOut({
                refreshToken: session.refreshToken,
              });
            }
            router.replace("/");
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            Alert.alert("Error", `Failed to sign out: ${message}`);
          }
        },
      },
    ]);
  };

  return (
    <View style={commonStyles.centerContent}>
      <Text style={commonStyles.title}>Welcome to Nhost React Native Demo</Text>

      <View style={homeStyles.welcomeCard}>
        {isAuthenticated ? (
          <View style={{ gap: 15, width: "100%" }}>
            <Text style={homeStyles.welcomeText}>
              Hello, {user?.displayName || user?.email}!
            </Text>
            <TouchableOpacity
              style={[commonStyles.button, commonStyles.fullWidth]}
              onPress={() => router.push("/profile")}
            >
              <Text style={commonStyles.buttonText}>Go to Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[commonStyles.button, { backgroundColor: "#ef4444" }]}
              onPress={handleSignOut}
            >
              <Text style={commonStyles.buttonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={homeStyles.authMessage}>You are not signed in.</Text>

            <View style={{ gap: 15, width: "100%" }}>
              <TouchableOpacity
                style={[commonStyles.button, commonStyles.fullWidth]}
                onPress={() => router.push("/signin")}
              >
                <Text style={commonStyles.buttonText}>Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  commonStyles.button,
                  commonStyles.buttonSecondary,
                  commonStyles.fullWidth,
                ]}
                onPress={() => router.push("/signup")}
              >
                <Text style={commonStyles.buttonText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
